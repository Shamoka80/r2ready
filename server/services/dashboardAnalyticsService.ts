import { db } from '../db';
import {
  assessments,
  answers,
  questions,
  clauses,
  users,
  facilityProfiles,
  intakeForms,
  evidenceFiles,
  auditLog,
  licenses,
  tenants,
  organizationProfiles
} from '@shared/schema';
import { eq, and, sql, gte, lte, desc, count, isNotNull, inArray } from 'drizzle-orm';
import ObservabilityService from './observabilityService';

export interface DashboardKPIs {
  totalAssessments: number;
  inProgress: number;
  completed: number;
  needsReview: number;
  averageReadiness: number;
  certificationReady: number;
  criticalGaps: number;
  facilities: number;
}

export interface ReadinessSnapshot {
  overallScore: number;
  readinessLevel: 'Not Ready' | 'Needs Work' | 'Approaching Ready' | 'Certification Ready';
  coreRequirements: {
    cr1: number;
    cr2: number;
    cr3: number;
    cr4: number;
    cr5: number;
    cr6: number;
    cr7: number;
    cr8: number;
    cr9: number;
    cr10: number;
  };
  appendices: {
    appA: number;
    appB: number;
    appC: number;
    appD: number;
    appE: number;
    appF: number;
    appG: number;
  };
  gapBreakdown: {
    critical: number;
    important: number;
    minor: number;
  };
}

export interface GapAnalysis {
  criticalGaps: Array<{
    requirementId: string;
    requirementName: string;
    currentStatus: string;
    severity: 'critical' | 'important' | 'minor';
    recommendation: string;
    estimatedEffort: string;
  }>;
  prioritizedActions: Array<{
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    priority: number;
  }>;
}

export interface ActivityEvent {
  id: string;
  type: 'assessment_created' | 'assessment_completed' | 'user_added' | 'report_exported' | 'facility_added' | 'license_purchased';
  description: string;
  userId?: string;
  userName?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  type: 'assessment' | 'audit' | 'license_renewal' | 'certification_prep';
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'upcoming' | 'due_soon' | 'overdue';
  relatedEntity?: string;
}

/**
 * Dashboard Analytics Service
 * Provides comprehensive analytics and metrics for dashboard display
 */
export class DashboardAnalyticsService {

