
import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/authService";
import { ConditionalQuestionService } from "../services/conditionalQuestionService";
import { SmartPrePopulationService } from "../services/smartPrePopulationService";
import type { AuthenticatedRequest } from "../services/authService";

const router = Router();

// All routes require authentication
router.use(AuthService.authMiddleware);

// GET /api/smart-intake/conditional-rules/:intakeFormId - Get conditional question rules
router.get("/conditional-rules/:intakeFormId", async (req: AuthenticatedRequest, res) => {
  try {
    const { intakeFormId } = req.params;
    
    const conditionalRules = await ConditionalQuestionService.evaluateConditionalRules(intakeFormId);
    
    res.json({
      success: true,
      rules: conditionalRules,
      meta: {
        totalVisible: conditionalRules.visibleQuestions.length,
        totalRequired: conditionalRules.requiredQuestions.length,
        totalHidden: conditionalRules.hiddenQuestions.length
      }
    });
  } catch (error) {
    console.error('Error getting conditional rules:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get conditional rules' 
    });
  }
});

// GET /api/smart-intake/recommendations/:intakeFormId - Get smart recommendations
router.get("/recommendations/:intakeFormId", async (req: AuthenticatedRequest, res) => {
  try {
    const { intakeFormId } = req.params;
    
    const recommendations = await ConditionalQuestionService.generateSmartRecommendations(intakeFormId);
    
    res.json({
      success: true,
      recommendations,
      meta: {
        totalCritical: recommendations.criticalQuestions.length,
        totalSuggested: recommendations.suggestedQuestions.length,
        totalOptional: recommendations.optionalQuestions.length
      }
    });
  } catch (error) {
    console.error('Error getting smart recommendations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get smart recommendations' 
    });
  }
});

// GET /api/smart-intake/workflow/:intakeFormId - Get branching workflow
router.get("/workflow/:intakeFormId", async (req: AuthenticatedRequest, res) => {
  try {
    const { intakeFormId } = req.params;
    
    const workflow = await ConditionalQuestionService.createBranchingWorkflow(intakeFormId);
    
    res.json({
      success: true,
      workflow,
      meta: {
        totalWorkflows: workflow.workflows.length,
        recommendedPath: workflow.recommendedPath
      }
    });
  } catch (error) {
    console.error('Error getting branching workflow:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get branching workflow' 
    });
  }
});

// GET /api/smart-intake/pre-population - Get pre-population data for new intake
router.get("/pre-population", async (req: AuthenticatedRequest, res) => {
  try {
    const prePopulationData = await SmartPrePopulationService.generatePrePopulationData(
      req.tenant!.id,
      req.user!.id
    );
    
    res.json({
      success: true,
      prePopulation: prePopulationData,
      meta: {
        fieldsCount: Object.keys(prePopulationData.prePopulatedFields).length,
        suggestionsCount: prePopulationData.smartSuggestions.length,
        confidence: prePopulationData.confidence,
        dataSourcesCount: prePopulationData.dataSources.length
      }
    });
  } catch (error) {
    console.error('Error getting pre-population data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get pre-population data' 
    });
  }
});

// POST /api/smart-intake/apply-prepopulation/:intakeFormId - Apply pre-population data
router.post("/apply-prepopulation/:intakeFormId", async (req: AuthenticatedRequest, res) => {
  try {
    const { intakeFormId } = req.params;
    const { prePopulationData, userPreferences } = req.body;
    
    const applyPrePopulationSchema = z.object({
      prePopulationData: z.record(z.any()),
      userPreferences: z.object({
        autoApply: z.boolean().default(false),
        confidenceThreshold: z.number().min(0).max(1).default(0.8)
      }).optional()
    });
    
    const validatedData = applyPrePopulationSchema.parse({ prePopulationData, userPreferences });
    
    const result = await SmartPrePopulationService.applySmartPrePopulation(
      intakeFormId,
      validatedData.prePopulationData,
      validatedData.userPreferences
    );
    
    res.json({
      success: result.success,
      result,
      meta: {
        appliedCount: Object.keys(result.applied).length,
        skippedCount: Object.keys(result.skipped).length
      }
    });
  } catch (error) {
    console.error('Error applying pre-population:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: 'Failed to apply pre-population' 
    });
  }
});

// POST /api/smart-intake/evaluate-dependencies - Evaluate question dependencies in real-time
router.post("/evaluate-dependencies", async (req: AuthenticatedRequest, res) => {
  try {
    const { intakeFormId, changedField, newValue } = req.body;
    
    const evaluateDependenciesSchema = z.object({
      intakeFormId: z.string(),
      changedField: z.string(),
      newValue: z.any()
    });
    
    const validatedData = evaluateDependenciesSchema.parse({ intakeFormId, changedField, newValue });
    
    // Re-evaluate conditional rules after the change
    const conditionalRules = await ConditionalQuestionService.evaluateConditionalRules(
      validatedData.intakeFormId
    );
    
    res.json({
      success: true,
      conditionalRules,
      meta: {
        triggerField: validatedData.changedField,
        newValue: validatedData.newValue,
        affectedQuestions: conditionalRules.visibleQuestions.length
      }
    });
  } catch (error) {
    console.error('Error evaluating dependencies:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: 'Failed to evaluate dependencies' 
    });
  }
});

export default router;
