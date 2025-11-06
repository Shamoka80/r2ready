
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import chalk from 'chalk';

interface SchemaValidationResult {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}

async function validateSchemaConsistency(): Promise<SchemaValidationResult> {
  console.log(chalk.blue('🔍 Validating Schema Consistency\n'));
  
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    // Check if all expected tables exist
    const tablesQuery = sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const existingTables = await db.execute(tablesQuery);
    const tableNames = (existingTables.rows || existingTables).map((t: any) => t.table_name);
    
    console.log(chalk.yellow('📊 Found tables:'));
    tableNames.forEach(name => console.log(chalk.gray(`  - ${name}`)));
    console.log('');

    // Check for core required tables
    const requiredTables = [
      'StandardVersion', 'Clause', 'Question', 'Assessment', 'Answer',
      'User', 'Tenant', 'UserSession', 'Permission', 'RolePermission'
    ];

    const missingTables = requiredTables.filter(table => !tableNames.includes(table));
    if (missingTables.length > 0) {
      issues.push(`Missing required tables: ${missingTables.join(', ')}`);
      recommendations.push('Run migrations: npx drizzle-kit push');
    }

    // Check enum types
    const enumsQuery = sql`
      SELECT typname as enum_name, 
             array_agg(enumlabel ORDER BY enumsortorder) as enum_values
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      GROUP BY typname
      ORDER BY typname
    `;

    const existingEnums = await db.execute(enumsQuery);
    const enumRows = (existingEnums.rows || existingEnums) as any[];
    
    console.log(chalk.yellow('🏷️  Found enums:'));
    enumRows.forEach(e => {
      console.log(chalk.gray(`  - ${e.enum_name}: [${e.enum_values.join(', ')}]`));
    });
    console.log('');

    // Check for required enums
    const requiredEnums = [
      'TenantType', 'BusinessRole', 'ConsultantRole', 'SessionStatus',
      'AssessmentStatus', 'ComplianceLevel', 'QuestionType'
    ];

    const enumNames = enumRows.map((e: any) => e.enum_name);
    const missingEnums = requiredEnums.filter(enumName => !enumNames.includes(enumName));
    
    if (missingEnums.length > 0) {
      issues.push(`Missing required enums: ${missingEnums.join(', ')}`);
      recommendations.push('Run migrations to create missing enum types');
    }

    // Check foreign key constraints
    const constraintsQuery = sql`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
      ORDER BY tc.table_name, tc.constraint_type
    `;

    const constraints = await db.execute(constraintsQuery);
    const constraintRows = (constraints.rows || constraints) as any[];
    
    console.log(chalk.yellow('🔗 Found constraints:'));
    const constraintsByType = constraintRows.reduce((acc, c) => {
      if (!acc[c.constraint_type]) acc[c.constraint_type] = [];
      acc[c.constraint_type].push(c);
      return acc;
    }, {} as Record<string, any[]>);

    Object.entries(constraintsByType).forEach(([type, items]) => {
      console.log(chalk.gray(`  ${type}: ${(items as any[]).length} constraints`));
    });
    console.log('');

    // Check indexes
    const indexQuery = sql`
      SELECT 
        schemaname,
        tablename, 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename
    `;

    const indexes = await db.execute(indexQuery);
    const indexRows = (indexes.rows || indexes) as any[];
    
    console.log(chalk.yellow('📈 Found custom indexes:'));
    indexRows.forEach((idx: any) => {
      console.log(chalk.gray(`  - ${idx.tablename}.${idx.indexname}`));
    });
    console.log('');

    // Performance recommendations
    if (indexRows.length < 5) {
      recommendations.push('Consider adding indexes on frequently queried columns (foreign keys, status fields)');
    }

    // Check data counts
    console.log(chalk.yellow('📊 Table row counts:'));
    for (const tableName of tableNames) {
      try {
        const countQuery = sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const result = await db.execute(countQuery);
        const resultRows = (result.rows || result) as any[];
        const count = resultRows[0]?.count || 0;
        console.log(chalk.gray(`  - ${tableName}: ${count} rows`));
      } catch (error) {
        console.log(chalk.red(`  - ${tableName}: Error counting rows - ${error}`));
      }
    }
    console.log('');

    const isValid = issues.length === 0;
    
    return {
      isValid,
      issues,
      recommendations
    };

  } catch (error) {
    issues.push(`Schema validation failed: ${error}`);
    return {
      isValid: false,
      issues,
      recommendations
    };
  }
}

// Main execution
async function main() {
  try {
    const result = await validateSchemaConsistency();
    
    if (result.isValid) {
      console.log(chalk.green('✅ Schema validation passed!\n'));
    } else {
      console.log(chalk.red('❌ Schema validation issues found:\n'));
      result.issues.forEach(issue => {
        console.log(chalk.red(`  - ${issue}`));
      });
      console.log('');
    }

    if (result.recommendations.length > 0) {
      console.log(chalk.blue('💡 Recommendations:\n'));
      result.recommendations.forEach(rec => {
        console.log(chalk.yellow(`  - ${rec}`));
      });
      console.log('');
    }

    if (!result.isValid) {
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('💥 Validation failed:'), error);
    process.exit(1);
  }
}

// CLI execution guard
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateSchemaConsistency };
