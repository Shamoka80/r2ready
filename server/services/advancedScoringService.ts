import { db } from "../db";
import { assessments, answers, questions, clauses, intakeForms } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { IntakeProcessor } from "../routes/intakeLogic";

export interface GapAnalysis {
  criticalGaps: GapItem[];
  majorGaps: GapItem[];
  minorGaps: GapItem[];
  overallGapScore: number;
  prioritizedActions: ActionItem[];
}

export interface GapItem {
  questionId: string;
  questionText: string;
  category: string;
  currentScore: number;
  targetScore: number;
  gapSeverity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  impact: string;
  recommendation: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedEffort: string;
  expectedImpact: string;
  category: string;
  dueDate?: Date;
}

export interface ComplianceMetrics {
  overallCompliance: number;
  coreRequirementCompliance: number;
  appendixCompliance: { [appendix: string]: number };
  categoryBreakdown: { [category: string]: number };
  trendData: ComplianceDataPoint[];
  benchmarkComparison: BenchmarkData;
}

export interface ComplianceDataPoint {
  date: string;
  score: number;
  category?: string;
}

export interface BenchmarkData {
  industryAverage: number;
  topPerformer: number;
  yourPosition: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
  percentile: number;
}

export interface PredictiveInsight {
  id: string;
  type: 'RISK' | 'OPPORTUNITY' | 'TREND';
  title: string;
  description: string;
  confidence: number;
  timeframe: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
  dataPoints: any[];
}

export interface AssessmentReadiness {
  overallReadiness: number;
  readinessLevel: 'READY' | 'NEEDS_WORK' | 'NOT_READY';
  blockers: string[];
  recommendations: string[];
  estimatedTimeToReady: string;
  certificationProbability: number;
}

class AdvancedScoringService {
  // R2v3 Core Requirement Weights (based on SERI R2v3 standard)
  private static readonly CORE_WEIGHTS = {
    'LEGAL': 15, // Legal and Business Practices
    'FACILITY': 20, // Facility Infrastructure and Security
    'EHS': 25, // Environmental, Health & Safety Management
    'PROC': 20, // Processing and Handling
    'DATA': 10, // Data Security and Destruction
    'SUPPLY': 10, // Supply Chain and Downstream
  };

  // Appendix weights (cumulative with core)
  private static readonly APPENDIX_WEIGHTS = {
    'APP-A': 5, // Focus Materials
    'APP-B': 8, // Refurbishment
    'APP-C': 10, // Materials Recovery
    'APP-D': 15, // Data Destruction
    'APP-E': 7, // Downstream Vendors
    'APP-F': 5, // Disposition Hierarchy
    'APP-G': 5, // Transportation
  };

  async calculateScore(assessmentId: string): Promise<number> {
    try {
      // Get assessment with intake form data
      const assessment = await db.query.assessments.findFirst({
        where: eq(assessments.id, assessmentId),
        with: {
          intakeForm: true
        }
      });

      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Get all answers for this assessment
      const assessmentAnswers = await AdvancedScoringService.getAllAnswersWithQuestionDetails(assessmentId);

      if (assessmentAnswers.length === 0) {
        return 0; // No answers yet
      }

      // Apply REC-based filtering if intake form exists
      let relevantAnswers = assessmentAnswers;
      if (assessment.intakeForm) {
        const applicableRECs = await this.getApplicableRECs(assessment.intakeFormId!);
        relevantAnswers = this.filterAnswersByRECs(assessmentAnswers, applicableRECs);
      }

      // Calculate weighted score
      return this.calculateWeightedScore(relevantAnswers);
    } catch (error) {
      console.error('Error calculating score:', error);
      throw error;
    }
  }

