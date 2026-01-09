import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  standardVersions,
  assessments,
  questions,
  clauses,
  answers,
  intakeForms,
  users,
  facilityProfiles,
  clientOrganizations,
  clientFacilities,
  evidenceFiles
} from "../../shared/schema";
import { eq, and, desc, sql, count, SQL, inArray, or, isNotNull, lt, gt } from "drizzle-orm";
import { PaginationUtils, paginationParamsSchema } from "../utils/pagination.js";
import { AuthService } from "../services/authService";
import type { AuthenticatedRequest } from "../services/authService";
import { validateRequest, validation, businessSchemas, commonSchemas } from "../middleware/validationMiddleware.js";
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import { QueryOptimizationService } from '../services/queryOptimizationService';
import { cacheService } from '../services/cachingService';
import { ConsistentLogService } from '../services/consistentLogService';
import { IntakeProcessor } from './intakeLogic';
import { refreshClientOrgStats, refreshAssessmentStats } from '../services/materializedViews';

const router = Router();

// Helper function to get user's accessible facilities
async function getUserAccessibleFacilities(userId: string, tenantId: string) {
  const facilitiesQuery = await db.execute(sql`
    SELECT fp.id, fp.name, fp."isPrimary", fp."operatingStatus"
    FROM "FacilityProfile" fp
    LEFT JOIN "UserFacilityScope" ufs ON fp.id = ufs."facilityId" AND ufs."userId" = ${userId} AND ufs."isActive" = true
    LEFT JOIN "User" u ON u.id = ${userId}
    WHERE fp."tenantId" = ${tenantId} 
      AND fp."isActive" = true
      AND (ufs.id IS NOT NULL OR u."businessRole" IN ('business_owner', 'account_admin'))
    ORDER BY fp."isPrimary" DESC, fp.name ASC
  `);

  return facilitiesQuery.rows.map((f: any) => ({
    id: f.id,
    name: f.name,
    isPrimary: f.isPrimary,
    operatingStatus: f.operatingStatus
  }));
}

// All routes require authentication
router.use(AuthService.authMiddleware);

// GET /api/assessments/standards - Get available standards (MUST be first to avoid /:id conflict)
router.get("/standards", async (req: AuthenticatedRequest, res) => {
  try {
    const standards = await db.select().from(standardVersions);

    res.json(standards);
  } catch (error) {
    console.error("Error fetching standards:", error);
    res.status(500).json({ error: "Failed to fetch standards" });
  }
});

// Local validation schema for assessment creation
const createAssessmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).optional(),
  description: z.string().max(1000).optional(),
  stdCode: z.string().optional().default("R2V3_1"),
  intakeFormId: z.string().uuid().optional(),
  
  // Business user fields
  facilityId: z.string().uuid().optional(),
  
  // Consultant user fields
  clientOrganizationId: z.string().uuid().optional(),
  clientFacilityId: z.string().uuid().optional(),
  
  assignedUsers: z.array(z.string().uuid()).optional(),
}).refine(data => {
  return data.title || data.intakeFormId;
}, {
  message: "Title is required when not creating from intake form",
  path: ["title"]
}).refine(data => {
  // Either facilityId OR clientOrganizationId must be provided
  return data.facilityId || data.clientOrganizationId;
}, {
  message: "Either facilityId (for Business) or clientOrganizationId (for Consultant) is required",
  path: ["facilityId"]
});

