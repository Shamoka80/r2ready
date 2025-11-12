
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { assessments, questions, answers, clauses } from "../../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireFacilityPermissionFromAssessment, type AuthenticatedRequest } from "../services/authService";
import { ScoringOrchestrator } from "../services/scoringOrchestrator";

const router = Router();

// Scoring configuration based on question categories and intake complexity
const SCORING_WEIGHTS: Record<string, { weight: number; required: boolean; category: string; }> = {
  // Core Requirements (Critical for certification)
  'CR1': { weight: 15, required: true, category: 'Legal and Regulatory Compliance' },
  'CR2': { weight: 12, required: true, category: 'Facility Management' },
  'CR3': { weight: 10, required: true, category: 'Data Security' },
  'CR4': { weight: 8, required: false, category: 'Processing Operations' },
  'CR5': { weight: 8, required: false, category: 'Chain of Custody' },
  'CR6': { weight: 7, required: false, category: 'Environmental Management' },
  'CR7': { weight: 6, required: false, category: 'Health and Safety' },
  'CR8': { weight: 5, required: false, category: 'Management Systems' },

  // Appendix-specific scoring (variable based on intake)
  'APP-A': { weight: 12, required: false, category: 'Focus Materials Management' },
  'APP-B': { weight: 10, required: false, category: 'Equipment Refurbishment' },
  'APP-C': { weight: 8, required: false, category: 'Materials Recovery' },
  'APP-D': { weight: 15, required: false, category: 'Data Destruction' },
  'APP-E': { weight: 10, required: false, category: 'International Operations' },
  'APP-G': { weight: 6, required: false, category: 'Collection and Transportation' },

  // Facility and process complexity multipliers
  'FACILITY': { weight: 5, required: false, category: 'Facility Operations' },
  'PROC': { weight: 6, required: false, category: 'Processing Procedures' },
  'DATA': { weight: 8, required: false, category: 'Data Management' },
  'SUPPLY': { weight: 7, required: false, category: 'Supply Chain' },
  'INTL': { weight: 9, required: false, category: 'International Compliance' }
};

// Answer scoring values
const ANSWER_SCORES: Record<string, number> = {
  'Yes': 100,
  'No': 0,
  'Partial': 50,
  'N/A': 100, // N/A is considered compliant for scoring purposes
  'In Progress': 25
};

interface ScoringResult {
  assessmentId: string;
  overallScore: number;
  maxPossibleScore: number;
  scorePercentage: number;
  categoryScores: CategoryScore[];
  complianceStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'INCOMPLETE';
  criticalIssues: string[];
  recommendations: string[];
  readinessLevel: 'AUDIT_READY' | 'NEEDS_IMPROVEMENT' | 'MAJOR_GAPS' | 'NOT_READY';
  estimatedAuditSuccess: number;
  lastCalculated: string;
  intakeBasedScoring?: {
    applicableCategories: string[];
    weightAdjustments: Record<string, number>;
    complexityMultiplier: number;
    scopeSpecificScore: number;
  };
}

interface CategoryScore {
  category: string;
  categoryName: string;
  score: number;
  maxScore: number;
  percentage: number;
  weight: number;
  required: boolean;
  questionsAnswered: number;
  totalQuestions: number;
  criticalGaps: string[];
}

// GET /api/assessments/:id/scoring - Calculate comprehensive assessment score
router.get('/:id/scoring', 
  requireFacilityPermissionFromAssessment('view_reports'),
  async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { intakeFormId, realtime } = req.query;

    // Verify assessment exists
    const [assessment] = await db.select()
      .from(assessments)
      .where(eq(assessments.id, id));

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Get intake-based scope if provided
    let intakeScope = null;
    if (intakeFormId && typeof intakeFormId === 'string') {
      try {
        const { IntakeProcessor } = await import('./intakeLogic');
        intakeScope = await IntakeProcessor.generateAssessmentScope(intakeFormId);
      } catch (error) {
        console.warn('Failed to get intake scope for scoring:', error);
      }
    }

    // Calculate comprehensive scoring with Phase 5 enhancements
    const scoringResult = await ScoringOrchestrator.calculateEnhancedScore(
      id,
      calculateAssessmentScore,
      intakeScope
    );

    // Update assessment record with latest score (if not realtime)
    if (!realtime) {
      await ScoringOrchestrator.updateAssessmentWithResults(id, scoringResult);
    }

    res.json(scoringResult);
  } catch (error) {
    console.error('Error calculating assessment score:', error);
    res.status(500).json({ error: 'Failed to calculate assessment score' });
  }
});

