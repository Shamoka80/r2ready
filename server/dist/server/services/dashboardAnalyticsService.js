import { db } from '../db';
import { assessments, answers, questions, clauses, users, facilityProfiles, auditLog, licenses } from '@shared/schema';
import { eq, and, sql, lte, desc, count, isNotNull, inArray } from 'drizzle-orm';
/**
 * Dashboard Analytics Service
 * Provides comprehensive analytics and metrics for dashboard display
 */
export class DashboardAnalyticsService {
    /**
     * Get comprehensive KPIs for dashboard header
     */
    static async getDashboardKPIs(tenantId) {
        try {
            // Get assessment counts
            const [assessmentCounts] = await db
                .select({
                total: count(),
                inProgress: sql `count(*) FILTER (WHERE ${assessments.status} = 'IN_PROGRESS')`,
                completed: sql `count(*) FILTER (WHERE ${assessments.status} = 'COMPLETED')`,
                needsReview: sql `count(*) FILTER (WHERE ${assessments.status} = 'UNDER_REVIEW')`,
            })
                .from(assessments)
                .where(eq(assessments.tenantId, tenantId));
            // Get facility count
            const [facilityCount] = await db
                .select({ count: count() })
                .from(facilityProfiles)
                .where(eq(facilityProfiles.tenantId, tenantId));
            // Calculate average readiness from completed assessments
            const completedAssessments = await db
                .select({
                overallScore: assessments.overallScore,
            })
                .from(assessments)
                .where(and(eq(assessments.tenantId, tenantId), eq(assessments.status, 'COMPLETED'), isNotNull(assessments.overallScore)));
            const averageReadiness = completedAssessments.length > 0
                ? completedAssessments.reduce((sum, a) => sum + (a.overallScore || 0), 0) / completedAssessments.length
                : 0;
            const certificationReady = completedAssessments.filter(a => (a.overallScore || 0) >= 90).length;
            // Count critical gaps (answered "No" or "Partial" to critical questions)
            const criticalAnswers = await db
                .select({ count: count() })
                .from(answers)
                .innerJoin(assessments, eq(answers.assessmentId, assessments.id))
                .innerJoin(questions, eq(answers.questionId, questions.id))
                .where(and(eq(assessments.tenantId, tenantId), sql `${answers.value}::text IN ('No', 'Partial', 'Not Applicable')`));
            const criticalGapCount = criticalAnswers.length > 0 ? Number(criticalAnswers[0]?.count || 0) : 0;
            const kpis = {
                totalAssessments: Number(assessmentCounts?.total || 0),
                inProgress: Number(assessmentCounts?.inProgress || 0),
                completed: Number(assessmentCounts?.completed || 0),
                needsReview: Number(assessmentCounts?.needsReview || 0),
                averageReadiness: Math.round(averageReadiness),
                certificationReady,
                criticalGaps: Math.max(0, criticalGapCount),
                facilities: Number(facilityCount[0]?.count || 0),
            };
            console.log(`✅ Dashboard KPIs calculated for tenant ${tenantId}:`, kpis);
            return kpis;
        }
        catch (error) {
            console.error('Error getting dashboard KPIs:', error);
            throw error;
        }
    }
    /**
     * Get readiness snapshot for visual display
     */
    static async getReadinessSnapshot(tenantId, assessmentId) {
        try {
            let targetAssessmentId = assessmentId;
            // If no assessment specified, get the most recent completed one
            if (!targetAssessmentId) {
                const [latestAssessment] = await db
                    .select({ id: assessments.id })
                    .from(assessments)
                    .where(and(eq(assessments.tenantId, tenantId), eq(assessments.status, 'COMPLETED')))
                    .orderBy(desc(assessments.completedAt))
                    .limit(1);
                if (!latestAssessment) {
                    // Return default empty snapshot if no assessments
                    return this.getDefaultReadinessSnapshot();
                }
                targetAssessmentId = latestAssessment.id;
            }
            // Get assessment with scores
            const [assessment] = await db
                .select()
                .from(assessments)
                .where(eq(assessments.id, targetAssessmentId));
            if (!assessment) {
                return this.getDefaultReadinessSnapshot();
            }
            // Calculate scores by core requirement and appendix
            const coreScores = await this.calculateCoreRequirementScores(targetAssessmentId);
            const appendixScores = await this.calculateAppendixScores(targetAssessmentId);
            const gapBreakdown = await this.calculateGapBreakdown(targetAssessmentId);
            const overallScore = assessment.overallScore || 0;
            const readinessLevel = this.determineReadinessLevel(overallScore);
            return {
                overallScore,
                readinessLevel,
                coreRequirements: coreScores,
                appendices: appendixScores,
                gapBreakdown,
            };
        }
        catch (error) {
            console.error('Error getting readiness snapshot:', error);
            return this.getDefaultReadinessSnapshot();
        }
    }
    /**
     * Get gap analysis with prioritized recommendations
     */
    static async getGapAnalysis(tenantId, assessmentId) {
        try {
            // Get all non-compliant answers
            const gaps = await db
                .select({
                questionId: questions.id,
                questionText: questions.text,
                clauseRef: clauses.clauseRef,
                answerValue: answers.value,
                notes: answers.notes,
            })
                .from(answers)
                .innerJoin(questions, eq(answers.questionId, questions.id))
                .innerJoin(clauses, eq(questions.clauseId, clauses.id))
                .innerJoin(assessments, eq(answers.assessmentId, assessments.id))
                .where(and(eq(assessments.tenantId, tenantId), eq(answers.assessmentId, assessmentId), sql `${answers.value}::text IN ('No', 'Partial')`))
                .limit(50);
            const criticalGaps = gaps.map(gap => ({
                requirementId: gap.clauseRef || gap.questionId,
                requirementName: gap.questionText,
                currentStatus: String(gap.answerValue),
                severity: this.determineSeverity(gap.clauseRef || ''),
                recommendation: this.generateRecommendation(gap.questionText, String(gap.answerValue)),
                estimatedEffort: this.estimateEffort(gap.clauseRef || ''),
            }));
            // Generate prioritized actions
            const prioritizedActions = this.generatePrioritizedActions(criticalGaps);
            return {
                criticalGaps,
                prioritizedActions,
            };
        }
        catch (error) {
            console.error('Error getting gap analysis:', error);
            return { criticalGaps: [], prioritizedActions: [] };
        }
    }
    /**
     * Get activity feed events
     */
    static async getActivityFeed(tenantId, limit = 20) {
        try {
            const activities = [];
            // Get recent audit log entries
            const auditEntries = await db
                .select({
                id: auditLog.id,
                action: auditLog.action,
                resource: auditLog.resource,
                userId: auditLog.userId,
                timestamp: auditLog.timestamp,
                metadata: auditLog.metadata,
            })
                .from(auditLog)
                .where(eq(auditLog.tenantId, tenantId))
                .orderBy(desc(auditLog.timestamp))
                .limit(limit);
            // Get user names for activities
            const userIds = auditEntries
                .map(e => e.userId)
                .filter((id) => id !== null);
            const userMap = new Map();
            if (userIds.length > 0) {
                const userRecords = await db
                    .select({
                    id: users.id,
                    firstName: users.firstName,
                    lastName: users.lastName,
                })
                    .from(users)
                    .where(inArray(users.id, userIds));
                userRecords.forEach(u => {
                    userMap.set(u.id, `${u.firstName} ${u.lastName}`);
                });
            }
            // Transform audit entries to activity events
            auditEntries.forEach(entry => {
                const userName = entry.userId ? userMap.get(entry.userId) : undefined;
                activities.push({
                    id: entry.id,
                    type: this.mapActionToActivityType(entry.action),
                    description: this.generateActivityDescription(entry.action, entry.resource, userName),
                    userId: entry.userId || undefined,
                    userName,
                    timestamp: entry.timestamp,
                    metadata: entry.metadata || undefined,
                });
            });
            return activities;
        }
        catch (error) {
            console.error('Error getting activity feed:', error);
            return [];
        }
    }
    /**
     * Get upcoming deadlines
     */
    static async getUpcomingDeadlines(tenantId) {
        try {
            const deadlines = [];
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            // Get in-progress assessments as potential deadlines
            const inProgressAssessments = await db
                .select({
                id: assessments.id,
                title: assessments.title,
                createdAt: assessments.createdAt,
                updatedAt: assessments.updatedAt,
            })
                .from(assessments)
                .where(and(eq(assessments.tenantId, tenantId), eq(assessments.status, 'IN_PROGRESS')));
            inProgressAssessments.forEach(assessment => {
                // Estimate due date as 30 days from creation if not updated recently
                const estimatedDueDate = new Date(assessment.createdAt);
                estimatedDueDate.setDate(estimatedDueDate.getDate() + 30);
                if (estimatedDueDate <= thirtyDaysFromNow) {
                    const daysUntilDue = Math.ceil((estimatedDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    deadlines.push({
                        id: assessment.id,
                        title: `Complete assessment: ${assessment.title}`,
                        type: 'assessment',
                        dueDate: estimatedDueDate,
                        priority: daysUntilDue <= 7 ? 'high' : daysUntilDue <= 14 ? 'medium' : 'low',
                        status: daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 7 ? 'due_soon' : 'upcoming',
                        relatedEntity: assessment.title,
                    });
                }
            });
            // Get license expiration deadlines
            const expiringLicenses = await db
                .select({
                id: licenses.id,
                planName: licenses.planName,
                expiresAt: licenses.expiresAt,
            })
                .from(licenses)
                .where(and(eq(licenses.tenantId, tenantId), eq(licenses.isActive, true), isNotNull(licenses.expiresAt), lte(licenses.expiresAt, thirtyDaysFromNow)));
            expiringLicenses.forEach(license => {
                if (license.expiresAt) {
                    const daysUntilExpiry = Math.ceil((license.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    deadlines.push({
                        id: license.id,
                        title: `Renew license: ${license.planName}`,
                        type: 'license_renewal',
                        dueDate: license.expiresAt,
                        priority: daysUntilExpiry <= 7 ? 'high' : 'medium',
                        status: daysUntilExpiry < 0 ? 'overdue' : daysUntilExpiry <= 7 ? 'due_soon' : 'upcoming',
                        relatedEntity: license.planName,
                    });
                }
            });
            // Sort by due date
            deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
            return deadlines;
        }
        catch (error) {
            console.error('Error getting upcoming deadlines:', error);
            return [];
        }
    }
    // Helper methods
    static async calculateCoreRequirementScores(assessmentId) {
        const scores = {
            cr1: 0, cr2: 0, cr3: 0, cr4: 0, cr5: 0,
            cr6: 0, cr7: 0, cr8: 0, cr9: 0, cr10: 0,
        };
        try {
            // Get all answers with clause references
            const answersWithClauses = await db
                .select({
                clauseRef: clauses.clauseRef,
                answerValue: answers.value,
                questionId: questions.id,
            })
                .from(answers)
                .innerJoin(questions, eq(answers.questionId, questions.id))
                .innerJoin(clauses, eq(questions.clauseId, clauses.id))
                .where(eq(answers.assessmentId, assessmentId));
            // Count answers per core requirement
            const crCounts = new Map();
            answersWithClauses.forEach(({ clauseRef, answerValue }) => {
                const crMatch = clauseRef?.match(/CR(\d+)/);
                if (crMatch) {
                    const crKey = `cr${crMatch[1]}`;
                    if (!crCounts.has(crKey)) {
                        crCounts.set(crKey, { total: 0, score: 0 });
                    }
                    const crData = crCounts.get(crKey);
                    crData.total++;
                    // Scoring: Yes=100, Partial=50, No=0, N/A=0
                    const answerScore = answerValue === 'Yes' ? 100 :
                        answerValue === 'Partial' ? 50 : 0;
                    crData.score += answerScore;
                }
            });
            // Calculate averages for each core requirement
            crCounts.forEach((data, crKey) => {
                if (crKey in scores) {
                    scores[crKey] = data.total > 0 ?
                        Math.round(data.score / data.total) : 0;
                }
            });
            console.log(`✅ Core requirement scores calculated for assessment ${assessmentId}`);
            return scores;
        }
        catch (error) {
            console.error(`❌ Error calculating core requirement scores: ${error}`);
            return scores; // Return zeros on error
        }
    }
    static async calculateAppendixScores(assessmentId) {
        // Similar to CR scoring but for appendices
        return {
            appA: 0, appB: 0, appC: 0, appD: 0,
            appE: 0, appF: 0, appG: 0,
        };
    }
    static async calculateGapBreakdown(assessmentId) {
        const gaps = await db
            .select({
            answerValue: answers.value,
            clauseRef: clauses.clauseRef,
        })
            .from(answers)
            .innerJoin(questions, eq(answers.questionId, questions.id))
            .innerJoin(clauses, eq(questions.clauseId, clauses.id))
            .where(and(eq(answers.assessmentId, assessmentId), sql `${answers.value}::text IN ('No', 'Partial')`));
        let critical = 0;
        let important = 0;
        let minor = 0;
        gaps.forEach(gap => {
            const severity = this.determineSeverity(gap.clauseRef || '');
            if (severity === 'critical')
                critical++;
            else if (severity === 'important')
                important++;
            else
                minor++;
        });
        return { critical, important, minor };
    }
    static determineSeverity(clauseRef) {
        // Core requirements are critical, appendices are important/minor
        if (clauseRef.includes('CR'))
            return 'critical';
        if (clauseRef.includes('App'))
            return 'important';
        return 'minor';
    }
    static generateRecommendation(questionText, answerValue) {
        if (answerValue === 'No') {
            return `Implement controls to address: ${questionText.substring(0, 100)}...`;
        }
        return `Strengthen existing controls for: ${questionText.substring(0, 100)}...`;
    }
    static estimateEffort(clauseRef) {
        // Simplified effort estimation
        if (clauseRef.includes('CR1') || clauseRef.includes('CR2'))
            return '2-4 weeks';
        if (clauseRef.includes('CR'))
            return '1-2 weeks';
        return '1-5 days';
    }
    static generatePrioritizedActions(gaps) {
        return gaps.slice(0, 10).map((gap, index) => ({
            action: `Address ${gap.requirementName.substring(0, 80)}...`,
            impact: gap.severity === 'critical' ? 'high' : gap.severity === 'important' ? 'medium' : 'low',
            effort: gap.estimatedEffort.includes('weeks') ? 'high' : 'medium',
            priority: index + 1,
        }));
    }
    static determineReadinessLevel(score) {
        if (score >= 90)
            return 'Certification Ready';
        if (score >= 75)
            return 'Approaching Ready';
        if (score >= 50)
            return 'Needs Work';
        return 'Not Ready';
    }
    static getDefaultReadinessSnapshot() {
        return {
            overallScore: 0,
            readinessLevel: 'Not Ready',
            coreRequirements: {
                cr1: 0, cr2: 0, cr3: 0, cr4: 0, cr5: 0,
                cr6: 0, cr7: 0, cr8: 0, cr9: 0, cr10: 0,
            },
            appendices: {
                appA: 0, appB: 0, appC: 0, appD: 0,
                appE: 0, appF: 0, appG: 0,
            },
            gapBreakdown: {
                critical: 0,
                important: 0,
                minor: 0,
            },
        };
    }
    static mapActionToActivityType(action) {
        if (action.includes('assessment') && action.includes('create'))
            return 'assessment_created';
        if (action.includes('assessment') && action.includes('complete'))
            return 'assessment_completed';
        if (action.includes('user') && action.includes('add'))
            return 'user_added';
        if (action.includes('report') || action.includes('export'))
            return 'report_exported';
        if (action.includes('facility'))
            return 'facility_added';
        if (action.includes('license'))
            return 'license_purchased';
        return 'assessment_created';
    }
    static generateActivityDescription(action, resource, userName) {
        const actor = userName || 'System';
        return `${actor} ${action} ${resource}`;
    }
    // --- New Helper Methods for Real Gap Analysis ---
    /**
     * Calculates real gap analysis data, including readiness score, critical gaps,
     * completion percentage, and compliance status.
     * This method replaces the mock data calculation.
     */
    static async calculateRealGapAnalysis(tenantId, facilityIds) {
        try {
            const { assessmentResults, totalQuestions } = await this.getAssessmentResultsForTenant(tenantId, facilityIds);
            if (assessmentResults.length === 0 || totalQuestions === 0) {
                return {
                    readinessScore: 0,
                    criticalGapCount: 0,
                    completionPercentage: 0,
                    complianceStatus: 'Non-Compliant',
                };
            }
            let totalScore = 0;
            let criticalGaps = 0;
            let compliantCount = 0;
            let partiallyCompliantCount = 0;
            assessmentResults.forEach(assessment => {
                assessment.questions.forEach(q => {
                    const answerScore = this.getScoreForAnswer(q.answerValue);
                    totalScore += answerScore;
                    if (answerScore === 0 && q.severity === 'critical') {
                        criticalGaps++;
                    }
                    if (answerScore === 100) {
                        compliantCount++;
                    }
                    else if (answerScore > 0) {
                        partiallyCompliantCount++;
                    }
                });
            });
            const averageScore = (totalScore / (assessmentResults.length * totalQuestions)) * 100;
            const readinessScore = Math.max(0, Math.min(100, averageScore));
            const completionPercentage = (compliantCount / (assessmentResults.length * totalQuestions)) * 100;
            let complianceStatus;
            if (criticalGaps === 0 && completionPercentage === 100) {
                complianceStatus = 'Compliant';
            }
            else if (criticalGaps > 0 || completionPercentage < 100) {
                complianceStatus = 'Non-Compliant';
            }
            else {
                complianceStatus = 'Partially Compliant';
            }
            return {
                readinessScore,
                criticalGapCount: criticalGaps,
                completionPercentage,
                complianceStatus,
            };
        }
        catch (error) {
            console.error('Error calculating real gap analysis:', error);
            // Return default values in case of error
            return {
                readinessScore: 0,
                criticalGapCount: 0,
                completionPercentage: 0,
                complianceStatus: 'Non-Compliant',
            };
        }
    }
    /**
     * Fetches assessment results for a given tenant and facility IDs.
     * Includes question details and answer values.
     */
    static async getAssessmentResultsForTenant(tenantId, facilityIds) {
        const assessmentsQuery = db
            .select({
            id: assessments.id,
            facilityId: assessments.facilityId,
        })
            .from(assessments)
            .where(and(eq(assessments.tenantId, tenantId), facilityIds.length > 0 ? inArray(assessments.facilityId, facilityIds) : undefined, eq(assessments.status, 'COMPLETED') // Only consider completed assessments
        ));
        const assessmentIds = (await assessmentsQuery).map(a => a.id);
        if (assessmentIds.length === 0) {
            return { assessmentResults: [], totalQuestions: 0 };
        }
        const questionsAndAnswers = await db
            .select({
            assessmentId: answers.assessmentId,
            questionId: questions.id,
            questionText: questions.text,
            answerValue: answers.value,
            clauseRef: clauses.clauseRef,
        })
            .from(answers)
            .innerJoin(questions, eq(answers.questionId, questions.id))
            .innerJoin(clauses, eq(questions.clauseId, clauses.id))
            .where(inArray(answers.assessmentId, assessmentIds));
        const totalQuestions = await db
            .select({ count: count() })
            .from(questions)
            .innerJoin(clauses, eq(questions.clauseId, clauses.id))
            .where(sql `upper(clauses.clause_ref) LIKE 'CR%' OR upper(clauses.clause_ref) LIKE 'APP%'`); // Assuming CR and APP are the relevant question types
        const groupedResults = {};
        questionsAndAnswers.forEach(qa => {
            const { assessmentId, questionId, questionText, answerValue, clauseRef } = qa;
            const facilityId = assessmentsQuery.find((a) => a.id === assessmentId)?.facilityId;
            if (!groupedResults[assessmentId] && facilityId) {
                groupedResults[assessmentId] = {
                    assessmentId,
                    facilityId,
                    questions: [],
                };
            }
            if (groupedResults[assessmentId] && facilityId) {
                groupedResults[assessmentId].questions.push({
                    questionId,
                    text: questionText,
                    answerValue: answerValue,
                    severity: this.determineSeverity(clauseRef || ''),
                });
            }
        });
        return {
            assessmentResults: Object.values(groupedResults),
            totalQuestions: Number(totalQuestions[0]?.count || 0),
        };
    }
    /**
     * Assigns a score based on the answer value.
     * Yes: 100, Partial: 50, No/N/A/Null: 0
     */
    static getScoreForAnswer(answerValue) {
        switch (answerValue) {
            case 'Yes':
                return 100;
            case 'Partial':
                return 50;
            default: // 'No', 'Not Applicable', null, etc.
                return 0;
        }
    }
    // Placeholder methods for advanced analytics
    static async calculatePredictiveInsights(assessments, tenant) {
        // Mock implementation for predictive insights
        return {
            completionEstimate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            identifiedRisks: ['Data integrity issues', 'Inconsistent reporting'],
            actionableRecommendations: ['Implement data validation checks', 'Standardize reporting templates'],
            criticalPath: ['Report Export Engine', 'Analytics Dashboard']
        };
    }
    static async getBenchmarkComparisons(tenant) {
        // Mock implementation for benchmark comparisons
        return {
            industryPercentile: 75,
            peerAverageScore: 82,
            bestPracticeScore: 95
        };
    }
    static async calculateTrendAnalysis(assessments) {
        // Mock implementation for trend analysis
        return {
            trend: 'stable', // 'improving', 'declining', 'stable'
            velocityScore: 0.8, // Score from 0 to 1
            recentChange: '+2%'
        };
    }
}
export default DashboardAnalyticsService;
