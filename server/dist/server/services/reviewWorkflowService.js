import { db } from '../db.js';
import { reviewWorkflows, decisionLog, clientInvitations, assessments, clientOrganizations, users } from '../../shared/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import ObservabilityService from './observabilityService.js';
import crypto from 'crypto';
/**
 * Review Workflow Service
 * Handles consultant-client review workflows: assign → review → approve/reject
 */
export class ReviewWorkflowService {
    /**
     * Create a new review workflow for an assessment
     */
    static async createReviewWorkflow(assessmentId, clientOrganizationId, consultantTenantId, assignedBy, options = {}) {
        try {
            const workflowData = {
                assessmentId,
                clientOrganizationId,
                consultantTenantId,
                assignedBy,
                assignedTo: options.assignedTo,
                assignedAt: options.assignedTo ? new Date() : undefined,
                status: options.assignedTo ? 'ASSIGNED' : 'PENDING_ASSIGNMENT',
                priority: options.priority || 'NORMAL',
                dueDate: options.dueDate,
                reviewComments: options.comments
            };
            const [workflow] = await db.insert(reviewWorkflows).values(workflowData).returning();
            // Log the initial decision
            await this.logDecision(workflow.id, assignedBy, 'ASSIGNMENT', undefined, workflow.status, options.comments || 'Review workflow created', {
                assessmentId,
                clientOrganizationId,
                priority: options.priority,
                assignedTo: options.assignedTo
            });
            // Update assessment status
            await db
                .update(assessments)
                .set({ status: 'UNDER_REVIEW', updatedAt: new Date() })
                .where(eq(assessments.id, assessmentId));
            await ObservabilityService.log('INFO', 'Review workflow created', {
                service: 'reviewWorkflow',
                operation: 'createReviewWorkflow',
                userId: assignedBy,
                tenantId: consultantTenantId,
                metadata: {
                    workflowId: workflow.id,
                    assessmentId,
                    clientOrganizationId,
                    assignedTo: options.assignedTo
                }
            });
            return workflow;
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'createReviewWorkflow',
                userId: assignedBy,
                tenantId: consultantTenantId,
                severity: 'high',
                metadata: { assessmentId, clientOrganizationId }
            });
            throw error;
        }
    }
    /**
     * Assign workflow to a reviewer
     */
    static async assignReviewer(workflowId, assignedBy, assignedTo, dueDate, comments) {
        try {
            const [workflow] = await db
                .select()
                .from(reviewWorkflows)
                .where(eq(reviewWorkflows.id, workflowId));
            if (!workflow) {
                throw new Error(`Review workflow not found: ${workflowId}`);
            }
            const previousStatus = workflow.status;
            await db
                .update(reviewWorkflows)
                .set({
                assignedTo,
                assignedAt: new Date(),
                status: 'ASSIGNED',
                dueDate,
                reviewComments: comments,
                updatedAt: new Date()
            })
                .where(eq(reviewWorkflows.id, workflowId));
            // Log the assignment decision
            await this.logDecision(workflowId, assignedBy, 'ASSIGNMENT', previousStatus, 'ASSIGNED', comments || `Assigned to reviewer`, {
                assignedTo,
                dueDate: dueDate?.toISOString(),
                previousAssignee: workflow.assignedTo
            });
            await ObservabilityService.log('INFO', 'Review workflow assigned', {
                service: 'reviewWorkflow',
                operation: 'assignReviewer',
                userId: assignedBy,
                tenantId: workflow.consultantTenantId,
                metadata: {
                    workflowId,
                    assignedTo,
                    dueDate: dueDate?.toISOString()
                }
            });
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'assignReviewer',
                userId: assignedBy,
                severity: 'high',
                metadata: { workflowId, assignedTo }
            });
            throw error;
        }
    }
    /**
     * Start review process
     */
    static async startReview(workflowId, reviewerId, comments) {
        try {
            const [workflow] = await db
                .select()
                .from(reviewWorkflows)
                .where(eq(reviewWorkflows.id, workflowId));
            if (!workflow) {
                throw new Error(`Review workflow not found: ${workflowId}`);
            }
            if (workflow.assignedTo !== reviewerId) {
                throw new Error('Not authorized to start this review');
            }
            const previousStatus = workflow.status;
            await db
                .update(reviewWorkflows)
                .set({
                status: 'IN_REVIEW',
                reviewStartedAt: new Date(),
                reviewComments: comments,
                updatedAt: new Date()
            })
                .where(eq(reviewWorkflows.id, workflowId));
            // Log the review start
            await this.logDecision(workflowId, reviewerId, 'REVIEW_START', previousStatus, 'IN_REVIEW', comments || 'Review started', {
                reviewStartedAt: new Date().toISOString()
            });
            await ObservabilityService.log('INFO', 'Review started', {
                service: 'reviewWorkflow',
                operation: 'startReview',
                userId: reviewerId,
                tenantId: workflow.consultantTenantId,
                metadata: { workflowId }
            });
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'startReview',
                userId: reviewerId,
                severity: 'medium',
                metadata: { workflowId }
            });
            throw error;
        }
    }
    /**
     * Complete review with decision (approve/reject/revision)
     */
    static async completeReview(workflowId, reviewerId, decision, reason, comments, notes) {
        try {
            const [workflow] = await db
                .select()
                .from(reviewWorkflows)
                .where(eq(reviewWorkflows.id, workflowId));
            if (!workflow) {
                throw new Error(`Review workflow not found: ${workflowId}`);
            }
            if (workflow.assignedTo !== reviewerId) {
                throw new Error('Not authorized to complete this review');
            }
            if (workflow.status !== 'IN_REVIEW') {
                throw new Error('Review is not in progress');
            }
            const previousStatus = workflow.status;
            const newStatus = decision.toLowerCase().replace('_', '_');
            await db
                .update(reviewWorkflows)
                .set({
                status: newStatus.toUpperCase(),
                reviewCompletedAt: new Date(),
                finalDecision: decision,
                decisionReason: reason,
                decisionNotes: notes,
                reviewComments: comments,
                updatedAt: new Date()
            })
                .where(eq(reviewWorkflows.id, workflowId));
            // Update assessment status based on decision
            let assessmentStatus = 'UNDER_REVIEW';
            if (decision === 'APPROVED') {
                assessmentStatus = 'COMPLETED';
            }
            else if (decision === 'REJECTED') {
                assessmentStatus = 'ARCHIVED';
            }
            await db
                .update(assessments)
                .set({ status: assessmentStatus, updatedAt: new Date() })
                .where(eq(assessments.id, workflow.assessmentId));
            // Log the completion decision
            await this.logDecision(workflowId, reviewerId, decision.replace('_REQUESTED', '_REQUEST'), previousStatus, newStatus.toUpperCase(), reason, {
                finalDecision: decision,
                decisionNotes: notes,
                assessmentStatus,
                reviewCompletedAt: new Date().toISOString()
            });
            await ObservabilityService.log('INFO', 'Review completed', {
                service: 'reviewWorkflow',
                operation: 'completeReview',
                userId: reviewerId,
                tenantId: workflow.consultantTenantId,
                metadata: {
                    workflowId,
                    decision,
                    reason,
                    assessmentStatus
                }
            });
            // Log security audit for compliance
            await ObservabilityService.log('INFO', `Review ${decision.toLowerCase()} decision made`, {
                service: 'reviewWorkflow',
                operation: 'reviewDecision',
                userId: reviewerId,
                tenantId: workflow.consultantTenantId,
                metadata: {
                    workflowId,
                    assessmentId: workflow.assessmentId,
                    clientOrganizationId: workflow.clientOrganizationId,
                    decision,
                    reason,
                    severity: 'high',
                    auditType: 'REVIEW_DECISION'
                }
            });
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'completeReview',
                userId: reviewerId,
                severity: 'high',
                metadata: { workflowId, decision }
            });
            throw error;
        }
    }
    /**
     * Log immutable decision to decision log
     */
    static async logDecision(reviewWorkflowId, decisionBy, decisionType, previousStatus, newStatus, reason, metadata = {}, auditContext = {}) {
        try {
            const decisionEntry = {
                reviewWorkflowId,
                decisionType,
                decisionBy,
                previousStatus,
                newStatus,
                reason,
                comments: reason,
                metadata,
                ipAddress: auditContext.ipAddress,
                userAgent: auditContext.userAgent,
                sessionId: auditContext.sessionId
            };
            await db.insert(decisionLog).values(decisionEntry);
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'logDecision',
                userId: decisionBy,
                severity: 'critical',
                metadata: {
                    reviewWorkflowId,
                    decisionType,
                    error: 'Failed to log immutable decision'
                }
            });
            // Don't throw here - decision logging failure shouldn't break the workflow
        }
    }
    /**
     * Get review workflows for consultant
     */
    static async getConsultantWorkflows(consultantTenantId, filters = {}) {
        try {
            const { status, assignedTo, clientOrganizationId, limit = 50, offset = 0 } = filters;
            const whereConditions = [eq(reviewWorkflows.consultantTenantId, consultantTenantId)];
            if (status && status.length > 0) {
                whereConditions.push(inArray(reviewWorkflows.status, status));
            }
            if (assignedTo) {
                whereConditions.push(eq(reviewWorkflows.assignedTo, assignedTo));
            }
            if (clientOrganizationId) {
                whereConditions.push(eq(reviewWorkflows.clientOrganizationId, clientOrganizationId));
            }
            const workflows = await db
                .select({
                workflow: reviewWorkflows,
                assessment: {
                    id: assessments.id,
                    title: assessments.title,
                    status: assessments.status,
                    createdAt: assessments.createdAt
                },
                clientOrg: {
                    id: clientOrganizations.id,
                    legalName: clientOrganizations.legalName,
                    primaryContactName: clientOrganizations.primaryContactName,
                    primaryContactEmail: clientOrganizations.primaryContactEmail
                },
                assignedToUser: {
                    id: users.id,
                    name: users.name,
                    email: users.email
                }
            })
                .from(reviewWorkflows)
                .leftJoin(assessments, eq(reviewWorkflows.assessmentId, assessments.id))
                .leftJoin(clientOrganizations, eq(reviewWorkflows.clientOrganizationId, clientOrganizations.id))
                .leftJoin(users, eq(reviewWorkflows.assignedTo, users.id))
                .where(and(...whereConditions))
                .orderBy(desc(reviewWorkflows.createdAt))
                .limit(limit)
                .offset(offset);
            return workflows;
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'getConsultantWorkflows',
                tenantId: consultantTenantId,
                severity: 'medium',
                metadata: filters
            });
            throw error;
        }
    }
    /**
     * Get workflows assigned to specific reviewer
     */
    static async getReviewerWorkflows(reviewerId, consultantTenantId, filters = {}) {
        try {
            const { status, limit = 20, offset = 0 } = filters;
            const whereConditions = [
                eq(reviewWorkflows.assignedTo, reviewerId),
                eq(reviewWorkflows.consultantTenantId, consultantTenantId),
                eq(reviewWorkflows.isActive, true)
            ];
            if (status && status.length > 0) {
                whereConditions.push(inArray(reviewWorkflows.status, status));
            }
            const workflows = await db
                .select({
                workflow: reviewWorkflows,
                assessment: {
                    id: assessments.id,
                    title: assessments.title,
                    status: assessments.status,
                    createdAt: assessments.createdAt
                },
                clientOrg: {
                    id: clientOrganizations.id,
                    legalName: clientOrganizations.legalName,
                    primaryContactName: clientOrganizations.primaryContactName
                }
            })
                .from(reviewWorkflows)
                .leftJoin(assessments, eq(reviewWorkflows.assessmentId, assessments.id))
                .leftJoin(clientOrganizations, eq(reviewWorkflows.clientOrganizationId, clientOrganizations.id))
                .where(and(...whereConditions))
                .orderBy(desc(reviewWorkflows.dueDate), desc(reviewWorkflows.createdAt))
                .limit(limit)
                .offset(offset);
            return workflows;
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'getReviewerWorkflows',
                userId: reviewerId,
                tenantId: consultantTenantId,
                severity: 'medium',
                metadata: filters
            });
            throw error;
        }
    }
    /**
     * Get decision log for workflow (immutable audit trail)
     */
    static async getDecisionLog(workflowId, consultantTenantId) {
        try {
            // Verify access to workflow
            const [workflow] = await db
                .select()
                .from(reviewWorkflows)
                .where(and(eq(reviewWorkflows.id, workflowId), eq(reviewWorkflows.consultantTenantId, consultantTenantId)));
            if (!workflow) {
                throw new Error('Workflow not found or access denied');
            }
            const decisions = await db
                .select({
                decision: decisionLog,
                user: {
                    id: users.id,
                    name: users.name,
                    email: users.email
                }
            })
                .from(decisionLog)
                .leftJoin(users, eq(decisionLog.decisionBy, users.id))
                .where(eq(decisionLog.reviewWorkflowId, workflowId))
                .orderBy(decisionLog.decisionAt);
            return {
                workflow,
                decisions
            };
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'getDecisionLog',
                tenantId: consultantTenantId,
                severity: 'medium',
                metadata: { workflowId }
            });
            throw error;
        }
    }
    /**
     * Create client invitation
     */
    static async createClientInvitation(clientOrganizationId, consultantTenantId, invitedBy, invitedEmail, invitedRole, options = {}) {
        try {
            const { customMessage, permissions = {}, expiryHours = 72 } = options;
            // Generate secure invitation token
            const invitationToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
            const invitationData = {
                clientOrganizationId,
                consultantTenantId,
                invitedBy,
                invitedEmail,
                invitedRole,
                invitationToken,
                expiresAt,
                customMessage,
                permissions
            };
            const [invitation] = await db.insert(clientInvitations).values(invitationData).returning();
            await ObservabilityService.log('INFO', 'Client invitation created', {
                service: 'reviewWorkflow',
                operation: 'createClientInvitation',
                userId: invitedBy,
                tenantId: consultantTenantId,
                metadata: {
                    invitationId: invitation.id,
                    clientOrganizationId,
                    invitedEmail,
                    invitedRole,
                    expiresAt: expiresAt.toISOString()
                }
            });
            // Don't return the actual token in logs
            return {
                invitation: { ...invitation, invitationToken: undefined },
                invitationToken
            };
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'createClientInvitation',
                userId: invitedBy,
                tenantId: consultantTenantId,
                severity: 'medium',
                metadata: { clientOrganizationId, invitedEmail }
            });
            throw error;
        }
    }
    /**
     * Get client invitations for consultant
     */
    static async getClientInvitations(consultantTenantId, filters = {}) {
        try {
            const { clientOrganizationId, status, limit = 50, offset = 0 } = filters;
            const whereConditions = [eq(clientInvitations.consultantTenantId, consultantTenantId)];
            if (clientOrganizationId) {
                whereConditions.push(eq(clientInvitations.clientOrganizationId, clientOrganizationId));
            }
            if (status) {
                whereConditions.push(eq(clientInvitations.status, status));
            }
            const invitations = await db
                .select({
                invitation: clientInvitations,
                clientOrg: {
                    id: clientOrganizations.id,
                    legalName: clientOrganizations.legalName,
                    primaryContactName: clientOrganizations.primaryContactName
                },
                invitedByUser: {
                    id: users.id,
                    name: users.name,
                    email: users.email
                }
            })
                .from(clientInvitations)
                .leftJoin(clientOrganizations, eq(clientInvitations.clientOrganizationId, clientOrganizations.id))
                .leftJoin(users, eq(clientInvitations.invitedBy, users.id))
                .where(and(...whereConditions))
                .orderBy(desc(clientInvitations.createdAt))
                .limit(limit)
                .offset(offset);
            // Remove sensitive token data
            return invitations.map(item => ({
                ...item,
                invitation: {
                    ...item.invitation,
                    invitationToken: undefined
                }
            }));
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'reviewWorkflow',
                operation: 'getClientInvitations',
                tenantId: consultantTenantId,
                severity: 'medium',
                metadata: filters
            });
            throw error;
        }
    }
}
