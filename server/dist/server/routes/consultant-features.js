import { Router } from 'express';
import { ConsultantFeaturesService } from '../services/consultantFeaturesService.js';
import { AuthService } from '../services/authService.js';
import { observabilityMiddleware } from '../middleware/observabilityMiddleware.js';
const router = Router();
// Apply middleware
router.use(AuthService.authMiddleware);
router.use(observabilityMiddleware);
// Get consultant dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const dashboard = await ConsultantFeaturesService.getConsultantDashboard(userId);
        res.json({
            success: true,
            ...dashboard
        });
    }
    catch (error) {
        console.error('Error getting consultant dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get consultant dashboard'
        });
    }
});
// Get client portfolio
router.get('/portfolio', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { clientId } = req.query;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const portfolio = await ConsultantFeaturesService.getClientPortfolio(userId, clientId);
        res.json({
            success: true,
            portfolio,
            totalClients: portfolio.length
        });
    }
    catch (error) {
        console.error('Error getting client portfolio:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get client portfolio'
        });
    }
});
// Generate white-label report
router.post('/reports/white-label', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { assessmentId, branding } = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!assessmentId || !branding) {
            return res.status(400).json({
                success: false,
                error: 'Assessment ID and branding options are required'
            });
        }
        const report = await ConsultantFeaturesService.generateWhiteLabelReport(userId, assessmentId, branding);
        res.json({
            success: true,
            reportId: report.reportId,
            downloadUrl: report.downloadUrl,
            previewUrl: report.previewUrl
        });
    }
    catch (error) {
        console.error('Error generating white-label report:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate white-label report'
        });
    }
});
// Get advanced analytics
router.get('/analytics', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { startDate, endDate } = req.query;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const timeRange = {
            startDate: startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
            endDate: endDate ? new Date(endDate) : new Date()
        };
        const analytics = await ConsultantFeaturesService.getAdvancedAnalytics(userId, timeRange);
        res.json({
            success: true,
            ...analytics,
            timeRange
        });
    }
    catch (error) {
        console.error('Error getting advanced analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get advanced analytics'
        });
    }
});
// Add client to portfolio
router.post('/clients', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { clientTenantId, relationshipType } = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!clientTenantId) {
            return res.status(400).json({
                success: false,
                error: 'Client tenant ID is required'
            });
        }
        await ConsultantFeaturesService.addClient(userId, clientTenantId, relationshipType);
        res.json({
            success: true,
            message: 'Client added to portfolio successfully'
        });
    }
    catch (error) {
        console.error('Error adding client:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add client'
        });
    }
});
// Get advanced consultant analytics
router.get('/analytics/advanced', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { startDate, endDate } = req.query;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const timeRange = {
            startDate: startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            endDate: endDate ? new Date(endDate) : new Date()
        };
        const analytics = await ConsultantFeaturesService.getAdvancedConsultantAnalytics(userId, timeRange);
        res.json({
            success: true,
            ...analytics,
            timeRange
        });
    }
    catch (error) {
        console.error('Error getting advanced analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get advanced analytics'
        });
    }
});
// Get white-label branding options
router.get('/branding/options', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const options = await ConsultantFeaturesService.getWhiteLabelOptions(userId);
        res.json({
            success: true,
            ...options
        });
    }
    catch (error) {
        console.error('Error getting white-label options:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get white-label options'
        });
    }
});
// Update white-label branding
router.post('/branding/update', async (req, res) => {
    try {
        const userId = req.user?.id;
        const brandingSettings = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const result = await ConsultantFeaturesService.updateWhiteLabelBranding(userId, brandingSettings);
        res.json({
            success: true,
            branding: result
        });
    }
    catch (error) {
        console.error('Error updating white-label branding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update white-label branding'
        });
    }
});
// Get branding templates
router.get('/branding/templates', async (req, res) => {
    try {
        const templates = [
            {
                id: 'professional_blue',
                name: 'Professional Blue',
                primaryColor: '#1e40af',
                secondaryColor: '#3b82f6',
                description: 'Clean, professional design with blue accents',
                preview: '/images/templates/professional_blue.png'
            },
            {
                id: 'corporate_green',
                name: 'Corporate Green',
                primaryColor: '#059669',
                secondaryColor: '#10b981',
                description: 'Environmental-focused design with green theme',
                preview: '/images/templates/corporate_green.png'
            },
            {
                id: 'modern_purple',
                name: 'Modern Purple',
                primaryColor: '#7c3aed',
                secondaryColor: '#8b5cf6',
                description: 'Modern, innovative design with purple accents',
                preview: '/images/templates/modern_purple.png'
            }
        ];
        res.json({
            success: true,
            templates
        });
    }
    catch (error) {
        console.error('Error getting branding templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get branding templates'
        });
    }
});
export default router;