// POST /api/assessments - Create new assessment
router.post("/", 
  rateLimitMiddleware.general, 
  async (req: AuthenticatedRequest, res) => {
  try {
    // Validate request body
    const parseResult = createAssessmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: parseResult.error.errors
      });
    }

    const data = parseResult.data;

    // Verify standard exists
    const standard = await db.query.standardVersions.findFirst({
      where: eq(standardVersions.code, data.stdCode),
    });

    if (!standard) {
      return res.status(404).json({ error: "Standard not found" });
    }

    // Dual-path validation: Business (facilityId) vs Consultant (clientOrganizationId/clientFacilityId)
    let facility = null;
    let facilityName = '';
    
    if (data.facilityId) {
      // Business path: Validate own facility
      facility = await db.query.facilityProfiles.findFirst({
        where: and(
          eq(facilityProfiles.id, data.facilityId),
          eq(facilityProfiles.tenantId, req.tenant!.id),
          eq(facilityProfiles.isActive, true)
        )
      });

      if (!facility) {
        return res.status(404).json({ 
          error: "Facility not found or inactive",
          code: "FACILITY_NOT_FOUND"
        });
      }

      // Enhanced facility access validation
      const userRole = req.user!.businessRole;
      const isAdminRole = ['business_owner', 'account_admin'].includes(userRole);

      if (!isAdminRole) {
        // For non-admin users, check facility-specific permissions
        const userFacilityAccess = await db.execute(sql`
          SELECT 1 FROM "UserFacilityScope" ufs
          WHERE ufs."userId" = ${req.user!.id} 
            AND ufs."facilityId" = ${data.facilityId}
            AND ufs."isActive" = true
        `);

        if (userFacilityAccess.rowCount === 0) {
          return res.status(403).json({ 
            error: "You don't have permission to create assessments for this facility",
            code: "INSUFFICIENT_FACILITY_PERMISSIONS",
            availableFacilities: await getUserAccessibleFacilities(req.user!.id, req.tenant!.id)
          });
        }
      }

      // Validate facility operational status
      if (facility.operatingStatus !== 'ACTIVE') {
        return res.status(400).json({
          error: `Cannot create assessments for facilities with status: ${facility.operatingStatus}`,
          code: "FACILITY_NOT_OPERATIONAL"
        });
      }
      
      facilityName = facility.name;
      
    } else if (data.clientOrganizationId) {
      // Consultant path: Validate client organization and facility
      const clientOrg = await db.query.clientOrganizations.findFirst({
        where: and(
          eq(clientOrganizations.id, data.clientOrganizationId),
          eq(clientOrganizations.consultantTenantId, req.tenant!.id)
        )
      });

      if (!clientOrg) {
        return res.status(404).json({ 
          error: "Client organization not found or access denied",
          code: "CLIENT_ORGANIZATION_NOT_FOUND"
        });
      }

      // If clientFacilityId is provided, validate it belongs to the client organization
      if (data.clientFacilityId) {
        const clientFacility = await db.query.clientFacilities.findFirst({
          where: and(
            eq(clientFacilities.id, data.clientFacilityId),
            eq(clientFacilities.clientOrganizationId, data.clientOrganizationId)
          )
        });

        if (!clientFacility) {
          return res.status(404).json({ 
            error: "Client facility not found or does not belong to the selected organization",
            code: "CLIENT_FACILITY_NOT_FOUND"
          });
        }

        // Validate facility operational status
        if (clientFacility.operatingStatus !== 'ACTIVE') {
          return res.status(400).json({
            error: `Cannot create assessments for facilities with status: ${clientFacility.operatingStatus}`,
            code: "CLIENT_FACILITY_NOT_OPERATIONAL"
          });
        }
        
        facilityName = clientFacility.name;
      } else {
        facilityName = clientOrg.legalName;
      }
    }

    // If intake form specified, verify it belongs to tenant
    let intakeForm = null;
    if (data.intakeFormId) {
      console.log(`Validating intake form ${data.intakeFormId} for tenant ${req.tenant!.id}`);

      intakeForm = await db.query.intakeForms.findFirst({
        where: and(
          eq(intakeForms.id, data.intakeFormId),
          eq(intakeForms.tenantId, req.tenant!.id)
        ),
      });

      if (!intakeForm) {
        console.error(`❌ Intake form ${data.intakeFormId} not found for tenant ${req.tenant!.id}`);
        return res.status(404).json({ 
          error: "Intake form not found",
          code: "INTAKE_FORM_NOT_FOUND",
          details: { intakeFormId: data.intakeFormId, tenantId: req.tenant!.id }
        });
      }

      console.log(`Intake form found with status: ${intakeForm.status}`);

      if (intakeForm.status !== "SUBMITTED" && intakeForm.status !== "APPROVED") {
        console.error(`❌ Intake form ${data.intakeFormId} has invalid status: ${intakeForm.status}`);
        return res.status(400).json({ 
          error: "Intake form must be submitted or approved before creating assessment",
          code: "INTAKE_FORM_INVALID_STATUS",
          details: { currentStatus: intakeForm.status, requiredStatus: ["SUBMITTED", "APPROVED"] }
        });
      }
    } else {
      // If no intake form provided, try to find the most recent submitted form
      console.log(`No intake form specified, searching for recent submitted form for tenant ${req.tenant!.id}`);

      const recentIntakeForm = await db.query.intakeForms.findFirst({
        where: and(
          eq(intakeForms.tenantId, req.tenant!.id),
          eq(intakeForms.status, 'SUBMITTED')
        ),
        orderBy: desc(intakeForms.submittedAt)
      });

      if (recentIntakeForm) {
        console.log(`✅ Auto-selecting recent intake form: ${recentIntakeForm.id}`);
        intakeForm = recentIntakeForm;
        data.intakeFormId = recentIntakeForm.id;
      } else {
        console.warn(`⚠️ No submitted intake forms found for tenant ${req.tenant!.id}`);
      }
    }

    // If we still don't have a facility ID and we have an intake form, try to use the tenant's primary facility
    if (!data.facilityId && intakeForm) {
      const primaryFacility = await db.query.facilityProfiles.findFirst({
        where: and(
          eq(facilityProfiles.tenantId, req.tenant!.id),
          eq(facilityProfiles.isPrimary, true),
          eq(facilityProfiles.isActive, true)
        )
      });

      if (primaryFacility) {
        data.facilityId = primaryFacility.id;
        console.log(`✅ Using primary facility: ${primaryFacility.id} for assessment`);
      }
    }

    // CRITICAL: Perform REC mapping BEFORE assessment creation to determine scope
    let recMappingInfo = null;
    let scopeStatement = '';
    let requiredAppendices: string[] = [];

    if (intakeForm) {
      try {
        console.log(`🎯 Performing REC mapping for intake form: ${intakeForm.id}`);

        // Generate assessment scope using REC mapping logic
        const assessmentScope = await IntakeProcessor.generateAssessmentScope(intakeForm.id);

        recMappingInfo = {
          applicableRecCodes: assessmentScope.applicableRecCodes,
          scopeStatement: assessmentScope.scopeStatement,
          requiredAppendices: assessmentScope.requiredAppendices,
          complexityFactors: assessmentScope.complexityFactors,
          estimatedAuditDays: assessmentScope.estimatedAuditDays,
          criticalRequirements: assessmentScope.criticalRequirements,
          totalAvailableQuestions: 0, // Will be updated by question filtering
          filteredQuestionsCount: 0,
          filteringRatio: 0,
          lastRefreshed: new Date().toISOString()
        };

        scopeStatement = assessmentScope.scopeStatement;
        requiredAppendices = assessmentScope.requiredAppendices;

        console.log(`✅ REC mapping completed - ${assessmentScope.applicableRecCodes.length} RECs, ${assessmentScope.requiredAppendices.length} appendices`);
      } catch (error) {
        console.error('❌ REC mapping failed:', error);

        // Return specific REC mapping error
        return res.status(400).json({
          error: 'REC mapping failed',
          code: 'REC_MAPPING_FAILED',
          message: 'Failed to generate assessment scope from intake form data',
          details: error instanceof Error ? error.message : 'Unknown REC mapping error'
        });
      }
    }

    // Generate intelligent title and description based on REC mapping results
    let assessmentTitle = data.title;
    let assessmentDescription = data.description;

    if (intakeForm && !data.title) {
      // Auto-generate comprehensive title from intake data
      const companyName = intakeForm.legalCompanyName || req.tenant!.name;
      const facilityCount = intakeForm.totalFacilities ? ` (${intakeForm.totalFacilities} facilities)` : '';
      const appendixSuffix = requiredAppendices.length > 0 ? ` - ${requiredAppendices.join(', ')}` : '';
      assessmentTitle = `${companyName}${facilityCount} - R2v3 Assessment${appendixSuffix}`;
    }

    if (intakeForm && !data.description) {
      // Use REC mapping scope statement as primary description
      assessmentDescription = scopeStatement;
    }

    // Ensure we have a title (fallback if no intake form and no title provided)
    if (!assessmentTitle) {
      assessmentTitle = `${req.tenant!.name} - R2v3 Assessment`;
    }

    // Create assessment with REC mapping information (supports both Business and Consultant paths)
    const [assessment] = await db.insert(assessments).values({
      tenantId: req.tenant!.id,
      createdBy: req.user!.id,
      stdId: standard.id,
      title: assessmentTitle,
      description: assessmentDescription,
      intakeFormId: data.intakeFormId,
      facilityId: data.facilityId || null,
      clientOrganizationId: data.clientOrganizationId || null,
      clientFacilityId: data.clientFacilityId || null,
      assignedUsers: data.assignedUsers || [req.user!.id],
      status: "DRAFT",
      filteringInfo: recMappingInfo, // Store REC mapping results for question filtering
    }).returning();

    // Log audit event with facility or client information
    const auditDetails: any = { 
      title: assessment.title,
      intakeFormId: data.intakeFormId
    };
    
    if (data.facilityId) {
      auditDetails.facilityId = data.facilityId;
      auditDetails.facilityName = facilityName;
    } else if (data.clientOrganizationId) {
      auditDetails.clientOrganizationId = data.clientOrganizationId;
      if (data.clientFacilityId) {
        auditDetails.clientFacilityId = data.clientFacilityId;
      }
      auditDetails.facilityName = facilityName;
    }
    
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'ASSESSMENT_CREATED',
      'assessment',
      assessment.id,
      undefined,
      auditDetails
    );

    // Refresh materialized views (non-blocking)
    refreshAssessmentStats().catch(err => {
      console.error('[Assessment] Failed to refresh assessment stats after creation:', err);
    });
    
    if (assessment.clientOrganizationId) {
      refreshClientOrgStats().catch(err => {
        console.error('[Assessment] Failed to refresh client org stats after creation:', err);
      });
    }

    // Return comprehensive response for frontend
    const responseData: any = {
      success: true,
      assessment: {
        ...assessment,
        intakeForm: intakeForm ? {
          id: intakeForm.id,
          legalCompanyName: intakeForm.legalCompanyName,
          status: intakeForm.status
        } : null
      },
      message: "Assessment created successfully"
    };

    console.log('Assessment created successfully:', assessment.id);
    res.status(201).json(responseData);
  } catch (error) {
    console.error("Error creating assessment:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: "Failed to create assessment" });
  }
});

