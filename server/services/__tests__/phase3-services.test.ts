import { CriticalGateEngine } from '../criticalGateEngine';
import { MaturityEngine } from '../maturityEngine';
import { ConfigurableScoring } from '../configurableScoring';
import { EnhancedConditionalQuestionService } from '../enhancedConditionalQuestionService';

/**
 * Phase 3 Core Services Integration Tests
 * 
 * These tests verify that the new Phase 3 services are correctly implemented
 * and can interact with the database schema without errors.
 */

describe('Phase 3 Core Services', () => {
  
  describe('CriticalGateEngine', () => {
    it('should load active must-pass rules from database', async () => {
      const rules = await CriticalGateEngine.getActiveMustPassRules();
      expect(Array.isArray(rules)).toBe(true);
    });

    it('should have correct rule structure', async () => {
      const rules = await CriticalGateEngine.getActiveMustPassRules();
      if (rules.length > 0) {
        const rule = rules[0];
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('ruleName');
        expect(rule).toHaveProperty('ruleCode');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('ruleType');
        expect(rule).toHaveProperty('blockerSeverity');
        expect(rule).toHaveProperty('isActive');
        expect(rule).toHaveProperty('questionIds');
        expect(Array.isArray(rule.questionIds)).toBe(true);
      }
    });

    it('should evaluate assessment without errors (empty assessment)', async () => {
      const result = await CriticalGateEngine.evaluateAssessment('non-existent-id');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('failedRules');
      expect(result).toHaveProperty('totalRules');
      expect(result).toHaveProperty('passedRules');
      expect(result).toHaveProperty('criticalBlockers');
    });
  });

  describe('MaturityEngine', () => {
    it('should calculate maturity score without errors (empty assessment)', async () => {
      const score = await MaturityEngine.calculateMaturityScore('non-existent-id');
      expect(score).toHaveProperty('overallMaturity');
      expect(score).toHaveProperty('businessContinuityScore');
      expect(score).toHaveProperty('continuousImprovementScore');
      expect(score).toHaveProperty('stakeholderEngagementScore');
      expect(score).toHaveProperty('maturityLevel');
      expect(score).toHaveProperty('dimensionDetails');
    });

    it('should return empty maturity score for non-existent assessment', async () => {
      const score = await MaturityEngine.calculateMaturityScore('non-existent-id');
      expect(score.overallMaturity).toBe(0);
      expect(score.maturityLevel).toBe('BASIC');
    });
  });

  describe('ConfigurableScoring', () => {
    it('should get default scoring configuration', async () => {
      const config = await ConfigurableScoring.getDefaultScoringConfig();
      expect(config).not.toBeNull();
      if (config) {
        expect(config).toHaveProperty('id');
        expect(config).toHaveProperty('configName');
        expect(config).toHaveProperty('configVersion');
        expect(config).toHaveProperty('weights');
        expect(config).toHaveProperty('appendixWeights');
        expect(config).toHaveProperty('readinessThresholds');
        expect(config).toHaveProperty('naHandling');
        expect(config).toHaveProperty('isActive');
      }
    });

    it('should calculate score without errors (empty assessment)', async () => {
      const result = await ConfigurableScoring.calculateScore('non-existent-id');
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('weightedScore');
      expect(result).toHaveProperty('categoryScores');
      expect(result).toHaveProperty('isPassing');
      expect(result).toHaveProperty('isReady');
      expect(result).toHaveProperty('scoringConfigUsed');
    });

    it('should return empty result for non-existent assessment', async () => {
      const result = await ConfigurableScoring.calculateScore('non-existent-id');
      expect(result.overallScore).toBe(0);
      expect(result.categoryScores).toEqual([]);
    });
  });

  describe('EnhancedConditionalQuestionService', () => {
    it('should load active conditional rules from database', async () => {
      const rules = await EnhancedConditionalQuestionService.getActiveConditionalRules();
      expect(Array.isArray(rules)).toBe(true);
    });

    it('should have correct conditional rule structure', async () => {
      const rules = await EnhancedConditionalQuestionService.getActiveConditionalRules();
      if (rules.length > 0) {
        const rule = rules[0];
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('ruleName');
        expect(rule).toHaveProperty('ruleCode');
        expect(rule).toHaveProperty('triggerCondition');
        expect(rule).toHaveProperty('action');
        expect(rule).toHaveProperty('targetQuestionIds');
        expect(rule).toHaveProperty('priority');
        expect(rule).toHaveProperty('isActive');
      }
    });

    it('should evaluate conditional rules without errors', async () => {
      const result = await EnhancedConditionalQuestionService.evaluateConditionalRules('non-existent-id');
      expect(result).toHaveProperty('questionsToShow');
      expect(result).toHaveProperty('questionsToHide');
      expect(result).toHaveProperty('questionsToRequire');
      expect(result).toHaveProperty('questionsToOptional');
      expect(result).toHaveProperty('evaluationLog');
      expect(Array.isArray(result.questionsToShow)).toBe(true);
    });

    it('should get evaluation summary without errors', async () => {
      const summary = await EnhancedConditionalQuestionService.getEvaluationSummary('non-existent-id');
      expect(summary).toHaveProperty('totalRules');
      expect(summary).toHaveProperty('triggeredRules');
      expect(summary).toHaveProperty('affectedQuestions');
      expect(summary).toHaveProperty('evaluationLog');
    });
  });

  describe('Integration Tests', () => {
    it('should allow creating scoring configurations', async () => {
      const configId = await ConfigurableScoring.createScoringConfig({
        configName: 'Test Config',
        configVersion: '1.0',
        weights: { LEGAL: 20, FACILITY: 20, EHS: 20, PROC: 20, DATA: 10, SUPPLY: 10 },
        appendixWeights: null,
        readinessThresholds: { passing: 75, ready: 85 },
        naHandling: 'EXCLUDE',
        requiredQuestionMultiplier: 1.5,
        isActive: false
      });
      
      expect(typeof configId).toBe('string');
      expect(configId.length).toBeGreaterThan(0);
    });

    it('should load created scoring configuration', async () => {
      const configId = await ConfigurableScoring.createScoringConfig({
        configName: 'Test Config 2',
        configVersion: '1.0',
        weights: { LEGAL: 15, FACILITY: 20, EHS: 25, PROC: 20, DATA: 10, SUPPLY: 10 },
        appendixWeights: null,
        readinessThresholds: { passing: 80, ready: 90 },
        naHandling: 'COUNT_AS_100',
        requiredQuestionMultiplier: 1.5,
        isActive: false
      });

      const config = await ConfigurableScoring.getScoringConfig(configId);
      expect(config).not.toBeNull();
      expect(config?.configName).toBe('Test Config 2');
      expect(config?.readinessThresholds.passing).toBe(80);
    });
  });
});
