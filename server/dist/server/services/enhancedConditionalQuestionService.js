import { db } from '../db';
import { conditionalRules, conditionalRuleTargets, questionDependencies, questions, intakeAnswers, assessments } from '../../shared/schema';
import { eq } from 'drizzle-orm';
export class EnhancedConditionalQuestionService {
    /**
     * Get all active conditional rules from database
     */
    static async getActiveConditionalRules() {
        const rules = await db.query.conditionalRules.findMany({
            where: eq(conditionalRules.isActive, true),
            with: {
                ruleTargets: {
                    with: {
                        question: true
                    }
                }
            },
            orderBy: (conditionalRules, { asc }) => [asc(conditionalRules.priority)]
        });
        return rules.map(rule => ({
            id: rule.id,
            ruleName: rule.ruleName,
            ruleCode: rule.ruleCode,
            triggerCondition: rule.triggerCondition,
            action: rule.action,
            targetQuestionIds: rule.ruleTargets.map((rt) => rt.questionId),
            priority: rule.priority,
            isActive: rule.isActive
        }));
    }
    /**
     * Get question dependencies from database
     */
    static async getQuestionDependencies(questionId) {
        const query = questionId
            ? db.query.questionDependencies.findMany({
                where: eq(questionDependencies.questionId, questionId)
            })
            : db.query.questionDependencies.findMany();
        const deps = await query;
        return deps.map(dep => ({
            questionId: dep.questionId,
            parentQuestionId: dep.parentQuestionId,
            dependencyType: dep.dependencyType,
            dependencyCondition: dep.dependencyCondition,
            isRequired: dep.isRequired
        }));
    }
    /**
     * Evaluate conditional rules for an assessment based on intake answers
     */
    static async evaluateConditionalRules(assessmentId) {
        const assessment = await db.query.assessments.findFirst({
            where: eq(assessments.id, assessmentId)
        });
        if (!assessment || !assessment.intakeFormId) {
            return this.createEmptyBranchingResult();
        }
        const intakeData = await db.query.intakeAnswers.findMany({
            where: eq(intakeAnswers.intakeFormId, assessment.intakeFormId)
        });
        const intakeMap = new Map();
        for (const answer of intakeData) {
            intakeMap.set(answer.fieldName, answer.value);
        }
        const activeRules = await this.getActiveConditionalRules();
        const result = {
            questionsToShow: [],
            questionsToHide: [],
            questionsToRequire: [],
            questionsToOptional: [],
            evaluationLog: []
        };
        for (const rule of activeRules) {
            const shouldTrigger = this.evaluateTriggerCondition(rule.triggerCondition, intakeMap);
            if (shouldTrigger) {
                result.evaluationLog.push(`Rule ${rule.ruleCode} triggered: ${rule.ruleName}`);
                switch (rule.action.toLowerCase()) {
                    case 'show':
                        result.questionsToShow.push(...rule.targetQuestionIds);
                        break;
                    case 'hide':
                        result.questionsToHide.push(...rule.targetQuestionIds);
                        break;
                    case 'require':
                        result.questionsToRequire.push(...rule.targetQuestionIds);
                        break;
                    case 'optional':
                        result.questionsToOptional.push(...rule.targetQuestionIds);
                        break;
                }
            }
        }
        result.questionsToShow = [...new Set(result.questionsToShow)];
        result.questionsToHide = [...new Set(result.questionsToHide)];
        result.questionsToRequire = [...new Set(result.questionsToRequire)];
        result.questionsToOptional = [...new Set(result.questionsToOptional)];
        return result;
    }
    /**
     * Evaluate a trigger condition against intake data
     */
    static evaluateTriggerCondition(condition, intakeData) {
        if (!condition || typeof condition !== 'object') {
            return false;
        }
        const { field, operator, value } = condition;
        if (!field || !operator) {
            return false;
        }
        const fieldValue = intakeData.get(field);
        switch (operator.toLowerCase()) {
            case '==':
            case 'equals':
                return fieldValue === value;
            case '!=':
            case 'not_equals':
                return fieldValue !== value;
            case '>':
            case 'greater_than':
                return Number(fieldValue) > Number(value);
            case '<':
            case 'less_than':
                return Number(fieldValue) < Number(value);
            case '>=':
            case 'greater_than_or_equal':
                return Number(fieldValue) >= Number(value);
            case '<=':
            case 'less_than_or_equal':
                return Number(fieldValue) <= Number(value);
            case 'includes':
            case 'contains':
                if (Array.isArray(fieldValue)) {
                    return fieldValue.includes(value);
                }
                if (typeof fieldValue === 'string') {
                    return fieldValue.includes(value);
                }
                return false;
            case 'excludes':
            case 'not_contains':
                if (Array.isArray(fieldValue)) {
                    return !fieldValue.includes(value);
                }
                if (typeof fieldValue === 'string') {
                    return !fieldValue.includes(value);
                }
                return true;
            case 'in':
                if (Array.isArray(value)) {
                    return value.includes(fieldValue);
                }
                return false;
            case 'not_in':
                if (Array.isArray(value)) {
                    return !value.includes(fieldValue);
                }
                return true;
            case 'is_empty':
                return !fieldValue || fieldValue === '' ||
                    (Array.isArray(fieldValue) && fieldValue.length === 0);
            case 'is_not_empty':
                return !!fieldValue &&
                    !(Array.isArray(fieldValue) && fieldValue.length === 0);
            default:
                return false;
        }
    }
    /**
     * Check if a question should be displayed based on its display condition
     */
    static async shouldDisplayQuestion(questionId, intakeData) {
        const question = await db.query.questions.findFirst({
            where: eq(questions.id, questionId)
        });
        if (!question) {
            return false;
        }
        if (!question.displayCondition) {
            return true;
        }
        return this.evaluateTriggerCondition(question.displayCondition, intakeData);
    }
    /**
     * Get all questions that should be displayed for an assessment
     */
    static async getApplicableQuestions(assessmentId, allQuestions) {
        const branchingResult = await this.evaluateConditionalRules(assessmentId);
        const applicableQuestions = new Set(allQuestions);
        for (const questionId of branchingResult.questionsToHide) {
            applicableQuestions.delete(questionId);
        }
        for (const questionId of branchingResult.questionsToShow) {
            applicableQuestions.add(questionId);
        }
        return Array.from(applicableQuestions);
    }
    /**
     * Check if a question has dependencies that are not met
     */
    static async checkQuestionDependencies(questionId, intakeData) {
        const dependencies = await this.getQuestionDependencies(questionId);
        if (dependencies.length === 0) {
            return { canDisplay: true, missingDependencies: [] };
        }
        const missingDependencies = [];
        for (const dep of dependencies) {
            if (dep.dependencyCondition) {
                const conditionMet = this.evaluateTriggerCondition(dep.dependencyCondition, intakeData);
                if (!conditionMet) {
                    missingDependencies.push(dep.parentQuestionId);
                }
            }
        }
        return {
            canDisplay: missingDependencies.length === 0,
            missingDependencies
        };
    }
    /**
     * Create a new conditional rule in the database
     */
    static async createConditionalRule(rule, targetQuestionIds) {
        const result = await db.insert(conditionalRules)
            .values({
            ruleName: rule.ruleName,
            ruleCode: rule.ruleCode,
            triggerCondition: rule.triggerCondition,
            action: rule.action,
            priority: rule.priority,
            isActive: rule.isActive
        })
            .returning();
        const insertedRule = Array.isArray(result) ? result[0] : result;
        if (targetQuestionIds.length > 0) {
            await db.insert(conditionalRuleTargets)
                .values(targetQuestionIds.map(questionId => ({
                ruleId: insertedRule.id,
                questionId
            })));
        }
        return insertedRule.id;
    }
    /**
     * Create a question dependency relationship
     */
    static async createQuestionDependency(dependency) {
        await db.insert(questionDependencies)
            .values({
            questionId: dependency.questionId,
            parentQuestionId: dependency.parentQuestionId,
            dependencyType: dependency.dependencyType,
            dependencyCondition: dependency.dependencyCondition,
            isRequired: dependency.isRequired
        });
    }
    /**
     * Create empty branching result
     */
    static createEmptyBranchingResult() {
        return {
            questionsToShow: [],
            questionsToHide: [],
            questionsToRequire: [],
            questionsToOptional: [],
            evaluationLog: []
        };
    }
    /**
     * Get evaluation summary for an assessment
     */
    static async getEvaluationSummary(assessmentId) {
        const result = await this.evaluateConditionalRules(assessmentId);
        const allAffectedQuestions = new Set([
            ...result.questionsToShow,
            ...result.questionsToHide,
            ...result.questionsToRequire,
            ...result.questionsToOptional
        ]);
        const activeRules = await this.getActiveConditionalRules();
        return {
            totalRules: activeRules.length,
            triggeredRules: result.evaluationLog.length,
            affectedQuestions: allAffectedQuestions.size,
            evaluationLog: result.evaluationLog
        };
    }
}
