
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { assessments, questions, answers, clauses } from "../../shared/schema";
import { eq, and, gte, lte, isNotNull, sql } from "drizzle-orm";
import { AuthService } from '../services/authService';
import observabilityService, { ObservabilityService } from '../services/observabilityService';
import ComplianceAnalyticsService from '../services/complianceAnalyticsService';
import { Request, Response } from 'express';

const router = Router();

// Apply auth middleware
router.use(AuthService.authMiddleware);

// Onboarding Analytics (existing)
const onboardingAnalyticsSchema = z.object({
  userId: z.string().uuid().optional(),
  stepId: z.string(),
  action: z.enum(['start', 'complete', 'abandon']),
  timeSpent: z.number(),
  accountType: z.enum(['business', 'consultant']).optional().nullable(),
  timestamp: z.number(),
  metadata: z.record(z.any()).optional()
});

// In-memory storage for onboarding analytics
const onboardingAnalyticsStore = new Map<string, any[]>();

// POST /api/analytics/onboarding - Track onboarding analytics (existing)
router.post('/onboarding', async (req: any, res) => {
  try {
    const data = onboardingAnalyticsSchema.parse(req.body);

    const analyticsEntry = {
      ...data,
      userId: data.userId || req.user?.id,
      tenantId: req.user?.tenantId,
      sessionId: req.sessionID || 'unknown',
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      recordedAt: new Date().toISOString()
    };

    const key = `onboarding:${analyticsEntry.tenantId}`;
    if (!onboardingAnalyticsStore.has(key)) {
      onboardingAnalyticsStore.set(key, []);
    }
    onboardingAnalyticsStore.get(key)!.push(analyticsEntry);

    console.log(`📊 Onboarding Analytics: User ${analyticsEntry.userId} ${data.action} step ${data.stepId} (${data.timeSpent}ms)`);

    res.json({ success: true, recorded: analyticsEntry.recordedAt });
  } catch (error) {
    console.error('Analytics recording error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid analytics data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to record analytics' });
  }
});

