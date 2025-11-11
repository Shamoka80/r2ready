import { db } from '../db';
import { 
  mustPassRules, 
  mustPassRuleQuestions, 
  questions, 
  answers, 
  assessments 
} from '../../shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

export interface CriticalGateResult {
  passed: boolean;
  failedRules: FailedMustPassRule[];
  totalRules: number;
  passedRules: number;
  criticalBlockers: string[];
}

export interface FailedMustPassRule {
  ruleId: string;
  ruleName: string;
  ruleCode: string;
  description: string | null;
  failedQuestionIds: string[];
  failedQuestions: {
    questionId: string;
    questionText: string;
    userAnswer: string;
    requirementNotMet: string;
  }[];
}

export interface MustPassRuleConfig {
  id: string;
  ruleName: string;
  ruleCode: string;
  description: string | null;
  ruleType: string;
  blockerSeverity: string;
  blockerMessage: string | null;
  isActive: boolean;
  questionIds: string[];
  thresholdValue: number | null;
}

export class CriticalGateEngine {
  
  /**
   * Evaluate all must-pass rules for an assessment
   * Returns detailed results including which rules failed and why
   */
  static async evaluateAssessment(assessmentId: string): Promise<CriticalGateResult> {
    const activeRules = await this.getActiveMustPassRules();
    
    if (activeRules.length === 0) {
      return {
        passed: true,
        failedRules: [],
        totalRules: 0,
        passedRules: 0,
        criticalBlockers: []
      };
    }

    const failedRules: FailedMustPassRule[] = [];
    const criticalBlockers: string[] = [];

    for (const rule of activeRules) {
      const ruleResult = await this.evaluateRule(assessmentId, rule);
      
      if (!ruleResult.passed) {
        failedRules.push({
          ruleId: rule.id,
          ruleName: rule.ruleName,
          ruleCode: rule.ruleCode,
          description: rule.description,
          failedQuestionIds: ruleResult.failedQuestions.map(q => q.questionId),
          failedQuestions: ruleResult.failedQuestions
        });
        
        criticalBlockers.push(`${rule.ruleName}: ${rule.description || 'No description'}`);
      }
    }

    return {
      passed: failedRules.length === 0,
      failedRules,
      totalRules: activeRules.length,
      passedRules: activeRules.length - failedRules.length,
      criticalBlockers
    };
  }

  /**
   * Get all active must-pass rules with their associated questions
   */
  static async getActiveMustPassRules(): Promise<MustPassRuleConfig[]> {
    const rules = await db.query.mustPassRules.findMany({
      where: eq(mustPassRules.isActive, true),
      with: {
        ruleQuestions: {
          with: {
            question: true
          }
        }
      }
    });

    return rules.map(rule => ({
      id: rule.id,
      ruleName: rule.ruleName,
      ruleCode: rule.ruleCode,
      description: rule.description,
      ruleType: rule.ruleType,
      blockerSeverity: rule.blockerSeverity,
      blockerMessage: rule.blockerMessage,
      isActive: rule.isActive,
      questionIds: rule.ruleQuestions.map((rq: any) => rq.questionId),
      thresholdValue: rule.thresholdValue
    }));
  }

  /**
   * Evaluate a single must-pass rule for an assessment
   */
  private static async evaluateRule(
    assessmentId: string, 
    rule: MustPassRuleConfig
  ): Promise<{
    passed: boolean;
    failedQuestions: {
      questionId: string;
      questionText: string;
      userAnswer: string;
      requirementNotMet: string;
    }[];
  }> {
    if (rule.questionIds.length === 0) {
      return { passed: true, failedQuestions: [] };
    }

    const assessmentAnswers = await db.query.answers.findMany({
      where: and(
        eq(answers.assessmentId, assessmentId),
        inArray(answers.questionId, rule.questionIds)
      ),
      with: {
        question: true
      }
    });

    const failedQuestions: {
      questionId: string;
      questionText: string;
      userAnswer: string;
      requirementNotMet: string;
    }[] = [];

    const requiredScore = rule.thresholdValue ?? 80;

    for (const answer of assessmentAnswers) {
      const score = this.calculateAnswerScore(answer.value);
      
      if (score < requiredScore) {
        const questionObj = Array.isArray(answer.question) ? answer.question[0] : answer.question;
        failedQuestions.push({
          questionId: answer.questionId,
          questionText: questionObj?.text || 'Unknown question',
          userAnswer: this.formatResponse(answer.value),
          requirementNotMet: `Score ${score} is below required ${requiredScore}`
        });
      }
    }

    for (const questionId of rule.questionIds) {
      const answered = assessmentAnswers.some(a => a.questionId === questionId);
      if (!answered) {
        const question = await db.query.questions.findFirst({
          where: eq(questions.id, questionId)
        });
        
        failedQuestions.push({
          questionId,
          questionText: question?.text || 'Unknown question',
          userAnswer: 'Not answered',
          requirementNotMet: 'Question not answered'
        });
      }
    }

    return {
      passed: failedQuestions.length === 0,
      failedQuestions
    };
  }

  /**
   * Calculate score for an answer response
   * Maps response values to numeric scores
   */
  private static calculateAnswerScore(response: any): number {
    if (response === null || response === undefined) {
      return 0;
    }

    if (typeof response === 'number') {
      return response;
    }

    if (typeof response === 'string') {
      const normalized = response.toLowerCase().trim();
      
      const scoreMap: { [key: string]: number } = {
        'yes': 100,
        'no': 0,
        'fully implemented': 100,
        'partially implemented': 50,
        'not implemented': 0,
        'compliant': 100,
        'partially compliant': 50,
        'non-compliant': 0,
        'n/a': 100
      };

      return scoreMap[normalized] ?? 0;
    }

    if (typeof response === 'boolean') {
      return response ? 100 : 0;
    }

    return 0;
  }

  /**
   * Format response for display
   */
  private static formatResponse(response: any): string {
    if (response === null || response === undefined) {
      return 'No response';
    }

    if (typeof response === 'object') {
      return JSON.stringify(response);
    }

    return String(response);
  }

  /**
   * Update assessment with critical gate results
   */
  static async updateAssessmentWithResults(
    assessmentId: string, 
    result: CriticalGateResult
  ): Promise<void> {
    await db.update(assessments)
      .set({
        criticalBlockers: result.criticalBlockers.length > 0 
          ? result.criticalBlockers 
          : null,
        criticalBlockersCount: result.failedRules.length,
        readinessClassification: result.passed ? 'READY' : 'BLOCKED'
      })
      .where(eq(assessments.id, assessmentId));
  }

  /**
   * Check if a specific question is a must-pass question
   */
  static async isMustPassQuestion(questionId: string): Promise<boolean> {
    const result = await db.query.mustPassRuleQuestions.findFirst({
      where: eq(mustPassRuleQuestions.questionId, questionId),
      with: {
        rule: true
      }
    });

    if (!result) {
      return false;
    }

    const ruleObj = Array.isArray(result.rule) ? result.rule[0] : result.rule;
    return ruleObj?.isActive ?? false;
  }

  /**
   * Get all must-pass questions for an assessment
   */
  static async getMustPassQuestionsForAssessment(assessmentId: string): Promise<string[]> {
    const assessment = await db.query.assessments.findFirst({
      where: eq(assessments.id, assessmentId)
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const activeRules = await this.getActiveMustPassRules();
    const allMustPassQuestionIds = new Set<string>();

    for (const rule of activeRules) {
      for (const questionId of rule.questionIds) {
        allMustPassQuestionIds.add(questionId);
      }
    }

    return Array.from(allMustPassQuestionIds);
  }
}
