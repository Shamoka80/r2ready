/**
 * Phase 5: Integration - Scoring Orchestrator
 * 
 * Coordinates scoring calculation by conditionally delegating to new R2v3 enhancement modules
 * based on feature flags, while maintaining backward compatibility with legacy scoring.
 * 
 * Architecture:
 * - Wraps existing calculateAssessmentScore function
 * - Checks feature flags to determine which modules to activate
 * - Delegates to ConfigurableScoring when USE_CONFIG_WEIGHTS enabled
 * - Runs CriticalGateEngine when ENFORCE_MUST_PASS enabled  
 * - Calculates MaturityScore when SEPARATE_MATURITY enabled
 * - Falls back to legacy scoring when all flags disabled
 */

import { flagService } from "@shared/flags";
import { ConfigurableScoring } from "./configurableScoring";
import { CriticalGateEngine } from "./criticalGateEngine";
import { MaturityEngine } from "./maturityEngine";
import { db } from "../db";
import { assessments, maturityScores, answers } from "@shared/schema";
import { eq } from "drizzle-orm";

// Extended scoring result with Phase 5 enhancements
export interface EnhancedScoringResult {
  // Legacy scoring fields (backward compatible)
  assessmentId: string;
  overallScore: number;
  maxPossibleScore: number;
  scorePercentage: number;
  categoryScores: any[];
  complianceStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'INCOMPLETE';
  criticalIssues: string[];
  recommendations: string[];
  readinessLevel: 'AUDIT_READY' | 'NEEDS_IMPROVEMENT' | 'MAJOR_GAPS' | 'NOT_READY';
  estimatedAuditSuccess: number;
  lastCalculated: string;
  intakeBasedScoring?: any;
  
  // Phase 5 enhancement fields (only populated when flags enabled)
  configBasedScoring?: {
    enabled: boolean;
    scoringConfigUsed?: string;
    configVersion?: string;
    naHandling?: string;
  };
  criticalGateResults?: {
    enabled: boolean;
    hasCriticalBlockers: boolean;
    criticalBlockersCount: number;
    blockerDetails: string[];
    readinessClassification?: string;
  };
  maturityResults?: {
    enabled: boolean;
    maturityScoreId?: string;
    bcpScore?: number;
    ciScore?: number;
    stakeholderScore?: number;
    overallMaturityScore?: number;
    maturityLevel?: string;
  };
}

