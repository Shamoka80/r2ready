import { db } from '../db';
import { sql } from 'drizzle-orm';
export class QueryMonitoringService {
    /**
     * Check if pg_stat_statements extension is available
     */
    static async isPgStatStatementsAvailable() {
        try {
            const { rows } = await db.execute(sql `
        SELECT EXISTS(
          SELECT 1 FROM pg_available_extensions 
          WHERE name = 'pg_stat_statements'
        ) as available
      `);
            return rows[0]?.available === true;
        }
        catch (error) {
            console.warn('pg_stat_statements availability check failed:', error);
            return false;
        }
    }
    /**
     * Enable pg_stat_statements extension if not already enabled
     * Note: This may fail on Neon free tier or if extension quota is exceeded
     */
    static async enablePgStatStatements() {
        try {
            // Check if already enabled
            const { rows: checkRows } = await db.execute(sql `
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as enabled
      `);
            if (checkRows[0]?.enabled) {
                return { success: true, message: 'pg_stat_statements already enabled' };
            }
            // Try to enable (may fail on Neon free tier)
            await db.execute(sql `CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);
            return { success: true, message: 'pg_stat_statements enabled successfully' };
        }
        catch (error) {
            // Expected to fail on Neon free tier or quota limits
            console.warn('pg_stat_statements enablement failed (may be quota/tier limited):', error.message);
            return {
                success: false,
                message: `pg_stat_statements not available: ${error.message}. This is normal on Neon free tier.`
            };
        }
    }
    /**
     * Get top queries by total execution time from pg_stat_statements
     * Falls back gracefully if extension not available
     */
    static async getTopQueries(limit = 10) {
        try {
            const { rows } = await db.execute(sql `
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
      `);
            return rows;
        }
        catch (error) {
            // Extension not available - return empty array
            return [];
        }
    }
    /**
     * Get current database performance metrics
     */
    static async getPerformanceMetrics() {
        try {
            // Active connections
            const { rows: connectionRows } = await db.execute(sql `
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `);
            const activeConnections = Number(connectionRows[0]?.count || 0);
            // Cache hit ratio (from pg_statio_user_tables)
            const { rows: cacheRows } = await db.execute(sql `
        SELECT 
          CASE 
            WHEN sum(heap_blks_hit) + sum(heap_blks_read) > 0 THEN
              round(sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2)
            ELSE 0
          END as hit_ratio
        FROM pg_statio_user_tables
      `);
            const cacheHitRatio = Number(cacheRows[0]?.hit_ratio || 0);
            // Database size
            const { rows: sizeRows } = await db.execute(sql `
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
            const databaseSize = sizeRows[0]?.size || 'Unknown';
            // Index usage statistics
            const { rows: indexUsage } = await db.execute(sql `
        SELECT 
          schemaname || '.' || tablename as "tableName",
          indexname as "indexName",
          idx_scan as scans
        FROM pg_stat_user_indexes
        WHERE idx_scan > 0
        ORDER BY idx_scan DESC
        LIMIT 20
      `);
            // Slowest queries (from pg_stat_statements if available)
            const slowestQueries = await this.getTopQueries(10);
            // Query throughput (approximate from pg_stat_statements if available)
            let queryThroughput = 0;
            try {
                const { rows: throughputRows } = await db.execute(sql `
          SELECT sum(calls) as total_calls
          FROM pg_stat_statements
        `);
                const totalCalls = Number(throughputRows[0]?.total_calls || 0);
                // Rough estimate: calls per minute (pg_stat_statements tracks since last reset)
                queryThroughput = Math.round(totalCalls / 60);
            }
            catch {
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
        }
        catch (error) {
            console.error('Error fetching performance metrics:', error);
            throw new Error('Failed to fetch performance metrics');
        }
    }
    /**
     * Reset pg_stat_statements statistics
     * Use with caution - clears all historical query data
     */
    static async resetStatistics() {
        try {
            await db.execute(sql `SELECT pg_stat_statements_reset()`);
        }
        catch (error) {
            console.warn('pg_stat_statements reset failed (extension may not be enabled)');
        }
    }
    /**
     * Get slow query log entries (last N days)
     */
    static async getSlowQueries(days = 7) {
        try {
            const { rows } = await db.execute(sql `
        SELECT 
          id,
          query,
          duration,
          timestamp,
          caller
        FROM slow_query_log
        WHERE timestamp > NOW() - INTERVAL '${sql.raw(days.toString())} days'
        ORDER BY duration DESC
        LIMIT 100
      `);
            return rows;
        }
        catch (error) {
            // Table may not exist yet
            return [];
        }
    }
    /**
     * Log a slow query (called by query interceptor)
     */
    static async logSlowQuery(query, duration, caller) {
        try {
            await db.execute(sql `
        INSERT INTO slow_query_log (id, query, duration, timestamp, caller)
        VALUES (
          gen_random_uuid(),
          ${query},
          ${duration},
          NOW(),
          ${caller || null}
        )
      `);
        }
        catch (error) {
            // Fail silently - don't break application on logging errors
            console.error('Failed to log slow query:', error);
        }
    }
    /**
     * Clean up old slow query logs (retention: 30 days)
     * Should be run daily via background job
     */
    static async purgeOldSlowQueryLogs() {
        try {
            const { rows } = await db.execute(sql `
        WITH deleted AS (
          DELETE FROM slow_query_log
          WHERE timestamp < NOW() - INTERVAL '30 days'
          RETURNING *
        )
        SELECT count(*) as count FROM deleted
      `);
            const deleted = Number(rows[0]?.count || 0);
            console.log(`Purged ${deleted} slow query log entries older than 30 days`);
            return { deleted };
        }
        catch (error) {
            console.error('Failed to purge old slow query logs:', error);
            return { deleted: 0 };
        }
    }
    /**
     * Get index bloat statistics
     * Identifies indexes that may need REINDEX
     */
    static async getIndexBloat() {
        try {
            const { rows } = await db.execute(sql `
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
      `);
            return rows;
        }
        catch (error) {
            console.error('Failed to calculate index bloat:', error);
            return [];
        }
    }
    /**
     * Get unused indexes (no scans in tracking period)
     * Candidates for removal to reduce maintenance overhead
     */
    static async getUnusedIndexes() {
        try {
            const { rows } = await db.execute(sql `
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
      `);
            return rows;
        }
        catch (error) {
            console.error('Failed to find unused indexes:', error);
            return [];
        }
    }
}
