import { db } from '../db';
import { sql } from 'drizzle-orm';
import { 
  refreshClientOrgStatsSQL, 
  clientOrgStatsViewSQL,
  refreshAssessmentStatsSQL,
  assessmentStatsViewSQL
} from '../../shared/schema';

/**
 * Service for managing materialized views
 * Provides functions to refresh materialized views for performance optimization
 */
export class MaterializedViewService {
  
  /**
   * Refresh the client organization stats materialized view
   * This should be called after any operation that affects client org stats:
   * - Assessment creation
   * - Assessment status updates
   * - Assessment deletion
   * - Client facility creation/deletion
   * 
   * Uses REFRESH MATERIALIZED VIEW CONCURRENTLY to avoid locking
   */
  static async refreshClientOrgStats(): Promise<void> {
    try {
      console.log('[MaterializedView] Refreshing client_org_stats materialized view...');
      const startTime = Date.now();
      
      await db.execute(sql.raw(refreshClientOrgStatsSQL));
      
      const duration = Date.now() - startTime;
      console.log(`[MaterializedView] ✅ client_org_stats refreshed successfully in ${duration}ms`);
    } catch (error: any) {
      // Log error but don't throw - materialized view refresh should not break the main operation
      console.error('[MaterializedView] ❌ Error refreshing client_org_stats:', {
        error: error.message,
        code: error.code,
        detail: error.detail
      });
      
      // If the view doesn't exist yet, try to create it
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('[MaterializedView] View does not exist, attempting to create...');
        try {
          await this.createClientOrgStatsView();
          console.log('[MaterializedView] ✅ client_org_stats view created successfully');
        } catch (createError: any) {
          console.error('[MaterializedView] ❌ Error creating client_org_stats view:', {
            error: createError.message,
            code: createError.code
          });
        }
      }
    }
  }

  /**
   * Create the client organization stats materialized view
   * This is called automatically if the view doesn't exist when trying to refresh
   */
  static async createClientOrgStatsView(): Promise<void> {
    try {
      console.log('[MaterializedView] Creating client_org_stats materialized view...');
      await db.execute(sql.raw(clientOrgStatsViewSQL));
      console.log('[MaterializedView] ✅ client_org_stats view created successfully');
    } catch (error: any) {
      console.error('[MaterializedView] ❌ Error creating client_org_stats view:', {
        error: error.message,
        code: error.code,
        detail: error.detail
      });
      throw error;
    }
  }

  /**
   * Refresh the assessment stats materialized view
   * This should be called after any operation that affects assessment stats:
   * - Assessment creation
   * - Assessment status updates
   * - Assessment deletion
   * - Overall score updates
   * 
   * Uses REFRESH MATERIALIZED VIEW CONCURRENTLY to avoid locking
   */
  static async refreshAssessmentStats(): Promise<void> {
    try {
      console.log('[MaterializedView] Refreshing assessment_stats materialized view...');
      const startTime = Date.now();
      
      await db.execute(sql.raw(refreshAssessmentStatsSQL));
      
      const duration = Date.now() - startTime;
      console.log(`[MaterializedView] ✅ assessment_stats refreshed successfully in ${duration}ms`);
    } catch (error: any) {
      // Log error but don't throw - materialized view refresh should not break the main operation
      console.error('[MaterializedView] ❌ Error refreshing assessment_stats:', {
        error: error.message,
        code: error.code,
        detail: error.detail
      });
      
      // If the view doesn't exist yet, try to create it
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('[MaterializedView] View does not exist, attempting to create...');
        try {
          await this.createAssessmentStatsView();
          console.log('[MaterializedView] ✅ assessment_stats view created successfully');
        } catch (createError: any) {
          console.error('[MaterializedView] ❌ Error creating assessment_stats view:', {
            error: createError.message,
            code: createError.code
          });
        }
      }
    }
  }

  /**
   * Create the assessment stats materialized view
   * This is called automatically if the view doesn't exist when trying to refresh
   */
  static async createAssessmentStatsView(): Promise<void> {
    try {
      console.log('[MaterializedView] Creating assessment_stats materialized view...');
      await db.execute(sql.raw(assessmentStatsViewSQL));
      console.log('[MaterializedView] ✅ assessment_stats view created successfully');
    } catch (error: any) {
      console.error('[MaterializedView] ❌ Error creating assessment_stats view:', {
        error: error.message,
        code: error.code,
        detail: error.detail
      });
      throw error;
    }
  }

  /**
   * Initialize all materialized views
   * This should be called during application startup or migration
   */
  static async initializeViews(): Promise<void> {
    console.log('[MaterializedView] Initializing materialized views...');
    try {
      await this.createClientOrgStatsView();
      await this.refreshClientOrgStats();
      await this.createAssessmentStatsView();
      await this.refreshAssessmentStats();
      console.log('[MaterializedView] ✅ All materialized views initialized');
    } catch (error: any) {
      console.error('[MaterializedView] ❌ Error initializing materialized views:', {
        error: error.message,
        code: error.code
      });
      // Don't throw - let the application continue even if views fail to initialize
    }
  }
}

// Export singleton functions for convenience
export const refreshClientOrgStats = () => MaterializedViewService.refreshClientOrgStats();
export const createClientOrgStatsView = () => MaterializedViewService.createClientOrgStatsView();
export const refreshAssessmentStats = () => MaterializedViewService.refreshAssessmentStats();
export const createAssessmentStatsView = () => MaterializedViewService.createAssessmentStatsView();
export const initializeViews = () => MaterializedViewService.initializeViews();
