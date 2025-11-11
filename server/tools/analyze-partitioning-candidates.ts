import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Partitioning Analysis Tool
 * 
 * Analyzes tables to identify candidates for partitioning based on size,
 * row count, and growth patterns.
 * 
 * Usage:
 *   npx tsx server/tools/analyze-partitioning-candidates.ts
 *   npx tsx server/tools/analyze-partitioning-candidates.ts --save-markdown
 */

interface TableAnalysis {
  tableName: string;
  rowCount: number;
  tableSize: string;
  tableSizeBytes: number;
  indexSize: string;
  totalSize: string;
  averageRowSize: number;
  estimatedGrowthRate: string;
  recommendedPartitionColumn: string | null;
  partitionStrategy: string | null;
  estimatedBenefits: string[];
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: 'NOT_NEEDED' | 'MONITOR' | 'RECOMMENDED' | 'URGENT';
  reasoning: string;
}

interface PartitioningReport {
  timestamp: string;
  summary: {
    totalTablesAnalyzed: number;
    candidatesRecommended: number;
    candidatesMonitoring: number;
    noActionNeeded: number;
  };
  analyses: TableAnalysis[];
  overallRecommendation: string;
}

const PARTITION_THRESHOLD_ROWS = 10_000_000; // 10M rows
const MONITOR_THRESHOLD_ROWS = 1_000_000; // 1M rows
const SIZE_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100MB

// Tables to analyze with their partition characteristics
const TABLES_TO_ANALYZE = [
  {
    tableName: 'AuditLog',
    partitionColumn: 'timestamp',
    partitionType: 'RANGE',
    partitionInterval: 'monthly',
    complexity: 'LOW' as const,
  },
  {
    tableName: 'EvidenceFile',
    partitionColumn: 'createdAt',
    partitionType: 'RANGE',
    partitionInterval: 'quarterly',
    complexity: 'MEDIUM' as const,
  },
  {
    tableName: 'Answer',
    partitionColumn: 'assessmentId',
    partitionType: 'HASH',
    partitionInterval: null,
    complexity: 'HIGH' as const,
  },
  {
    tableName: 'SecurityAuditLog',
    partitionColumn: 'timestamp',
    partitionType: 'RANGE',
    partitionInterval: 'monthly',
    complexity: 'LOW' as const,
  },
  {
    tableName: 'UserSession',
    partitionColumn: 'createdAt',
    partitionType: 'RANGE',
    partitionInterval: 'weekly',
    complexity: 'LOW' as const,
  },
  {
    tableName: 'Assessment',
    partitionColumn: 'tenantId',
    partitionType: 'LIST',
    partitionInterval: null,
    complexity: 'HIGH' as const,
  },
];

