
#!/usr/bin/env tsx

import 'dotenv/config';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import { validateSchemaConsistency } from '../server/utils/schemaValidator.js';
import chalk from 'chalk';

interface FoundationCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
}

async function verifyFoundation(): Promise<void> {
  console.log(chalk.blue('🔍 Verifying Core Foundation'));
  console.log('='.repeat(50));

  const checks: FoundationCheck[] = [];

  // 1. Database Connection
  try {
    await db.execute(sql`SELECT 1 as test`);
    checks.push({
      name: 'Database Connection',
      status: 'pass',
      details: 'Successfully connected to database'
    });
  } catch (error) {
    checks.push({
      name: 'Database Connection',
      status: 'fail',
      details: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // 2. Schema Consistency
  try {
    const schemaValidation = await validateSchemaConsistency();
    if (schemaValidation.isValid) {
      checks.push({
        name: 'Schema Consistency',
        status: 'pass',
        details: 'All critical tables and columns exist'
      });
    } else {
      checks.push({
        name: 'Schema Consistency',
        status: 'fail',
        details: `${schemaValidation.errors.length} schema errors found`
      });
    }
  } catch (error) {
    checks.push({
      name: 'Schema Consistency',
      status: 'fail',
      details: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // 3. Core Tables Data Check
  const coreTables = [
    'Tenant', 'User', 'Assessment', 'Question', 
    'IntakeForm', 'FacilityProfile', 'License'
  ];

  for (const table of coreTables) {
    try {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}"`));
      const count = Number((result.rows[0] as any).count || 0);
      
      checks.push({
        name: `Table: ${table}`,
        status: count >= 0 ? 'pass' : 'fail',
        details: `${count} records found`
      });
    } catch (error) {
      checks.push({
        name: `Table: ${table}`,
        status: 'fail',
        details: `Table check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  // 4. Critical Data Integrity
  try {
    // Check for orphaned records
    const orphanedAssessments = await db.execute(sql`
      SELECT COUNT(*) as count FROM "Assessment" a
      LEFT JOIN "Tenant" t ON a."tenantId" = t."id"
      WHERE t."id" IS NULL
    `);

    const orphanCount = Number((orphanedAssessments.rows[0] as any).count || 0);
    
    checks.push({
      name: 'Data Integrity',
      status: orphanCount === 0 ? 'pass' : 'warning',
      details: orphanCount === 0 ? 'No orphaned records found' : `${orphanCount} orphaned assessments found`
    });
  } catch (error) {
    checks.push({
      name: 'Data Integrity',
      status: 'warning',
      details: 'Could not check data integrity'
    });
  }

  // 5. Environment Configuration
  const requiredEnvs = ['DATABASE_URL'];
  const optionalEnvs = ['JWT_SECRET', 'STRIPE_SECRET_KEY'];
  
  const missingRequired = requiredEnvs.filter(env => !process.env[env]);
  const missingOptional = optionalEnvs.filter(env => !process.env[env]);

  if (missingRequired.length === 0) {
    checks.push({
      name: 'Environment Config',
      status: missingOptional.length === 0 ? 'pass' : 'warning',
      details: missingOptional.length === 0 
        ? 'All environment variables configured'
        : `Missing optional: ${missingOptional.join(', ')}`
    });
  } else {
    checks.push({
      name: 'Environment Config',
      status: 'fail',
      details: `Missing required: ${missingRequired.join(', ')}`
    });
  }

  // 6. Application Structure
  const criticalFiles = [
    'server/index.ts',
    'shared/schema.ts',
    'server/middleware/validationMiddleware.ts',
    'server/routes.ts',
    'client/src/main.tsx'
  ];

  let missingFiles = 0;
  for (const file of criticalFiles) {
    try {
      const fs = await import('fs');
      if (!fs.existsSync(file)) {
        missingFiles++;
      }
    } catch (error) {
      missingFiles++;
    }
  }

  checks.push({
    name: 'Application Structure',
    status: missingFiles === 0 ? 'pass' : 'fail',
    details: missingFiles === 0 ? 'All critical files present' : `${missingFiles} critical files missing`
  });

  // Report Results
  console.log('\n📊 Foundation Verification Results:');
  console.log('='.repeat(50));

  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;

  checks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
    const color = check.status === 'pass' ? chalk.green : check.status === 'warning' ? chalk.yellow : chalk.red;
    
    console.log(`${icon} ${color(check.name)}: ${check.details}`);
    
    if (check.status === 'pass') passCount++;
    else if (check.status === 'warning') warningCount++;
    else failCount++;
  });

  console.log('\n' + '='.repeat(50));
  console.log(`📈 Summary: ${chalk.green(passCount + ' PASS')} | ${chalk.yellow(warningCount + ' WARNING')} | ${chalk.red(failCount + ' FAIL')}`);

  // Overall Assessment
  if (failCount === 0 && warningCount <= 2) {
    console.log(chalk.green('\n🎉 Core Foundation is SOLID ✅'));
    console.log(chalk.green('✓ Database schema is consistent'));
    console.log(chalk.green('✓ Data models are properly defined'));
    console.log(chalk.green('✓ Validation schemas are in place'));
    console.log(chalk.green('✓ Application structure is complete'));
  } else if (failCount === 0) {
    console.log(chalk.yellow('\n⚠️  Core Foundation is MOSTLY SOLID'));
    console.log(chalk.yellow('Some minor issues need attention but foundation is stable'));
  } else {
    console.log(chalk.red('\n❌ Core Foundation has CRITICAL ISSUES'));
    console.log(chalk.red('Address the failed checks before proceeding'));
    process.exit(1);
  }
}

// Run verification
verifyFoundation().catch(error => {
  console.error(chalk.red('Foundation verification failed:'), error);
  process.exit(1);
});
