// Feature flag API routes
import { Router } from 'express';
import { FlagAdminAPI, flagsMiddleware } from '../lib/flags.js';
const router = Router();
// Apply flags middleware to all routes
router.use(flagsMiddleware);
// Get current user's feature flags
router.get('/', async (req, res) => {
    try {
        const flags = await req.flags.getFlags();
        res.json(flags);
    }
    catch (error) {
        console.error('Error getting feature flags:', error);
        res.status(500).json({ error: 'Failed to get feature flags' });
    }
});
// Admin endpoints for flag management
router.get('/admin/flags', async (req, res) => {
    try {
        const flags = await FlagAdminAPI.getGlobalFlags();
        res.json(flags);
    }
    catch (error) {
        console.error('Error getting global flags:', error);
        res.status(500).json({ error: 'Failed to get global flags' });
    }
});
router.post('/admin/flags', async (req, res) => {
    try {
        const { flag, value } = req.body;
        if (!flag || typeof value !== 'boolean') {
            return res.status(400).json({ error: 'Flag and value are required' });
        }
        await FlagAdminAPI.setGlobalFlag(flag, value);
        res.json({ success: true, flag, value });
    }
    catch (error) {
        console.error('Error setting global flag:', error);
        res.status(500).json({ error: 'Failed to set global flag' });
    }
});
// Tenant-specific flag management
router.get('/admin/tenants/:tenantId/flags', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const flags = await FlagAdminAPI.getTenantFlags(tenantId);
        res.json(flags);
    }
    catch (error) {
        console.error('Error getting tenant flags:', error);
        res.status(500).json({ error: 'Failed to get tenant flags' });
    }
});
router.post('/admin/tenants/:tenantId/flags', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { flag, value } = req.body;
        if (!flag || typeof value !== 'boolean') {
            return res.status(400).json({ error: 'Flag and value are required' });
        }
        await FlagAdminAPI.setTenantFlag(tenantId, flag, value);
        res.json({ success: true, flag, value, tenantId });
    }
    catch (error) {
        console.error('Error setting tenant flag:', error);
        res.status(500).json({ error: 'Failed to set tenant flag' });
    }
});
// Bulk operations for rollouts
router.post('/admin/rollout', async (req, res) => {
    try {
        const { type, flags, tenantIds, percentage } = req.body;
        switch (type) {
            case 'internal':
                await FlagAdminAPI.enableForInternalTenants(flags, tenantIds);
                break;
            case 'percentage':
                if (!percentage || flags.length !== 1) {
                    return res.status(400).json({ error: 'Percentage rollout requires single flag and percentage' });
                }
                await FlagAdminAPI.enableForPercentage(flags[0], percentage, tenantIds);
                break;
            default:
                return res.status(400).json({ error: 'Unknown rollout type' });
        }
        res.json({ success: true, type, flags, affected: tenantIds.length });
    }
    catch (error) {
        console.error('Error during rollout:', error);
        res.status(500).json({ error: 'Failed to execute rollout' });
    }
});
// Health check endpoint for feature flag service
router.get('/health', async (req, res) => {
    try {
        // Test that we can retrieve flags
        const flags = await FlagAdminAPI.getGlobalFlags();
        res.json({
            status: 'healthy',
            flagCount: Object.keys(flags).length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Feature flag health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: 'Flag service unavailable',
            timestamp: new Date().toISOString()
        });
    }
});
export default router;