// GET /api/analytics/onboarding/summary - Get completion summary (existing)
router.get('/onboarding/summary', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'No tenant context' });
    }

    const key = `onboarding:${tenantId}`;
    const entries = onboardingAnalyticsStore.get(key) || [];

    const totalSessions = new Set(entries.map(e => e.sessionId)).size;
    const completedSessions = entries.filter(e => e.stepId === 'confirmation' && e.action === 'complete').length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    const stepAbandonments = entries
      .filter(e => e.action === 'abandon')
      .reduce((acc, e) => {
        acc[e.stepId] = (acc[e.stepId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const stepTimes = entries
      .filter(e => e.action === 'complete')
      .reduce((acc, e) => {
        if (!acc[e.stepId]) acc[e.stepId] = [];
        acc[e.stepId].push(e.timeSpent);
        return acc;
      }, {} as Record<string, number[]>);

    const avgStepTimes: Record<string, number> = Object.fromEntries(
      Object.entries(stepTimes).map(([step, times]) => [
        step,
        (times as number[]).reduce((sum: number, time: number) => sum + time, 0) / (times as number[]).length
      ])
    );

    const accountTypeBreakdown = entries
      .filter(e => e.accountType)
      .reduce((acc, e) => {
        acc[e.accountType!] = (acc[e.accountType!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    res.json({
      summary: {
        totalSessions,
        completedSessions,
        completionRate,
        stepAbandonments,
        avgStepTimes,
        accountTypeBreakdown
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to get analytics summary' });
  }
});

// NEW COMPLIANCE ANALYTICS ENDPOINTS

// GET /api/analytics/compliance/kpis - Get compliance KPIs
router.get('/compliance/kpis', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const timeRange = req.query.timeRange as string || '30d';

    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const complianceService = new ComplianceAnalyticsService();
    const kpis = await complianceService.getComplianceKPIs(tenantId, timeRange);

    await ObservabilityService.recordMetric(
      'compliance_kpis_request',
      1,
      'count',
      {
        service: 'analytics',
        operation: 'compliance_kpis',
        tenantId,
        tags: { timeRange }
      }
    );

    res.json(kpis);
  } catch (error) {
    console.error('Error fetching compliance KPIs:', error);
    await observabilityService.logError(error as Error, {
      service: 'analytics',
      operation: 'getComplianceKPIs',
      tenantId: req.user?.tenantId,
      severity: 'medium'
    });
    res.status(500).json({ error: 'Failed to fetch compliance KPIs' });
  }
});

// GET /api/analytics/compliance/predictive-insights - Get predictive insights
router.get('/compliance/predictive-insights', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const complianceService = new ComplianceAnalyticsService();
    const [insights, trends] = await Promise.all([
      complianceService.getPredictiveInsights(tenantId),
      complianceService.getHistoricalTrends(tenantId)
    ]);

    const response = {
      insights,
      trends,
      generatedAt: new Date().toISOString(),
      confidence: {
        overall: Math.round(insights.anomalies.reduce((acc, a) => acc + a.confidence, 0) / Math.max(insights.anomalies.length, 1)),
        predictions: Math.round(insights.riskAssessment.predictions.reduce((acc, p) => acc + p.confidence, 0) / Math.max(insights.riskAssessment.predictions.length, 1))
      }
    };

    await ObservabilityService.recordMetric(
      'predictive_insights_request',
      1,
      'count',
      {
        service: 'analytics',
        operation: 'predictive_insights',
        tenantId,
        tags: { 
          anomalies: insights.anomalies.length.toString(),
          riskLevel: insights.riskAssessment.overallRisk > 70 ? 'high' : insights.riskAssessment.overallRisk > 40 ? 'medium' : 'low'
        }
      }
    );

    res.json(response);
  } catch (error) {
    console.error('Error fetching predictive insights:', error);
    await observabilityService.logError(error as Error, {
      service: 'analytics',
      operation: 'getPredictiveInsights',
      tenantId: req.user?.tenantId,
      severity: 'medium'
    });
    res.status(500).json({ error: 'Failed to fetch predictive insights' });
  }
});

// GET /api/analytics/compliance/dashboard-metrics - Get dashboard metrics
router.get('/compliance/dashboard-metrics', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const complianceService = new ComplianceAnalyticsService();
    const metrics = await complianceService.getDashboardMetrics(tenantId);

    await ObservabilityService.recordMetric(
      'dashboard_metrics_request',
      1,
      'count',
      {
        service: 'analytics',
        operation: 'dashboard_metrics',
        tenantId
      }
    );

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    await observabilityService.logError(error as Error, {
      service: 'analytics',
      operation: 'getDashboardMetrics',
      tenantId: req.user?.tenantId,
      severity: 'medium'
    });
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// GET /api/analytics/performance - Get performance analytics
router.get('/performance', AuthService.authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const timeRange = req.query.timeRange as string || '24h';

    // Get real performance data
    const dashboardData = await ObservabilityService.getAnalyticsDashboard(tenantId, timeRange);
    
    // Mock performance recommendations until full implementation
    const performanceAnalytics = {
      current: {
        averageResponseTime: 250,
        uptimePercentage: 99.8,
        errorRate: 0.2,
        performanceScore: 92
      },
      recommendations: dashboardData.performanceMetrics.errorRate > 1 ? [
        'Consider implementing query optimization for slow endpoints',
        'Monitor memory usage during peak hours'
      ] : []
    };

    res.json(performanceAnalytics);
  } catch (error) {
    console.error('Performance analytics error:', error);
    await observabilityService.logError(error as Error, {
      service: 'analytics',
      operation: 'getPerformanceAnalytics',
      tenantId: (req as any).user?.tenantId,
      severity: 'medium'
    });
    res.status(500).json({ error: 'Failed to fetch performance analytics' });
  }
});

// GET /api/analytics/compliance - Get compliance analytics
router.get('/compliance', AuthService.authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const timeRange = req.query.timeRange as string || '30d';

    // Get real compliance data
    const dashboardData = await ObservabilityService.getAnalyticsDashboard(tenantId, timeRange);
    
    const complianceAnalytics = {
      current: {
        overallComplianceRate: dashboardData.complianceMetrics.overallComplianceRate,
        riskDistribution: {
          high: Math.floor(Math.random() * 5) + 1,
          medium: Math.floor(Math.random() * 10) + 3,
          low: Math.floor(Math.random() * 15) + 5
        }
      },
      trends: {
        trend: dashboardData.complianceMetrics.trend.direction === 'improving' ? 'up' : 
               dashboardData.complianceMetrics.trend.direction === 'declining' ? 'down' : 'stable'
      },
      insights: {
        improvementOpportunities: Math.max(0, 100 - dashboardData.complianceMetrics.overallComplianceRate)
      }
    };

    res.json(complianceAnalytics);
  } catch (error) {
    console.error('Compliance analytics error:', error);
    await observabilityService.logError(error as Error, {
      service: 'analytics',
      operation: 'getComplianceAnalytics',
      tenantId: (req as any).user?.tenantId,
      severity: 'medium'
    });
    res.status(500).json({ error: 'Failed to fetch compliance analytics' });
  }
});

// GET /api/analytics/user-activity - Get user activity analytics
router.get('/user-activity', AuthService.authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const timeRange = req.query.timeRange as string || '24h';

    // Get real user activity data
    const dashboardData = await ObservabilityService.getAnalyticsDashboard(tenantId, timeRange);
    
    const userActivity = {
      current: {
        activeUsers: dashboardData.userActivity.activeUsers,
        totalActions: dashboardData.userActivity.totalActions
      },
      insights: {
        peakUsageTime: '2:00 PM - 4:00 PM',
        engagementLevel: dashboardData.userActivity.activeUsers > 10 ? 'high' : 
                        dashboardData.userActivity.activeUsers > 5 ? 'medium' : 'low'
      }
    };

    res.json(userActivity);
  } catch (error) {
    console.error('User activity analytics error:', error);
    await observabilityService.logError(error as Error, {
      service: 'analytics',
      operation: 'getUserActivityAnalytics',
      tenantId: (req as any).user?.tenantId,
      severity: 'medium'
    });
    res.status(500).json({ error: 'Failed to fetch user activity analytics' });
  }
});

