import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import type { AuthenticatedRequest } from '../services/authService';
import { DashboardAnalyticsService } from '../services/dashboardAnalyticsService';
import { ConsultantFeaturesService } from '../services/consultantFeaturesService';
import { observabilityMiddleware } from '../middleware/observabilityMiddleware';

const router = Router();

// Apply middleware
router.use(AuthService.authMiddleware);
router.use(observabilityMiddleware);

/**
 * GET /api/dashboard/kpis
 * Get comprehensive KPIs for dashboard header
 */
router.get('/kpis', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const kpis = await DashboardAnalyticsService.getDashboardKPIs(tenantId);

    res.json({
      success: true,
      kpis,
    });
  } catch (error) {
    console.error('Error getting dashboard KPIs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard KPIs',
    });
  }
});

/**
 * GET /api/dashboard/readiness
 * Get readiness snapshot with scores and gap breakdown
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const assessmentId = req.query.assessmentId as string | undefined;

    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const readiness = await DashboardAnalyticsService.getReadinessSnapshot(
      tenantId,
      assessmentId
    );

    res.json({
      success: true,
      readiness,
    });
  } catch (error) {
    console.error('Error getting readiness snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get readiness snapshot',
    });
  }
});

/**
 * GET /api/dashboard/gaps/:assessmentId
 * Get detailed gap analysis with recommendations
 */
router.get('/gaps/:assessmentId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const { assessmentId } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const gapAnalysis = await DashboardAnalyticsService.getGapAnalysis(
      tenantId,
      assessmentId
    );

    res.json({
      success: true,
      gapAnalysis,
    });
  } catch (error) {
    console.error('Error getting gap analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get gap analysis',
    });
  }
});

/**
 * GET /api/dashboard/activity
 * Get activity feed with recent events
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const activities = await DashboardAnalyticsService.getActivityFeed(
      tenantId,
      limit
    );

    res.json({
      success: true,
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error('Error getting activity feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity feed',
    });
  }
});

/**
 * GET /api/dashboard/deadlines
 * Get upcoming deadlines and reminders
 */
router.get('/deadlines', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const deadlines = await DashboardAnalyticsService.getUpcomingDeadlines(tenantId);

    res.json({
      success: true,
      deadlines,
      count: deadlines.length,
    });
  } catch (error) {
    console.error('Error getting deadlines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deadlines',
    });
  }
});

/**
 * GET /api/dashboard/overview - Get comprehensive dashboard data
 */
router.get('/overview', async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenant!.id;
    const userId = req.user!.id;
    const tenantType = req.tenant!.tenantType;

    // Route to consultant dashboard if consultant user
    if (tenantType === 'CONSULTANT') {
      console.log(`🏢 Consultant dashboard request from user ${userId}`);

      try {
        const consultantDashboard = await ConsultantFeaturesService.getConsultantDashboard(userId);
        return res.json({ 
          success: true, 
          dashboard: consultantDashboard,
          dashboardType: 'consultant' 
        });
      } catch (consultantError) {
        console.error('Error getting consultant dashboard, using defaults:', consultantError);
        // Return safe defaults for consultant dashboard
        return res.json({
          success: true,
          dashboard: {
            clientSummary: { totalClients: 0, activeAssessments: 0, completedCertifications: 0 },
            recentActivity: [],
            performanceMetrics: {
              averageClientScore: 0,
              clientRetentionRate: 0,
              averageTimeToCertification: 0
            },
            clientAlerts: []
          },
          dashboardType: 'consultant'
        });
      }
    }

    // Standard business dashboard
    console.log(`🏭 Business dashboard request for tenant ${tenantId}`);

    // Use Promise.allSettled to handle individual failures gracefully
    const results = await Promise.allSettled([
      DashboardAnalyticsService.getDashboardKPIs(tenantId),
      DashboardAnalyticsService.getReadinessSnapshot(tenantId),
      DashboardAnalyticsService.getActivityFeed(tenantId),
      DashboardAnalyticsService.getUpcomingDeadlines(tenantId)
    ]);

    // Extract results with fallbacks for failed promises
    const kpis = results[0].status === 'fulfilled' ? results[0].value : {
      totalAssessments: 0,
      inProgress: 0,
      completed: 0,
      needsReview: 0,
      averageReadiness: 0,
      certificationReady: 0,
      criticalGaps: 0,
      facilities: 0,
    };

    const readiness = results[1].status === 'fulfilled' ? results[1].value : {
      overallScore: 0,
      readinessLevel: 'Not Ready' as const,
      coreRequirements: { cr1: 0, cr2: 0, cr3: 0, cr4: 0, cr5: 0, cr6: 0, cr7: 0, cr8: 0, cr9: 0, cr10: 0 },
      appendices: { appA: 0, appB: 0, appC: 0, appD: 0, appE: 0 },
    };

    const activities = results[2].status === 'fulfilled' ? results[2].value : [];
    const deadlines = results[3].status === 'fulfilled' ? results[3].value : [];

    // Log any failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const methodNames = ['getDashboardKPIs', 'getReadinessSnapshot', 'getActivityFeed', 'getUpcomingDeadlines'];
        console.warn(`⚠️  ${methodNames[index]} failed, using defaults:`, result.reason);
      }
    });

    const dashboard = {
      kpis,
      readiness,
      activities,
      deadlines
    };

    res.json({ 
      success: true, 
      dashboard,
      dashboardType: 'business'
    });
  } catch (error) {
    console.error('Error getting dashboard overview:', error);
    // Return safe defaults instead of 500 to prevent dashboard from breaking
    res.json({ 
      success: true, 
      dashboard: {
        kpis: {
          totalAssessments: 0,
          inProgress: 0,
          completed: 0,
          needsReview: 0,
          averageReadiness: 0,
          certificationReady: 0,
          criticalGaps: 0,
          facilities: 0,
        },
        readiness: {
          overallScore: 0,
          readinessLevel: 'Not Ready' as const,
          coreRequirements: { cr1: 0, cr2: 0, cr3: 0, cr4: 0, cr5: 0, cr6: 0, cr7: 0, cr8: 0, cr9: 0, cr10: 0 },
          appendices: { appA: 0, appB: 0, appC: 0, appD: 0, appE: 0 },
        },
        activities: [],
        deadlines: []
      },
      dashboardType: 'business'
    });
  }
});

export default router;