// POST /api/assessments/:id/scoring/refresh - Refresh scoring with updated answers
router.post('/:id/scoring/refresh', 
  requireFacilityPermissionFromAssessment('manage_assessments'),
  async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { intakeFormId } = req.body;

    let intakeScope = null;
    if (intakeFormId) {
      const { IntakeProcessor } = await import('./intakeLogic');
      intakeScope = await IntakeProcessor.generateAssessmentScope(intakeFormId);
    }

    // Calculate scoring with Phase 5 enhancements
    const scoringResult = await ScoringOrchestrator.calculateEnhancedScore(
      id,
      calculateAssessmentScore,
      intakeScope
    );

    // Update assessment with fresh scoring
    await ScoringOrchestrator.updateAssessmentWithResults(id, scoringResult);
    await db.update(assessments)
      .set({
        status: scoringResult.complianceStatus === 'COMPLIANT' ? 'COMPLETED' : 'IN_PROGRESS',
        ...(scoringResult.complianceStatus === 'COMPLIANT' && { completedAt: new Date() })
      })
      .where(eq(assessments.id, id));

    res.json({
      success: true,
      scoring: scoringResult,
      message: `Assessment scoring refreshed - ${scoringResult.complianceStatus}`
    });
  } catch (error) {
    console.error('Error refreshing assessment score:', error);
    res.status(500).json({ error: 'Failed to refresh assessment score' });
  }
});

// Core scoring calculation function
export async function calculateAssessmentScore(assessmentId: string, intakeScope: any = null): Promise<ScoringResult> {
  // Get all questions for this assessment
  const [assessment] = await db.select({ stdId: assessments.stdId })
    .from(assessments)
    .where(eq(assessments.id, assessmentId));

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  // Get all questions and their current answers
  const questionsWithAnswers = await db.select({
    questionId: questions.id,
    questionKey: questions.questionId,
    text: questions.text,
    required: questions.required,
    category: questions.category,
    categoryCode: questions.category_code,
    categoryName: questions.categoryName,
    appendix: questions.appendix,
    clauseRef: clauses.ref,
    answerValue: answers.value
  })
  .from(questions)
  .leftJoin(clauses, eq(questions.clauseId, clauses.id))
  .leftJoin(answers, and(
    eq(answers.questionId, questions.id),
    eq(answers.assessmentId, assessmentId)
  ))
  .where(eq(clauses.stdId, assessment.stdId));

  // Group questions by category for scoring
  const categoryGroups = new Map<string, any[]>();
  for (const q of questionsWithAnswers) {
    const categoryKey = determineCategoryKey(q);
    if (!categoryGroups.has(categoryKey)) {
      categoryGroups.set(categoryKey, []);
    }
    categoryGroups.get(categoryKey)!.push(q);
  }

  // Calculate category scores
  const categoryScores: CategoryScore[] = [];
  let totalWeightedScore = 0;
  let maxWeightedScore = 0;
  const criticalIssues: string[] = [];

  for (const [categoryKey, questions] of categoryGroups.entries()) {
    const categoryScore = calculateCategoryScore(categoryKey, questions, intakeScope);
    categoryScores.push(categoryScore);

    // Add to overall scoring
    totalWeightedScore += categoryScore.score * categoryScore.weight;
    maxWeightedScore += categoryScore.maxScore * categoryScore.weight;

    // Collect critical issues
    if (categoryScore.required && categoryScore.percentage < 80) {
      criticalIssues.push(`${categoryScore.categoryName} below minimum threshold (${categoryScore.percentage}%)`);
    }
    criticalIssues.push(...categoryScore.criticalGaps);
  }

  // Calculate overall percentage
  const scorePercentage = maxWeightedScore > 0 ? Math.round((totalWeightedScore / maxWeightedScore) * 100) : 0;

  // Determine compliance status
  const complianceStatus = determineComplianceStatus(scorePercentage, categoryScores, criticalIssues);

  // Generate recommendations
  const recommendations = generateRecommendations(categoryScores, intakeScope);

  // Determine readiness level
  const readinessLevel = determineReadinessLevel(scorePercentage, criticalIssues.length, categoryScores);

  // Estimate audit success probability
  const estimatedAuditSuccess = calculateAuditSuccessProbability(scorePercentage, categoryScores, intakeScope);

  // Prepare intake-based scoring details
  let intakeBasedScoring: { applicableCategories: string[]; weightAdjustments: Record<string, number>; complexityMultiplier: number; scopeSpecificScore: number; } | undefined = undefined;
  if (intakeScope) {
    intakeBasedScoring = {
      applicableCategories: intakeScope.applicableRecCodes || [],
      weightAdjustments: calculateWeightAdjustments(intakeScope),
      complexityMultiplier: intakeScope.complexityFactors?.overall || 1.0,
      scopeSpecificScore: calculateScopeSpecificScore(categoryScores, intakeScope)
    };
  }

  return {
    assessmentId,
    overallScore: Math.round(totalWeightedScore),
    maxPossibleScore: Math.round(maxWeightedScore),
    scorePercentage,
    categoryScores,
    complianceStatus,
    criticalIssues,
    recommendations,
    readinessLevel,
    estimatedAuditSuccess,
    lastCalculated: new Date().toISOString(),
    intakeBasedScoring
  };
}

