import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { ClientPortalService } from '../services/clientPortalService';
import ObservabilityService from '../services/observabilityService';
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
// Middleware to ensure only business users can access portal
const requireBusinessUser = (req, res, next) => {
    if (req.user?.tenantType !== 'BUSINESS' || !req.user?.businessRole) {
        return res.status(403).json({
            error: 'Access denied. Client portal is only accessible to business users.'
        });
    }
    next();
};
router.use(requireBusinessUser);
// Validation schemas
const updateContactSchema = z.object({
    primaryContactName: z.string().min(1).optional(),
    primaryContactEmail: z.string().email().optional(),
    primaryContactPhone: z.string().optional()
});
/**
 * GET /api/client-portal/dashboard/:clientOrgId
 * Get client portal dashboard data
 */
router.get('/dashboard/:clientOrgId', async (req, res) => {
    try {
        const { clientOrgId } = req.params;
        const dashboardData = await ClientPortalService.getPortalDashboard(req.user.id, clientOrgId);
        res.json({
            success: true,
            dashboard: dashboardData
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'clientPortal',
            operation: 'GET /dashboard/:clientOrgId',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: { clientOrgId: req.params.clientOrgId }
        });
        res.status(error instanceof Error && error.message.includes('Access denied') ? 403 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to load dashboard'
        });
    }
});
/**
 * GET /api/client-portal/organization/:clientOrgId
 * Get client organization details
 */
router.get('/organization/:clientOrgId', async (req, res) => {
    try {
        const { clientOrgId } = req.params;
        const organization = await ClientPortalService.getClientOrganization(req.user.id, clientOrgId);
        res.json({
            success: true,
            organization
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'clientPortal',
            operation: 'GET /organization/:clientOrgId',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: { clientOrgId: req.params.clientOrgId }
        });
        res.status(error instanceof Error && error.message.includes('Access denied') ? 403 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to load organization'
        });
    }
});
/**
 * PUT /api/client-portal/organization/:clientOrgId
 * Update client organization contact information
 */
router.put('/organization/:clientOrgId', async (req, res) => {
    try {
        // Only business owners and compliance officers can update organization info
        if (!['business_owner', 'compliance_officer'].includes(req.user?.businessRole || '')) {
            return res.status(403).json({
                error: 'Insufficient permissions. Only business owners and compliance officers can update organization information.'
            });
        }
        const { clientOrgId } = req.params;
        const validatedData = updateContactSchema.parse(req.body);
        const result = await ClientPortalService.updateClientOrganization(req.user.id, clientOrgId, validatedData);
        res.json({
            success: true,
            message: 'Organization updated successfully',
            organization: result
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'clientPortal',
            operation: 'PUT /organization/:clientOrgId',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: { clientOrgId: req.params.clientOrgId }
        });
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors
            });
        }
        res.status(error instanceof Error && error.message.includes('Access denied') ? 403 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to update organization'
        });
    }
});
/**
 * GET /api/client-portal/facilities/:clientOrgId
 * Get client facilities
 */
router.get('/facilities/:clientOrgId', async (req, res) => {
    try {
        const { clientOrgId } = req.params;
        const { operatingStatus, limit = '50', offset = '0' } = req.query;
        const filters = {
            operatingStatus: operatingStatus,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
        const facilities = await ClientPortalService.getClientFacilities(req.user.id, clientOrgId, filters);
        res.json({
            success: true,
            facilities,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: facilities.length
            }
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'clientPortal',
            operation: 'GET /facilities/:clientOrgId',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: { clientOrgId: req.params.clientOrgId }
        });
        res.status(error instanceof Error && error.message.includes('Access denied') ? 403 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to load facilities'
        });
    }
});
/**
 * GET /api/client-portal/assessments/:clientOrgId
 * Get client assessments
 */
router.get('/assessments/:clientOrgId', async (req, res) => {
    try {
        const { clientOrgId } = req.params;
        const { status, facilityId, limit = '20', offset = '0' } = req.query;
        const filters = {
            status: status ? status.split(',') : undefined,
            facilityId: facilityId,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
        const assessments = await ClientPortalService.getClientAssessments(req.user.id, clientOrgId, filters);
        res.json({
            success: true,
            assessments,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: assessments.length
            }
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'clientPortal',
            operation: 'GET /assessments/:clientOrgId',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: { clientOrgId: req.params.clientOrgId }
        });
        res.status(error instanceof Error && error.message.includes('Access denied') ? 403 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to load assessments'
        });
    }
});
/**
 * GET /api/client-portal/assessments/:clientOrgId/:assessmentId
 * Get detailed assessment data
 */
router.get('/assessments/:clientOrgId/:assessmentId', async (req, res) => {
    try {
        const { clientOrgId, assessmentId } = req.params;
        const assessmentDetails = await ClientPortalService.getClientAssessmentDetails(req.user.id, assessmentId, clientOrgId);
        res.json({
            success: true,
            ...assessmentDetails
        });
    }
    catch (error) {
        await ObservabilityService.logError(error, {
            service: 'clientPortal',
            operation: 'GET /assessments/:clientOrgId/:assessmentId',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium',
            metadata: {
                clientOrgId: req.params.clientOrgId,
                assessmentId: req.params.assessmentId
            }
        });
        res.status(error instanceof Error && error.message.includes('Access denied') ? 403 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to load assessment details'
        });
    }
});
export default router;