  /**
   * Get comprehensive KPIs for dashboard header
   * Uses materialized view for optimized performance
   */
  static async getDashboardKPIs(tenantId: string): Promise<DashboardKPIs> {
    try {
      // Try to get assessment stats from materialized view first
      let stats: any = null;
      let usingMaterializedView = false;
      
      try {
        const statsResult = await db.execute(sql`
          SELECT 
            total_assessments,
            in_progress_count,
            completed_count,
            under_review_count,
            avg_readiness_score,
            certification_ready_count
          FROM assessment_stats
          WHERE tenant_id = ${tenantId}
        `);

        // Safe access to stats result - handle both Neon and PostgreSQL result structures
        const statsResultAny = statsResult as any;
        if (statsResultAny && statsResultAny.rows && Array.isArray(statsResultAny.rows) && statsResultAny.rows.length > 0) {
          stats = statsResultAny.rows[0];
          usingMaterializedView = true;
        } else if (Array.isArray(statsResultAny) && statsResultAny.length > 0) {
          stats = statsResultAny[0];
          usingMaterializedView = true;
        }
      } catch (viewError: any) {
        // Materialized view doesn't exist or query failed - fall back to direct calculation
        console.warn(`⚠️ Materialized view not available, calculating stats directly:`, viewError.message);
        usingMaterializedView = false;
      }

      // If materialized view didn't work, calculate stats directly
      if (!stats) {
        const allAssessments = await db
          .select({
            status: assessments.status,
            overallScore: assessments.overallScore,
          })
          .from(assessments)
          .where(eq(assessments.tenantId, tenantId));

        const totalAssessments = allAssessments.length;
        const inProgressCount = allAssessments.filter(a => a.status === 'IN_PROGRESS').length;
        const completedCount = allAssessments.filter(a => a.status === 'COMPLETED').length;
        const underReviewCount = allAssessments.filter(a => a.status === 'UNDER_REVIEW').length;
        
        const completedWithScores = allAssessments.filter(
          a => a.status === 'COMPLETED' && a.overallScore !== null
        );
        const avgReadinessScore = completedWithScores.length > 0
          ? completedWithScores.reduce((sum, a) => sum + Number(a.overallScore || 0), 0) / completedWithScores.length
          : 0;
        
        const certificationReadyCount = allAssessments.filter(
          a => a.status === 'COMPLETED' && a.overallScore !== null && Number(a.overallScore) >= 90
        ).length;

        stats = {
          total_assessments: totalAssessments,
          in_progress_count: inProgressCount,
          completed_count: completedCount,
          under_review_count: underReviewCount,
          avg_readiness_score: avgReadinessScore,
          certification_ready_count: certificationReadyCount,
        };
      }

      // Get facility count (separate query - not in materialized view)
      const facilityCountResult = await db
        .select({ count: count() })
        .from(facilityProfiles)
        .where(eq(facilityProfiles.tenantId, tenantId));
      
      const facilityCount = facilityCountResult.length > 0 ? facilityCountResult[0] : null;

      // Count critical gaps (separate query - complex join, better left as-is)
      let criticalGapCount = 0;
      try {
        const criticalAnswers = await db
          .select({ count: count() })
          .from(answers)
          .innerJoin(assessments, eq(answers.assessmentId, assessments.id))
          .innerJoin(questions, eq(answers.questionId, questions.id))
          .where(
            and(
              eq(assessments.tenantId, tenantId),
              sql`${answers.value}::text IN ('No', 'Partial', 'Not Applicable')`
            )
          );

        criticalGapCount = (criticalAnswers && Array.isArray(criticalAnswers) && criticalAnswers.length > 0)
          ? Number(criticalAnswers[0]?.count || 0)
          : 0;
      } catch (criticalError) {
        console.warn('⚠️  Error getting critical gaps, using default:', criticalError);
        criticalGapCount = 0;
      }

      const kpis = {
        totalAssessments: Number(stats?.total_assessments || 0),
        inProgress: Number(stats?.in_progress_count || 0),
        completed: Number(stats?.completed_count || 0),
        needsReview: Number(stats?.under_review_count || 0),
        averageReadiness: Math.round(Number(stats?.avg_readiness_score || 0)),
        certificationReady: Number(stats?.certification_ready_count || 0),
        criticalGaps: Math.max(0, criticalGapCount),
        facilities: Number(facilityCount?.count || 0),
      };

      console.log(`✅ Dashboard KPIs calculated for tenant ${tenantId} (${usingMaterializedView ? 'using materialized view' : 'calculated directly'}):`, kpis);
      return kpis;
    } catch (error) {
      console.error('Error getting dashboard KPIs:', error);
      // Return safe defaults instead of throwing to prevent dashboard from breaking
      return {
        totalAssessments: 0,
        inProgress: 0,
        completed: 0,
        needsReview: 0,
        averageReadiness: 0,
        certificationReady: 0,
        criticalGaps: 0,
        facilities: 0,
      };
    }
  }

