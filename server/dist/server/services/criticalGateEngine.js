import { db } from '../db';
import { mustPassRules, mustPassRuleQuestions, questions, answers, assessments } from '../../shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { mustPassRuleCache, questionCache } from './dataCache';
export class CriticalGateEngine {
    /**
     * OPTIMIZATION: Batch fetch all answers for assessment upfront to avoid N+1
     * Previously: evaluateRule would query answers for each rule separately
     * Now: Single query fetches all assessment answers, then filter by rule in memory
     * Reduces queries from O(N rules) to O(1)
     */
    static async evaluateAssessment(assessmentId) {
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
        // OPTIMIZATION: Fetch all answers once with questions joined
        // Instead of fetching per-rule in evaluateRule loop
        const allAnswers = await db.query.answers.findMany({
            where: eq(answers.assessmentId, assessmentId),
            with: {
                question: true
            }
        });
        const failedRules = [];
        const criticalBlockers = [];
        for (const rule of activeRules) {
            const ruleResult = await this.evaluateRule(assessmentId, rule, allAnswers);
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
     * OPTIMIZATION: Batch fetch all rules + rule-questions + questions in single query
     * CACHE INTEGRATION: Implements cache-aside pattern for must-pass rules
     * Previously: Would fetch rules, then loop through each rule's questions
     * Now: Check cache first, then single query with nested JOINs gets everything at once
     * Eliminates N+1 queries when loading rule configurations
     */
    static async getActiveMustPassRules() {
        const cacheKey = 'mustpass:all';
        // Check cache first
        const cached = mustPassRuleCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        // Cache miss - fetch from database
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
        const result = rules.map(rule => ({
            id: rule.id,
            ruleName: rule.ruleName,
            ruleCode: rule.ruleCode,
            description: rule.description,
            ruleType: rule.ruleType,
            blockerSeverity: rule.blockerSeverity,
            blockerMessage: rule.blockerMessage,
            isActive: rule.isActive,
            questionIds: rule.ruleQuestions.map((rq) => rq.questionId),
            thresholdValue: rule.thresholdValue
        }));
        // Populate cache with fetched data
        mustPassRuleCache.set(cacheKey, result);
        return result;
    }
    /**
     * OPTIMIZATION: Accepts pre-fetched answers to avoid database query per rule
     * Filters answers in-memory instead of querying database
     * For missing questions, uses pre-loaded question data from rule config
     */
    static async evaluateRule(assessmentId, rule, allAnswers) {
        if (rule.questionIds.length === 0) {
            return { passed: true, failedQuestions: [] };
        }
        // OPTIMIZATION: Filter pre-fetched answers in memory instead of querying DB
        const assessmentAnswers = allAnswers.filter(a => rule.questionIds.includes(a.questionId));
        const failedQuestions = [];
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
        // OPTIMIZATION: Batch fetch unanswered questions using IN clause
        // CACHE INTEGRATION: Check cache for each question before database query
        const answeredQuestionIds = new Set(assessmentAnswers.map(a => a.questionId));
        const unansweredQuestionIds = rule.questionIds.filter(qId => !answeredQuestionIds.has(qId));
        if (unansweredQuestionIds.length > 0) {
            // Try to fetch from cache first
            const uncachedQuestionIds = [];
            const cachedQuestions = [];
            for (const questionId of unansweredQuestionIds) {
                const cacheKey = `question:${questionId}`;
                const cached = questionCache.get(cacheKey);
                if (cached) {
                    cachedQuestions.push(cached);
                }
                else {
                    uncachedQuestionIds.push(questionId);
                }
            }
            // Batch query for uncached questions only
            if (uncachedQuestionIds.length > 0) {
                const dbQuestions = await db.query.questions.findMany({
                    where: inArray(questions.id, uncachedQuestionIds)
                });
                // Populate cache with fetched questions
                for (const question of dbQuestions) {
                    const cacheKey = `question:${question.id}`;
                    questionCache.set(cacheKey, question);
                    cachedQuestions.push(question);
                }
            }
            // Process all unanswered questions (from cache and DB)
            for (const question of cachedQuestions) {
                failedQuestions.push({
                    questionId: question.id,
                    questionText: question.text || 'Unknown question',
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
    static calculateAnswerScore(response) {
        if (response === null || response === undefined) {
            return 0;
        }
        if (typeof response === 'number') {
            return response;
        }
        if (typeof response === 'string') {
            const normalized = response.toLowerCase().trim();
            const scoreMap = {
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
    static formatResponse(response) {
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
    static async updateAssessmentWithResults(assessmentId, result) {
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
    static async isMustPassQuestion(questionId) {
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
    static async getMustPassQuestionsForAssessment(assessmentId) {
        const assessment = await db.query.assessments.findFirst({
            where: eq(assessments.id, assessmentId)
        });
        if (!assessment) {
            throw new Error('Assessment not found');
        }
        const activeRules = await this.getActiveMustPassRules();
        const allMustPassQuestionIds = new Set();
        for (const rule of activeRules) {
            for (const questionId of rule.questionIds) {
                allMustPassQuestionIds.add(questionId);
            }
        }
        return Array.from(allMustPassQuestionIds);
    }
}