// GET /api/assessments - List assessments for tenant with cursor-based pagination
router.get("/", 
  rateLimitMiddleware.general, 
  async (req: AuthenticatedRequest, res) => {
  try {
    const { status, facilityId } = req.query;

    // Parse and validate pagination parameters
    const paginationParams = paginationParamsSchema.safeParse(req.query);
    if (!paginationParams.success) {
      return res.status(400).json({ 
        error: "Invalid pagination parameters", 
        details: paginationParams.error.errors 
      });
    }

    const { limit, cursor, direction } = PaginationUtils.validateParams(paginationParams.data);

    // Get facility context from header
    const facilityContext = req.headers['x-facility-context'] as string;

    const tenantType = req.tenant!.tenantType;

    // CRITICAL: Explicit tenant-based filtering for security (preserved from original)
    let whereCondition: SQL<unknown>;

    if (tenantType === 'CONSULTANT') {
      // CONSULTANT PATH: Show only client assessments
      console.log(`🔒 CONSULTANT filtering for tenant ${req.tenant!.id}`);

      // Get all client organizations managed by this consultant
      const clientOrgs = await db.query.clientOrganizations.findMany({
        where: eq(clientOrganizations.consultantTenantId, req.tenant!.id),
        columns: { id: true }
      });

      const clientOrgIds = clientOrgs.map(org => org.id);

      if (clientOrgIds.length === 0) {
        // Consultant has no clients yet, return empty results
        return res.json({
          data: [],
          pagination: { hasMore: false, nextCursor: null, prevCursor: null, totalReturned: 0 }
        });
      }

      // Filter to assessments linked to this consultant's client organizations
      whereCondition = and(
        eq(assessments.tenantId, req.tenant!.id),
        inArray(assessments.clientOrganizationId, clientOrgIds)
      )!;
    } else {
      // BUSINESS PATH: Show only own assessments (existing logic)
      console.log(`🔒 BUSINESS filtering for tenant ${req.tenant!.id}`);
      
      whereCondition = eq(assessments.tenantId, req.tenant!.id);

      // Apply facility context filtering if provided
      const effectiveFacilityId = facilityId || facilityContext;

      if (effectiveFacilityId) {
        whereCondition = and(
          whereCondition,
          eq(assessments.facilityId, String(effectiveFacilityId))
        )!;
      }

      // Apply facility scoping for non-admin Business users
      const userRole = req.user!.businessRole;
      if (!['business_owner', 'account_admin'].includes(userRole)) {
        // Get user's accessible facilities
        const userFacilities = await db.execute(sql`
          SELECT "facilityId" FROM "UserFacilityScope" 
          WHERE "userId" = ${req.user!.id} AND "isActive" = true
        `);

        if (userFacilities.rowCount > 0) {
          const facilityIds = userFacilities.rows.map((f: any) => f.facilityId);

          // If facility context is provided, validate user has access to it
          if (facilityContext && !facilityIds.includes(facilityContext)) {
            return res.status(403).json({ 
              error: "You don't have access to the specified facility",
              code: "INSUFFICIENT_FACILITY_PERMISSIONS"
            });
          }

          whereCondition = and(
            whereCondition,
            sql`${assessments.facilityId} = ANY(${facilityIds})`
          )!;
        } else {
          // User has no facility access, return empty results
          return res.json({
            data: [],
            pagination: { hasMore: false, nextCursor: null, prevCursor: null, totalReturned: 0 }
          });
        }
      }
    }

    // Apply status filter (common for both Business and Consultant)
    if (status) {
      whereCondition = and(
        whereCondition,
        eq(assessments.status, status as any)
      )!;
    }

    // Build cursor condition for pagination using (updatedAt DESC, id ASC) composite
    if (cursor && cursor.timestamp) {
      const cursorTimestamp = new Date(cursor.timestamp);
      
      if (direction === 'forward') {
        // Forward DESC: (updatedAt < cursor.updatedAt) OR (updatedAt = cursor.updatedAt AND id > cursor.id)
        // Primary sort DESC uses <, tie-breaker ASC uses >
        whereCondition = and(
          whereCondition,
          or(
            lt(assessments.updatedAt, cursorTimestamp),
            and(
              eq(assessments.updatedAt, cursorTimestamp),
              gt(assessments.id, cursor.id)
            )
          )
        )!;
      } else {
        // Backward DESC: (updatedAt > cursor.updatedAt) OR (updatedAt = cursor.updatedAt AND id < cursor.id)
        whereCondition = and(
          whereCondition,
          or(
            gt(assessments.updatedAt, cursorTimestamp),
            and(
              eq(assessments.updatedAt, cursorTimestamp),
              lt(assessments.id, cursor.id)
            )
          )
        )!;
      }
    }

    // Query limit + 1 to determine if there are more results
    // For backward navigation, invert ORDER BY, then reverse results
    let allAssessments = await db.query.assessments.findMany({
      where: whereCondition,
      orderBy: direction === 'forward' 
        ? [desc(assessments.updatedAt), assessments.id]
        : [assessments.updatedAt, desc(assessments.id)],
      limit: limit + 1,
      with: {
        standard: {
          columns: {
            code: true,
            name: true,
            version: true,
          }
        },
        createdByUser: {
          columns: {
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        intakeForm: {
          columns: {
            id: true,
            title: true,
            legalCompanyName: true,
            status: true,
          }
        },
        // Include client organization and facility for consultant assessments
        clientOrganization: {
          columns: {
            id: true,
            legalName: true,
            dbaName: true,
          }
        },
        clientFacility: {
          columns: {
            id: true,
            name: true,
            city: true,
            state: true,
          }
        }
      }
    });

    // For backward navigation, reverse the results to maintain natural order
    if (direction === 'backward') {
      allAssessments = allAssessments.reverse();
    }

    // Build paginated response
    // For backward: sentinel is at START after reverse, skip it
    // For forward: sentinel is at END, take first limit items
    const hasMore = allAssessments.length > limit;
    const data = hasMore 
      ? (direction === 'backward' ? allAssessments.slice(1) : allAssessments.slice(0, limit))
      : allAssessments;

    let nextCursor = null;
    let prevCursor = null;

    if (data.length > 0) {
      if (direction === 'forward' && hasMore) {
        const lastItem = data[data.length - 1];
        nextCursor = PaginationUtils.encodeCursor({
          id: lastItem.id,
          timestamp: lastItem.updatedAt?.getTime(),
        });
      }

      // Only provide prevCursor if not on first page
      if (cursor) {
        const firstItem = data[0];
        prevCursor = PaginationUtils.encodeCursor({
          id: firstItem.id,
          timestamp: firstItem.updatedAt?.getTime(),
        });
      }
    }

    console.log(`✅ Returned ${data.length} assessments for ${tenantType} tenant ${req.tenant!.id}`);

    res.json({
      data,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor,
        totalReturned: data.length,
      }
    });
  } catch (error) {
    console.error("Error fetching assessments:", error);
    res.status(500).json({ error: "Failed to fetch assessments" });
  }
});

// GET /api/assessments/:id - Get single assessment with details
router.get("/:id", 
  rateLimitMiddleware.general, 
  async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, id),
        eq(assessments.tenantId, req.tenant!.id)
      ),
      with: {
        standard: {
          columns: {
            code: true,
            name: true,
            version: true,
          }
        },
        createdByUser: {
          columns: {
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        intakeForm: {
          columns: {
            id: true,
            title: true,
            legalCompanyName: true,
            status: true,
            completionPercentage: true,
          }
        },
        clientOrganization: {
          columns: {
            id: true,
            legalName: true,
            dbaName: true,
          }
        },
        clientFacility: {
          columns: {
            id: true,
            name: true,
            city: true,
            state: true,
          }
        }
      }
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Verify facility access for non-admin users
    const userRole = req.user!.businessRole;
    if (!['business_owner', 'account_admin'].includes(userRole) && assessment.facilityId) {
      const userFacilityAccess = await db.execute(sql`
        SELECT 1 FROM "UserFacilityScope" 
        WHERE "userId" = ${req.user!.id} 
          AND "facilityId" = ${assessment.facilityId}
          AND "isActive" = true
      `);

      if (userFacilityAccess.rowCount === 0) {
        return res.status(403).json({ error: "You don't have permission to access this assessment" });
      }
    }

    // Get facility information
    let facilityInfo = null;
    if (assessment.facilityId) {
      facilityInfo = await db.query.facilityProfiles.findFirst({
        where: eq(facilityProfiles.id, assessment.facilityId),
        columns: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          isPrimary: true
        }
      });
    }

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Get progress statistics
    const totalQuestions = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(eq(clauses.stdId, assessment.stdId));

    const answeredQuestions = await db
      .select({ count: sql<number>`count(*)` })
      .from(answers)
      .where(eq(answers.assessmentId, assessment.id));

    const requiredQuestions = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(and(
        eq(clauses.stdId, assessment.stdId),
        eq(questions.required, true)
      ));

    const answeredRequiredQuestions = await db
      .select({ count: sql<number>`count(*)` })
      .from(answers)
      .leftJoin(questions, eq(answers.questionId, questions.id))
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(and(
        eq(answers.assessmentId, assessment.id),
        eq(clauses.stdId, assessment.stdId),
        eq(questions.required, true)
      ));

    // Get evidence file count
    const evidenceFilesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.assessmentId, assessment.id));
    
    const evidenceFilesCount = evidenceFilesResult[0]?.count || 0;

    const progressStats = {
      totalQuestions: totalQuestions[0]?.count || 0,
      answeredQuestions: answeredQuestions[0]?.count || 0,
      requiredQuestions: requiredQuestions[0]?.count || 0,
      answeredRequiredQuestions: answeredRequiredQuestions[0]?.count || 0,
      evidenceFiles: evidenceFilesCount,
      completionPercentage: totalQuestions[0]?.count ? 
        Math.round(((answeredQuestions[0]?.count || 0) / totalQuestions[0].count) * 100) : 0,
      requiredCompletionPercentage: requiredQuestions[0]?.count ?
        Math.round(((answeredRequiredQuestions[0]?.count || 0) / requiredQuestions[0].count) * 100) : 100,
    };

    res.json({
      ...assessment,
      facility: facilityInfo,
      progress: progressStats,
      filteringInfo: assessment.filteringInfo || null, // Explicitly include REC mapping metadata
    });
  } catch (error) {
    console.error("Error fetching assessment:", error);
    res.status(500).json({ error: "Failed to fetch assessment" });
  }
});