  /**
   * Get readiness snapshot for visual display
   */
  static async getReadinessSnapshot(tenantId: string, assessmentId?: string): Promise<ReadinessSnapshot> {
    try {
      let targetAssessmentId = assessmentId;

      // If no assessment specified, get the most recent one (IN_PROGRESS or COMPLETED)
      if (!targetAssessmentId) {
        try {
          // First try to get a completed assessment
          let latestAssessmentResult = await db
            .select({ id: assessments.id })
            .from(assessments)
            .where(
              and(
                eq(assessments.tenantId, tenantId),
                eq(assessments.status, 'COMPLETED')
              )
            )
            .orderBy(desc(assessments.completedAt))
            .limit(1);

          let latestAssessment = (latestAssessmentResult && Array.isArray(latestAssessmentResult) && latestAssessmentResult.length > 0)
            ? latestAssessmentResult[0]
            : null;

          // If no completed assessment, get the most recent in-progress one
          if (!latestAssessment) {
            latestAssessmentResult = await db
              .select({ id: assessments.id })
              .from(assessments)
              .where(
                and(
                  eq(assessments.tenantId, tenantId),
                  eq(assessments.status, 'IN_PROGRESS')
                )
              )
              .orderBy(desc(assessments.updatedAt))
              .limit(1);

            latestAssessment = (latestAssessmentResult && Array.isArray(latestAssessmentResult) && latestAssessmentResult.length > 0)
              ? latestAssessmentResult[0]
              : null;
          }

          // If still no assessment, get the most recent one regardless of status
          if (!latestAssessment) {
            latestAssessmentResult = await db
              .select({ id: assessments.id })
              .from(assessments)
              .where(eq(assessments.tenantId, tenantId))
              .orderBy(desc(assessments.updatedAt))
              .limit(1);

            latestAssessment = (latestAssessmentResult && Array.isArray(latestAssessmentResult) && latestAssessmentResult.length > 0)
              ? latestAssessmentResult[0]
              : null;
          }

          if (!latestAssessment) {
            // Return default empty snapshot if no assessments exist at all
            console.log('⚠️  No assessments found for tenant, returning default snapshot');
            return this.getDefaultReadinessSnapshot();
          }

          targetAssessmentId = latestAssessment.id;
          console.log(`✅ Using assessment ${targetAssessmentId} for readiness snapshot`);
        } catch (error) {
          console.warn('⚠️  Error getting latest assessment, using default snapshot:', error);
          return this.getDefaultReadinessSnapshot();
        }
      }

      // Ensure we have a valid assessment ID
      if (!targetAssessmentId) {
        return this.getDefaultReadinessSnapshot();
      }

      // Get assessment with scores
      let assessment: any = null;
      try {
        const assessmentResult = await db
          .select()
          .from(assessments)
          .where(eq(assessments.id, targetAssessmentId));

        assessment = (assessmentResult && Array.isArray(assessmentResult) && assessmentResult.length > 0)
          ? assessmentResult[0]
          : null;
      } catch (error) {
        console.warn('⚠️  Error getting assessment, using default snapshot:', error);
        return this.getDefaultReadinessSnapshot();
      }

      if (!assessment) {
        return this.getDefaultReadinessSnapshot();
      }

      // Calculate scores by core requirement and appendix
      const coreScores = await this.calculateCoreRequirementScores(targetAssessmentId);
      const appendixScores = await this.calculateAppendixScores(targetAssessmentId);
      const gapBreakdown = await this.calculateGapBreakdown(targetAssessmentId);

      // Always calculate overall score from current core requirement scores for accuracy
      // This ensures the score reflects actual progress, not a potentially outdated database value
      let overallScore = 0;
      const crValues = Object.values(coreScores) as number[];
      if (crValues.length > 0) {
        const sum = crValues.reduce((acc, score) => acc + Number(score || 0), 0);
        overallScore = Math.round(sum / crValues.length);
        console.log(`📊 Calculated overall score from core requirements: ${overallScore}% (average of ${crValues.length} CRs)`);
      } else {
        // Fallback to database value if no core requirements calculated
        overallScore = Math.max(0, Math.min(Math.round(Number(assessment.overallScore) || 0), 100));
        console.log(`⚠️  No core requirements found, using database overallScore: ${overallScore}%`);
      }
      
      // Ensure score is always between 0 and 100
      overallScore = Math.max(0, Math.min(overallScore, 100));
      
      const readinessLevel = this.determineReadinessLevel(overallScore);

      return {
        overallScore,
        readinessLevel,
        coreRequirements: coreScores,
        appendices: appendixScores,
        gapBreakdown,
      };
    } catch (error) {
      console.error('Error getting readiness snapshot:', error);
      return this.getDefaultReadinessSnapshot();
    }
  }

  /**
   * Get gap analysis with prioritized recommendations
   */
  static async getGapAnalysis(tenantId: string, assessmentId: string): Promise<GapAnalysis> {
    try {
      // Get all non-compliant answers
      const gaps = await db
        .select({
          questionId: questions.id,
          questionText: questions.text,
          clauseRef: clauses.ref,
          answerValue: answers.value,
          notes: answers.notes,
        })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .innerJoin(clauses, eq(questions.clauseId, clauses.id))
        .innerJoin(assessments, eq(answers.assessmentId, assessments.id))
        .where(
          and(
            eq(assessments.tenantId, tenantId),
            eq(answers.assessmentId, assessmentId),
            sql`${answers.value}::text IN ('No', 'Partial')`
          )
        )
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
    } catch (error) {
      console.error('Error getting gap analysis:', error);
      return { criticalGaps: [], prioritizedActions: [] };
    }
  }

