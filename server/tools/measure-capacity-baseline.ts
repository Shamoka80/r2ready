import { db } from '../db';
import { sql } from 'drizzle-orm';
import { QueryMonitoringService } from '../services/queryMonitoring';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Capacity Planning Baseline Measurement Tool
 * 
 * Collects current database metrics and projects capacity requirements
 * for 10x growth scenarios.
 * 
 * Usage:
 *   npx tsx server/tools/measure-capacity-baseline.ts
 *   npx tsx server/tools/measure-capacity-baseline.ts --save-json
 *   npx tsx server/tools/measure-capacity-baseline.ts --save-csv
 */

interface TableMetrics {
  tableName: string;
  rowCount: number;
  tableSize: string;
  tableSizeBytes: number;
  indexSize: string;
  totalSize: string;
}

interface CapacityBaseline {
  timestamp: string;
  database: {
    size: string;
    sizeBytes: number;
    totalConnections: number;
    activeConnections: number;
    maxConnections: number;
  };
  performance: {
    cacheHitRatio: number;
    queryThroughput: number;
    avgQueryTime: number;
  };
  tables: TableMetrics[];
  projections: {
    growth10x: {
      estimatedDatabaseSize: string;
      estimatedDatabaseSizeBytes: number;
      recommendedConnectionPoolSize: number;
      recommendedCacheMemoryMB: number;
      estimatedIndexSize: string;
    };
    assumptions: string[];
  };
}

async function getDatabaseSize(): Promise<{ size: string; sizeBytes: number }> {
  const { rows } = await db.execute<{ size: string; bytes: string }>(sql`
    SELECT 
      pg_size_pretty(pg_database_size(current_database())) as size,
      pg_database_size(current_database())::text as bytes
  `);
  return {
    size: rows[0]?.size || 'Unknown',
    sizeBytes: Number(rows[0]?.bytes || 0),
  };
}

async function getConnectionMetrics(): Promise<{
  totalConnections: number;
  activeConnections: number;
  maxConnections: number;
}> {
  const { rows: totalRows } = await db.execute<{ count: string }>(sql`
    SELECT count(*) as count FROM pg_stat_activity
  `);
  
  const { rows: activeRows } = await db.execute<{ count: string }>(sql`
    SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
  `);
  
  const { rows: maxRows } = await db.execute<{ setting: string }>(sql`
    SELECT setting FROM pg_settings WHERE name = 'max_connections'
  `);
  
  return {
    totalConnections: Number(totalRows[0]?.count || 0),
    activeConnections: Number(activeRows[0]?.count || 0),
    maxConnections: Number(maxRows[0]?.setting || 100),
  };
}

async function getCacheHitRatio(): Promise<number> {
  try {
    const { rows } = await db.execute<{ hit_ratio: number }>(sql`
      SELECT 
        CASE 
          WHEN sum(heap_blks_hit) + sum(heap_blks_read) > 0 THEN
            round(sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2)
          ELSE 0
        END as hit_ratio
      FROM pg_statio_user_tables
    `);
    return Number(rows[0]?.hit_ratio || 0);
  } catch (error) {
    console.warn('Cache hit ratio calculation failed:', error);
    return 0;
  }
}

async function getQueryMetrics(): Promise<{ throughput: number; avgTime: number }> {
  try {
    // Try to get metrics from pg_stat_statements if available
    const { rows } = await db.execute<{ total_calls: number; avg_time: number }>(sql`
      SELECT 
        COALESCE(sum(calls), 0) as total_calls,
        COALESCE(avg(mean_exec_time), 0) as avg_time
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat_statements%'
        AND query NOT LIKE '%pg_catalog%'
    `);
    
    const totalCalls = Number(rows[0]?.total_calls || 0);
    const avgTime = Number(rows[0]?.avg_time || 0);
    
    // Rough estimate: calls per minute (assuming pg_stat_statements tracks since last reset)
    const throughput = Math.round(totalCalls / 60);
    
    return { throughput, avgTime };
  } catch (error) {
    // pg_stat_statements not available
    return { throughput: 0, avgTime: 0 };
  }
}

async function getTableMetrics(): Promise<TableMetrics[]> {
  const { rows } = await db.execute<{
    tableName: string;
    row_count: string;
    table_size: string;
    table_size_bytes: string;
    index_size: string;
    total_size: string;
  }>(sql`
    SELECT 
      schemaname || '.' || tablename as "tableName",
      n_live_tup::text as row_count,
      pg_size_pretty(pg_table_size(schemaname||'.'||tablename)) as table_size,
      pg_table_size(schemaname||'.'||tablename)::text as table_size_bytes,
      pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 20
  `);
  
  return rows.map(row => ({
    tableName: row.tableName,
    rowCount: Number(row.row_count || 0),
    tableSize: row.table_size,
    tableSizeBytes: Number(row.table_size_bytes || 0),
    indexSize: row.index_size,
    totalSize: row.total_size,
  }));
}

