
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import chalk from 'chalk';

interface SchemaIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  table?: string;
  column?: string;
  constraint?: string;
  message: string;
  recommendation?: string;
}

interface TableInfo {
  tableName: string;
  schemaName: string;
  tableType: string;
}

interface ColumnInfo {
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: string;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

interface ConstraintInfo {
  constraintName: string;
  constraintType: string;
  tableName: string;
  columnName: string;
  foreignTableName?: string;
  foreignColumnName?: string;
}

class DatabaseHealthChecker {
  private issues: SchemaIssue[] = [];

  async runHealthCheck(): Promise<void> {
    console.log(chalk.blue('🔍 Starting Comprehensive Database Health Check\n'));

    try {
      // Test basic connectivity
      await this.testConnectivity();
      
      // Get schema information
      const tables = await this.getTables();
      const columns = await this.getColumns();
      const constraints = await this.getConstraints();
      const indexes = await this.getIndexes();

      // Run all checks
      await this.checkNamingConventions(tables, columns, constraints);
      await this.checkForeignKeyIntegrity(constraints);
      await this.checkDataConsistency();
      await this.checkIndexOptimization(indexes);
      await this.checkSchemaAlignment();
      await this.checkOrphanedRecords();
      
      // Display results
      this.displayResults();

    } catch (error) {
      console.error(chalk.red('❌ Health check failed:'), error);
      throw error;
    }
  }

  private async testConnectivity(): Promise<void> {
    console.log(chalk.yellow('▶️  Testing database connectivity...'));
    
    try {
      const result = await db.execute(sql`SELECT 1 as test, version() as pg_version`);
      const version = result[0]?.pg_version;
      console.log(chalk.green('✅ Database connection successful'));
      console.log(chalk.blue(`📊 PostgreSQL Version: ${version}\n`));
    } catch (error) {
      this.addIssue('error', 'connectivity', undefined, undefined, undefined, 
        `Database connection failed: ${error}`);
      throw error;
    }
  }

  private async getTables(): Promise<TableInfo[]> {
    console.log(chalk.yellow('▶️  Analyzing table structure...'));
    
    const query = sql`
      SELECT 
        table_name as "tableName",
        table_schema as "schemaName", 
        table_type as "tableType"
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    const result = await db.execute(query);
    console.log(chalk.green(`✅ Found ${result.length} tables\n`));
    
    return result as TableInfo[];
  }

  private async getColumns(): Promise<ColumnInfo[]> {
    console.log(chalk.yellow('▶️  Analyzing column structure...'));
    
    const query = sql`
      SELECT 
        c.table_name as "tableName",
        c.column_name as "columnName",
        c.data_type as "dataType",
        c.is_nullable as "isNullable",
        c.column_default as "columnDefault",
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as "isPrimaryKey",
        CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as "isForeignKey"
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
      ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `;
    
    const result = await db.execute(query);
    console.log(chalk.green(`✅ Analyzed ${result.length} columns\n`));
    
    return result as ColumnInfo[];
  }

  private async getConstraints(): Promise<ConstraintInfo[]> {
    console.log(chalk.yellow('▶️  Analyzing constraints...'));
    
    const query = sql`
      SELECT 
        tc.constraint_name as "constraintName",
        tc.constraint_type as "constraintType",
        tc.table_name as "tableName",
        kcu.column_name as "columnName",
        ccu.table_name as "foreignTableName",
        ccu.column_name as "foreignColumnName"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type
    `;
    
    const result = await db.execute(query);
    console.log(chalk.green(`✅ Found ${result.length} constraints\n`));
    
    return result as ConstraintInfo[];
  }

  private async getIndexes(): Promise<any[]> {
    console.log(chalk.yellow('▶️  Analyzing indexes...'));
    
    const query = sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `;
    
    const result = await db.execute(query);
    console.log(chalk.green(`✅ Found ${result.length} indexes\n`));
    
    return result;
  }

