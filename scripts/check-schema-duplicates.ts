#!/usr/bin/env tsx

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import chalk from 'chalk';

interface DuplicateCheck {
  table: string;
  column: string;
  count: number;
  duplicateValues: any[];
}

async function checkSchemaDuplicates() {
  console.log(chalk.blue('🔍 Checking for duplicate columns and data integrity...\n'));

  try {
    // Check for duplicate column names across tables
    const columnQuery = sql`
      SELECT
        table_name,
        column_name,
        COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name, column_name
      HAVING COUNT(*) > 1
    `;

    const duplicateColumns = await db.execute(columnQuery);

    if (duplicateColumns.length > 0) {
      console.log(chalk.red('❌ Found duplicate column definitions:'));
      duplicateColumns.forEach(dup => {
        console.log(chalk.red(`  - ${dup.table_name}.${dup.column_name} (${dup.count} times)`));
      });
    } else {
      console.log(chalk.green('✅ No duplicate column definitions found'));
    }

    // Check for duplicate primary key values
    const tablesQuery = sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    const tables = await db.execute(tablesQuery);
    const duplicateChecks: DuplicateCheck[] = [];

    for (const table of tables) {
      const tableName = table.table_name;

      try {
        // Check for duplicate IDs
        const duplicateIdQuery = sql.raw(`
          SELECT id, COUNT(*) as count
          FROM "${tableName}"
          GROUP BY id
          HAVING COUNT(*) > 1
          LIMIT 10
        `);

        const duplicateIds = await db.execute(duplicateIdQuery);

        if (duplicateIds.length > 0) {
          duplicateChecks.push({
            table: tableName,
            column: 'id',
            count: duplicateIds.length,
            duplicateValues: duplicateIds.map(d => d.id)
          });
        }

        // Check for duplicate unique fields where applicable
        if (tableName === 'User') {
          const duplicateEmailQuery = sql.raw(`
            SELECT email, COUNT(*) as count
            FROM "User"
            WHERE email IS NOT NULL
            GROUP BY email
            HAVING COUNT(*) > 1
            LIMIT 5
          `);

          const duplicateEmails = await db.execute(duplicateEmailQuery);
          if (duplicateEmails.length > 0) {
            duplicateChecks.push({
              table: 'User',
              column: 'email',
              count: duplicateEmails.length,
              duplicateValues: duplicateEmails.map(d => d.email)
            });
          }
        }

        if (tableName === 'Assessment') {
          const duplicateNameQuery = sql.raw(`
            SELECT title, tenantId, COUNT(*) as count
            FROM "Assessment"
            WHERE title IS NOT NULL
            GROUP BY title, tenantId
            HAVING COUNT(*) > 1
            LIMIT 5
          `);

          const duplicateNames = await db.execute(duplicateNameQuery);
          if (duplicateNames.length > 0) {
            duplicateChecks.push({
              table: 'Assessment',
              column: 'title',
              count: duplicateNames.length,
              duplicateValues: duplicateNames.map(d => `${d.title} (tenant: ${d.tenantId})`)
            });
          }
        }

      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not check duplicates in ${tableName}: ${error}`));
      }
    }

    // Report findings
    if (duplicateChecks.length > 0) {
      console.log(chalk.red('\n❌ Found duplicate data:'));
      duplicateChecks.forEach(check => {
        console.log(chalk.red(`  - ${check.table}.${check.column}: ${check.count} duplicates`));
        check.duplicateValues.slice(0, 3).forEach(val => {
          console.log(chalk.gray(`    • ${val}`));
        });
      });
    } else {
      console.log(chalk.green('\n✅ No duplicate data found'));
    }

    // Check for foreign key integrity
    const fkQuery = sql`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `;

    const foreignKeys = await db.execute(fkQuery);
    let orphanedRecords = 0;

    for (const fk of foreignKeys) {
      if (!fk.foreign_table_name || !fk.foreign_column_name) continue;

      try {
        const orphanQuery = sql.raw(`
          SELECT COUNT(*) as count
          FROM "${fk.table_name}" t1
          LEFT JOIN "${fk.foreign_table_name}" t2
            ON t1."${fk.column_name}" = t2."${fk.foreign_column_name}"
          WHERE t1."${fk.column_name}" IS NOT NULL
            AND t2."${fk.foreign_column_name}" IS NULL
        `);

        const result = await db.execute(orphanQuery);
        const count = parseInt(result[0]?.count as string || '0');

        if (count > 0) {
          orphanedRecords += count;
          console.log(chalk.red(`❌ Found ${count} orphaned records in ${fk.table_name}.${fk.column_name}`));
        }
      } catch (error) {
        // Skip if tables don't exist
      }
    }

    if (orphanedRecords === 0) {
      console.log(chalk.green('✅ No orphaned foreign key references found'));
    }

    console.log(chalk.blue('\n📊 Schema integrity check completed\n'));

    return {
      hasDuplicateColumns: duplicateColumns.length > 0,
      hasDuplicateData: duplicateChecks.length > 0,
      hasOrphanedRecords: orphanedRecords > 0,
      isHealthy: duplicateColumns.length === 0 && duplicateChecks.length === 0 && orphanedRecords === 0
    };

  } catch (error) {
    console.error(chalk.red('💥 Schema duplicate check failed:'), error);
    throw error;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  checkSchemaDuplicates()
    .then(result => {
      if (result.isHealthy) {
        console.log(chalk.green('🎉 Schema is healthy and ready for Phase 1!'));
        process.exit(0);
      } else {
        console.log(chalk.red('🔧 Schema issues found that need to be addressed'));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(chalk.red('💥 Check failed:'), error);
      process.exit(1);
    });
}

export { checkSchemaDuplicates };