function projectCapacity(baseline: Omit<CapacityBaseline, 'projections'>): CapacityBaseline['projections'] {
  const growthFactor = 10;
  const currentSizeBytes = baseline.database.sizeBytes;
  const projected10xBytes = currentSizeBytes * growthFactor;
  
  // Connection pool sizing: ~10 connections per 1000 concurrent users
  // At 10x growth, assuming 1000 active users -> 100 connections
  const currentActiveConnections = baseline.database.activeConnections;
  const recommendedConnectionPoolSize = Math.max(50, currentActiveConnections * growthFactor);
  
  // Cache memory: Recommend 10-20% of working set size
  // Estimate working set as 20% of total database size
  const workingSetBytes = projected10xBytes * 0.2;
  const recommendedCacheMemoryMB = Math.round((workingSetBytes * 0.15) / (1024 * 1024));
  
  // Index size typically 10-30% of table size
  const totalTableSizeBytes = baseline.tables.reduce((sum, t) => sum + t.tableSizeBytes, 0);
  const currentIndexRatio = totalTableSizeBytes > 0 
    ? (currentSizeBytes - totalTableSizeBytes) / currentSizeBytes 
    : 0.2;
  const estimatedIndexSizeBytes = projected10xBytes * currentIndexRatio;
  
  return {
    growth10x: {
      estimatedDatabaseSize: formatBytes(projected10xBytes),
      estimatedDatabaseSizeBytes: projected10xBytes,
      recommendedConnectionPoolSize: Math.min(recommendedConnectionPoolSize, 200), // Cap at 200 for Neon
      recommendedCacheMemoryMB: Math.min(recommendedCacheMemoryMB, 2048), // Cap at 2GB
      estimatedIndexSize: formatBytes(estimatedIndexSizeBytes),
    },
    assumptions: [
      'Linear growth assumption: 10x users = 10x data',
      'Connection pool sized at 1 connection per 10 concurrent users',
      'Cache memory set to 15% of working set (20% of total DB size)',
      'Index overhead estimated from current ratio',
      'Does not account for partitioning or archival strategies',
      'Assumes current query patterns remain similar',
    ],
  };
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function saveAsJSON(baseline: CapacityBaseline, filename: string = 'capacity-baseline.json'): void {
  const outputPath = path.join(process.cwd(), filename);
  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2));
  console.log(`\n💾 Baseline saved to: ${outputPath}`);
}

function saveAsCSV(baseline: CapacityBaseline, filename: string = 'capacity-baseline.csv'): void {
  const outputPath = path.join(process.cwd(), filename);
  
  const csvLines = [
    'Metric,Value',
    `Timestamp,${baseline.timestamp}`,
    `Database Size,${baseline.database.size}`,
    `Total Connections,${baseline.database.totalConnections}`,
    `Active Connections,${baseline.database.activeConnections}`,
    `Max Connections,${baseline.database.maxConnections}`,
    `Cache Hit Ratio,%${baseline.performance.cacheHitRatio}`,
    `Query Throughput (per min),${baseline.performance.queryThroughput}`,
    `Avg Query Time (ms),${baseline.performance.avgQueryTime.toFixed(2)}`,
    '',
    'Table Metrics',
    'Table Name,Row Count,Table Size,Index Size,Total Size',
    ...baseline.tables.map(t => 
      `${t.tableName},${t.rowCount},${t.tableSize},${t.indexSize},${t.totalSize}`
    ),
    '',
    '10x Growth Projections',
    `Estimated Database Size,${baseline.projections.growth10x.estimatedDatabaseSize}`,
    `Recommended Connection Pool Size,${baseline.projections.growth10x.recommendedConnectionPoolSize}`,
    `Recommended Cache Memory (MB),${baseline.projections.growth10x.recommendedCacheMemoryMB}`,
    `Estimated Index Size,${baseline.projections.growth10x.estimatedIndexSize}`,
  ];
  
  fs.writeFileSync(outputPath, csvLines.join('\n'));
  console.log(`\n💾 Baseline saved to: ${outputPath}`);
}