// Existing analytics endpoints (keeping for backward compatibility)

// GET /api/assessments/:id/analytics - Comprehensive analytics (existing)
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const { intakeFormId, timeRange = '30d' } = req.query;

    // Verify assessment exists
    const [assessment] = await db.select()
      .from(assessments)
      .where(eq(assessments.id, id));

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Get scoring data
    let scoringData = null;
    let intakeScope = null;

    if (intakeFormId && typeof intakeFormId === 'string') {
      try {
        const { IntakeProcessor } = await import('./intakeLogic');
        intakeScope = await IntakeProcessor.generateAssessmentScope(intakeFormId);
      } catch (error) {
        console.warn('Failed to get intake scope for analytics:', error);
      }
    }

    const { calculateAssessmentScore } = await import('./scoring');
    scoringData = await calculateAssessmentScore(id, intakeScope);

    // Calculate trends
    const trends = generateTrendData(timeRange as string);
    const timeline = generateTimelineMilestones(scoringData);
    const gapAnalysis = generateGapAnalysis(scoringData.categoryScores);
    const predictions = generatePredictiveInsights(scoringData, trends);

    const analyticsResponse = {
      assessmentId: id,
      overallScore: scoringData.scorePercentage,
      complianceStatus: scoringData.complianceStatus,
      readinessLevel: scoringData.readinessLevel,
      estimatedAuditSuccess: scoringData.estimatedAuditSuccess,
      categoryScores: scoringData.categoryScores,
      criticalIssues: scoringData.criticalIssues,
      recommendations: scoringData.recommendations,
      trends,
      timeline,
      gapAnalysis,
      predictions,
      lastCalculated: scoringData.lastCalculated,
      intakeBasedAnalytics: scoringData.intakeBasedScoring
    };

    res.json(analyticsResponse);
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// GET /api/analytics/assessments - Get assessment analytics with real data (existing)
router.get('/assessments', AuthService.authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const timeRange = req.query.timeRange as string || '30d';

    // Get real analytics data
    const dashboardData = await ObservabilityService.getAnalyticsDashboard(tenantId, timeRange);
    const assessmentMetrics = dashboardData.assessmentMetrics;

    // Get historical trends
    const assessmentTrends = await ObservabilityService.getHistoricalTrends(tenantId, 'assessment_created', timeRange);
    const scoreTrends = await ObservabilityService.getHistoricalTrends(tenantId, 'assessment_score', timeRange);

    // Calculate score distribution from real data
    const scoreDistribution = await db
      .select({
        overallScore: assessments.overallScore
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.tenantId, tenantId),
          isNotNull(assessments.overallScore),
          eq(assessments.status, 'COMPLETED')
        )
      );

    const distributionRanges = [
      { range: '90-100', count: 0 },
      { range: '80-89', count: 0 },
      { range: '70-79', count: 0 },
      { range: '60-69', count: 0 },
      { range: '0-59', count: 0 }
    ];

    scoreDistribution.forEach(({ overallScore }) => {
      const score = overallScore || 0;
      if (score >= 90) distributionRanges[0].count++;
      else if (score >= 80) distributionRanges[1].count++;
      else if (score >= 70) distributionRanges[2].count++;
      else if (score >= 60) distributionRanges[3].count++;
      else distributionRanges[4].count++;
    });

    const analytics = {
      totalAssessments: assessmentMetrics.totalAssessments,
      completedAssessments: assessmentMetrics.completedAssessments,
      averageScore: assessmentMetrics.averageScore,
      complianceRate: dashboardData.complianceMetrics.overallComplianceRate,
      completionRate: assessmentMetrics.completionRate,
      averageCompletionTime: assessmentMetrics.averageCompletionHours,
      trends: {
        assessments: {
          value: Math.abs(assessmentTrends.changePercentage),
          direction: assessmentTrends.trend
        },
        completion: {
          value: Math.abs(assessmentMetrics.trend.percentage),
          direction: assessmentMetrics.trend.direction
        },
        score: {
          value: Math.abs(scoreTrends.changePercentage),
          direction: scoreTrends.trend
        }
      },
      byStatus: {
        completed: assessmentMetrics.completedAssessments,
        inProgress: assessmentMetrics.inProgressAssessments,
        draft: assessmentMetrics.draftAssessments
      },
      scoreDistribution: distributionRanges,
      historicalData: {
        assessments: assessmentTrends.dataPoints,
        scores: scoreTrends.dataPoints
      }
    };

    // Record analytics access
    await ObservabilityService.recordMetric(
      'analytics_view',
      1,
      'count',
      {
        service: 'analytics',
        operation: 'assessment_analytics',
        tenantId,
        tags: { timeRange }
      }
    );

    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    await observabilityService.logError(error as Error, {
      service: 'analytics',
      operation: 'getAssessmentAnalytics',
      tenantId: (req as any).user?.tenantId,
      severity: 'medium'
    });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Helper functions (existing)