  private checkNamingConventions(tables: TableInfo[], columns: ColumnInfo[], constraints: ConstraintInfo[]): void {
    console.log(chalk.yellow('▶️  Checking naming conventions...'));

    // Check table naming conventions
    for (const table of tables) {
      // Pascal case check for table names
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(table.tableName)) {
        this.addIssue('warning', 'naming', table.tableName, undefined, undefined,
          `Table name '${table.tableName}' doesn't follow PascalCase convention`,
          'Consider renaming to PascalCase (e.g., UserSession instead of user_session)'
        );
      }
    }

    // Check column naming conventions
    const columnsByTable = columns.reduce((acc, col) => {
      if (!acc[col.tableName]) acc[col.tableName] = [];
      acc[col.tableName].push(col);
      return acc;
    }, {} as Record<string, ColumnInfo[]>);

    for (const [tableName, tableCols] of Object.entries(columnsByTable)) {
      for (const col of tableCols) {
        // camelCase check for column names
        if (!/^[a-z][a-zA-Z0-9]*$/.test(col.columnName)) {
          this.addIssue('warning', 'naming', tableName, col.columnName, undefined,
            `Column name '${col.columnName}' doesn't follow camelCase convention`,
            'Consider renaming to camelCase (e.g., firstName instead of first_name)'
          );
        }

        // ID field conventions
        if (col.isPrimaryKey && col.columnName !== 'id') {
          this.addIssue('info', 'naming', tableName, col.columnName, undefined,
            `Primary key '${col.columnName}' doesn't follow 'id' convention`
          );
        }

        // Foreign key naming
        if (col.isForeignKey && !col.columnName.endsWith('Id')) {
          this.addIssue('warning', 'naming', tableName, col.columnName, undefined,
            `Foreign key '${col.columnName}' should end with 'Id'`,
            'Foreign keys should be named like: userId, tenantId, etc.'
          );
        }
      }
    }

    console.log(chalk.green('✅ Naming convention check completed\n'));
  }

  private async checkForeignKeyIntegrity(constraints: ConstraintInfo[]): Promise<void> {
    console.log(chalk.yellow('▶️  Checking foreign key integrity...'));

    const foreignKeys = constraints.filter(c => c.constraintType === 'FOREIGN KEY');
    
    for (const fk of foreignKeys) {
      if (!fk.foreignTableName || !fk.foreignColumnName) {
        this.addIssue('error', 'foreign_key', fk.tableName, fk.columnName, fk.constraintName,
          `Foreign key constraint missing target information`
        );
        continue;
      }

      try {
        // Check if foreign key references exist
        const checkQuery = sql.raw(`
          SELECT COUNT(*) as count
          FROM "${fk.tableName}" t1
          LEFT JOIN "${fk.foreignTableName}" t2 ON t1."${fk.columnName}" = t2."${fk.foreignColumnName}"
          WHERE t1."${fk.columnName}" IS NOT NULL AND t2."${fk.foreignColumnName}" IS NULL
        `);
        
        const result = await db.execute(checkQuery);
        const orphanCount = parseInt(result[0]?.count as string || '0');
        
        if (orphanCount > 0) {
          this.addIssue('error', 'foreign_key', fk.tableName, fk.columnName, fk.constraintName,
            `Found ${orphanCount} orphaned records with invalid foreign key references`,
            `Clean up orphaned records in ${fk.tableName}.${fk.columnName}`
          );
        }
      } catch (error) {
        this.addIssue('warning', 'foreign_key', fk.tableName, fk.columnName, fk.constraintName,
          `Could not verify foreign key integrity: ${error}`
        );
      }
    }

    console.log(chalk.green('✅ Foreign key integrity check completed\n'));
  }

  private async checkDataConsistency(): Promise<void> {
    console.log(chalk.yellow('▶️  Checking data consistency...'));

    try {
      // Check for duplicate primary keys (shouldn't happen but let's verify)
      const tables = ['StandardVersion', 'Clause', 'Question', 'Assessment', 'Answer', 'User', 'Tenant'];
      
      for (const table of tables) {
        try {
          const duplicateCheck = sql.raw(`
            SELECT COUNT(*) as total, COUNT(DISTINCT id) as unique_count
            FROM "${table}"
          `);
          
          const result = await db.execute(duplicateCheck);
          const total = parseInt(result[0]?.total as string || '0');
          const unique = parseInt(result[0]?.unique_count as string || '0');
          
          if (total !== unique) {
            this.addIssue('error', 'data_consistency', table, 'id', undefined,
              `Found duplicate IDs in ${table}: ${total} total vs ${unique} unique`
            );
          }
        } catch (error) {
          // Table might not exist, skip silently
        }
      }

      // Check enum value consistency
      await this.checkEnumConsistency();

    } catch (error) {
      this.addIssue('warning', 'data_consistency', undefined, undefined, undefined,
        `Data consistency check encountered issues: ${error}`
      );
    }

    console.log(chalk.green('✅ Data consistency check completed\n'));
  }

