import { db, sql } from '../db';

/**
 * Query Monitoring Service
 * 
 * Provides database query performance monitoring using pg_stat_statements
 * and custom slow query logging.
 * 
 * Features:
 * - pg_stat_statements statistics collection
 * - Slow query detection and logging
 * - Performance metrics aggregation
 * - Automatic log retention management
 * 
 * Guardrails:
 * - 30-day retention window for slow query logs
 * - pg_stat_statements quota monitoring
 * - Automatic cleanup to prevent unbounded growth
 */

export interface QueryStats extends Record<string, unknown> {
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  maxTime: number;
  rows: number;
}

export interface SlowQuery extends Record<string, unknown> {
  id: string;
  query: string;
  duration: number;
  timestamp: Date;
  caller?: string;
}

export interface PerformanceMetrics {
  activeConnections: number;
  queryThroughput: number;
  cacheHitRatio: number;
  slowestQueries: QueryStats[];
  databaseSize: string;
  indexUsage: {
    tableName: string;
    indexName: string;
    scans: number;
  }[];
}

export class QueryMonitoringService {
  /**
   * Check if pg_stat_statements extension is available
   */
  static async isPgStatStatementsAvailable(): Promise<boolean> {
    try {
      // Use sql directly with postgres-js - it returns rows as an array
      const result = await sql<{ available: boolean }>`
        SELECT EXISTS(
          SELECT 1 FROM pg_available_extensions 
          WHERE name = 'pg_stat_statements'
        ) as available
      `;
      return result[0]?.available === true;
    } catch (error) {
      console.warn('pg_stat_statements availability check failed:', error);
      return false;
    }
  }

