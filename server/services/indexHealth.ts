import { db } from '../db';
import { sql } from 'drizzle-orm';
import { QueryMonitoringService } from './queryMonitoring.js';

/**
 * Index Health Service
 * 
 * Provides comprehensive index health monitoring and recommendations.
 * 
 * Features:
 * - Index bloat detection
 * - Unused index identification
 * - Sequential scan analysis
 * - Partial index recommendations
 * - Query optimization suggestions
 */

export interface IndexHealthMetrics {
  indexBloat: Array<{ tableName: string; indexName: string; bloatPercent: number }>;
  unusedIndexes: Array<{ tableName: string; indexName: string; indexSize: string }>;
  sequentialScans: Array<{ 
    schemaname: string; 
    tablename: string; 
    seq_scan: number; 
    idx_scan: number;
    ratio: number;
  }>;
  totalIndexCount: number;
  totalIndexSize: string;
  healthScore: number;
}

export interface IndexHealthReport {
  timestamp: string;
  metrics: IndexHealthMetrics;
  recommendations: string[];
  partialIndexRecommendations: PartialIndexRecommendation[];
  queryOptimizationRecommendations: QueryOptimizationRecommendation[];
}

export interface PartialIndexRecommendation {
  tableName: string;
  columnName: string;
  predicate: string;
  estimatedRows: number;
  estimatedSizeSavings: string;
  sampleQuery: string;
  priority: 'high' | 'medium' | 'low';
}