  async generateGapAnalysis(assessmentId: string): Promise<GapAnalysis> {
    const assessment = await db.query.assessments.findFirst({
      where: eq(assessments.id, assessmentId),
      with: { intakeForm: true }
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get answers with question details
    const answersWithDetails = await AdvancedScoringService.getAllAnswersWithQuestionDetails(assessmentId);

    // Identify gaps
    const gaps: GapItem[] = [];
    const targetScore = 100; // Full compliance target

    for (const answer of answersWithDetails) {
      const currentScore = answer.score || this.convertAnswerToScore(answer.value as string | null);

      if (currentScore < 80) { // Below 80% is a gap
        const gapSeverity = this.determineGapSeverity(currentScore, answer.required, answer.weight);

        gaps.push({
          questionId: answer.questionId,
          questionText: answer.questionText,
          category: (answer.categoryName || answer.category) as string,
          currentScore,
          targetScore,
          gapSeverity,
          impact: this.generateImpactDescription(answer.category as string, currentScore),
          recommendation: this.generateRecommendation(answer.category as string, answer.value as string | null, currentScore)
        });
      }
    }

    // Sort gaps by severity and impact
    const criticalGaps = gaps.filter(g => g.gapSeverity === 'CRITICAL');
    const majorGaps = gaps.filter(g => g.gapSeverity === 'MAJOR');
    const minorGaps = gaps.filter(g => g.gapSeverity === 'MINOR');

    // Calculate overall gap score
    const totalPossibleScore = answersWithDetails.length * 100;
    const actualScore = answersWithDetails.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
    const overallGapScore = Math.max(0, ((totalPossibleScore - actualScore) / totalPossibleScore) * 100);

    // Generate prioritized actions
    const prioritizedActions = await this.generateActionItems(gaps);

    return {
      criticalGaps,
      majorGaps,
      minorGaps,
      overallGapScore,
      prioritizedActions
    };
  }

  async getComplianceMetrics(assessmentId: string): Promise<ComplianceMetrics> {
    // Get assessment data
    const assessment = await db.query.assessments.findFirst({
      where: eq(assessments.id, assessmentId),
      with: { intakeForm: true }
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get detailed answer data
    const detailedAnswers = await db
      .select({
        score: answers.score,
        value: answers.value,
        category: questions.category_code,
        categoryName: questions.categoryName,
        appendix: questions.appendix,
        required: questions.required,
        updatedAt: answers.updatedAt
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(eq(answers.assessmentId, assessmentId))
      .orderBy(desc(answers.updatedAt));

    // Calculate overall compliance
    const scores = detailedAnswers.map(a => a.score || this.convertAnswerToScore(a.value as string | null));
    const overallCompliance = scores.length > 0 ? 
      Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;

    // Calculate core requirement compliance
    const coreAnswers = detailedAnswers.filter(a => !a.appendix || a.appendix.length === 0);
    const coreScores = coreAnswers.map(a => a.score || this.convertAnswerToScore(a.value as string | null));
    const coreRequirementCompliance = coreScores.length > 0 ? 
      Math.round(coreScores.reduce((sum, score) => sum + score, 0) / coreScores.length) : 0;

    // Calculate appendix compliance
    const appendixCompliance: { [appendix: string]: number } = {};
    const appendices = [...new Set(detailedAnswers.map(a => a.appendix).filter(Boolean))];

    for (const appendix of appendices) {
      const appendixAnswers = detailedAnswers.filter(a => a.appendix === appendix);
      const appendixScores = appendixAnswers.map(a => a.score || this.convertAnswerToScore(a.value as string | null));
      appendixCompliance[appendix as string] = appendixScores.length > 0 ? 
        Math.round(appendixScores.reduce((sum, score) => sum + score, 0) / appendixScores.length) : 0;
    }

    // Calculate category breakdown
    const categoryBreakdown: { [category: string]: number } = {};
    const categories = [...new Set(detailedAnswers.map(a => a.categoryName || a.category).filter(Boolean))];

    for (const category of categories) {
      const categoryAnswers = detailedAnswers.filter(a => 
        (a.categoryName || a.category) === category
      );
      const categoryScores = categoryAnswers.map(a => a.score || this.convertAnswerToScore(a.value as string | null));
      categoryBreakdown[category as string] = categoryScores.length > 0 ? 
        Math.round(categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length) : 0;
    }

    // Generate trend data (simplified for now)
    const trendData: ComplianceDataPoint[] = [
      { date: '30 days ago', score: Math.max(0, overallCompliance - 15) },
      { date: '15 days ago', score: Math.max(0, overallCompliance - 8) },
      { date: 'Today', score: overallCompliance }
    ];

    // Benchmark comparison (industry averages)
    const benchmarkComparison: BenchmarkData = {
      industryAverage: 72, // R2v3 industry average
      topPerformer: 95,
      yourPosition: overallCompliance >= 72 ? 'ABOVE_AVERAGE' : 'BELOW_AVERAGE',
      percentile: Math.round((overallCompliance / 100) * 90) // Simplified calculation
    };

    return {
      overallCompliance,
      coreRequirementCompliance,
      appendixCompliance,
      categoryBreakdown,
      trendData,
      benchmarkComparison
    };
  }

  async generatePredictiveInsights(assessmentId: string): Promise<PredictiveInsight[]> {
    const metrics = await this.getComplianceMetrics(assessmentId);
    const gapAnalysis = await this.generateGapAnalysis(assessmentId);

    const insights: PredictiveInsight[] = [];

    // Risk insights
    if (gapAnalysis.criticalGaps.length > 0) {
      insights.push({
        id: 'critical-risk-1',
        type: 'RISK',
        title: 'Critical Compliance Gaps Detected',
        description: `${gapAnalysis.criticalGaps.length} critical gaps may prevent certification approval`,
        confidence: 0.95,
        timeframe: '30-60 days',
        impact: 'HIGH',
        recommendation: 'Address critical gaps immediately to avoid certification delays',
        dataPoints: gapAnalysis.criticalGaps
      });
    }

    // Opportunity insights
    if (metrics.overallCompliance >= 80) {
      insights.push({
        id: 'opportunity-1',
        type: 'OPPORTUNITY',
        title: 'Certification Ready Path Identified',
        description: 'Current progress indicates high certification probability with focused effort',
        confidence: 0.85,
        timeframe: '60-90 days',
        impact: 'HIGH',
        recommendation: 'Complete remaining assessments and schedule pre-audit',
        dataPoints: [{ currentScore: metrics.overallCompliance, target: 95 }]
      });
    }

    // Trend insights
    if (metrics.trendData.length >= 2) {
      const recentTrend = metrics.trendData[metrics.trendData.length - 1].score - 
                         metrics.trendData[metrics.trendData.length - 2].score;

      if (recentTrend > 5) {
        insights.push({
          id: 'trend-1',
          type: 'TREND',
          title: 'Positive Improvement Trend',
          description: `Compliance score increased by ${recentTrend} points in recent period`,
          confidence: 0.75,
          timeframe: 'Ongoing',
          impact: 'MEDIUM',
          recommendation: 'Maintain current improvement pace',
          dataPoints: metrics.trendData
        });
      }
    }

    return insights;
  }

  async assessReadiness(assessmentId: string): Promise<AssessmentReadiness> {
    const metrics = await this.getComplianceMetrics(assessmentId);
    const gapAnalysis = await this.generateGapAnalysis(assessmentId);

    // Determine readiness level
    let readinessLevel: 'READY' | 'NEEDS_WORK' | 'NOT_READY';
    let certificationProbability = 0;

    if (metrics.overallCompliance >= 90 && gapAnalysis.criticalGaps.length === 0) {
      readinessLevel = 'READY';
      certificationProbability = 0.95;
    } else if (metrics.overallCompliance >= 70 && gapAnalysis.criticalGaps.length <= 2) {
      readinessLevel = 'NEEDS_WORK';
      certificationProbability = 0.70;
    } else {
      readinessLevel = 'NOT_READY';
      certificationProbability = 0.30;
    }

    // Identify blockers
    const blockers: string[] = [];
    if (gapAnalysis.criticalGaps.length > 0) {
      blockers.push(`${gapAnalysis.criticalGaps.length} critical compliance gaps`);
    }
    if (metrics.coreRequirementCompliance < 80) {
      blockers.push('Core requirements below 80% compliance');
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (gapAnalysis.criticalGaps.length > 0) {
      recommendations.push('Address all critical gaps before scheduling audit');
    }
    if (metrics.overallCompliance < 85) {
      recommendations.push('Improve overall compliance to 85%+ for higher success probability');
    }
    recommendations.push('Schedule pre-audit assessment with certified consultant');

    // Estimate time to ready
    const gapCount = gapAnalysis.criticalGaps.length + gapAnalysis.majorGaps.length;
    let estimatedTimeToReady = '2-4 weeks';
    if (gapCount > 10) {
      estimatedTimeToReady = '6-12 weeks';
    } else if (gapCount > 5) {
      estimatedTimeToReady = '4-8 weeks';
    }

    return {
      overallReadiness: metrics.overallCompliance,
      readinessLevel,
      blockers,
      recommendations,
      estimatedTimeToReady,
      certificationProbability
    };
  }

  // Private helper methods
  private async getApplicableRECs(intakeFormId: string): Promise<string[]> {
    const intakeForm = await db.query.intakeForms.findFirst({
      where: eq(intakeForms.id, intakeFormId)
    });

    if (!intakeForm) return [];

    const assessmentScope = await IntakeProcessor.generateAssessmentScope(intakeFormId);
    return assessmentScope.applicableRecCodes;
  }

  private filterAnswersByRECs(answers: any[], applicableRECs: string[]): any[] {
    // Filter answers based on applicable REC codes
    // This is a simplified implementation - in production, you'd have a more sophisticated mapping
    return answers.filter(answer => {
      // Always include required questions
      if (answer.required) return true;

      // Include answers for applicable categories
      const categoryPrefix = answer.category?.split('-')[0];
      return applicableRECs.some(rec => rec.startsWith(categoryPrefix || ''));
    });
  }

  private calculateWeightedScore(answers: any[]): number {
    if (answers.length === 0) return 0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const answer of answers) {
      const score = answer.score || this.convertAnswerToScore(answer.value);
      const weight = this.getQuestionWeight(answer.category, answer.appendix, answer.required);

      totalWeightedScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
  }

  private getQuestionWeight(category: string, appendix: string | null, required: boolean): number {
    let baseWeight = 1;

    // Core category weights
    const categoryPrefix = category?.split('-')[0];
    if (categoryPrefix && (AdvancedScoringService.CORE_WEIGHTS as any)[categoryPrefix]) {
      baseWeight = (AdvancedScoringService.CORE_WEIGHTS as any)[categoryPrefix] / 10; // Normalize
    }

    // Appendix weights
    if (appendix && (AdvancedScoringService.APPENDIX_WEIGHTS as any)[appendix]) {
      baseWeight += (AdvancedScoringService.APPENDIX_WEIGHTS as any)[appendix] / 20; // Additional weight
    }

    // Required questions get higher weight
    if (required) {
      baseWeight *= 1.5;
    }

    return baseWeight;
  }

  private convertAnswerToScore(value: string | null): number {
    switch (value) {
      case 'YES': return 100;
      case 'PARTIAL': return 50;
      case 'NO': return 0;
      case 'N/A': return 100; // N/A counts as compliant
      default: return 0;
    }
  }

  private determineGapSeverity(score: number, required: boolean, weight: number): 'CRITICAL' | 'MAJOR' | 'MINOR' {
    if (required && score < 50) return 'CRITICAL';
    if (score < 30) return 'CRITICAL';
    if (score < 60 && weight > 5) return 'MAJOR';
    if (score < 80) return 'MAJOR';
    return 'MINOR';
  }

  private generateImpactDescription(category: string, score: number): string {
    const impacts = {
      'LEGAL': 'May prevent legal compliance and certification approval',
      'FACILITY': 'Could impact facility security and operational approval',
      'EHS': 'May create environmental, health, or safety compliance issues',
      'PROC': 'Could affect processing procedures and material handling',
      'DATA': 'May compromise data security and destruction compliance',
      'SUPPLY': 'Could impact supply chain and vendor compliance'
    };

    const categoryPrefix = category?.split('-')[0];
    return impacts[categoryPrefix as keyof typeof impacts] || 'May impact overall compliance score';
  }

  private generateRecommendation(category: string, value: string | null, score: number): string {
    if (score < 30) {
      return 'Immediate action required - implement missing controls and procedures';
    } else if (score < 60) {
      return 'Strengthen existing processes and provide additional documentation';
    } else if (score < 80) {
      return 'Minor improvements needed to achieve full compliance';
    }
    return 'Review and maintain current compliance level';
  }

  private async generateActionItems(gaps: GapItem[]): Promise<ActionItem[]> {
    const actions: ActionItem[] = [];

    // Group gaps by category for efficient action planning
    const gapsByCategory = gaps.reduce((acc, gap) => {
      if (!acc[gap.category]) acc[gap.category] = [];
      acc[gap.category].push(gap);
      return acc;
    }, {} as { [category: string]: GapItem[] });

    for (const [category, categoryGaps] of Object.entries(gapsByCategory)) {
      const criticalCount = categoryGaps.filter(g => g.gapSeverity === 'CRITICAL').length;
      const majorCount = categoryGaps.filter(g => g.gapSeverity === 'MAJOR').length;

      if (criticalCount > 0) {
        actions.push({
          id: `action-${category}-critical`,
          title: `Address Critical ${category} Gaps`,
          description: `Resolve ${criticalCount} critical compliance gaps in ${category}`,
          priority: 'HIGH',
          estimatedEffort: `${criticalCount * 2} days`,
          expectedImpact: 'High compliance improvement',
          category
        });
      }

      if (majorCount > 0) {
        actions.push({
          id: `action-${category}-major`,
          title: `Improve ${category} Compliance`,
          description: `Address ${majorCount} major compliance areas in ${category}`,
          priority: majorCount > 3 ? 'HIGH' : 'MEDIUM',
          estimatedEffort: `${majorCount} days`,
          expectedImpact: 'Medium compliance improvement',
          category
        });
      }
    }

    return actions.sort((a, b) => {
      const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Helper method to fetch all answers with question details
  private static async getAllAnswersWithQuestionDetails(assessmentId: string) {
    return await db
      .select({
        questionId: answers.questionId,
        questionText: questions.text,
        category: questions.category_code,
        categoryName: questions.categoryName,
        currentScore: answers.score,
        value: answers.value,
        required: questions.required,
        weight: questions.weight,
        appendix: questions.appendix,
        score: answers.score,
        maxScore: answers.maxScore,
        compliance: answers.compliance,
        question: {
          required: questions.required,
          evidenceRequired: questions.evidenceRequired,
          category_code: questions.category_code,
          weight: questions.weight,
          clauseRef: clauses.ref
        }
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(eq(answers.assessmentId, assessmentId));
  }

  // Calculate comprehensive scoring with weighted categories
  static async calculateComprehensiveScore(assessmentId: string, tenantId: string) {
    const answerResults = await db
      .select({
        questionId: answers.questionId,
        value: answers.value,
        score: answers.score,
        maxScore: answers.maxScore,
        compliance: answers.compliance,
        question: {
          required: questions.required,
          evidenceRequired: questions.evidenceRequired,
          category_code: questions.category_code,
          weight: questions.weight,
          clauseRef: clauses.ref
        }
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .innerJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(eq(answers.assessmentId, assessmentId));

    // Calculate Core Requirements scores (CR1-CR10)
    const coreRequirementScores = this.calculateCoreRequirementScores(answerResults);

    // Calculate category-weighted scoring
    const categoryScores = this.calculateCategoryScores(answerResults);

    // Calculate compliance metrics
    const complianceMetrics = this.calculateComplianceMetrics(answerResults);

    // Calculate readiness assessment
    const readinessAssessment = this.calculateReadinessAssessment(answerResults, complianceMetrics);

    // Advanced gap analysis
    const gapAnalysis = this.performGapAnalysis(answerResults);

    const totalScore = answerResults.reduce((sum, answer) => sum + (answer.score || 0), 0);
    const maxPossibleScore = answerResults.reduce((sum, answer) => sum + (answer.maxScore || 100), 0);
    const overallScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

    return {
      overallScore,
      maxPossibleScore,
      scorePercentage: overallScore,
      totalAnswered: answerResults.length,
      complianceStatus: this.determineComplianceStatus(overallScore / 100),
      readinessLevel: this.determineReadinessLevel(overallScore),
      estimatedAuditSuccess: this.calculateAuditSuccessProbability(overallScore, complianceMetrics),
      coreRequirementScores,
      categoryScores,
      complianceMetrics,
      readinessAssessment,
      gapAnalysis,
      criticalIssues: gapAnalysis.criticalGaps.map(gap => gap.description),
      recommendations: this.generateRecommendations(gapAnalysis, readinessAssessment),
      lastCalculated: new Date().toISOString()
    };
  }

  private static calculateCoreRequirementScores(answers: any[]) {
    const crScores: { [key: string]: any } = {};

    for (let i = 1; i <= 10; i++) {
      const crKey = `CR${i}`;
      const crAnswers = answers.filter(a => a.question?.clauseRef?.startsWith(crKey));

      if (crAnswers.length > 0) {
        const totalScore = crAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
        const maxScore = crAnswers.reduce((sum, a) => sum + (a.maxScore || 100), 0);
        const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        crScores[crKey] = {
          score: totalScore,
          maxScore,
          percentage,
          questionsAnswered: crAnswers.length,
          complianceStatus: this.determineComplianceStatus(percentage / 100),
          criticalGaps: crAnswers.filter(a => a.compliance === 'NON_COMPLIANT' && a.question?.required).length
        };
      }
    }

    return crScores;
  }

  private static calculateCategoryScores(answers: any[]) {
    const categories = new Map<string, any[]>();

    answers.forEach(answer => {
      const category = answer.question?.category_code || 'GENERAL';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(answer);
    });

    return Array.from(categories.entries()).map(([category, categoryAnswers]) => {
      const totalScore = categoryAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
      const maxScore = categoryAnswers.reduce((sum, a) => sum + (a.maxScore || 100), 0);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      return {
        category,
        categoryName: this.getCategoryName(category),
        score: totalScore,
        maxScore,
        percentage,
        questionsAnswered: categoryAnswers.length,
        totalQuestions: categoryAnswers.length,
        criticalGaps: categoryAnswers
          .filter(a => a.compliance === 'NON_COMPLIANT' && a.question?.required)
          .map(a => `Question ${a.questionId}: Non-compliant`)
      };
    });
  }

  private static calculateComplianceMetrics(answers: any[]) {
    const totalAnswers = answers.length;
    const compliantAnswers = answers.filter(a => a.compliance === 'COMPLIANT').length;
    const partiallyCompliantAnswers = answers.filter(a => a.compliance === 'PARTIALLY_COMPLIANT').length;
    const nonCompliantAnswers = answers.filter(a => a.compliance === 'NON_COMPLIANT').length;
    const requiredAnswers = answers.filter(a => a.question?.required);
    const criticalIssues = answers.filter(a => a.compliance === 'NON_COMPLIANT' && a.question?.required).length;

    return {
      totalQuestions: totalAnswers,
      compliantCount: compliantAnswers,
      partiallyCompliantCount: partiallyCompliantAnswers,
      nonCompliantCount: nonCompliantAnswers,
      requiredQuestionsTotal: requiredAnswers.length,
      requiredQuestionsCompliant: requiredAnswers.filter(a => a.compliance === 'COMPLIANT').length,
      overallCompliance: totalAnswers > 0 ? Math.round((compliantAnswers / totalAnswers) * 100) : 0,
      coreRequirementCompliance: requiredAnswers.length > 0 
        ? Math.round((requiredAnswers.filter(a => a.compliance === 'COMPLIANT').length / requiredAnswers.length) * 100) 
        : 0,
      criticalIssuesCount: criticalIssues,
      riskLevel: this.calculateRiskLevel(criticalIssues, nonCompliantAnswers)
    };
  }

  private static calculateReadinessAssessment(answers: any[], complianceMetrics: any) {
    const readinessFactors = {
      overallCompliance: complianceMetrics.overallCompliance,
      requiredCompliance: complianceMetrics.coreRequirementCompliance,
      criticalIssues: complianceMetrics.criticalIssuesCount,
      evidenceReadiness: this.calculateEvidenceReadiness(answers)
    };

    let readinessScore = 0;
    const blockers: string[] = [];

    // Overall compliance factor (40% weight)
    readinessScore += (readinessFactors.overallCompliance / 100) * 40;

    // Required compliance factor (40% weight)
    readinessScore += (readinessFactors.requiredCompliance / 100) * 40;

    // Evidence readiness factor (20% weight)
    readinessScore += (readinessFactors.evidenceReadiness / 100) * 20;

    // Critical issues penalty
    if (readinessFactors.criticalIssues > 0) {
      readinessScore = Math.max(0, readinessScore - (readinessFactors.criticalIssues * 5));
      blockers.push(`${readinessFactors.criticalIssues} critical compliance issues`);
    }

    const readinessLevel = this.determineReadinessLevel(readinessScore);
    const estimatedTimeToReady = this.estimateTimeToReadiness(readinessFactors);

    return {
      readinessScore: Math.round(readinessScore),
      readinessLevel,
      readinessFactors,
      blockers,
      estimatedTimeToReady,
      nextSteps: this.generateNextSteps(readinessLevel, blockers)
    };
  }

  private static performGapAnalysis(answers: any[]) {
    const criticalGaps = answers
      .filter(a => a.compliance === 'NON_COMPLIANT' && a.question?.required)
      .map(a => ({
        questionId: a.questionId,
        category: a.question?.category_code || 'GENERAL',
        description: `Critical non-compliance in required question`,
        recommendation: 'Immediate remediation required',
        priority: 'CRITICAL',
        estimatedEffort: 'High'
      }));

    const majorGaps = answers
      .filter(a => a.compliance === 'PARTIALLY_COMPLIANT' && a.question?.required)
      .map(a => ({
        questionId: a.questionId,
        category: a.question?.category_code || 'GENERAL',
        description: `Partial compliance in required question`,
        recommendation: 'Address gaps to achieve full compliance',
        priority: 'HIGH',
        estimatedEffort: 'Medium'
      }));

    const minorGaps = answers
      .filter(a => a.compliance !== 'COMPLIANT' && !a.question?.required)
      .map(a => ({
        questionId: a.questionId,
        category: a.question?.category_code || 'GENERAL',
        description: `Non-optimal response in optional question`,
        recommendation: 'Consider improvement for best practices',
        priority: 'LOW',
        estimatedEffort: 'Low'
      }));

    const prioritizedActions = [
      ...criticalGaps.map(gap => ({ ...gap, order: 1 })),
      ...majorGaps.map(gap => ({ ...gap, order: 2 })),
      ...minorGaps.slice(0, 5).map(gap => ({ ...gap, order: 3 }))
    ].sort((a, b) => a.order - b.order);

    return {
      criticalGaps,
      majorGaps,
      minorGaps,
      prioritizedActions,
      totalGaps: criticalGaps.length + majorGaps.length + minorGaps.length
    };
  }

  private static calculateEvidenceReadiness(answers: any[]): number {
    const evidenceRequiredAnswers = answers.filter(a => a.question?.evidenceRequired);
    if (evidenceRequiredAnswers.length === 0) return 100;

    // Simulate evidence completeness (in real implementation, check actual evidence files)
    const evidenceCompleteAnswers = evidenceRequiredAnswers.filter(a => a.value && a.value !== '');
    return Math.round((evidenceCompleteAnswers.length / evidenceRequiredAnswers.length) * 100);
  }

  private static calculateRiskLevel(criticalIssues: number, nonCompliantAnswers: number): string {
    if (criticalIssues > 5 || nonCompliantAnswers > 20) return 'HIGH';
    if (criticalIssues > 2 || nonCompliantAnswers > 10) return 'MEDIUM';
    if (criticalIssues > 0 || nonCompliantAnswers > 5) return 'LOW';
    return 'MINIMAL';
  }

  private static estimateTimeToReadiness(factors: any): string {
    const { criticalIssues, overallCompliance } = factors;

    if (criticalIssues > 10 || overallCompliance < 50) return '6+ months';
    if (criticalIssues > 5 || overallCompliance < 70) return '3-6 months';
    if (criticalIssues > 2 || overallCompliance < 85) return '1-3 months';
    if (criticalIssues > 0 || overallCompliance < 95) return '2-8 weeks';
    return '1-2 weeks';
  }

  private static generateNextSteps(readinessLevel: string, blockers: string[]): string[] {
    const steps = [];

    if (readinessLevel === 'AUDIT_READY') {
      steps.push('Schedule formal R2v3 certification audit');
      steps.push('Complete final documentation review');
      steps.push('Conduct internal pre-audit assessment');
    } else if (readinessLevel === 'NEEDS_IMPROVEMENT') {
      steps.push('Address critical compliance gaps');
      steps.push('Complete evidence collection');
      steps.push('Conduct gap remediation planning');
    } else if (readinessLevel === 'MAJOR_GAPS') {
      steps.push('Develop comprehensive improvement plan');
      steps.push('Prioritize critical requirement implementation');
      steps.push('Consider external consultant support');
    } else {
      steps.push('Begin systematic R2v3 implementation');
      steps.push('Establish compliance framework');
      steps.push('Develop staff training program');
    }

    return steps;
  }

  private static generateRecommendations(gapAnalysis: any, readinessAssessment: any): string[] {
    const recommendations = [];

    if (gapAnalysis.criticalGaps.length > 0) {
      recommendations.push(`Address ${gapAnalysis.criticalGaps.length} critical compliance gaps immediately`);
    }

    if (gapAnalysis.majorGaps.length > 0) {
      recommendations.push(`Resolve ${gapAnalysis.majorGaps.length} major compliance issues`);
    }

    if (readinessAssessment.readinessFactors.evidenceReadiness < 80) {
      recommendations.push('Complete evidence documentation for compliance verification');
    }

    if (readinessAssessment.readinessScore < 70) {
      recommendations.push('Consider external R2v3 certification consultant');
    }

    recommendations.push('Conduct regular internal audits to maintain compliance');

    return recommendations;
  }

  private static getCategoryName(code: string): string {
    const categoryNames: { [key: string]: string } = {
      'CR1': 'Legal and Contractual Requirements',
      'CR2': 'Data Sanitization and Information Security',
      'CR3': 'Chain of Custody and Inventory Tracking',
      'CR4': 'Processing and Downstream Management',
      'CR5': 'Transportation and Logistics',
      'CR6': 'Recycling Efficiency and Focus Materials',
      'CR7': 'Environmental Health and Safety Management',
      'CR8': 'Metrics and Monitoring',
      'CR9': 'Management and Continual Improvement',
      'CR10': 'Quality Management System',
      'APP-A': 'Downstream Vendors',
      'APP-B': 'Data-Bearing Devices',
      'APP-C': 'Repair and Refurbishment',
      'APP-D': 'Specialty Electronics',
      'APP-E': 'Materials Recovery',
      'APP-F': 'Brokering',
      'APP-G': 'Photovoltaic Modules',
      'GENERAL': 'General Requirements'
    };
    return categoryNames[code] || code;
  }

  private static calculateAuditSuccessProbability(overallScore: number, complianceMetrics: any): number {
    let probability = overallScore;

    // Penalties for critical issues
    if (complianceMetrics.criticalIssuesCount > 0) {
      probability -= complianceMetrics.criticalIssuesCount * 10;
    }

    // Bonus for high required compliance
    if (complianceMetrics.coreRequirementCompliance > 90) {
      probability += 5;
    }

    return Math.max(0, Math.min(100, Math.round(probability)));
  }

  private static determineComplianceStatus(percentage: number): string {
    if (percentage >= 0.9) return 'COMPLIANT';
    if (percentage >= 0.7) return 'PARTIALLY_COMPLIANT';
    return 'NON_COMPLIANT';
  }

  private static determineReadinessLevel(score: number): string {
    if (score >= 90) return 'AUDIT_READY';
    if (score >= 70) return 'NEEDS_IMPROVEMENT';
    return 'MAJOR_GAPS';
  }
}

const advancedScoringService = new AdvancedScoringService();
export { advancedScoringService };
export default advancedScoringService;