// PUT /api/assessments/:id - Update assessment
router.put("/:id", 
  rateLimitMiddleware.general, 
  async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = req.body; // Data is already validated by validation middleware

    // Verify assessment ownership
    const existingAssessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, id),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!existingAssessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Parse dueDate if provided
    const updateData = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      updatedAt: new Date(),
    };

    const [updatedAssessment] = await db.update(assessments)
      .set(updateData)
      .where(eq(assessments.id, id))
      .returning();

    // Log audit event
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'ASSESSMENT_UPDATED',
      'assessment',
      id,
      { title: existingAssessment.title, status: existingAssessment.status },
      { title: updatedAssessment.title, status: updatedAssessment.status }
    );

    // Refresh materialized views if status or overallScore changed (affects stats)
    const statusChanged = existingAssessment.status !== updatedAssessment.status;
    const scoreChanged = existingAssessment.overallScore !== updatedAssessment.overallScore;
    
    if (statusChanged || scoreChanged) {
      refreshAssessmentStats().catch(err => {
        console.error('[Assessment] Failed to refresh assessment stats after update:', err);
      });
    }
    
    if (updatedAssessment.clientOrganizationId && statusChanged) {
      refreshClientOrgStats().catch(err => {
        console.error('[Assessment] Failed to refresh client org stats after update:', err);
      });
    }

    res.json(updatedAssessment);
  } catch (error) {
    console.error("Error updating assessment:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: "Failed to update assessment" });
  }
});