export interface QueryOptimizationRecommendation {
  query: string;
  currentExecutionTime: number;
  suggestedOptimization: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export class IndexHealthService {
  /**
   * Generate a comprehensive index health report
   */
  static async generateIndexHealthReport(): Promise<IndexHealthReport> {
    try {
      const [
        indexBloat,
        unusedIndexes,
        sequentialScans,
        indexStats,
      ] = await Promise.all([
        QueryMonitoringService.getIndexBloat(),
        QueryMonitoringService.getUnusedIndexes(),
        this.getSequentialScanRatio(),
        this.getIndexStats(),
      ]);

      const metrics: IndexHealthMetrics = {
        indexBloat,
        unusedIndexes,
        sequentialScans,
        totalIndexCount: indexStats.totalIndexCount,
        totalIndexSize: indexStats.totalIndexSize,
        healthScore: this.calculateHealthScore(indexBloat, unusedIndexes, sequentialScans),
      };

      const recommendations = this.generateRecommendations(metrics);
      const partialIndexRecommendations = await this.generatePartialIndexRecommendations();
      const queryOptimizationRecommendations = await this.generateQueryOptimizationRecommendations();

      return {
        timestamp: new Date().toISOString(),
        metrics,
        recommendations,
        partialIndexRecommendations,
        queryOptimizationRecommendations,
      };
    } catch (error) {
      console.error('Error generating index health report:', error);
      throw new Error('Failed to generate index health report');
    }
  }

  /**
   * Get sequential scan ratio for tables
   * Tables with high seq_scan/idx_scan ratio may need new indexes
   */
  static async getSequentialScanRatio(): Promise<Array<{ 
    schemaname: string; 
    tablename: string; 
    seq_scan: number; 
    idx_scan: number;
    ratio: number;
  }>> {
    try {
      const { rows } = await db.execute<{
        schemaname: string;
        tablename: string;
        seq_scan: number;
        idx_scan: number;
        ratio: number;
      }>(sql`
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          idx_scan,
          CASE 
            WHEN idx_scan = 0 THEN 999999
            ELSE round((seq_scan::numeric / NULLIF(idx_scan, 0))::numeric, 2)
          END as ratio
        FROM pg_stat_user_tables
        WHERE seq_scan > 0
        ORDER BY ratio DESC
        LIMIT 20
      `);
      return rows;
    } catch (error) {
      console.error('Error fetching sequential scan ratio:', error);
      return [];
    }
  }

  /**
   * Get overall index statistics
   */
  static async getIndexStats(): Promise<{ totalIndexCount: number; totalIndexSize: string }> {
    try {
      const { rows } = await db.execute<{ count: string; total_size: string }>(sql`
        SELECT 
          count(*) as count,
          pg_size_pretty(sum(pg_relation_size(indexrelid))) as total_size
        FROM pg_stat_user_indexes
      `);
      return {
        totalIndexCount: Number(rows[0]?.count || 0),
        totalIndexSize: rows[0]?.total_size || '0 bytes',
      };
    } catch (error) {
      console.error('Error fetching index stats:', error);
      return { totalIndexCount: 0, totalIndexSize: '0 bytes' };
    }
  }

  /**
   * Calculate overall health score (0-100)
   * Based on index bloat, unused indexes, and sequential scan ratio
   */
  static calculateHealthScore(
    indexBloat: Array<{ bloatPercent: number }>,
    unusedIndexes: Array<any>,
    sequentialScans: Array<{ ratio: number }>
  ): number {
    let score = 100;

    // Penalize for index bloat (>30% is bad)
    const highBloatCount = indexBloat.filter(b => b.bloatPercent > 30).length;
    score -= highBloatCount * 5;

    // Penalize for unused indexes
    score -= unusedIndexes.length * 3;

    // Penalize for high sequential scan ratios (>10 is concerning)
    const highSeqScanCount = sequentialScans.filter(s => s.ratio > 10).length;
    score -= highSeqScanCount * 4;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate actionable recommendations based on metrics
   */
  static generateRecommendations(metrics: IndexHealthMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.healthScore < 50) {
      recommendations.push('CRITICAL: Index health is poor. Immediate action required.');
    } else if (metrics.healthScore < 75) {
      recommendations.push('WARNING: Index health needs attention.');
    } else {
      recommendations.push('Index health is good.');
    }

    if (metrics.indexBloat.length > 0) {
      const highBloat = metrics.indexBloat.filter(b => b.bloatPercent > 30);
      if (highBloat.length > 0) {
        recommendations.push(
          `Consider REINDEX for ${highBloat.length} bloated indexes: ${highBloat.map(b => b.indexName).join(', ')}`
        );
      }
    }

    if (metrics.unusedIndexes.length > 0) {
      recommendations.push(
        `Consider dropping ${metrics.unusedIndexes.length} unused indexes to reduce maintenance overhead.`
      );
    }

    if (metrics.sequentialScans.length > 0) {
      const highRatio = metrics.sequentialScans.filter(s => s.ratio > 10);
      if (highRatio.length > 0) {
        recommendations.push(
          `Add indexes to ${highRatio.length} tables with high sequential scan ratios: ${highRatio.map(s => s.tablename).join(', ')}`
        );
      }
    }

    return recommendations;
  }

  /**
   * Generate partial index recommendations (T2.3)
   * Identifies columns that would benefit from partial indexes
   */
  static async generatePartialIndexRecommendations(): Promise<PartialIndexRecommendation[]> {
    const recommendations: PartialIndexRecommendation[] = [];

    // Common patterns to check
    const patterns = [
      { table: 'Assessment', column: 'status', predicate: "status = 'ACTIVE'", sampleQuery: "SELECT * FROM Assessment WHERE status = 'ACTIVE'" },
      { table: 'Assessment', column: 'status', predicate: "status = 'COMPLETED'", sampleQuery: "SELECT * FROM Assessment WHERE status = 'COMPLETED'" },
      { table: 'User', column: 'emailVerified', predicate: "emailVerified = true", sampleQuery: "SELECT * FROM User WHERE emailVerified = true" },
      { table: 'License', column: 'status', predicate: "status = 'ACTIVE'", sampleQuery: "SELECT * FROM License WHERE status = 'ACTIVE'" },
      { table: 'EvidenceFile', column: 'status', predicate: "status != 'DELETED'", sampleQuery: "SELECT * FROM EvidenceFile WHERE status != 'DELETED'" },
    ];

    for (const pattern of patterns) {
      try {
        // Get table statistics
        const { rows: tableStats } = await db.execute<{ 
          reltuples: number;
          total_rows: number;
        }>(sql.raw(`
          SELECT 
            reltuples::bigint as reltuples,
            count(*) as total_rows
          FROM pg_class 
          WHERE relname = '${pattern.table}'
          GROUP BY reltuples
        `));

        if (tableStats.length === 0) continue;

        const totalRows = Number(tableStats[0]?.reltuples || 0);
        if (totalRows === 0) continue;

        // Estimate rows matching predicate (simplified - assume 30% selectivity for status filters)
        const estimatedRows = Math.floor(totalRows * 0.3);
        const selectivity = (estimatedRows / totalRows) * 100;

        // Only recommend if selectivity is good (10-50%)
        if (selectivity >= 10 && selectivity <= 50) {
          const estimatedSizeSavings = this.estimateIndexSizeSavings(totalRows, estimatedRows);
          
          recommendations.push({
            tableName: pattern.table,
            columnName: pattern.column,
            predicate: pattern.predicate,
            estimatedRows,
            estimatedSizeSavings,
            sampleQuery: pattern.sampleQuery,
            priority: selectivity < 25 ? 'high' : 'medium',
          });
        }
      } catch (error) {
        console.error(`Error analyzing partial index for ${pattern.table}.${pattern.column}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Estimate index size savings from using a partial index
   */
  static estimateIndexSizeSavings(totalRows: number, partialRows: number): string {
    // Rough estimate: 64 bytes per index entry
    const bytesPerRow = 64;
    const fullIndexSize = totalRows * bytesPerRow;
    const partialIndexSize = partialRows * bytesPerRow;
    const savings = fullIndexSize - partialIndexSize;

    if (savings < 1024) return `${savings} bytes`;
    if (savings < 1024 * 1024) return `${(savings / 1024).toFixed(2)} KB`;
    return `${(savings / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Generate query optimization recommendations (T2.4)
   * Analyzes slow queries and suggests optimizations
   */
  static async generateQueryOptimizationRecommendations(): Promise<QueryOptimizationRecommendation[]> {
    const recommendations: QueryOptimizationRecommendation[] = [];

    try {
      // Get top slow queries
      const slowQueries = await QueryMonitoringService.getTopQueries(10);

      for (const query of slowQueries) {
        if (query.meanTime > 100) { // Queries taking >100ms on average
          const optimization = this.analyzeQueryForOptimization(query.query, query.meanTime);
          if (optimization) {
            recommendations.push({
              query: this.redactSensitiveData(query.query),
              currentExecutionTime: query.meanTime,
              suggestedOptimization: optimization.suggestion,
              priority: optimization.priority,
              reason: optimization.reason,
            });
          }
        }
      }

      // Check for N+1 patterns
      const n1Patterns = this.detectN1Patterns(slowQueries);
      recommendations.push(...n1Patterns);

    } catch (error) {
      console.error('Error generating query optimization recommendations:', error);
    }

    return recommendations;
  }

  /**
   * Analyze a query and suggest optimizations
   */
  static analyzeQueryForOptimization(
    query: string, 
    meanTime: number
  ): { suggestion: string; priority: 'high' | 'medium' | 'low'; reason: string } | null {
    const lowerQuery = query.toLowerCase();

    // Check for missing WHERE clause on large tables
    if (lowerQuery.includes('select') && !lowerQuery.includes('where') && !lowerQuery.includes('limit')) {
      return {
        suggestion: 'Add WHERE clause or LIMIT to avoid full table scans',
        priority: 'high',
        reason: 'Query may be performing expensive full table scan',
      };
    }

    // Check for SELECT *
    if (lowerQuery.includes('select *')) {
      return {
        suggestion: 'Select only required columns instead of SELECT *',
        priority: 'medium',
        reason: 'Fetching unnecessary columns wastes bandwidth and memory',
      };
    }

    // Check for lack of JOIN optimization
    if ((lowerQuery.match(/join/g) || []).length > 3) {
      return {
        suggestion: 'Consider denormalization or materialized views for complex joins',
        priority: 'medium',
        reason: 'Query has multiple JOINs which may be expensive',
      };
    }

    // Check for LIKE patterns without index
    if (lowerQuery.includes('like') && lowerQuery.includes('%')) {
      const startsWithWildcard = lowerQuery.match(/like\s+'%/);
      if (startsWithWildcard) {
        return {
          suggestion: 'Use full-text search (tsvector) instead of LIKE with leading wildcard',
          priority: 'high',
          reason: 'LIKE with leading wildcard cannot use indexes',
        };
      }
    }

    return null;
  }

  /**
   * Detect N+1 query patterns
   * Same query repeated with different parameters
   */
  static detectN1Patterns(queries: Array<{ query: string; calls: number }>): QueryOptimizationRecommendation[] {
    const recommendations: QueryOptimizationRecommendation[] = [];

    // Group queries by normalized pattern
    const patterns = new Map<string, { count: number; example: string }>();

    for (const q of queries) {
      // Normalize query by replacing literals with placeholders
      const normalized = q.query
        .replace(/\d+/g, '?')
        .replace(/'[^']*'/g, '?')
        .replace(/\s+/g, ' ')
        .trim();

      const existing = patterns.get(normalized);
      if (existing) {
        existing.count += q.calls;
      } else {
        patterns.set(normalized, { count: q.calls, example: q.query });
      }
    }

    // Find patterns called many times (potential N+1)
    for (const [pattern, data] of patterns.entries()) {
      if (data.count > 50) {
        recommendations.push({
          query: this.redactSensitiveData(data.example),
          currentExecutionTime: 0,
          suggestedOptimization: 'Use batch loading or JOIN instead of multiple individual queries',
          priority: 'high',
          reason: `Query pattern executed ${data.count} times - likely N+1 problem`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Redact sensitive data from queries
   */
  static redactSensitiveData(query: string): string {
    let redacted = query;
    
    redacted = redacted.replace(/(['"])[^'"]*password[^'"]*\1/gi, '$1[REDACTED]$1');
    redacted = redacted.replace(/(['"])[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\1/g, '$1[EMAIL]$1');
    redacted = redacted.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]');
    
    return redacted;
  }
}