async function getTableMetrics(tableName: string): Promise<{
  rowCount: number;
  tableSize: string;
  tableSizeBytes: number;
  indexSize: string;
  totalSize: string;
  averageRowSize: number;
} | null> {
  try {
    // Use string concatenation for table identifier
    const fullTableName = `public."${tableName}"`;
    const { rows } = await db.execute<{
      row_count: string;
      table_size: string;
      table_size_bytes: string;
      index_size: string;
      total_size: string;
    }>(sql.raw(`
      SELECT 
        n_live_tup::text as row_count,
        pg_size_pretty(pg_table_size('${fullTableName}')) as table_size,
        pg_table_size('${fullTableName}')::text as table_size_bytes,
        pg_size_pretty(pg_indexes_size('${fullTableName}')) as index_size,
        pg_size_pretty(pg_total_relation_size('${fullTableName}')) as total_size
      FROM pg_stat_user_tables
      WHERE schemaname = 'public' AND tablename = '${tableName}'
    `));
    
    if (!rows || rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    const rowCount = Number(row.row_count || 0);
    const tableSizeBytes = Number(row.table_size_bytes || 0);
    const averageRowSize = rowCount > 0 ? Math.round(tableSizeBytes / rowCount) : 0;
    
    return {
      rowCount,
      tableSize: row.table_size,
      tableSizeBytes,
      indexSize: row.index_size,
      totalSize: row.total_size,
      averageRowSize,
    };
  } catch (error) {
    console.warn(`Could not get metrics for table ${tableName}:`, error);
    return null;
  }
}

function estimateGrowthRate(rowCount: number, tableName: string): string {
  // Heuristic growth rate estimates based on table type
  const growthProfiles: Record<string, string> = {
    'AuditLog': 'High (grows with every action)',
    'EvidenceFile': 'Medium (grows per assessment)',
    'Answer': 'Medium (grows per assessment)',
    'SecurityAuditLog': 'Medium (grows with security events)',
    'UserSession': 'High (grows with every login)',
    'Assessment': 'Low-Medium (grows with business)',
  };
  
  return growthProfiles[tableName] || 'Unknown';
}

function determineRecommendation(
  rowCount: number,
  tableSizeBytes: number
): { recommendation: TableAnalysis['recommendation']; reasoning: string } {
  if (rowCount >= PARTITION_THRESHOLD_ROWS || tableSizeBytes >= SIZE_THRESHOLD_BYTES * 100) {
    return {
      recommendation: 'RECOMMENDED',
      reasoning: `Table has ${rowCount.toLocaleString()} rows (threshold: ${PARTITION_THRESHOLD_ROWS.toLocaleString()}). Partitioning will improve query performance and maintenance.`,
    };
  } else if (rowCount >= MONITOR_THRESHOLD_ROWS || tableSizeBytes >= SIZE_THRESHOLD_BYTES) {
    return {
      recommendation: 'MONITOR',
      reasoning: `Table has ${rowCount.toLocaleString()} rows. Monitor growth; consider partitioning when approaching ${PARTITION_THRESHOLD_ROWS.toLocaleString()} rows.`,
    };
  } else {
    return {
      recommendation: 'NOT_NEEDED',
      reasoning: `Table is small (${rowCount.toLocaleString()} rows). Partitioning overhead would exceed benefits.`,
    };
  }
}

function calculateEstimatedBenefits(
  tableName: string,
  rowCount: number,
  partitionType: string,
  partitionInterval: string | null
): string[] {
  const benefits: string[] = [];
  
  if (rowCount >= PARTITION_THRESHOLD_ROWS) {
    benefits.push('Faster queries due to partition pruning');
    benefits.push('Improved maintenance (VACUUM, ANALYZE per partition)');
    
    if (partitionType === 'RANGE' && partitionInterval) {
      benefits.push(`Easy archival/purging of old data (${partitionInterval} partitions)`);
      benefits.push('Reduced index bloat through smaller partition indexes');
    }
    
    if (partitionType === 'LIST') {
      benefits.push('Tenant isolation for multi-tenant queries');
      benefits.push('Potential for partition-level backup/restore');
    }
    
    if (partitionType === 'HASH') {
      benefits.push('Even data distribution across partitions');
      benefits.push('Parallel query execution potential');
    }
  } else if (rowCount >= MONITOR_THRESHOLD_ROWS) {
    benefits.push('Future-proofing for expected growth');
  } else {
    benefits.push('None - table too small to benefit from partitioning');
  }
  
  return benefits;
}

async function analyzeTable(tableConfig: typeof TABLES_TO_ANALYZE[0]): Promise<TableAnalysis | null> {
  const metrics = await getTableMetrics(tableConfig.tableName);
  
  if (!metrics) {
    console.warn(`⚠️  Table ${tableConfig.tableName} not found or inaccessible`);
    return null;
  }
  
  const { recommendation, reasoning } = determineRecommendation(
    metrics.rowCount,
    metrics.tableSizeBytes
  );
  
  const estimatedBenefits = calculateEstimatedBenefits(
    tableConfig.tableName,
    metrics.rowCount,
    tableConfig.partitionType,
    tableConfig.partitionInterval
  );
  
  const partitionStrategy = recommendation !== 'NOT_NEEDED'
    ? `${tableConfig.partitionType} partitioning by ${tableConfig.partitionColumn}` +
      (tableConfig.partitionInterval ? ` (${tableConfig.partitionInterval})` : '')
    : null;
  
  return {
    tableName: tableConfig.tableName,
    rowCount: metrics.rowCount,
    tableSize: metrics.tableSize,
    tableSizeBytes: metrics.tableSizeBytes,
    indexSize: metrics.indexSize,
    totalSize: metrics.totalSize,
    averageRowSize: metrics.averageRowSize,
    estimatedGrowthRate: estimateGrowthRate(metrics.rowCount, tableConfig.tableName),
    recommendedPartitionColumn: recommendation !== 'NOT_NEEDED' ? tableConfig.partitionColumn : null,
    partitionStrategy,
    estimatedBenefits,
    implementationComplexity: tableConfig.complexity,
    recommendation,
    reasoning,
  };
}

function generateMarkdownReport(report: PartitioningReport): string {
  const lines: string[] = [];
  
  lines.push('# Database Partitioning Analysis Report');
  lines.push('');
  lines.push(`**Generated**: ${report.timestamp}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- **Tables Analyzed**: ${report.summary.totalTablesAnalyzed}`);
  lines.push(`- **Partitioning Recommended**: ${report.summary.candidatesRecommended}`);
  lines.push(`- **Monitor for Future**: ${report.summary.candidatesMonitoring}`);
  lines.push(`- **No Action Needed**: ${report.summary.noActionNeeded}`);
  lines.push('');
  lines.push(`**Overall Recommendation**: ${report.overallRecommendation}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Analysis by Table');
  lines.push('');
  
  report.analyses.forEach((analysis, index) => {
    lines.push(`### ${index + 1}. ${analysis.tableName}`);
    lines.push('');
    lines.push(`**Recommendation**: ${analysis.recommendation}`);
    lines.push('');
    lines.push('**Current Metrics**:');
    lines.push(`- Row Count: ${analysis.rowCount.toLocaleString()}`);
    lines.push(`- Table Size: ${analysis.tableSize}`);
    lines.push(`- Index Size: ${analysis.indexSize}`);
    lines.push(`- Total Size: ${analysis.totalSize}`);
    lines.push(`- Average Row Size: ${analysis.averageRowSize} bytes`);
    lines.push(`- Estimated Growth Rate: ${analysis.estimatedGrowthRate}`);
    lines.push('');
    
    if (analysis.partitionStrategy) {
      lines.push('**Partition Strategy**:');
      lines.push(`- ${analysis.partitionStrategy}`);
      lines.push(`- Implementation Complexity: ${analysis.implementationComplexity}`);
      lines.push('');
      
      lines.push('**Estimated Benefits**:');
      analysis.estimatedBenefits.forEach(benefit => {
        lines.push(`- ${benefit}`);
      });
      lines.push('');
    }
    
    lines.push('**Reasoning**:');
    lines.push(analysis.reasoning);
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  
  lines.push('## Partitioning Implementation Guide');
  lines.push('');
  lines.push('### For Tables Recommended for Partitioning');
  lines.push('');
  lines.push('1. **Plan Partition Scheme**: Choose partition column and strategy');
  lines.push('2. **Create Partitioned Table**: Recreate table with partition key');
  lines.push('3. **Migrate Data**: Copy data from old table to new partitioned table');
  lines.push('4. **Update Indexes**: Recreate indexes on partitioned table');
  lines.push('5. **Update Application Code**: Ensure queries leverage partition pruning');
  lines.push('6. **Test Performance**: Validate query performance improvements');
  lines.push('7. **Swap Tables**: Rename old table, rename new table to original name');
  lines.push('8. **Monitor**: Track partition sizes and query patterns');
  lines.push('');
  lines.push('### Example: RANGE Partitioning by Timestamp');
  lines.push('');
  lines.push('```sql');
  lines.push('-- Create partitioned table');
  lines.push('CREATE TABLE "AuditLog_partitioned" (');
  lines.push('  LIKE "AuditLog" INCLUDING ALL');
  lines.push(') PARTITION BY RANGE ("timestamp");');
  lines.push('');
  lines.push('-- Create monthly partitions');
  lines.push('CREATE TABLE "AuditLog_2025_01" PARTITION OF "AuditLog_partitioned"');
  lines.push('  FOR VALUES FROM (\'2025-01-01\') TO (\'2025-02-01\');');
  lines.push('');
  lines.push('CREATE TABLE "AuditLog_2025_02" PARTITION OF "AuditLog_partitioned"');
  lines.push('  FOR VALUES FROM (\'2025-02-01\') TO (\'2025-03-01\');');
  lines.push('-- ... create additional partitions as needed');
  lines.push('```');
  lines.push('');
  lines.push('### Maintenance Recommendations');
  lines.push('');
  lines.push('- **Automated Partition Creation**: Set up cron job or scheduled task to create future partitions');
  lines.push('- **Partition Pruning**: Ensure WHERE clauses include partition key for optimal performance');
  lines.push('- **Archival Strategy**: Define retention policy and automate old partition dropping/archiving');
  lines.push('- **Monitoring**: Track partition sizes and query performance post-implementation');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*This report is generated automatically. Review and validate recommendations before implementation.*');
  
  return lines.join('\n');
}

function printReport(report: PartitioningReport): void {
  console.log('\n📊 DATABASE PARTITIONING ANALYSIS');
  console.log('═'.repeat(70));
  console.log(`Timestamp: ${report.timestamp}\n`);
  
  console.log('📈 SUMMARY');
  console.log(`   Tables Analyzed: ${report.summary.totalTablesAnalyzed}`);
  console.log(`   Partitioning Recommended: ${report.summary.candidatesRecommended}`);
  console.log(`   Monitor for Future: ${report.summary.candidatesMonitoring}`);
  console.log(`   No Action Needed: ${report.summary.noActionNeeded}\n`);
  
  console.log(`🎯 OVERALL: ${report.overallRecommendation}\n`);
  
  console.log('📋 TABLE ANALYSIS');
  console.log('   ' + '─'.repeat(95));
  
  report.analyses.forEach((analysis, i) => {
    const status = 
      analysis.recommendation === 'RECOMMENDED' ? '🔴' :
      analysis.recommendation === 'MONITOR' ? '🟡' : '🟢';
    
    console.log(`\n   ${status} ${i + 1}. ${analysis.tableName}`);
    console.log(`      Rows: ${analysis.rowCount.toLocaleString()} | Size: ${analysis.tableSize} | Status: ${analysis.recommendation}`);
    
    if (analysis.partitionStrategy) {
      console.log(`      Strategy: ${analysis.partitionStrategy}`);
      console.log(`      Complexity: ${analysis.implementationComplexity}`);
    }
    
    console.log(`      Reasoning: ${analysis.reasoning}`);
  });
  
  console.log('\n' + '═'.repeat(70));
}

async function analyzePartitioningCandidates(): Promise<void> {
  console.log('🚀 Starting Partitioning Analysis...\n');
  
  try {
    console.log('📊 Analyzing tables...\n');
    
    const analyses = await Promise.all(
      TABLES_TO_ANALYZE.map(table => analyzeTable(table))
    );
    
    const validAnalyses = analyses.filter((a): a is TableAnalysis => a !== null);
    
    const summary = {
      totalTablesAnalyzed: validAnalyses.length,
      candidatesRecommended: validAnalyses.filter(a => a.recommendation === 'RECOMMENDED').length,
      candidatesMonitoring: validAnalyses.filter(a => a.recommendation === 'MONITOR').length,
      noActionNeeded: validAnalyses.filter(a => a.recommendation === 'NOT_NEEDED').length,
    };
    
    let overallRecommendation: string;
    if (summary.candidatesRecommended > 0) {
      overallRecommendation = `Partitioning is recommended for ${summary.candidatesRecommended} table(s). Review and plan implementation.`;
    } else if (summary.candidatesMonitoring > 0) {
      overallRecommendation = `${summary.candidatesMonitoring} table(s) approaching partitioning thresholds. Monitor growth and plan ahead.`;
    } else {
      overallRecommendation = 'All tables are below partitioning thresholds. No action needed at this time.';
    }
    
    const report: PartitioningReport = {
      timestamp: new Date().toISOString(),
      summary,
      analyses: validAnalyses,
      overallRecommendation,
    };
    
    printReport(report);
    
    // Check for --save-markdown flag
    const args = process.argv.slice(2);
    if (args.includes('--save-markdown')) {
      const markdown = generateMarkdownReport(report);
      const outputPath = path.join(process.cwd(), 'docs', 'PARTITIONING_ANALYSIS.md');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, markdown);
      console.log(`\n💾 Markdown report saved to: ${outputPath}`);
    }
    
    console.log('\n💡 TIP: Run with --save-markdown to generate a detailed report');
    console.log('   Example: npx tsx server/tools/analyze-partitioning-candidates.ts --save-markdown\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error analyzing partitioning candidates:', error);
    process.exit(1);
  }
}

export { analyzePartitioningCandidates, PartitioningReport };

// Run if called directly
analyzePartitioningCandidates();
