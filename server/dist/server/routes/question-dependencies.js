import { Router } from 'express';
import { QuestionDependencyService } from '../services/questionDependencyService.js';
import { AuthService } from '../services/authService.js';
import { observabilityMiddleware } from '../middleware/observabilityMiddleware.js';
const router = Router();
// Apply middleware
router.use(AuthService.authMiddleware);
router.use(observabilityMiddleware);
// Get filtered questions based on facility characteristics
router.post('/filtered-questions', async (req, res) => {
    try {
        const { filter, assessmentId } = req.body;
        if (!filter) {
            return res.status(400).json({
                success: false,
                error: 'Filter parameters are required'
            });
        }
        const filteredQuestions = await QuestionDependencyService.getFilteredQuestions(filter, assessmentId);
        res.json({
            success: true,
            questions: filteredQuestions,
            totalQuestions: filteredQuestions.length,
            visibleQuestions: filteredQuestions.filter(q => q.isVisible).length,
            requiredQuestions: filteredQuestions.filter(q => q.isRequired && q.isVisible).length
        });
    }
    catch (error) {
        console.error('Error getting filtered questions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get filtered questions'
        });
    }
});
// Get smart recommendations for an assessment
router.get('/recommendations/:assessmentId', async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const filter = req.query;
        if (!assessmentId) {
            return res.status(400).json({
                success: false,
                error: 'Assessment ID is required'
            });
        }
        const recommendations = await QuestionDependencyService.getSmartRecommendations(filter, assessmentId);
        res.json({
            success: true,
            recommendations
        });
    }
    catch (error) {
        console.error('Error getting smart recommendations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get smart recommendations'
        });
    }
});
// Update question visibility based on answer changes
router.post('/update-visibility', async (req, res) => {
    try {
        const { assessmentId, changedAnswers } = req.body;
        if (!assessmentId || !changedAnswers) {
            return res.status(400).json({
                success: false,
                error: 'Assessment ID and changed answers are required'
            });
        }
        const visibilityChanges = await QuestionDependencyService.updateQuestionVisibility(assessmentId, changedAnswers);
        res.json({
            success: true,
            changes: visibilityChanges
        });
    }
    catch (error) {
        console.error('Error updating question visibility:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update question visibility'
        });
    }
});
// Get question dependencies for a specific question
router.get('/dependencies/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        if (!questionId) {
            return res.status(400).json({
                success: false,
                error: 'Question ID is required'
            });
        }
        // This would be implemented in the service
        const dependencies = []; // QuestionDependencyService.getDependenciesForQuestion(questionId);
        res.json({
            success: true,
            dependencies,
            questionId
        });
    }
    catch (error) {
        console.error('Error getting question dependencies:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get question dependencies'
        });
    }
});
// Validate conditional logic for a set of answers
router.post('/validate-logic', async (req, res) => {
    try {
        const { answers, facilityFilter } = req.body;
        if (!answers || !facilityFilter) {
            return res.status(400).json({
                success: false,
                error: 'Answers and facility filter are required'
            });
        }
        // Validation logic would go here
        const validationResult = {
            isValid: true,
            missingRequired: [],
            conditionalErrors: []
        };
        res.json({
            success: true,
            validation: validationResult
        });
    }
    catch (error) {
        console.error('Error validating conditional logic:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate conditional logic'
        });
    }
});
export default router;