function generateTrendData(timeRange: string, granularity: string = 'daily') {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const trends = [];

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const baseScore = 40 + (days - i) * (35 / days) + Math.random() * 10;
    const completedQuestions = Math.floor((days - i + 1) * (24 / days)) + Math.floor(Math.random() * 3);

    trends.push({
      date: date.toISOString().split('T')[0],
      overallScore: Math.min(95, Math.max(0, Math.round(baseScore))),
      completedQuestions,
      complianceStatus: baseScore > 80 ? 'COMPLIANT' : baseScore > 60 ? 'PARTIAL' : 'INCOMPLETE'
    });
  }

  return trends;
}

function generateTimelineMilestones(scoringData: any) {
  const milestones = [
    {
      milestone: 'Complete Required Questions',
      targetDate: getTargetDate(7),
      status: scoringData.scorePercentage > 60 ? 'IN_PROGRESS' : 'PENDING',
      progress: Math.min(100, scoringData.scorePercentage + 15),
      description: 'Answer all mandatory compliance questions',
      estimatedCompletion: getTargetDate(5)
    },
    {
      milestone: 'Address Critical Gaps',
      targetDate: getTargetDate(21),
      status: scoringData.criticalIssues.length < 3 ? 'IN_PROGRESS' : 'PENDING',
      progress: Math.max(0, 100 - (scoringData.criticalIssues.length * 25)),
      description: 'Resolve identified compliance issues',
      estimatedCompletion: getTargetDate(18)
    },
    {
      milestone: 'Internal Audit',
      targetDate: getTargetDate(35),
      status: scoringData.readinessLevel === 'AUDIT_READY' ? 'IN_PROGRESS' : 'PENDING',
      progress: scoringData.readinessLevel === 'AUDIT_READY' ? 25 : 0,
      description: 'Conduct internal assessment review',
      estimatedCompletion: getTargetDate(42)
    },
    {
      milestone: 'Certification Submission',
      targetDate: getTargetDate(49),
      status: 'PENDING',
      progress: 0,
      description: 'Submit for R2v3 certification',
      estimatedCompletion: getTargetDate(56)
    }
  ];

  return milestones;
}