// GET /api/assessments/:id/questions - Get questions for assessment with intelligent filtering
router.get("/:id/questions", 
  rateLimitMiddleware.general, 
  async (req: AuthenticatedRequest, res) => {
    console.log(`🎯 Questions request for assessment ${req.params.id} by user ${req.user?.id}`);
    
    if (!req.user) {
      console.error('❌ No user found in request - auth middleware issue');
      return res.status(401).json({ error: 'Authentication required' });
    }
  try {
    const { id } = req.params;
    const { category, required, answered, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Verify assessment ownership
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, id),
        eq(assessments.tenantId, req.tenant!.id)
      ),
      with: {
        standard: true,
        intakeForm: true,
      }
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Check if REC mapping has been performed
    const filteringInfo = assessment.filteringInfo as any;
    const hasRecMapping = filteringInfo && 
                         filteringInfo.applicableRecCodes && 
                         filteringInfo.applicableRecCodes.length > 0;

    if (assessment.intakeFormId && !hasRecMapping) {
      console.warn(`⚠️ Assessment ${id} has intake form but missing REC mapping - performing now`);

      // Perform REC mapping if missing
      try {
        const assessmentScope = await IntakeProcessor.generateAssessmentScope(assessment.intakeFormId);
        const recMappingInfo = {
          applicableRecCodes: assessmentScope.applicableRecCodes,
          scopeStatement: assessmentScope.scopeStatement,
          requiredAppendices: assessmentScope.requiredAppendices,
          complexityFactors: assessmentScope.complexityFactors,
          estimatedAuditDays: assessmentScope.estimatedAuditDays,
          criticalRequirements: assessmentScope.criticalRequirements,
          lastRefreshed: new Date().toISOString(),
          totalAvailableQuestions: 0,
          filteredQuestionsCount: 0,
          filteringRatio: 0
        };

        // Update assessment with REC mapping
        await db.update(assessments)
          .set({ filteringInfo: recMappingInfo })
          .where(eq(assessments.id, id));

        // Update local assessment object
        (assessment as any).filteringInfo = recMappingInfo;

        console.log(`✅ REC mapping completed for assessment ${id}`);
      } catch (error) {
        console.error(`❌ Failed to perform REC mapping for assessment ${id}:`, error);
      }
    }

    // Build base where conditions
    let whereConditions: SQL<unknown> = eq(clauses.stdId, assessment.stdId);

    // Apply REC-based filtering if available
    const assessmentFilteringInfo = assessment.filteringInfo as any;
    if (assessmentFilteringInfo && assessmentFilteringInfo.applicableRecCodes) {
      console.log(`🎯 Applying REC-based question filtering: ${assessmentFilteringInfo.applicableRecCodes.join(', ')}`);

      const applicableRecCodes = assessmentFilteringInfo.applicableRecCodes;
      const requiredAppendices = assessmentFilteringInfo.requiredAppendices || [];

      // Filter questions based on:
      // 1. Required questions (always included)
      // 2. Questions matching applicable REC codes
      // 3. Questions for required appendices
      const recFilterConditions = [];

      // Always include required questions
      recFilterConditions.push(eq(questions.required, true));

      // Include questions for applicable appendices
      if (requiredAppendices.length > 0) {
        recFilterConditions.push(inArray(questions.appendix, requiredAppendices));
      }

      // Include questions matching category codes from applicable RECs
      const categoryCodesFromRecs = applicableRecCodes
        .map((rec: string) => rec.split('-')[0]) // Extract category prefix (e.g., 'LEGAL' from 'LEGAL-01')
        .filter((cat: string) => cat.length > 0);

      if (categoryCodesFromRecs.length > 0) {
        // Build category condition using proper SQL syntax
        const categoryConditions = categoryCodesFromRecs.map((cat: string) => 
          sql`${questions.category_code} LIKE ${cat + '%'}`
        );
        
        if (categoryConditions.length === 1) {
          recFilterConditions.push(categoryConditions[0]);
        } else if (categoryConditions.length > 1) {
          // Use drizzle's or() function for proper OR construction
          recFilterConditions.push(or(...categoryConditions)!);
        }
      }

      // Combine REC filter conditions with OR logic
      if (recFilterConditions.length > 0) {
        if (recFilterConditions.length === 1) {
          whereConditions = and(whereConditions, recFilterConditions[0])!;
        } else {
          // Use drizzle's or() function for proper OR construction
          whereConditions = and(whereConditions, or(...recFilterConditions))!;
        }
      }
    }

    if (category) {
      whereConditions = and(whereConditions, eq(questions.category, category as string))!;
    }

    if (required === 'true') {
      whereConditions = and(whereConditions, eq(questions.required, true))!;
    }

    // Get questions with their answers
    const questionsQuery = db
      .select({
        id: questions.id,
        questionId: questions.questionId,
        text: questions.text,
        responseType: questions.responseType,
        required: questions.required,
        evidenceRequired: questions.evidenceRequired,
        appendix: questions.appendix,
        weight: questions.weight,
        helpText: questions.helpText,
        category: questions.category,
        categoryCode: questions.category_code,
        categoryName: questions.categoryName,
        clauseRef: clauses.ref,
        clauseTitle: clauses.title,
        clauseOrder: clauses.order,
        order: questions.order,
        answerValue: answers.value,
        answerNotes: answers.notes,
        answerCompliance: answers.compliance,
        answerScore: answers.score,
        answeredBy: answers.answeredBy,
        answeredAt: answers.updatedAt,
      })
      .from(questions)
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .leftJoin(answers, and(
        eq(answers.questionId, questions.id),
        eq(answers.assessmentId, assessment.id)
      ))
      .where(whereConditions)
      .orderBy(clauses.order, questions.order)
      .limit(Number(limit))
      .offset(offset);

    // Apply answered filter if specified
    const questionResults = await questionsQuery;

    // Debug logging for answer retrieval
    const questionsWithAnswers = questionResults.filter(q => q.answerValue !== null);
    console.log(`📊 [Questions Endpoint] Assessment ${id}:`, {
      totalQuestions: questionResults.length,
      questionsWithAnswers: questionsWithAnswers.length,
      sampleWithAnswer: questionsWithAnswers.slice(0, 2).map(q => ({
        questionId: q.questionId,
        id: q.id,
        answerValue: q.answerValue,
        answerScore: q.answerScore
      })),
      sampleWithoutAnswer: questionResults.filter(q => q.answerValue === null).slice(0, 2).map(q => ({
        questionId: q.questionId,
        id: q.id
      }))
    });

    let filteredQuestions = questionResults;
    if (answered === 'true') {
      filteredQuestions = questionResults.filter(q => q.answerValue !== null);
    } else if (answered === 'false') {
      filteredQuestions = questionResults.filter(q => q.answerValue === null);
    }

    // Group by clause
    const questionsByClause = new Map<string, any>();

    filteredQuestions.forEach(q => {
      const clauseRef = q.clauseRef || 'UNSPECIFIED';

      if (!questionsByClause.has(clauseRef)) {
        questionsByClause.set(clauseRef, {
          clauseRef,
          clauseTitle: q.clauseTitle || 'Unspecified',
          clauseOrder: q.clauseOrder || 999,
          questions: [],
          progress: {
            total: 0,
            answered: 0,
            required: 0,
            answeredRequired: 0,
          }
        });
      }

      const clause = questionsByClause.get(clauseRef)!;
      clause.questions.push({
        id: q.id,
        questionId: q.questionId,
        text: q.text,
        responseType: q.responseType,
        required: q.required,
        evidenceRequired: q.evidenceRequired,
        appendix: q.appendix,
        weight: q.weight,
        helpText: q.helpText,
        category: q.category,
        categoryCode: q.categoryCode,
        categoryName: q.categoryName,
        order: q.order,
        answer: q.answerValue ? {
          value: q.answerValue,
          notes: q.answerNotes,
          compliance: q.answerCompliance,
          score: q.answerScore,
          answeredBy: q.answeredBy,
          answeredAt: q.answeredAt,
        } : null,
      });

      // Update progress
      clause.progress.total++;
      if (q.answerValue !== null) clause.progress.answered++;
      if (q.required) {
        clause.progress.required++;
        if (q.answerValue !== null) clause.progress.answeredRequired++;
      }
    });

    // Convert to array and sort by clause order
    const groups = Array.from(questionsByClause.values())
      .sort((a, b) => a.clauseOrder - b.clauseOrder);

    // Get total counts for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(whereConditions);

    const total = totalCount[0]?.count || 0;

    // Calculate overall progress
    const overallProgress = {
      totalQuestions: total,
      answeredQuestions: questionResults.filter(q => q.answerValue !== null).length,
      requiredQuestions: questionResults.filter(q => q.required).length,
      answeredRequiredQuestions: questionResults.filter(q => q.required && q.answerValue !== null).length,
    };

    res.json({
      assessmentId: assessment.id,
      standardCode: (assessment.standard as any).code,
      groups,
      progress: overallProgress,
      filtering: assessment.intakeForm && assessment.filteringInfo ? {
        enabled: true,
        intakeFormId: assessment.intakeFormId,
        companyName: (assessment.intakeForm as any).legalCompanyName,
        totalAvailableQuestions: total + (questionResults.length || 0), // Approximate total before filtering
        filteredQuestionsCount: questionResults.length,
        filteringRatio: questionResults.length > 0 ? questionResults.length / (total + questionResults.length) : 1,
        applicableRecCodes: (assessment.filteringInfo as any).applicableRecCodes || [],
        scopeStatement: (assessment.filteringInfo as any).scopeStatement || '',
        requiredAppendices: (assessment.filteringInfo as any).requiredAppendices || [],
        lastRefreshed: (assessment.filteringInfo as any).lastRefreshed || new Date().toISOString()
      } : {
        enabled: false,
      },
      totalQuestions: questionResults.length,
      requiredCount: questionResults.filter(q => q.required).length,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      }
    });
  } catch (error) {
    console.error("Error fetching assessment questions:", error);
    res.status(500).json({ error: "Failed to fetch assessment questions" });
  }
});