  /**
   * Enable pg_stat_statements extension if not already enabled
   * Note: This may fail if extension permissions are restricted or quota is exceeded
   */
  static async enablePgStatStatements(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if already enabled - use sql directly with postgres-js
      const checkRows = await sql<{ enabled: boolean }>`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as enabled
      `;
      
      if (checkRows[0]?.enabled) {
        return { success: true, message: 'pg_stat_statements already enabled' };
      }

      // Try to enable (may fail if permissions are restricted)
      await sql`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`;
      return { success: true, message: 'pg_stat_statements enabled successfully' };
    } catch (error: any) {
      // Expected to fail on restricted database tiers or quota limits
      // This is normal for many PostgreSQL setups where extensions require superuser privileges
      // Don't log as warning - this is expected behavior
      return { 
        success: false, 
        message: `pg_stat_statements not available: ${error.message}. This is normal if your database user lacks extension creation privileges.` 
      };
    }
  }

  /**
   * Get top queries by total execution time from pg_stat_statements
   * Falls back gracefully if extension not available
   */
  static async getTopQueries(limit: number = 10): Promise<QueryStats[]> {
    try {
      // Use sql directly with postgres-js - it returns rows as an array
      const rows = await sql<QueryStats>`
        SELECT 
          query,
          calls,
          total_exec_time as "totalTime",
          mean_exec_time as "meanTime",
          max_exec_time as "maxTime",
          rows
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
          AND query NOT LIKE '%pg_catalog%'
        ORDER BY total_exec_time DESC
        LIMIT ${limit}
      `;
      
      return rows;
    } catch (error) {
      // Extension not available - return empty array
      return [];
    }
  }

  /**
   * Get current database performance metrics
   */
  static async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      // Active connections - use sql directly with postgres-js
      const connectionRows = await sql<{ count: string }>`
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
      const activeConnections = Number(connectionRows[0]?.count || 0);

      // Cache hit ratio (from pg_statio_user_tables) - use sql directly
      const cacheRows = await sql<{ hit_ratio: number }>`
        SELECT 
          CASE 
            WHEN sum(heap_blks_hit) + sum(heap_blks_read) > 0 THEN
              round(sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2)
            ELSE 0
          END as hit_ratio
        FROM pg_statio_user_tables
      `;
      const cacheHitRatio = Number(cacheRows[0]?.hit_ratio || 0);

      // Database size - use sql directly
      const sizeRows = await sql<{ size: string }>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;
      const databaseSize = sizeRows[0]?.size || 'Unknown';

      // Index usage statistics - use sql directly
      const indexUsage = await sql<{ tableName: string; indexName: string; scans: number }>`
        SELECT 
          schemaname || '.' || tablename as "tableName",
          indexname as "indexName",
          idx_scan as scans
        FROM pg_stat_user_indexes
        WHERE idx_scan > 0
        ORDER BY idx_scan DESC
        LIMIT 20
      `;

      // Slowest queries (from pg_stat_statements if available)
      const slowestQueries = await this.getTopQueries(10);

      // Query throughput (approximate from pg_stat_statements if available)
      let queryThroughput = 0;
      try {
        // Use sql directly with postgres-js
        const throughputRows = await sql<{ total_calls: number }>`
          SELECT sum(calls) as total_calls
          FROM pg_stat_statements
        `;
        const totalCalls = Number(throughputRows[0]?.total_calls || 0);
        // Rough estimate: calls per minute (pg_stat_statements tracks since last reset)
        queryThroughput = Math.round(totalCalls / 60);
      } catch {
        // pg_stat_statements not available
        queryThroughput = 0;
      }

      return {
        activeConnections,
        queryThroughput,
        cacheHitRatio,
        slowestQueries,
        databaseSize,
        indexUsage,
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      throw new Error('Failed to fetch performance metrics');
    }
  }

  /**
   * Reset pg_stat_statements statistics
   * Use with caution - clears all historical query data
   */
  static async resetStatistics(): Promise<void> {
    try {
      // Use sql directly with postgres-js
      await sql`SELECT pg_stat_statements_reset()`;
    } catch (error) {
      console.warn('pg_stat_statements reset failed (extension may not be enabled)');
    }
  }

  /**
   * Get slow query log entries (last N days)
   */
  static async getSlowQueries(days: number = 7): Promise<SlowQuery[]> {
    try {
      // Use sql directly with postgres-js - it returns rows as an array
      // Note: INTERVAL requires string interpolation, so we use sql.unsafe for the dynamic part
      const rows = await sql.unsafe<SlowQuery[]>(`
        SELECT 
          id,
          query,
          duration,
          timestamp,
          caller
        FROM slow_query_log
        WHERE timestamp > NOW() - INTERVAL '${days} days'
        ORDER BY duration DESC
        LIMIT 100
      `);
      return rows;
    } catch (error) {
      // Table may not exist yet
      return [];
    }
  }

  /**
   * Log a slow query (called by query interceptor)
   */
  static async logSlowQuery(query: string, duration: number, caller?: string): Promise<void> {
    try {
      // Use sql directly with postgres-js
      await sql`
        INSERT INTO slow_query_log (id, query, duration, timestamp, caller)
        VALUES (
          gen_random_uuid(),
          ${query},
          ${duration},
          NOW(),
          ${caller || null}
        )
      `;
    } catch (error) {
      // Fail silently - don't break application on logging errors
      console.error('Failed to log slow query:', error);
    }
  }

  /**
   * Clean up old slow query logs (retention: 30 days)
   * Should be run daily via background job
   */
  static async purgeOldSlowQueryLogs(): Promise<{ deleted: number }> {
    try {
      // Use sql directly with postgres-js - it returns rows as an array
      const rows = await sql<{ count: string }>`
        WITH deleted AS (
          DELETE FROM slow_query_log
          WHERE timestamp < NOW() - INTERVAL '30 days'
          RETURNING *
        )
        SELECT count(*) as count FROM deleted
      `;
      const deleted = Number(rows[0]?.count || 0);
      console.log(`Purged ${deleted} slow query log entries older than 30 days`);
      return { deleted };
    } catch (error) {
      console.error('Failed to purge old slow query logs:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Get index bloat statistics
   * Identifies indexes that may need REINDEX
   */
  static async getIndexBloat(): Promise<Array<{ tableName: string; indexName: string; bloatPercent: number }>> {
    try {
      // Use sql directly with postgres-js - it returns rows as an array
      const rows = await sql<{ tableName: string; indexName: string; bloatPercent: number }>`
        SELECT 
          schemaname || '.' || tablename as "tableName",
          indexname as "indexName",
          round(100 * (pg_relation_size(indexrelid) - pg_relation_size(relid))::numeric / 
                NULLIF(pg_relation_size(indexrelid), 0), 2) as "bloatPercent"
        FROM pg_stat_user_indexes
        JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
        WHERE pg_relation_size(indexrelid) > 1000000  -- Only indexes > 1MB
        ORDER BY "bloatPercent" DESC NULLS LAST
        LIMIT 20
      `;
      return rows;
    } catch (error) {
      console.error('Failed to calculate index bloat:', error);
      return [];
    }
  }

  /**
   * Get unused indexes (no scans in tracking period)
   * Candidates for removal to reduce maintenance overhead
   */
  static async getUnusedIndexes(): Promise<Array<{ tableName: string; indexName: string; indexSize: string }>> {
    try {
      // Use sql directly with postgres-js - it returns rows as an array
      const rows = await sql<{ tableName: string; indexName: string; indexSize: string }>`
        SELECT 
          schemaname || '.' || tablename as "tableName",
          indexname as "indexName",
          pg_size_pretty(pg_relation_size(indexrelid)) as "indexSize"
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
          AND indexrelid NOT IN (
            SELECT indexrelid FROM pg_index WHERE indisprimary OR indisunique
          )
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20
      `;
      return rows;
    } catch (error) {
      console.error('Failed to find unused indexes:', error);
      return [];
    }
  }
}
