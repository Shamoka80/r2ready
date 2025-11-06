#!/usr/bin/env tsx
import { autoMigrateSchema } from '../utils/schemaMigration';
import { validateSchemaConsistency } from '../utils/schemaValidator';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const command = process.argv[2] || 'auto';

  try {
    console.log('🚀 Database Migration Tool\n');

    switch (command) {
      case 'auto':
        console.log('Running automatic migration...\n');
        const result = await autoMigrateSchema();
        
        if (result.success) {
          console.log('\n✅ Migration completed successfully');
          if (result.appliedMigrations.length > 0) {
            console.log('\n📝 Applied migrations:');
            result.appliedMigrations.forEach(m => console.log(`  - ${m}`));
          }
          return 0;
        } else {
          console.error('\n❌ Migration failed');
          if (result.errors.length > 0) {
            console.error('\n❌ Errors:');
            result.errors.forEach(e => console.error(`  - ${e}`));
          }
          return 1;
        }

      case 'validate':
        console.log('Validating schema...\n');
        const validation = await validateSchemaConsistency();
        
        if (validation.isValid) {
          console.log('✅ Schema validation passed');
          return 0;
        } else {
          console.error('\n❌ Schema validation failed');
          if (validation.errors.length > 0) {
            console.error('\n❌ Errors:');
            validation.errors.forEach(e => console.error(`  ${e}`));
          }
          if (validation.warnings.length > 0) {
            console.warn('\n⚠️  Warnings:');
            validation.warnings.forEach(w => console.warn(`  ${w}`));
          }
          return 1;
        }

      case 'status':
        console.log('Checking schema status...\n');
        const status = await validateSchemaConsistency();
        
        console.log(`Status: ${status.isValid ? '✅ In sync' : '⚠️  Out of sync'}`);
        console.log(`Errors: ${status.errors.length}`);
        console.log(`Warnings: ${status.warnings.length}`);
        
        if (status.errors.length > 0) {
          console.log('\n❌ Errors:');
          status.errors.forEach(e => console.log(`  ${e}`));
        }
        
        if (status.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          status.warnings.forEach(w => console.log(`  ${w}`));
        }
        
        return status.isValid ? 0 : 1;

      case 'help':
        console.log('Usage: npm run db:migrate [command]');
        console.log('\nCommands:');
        console.log('  auto     - Automatically detect and apply schema fixes (default)');
        console.log('  validate - Validate schema without making changes');
        console.log('  status   - Show current schema status');
        console.log('  help     - Show this help message');
        console.log('\nExamples:');
        console.log('  npm run db:migrate          # Run auto migration');
        console.log('  npm run db:migrate validate # Just validate schema');
        console.log('  npm run db:migrate status   # Check status');
        return 0;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "npm run db:migrate help" for usage information');
        return 1;
    }
  } catch (error) {
    console.error('❌ Migration tool failed:', error);
    return 1;
  } finally {
    // Close database connection gracefully
    await db.execute(sql`SELECT 1`).catch(() => {});
  }
}

main()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
