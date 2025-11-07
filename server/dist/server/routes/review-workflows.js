import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { ReviewWorkflowService } from '../services/reviewWorkflowService';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import ObservabilityService from '../services/observabilityService';
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
// Validation schemas
const createWorkflowSchema = z.object({
    assessmentId: z.string().min(1, 'Assessment ID is required'),
    clientOrganizationId: z.string().min(1, 'Client organization ID is required'),
    assignedTo: z.string().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    dueDate: z.string().datetime().optional(),
    comments: z.string().optional()
});
const assignReviewerSchema = z.object({
    assignedTo: z.string().min(1, 'Reviewer ID is required'),
    dueDate: z.string().datetime().optional(),
    comments: z.string().optional()
});
const completeReviewSchema = z.object({
    decision: z.enum(['APPROVED', 'REJECTED', 'REVISION_REQUESTED']),
    reason: z.string().min(1, 'Decision reason is required'),
    comments: z.string().optional(),
    notes: z.string().optional()
});
const createInvitationSchema = z.object({
    clientOrganizationId: z.string().min(1, 'Client organization ID is required'),
    invitedEmail: z.string().email('Valid email is required'),
    invitedRole: z.enum(['business_owner', 'facility_manager', 'compliance_officer', 'team_member', 'viewer']),
    customMessage: z.string().optional(),
    permissions: z.record(z.any()).optional(),
    expiryHours: z.number().min(1).max(168).default(72) // 1 hour to 1 week
});
/**
 * POST /api/review-workflows
 * Create a new review workflow
 */
router.post('/', rateLimitMiddleware.general, async (req, res) => {
    try {
        // Only consultant owners and lead consultants can create workflows
        if (!['consultant_owner', 'lead_consultant'].includes(req.user?.consultantRole || '')) {
            return res.status(403).json({
                error: 'Insufficient permissions. Only consultant owners and lead consultants can create review workflows.'
            });
        }
        const validatedData = createWorkflowSchema.parse(req.body);
        const workflow = await ReviewWorkflowService.createReviewWorkflow(validatedData.assessmentId, validatedData.clientOrganizationId, req.user.tenantId, req.user.id, {
            assignedTo: validatedData.assignedTo,
            priority: validatedData.priority,
            dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
            comments: validatedData.comments
        });
        res.status(201).json({
            success: true,
            workflow
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'POST /review-workflows',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors
            });
        }
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to create review workflow'
        });
    }
});
/**
 * GET /api/review-workflows
 * Get review workflows for consultant
 */
router.get('/', async (req, res) => {
    try {
        // Only consultant users can access workflows
        if (req.user?.tenantType !== 'CONSULTANT') {
            return res.status(403).json({
                error: 'Access denied. Only consultant users can view review workflows.'
            });
        }
        const { status, assignedTo, clientOrganizationId, limit = '50', offset = '0' } = req.query;
        const filters = {
            status: status ? status.split(',') : undefined,
            assignedTo: assignedTo,
            clientOrganizationId: clientOrganizationId,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
        const workflows = await ReviewWorkflowService.getConsultantWorkflows(req.user.tenantId, filters);
        res.json({
            success: true,
            workflows,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: workflows.length
            }
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'GET /review-workflows',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to retrieve workflows'
        });
    }
});
/**
 * GET /api/review-workflows/assigned
 * Get workflows assigned to current user
 */
router.get('/assigned', async (req, res) => {
    try {
        const { status, limit = '20', offset = '0' } = req.query;
        const filters = {
            status: status ? status.split(',') : undefined,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
        const workflows = await ReviewWorkflowService.getReviewerWorkflows(req.user.id, req.user.tenantId, filters);
        res.json({
            success: true,
            workflows,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: workflows.length
            }
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'GET /review-workflows/assigned',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to retrieve assigned workflows'
        });
    }
});
/**
 * PUT /api/review-workflows/:id/assign
 * Assign workflow to reviewer
 */