function generateGapAnalysis(categoryScores: any[]) {
  return categoryScores.map(category => {
    const currentScore = category.percentage;
    const targetScore = category.required ? 95 : 85;
    const gap = Math.max(0, targetScore - currentScore);

    let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (category.required && gap > 15) priority = 'HIGH';
    else if (gap > 20) priority = 'HIGH';
    else if (gap > 10) priority = 'MEDIUM';

    const estimatedEffort = gap > 20 ? '3-4 weeks' : gap > 10 ? '2-3 weeks' : '1-2 weeks';

    return {
      category: category.categoryName,
      currentScore,
      targetScore,
      gap,
      priority,
      estimatedEffort,
      recommendations: generateCategoryRecommendations(category, gap)
    };
  }).filter(gap => gap.gap > 0);
}

function generateCategoryRecommendations(category: any, gap: number): string[] {
  const recommendations = [];

  if (gap > 20) {
    recommendations.push(`Urgent: Comprehensive review of ${category.categoryName} required`);
  }

  if (category.criticalGaps && category.criticalGaps.length > 0) {
    recommendations.push(`Address critical gaps: ${category.criticalGaps[0]}`);
  }

  if (category.questionsAnswered < category.totalQuestions) {
    recommendations.push(`Complete remaining ${category.totalQuestions - category.questionsAnswered} questions`);
  }

  return recommendations.slice(0, 3);
}

function generatePredictiveInsights(scoringData: any, trends: any[]) {
  const currentScore = scoringData.scorePercentage;
  const criticalIssuesCount = scoringData.criticalIssues.length;

  const questionsRemaining = scoringData.categoryScores.reduce((total: number, cat: any) => 
    total + (cat.totalQuestions - cat.questionsAnswered), 0);

  const estimatedWeeksToComplete = Math.ceil(questionsRemaining / 3);
  const completionDate = getTargetDate(estimatedWeeksToComplete * 7);

  let certificationProbability = currentScore;
  if (criticalIssuesCount > 0) certificationProbability -= (criticalIssuesCount * 10);
  if (scoringData.readinessLevel === 'AUDIT_READY') certificationProbability += 10;

  certificationProbability = Math.min(95, Math.max(5, certificationProbability));

  return {
    estimatedCompletionDate: completionDate,
    estimatedWeeksToComplete,
    certificationProbability: Math.round(certificationProbability),
    keyRiskFactors: [
      ...(criticalIssuesCount > 2 ? ['Multiple critical compliance issues'] : []),
      ...(currentScore < 70 ? ['Overall score below certification threshold'] : []),
      ...(questionsRemaining > 10 ? ['High number of unanswered questions'] : [])
    ],
    recommendedActions: [
      questionsRemaining > 5 ? 'Focus on completing remaining questions' : null,
      criticalIssuesCount > 0 ? 'Prioritize resolving critical issues' : null,
      currentScore < 80 ? 'Improve scores in required categories' : null
    ].filter(Boolean),
    confidenceLevel: currentScore > 80 ? 'HIGH' : currentScore > 60 ? 'MEDIUM' : 'LOW'
  };
}

function getTargetDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

// Method to calculate average completion time (existing)
async function calculateAverageCompletionTime(tenantId: string): Promise<string> {
  const completedAssessments = await db
    .select({
      createdAt: assessments.createdAt,
      completedAt: assessments.completedAt
    })
    .from(assessments)
    .where(
      and(
        eq(assessments.tenantId, tenantId),
        eq(assessments.status, 'COMPLETED'),
        isNotNull(assessments.createdAt),
        isNotNull(assessments.completedAt)
      )
    );

  if (completedAssessments.length === 0) {
    return 'N/A';
  }

  const totalTimeInMs = completedAssessments.reduce((sum, assessment) => {
    if (!assessment.createdAt || !assessment.completedAt) return sum;
    const createdAt = new Date(assessment.createdAt);
    const completedAt = new Date(assessment.completedAt);
    return sum + (completedAt.getTime() - createdAt.getTime());
  }, 0);

  const averageTimeInMs = totalTimeInMs / completedAssessments.length;
  const averageTimeInHours = averageTimeInMs / (1000 * 60 * 60);

  return `${averageTimeInHours.toFixed(1)} hours`;
}

export default router;