// DELETE /api/assessments/:id - Delete assessment
router.delete("/:id", 
  rateLimitMiddleware.general, 
  async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Verify assessment ownership
    const existingAssessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, id),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!existingAssessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Check if assessment can be deleted (not completed)
    if (existingAssessment.status === "COMPLETED") {
      return res.status(400).json({ error: "Cannot delete completed assessment" });
    }

    // Update status to archived instead of hard delete
    await db.update(assessments)
      .set({ 
        status: "ARCHIVED",
        updatedAt: new Date(),
      })
      .where(eq(assessments.id, id));

    // Log audit event
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'ASSESSMENT_ARCHIVED',
      'assessment',
      id,
      { status: existingAssessment.status },
      { status: 'ARCHIVED' }
    );

    // Refresh materialized views (archiving affects counts)
    refreshAssessmentStats().catch(err => {
      console.error('[Assessment] Failed to refresh assessment stats after deletion:', err);
    });
    
    if (existingAssessment.clientOrganizationId) {
      refreshClientOrgStats().catch(err => {
        console.error('[Assessment] Failed to refresh client org stats after deletion:', err);
      });
    }

    res.json({ message: "Assessment archived successfully" });
  } catch (error) {
    console.error("Error archiving assessment:", error);
    res.status(500).json({ error: "Failed to archive assessment" });
  }
});