export class ScoringOrchestrator {
  /**
   * Calculate assessment score with Phase 5 enhancements based on feature flags
   */
  static async calculateEnhancedScore(
    assessmentId: string,
    legacyCalculateFunction: (assessmentId: string, intakeScope?: any) => Promise<any>,
    intakeScope?: any
  ): Promise<EnhancedScoringResult> {
    // Check feature flags
    const useConfigWeights = await flagService.isEnabled('use_config_weights');
    const enforceMustPass = await flagService.isEnabled('enforce_must_pass');
    const separateMaturity = await flagService.isEnabled('separate_maturity');
    const excludeNaFromDenominator = await flagService.isEnabled('exclude_na_from_denominator');
    
    // Start with base result (legacy scoring or config-based)
    let baseResult: any;
    let configBasedScoring = undefined;
    
    if (useConfigWeights) {
      // Use new database-driven ConfigurableScoring
      try {
        // Apply naHandling override based on exclude_na_from_denominator flag
        const naHandlingOverride = excludeNaFromDenominator ? 'EXCLUDE' : undefined;
        const configResult = await ConfigurableScoring.calculateScore(assessmentId, undefined, naHandlingOverride);
        
        // Map ConfigurableScoring result to legacy format for backward compatibility
        baseResult = {
          assessmentId,
          overallScore: configResult.weightedScore,
          maxPossibleScore: configResult.effectiveQuestions * 100,
          scorePercentage: configResult.overallScore,
          categoryScores: configResult.categoryScores.map((cat: any) => ({
            category: cat.category,
            categoryName: cat.category,
            score: cat.score,
            maxScore: cat.maxPossibleScore,
            percentage: cat.score,
            weight: cat.weight,
            required: false,
            questionsAnswered: cat.questionCount,  // Fixed: use questionsAnswered not answeredQuestions
            totalQuestions: cat.questionCount,
            criticalGaps: []
          })),
          complianceStatus: configResult.isReady ? 'COMPLIANT' : configResult.isPassing ? 'PARTIAL' : 'NON_COMPLIANT',
          criticalIssues: [],
          recommendations: [],
          readinessLevel: configResult.isReady ? 'AUDIT_READY' : configResult.isPassing ? 'NEEDS_IMPROVEMENT' : 'MAJOR_GAPS',
          estimatedAuditSuccess: configResult.overallScore,
          lastCalculated: new Date().toISOString()
        };
        
        configBasedScoring = {
          enabled: true,
          scoringConfigUsed: configResult.scoringConfigUsed,
          naHandling: excludeNaFromDenominator ? 'EXCLUDE' : 'COUNT_AS_100'
        };
      } catch (error) {
        console.error('[ScoringOrchestrator] ConfigurableScoring failed, falling back to legacy:', error);
        // Fall back to legacy scoring on error
        baseResult = await legacyCalculateFunction(assessmentId, intakeScope);
        configBasedScoring = {
          enabled: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      // Use legacy scoring
      baseResult = await legacyCalculateFunction(assessmentId, intakeScope);
      
      // Apply exclude_na_from_denominator adjustment to legacy scoring if flag enabled
      if (excludeNaFromDenominator) {
        baseResult = await this.adjustLegacyScoringForNAExclusion(assessmentId, baseResult);
        
        // Set metadata to reflect actual NA handling behavior
        configBasedScoring = {
          enabled: false,
          naHandling: 'EXCLUDE'
        };
      }
    }
    
    // Phase 5.1: Critical Gate Enforcement
    let criticalGateResults = undefined;
    if (enforceMustPass) {
      try {
        const gateResult = await CriticalGateEngine.evaluateAssessment(assessmentId);
        
        const hasCriticalBlockers = !gateResult.passed;
        const readinessClassification = gateResult.passed ? 'READY' : 'NOT_READY';
        
        criticalGateResults = {
          enabled: true,
          hasCriticalBlockers,
          criticalBlockersCount: gateResult.criticalBlockers.length,
          blockerDetails: gateResult.criticalBlockers,
          readinessClassification
        };
        
        // Use service helper to update assessment
        await CriticalGateEngine.updateAssessmentWithResults(assessmentId, gateResult);
        
        // Override compliance status if critical blockers found
        if (hasCriticalBlockers) {
          baseResult.complianceStatus = 'NON_COMPLIANT';
          baseResult.readinessLevel = 'NOT_READY';
          baseResult.criticalIssues = [
            ...baseResult.criticalIssues,
            ...gateResult.criticalBlockers
          ];
        }
      } catch (error) {
        console.error('[ScoringOrchestrator] CriticalGateEngine failed:', error);
        criticalGateResults = {
          enabled: true,
          error: error instanceof Error ? error.message : 'Unknown error',
          hasCriticalBlockers: false,
          criticalBlockersCount: 0,
          blockerDetails: []
        };
      }
    }
    
    // Phase 5.2: Separate Maturity Scoring
    let maturityResults = undefined;
    if (separateMaturity) {
      try {
        const maturityResult = await MaturityEngine.calculateMaturityScore(assessmentId);
        
        // Save maturity score and get the persisted record
        const savedScore = await MaturityEngine.saveMaturityScore(assessmentId, maturityResult);
        
        maturityResults = {
          enabled: true,
          maturityScoreId: savedScore.id,
          bcpScore: maturityResult.businessContinuityScore,
          ciScore: maturityResult.continuousImprovementScore,
          stakeholderScore: maturityResult.stakeholderEngagementScore,
          overallMaturityScore: maturityResult.overallMaturity,
          maturityLevel: maturityResult.maturityLevel
        };
        
        // Update assessment with maturity score reference
        await db.update(assessments)
          .set({
            maturityScoreId: savedScore.id
          })
          .where(eq(assessments.id, assessmentId));
      } catch (error) {
        console.error('[ScoringOrchestrator] MaturityEngine failed:', error);
        maturityResults = {
          enabled: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    // Construct enhanced result
    return {
      ...baseResult,
      configBasedScoring,
      criticalGateResults,
      maturityResults
    };
  }
  
  /**
   * Update assessment with enhanced scoring results
   */
  static async updateAssessmentWithResults(
    assessmentId: string,
    result: EnhancedScoringResult
  ): Promise<void> {
    const updates: any = {
      progress: result.scorePercentage,
      updatedAt: new Date()
    };
    
    // Add config-based scoring fields if enabled
    if (result.configBasedScoring?.enabled && result.configBasedScoring.scoringConfigUsed) {
      // ConfigurableScoring already updates scoringConfigId and readinessClassification
    }
    
    // Add critical gate results if enabled
    if (result.criticalGateResults?.enabled) {
      updates.criticalBlockers = result.criticalGateResults.blockerDetails;
      updates.criticalBlockersCount = result.criticalGateResults.criticalBlockersCount;
      if (result.criticalGateResults.readinessClassification) {
        updates.readinessClassification = result.criticalGateResults.readinessClassification;
      }
    }
    
    // Add maturity score reference if enabled
    if (result.maturityResults?.enabled && result.maturityResults.maturityScoreId) {
      updates.maturityScoreId = result.maturityResults.maturityScoreId;
    }
    
    await db.update(assessments)
      .set(updates)
      .where(eq(assessments.id, assessmentId));
  }

  /**
   * Determine category key matching legacy determineCategoryKey logic
   * Priority: appendix > categoryCode > category > MISC
   */
  private static determineCategoryKey(question: any): string {
    if (question?.appendix) return question.appendix;
    if (question?.categoryCode) return question.categoryCode;
    if (question?.category) return question.category;
    return 'MISC';
  }

  /**
   * Adjust legacy scoring result to exclude N/A from denominators
   * Recalculates from raw answers using legacy logic but skipping N/A
   */
  private static async adjustLegacyScoringForNAExclusion(
    assessmentId: string,
    legacyResult: any
  ): Promise<any> {
    // Legacy ANSWER_SCORES mapping (same as in scoring.ts)
    const ANSWER_SCORES: Record<string, number> = {
      'Yes': 100,
      'No': 0,
      'Partial': 50,
      'N/A': 100,
      'In Progress': 25
    };

    // Fetch all answers with question metadata
    const answerList = await db.query.answers.findMany({
      where: eq(answers.assessmentId, assessmentId),
      with: {
        question: true
      }
    });

    if (answerList.length === 0) {
      return legacyResult;
    }

    // Group answers by category using exact legacy determineCategoryKey logic
    const categorizedAnswers = new Map<string, typeof answerList>();
    for (const answer of answerList) {
      const categoryKey = this.determineCategoryKey(answer.question);
      
      if (!categorizedAnswers.has(categoryKey)) {
        categorizedAnswers.set(categoryKey, []);
      }
      categorizedAnswers.get(categoryKey)!.push(answer);
    }

    // Recalculate each category using legacy logic but excluding N/A
    const adjustedCategoryScores = legacyResult.categoryScores.map((cat: any) => {
      const categoryAnswers = categorizedAnswers.get(cat.category) || [];
      
      let totalScore = 0;
      let maxScore = 0;
      let answeredCount = 0;

      for (const answer of categoryAnswers) {
        const answerValue = answer.value;
        
        // Skip N/A answers when calculating denominators
        if (answerValue === 'N/A') {
          continue; // Don't add to score or maxScore
        }

        maxScore += 100; // Each question worth 100 points

        if (answerValue) {
          answeredCount++;
          const score = ANSWER_SCORES[answerValue as string] ?? 0;
          totalScore += score;
        }
      }

      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      return {
        ...cat,
        score: totalScore,
        maxScore,
        percentage,
        questionsAnswered: answeredCount
        // Keep totalQuestions, weight, other fields from legacy result
      };
    });

    // Recalculate overall metrics using weighted sums
    const overallScore = adjustedCategoryScores.reduce(
      (sum: number, cat: any) => sum + (cat.score * (cat.weight || 1)),
      0
    );
    const maxPossibleScore = adjustedCategoryScores.reduce(
      (sum: number, cat: any) => sum + (cat.maxScore * (cat.weight || 1)),
      0
    );
    const scorePercentage = maxPossibleScore > 0 ? Math.round((overallScore / maxPossibleScore) * 100) : 0;

    // Determine readiness level
    let readinessLevel: 'AUDIT_READY' | 'NEEDS_IMPROVEMENT' | 'MAJOR_GAPS' | 'NOT_READY' = 'MAJOR_GAPS';
    if (scorePercentage >= 85) readinessLevel = 'AUDIT_READY';
    else if (scorePercentage >= 75) readinessLevel = 'NEEDS_IMPROVEMENT';

    // Determine compliance status
    let complianceStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'INCOMPLETE' = 'NON_COMPLIANT';
    if (scorePercentage >= 90) complianceStatus = 'COMPLIANT';
    else if (scorePercentage >= 60) complianceStatus = 'PARTIAL';
    else if (scorePercentage > 0) complianceStatus = 'NON_COMPLIANT';
    else complianceStatus = 'INCOMPLETE';

    return {
      ...legacyResult,
      categoryScores: adjustedCategoryScores,
      overallScore,
      maxPossibleScore,
      scorePercentage,
      complianceStatus,
      readinessLevel,
      estimatedAuditSuccess: scorePercentage
    };
  }
}