  private async checkEnumConsistency(): Promise<void> {
    // Check if enum values in data match enum type definitions
    const enumChecks = [
      { table: 'Assessment', column: 'status', enumType: 'AssessmentStatus' },
      { table: 'User', column: 'businessRole', enumType: 'BusinessRole' },
      { table: 'User', column: 'consultantRole', enumType: 'ConsultantRole' },
      { table: 'Tenant', column: 'tenantType', enumType: 'TenantType' }
    ];

    for (const check of enumChecks) {
      try {
        const query = sql.raw(`
          SELECT DISTINCT "${check.column}" as value
          FROM "${check.table}"
          WHERE "${check.column}" IS NOT NULL
        `);
        
        const result = await db.execute(query);
        
        // Get valid enum values
        const enumQuery = sql.raw(`
          SELECT unnest(enum_range(NULL::"${check.enumType}")) as valid_value
        `);
        
        const validValues = await db.execute(enumQuery);
        const validSet = new Set(validValues.map(v => v.valid_value));
        
        for (const row of result) {
          if (!validSet.has(row.value)) {
            this.addIssue('error', 'data_consistency', check.table, check.column, undefined,
              `Invalid enum value '${row.value}' found in ${check.table}.${check.column}`,
              `Valid values are: ${Array.from(validSet).join(', ')}`
            );
          }
        }
      } catch (error) {
        // Skip if table/column doesn't exist
      }
    }
  }

  private async checkIndexOptimization(indexes: any[]): Promise<void> {
    console.log(chalk.yellow('▶️  Checking index optimization...'));

    // Check for missing indexes on foreign keys
    const foreignKeyQuery = sql`
      SELECT 
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
    `;

    const foreignKeys = await db.execute(foreignKeyQuery);
    
    for (const fk of foreignKeys) {
      const hasIndex = indexes.some(idx => 
        idx.tablename === fk.table_name && 
        idx.indexdef.includes(`"${fk.column_name}"`)
      );
      
      if (!hasIndex) {
        this.addIssue('warning', 'performance', fk.table_name, fk.column_name, undefined,
          `Missing index on foreign key column`,
          `Consider adding: CREATE INDEX ON "${fk.table_name}"("${fk.column_name}")`
        );
      }
    }

    console.log(chalk.green('✅ Index optimization check completed\n'));
  }

  private async checkSchemaAlignment(): Promise<void> {
    console.log(chalk.yellow('▶️  Checking schema alignment with Drizzle definitions...'));

    // This would ideally compare with the actual schema file
    // For now, we'll check for expected core tables
    const expectedTables = [
      'StandardVersion', 'Clause', 'Question', 'Assessment', 'Answer',
      'User', 'Tenant', 'UserSession', 'Permission', 'RolePermission',
      'IntakeForm', 'IntakeQuestion', 'IntakeAnswer'
    ];

    const actualTablesQuery = sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    const actualTables = await db.execute(actualTablesQuery);
    const actualTableNames = actualTables.map(t => t.table_name);

    for (const expectedTable of expectedTables) {
      if (!actualTableNames.includes(expectedTable)) {
        this.addIssue('warning', 'schema_alignment', expectedTable, undefined, undefined,
          `Expected table '${expectedTable}' not found`,
          'Run database migrations to ensure schema is up to date'
        );
      }
    }

    console.log(chalk.green('✅ Schema alignment check completed\n'));
  }