// GET /api/assessments/:id/progress - Get detailed progress information
router.get("/:id/progress", 
  rateLimitMiddleware.general, 
  async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Verify assessment ownership
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, id),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Get detailed progress by category
    const progressByCategory = await db
      .select({
        category: questions.category_code,
        categoryName: questions.categoryName,
        totalQuestions: sql<number>`count(${questions.id})`,
        answeredQuestions: sql<number>`count(${answers.id})`,
        requiredQuestions: sql<number>`count(case when ${questions.required} then 1 end)`,
        answeredRequiredQuestions: sql<number>`count(case when ${questions.required} and ${answers.id} is not null then 1 end)`,
        avgScore: sql<number>`avg(${answers.score})`,
      })
      .from(questions)
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .leftJoin(answers, and(
        eq(answers.questionId, questions.id),
        eq(answers.assessmentId, assessment.id)
      ))
      .where(eq(clauses.stdId, assessment.stdId))
      .groupBy(questions.category_code, questions.categoryName)
      .orderBy(questions.category_code);

    res.json({
      assessmentId: assessment.id,
      overallProgress: assessment.progress,
      lastUpdated: assessment.updatedAt,
      progressByCategory: progressByCategory.map(cat => ({
        ...cat,
        completionPercentage: cat.totalQuestions ? 
          Math.round((cat.answeredQuestions / cat.totalQuestions) * 100) : 0,
        requiredCompletionPercentage: cat.requiredQuestions ?
          Math.round((cat.answeredRequiredQuestions / cat.requiredQuestions) * 100) : 100,
      }))
    });
  } catch (error) {
    console.error("Error fetching assessment progress:", error);
    res.status(500).json({ error: "Failed to fetch assessment progress" });
  }
});