router.put('/:id/assign', rateLimitMiddleware.general, async (req, res) => {
    try {
        // Only consultant owners and lead consultants can assign reviewers
        if (!['consultant_owner', 'lead_consultant'].includes(req.user?.consultantRole || '')) {
            return res.status(403).json({
                error: 'Insufficient permissions. Only consultant owners and lead consultants can assign reviewers.'
            });
        }
        const { id: workflowId } = req.params;
        const validatedData = assignReviewerSchema.parse(req.body);
        await ReviewWorkflowService.assignReviewer(workflowId, req.user.id, validatedData.assignedTo, validatedData.dueDate ? new Date(validatedData.dueDate) : undefined, validatedData.comments);
        res.json({
            success: true,
            message: 'Reviewer assigned successfully'
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'PUT /review-workflows/:id/assign',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: { workflowId: req.params.id }
        });
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors
            });
        }
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to assign reviewer'
        });
    }
});
/**
 * PUT /api/review-workflows/:id/start
 * Start review process
 */
router.put('/:id/start', rateLimitMiddleware.general, async (req, res) => {
    try {
        const { id: workflowId } = req.params;
        const { comments } = req.body;
        await ReviewWorkflowService.startReview(workflowId, req.user.id, comments);
        res.json({
            success: true,
            message: 'Review started successfully'
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'PUT /review-workflows/:id/start',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: { workflowId: req.params.id }
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to start review'
        });
    }
});
/**
 * PUT /api/review-workflows/:id/complete
 * Complete review with decision
 */
router.put('/:id/complete', rateLimitMiddleware.general, async (req, res) => {
    try {
        const { id: workflowId } = req.params;
        const validatedData = completeReviewSchema.parse(req.body);
        await ReviewWorkflowService.completeReview(workflowId, req.user.id, validatedData.decision, validatedData.reason, validatedData.comments, validatedData.notes);
        res.json({
            success: true,
            message: 'Review completed successfully',
            decision: validatedData.decision
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'PUT /review-workflows/:id/complete',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'high',
            metadata: { workflowId: req.params.id, decision: req.body.decision }
        });
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors
            });
        }
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to complete review'
        });
    }
});
/**
 * GET /api/review-workflows/:id/decisions
 * Get immutable decision log for workflow
 */
router.get('/:id/decisions', async (req, res) => {
    try {
        const { id: workflowId } = req.params;
        const decisionLog = await ReviewWorkflowService.getDecisionLog(workflowId, req.user.tenantId);
        res.json({
            success: true,
            ...decisionLog
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'GET /review-workflows/:id/decisions',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: { workflowId: req.params.id }
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to retrieve decision log'
        });
    }
});
/**
 * POST /api/review-workflows/invitations
 * Create client invitation
 */
router.post('/invitations', rateLimitMiddleware.general, async (req, res) => {
    try {
        // Only consultant owners and lead consultants can invite clients
        if (!['consultant_owner', 'lead_consultant'].includes(req.user?.consultantRole || '')) {
            return res.status(403).json({
                error: 'Insufficient permissions. Only consultant owners and lead consultants can invite clients.'
            });
        }
        const validatedData = createInvitationSchema.parse(req.body);
        const result = await ReviewWorkflowService.createClientInvitation(validatedData.clientOrganizationId, req.user.tenantId, req.user.id, validatedData.invitedEmail, validatedData.invitedRole, {
            customMessage: validatedData.customMessage,
            permissions: validatedData.permissions,
            expiryHours: validatedData.expiryHours
        });
        res.status(201).json({
            success: true,
            invitation: result.invitation,
            // In production, send this via email instead of returning in response
            invitationLink: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/accept-invitation?token=${result.invitationToken}`
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'POST /review-workflows/invitations',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors
            });
        }
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to create invitation'
        });
    }
});
/**
 * GET /api/review-workflows/invitations
 * Get client invitations for consultant
 */
router.get('/invitations', async (req, res) => {
    try {
        // Only consultant users can view invitations
        if (req.user?.tenantType !== 'CONSULTANT') {
            return res.status(403).json({
                error: 'Access denied. Only consultant users can view invitations.'
            });
        }
        const { clientOrganizationId, status, limit = '50', offset = '0' } = req.query;
        const filters = {
            clientOrganizationId: clientOrganizationId,
            status: status,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
        const invitations = await ReviewWorkflowService.getClientInvitations(req.user.tenantId, filters);
        res.json({
            success: true,
            invitations,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: invitations.length
            }
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'reviewWorkflow',
            operation: 'GET /review-workflows/invitations',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to retrieve invitations'
        });
    }
});
export default router;