  private async checkOrphanedRecords(): Promise<void> {
    console.log(chalk.yellow('▶️  Checking for orphaned records...'));

    // Check common orphaned record scenarios
    const orphanChecks = [
      {
        table: 'Assessment',
        column: 'stdId',
        refTable: 'StandardVersion',
        refColumn: 'id'
      },
      {
        table: 'Question',
        column: 'clauseId', 
        refTable: 'Clause',
        refColumn: 'id'
      },
      {
        table: 'Answer',
        column: 'assessmentId',
        refTable: 'Assessment', 
        refColumn: 'id'
      }
    ];

    for (const check of orphanChecks) {
      try {
        const orphanQuery = sql.raw(`
          SELECT COUNT(*) as count
          FROM "${check.table}" t1
          LEFT JOIN "${check.refTable}" t2 ON t1."${check.column}" = t2."${check.refColumn}"
          WHERE t1."${check.column}" IS NOT NULL AND t2."${check.refColumn}" IS NULL
        `);

        const result = await db.execute(orphanQuery);
        const orphanCount = parseInt(result[0]?.count as string || '0');

        if (orphanCount > 0) {
          this.addIssue('error', 'orphaned_records', check.table, check.column, undefined,
            `Found ${orphanCount} orphaned records in ${check.table}`,
            `Clean up orphaned records or fix foreign key references`
          );
        }
      } catch (error) {
        // Skip if tables don't exist
      }
    }

    console.log(chalk.green('✅ Orphaned records check completed\n'));
  }

  private addIssue(
    type: 'error' | 'warning' | 'info',
    category: string,
    table?: string,
    column?: string,
    constraint?: string,
    message: string,
    recommendation?: string
  ): void {
    this.issues.push({
      type,
      category,
      table,
      column,
      constraint,
      message,
      recommendation
    });
  }

  private displayResults(): void {
    console.log(chalk.blue('📊 Database Health Check Results\n'));

    const errors = this.issues.filter(i => i.type === 'error');
    const warnings = this.issues.filter(i => i.type === 'warning');
    const info = this.issues.filter(i => i.type === 'info');

    // Summary
    console.log(chalk.blue('🎯 Summary:'));
    console.log(chalk.red(`  ❌ Errors: ${errors.length}`));
    console.log(chalk.yellow(`  ⚠️  Warnings: ${warnings.length}`));
    console.log(chalk.blue(`  ℹ️  Info: ${info.length}\n`));

    // Display issues by category
    const categories = [...new Set(this.issues.map(i => i.category))];
    
    for (const category of categories) {
      const categoryIssues = this.issues.filter(i => i.category === category);
      if (categoryIssues.length === 0) continue;

      console.log(chalk.blue(`\n📋 ${category.toUpperCase()}:`));
      
      for (const issue of categoryIssues) {
        const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
        const color = issue.type === 'error' ? chalk.red : issue.type === 'warning' ? chalk.yellow : chalk.blue;
        
        let location = '';
        if (issue.table && issue.column) {
          location = ` [${issue.table}.${issue.column}]`;
        } else if (issue.table) {
          location = ` [${issue.table}]`;
        }
        
        console.log(color(`  ${icon} ${issue.message}${location}`));
        
        if (issue.recommendation) {
          console.log(chalk.gray(`     💡 ${issue.recommendation}`));
        }
      }
    }

    // Overall health status
    console.log(chalk.blue('\n🏥 Overall Database Health:'));
    if (errors.length === 0) {
      if (warnings.length === 0) {
        console.log(chalk.green('✅ EXCELLENT - No critical issues found'));
      } else {
        console.log(chalk.yellow('⚠️  GOOD - Minor issues found, consider addressing warnings'));
      }
    } else {
      console.log(chalk.red('❌ NEEDS ATTENTION - Critical errors found that should be addressed'));
    }

    console.log(chalk.blue('\n🔍 Health check completed successfully!\n'));
  }
}

// Main execution
async function runDatabaseHealthCheck() {
  const checker = new DatabaseHealthChecker();
  await checker.runHealthCheck();
}

// CLI execution guard
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseHealthCheck().catch(error => {
    console.error(chalk.red('💥 Health check failed:'), error);
    process.exit(1);
  });
}

export { DatabaseHealthChecker, runDatabaseHealthCheck };
