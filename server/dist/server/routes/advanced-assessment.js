import { Router } from 'express';
import { AuthService } from '../services/authService.js';
import { assessmentManagementService } from '../services/assessmentManagementService.js';
import { advancedScoringService } from '../services/advancedScoringService.js';
const router = Router();
// Advanced question filtering
router.post('/questions/filter', AuthService.authMiddleware, async (req, res) => {
    try {
        const filter = req.body;
        const questions = await assessmentManagementService.filterQuestions(filter);
        res.json({ questions });
    }
    catch (error) {
        res.status(500).json({ error: 'Question filtering failed' });
    }
});
// Corrective action management
router.post('/corrective-actions', AuthService.authMiddleware, async (req, res) => {
    try {
        const action = await assessmentManagementService.createCorrectiveAction(req.body);
        res.json({ action });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create corrective action' });
    }
});
router.get('/corrective-actions/:assessmentId', AuthService.authMiddleware, async (req, res) => {
    try {
        const actions = await assessmentManagementService.trackCorrectiveActions(req.params.assessmentId);
        res.json({ actions });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve corrective actions' });
    }
});
// Milestone tracking
router.post('/milestones', AuthService.authMiddleware, async (req, res) => {
    try {
        const milestone = await assessmentManagementService.createMilestone(req.body);
        res.json({ milestone });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create milestone' });
    }
});
router.get('/progress/:assessmentId', AuthService.authMiddleware, async (req, res) => {
    try {
        const progress = await assessmentManagementService.trackProgress(req.params.assessmentId);
        res.json(progress);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve progress' });
    }
});
// Assessment templates
router.post('/templates', AuthService.authMiddleware, async (req, res) => {
    try {
        const template = await assessmentManagementService.createAssessmentTemplate(req.body);
        res.json({ template });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create template' });
    }
});
// Advanced scoring
router.post('/scoring/advanced', AuthService.authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.body;
        const scoring = await advancedScoringService.calculateScore(assessmentId);
        res.json({ score: scoring });
    }
    catch (error) {
        res.status(500).json({ error: 'Advanced scoring failed' });
    }
});
// Gap analysis
router.post('/analysis/gaps', AuthService.authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.body;
        const gapAnalysis = await advancedScoringService.generateGapAnalysis(assessmentId);
        res.json({ gapAnalysis });
    }
    catch (error) {
        res.status(500).json({ error: 'Gap analysis failed' });
    }
});
// Compliance metrics
router.post('/metrics/compliance', AuthService.authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.body;
        const metrics = await advancedScoringService.getComplianceMetrics(assessmentId);
        res.json({ metrics });
    }
    catch (error) {
        res.status(500).json({ error: 'Compliance metrics generation failed' });
    }
});
// Predictive insights
router.post('/insights/predictive', AuthService.authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.body;
        const insights = await advancedScoringService.generatePredictiveInsights(assessmentId);
        res.json({ insights });
    }
    catch (error) {
        res.status(500).json({ error: 'Predictive insights generation failed' });
    }
});
export default router;