  /**
   * Get activity feed events
   */
  static async getActivityFeed(tenantId: string, limit = 20): Promise<ActivityEvent[]> {
    try {
      const activities: ActivityEvent[] = [];

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
        .filter((id): id is string => id !== null);

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
          metadata: entry.metadata as Record<string, any> || undefined,
        });
      });

      return activities;
    } catch (error) {
      console.error('Error getting activity feed:', error);
      return [];
    }
  }

  /**
   * Get upcoming deadlines
   */
  static async getUpcomingDeadlines(tenantId: string): Promise<UpcomingDeadline[]> {
    try {
      const deadlines: UpcomingDeadline[] = [];
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
        .where(
          and(
            eq(assessments.tenantId, tenantId),
            eq(assessments.status, 'IN_PROGRESS')
          )
        );

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
        .where(
          and(
            eq(licenses.tenantId, tenantId),
            eq(licenses.isActive, true),
            isNotNull(licenses.expiresAt),
            lte(licenses.expiresAt, thirtyDaysFromNow)
          )
        );

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
    } catch (error) {
      console.error('Error getting upcoming deadlines:', error);
      return [];
    }
  }

  // Helper methods

  private static async calculateCoreRequirementScores(assessmentId: string) {
    const scores = {
      cr1: 0, cr2: 0, cr3: 0, cr4: 0, cr5: 0,
      cr6: 0, cr7: 0, cr8: 0, cr9: 0, cr10: 0,
    };

    try {
      // Get all answers with clause references
      const answersWithClauses = await db
        .select({
          clauseRef: clauses.ref,
          answerValue: answers.value,
          questionId: questions.id,
        })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .innerJoin(clauses, eq(questions.clauseId, clauses.id))
        .where(eq(answers.assessmentId, assessmentId));

      console.log(`📊 Found ${answersWithClauses.length} answers with clauses for assessment ${assessmentId}`);

      // Count answers per core requirement
      const crCounts = new Map<string, { total: number; score: number }>();

      answersWithClauses.forEach(({ clauseRef, answerValue }) => {
        const crMatch = clauseRef?.match(/CR(\d+)/);
        if (crMatch) {
          const crKey = `cr${crMatch[1]}`;
          if (!crCounts.has(crKey)) {
            crCounts.set(crKey, { total: 0, score: 0 });
          }

          const crData = crCounts.get(crKey)!;
          crData.total++;

          // Scoring: Yes=100, Partial=50, No=0, N/A=0
          const answerScore = answerValue === 'Yes' ? 100 :
                            answerValue === 'Partial' ? 50 : 0;
          crData.score += answerScore;
        }
      });

      console.log(`📊 Core requirement counts:`, Object.fromEntries(crCounts));

      // Calculate averages for each core requirement
      crCounts.forEach((data, crKey) => {
        if (crKey in scores) {
          scores[crKey as keyof typeof scores] = data.total > 0 ?
            Math.round(data.score / data.total) : 0;
        }
      });

      console.log(`✅ Core requirement scores calculated for assessment ${assessmentId}:`, scores);
      return scores;
    } catch (error) {
      console.error(`❌ Error calculating core requirement scores: ${error}`);
      return scores; // Return zeros on error
    }
  }

  private static async calculateAppendixScores(assessmentId: string) {
    const scores = {
      appA: 0, appB: 0, appC: 0, appD: 0,
      appE: 0, appF: 0, appG: 0,
    };

    try {
      // Get all answers with clause references
      const answersWithClauses = await db
        .select({
          clauseRef: clauses.ref,
          answerValue: answers.value,
          questionId: questions.id,
        })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .innerJoin(clauses, eq(questions.clauseId, clauses.id))
        .where(eq(answers.assessmentId, assessmentId));

      // Count answers per appendix
      const appCounts = new Map<string, { total: number; score: number }>();

      answersWithClauses.forEach(({ clauseRef, answerValue }) => {
        // Match patterns like "APP A", "App A", "APP-A", "AppA", etc.
        const appMatch = clauseRef?.match(/(?:APP|App)[\s-]?([A-G])/i);
        if (appMatch) {
          const appLetter = appMatch[1].toUpperCase();
          const appKey = `app${appLetter}`;
          
          if (!appCounts.has(appKey)) {
            appCounts.set(appKey, { total: 0, score: 0 });
          }

          const appData = appCounts.get(appKey)!;
          appData.total++;

          // Scoring: Yes=100, Partial=50, No=0, N/A=0
          const answerScore = answerValue === 'Yes' ? 100 :
                            answerValue === 'Partial' ? 50 : 0;
          appData.score += answerScore;
        }
      });

      // Calculate averages for each appendix
      appCounts.forEach((data, appKey) => {
        if (appKey in scores) {
          scores[appKey as keyof typeof scores] = data.total > 0 ?
            Math.round(data.score / data.total) : 0;
        }
      });

      console.log(`✅ Appendix scores calculated for assessment ${assessmentId}`);
      return scores;
    } catch (error) {
      console.error(`❌ Error calculating appendix scores: ${error}`);
      return scores; // Return zeros on error
    }
  }

  private static async calculateGapBreakdown(assessmentId: string) {
    try {
      const gaps = await db
        .select({
          answerValue: answers.value,
          clauseRef: clauses.ref,
        })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .innerJoin(clauses, eq(questions.clauseId, clauses.id))
        .where(
          and(
            eq(answers.assessmentId, assessmentId),
            sql`${answers.value}::text IN ('No', 'Partial')`
          )
        );

      console.log(`🔍 Found ${gaps.length} gaps (No/Partial answers) for assessment ${assessmentId}`);

      let critical = 0;
      let important = 0;
      let minor = 0;

      gaps.forEach(gap => {
        const severity = this.determineSeverity(gap.clauseRef || '');
        if (severity === 'critical') critical++;
        else if (severity === 'important') important++;
        else minor++;
      });

      console.log(`🔍 Gap breakdown: Critical=${critical}, Important=${important}, Minor=${minor}`);
      return { critical, important, minor };
    } catch (error) {
      console.error(`❌ Error calculating gap breakdown for assessment ${assessmentId}:`, error);
      return { critical: 0, important: 0, minor: 0 };
    }
  }

  private static determineSeverity(clauseRef: string): 'critical' | 'important' | 'minor' {
    // Core requirements are critical, appendices are important/minor
    if (clauseRef.includes('CR')) return 'critical';
    if (clauseRef.includes('App')) return 'important';
    return 'minor';
  }

  private static generateRecommendation(questionText: string, answerValue: string): string {
    if (answerValue === 'No') {
      return `Implement controls to address: ${questionText.substring(0, 100)}...`;
    }
    return `Strengthen existing controls for: ${questionText.substring(0, 100)}...`;
  }

  private static estimateEffort(clauseRef: string): string {
    // Simplified effort estimation
    if (clauseRef.includes('CR1') || clauseRef.includes('CR2')) return '2-4 weeks';
    if (clauseRef.includes('CR')) return '1-2 weeks';
    return '1-5 days';
  }

  private static generatePrioritizedActions(gaps: any[]) {
    return gaps.slice(0, 10).map((gap, index) => ({
      action: `Address ${gap.requirementName.substring(0, 80)}...`,
      impact: gap.severity === 'critical' ? 'high' as const : gap.severity === 'important' ? 'medium' as const : 'low' as const,
      effort: gap.estimatedEffort.includes('weeks') ? 'high' as const : 'medium' as const,
      priority: index + 1,
    }));
  }

  private static determineReadinessLevel(score: number): ReadinessSnapshot['readinessLevel'] {
    if (score >= 90) return 'Certification Ready';
    if (score >= 75) return 'Approaching Ready';
    if (score >= 50) return 'Needs Work';
    return 'Not Ready';
  }

  private static getDefaultReadinessSnapshot(): ReadinessSnapshot {
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

  private static mapActionToActivityType(action: string): ActivityEvent['type'] {
    if (action.includes('assessment') && action.includes('create')) return 'assessment_created';
    if (action.includes('assessment') && action.includes('complete')) return 'assessment_completed';
    if (action.includes('user') && action.includes('add')) return 'user_added';
    if (action.includes('report') || action.includes('export')) return 'report_exported';
    if (action.includes('facility')) return 'facility_added';
    if (action.includes('license')) return 'license_purchased';
    return 'assessment_created';
  }

  private static generateActivityDescription(action: string, resource: string, userName?: string): string {
    const actor = userName || 'System';
    return `${actor} ${action} ${resource}`;
  }

  // --- New Helper Methods for Real Gap Analysis ---

  /**
   * Calculates real gap analysis data, including readiness score, critical gaps,
   * completion percentage, and compliance status.
   * This method replaces the mock data calculation.
   */
  private static async calculateRealGapAnalysis(tenantId: string, facilityIds: string[]): Promise<{
    readinessScore: number;
    criticalGapCount: number;
    completionPercentage: number;
    complianceStatus: 'Compliant' | 'Non-Compliant' | 'Partially Compliant';
  }> {
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
          } else if (answerScore > 0) {
            partiallyCompliantCount++;
          }
        });
      });

      const averageScore = (totalScore / (assessmentResults.length * totalQuestions)) * 100;
      const readinessScore = Math.max(0, Math.min(100, averageScore));
      const completionPercentage = (compliantCount / (assessmentResults.length * totalQuestions)) * 100;

      let complianceStatus: 'Compliant' | 'Non-Compliant' | 'Partially Compliant';
      if (criticalGaps === 0 && completionPercentage === 100) {
        complianceStatus = 'Compliant';
      } else if (criticalGaps > 0 || completionPercentage < 100) {
        complianceStatus = 'Non-Compliant';
      } else {
        complianceStatus = 'Partially Compliant';
      }

      return {
        readinessScore,
        criticalGapCount: criticalGaps,
        completionPercentage,
        complianceStatus,
      };
    } catch (error) {
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
  private static async getAssessmentResultsForTenant(tenantId: string, facilityIds: string[]): Promise<{
    assessmentResults: Array<{
      assessmentId: string;
      facilityId: string;
      questions: Array<{
        questionId: string;
        text: string;
        answerValue: string | null;
        severity: 'critical' | 'important' | 'minor';
      }>;
    }>;
    totalQuestions: number;
  }> {
    const assessmentsQuery = db
      .select({
        id: assessments.id,
        facilityId: assessments.facilityId,
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.tenantId, tenantId),
          facilityIds.length > 0 ? inArray(assessments.facilityId, facilityIds) : undefined,
          eq(assessments.status, 'COMPLETED') // Only consider completed assessments
        )
      );

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
        clauseRef: clauses.ref,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .innerJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(inArray(answers.assessmentId, assessmentIds));

    const totalQuestions = await db
      .select({ count: count() })
      .from(questions)
      .innerJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(sql`upper(clauses.clause_ref) LIKE 'CR%' OR upper(clauses.clause_ref) LIKE 'APP%'`); // Assuming CR and APP are the relevant question types

    const groupedResults: Record<string, {
      assessmentId: string;
      facilityId: string;
      questions: Array<{
        questionId: string;
        text: string;
        answerValue: string | null;
        severity: 'critical' | 'important' | 'minor';
      }>;
    }> = {};

    const assessmentsList = await assessmentsQuery;
    questionsAndAnswers.forEach(qa => {
      const { assessmentId, questionId, questionText, answerValue, clauseRef } = qa;
      const facilityId = (assessmentsList as any[]).find((a: any) => a.id === assessmentId)?.facilityId;

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
          answerValue: answerValue as string | null,
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
  private static getScoreForAnswer(answerValue: string | null): number {
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
  private static async calculatePredictiveInsights(assessments: any, tenant: any): Promise<any> {
    // Mock implementation for predictive insights
    return {
      completionEstimate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      identifiedRisks: ['Data integrity issues', 'Inconsistent reporting'],
      actionableRecommendations: ['Implement data validation checks', 'Standardize reporting templates'],
      criticalPath: ['Report Export Engine', 'Analytics Dashboard']
    };
  }

  private static async getBenchmarkComparisons(tenant: any): Promise<any> {
    // Mock implementation for benchmark comparisons
    return {
      industryPercentile: 75,
      peerAverageScore: 82,
      bestPracticeScore: 95
    };
  }

  private static async calculateTrendAnalysis(assessments: any): Promise<any> {
    // Mock implementation for trend analysis
    return {
      trend: 'stable', // 'improving', 'declining', 'stable'
      velocityScore: 0.8, // Score from 0 to 1
      recentChange: '+2%'
    };
  }
}

export default DashboardAnalyticsService;