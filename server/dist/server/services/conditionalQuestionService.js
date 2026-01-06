import { db } from '../db';
import { intakeAnswers, intakeForms } from '../../shared/schema';
import { eq } from 'drizzle-orm';
/**
 * Advanced Conditional Question Service for Phase 4
 * Handles complex question logic, dependencies, and smart workflows
 */
export class ConditionalQuestionService {
    static CONDITIONAL_RULES = [
        // Data destruction conditional flow
        {
            id: 'data-destruction-flow',
            triggeredBy: 'processing-activities',
            condition: 'includes',
            value: 'Data Destruction',
            action: 'show',
            targetQuestions: [
                'data-sanitization-methods',
                'nist-compliance-procedures',
                'certificate-generation',
                'security-clearance-requirements'
            ],
            priority: 1
        },
        // Multi-facility complexity
        {
            id: 'multi-facility-management',
            triggeredBy: 'total-facilities',
            condition: '>',
            value: 1,
            action: 'show',
            targetQuestions: [
                'facility-coordination-procedures',
                'centralized-management-system',
                'inter-facility-transportation',
                'consistency-monitoring'
            ],
            priority: 1
        },
        // International operations
        {
            id: 'international-compliance',
            triggeredBy: 'international-shipments',
            condition: '==',
            value: true,
            action: 'show',
            targetQuestions: [
                'export-license-management',
                'international-vendor-verification',
                'customs-documentation',
                'cross-border-tracking'
            ],
            priority: 1
        },
        // Refurbishment workflow
        {
            id: 'refurbishment-quality',
            triggeredBy: 'processing-activities',
            condition: 'includes',
            value: 'Refurbishment',
            action: 'show',
            targetQuestions: [
                'testing-equipment-calibration',
                'quality-assurance-procedures',
                'warranty-management',
                'customer-data-handling'
            ],
            priority: 2
        },
        // Focus materials handling
        {
            id: 'focus-materials-safety',
            triggeredBy: 'focus-materials',
            condition: '!=',
            value: [],
            action: 'require',
            targetQuestions: [
                'hazardous-material-training',
                'safety-equipment-procedures',
                'containment-protocols',
                'disposal-documentation'
            ],
            priority: 1
        },
        // Campus/Group certification complexity
        {
            id: 'complex-certification-structure',
            triggeredBy: 'certification-structure-type',
            condition: 'includes',
            value: ['CAMPUS', 'GROUP'],
            action: 'show',
            targetQuestions: [
                'management-representative-coordination',
                'document-control-across-sites',
                'audit-scheduling-coordination',
                'corrective-action-propagation'
            ],
            priority: 1
        }
    ];
    static QUESTION_DEPENDENCIES = [
        // Data destruction dependency chain
        {
            questionId: 'nist-compliance-procedures',
            dependsOn: ['data-sanitization-methods'],
            logic: 'AND',
            conditions: [
                { field: 'data-sanitization-methods', operator: '!=', value: null }
            ]
        },
        // Multi-facility coordination chain
        {
            questionId: 'inter-facility-transportation',
            dependsOn: ['facility-coordination-procedures', 'total-facilities'],
            logic: 'AND',
            conditions: [
                { field: 'facility-coordination-procedures', operator: '!=', value: null },
                { field: 'total-facilities', operator: '>', value: 2 }
            ]
        },
        // International compliance chain
        {
            questionId: 'customs-documentation',
            dependsOn: ['export-license-management', 'international-vendor-verification'],
            logic: 'AND',
            conditions: [
                { field: 'export-license-management', operator: '!=', value: null },
                { field: 'international-vendor-verification', operator: '!=', value: null }
            ]
        },
        // Quality assurance chain
        {
            questionId: 'warranty-management',
            dependsOn: ['testing-equipment-calibration', 'quality-assurance-procedures'],
            logic: 'AND',
            conditions: [
                { field: 'testing-equipment-calibration', operator: '!=', value: null },
                { field: 'quality-assurance-procedures', operator: '!=', value: null }
            ]
        }
    ];
    /**
     * Evaluate conditional rules for an intake form
     */
    static async evaluateConditionalRules(intakeFormId) {
        try {
            // Get intake form answers
            const intakeAnswersList = await db
                .select()
                .from(intakeAnswers)
                .where(eq(intakeAnswers.intakeFormId, intakeFormId));
            const answerMap = new Map(intakeAnswersList.map((answer) => [answer.intakeQuestionId, answer.value]));
            const visibleQuestions = new Set();
            const requiredQuestions = new Set();
            const hiddenQuestions = new Set();
            const recommendations = [];
            // Process each conditional rule
            for (const rule of this.CONDITIONAL_RULES) {
                const triggerValue = answerMap.get(rule.triggeredBy);
                if (this.evaluateCondition(triggerValue, rule.condition, rule.value)) {
                    switch (rule.action) {
                        case 'show':
                            rule.targetQuestions.forEach(q => visibleQuestions.add(q));
                            recommendations.push(`Showing ${rule.targetQuestions.length} questions for ${rule.triggeredBy}`);
                            break;
                        case 'require':
                            rule.targetQuestions.forEach(q => {
                                visibleQuestions.add(q);
                                requiredQuestions.add(q);
                            });
                            recommendations.push(`Required questions activated for ${rule.triggeredBy}`);
                            break;
                        case 'hide':
                            rule.targetQuestions.forEach(q => hiddenQuestions.add(q));
                            break;
                    }
                }
            }
            // Apply question dependencies
            const dependencyResults = await this.evaluateQuestionDependencies(Array.from(visibleQuestions), answerMap);
            dependencyResults.forEach(q => visibleQuestions.add(q));
            return {
                visibleQuestions: Array.from(visibleQuestions),
                requiredQuestions: Array.from(requiredQuestions),
                hiddenQuestions: Array.from(hiddenQuestions),
                recommendations
            };
        }
        catch (error) {
            console.error('Error evaluating conditional rules:', error);
            throw error;
        }
    }
    /**
     * Evaluate question dependencies based on current answers
     */
    static async evaluateQuestionDependencies(baseQuestions, answerMap) {
        const dependentQuestions = [];
        for (const dependency of this.QUESTION_DEPENDENCIES) {
            // Check if this dependency's target is in our base questions
            if (!baseQuestions.includes(dependency.questionId))
                continue;
            // Check if all dependencies are satisfied
            const dependenciesSatisfied = dependency.dependsOn.every(dep => answerMap.has(dep) && answerMap.get(dep) !== null);
            if (!dependenciesSatisfied)
                continue;
            // Evaluate conditions
            let conditionsMet = false;
            if (dependency.logic === 'AND') {
                conditionsMet = dependency.conditions.every(condition => this.evaluateCondition(answerMap.get(condition.field), condition.operator, condition.value));
            }
            else {
                conditionsMet = dependency.conditions.some(condition => this.evaluateCondition(answerMap.get(condition.field), condition.operator, condition.value));
            }
            if (conditionsMet) {
                dependentQuestions.push(dependency.questionId);
            }
        }
        return dependentQuestions;
    }
    /**
     * Generate smart question recommendations based on intake patterns
     */
    static async generateSmartRecommendations(intakeFormId) {
        try {
            const intakeForm = await db.query.intakeForms.findFirst({
                where: eq(intakeForms.id, intakeFormId)
            });
            if (!intakeForm) {
                throw new Error('Intake form not found');
            }
            const criticalQuestions = [];
            const suggestedQuestions = [];
            const optionalQuestions = [];
            const reasoning = {};
            // Analyze business complexity
            const facilityCount = parseInt(intakeForm.totalFacilities || '1');
            const hasDataDestruction = intakeForm.processingActivities?.includes('Data Destruction');
            const hasInternational = intakeForm.internationalShipments;
            const hasRefurbishment = intakeForm.processingActivities?.includes('Refurbishment');
            // Critical questions based on high-risk activities
            if (hasDataDestruction) {
                criticalQuestions.push('data-sanitization-methods', 'nist-compliance-procedures', 'security-clearance-requirements');
                reasoning['data-destruction'] = 'Data destruction requires strict compliance protocols';
            }
            if (facilityCount > 1) {
                criticalQuestions.push('facility-coordination-procedures', 'centralized-management-system');
                reasoning['multi-facility'] = 'Multiple facilities require coordination oversight';
            }
            // Suggested questions for operational excellence
            if (hasRefurbishment) {
                suggestedQuestions.push('testing-equipment-calibration', 'quality-assurance-procedures', 'warranty-management');
                reasoning['refurbishment'] = 'Refurbishment benefits from quality assurance protocols';
            }
            if (hasInternational) {
                suggestedQuestions.push('export-license-management', 'international-vendor-verification', 'customs-documentation');
                reasoning['international'] = 'International operations require compliance documentation';
            }
            // Optional questions for optimization
            if (facilityCount >= 3) {
                optionalQuestions.push('consistency-monitoring', 'audit-scheduling-coordination');
                reasoning['optimization'] = 'Large operations benefit from advanced monitoring';
            }
            return {
                criticalQuestions,
                suggestedQuestions,
                optionalQuestions,
                reasoning
            };
        }
        catch (error) {
            console.error('Error generating smart recommendations:', error);
            throw error;
        }
    }
    /**
     * Create branching workflow paths based on intake responses
     */
    static async createBranchingWorkflow(intakeFormId) {
        try {
            const intakeForm = await db.query.intakeForms.findFirst({
                where: eq(intakeForms.id, intakeFormId)
            });
            if (!intakeForm) {
                throw new Error('Intake form not found');
            }
            const workflows = [];
            let recommendedPath = 'standard';
            // Determine workflow complexity
            const facilityCount = parseInt(intakeForm.totalFacilities || '1');
            const activityCount = intakeForm.processingActivities?.length || 0;
            const hasHighRisk = intakeForm.processingActivities?.includes('Data Destruction') ||
                intakeForm.internationalShipments;
            // Standard workflow
            workflows.push({
                name: 'standard',
                description: 'Standard R2v3 assessment workflow',
                steps: [
                    'Legal and operational foundations',
                    'Core requirements evaluation',
                    'Processing activity assessment',
                    'Documentation review',
                    'Final compliance check'
                ],
                estimatedTime: 2,
                complexity: 'LOW'
            });
            // Enhanced workflow for complex operations
            if (facilityCount > 1 || activityCount > 3) {
                workflows.push({
                    name: 'enhanced',
                    description: 'Enhanced workflow for complex operations',
                    steps: [
                        'Legal and operational foundations',
                        'Multi-facility coordination review',
                        'Core requirements evaluation',
                        'Advanced processing assessment',
                        'Risk management evaluation',
                        'Documentation review',
                        'Cross-facility consistency check',
                        'Final compliance verification'
                    ],
                    estimatedTime: 4,
                    complexity: 'MEDIUM'
                });
                recommendedPath = 'enhanced';
            }
            // Comprehensive workflow for high-risk operations
            if (hasHighRisk) {
                workflows.push({
                    name: 'comprehensive',
                    description: 'Comprehensive workflow for high-risk operations',
                    steps: [
                        'Legal and operational foundations',
                        'Security clearance verification',
                        'Multi-facility coordination review',
                        'Core requirements evaluation',
                        'Data security assessment',
                        'International compliance check',
                        'Advanced processing assessment',
                        'Risk management evaluation',
                        'Vendor management review',
                        'Documentation review',
                        'Security protocol validation',
                        'Cross-facility consistency check',
                        'Final compliance verification'
                    ],
                    estimatedTime: 6,
                    complexity: 'HIGH'
                });
                recommendedPath = 'comprehensive';
            }
            return {
                workflows,
                recommendedPath
            };
        }
        catch (error) {
            console.error('Error creating branching workflow:', error);
            throw error;
        }
    }
    /**
     * Evaluate a single condition
     */
    static evaluateCondition(value, operator, expected) {
        switch (operator) {
            case '==':
                return value === expected;
            case '!=':
                return value !== expected;
            case '>':
                return Number(value) > Number(expected);
            case '<':
                return Number(value) < Number(expected);
            case 'includes':
                if (Array.isArray(value)) {
                    return Array.isArray(expected)
                        ? expected.some(exp => value.includes(exp))
                        : value.includes(expected);
                }
                return String(value).includes(String(expected));
            case 'excludes':
                if (Array.isArray(value)) {
                    return Array.isArray(expected)
                        ? !expected.some(exp => value.includes(exp))
                        : !value.includes(expected);
                }
                return !String(value).includes(String(expected));
            default:
                return false;
        }
    }
}