function determineCategoryKey(question: any): string {
  // Priority order: appendix > category_code > category > default
  if (question.appendix) {
    return question.appendix;
  }
  if (question.categoryCode) {
    return question.categoryCode;
  }
  if (question.category) {
    return question.category;
  }
  return 'MISC';
}

function calculateCategoryScore(categoryKey: string, questions: any[], intakeScope: any): CategoryScore {
  const scoringConfig = SCORING_WEIGHTS[categoryKey] || { 
    weight: 5, 
    required: false, 
    category: categoryKey 
  };

  let totalScore = 0;
  let maxScore = 0;
  let answeredQuestions = 0;
  const criticalGaps: string[] = [];

  for (const question of questions) {
    // Normalize answer value (handle JSON-encoded values from database)
    let answerValue = question.answerValue;
    if (answerValue) {
      // Remove JSON encoding if present (e.g., """Yes""" -> "Yes")
      answerValue = typeof answerValue === 'string' ? answerValue.replace(/^"+|"+$/g, '') : answerValue;
    }
    
    maxScore += 100; // Each question worth 100 points

    if (answerValue) {
      answeredQuestions++;
      // Case-insensitive lookup for robustness
      const normalizedValue = Object.keys(ANSWER_SCORES).find(
        key => key.toLowerCase() === answerValue.toLowerCase()
      );
      const score = normalizedValue ? ANSWER_SCORES[normalizedValue] : 0;
      totalScore += score;

      // Check for critical gaps
      if (question.required && score < 100) {
        criticalGaps.push(`Required: ${question.text.substring(0, 50)}...`);
      }
    } else if (question.required) {
      criticalGaps.push(`Unanswered required: ${question.text.substring(0, 50)}...`);
    }
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return {
    category: categoryKey,
    categoryName: scoringConfig.category,
    score: totalScore,
    maxScore,
    percentage,
    weight: scoringConfig.weight,
    required: scoringConfig.required,
    questionsAnswered: answeredQuestions,
    totalQuestions: questions.length,
    criticalGaps: criticalGaps.slice(0, 3) // Limit to top 3 gaps
  };
}

function determineComplianceStatus(
  scorePercentage: number, 
  categoryScores: CategoryScore[], 
  criticalIssues: string[]
): 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'INCOMPLETE' {
  // Check if any required categories are incomplete
  const requiredCategories = categoryScores.filter(cat => cat.required);
  const incompleteRequired = requiredCategories.filter(cat => cat.percentage < 80);

  if (incompleteRequired.length > 0) {
    return 'NON_COMPLIANT';
  }

  if (criticalIssues.length > 0) {
    return 'NON_COMPLIANT';
  }

  if (scorePercentage >= 85) {
    return 'COMPLIANT';
  } else if (scorePercentage >= 70) {
    return 'PARTIAL';
  } else {
    return 'INCOMPLETE';
  }
}

function generateRecommendations(categoryScores: CategoryScore[], intakeScope: any): string[] {
  const recommendations: string[] = [];

  // Category-specific recommendations
  const lowScoreCategories = categoryScores
    .filter(cat => cat.percentage < 70)
    .sort((a, b) => a.percentage - b.percentage);

  for (const category of lowScoreCategories.slice(0, 3)) {
    if (category.required) {
      recommendations.push(`CRITICAL: Improve ${category.categoryName} compliance (currently ${category.percentage}%)`);
    } else {
      recommendations.push(`Focus on ${category.categoryName} to increase overall readiness (${category.percentage}%)`);
    }
  }

  // Intake-specific recommendations
  if (intakeScope?.applicableRecCodes) {
    const appendixCategories = categoryScores.filter(cat => cat.category.startsWith('APP-'));
    const relevantAppendices = appendixCategories.filter(cat => 
      intakeScope.applicableRecCodes.includes(cat.category)
    );

    for (const appendix of relevantAppendices) {
      if (appendix.percentage < 80) {
        recommendations.push(`Address ${appendix.categoryName} requirements specific to your operations`);
      }
    }
  }

  // Generic improvement recommendations
  if (recommendations.length === 0) {
    recommendations.push('Continue answering questions to improve assessment completeness');
    recommendations.push('Focus on required questions first for compliance readiness');
  }

  return recommendations.slice(0, 5); // Limit to top 5 recommendations
}

function determineReadinessLevel(
  scorePercentage: number, 
  criticalIssuesCount: number, 
  categoryScores: CategoryScore[]
): 'AUDIT_READY' | 'NEEDS_IMPROVEMENT' | 'MAJOR_GAPS' | 'NOT_READY' {
  if (criticalIssuesCount > 3) return 'NOT_READY';
  if (scorePercentage < 60) return 'NOT_READY';
  if (scorePercentage < 70) return 'MAJOR_GAPS';
  if (scorePercentage < 85) return 'NEEDS_IMPROVEMENT';
  
  // Check if all required categories are well-covered
  const requiredCategories = categoryScores.filter(cat => cat.required);
  const wellCoveredRequired = requiredCategories.filter(cat => cat.percentage >= 85);
  
  if (wellCoveredRequired.length === requiredCategories.length && scorePercentage >= 85) {
    return 'AUDIT_READY';
  }
  
  return 'NEEDS_IMPROVEMENT';
}

function calculateAuditSuccessProbability(
  scorePercentage: number, 
  categoryScores: CategoryScore[], 
  intakeScope: any
): number {
  let baseSuccess = Math.min(scorePercentage, 85); // Cap at 85% base

  // Adjust for required category coverage
  const requiredCategories = categoryScores.filter(cat => cat.required);
  if (requiredCategories.length > 0) {
    const avgRequiredScore = requiredCategories.reduce((sum, cat) => sum + cat.percentage, 0) / requiredCategories.length;
    baseSuccess = (baseSuccess + avgRequiredScore) / 2;
  }

  // Adjust for intake complexity
  if (intakeScope?.complexityFactors) {
    const complexityAdjustment = Math.max(0.8, 2.0 - intakeScope.complexityFactors.overall);
    baseSuccess *= complexityAdjustment;
  }

  return Math.round(Math.min(95, Math.max(5, baseSuccess))); // Range 5-95%
}

function calculateWeightAdjustments(intakeScope: any): Record<string, number> {
  const adjustments: Record<string, number> = {};

  if (intakeScope?.applicableRecCodes) {
    for (const recCode of intakeScope.applicableRecCodes) {
      // Increase weight for applicable categories
      if (recCode.startsWith('APP-')) {
        adjustments[recCode] = 1.5;
      } else if (recCode.startsWith('DATA-')) {
        adjustments['CR3'] = 1.3; // Data security gets higher weight
        adjustments['APP-D'] = 1.4;
      } else if (recCode.startsWith('FACILITY-')) {
        adjustments['CR2'] = 1.2;
        adjustments['FACILITY'] = 1.3;
      }
    }
  }

  return adjustments;
}

function calculateScopeSpecificScore(categoryScores: CategoryScore[], intakeScope: any): number {
  if (!intakeScope?.applicableRecCodes) {
    return 0;
  }

  // Calculate score for only the categories relevant to the intake scope
  const relevantCategories = categoryScores.filter(cat => 
    intakeScope.applicableRecCodes.includes(cat.category) ||
    (cat.required && cat.category.startsWith('CR'))
  );

  if (relevantCategories.length === 0) {
    return 0;
  }

  const totalWeightedScore = relevantCategories.reduce((sum, cat) => sum + (cat.percentage * cat.weight), 0);
  const totalWeight = relevantCategories.reduce((sum, cat) => sum + cat.weight, 0);

  return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
}

export default router;