function printBaseline(baseline: CapacityBaseline): void {
  console.log('\n📊 CAPACITY PLANNING BASELINE REPORT');
  console.log('═'.repeat(70));
  console.log(`Timestamp: ${baseline.timestamp}\n`);
  
  console.log('🗄️  DATABASE METRICS');
  console.log(`   Size: ${baseline.database.size}`);
  console.log(`   Total Connections: ${baseline.database.totalConnections}`);
  console.log(`   Active Connections: ${baseline.database.activeConnections}`);
  console.log(`   Max Connections: ${baseline.database.maxConnections}`);
  console.log(`   Utilization: ${((baseline.database.totalConnections / baseline.database.maxConnections) * 100).toFixed(1)}%\n`);
  
  console.log('⚡ PERFORMANCE METRICS');
  console.log(`   Cache Hit Ratio: ${baseline.performance.cacheHitRatio}%`);
  console.log(`   Query Throughput: ~${baseline.performance.queryThroughput} queries/min`);
  console.log(`   Avg Query Time: ${baseline.performance.avgQueryTime.toFixed(2)}ms\n`);
  
  console.log('📋 TOP TABLES BY SIZE');
  console.log('   Table                          | Rows        | Table Size | Index Size | Total Size');
  console.log('   ' + '─'.repeat(95));
  baseline.tables.slice(0, 10).forEach(t => {
    const tableName = t.tableName.padEnd(30);
    const rowCount = t.rowCount.toLocaleString().padStart(11);
    const tableSize = t.tableSize.padStart(10);
    const indexSize = t.indexSize.padStart(10);
    const totalSize = t.totalSize.padStart(10);
    console.log(`   ${tableName} | ${rowCount} | ${tableSize} | ${indexSize} | ${totalSize}`);
  });
  
  console.log('\n📈 10X GROWTH PROJECTIONS');
  console.log(`   Estimated Database Size: ${baseline.projections.growth10x.estimatedDatabaseSize}`);
  console.log(`   Recommended Connection Pool: ${baseline.projections.growth10x.recommendedConnectionPoolSize} connections`);
  console.log(`   Recommended Cache Memory: ${baseline.projections.growth10x.recommendedCacheMemoryMB} MB`);
  console.log(`   Estimated Index Overhead: ${baseline.projections.growth10x.estimatedIndexSize}\n`);
  
  console.log('📝 ASSUMPTIONS');
  baseline.projections.assumptions.forEach((assumption, i) => {
    console.log(`   ${i + 1}. ${assumption}`);
  });
  
  console.log('\n' + '═'.repeat(70));
}

async function measureCapacityBaseline(): Promise<void> {
  console.log('🚀 Starting Capacity Baseline Measurement...\n');
  
  try {
    console.log('📊 Collecting database metrics...');
    const [dbSize, connections, cacheHitRatio, queryMetrics, tableMetrics] = await Promise.all([
      getDatabaseSize(),
      getConnectionMetrics(),
      getCacheHitRatio(),
      getQueryMetrics(),
      getTableMetrics(),
    ]);
    
    const baselineData: Omit<CapacityBaseline, 'projections'> = {
      timestamp: new Date().toISOString(),
      database: {
        size: dbSize.size,
        sizeBytes: dbSize.sizeBytes,
        totalConnections: connections.totalConnections,
        activeConnections: connections.activeConnections,
        maxConnections: connections.maxConnections,
      },
      performance: {
        cacheHitRatio,
        queryThroughput: queryMetrics.throughput,
        avgQueryTime: queryMetrics.avgTime,
      },
      tables: tableMetrics,
    };
    
    console.log('📈 Calculating capacity projections...');
    const projections = projectCapacity(baselineData);
    
    const baseline: CapacityBaseline = {
      ...baselineData,
      projections,
    };
    
    printBaseline(baseline);
    
    // Check for command-line arguments
    const args = process.argv.slice(2);
    if (args.includes('--save-json')) {
      saveAsJSON(baseline);
    }
    if (args.includes('--save-csv')) {
      saveAsCSV(baseline);
    }
    
    console.log('\n✅ Capacity baseline measurement complete!');
    
    // Optionally store in database (future enhancement)
    // This would require creating a capacity_baselines table
    console.log('\n💡 TIP: Run with --save-json or --save-csv to export the report');
    console.log('   Example: npx tsx server/tools/measure-capacity-baseline.ts --save-json\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error measuring capacity baseline:', error);
    process.exit(1);
  }
}

export { measureCapacityBaseline, CapacityBaseline };

// Run if called directly
measureCapacityBaseline();