// GET /api/assessments/:id/analytics - Get comprehensive analytics
router.get("/:id/analytics", 
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { intakeFormId } = req.query;

    // Verify assessment exists and user has access
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, id),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Import scoring function
    const { calculateAssessmentScore } = await import('./scoring');
    
    // Get intake-based scope if provided
    let intakeScope = null;
    if (intakeFormId && typeof intakeFormId === 'string') {
      try {
        const { IntakeProcessor } = await import('./intakeLogic');
        intakeScope = await IntakeProcessor.generateAssessmentScope(intakeFormId);
      } catch (error) {
        console.warn('Failed to get intake scope for analytics:', error);
      }
    }

    const scoringData = await calculateAssessmentScore(id, intakeScope);

    res.json({
      assessmentId: id,
      overallScore: scoringData.scorePercentage,
      complianceStatus: scoringData.complianceStatus,
      readinessLevel: scoringData.readinessLevel,
      estimatedAuditSuccess: scoringData.estimatedAuditSuccess,
      categoryScores: scoringData.categoryScores,
      criticalIssues: scoringData.criticalIssues,
      recommendations: scoringData.recommendations,
      lastCalculated: scoringData.lastCalculated,
      intakeBasedAnalytics: scoringData.intakeBasedScoring
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// GET /api/assessments/:id/findings - Get comprehensive findings and recommendations
router.get("/:id/findings", 
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { intakeFormId } = req.query;

    // Verify assessment exists and user has access
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, id),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Import required services
    const { ExecutiveSummaryService } = await import('../services/executiveSummaryService');
    const advancedScoringService = (await import('../services/advancedScoringService')).default;
    const { calculateAssessmentScore } = await import('./scoring');

    // Get intake-based scope if provided
    let intakeScope = null;
    if (intakeFormId && typeof intakeFormId === 'string') {
      try {
        const { IntakeProcessor } = await import('./intakeLogic');
        intakeScope = await IntakeProcessor.generateAssessmentScope(intakeFormId);
      } catch (error) {
        console.warn('Failed to get intake scope for findings:', error);
      }
    }

    // Get scoring data for compliance status
    const scoringData = await calculateAssessmentScore(id, intakeScope);

    // Generate executive summary (includes key findings)
    let executiveSummary;
    try {
      executiveSummary = await ExecutiveSummaryService.generateExecutiveSummary(id);
    } catch (error) {
      console.warn('Failed to generate executive summary, using fallback:', error);
      executiveSummary = {
        summary: 'Assessment findings analysis based on current compliance status and gaps.',
        keyFindings: [],
        businessImpact: 'Assessment in progress. Business impact will be calculated once more data is available.',
        recommendations: [],
        nextSteps: [],
        investmentAnalysis: {},
        timeline: ''
      };
    }

    // Generate gap analysis
    let gapAnalysis = [];
    try {
      const gapAnalysisData = await advancedScoringService.generateGapAnalysis(id);
      
      // Transform gap analysis to match frontend interface
      gapAnalysis = [
        ...gapAnalysisData.criticalGaps.map((gap: any, idx: number) => ({
          questionId: gap.questionId,
          questionText: gap.questionText,
          category: gap.category,
          currentScore: gap.currentScore,
          targetScore: gap.targetScore,
          gapSeverity: 'CRITICAL' as const,
          impact: gap.impact,
          recommendation: gap.recommendation
        })),
        ...gapAnalysisData.majorGaps.map((gap: any, idx: number) => ({
          questionId: gap.questionId,
          questionText: gap.questionText,
          category: gap.category,
          currentScore: gap.currentScore,
          targetScore: gap.targetScore,
          gapSeverity: 'MAJOR' as const,
          impact: gap.impact,
          recommendation: gap.recommendation
        })),
        ...gapAnalysisData.minorGaps.map((gap: any, idx: number) => ({
          questionId: gap.questionId,
          questionText: gap.questionText,
          category: gap.category,
          currentScore: gap.currentScore,
          targetScore: gap.targetScore,
          gapSeverity: 'MINOR' as const,
          impact: gap.impact,
          recommendation: gap.recommendation
        }))
      ];
    } catch (error) {
      console.warn('Failed to generate gap analysis:', error);
    }

    // Transform key findings from executive summary
    const keyFindings = executiveSummary.keyFindings.map((finding: string, idx: number) => {
      // Determine severity based on finding content
      let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (finding.toLowerCase().includes('critical') || finding.toLowerCase().includes('immediate')) {
        severity = 'CRITICAL';
      } else if (finding.toLowerCase().includes('high') || finding.toLowerCase().includes('significant')) {
        severity = 'HIGH';
      } else if (finding.toLowerCase().includes('minor') || finding.toLowerCase().includes('low')) {
        severity = 'LOW';
      }

      return {
        id: `finding-${idx}`,
        title: `Finding ${idx + 1}`,
        description: finding,
        severity,
        category: 'General',
        impact: 'Review required to determine specific impact',
        recommendation: executiveSummary.recommendations[idx] || undefined
      };
    });

    // Transform recommendations
    const recommendations = executiveSummary.recommendations.map((rec: string, idx: number) => {
      // Determine priority based on recommendation content
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (rec.toLowerCase().includes('critical') || rec.toLowerCase().includes('immediate') || rec.toLowerCase().includes('urgent')) {
        priority = 'HIGH';
      } else if (rec.toLowerCase().includes('minor') || rec.toLowerCase().includes('optional')) {
        priority = 'LOW';
      }

      return {
        id: `rec-${idx}`,
        title: `Recommendation ${idx + 1}`,
        description: rec,
        priority,
        category: 'General',
        estimatedEffort: '2-4 weeks',
        impact: 'Improves overall compliance readiness'
      };
    });

    // If we have scoring data recommendations, merge them
    if (scoringData.recommendations && scoringData.recommendations.length > 0) {
      scoringData.recommendations.forEach((rec: string, idx: number) => {
        if (!recommendations.find(r => r.description === rec)) {
          recommendations.push({
            id: `scoring-rec-${idx}`,
            title: `Recommendation ${recommendations.length + 1}`,
            description: rec,
            priority: rec.toLowerCase().includes('critical') ? 'HIGH' as const : 'MEDIUM' as const,
            category: 'Compliance',
            estimatedEffort: '1-3 weeks',
            impact: 'Addresses compliance gaps'
          });
        }
      });
    }

    res.json({
      summary: executiveSummary.summary,
      keyFindings,
      recommendations,
      gapAnalysis,
      complianceStatus: scoringData.complianceStatus,
      businessImpact: executiveSummary.businessImpact,
      nextSteps: executiveSummary.nextSteps,
      lastCalculated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating findings:', error);
    res.status(500).json({ error: 'Failed to generate findings' });
  }
});

export default router;