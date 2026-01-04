import { Router } from "express";
import { AuthService } from "../services/authService";
const router = Router();
// Middleware - require authentication for all feature flag routes
router.use(AuthService.authMiddleware);
// Default feature flags configuration
const DEFAULT_FLAGS = {
    multiTenantWorkflows: false,
    enhancedRBAC: false,
    advancedAnalytics: false,
    intakeToAssessmentFlow: true,
    facilityMultiSelect: false,
    consultantDashboard: false,
    auditTrail: true,
    dataBackup: false,
};
// GET /api/feature-flags - Get feature flags for current tenant
router.get('/', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userRole = req.user.businessRole || req.user.consultantRole;
        // For now, return default flags
        // In the future, this could be customized per tenant or user role
        const flags = { ...DEFAULT_FLAGS };
        // Enable specific flags based on tenant type or user role
        if (userRole === 'business_owner' || userRole === 'consultant_owner') {
            flags.enhancedRBAC = true;
            flags.auditTrail = true;
        }
        if (userRole?.includes('consultant')) {
            flags.consultantDashboard = true;
        }
        res.json({
            success: true,
            flags,
            tenantId,
            userRole
        });
    }
    catch (error) {
        console.error('Error fetching feature flags:', error);
        res.status(500).json({
            error: 'Failed to fetch feature flags',
            flags: DEFAULT_FLAGS
        });
    }
});
export default router;
