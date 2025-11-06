import { db } from '../db';
import { 
  assessments, 
  answers,
  questions,
  clientOrganizations,
  clientFacilities,
  facilityProfiles,
  users,
  reviewWorkflows,
  type User
} from '@shared/schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import ObservabilityService from './observabilityService';

/**
 * Client Portal Service
 * Provides scoped data access ensuring clients only see their organization's data
 */
export class ClientPortalService {

  /**
   * Verify client user has access to specific client organization
   * CRITICAL: Enforces tenant isolation - clients can only access their own organization
   */
  private static async verifyClientAccess(
    userId: string,
    clientOrganizationId: string
  ): Promise<boolean> {
    try {
      // Get user with tenant information
      const [user] = await db
        .select({
          id: users.id,
          tenantId: users.tenantId,
          businessRole: users.businessRole
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user || !user.businessRole) {
        await ObservabilityService.log('WARN', 'Access denied: User not found or missing business role', {
          service: 'clientPortal',
          operation: 'verifyClientAccess',
          userId,
          metadata: { clientOrganizationId, reason: 'invalid_user' }
        });
        return false;
      }

      // Get client organization with its business and consultant tenants
      const [clientOrg] = await db
        .select({
          id: clientOrganizations.id,
          consultantTenantId: clientOrganizations.consultantTenantId,
          businessTenantId: clientOrganizations.businessTenantId
        })
        .from(clientOrganizations)
        .where(eq(clientOrganizations.id, clientOrganizationId));

      if (!clientOrg) {
        await ObservabilityService.log('WARN', 'Access denied: Client organization not found', {
          service: 'clientPortal',
          operation: 'verifyClientAccess',
          userId,
          metadata: { clientOrganizationId, reason: 'org_not_found' }
        });
        return false;
      }

      // CRITICAL SECURITY CHECK: Business user's tenant must match the business tenant
      // linked to this client organization. This enforces proper tenant isolation.
      // Handle legacy records where businessTenantId might be null
      let hasAccess = false;
      
      if (clientOrg.businessTenantId) {
        // New records: strict tenant isolation
        hasAccess = user.tenantId === clientOrg.businessTenantId;
      } else {
        // Legacy records: For now, allow access but log this for migration
        hasAccess = true;
        await ObservabilityService.log('WARN', 'Legacy client organization accessed without businessTenantId', {
          service: 'clientPortal',
          operation: 'verifyClientAccess',
          userId,
          metadata: { 
            clientOrganizationId, 
            userTenantId: user.tenantId,
            reason: 'legacy_access_granted',
            requiresMigration: true,
            severity: 'medium'
          }
        });
      }

      if (!hasAccess) {
        await ObservabilityService.log('WARN', 'Access denied: Tenant isolation violation attempted', {
          service: 'clientPortal',
          operation: 'verifyClientAccess',
          userId,
          metadata: { 
            clientOrganizationId, 
            userTenantId: user.tenantId, 
            businessTenantId: clientOrg.businessTenantId,
            reason: 'business_tenant_mismatch',
            securityEvent: true,
            severity: 'high'
          }
        });
      }

      return hasAccess;

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'clientPortal',
        operation: 'verifyClientAccess',
        userId,
        severity: 'critical',
        metadata: { 
          clientOrganizationId, 
          error: 'Access verification failed',
          securityImplication: 'Potential access control bypass'
        }
      });
      // Fail secure - deny access on any error
      return false;
    }
  }

  /**
   * Get client organization data for user
   */
  static async getClientOrganization(
    userId: string,
    clientOrganizationId: string
  ) {
    try {
      const hasAccess = await this.verifyClientAccess(userId, clientOrganizationId);
      if (!hasAccess) {
        throw new Error('Access denied to client organization');
      }

      const [clientOrg] = await db
        .select({
          id: clientOrganizations.id,
          legalName: clientOrganizations.legalName,
          dbaName: clientOrganizations.dbaName,
          entityType: clientOrganizations.entityType,
          hqAddress: clientOrganizations.hqAddress,
          hqCity: clientOrganizations.hqCity,
          hqState: clientOrganizations.hqState,
          hqZipCode: clientOrganizations.hqZipCode,
          hqCountry: clientOrganizations.hqCountry,
          primaryContactName: clientOrganizations.primaryContactName,
          primaryContactEmail: clientOrganizations.primaryContactEmail,
          primaryContactPhone: clientOrganizations.primaryContactPhone,
          collaborationStatus: clientOrganizations.collaborationStatus,
          createdAt: clientOrganizations.createdAt
        })
        .from(clientOrganizations)
        .where(eq(clientOrganizations.id, clientOrganizationId));

      if (!clientOrg) {
        throw new Error('Client organization not found');
      }

      // Get facilities count
      const [facilitiesCount] = await db
        .select({
          count: sql<number>`COUNT(*)`
        })
        .from(clientFacilities)
        .where(eq(clientFacilities.clientOrganizationId, clientOrganizationId));

      return {
        ...clientOrg,
        facilitiesCount: facilitiesCount.count || 0
      };

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'clientPortal',
        operation: 'getClientOrganization',
        userId,
        severity: 'medium',
        metadata: { clientOrganizationId }
      });
      throw error;
    }
  }

  /**
   * Get client facilities (scoped to client organization)
   */
  static async getClientFacilities(
    userId: string,
    clientOrganizationId: string,
    filters: {
      operatingStatus?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    try {
      const hasAccess = await this.verifyClientAccess(userId, clientOrganizationId);
      if (!hasAccess) {
        throw new Error('Access denied to client facilities');
      }

      const { operatingStatus, limit = 50, offset = 0 } = filters;

      const whereConditions = [eq(clientFacilities.clientOrganizationId, clientOrganizationId)];
      
      if (operatingStatus) {
        whereConditions.push(eq(clientFacilities.operatingStatus, operatingStatus));
      }

      const facilities = await db
        .select({
          id: clientFacilities.id,
          name: clientFacilities.name,
          address: clientFacilities.address,
          city: clientFacilities.city,
          state: clientFacilities.state,
          zipCode: clientFacilities.zipCode,
          country: clientFacilities.country,
          timeZone: clientFacilities.timeZone,
          operatingStatus: clientFacilities.operatingStatus,
          hoursOfOperation: clientFacilities.hoursOfOperation,
          headcount: clientFacilities.headcount,
          floorArea: clientFacilities.floorArea,
          processingActivities: clientFacilities.processingActivities,
          estimatedAnnualVolume: clientFacilities.estimatedAnnualVolume,
          isPrimary: clientFacilities.isPrimary,
          isActive: clientFacilities.isActive,
          createdAt: clientFacilities.createdAt
        })
        .from(clientFacilities)
        .where(and(...whereConditions))
        .orderBy(desc(clientFacilities.isPrimary), clientFacilities.name)
        .limit(limit)
        .offset(offset);

      return facilities;

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'clientPortal',
        operation: 'getClientFacilities',
        userId,
        severity: 'medium',
        metadata: { clientOrganizationId, filters }
      });
      throw error;
    }
  }

  /**
   * Get assessments for client organization (scoped access)
   */
  static async getClientAssessments(
    userId: string,
    clientOrganizationId: string,
    filters: {
      status?: string[];
      facilityId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    try {
      const hasAccess = await this.verifyClientAccess(userId, clientOrganizationId);
      if (!hasAccess) {
        throw new Error('Access denied to client assessments');
      }

      const { status, facilityId, limit = 20, offset = 0 } = filters;

      // Get client facilities to scope assessments
      const clientFacilityIds = await db
        .select({ id: clientFacilities.id })
        .from(clientFacilities)
        .where(eq(clientFacilities.clientOrganizationId, clientOrganizationId));

      if (clientFacilityIds.length === 0) {
        return [];
      }

      const facilityIdList = clientFacilityIds.map(f => f.id);

      const whereConditions = [inArray(assessments.facilityId, facilityIdList)];
      
      if (status && status.length > 0) {
        whereConditions.push(inArray(assessments.status, status as any));
      }
      if (facilityId) {
        // Verify facilityId belongs to client organization
        if (!facilityIdList.includes(facilityId)) {
          throw new Error('Access denied to specified facility');
        }
        whereConditions.push(eq(assessments.facilityId, facilityId));
      }

      const clientAssessments = await db
        .select({
          assessment: {
            id: assessments.id,
            title: assessments.title,
            description: assessments.description,
            status: assessments.status,
            facilityId: assessments.facilityId,
            createdAt: assessments.createdAt,
            updatedAt: assessments.updatedAt,
            completedAt: assessments.completedAt
          },
          facility: {
            id: facilityProfiles.id,
            nameIdentifier: facilityProfiles.name,
            address: facilityProfiles.address,
            city: facilityProfiles.city,
            state: facilityProfiles.state
          },
          workflow: {
            id: reviewWorkflows.id,
            status: reviewWorkflows.status,
            priority: reviewWorkflows.priority,
            dueDate: reviewWorkflows.dueDate,
            finalDecision: reviewWorkflows.finalDecision
          }
        })
        .from(assessments)
        .leftJoin(facilityProfiles, eq(assessments.facilityId, facilityProfiles.id))
        .leftJoin(reviewWorkflows, eq(assessments.id, reviewWorkflows.assessmentId))
        .where(and(...whereConditions))
        .orderBy(desc(assessments.updatedAt))
        .limit(limit)
        .offset(offset);

      return clientAssessments;

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'clientPortal',
        operation: 'getClientAssessments',
        userId,
        severity: 'medium',
        metadata: { clientOrganizationId, filters }
      });
      throw error;
    }
  }

  /**
   * Get assessment details for client (scoped access)
   */
  static async getClientAssessmentDetails(
    userId: string,
    assessmentId: string,
    clientOrganizationId: string
  ) {
    try {
      const hasAccess = await this.verifyClientAccess(userId, clientOrganizationId);
      if (!hasAccess) {
        throw new Error('Access denied to client assessments');
      }

      // First verify the assessment belongs to client organization
      const [assessment] = await db
        .select({
          assessment: assessments,
          facility: facilityProfiles
        })
        .from(assessments)
        .leftJoin(facilityProfiles, eq(assessments.facilityId, facilityProfiles.id))
        .where(eq(assessments.id, assessmentId));

      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Verify facility belongs to client organization
      const [clientFacility] = await db
        .select()
        .from(clientFacilities)
        .where(and(
          eq(clientFacilities.clientOrganizationId, clientOrganizationId),
          eq(clientFacilities.id, assessment.assessment.facilityId!)
        ));

      if (!clientFacility) {
        throw new Error('Access denied to this assessment');
      }

      // Get assessment answers with questions
      const assessmentAnswers = await db
        .select({
          answer: {
            id: answers.id,
            questionId: answers.questionId,
            value: answers.value,
            notes: answers.notes,
            compliance: answers.compliance,
            updatedAt: answers.updatedAt
          },
          question: {
            id: questions.id,
            questionId: questions.questionId,
            text: questions.text,
            category: questions.category,
            weight: questions.weight,
            helpText: questions.helpText
          }
        })
        .from(answers)
        .leftJoin(questions, eq(answers.questionId, questions.id))
        .where(eq(answers.assessmentId, assessmentId))
        .orderBy(questions.order);

      // Get review workflow if exists
      const [workflow] = await db
        .select()
        .from(reviewWorkflows)
        .where(eq(reviewWorkflows.assessmentId, assessmentId));

      return {
        assessment: assessment.assessment,
        facility: assessment.facility,
        answers: assessmentAnswers,
        workflow: workflow || null
      };

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'clientPortal',
        operation: 'getClientAssessmentDetails',
        userId,
        severity: 'medium',
        metadata: { assessmentId, clientOrganizationId }
      });
      throw error;
    }
  }

  /**
   * Get portal dashboard data for client
   */
  static async getPortalDashboard(
    userId: string,
    clientOrganizationId: string
  ) {
    try {
      const hasAccess = await this.verifyClientAccess(userId, clientOrganizationId);
      if (!hasAccess) {
        throw new Error('Access denied to client portal');
      }

      // Get organization summary
      const organization = await this.getClientOrganization(userId, clientOrganizationId);

      // Get facilities summary
      const [facilitiesSummary] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          active: sql<number>`COUNT(*) FILTER (WHERE operating_status = 'ACTIVE')`,
          inactive: sql<number>`COUNT(*) FILTER (WHERE operating_status = 'INACTIVE')`
        })
        .from(clientFacilities)
        .where(eq(clientFacilities.clientOrganizationId, clientOrganizationId));

      // Get assessments summary
      const clientFacilityIds = await db
        .select({ id: clientFacilities.id })
        .from(clientFacilities)
        .where(eq(clientFacilities.clientOrganizationId, clientOrganizationId));

      let assessmentsSummary = { total: 0, draft: 0, inProgress: 0, underReview: 0, completed: 0 };
      
      if (clientFacilityIds.length > 0) {
        const facilityIdList = clientFacilityIds.map(f => f.id);
        
        const [summary] = await db
          .select({
            total: sql<number>`COUNT(*)`,
            draft: sql<number>`COUNT(*) FILTER (WHERE status = 'DRAFT')`,
            inProgress: sql<number>`COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')`,
            underReview: sql<number>`COUNT(*) FILTER (WHERE status = 'UNDER_REVIEW')`,
            completed: sql<number>`COUNT(*) FILTER (WHERE status = 'COMPLETED')`
          })
          .from(assessments)
          .where(inArray(assessments.facilityId, facilityIdList));

        assessmentsSummary = summary;
      }

      // Get recent activity
      const recentAssessments = await this.getClientAssessments(userId, clientOrganizationId, {
        limit: 5,
        offset: 0
      });

      return {
        organization,
        summary: {
          facilities: facilitiesSummary,
          assessments: assessmentsSummary
        },
        recentActivity: {
          assessments: recentAssessments
        }
      };

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'clientPortal',
        operation: 'getPortalDashboard',
        userId,
        severity: 'medium',
        metadata: { clientOrganizationId }
      });
      throw error;
    }
  }

  /**
   * Update client organization data (limited fields)
   */
  static async updateClientOrganization(
    userId: string,
    clientOrganizationId: string,
    updateData: {
      primaryContactName?: string;
      primaryContactEmail?: string;
      primaryContactPhone?: string;
    }
  ) {
    try {
      const hasAccess = await this.verifyClientAccess(userId, clientOrganizationId);
      if (!hasAccess) {
        throw new Error('Access denied to update client organization');
      }

      // Only allow updates to contact information
      const allowedUpdates = {
        primaryContactName: updateData.primaryContactName,
        primaryContactEmail: updateData.primaryContactEmail,
        primaryContactPhone: updateData.primaryContactPhone,
        updatedAt: new Date()
      };

      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
      );

      if (Object.keys(cleanUpdates).length === 1) { // Only updatedAt
        throw new Error('No valid fields to update');
      }

      await db
        .update(clientOrganizations)
        .set(cleanUpdates)
        .where(eq(clientOrganizations.id, clientOrganizationId));

      await ObservabilityService.log('INFO', 'Client organization updated', {
        service: 'clientPortal',
        operation: 'updateClientOrganization',
        userId,
        metadata: {
          clientOrganizationId,
          updatedFields: Object.keys(cleanUpdates).filter(k => k !== 'updatedAt')
        }
      });

      return { success: true };

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'clientPortal',
        operation: 'updateClientOrganization',
        userId,
        severity: 'medium',
        metadata: { clientOrganizationId }
      });
      throw error;
    }
  }
}