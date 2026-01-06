import { db } from '../db';
import { assessments, answers, questions, facilityProfiles, organizationProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import ObservabilityService from './observabilityService';
/**
 * Executive Summary Service
 * Generates comprehensive executive summaries for R2v3 assessments
 */
export class ExecutiveSummaryService {
    /**
     * Generate executive summary for assessment
     */
    static async generateExecutiveSummary(assessmentId) {
        try {
            // Get assessment data
            const assessmentData = await this.getAssessmentForSummary(assessmentId);
            if (!assessmentData) {
                throw new Error('Assessment not found');
            }
            // Calculate metrics
            const metrics = this.calculateSummaryMetrics(assessmentData.answers);
            // Generate narrative summary
            const summary = this.generateNarrativeSummary(assessmentData, metrics);
            // Extract key findings
            const keyFindings = this.extractKeyFindings(assessmentData.answers, metrics);
            // Assess business impact
            const businessImpact = this.assessBusinessImpact(metrics);
            // Generate strategic recommendations
            const recommendations = this.generateStrategicRecommendations(assessmentData.answers, metrics);
            // Define next steps
            const nextSteps = this.defineNextSteps(metrics);
            // Investment analysis
            const investmentAnalysis = this.generateInvestmentAnalysis(assessmentData.answers, metrics);
            // Timeline estimation
            const timeline = this.estimateProjectTimeline(metrics);
            await ObservabilityService.log('INFO', 'Executive summary generated', {
                service: 'executive-summary',
                operation: 'generateExecutiveSummary',
                metadata: {
                    assessmentId,
                    complianceRate: metrics.overallCompliance
                }
            });
            return {
                summary,
                keyFindings,
                businessImpact,
                recommendations,
                nextSteps,
                investmentAnalysis,
                timeline
            };
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'executive-summary',
                operation: 'generateExecutiveSummary',
                severity: 'high',
                metadata: { assessmentId }
            });
            throw error;
        }
    }
    /**
     * Get assessment data optimized for summary generation
     */
    static async getAssessmentForSummary(assessmentId) {
        const [assessment] = await db
            .select({
            id: assessments.id,
            title: assessments.title,
            status: assessments.status,
            createdAt: assessments.createdAt,
            completedAt: assessments.completedAt,
            facilityName: facilityProfiles.name,
            processingActivities: facilityProfiles.processingActivities,
            organizationName: organizationProfiles.legalName,
            organizationType: organizationProfiles.entityType
        })
            .from(assessments)
            .leftJoin(facilityProfiles, eq(assessments.facilityId, facilityProfiles.id))
            .leftJoin(organizationProfiles, eq(assessments.tenantId, organizationProfiles.tenantId))
            .where(eq(assessments.id, assessmentId));
        if (!assessment)
            return null;
        const assessmentAnswers = await db
            .select({
            value: answers.value,
            compliance: answers.compliance,
            score: answers.score,
            questionText: questions.text,
            questionCategory: questions.category,
            questionCategoryName: questions.categoryName,
            clauseId: questions.clauseId
        })
            .from(answers)
            .leftJoin(questions, eq(answers.questionId, questions.id))
            .where(eq(answers.assessmentId, assessmentId));
        return { ...assessment, answers: assessmentAnswers };
    }
    /**
     * Calculate comprehensive metrics for summary
     */
    static calculateSummaryMetrics(answers) {
        const total = answers.length;
        const compliant = answers.filter((a) => a.compliance === 'COMPLIANT').length;
        const nonCompliant = answers.filter((a) => a.compliance === 'NON_COMPLIANT').length;
        const criticalGaps = answers.filter((a) => a.questionCategory === 'critical' && a.compliance === 'NON_COMPLIANT').length;
        // Section analysis
        const sections = [...new Set(answers.map((a) => a.questionCategoryName || a.questionCategory).filter(Boolean))];
        const sectionPerformance = sections.map(section => {
            const sectionAnswers = answers.filter((a) => (a.questionCategoryName || a.questionCategory) === section);
            const sectionCompliant = sectionAnswers.filter((a) => a.compliance === 'COMPLIANT').length;
            return {
                section,
                compliance: Math.round((sectionCompliant / sectionAnswers.length) * 100),
                gaps: sectionAnswers.length - sectionCompliant
            };
        });
        return {
            total,
            compliant,
            overallCompliance: Math.round((compliant / total) * 100),
            highRisk: nonCompliant,
            criticalGaps,
            gaps: total - compliant,
            sectionPerformance,
            readinessLevel: this.determineReadinessLevel(compliant, total, nonCompliant, criticalGaps)
        };
    }
    /**
     * Generate narrative executive summary
     */
    static generateNarrativeSummary(assessment, metrics) {
        const facilityName = assessment.facilityName || 'the facility';
        const complianceRate = metrics.overallCompliance;
        const readinessLevel = metrics.readinessLevel;
        return `
Our comprehensive R2v3 pre-certification assessment of ${facilityName} has been completed, revealing a current compliance rate of ${complianceRate}%. 

The assessment evaluated ${metrics.total} requirements across all critical R2v3 domains, identifying ${metrics.gaps} areas requiring attention before certification audit. Of particular concern are ${metrics.highRisk} high-risk non-conformities and ${metrics.criticalGaps} critical gaps that demand immediate remediation.

Current certification readiness is assessed as "${readinessLevel}". The facility demonstrates strong foundational compliance practices, with notable strengths in several key areas. However, strategic investments in gap remediation will be essential to achieve certification readiness.

Based on industry benchmarks and certification body requirements, we estimate a ${this.estimateSuccessProbability(complianceRate)}% probability of successful certification following implementation of our recommended corrective action plan.
    `.trim();
    }
    /**
     * Extract key findings for executive attention
     */
    static extractKeyFindings(answers, metrics) {
        const findings = [];
        // Compliance status
        if (metrics.overallCompliance >= 90) {
            findings.push(`Excellent compliance foundation with ${metrics.overallCompliance}% conformity rate`);
        }
        else if (metrics.overallCompliance >= 75) {
            findings.push(`Solid compliance base with ${metrics.overallCompliance}% conformity, minor gaps identified`);
        }
        else {
            findings.push(`Significant compliance gaps identified - ${metrics.overallCompliance}% conformity requires strategic attention`);
        }
        // Critical gaps
        if (metrics.criticalGaps > 0) {
            findings.push(`${metrics.criticalGaps} critical non-conformities requiring immediate executive attention`);
        }
        // High-risk items
        if (metrics.highRisk > 0) {
            findings.push(`${metrics.highRisk} high-risk gaps pose potential certification barriers`);
        }
        // Section performance
        const poorSections = metrics.sectionPerformance.filter((s) => s.compliance < 70);
        if (poorSections.length > 0) {
            findings.push(`${poorSections.length} compliance domains require focused improvement initiatives`);
        }
        // Positive findings
        const strongSections = metrics.sectionPerformance.filter((s) => s.compliance >= 90);
        if (strongSections.length > 0) {
            findings.push(`${strongSections.length} compliance domains demonstrate exemplary performance`);
        }
        return findings.slice(0, 5); // Limit to top 5 findings
    }
    /**
     * Assess business impact of current compliance status
     */
    static assessBusinessImpact(metrics) {
        const compliance = metrics.overallCompliance;
        const criticalGaps = metrics.criticalGaps;
        const highRisk = metrics.highRisk;
        if (compliance >= 95 && criticalGaps === 0) {
            return 'MINIMAL BUSINESS RISK: Facility demonstrates strong compliance posture with minimal certification risk. Current operational practices align well with R2v3 requirements, suggesting low probability of compliance-related business disruption.';
        }
        if (compliance >= 85 && criticalGaps <= 2) {
            return 'LOW-MODERATE BUSINESS RISK: Facility shows good compliance foundation with manageable gaps. Strategic gap remediation will minimize certification risk and ensure business continuity. Investment in identified improvements will strengthen market position.';
        }
        if (compliance >= 70 && criticalGaps <= 5) {
            return 'MODERATE-HIGH BUSINESS RISK: Significant compliance gaps present certification challenges and potential operational risks. Immediate strategic investment required to address critical non-conformities and establish certification readiness.';
        }
        return 'HIGH BUSINESS RISK: Extensive compliance gaps create substantial certification risk and potential regulatory exposure. Comprehensive compliance initiative required with executive oversight to ensure business continuity and market access.';
    }
    /**
     * Generate strategic recommendations for leadership
     */
    static generateStrategicRecommendations(answers, metrics) {
        const recommendations = [];
        // Critical gaps
        if (metrics.criticalGaps > 0) {
            recommendations.push('Establish executive-level compliance steering committee to oversee critical gap remediation');
            recommendations.push('Allocate dedicated resources for immediate critical non-conformity resolution');
        }
        // High-risk items
        if (metrics.highRisk > 3) {
            recommendations.push('Engage certified R2v3 consultant for high-risk gap analysis and remediation planning');
        }
        // Overall compliance level
        if (metrics.overallCompliance < 80) {
            recommendations.push('Implement comprehensive compliance management system with regular monitoring');
            recommendations.push('Establish dedicated compliance role or team to drive certification preparation');
        }
        // Section-specific
        const weakSections = metrics.sectionPerformance.filter((s) => s.compliance < 60);
        if (weakSections.length > 0) {
            recommendations.push(`Focus immediate attention on ${weakSections.length} underperforming compliance domains`);
        }
        // Certification readiness
        if (metrics.readinessLevel !== 'Certification Ready') {
            recommendations.push('Schedule follow-up assessment in 8-12 weeks to validate gap remediation progress');
        }
        // Investment strategy
        recommendations.push('Develop phased investment approach prioritizing critical and high-risk gaps');
        return recommendations.slice(0, 6); // Limit to top 6 recommendations
    }
    /**
     * Define concrete next steps
     */
    static defineNextSteps(metrics) {
        const steps = [];
        // Immediate actions (0-2 weeks)
        steps.push('Week 1-2: Executive review and approval of compliance investment plan');
        if (metrics.criticalGaps > 0) {
            steps.push('Week 1-2: Initiate immediate corrective actions for critical non-conformities');
        }
        // Short-term actions (2-8 weeks)
        steps.push('Week 3-4: Establish compliance project team and resource allocation');
        steps.push('Week 4-8: Implement high-priority gap remediation initiatives');
        // Medium-term actions (8-16 weeks)
        if (metrics.gaps > 10) {
            steps.push('Week 8-12: Execute comprehensive compliance improvement program');
            steps.push('Week 12-16: Conduct internal compliance validation and documentation review');
        }
        // Certification preparation
        steps.push('Week 16-20: Schedule pre-assessment with certification body');
        steps.push('Week 20-24: Final certification audit preparation and documentation review');
        return steps;
    }
    /**
     * Generate investment analysis
     */
    static generateInvestmentAnalysis(answers, metrics) {
        const baseInvestment = metrics.gaps * 1500; // $1.5k per gap
        const criticalMultiplier = metrics.criticalGaps * 3000; // Additional $3k for critical gaps
        const consultingCosts = metrics.gaps > 15 ? 25000 : 15000; // Consulting if complex
        const totalInvestment = baseInvestment + criticalMultiplier + consultingCosts;
        return {
            gapRemediation: baseInvestment,
            criticalGapResolution: criticalMultiplier,
            consultingSupport: consultingCosts,
            totalEstimate: totalInvestment,
            paybackPeriod: this.estimatePaybackPeriod(totalInvestment),
            riskMitigation: this.calculateRiskMitigationValue(metrics),
            recommendedBudget: Math.ceil(totalInvestment * 1.2) // 20% contingency
        };
    }
    /**
     * Helper methods
     */
    static determineReadinessLevel(compliant, total, highRisk, criticalGaps) {
        const compliance = (compliant / total) * 100;
        if (compliance >= 95 && criticalGaps === 0 && highRisk === 0) {
            return 'Certification Ready';
        }
        if (compliance >= 85 && criticalGaps <= 1 && highRisk <= 2) {
            return 'Near Certification Ready';
        }
        if (compliance >= 70 && criticalGaps <= 3) {
            return 'Significant Preparation Required';
        }
        return 'Extensive Preparation Required';
    }
    static estimateSuccessProbability(compliance) {
        if (compliance >= 95)
            return 95;
        if (compliance >= 90)
            return 85;
        if (compliance >= 80)
            return 70;
        if (compliance >= 70)
            return 55;
        return 35;
    }
    static estimateProjectTimeline(metrics) {
        const gaps = metrics.gaps;
        const criticalGaps = metrics.criticalGaps;
        const complexity = criticalGaps + (gaps * 0.5);
        if (complexity <= 10)
            return '8-12 weeks to certification readiness';
        if (complexity <= 25)
            return '12-16 weeks to certification readiness';
        if (complexity <= 40)
            return '16-24 weeks to certification readiness';
        return '24+ weeks to certification readiness - phased approach recommended';
    }
    static estimatePaybackPeriod(investment) {
        if (investment <= 25000)
            return '6-12 months through operational efficiency gains';
        if (investment <= 50000)
            return '12-18 months through market access and efficiency';
        return '18-24 months through expanded market opportunities';
    }
    static calculateRiskMitigationValue(metrics) {
        const compliance = metrics.overallCompliance;
        if (compliance >= 90)
            return '$50,000 - $100,000 in avoided compliance risks';
        if (compliance >= 75)
            return '$100,000 - $250,000 in avoided compliance risks';
        return '$250,000+ in avoided regulatory and business risks';
    }
}
export async function generateExecutiveSummary(assessmentId) {
    const assessment = await db.query.assessments.findFirst({
        where: eq(assessments.id, assessmentId)
    });
    if (!assessment) {
        throw new Error('Assessment not found');
    }
    // Get answers for the assessment
    const assessmentAnswers = await db
        .select()
        .from(answers)
        .where(eq(answers.assessmentId, assessmentId));
    const totalQuestions = assessmentAnswers.length;
    const answeredQuestions = assessmentAnswers.filter((a) => a.value).length;
    const completionRate = totalQuestions > 0 ? (answeredQuestions / totalQuestions * 100) : 0;
    const score = assessment.progress || 0;
    // Determine risk level and compliance status
    let riskLevel;
    let complianceStatus;
    if (score >= 80) {
        riskLevel = 'LOW';
        complianceStatus = 'COMPLIANT';
    }
    else if (score >= 60) {
        riskLevel = 'MEDIUM';
        complianceStatus = 'NEEDS_IMPROVEMENT';
    }
    else {
        riskLevel = 'HIGH';
        complianceStatus = 'NON_COMPLIANT';
    }
    // Generate key findings based on low-scoring areas
    const keyFindings = [];
    const lowScoringAnswers = assessmentAnswers.filter((a) => a.score !== null && a.score < 3);
    if (lowScoringAnswers.length > 0) {
        keyFindings.push(`${lowScoringAnswers.length} areas identified as needing immediate attention`);
    }
    if (completionRate < 90) {
        keyFindings.push(`Assessment ${completionRate.toFixed(1)}% complete - additional documentation required`);
    }
    // Critical areas that commonly need attention
    const criticalIssues = assessmentAnswers.filter((a) => a.compliance === 'NON_COMPLIANT' && (a.score === null || a.score < 3));
    if (criticalIssues.length > 0) {
        keyFindings.push(`${criticalIssues.length} critical requirements need documentation`);
    }
    // Generate recommendations
    const recommendations = [];
    if (score < 80) {
        recommendations.push('Develop comprehensive documentation for all R2v3 requirements');
        recommendations.push('Implement regular internal audits to maintain compliance');
    }
    if (completionRate < 100) {
        recommendations.push('Complete all assessment questions for full compliance evaluation');
    }
    if (criticalIssues.length > 0) {
        recommendations.push('Prioritize documentation for critical requirements');
    }
    // Generate next steps
    const nextSteps = [];
    if (complianceStatus === 'NON_COMPLIANT') {
        nextSteps.push('Schedule corrective action plan development within 30 days');
        nextSteps.push('Engage with R2v3 consultant for compliance guidance');
    }
    else if (complianceStatus === 'NEEDS_IMPROVEMENT') {
        nextSteps.push('Address identified gaps within 60 days');
        nextSteps.push('Schedule follow-up assessment in 90 days');
    }
    else {
        nextSteps.push('Maintain current documentation standards');
        nextSteps.push('Schedule annual compliance review');
    }
    nextSteps.push('Document all corrective actions taken');
    // Get facility name if facilityId exists
    let facilityName = 'Unknown Facility';
    if (assessment.facilityId) {
        const [facility] = await db
            .select({ name: facilityProfiles.name })
            .from(facilityProfiles)
            .where(eq(facilityProfiles.id, assessment.facilityId));
        facilityName = facility?.name || 'Unknown Facility';
    }
    return {
        facilityName,
        assessmentDate: assessment.createdAt.toLocaleDateString(),
        overallScore: score,
        completionRate: Math.round(completionRate),
        riskLevel,
        keyFindings,
        recommendations,
        nextSteps,
        complianceStatus
    };
}
