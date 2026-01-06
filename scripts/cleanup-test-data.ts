
#!/usr/bin/env tsx

import chalk from 'chalk';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { users, tenants, assessments, facilities, licenses } from '../shared/schema';
import { and, like, lt } from 'drizzle-orm';

interface CleanupConfig {
  dryRun: boolean;
  olderThanHours: number;
  testPatterns: string[];
}

class TestDataCleaner {
  private db: any;
  private client: any;
  private config: CleanupConfig;

  constructor(config: CleanupConfig) {
    this.config = config;
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.client = postgres(process.env.DATABASE_URL);
    this.db = drizzle(this.client);
  }

  async cleanup(): Promise<void> {
    console.log(chalk.blue('🧹 Starting Test Data Cleanup\n'));
    
    if (this.config.dryRun) {
      console.log(chalk.yellow('🔍 DRY RUN MODE - No data will be deleted\n'));
    }

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - this.config.olderThanHours);

    console.log(`🕒 Cleaning test data older than: ${cutoffDate.toISOString()}`);
    console.log(`📋 Test patterns: ${this.config.testPatterns.join(', ')}\n`);

    try {
      // Clean in dependency order (child tables first)
      await this.cleanAssessments(cutoffDate);
      await this.cleanFacilities(cutoffDate);
      await this.cleanLicenses(cutoffDate);
      await this.cleanUsers(cutoffDate);
      await this.cleanTenants(cutoffDate);

      console.log(chalk.green('\n✅ Test data cleanup completed successfully!'));
      
    } catch (error) {
      console.error(chalk.red('\n💥 Cleanup failed:'), error);
      throw error;
    }
  }

  private async cleanAssessments(cutoffDate: Date): Promise<void> {
    console.log(chalk.yellow('📊 Cleaning test assessments...'));

    try {
      // Find test assessments
      const testAssessments = await this.db
        .select()
        .from(assessments)
        .where(
          and(
            this.createTestPatternCondition(assessments.title),
            lt(assessments.createdAt, cutoffDate)
          )
        );

      console.log(`   Found ${testAssessments.length} test assessments to clean`);

      if (!this.config.dryRun && testAssessments.length > 0) {
        await this.db
          .delete(assessments)
          .where(
            and(
              this.createTestPatternCondition(assessments.title),
              lt(assessments.createdAt, cutoffDate)
            )
          );
        console.log(chalk.green(`   ✅ Deleted ${testAssessments.length} test assessments`));
      }
    } catch (error) {
      console.error(chalk.red('   ❌ Failed to clean assessments:'), error);
    }
  }

  private async cleanFacilities(cutoffDate: Date): Promise<void> {
    console.log(chalk.yellow('🏭 Cleaning test facilities...'));

    try {
      const testFacilities = await this.db
        .select()
        .from(facilities)
        .where(
          and(
            this.createTestPatternCondition(facilities.name),
            lt(facilities.createdAt, cutoffDate)
          )
        );

      console.log(`   Found ${testFacilities.length} test facilities to clean`);

      if (!this.config.dryRun && testFacilities.length > 0) {
        await this.db
          .delete(facilities)
          .where(
            and(
              this.createTestPatternCondition(facilities.name),
              lt(facilities.createdAt, cutoffDate)
            )
          );
        console.log(chalk.green(`   ✅ Deleted ${testFacilities.length} test facilities`));
      }
    } catch (error) {
      console.error(chalk.red('   ❌ Failed to clean facilities:'), error);
    }
  }

  private async cleanLicenses(cutoffDate: Date): Promise<void> {
    console.log(chalk.yellow('📜 Cleaning test licenses...'));

    try {
      const testLicenses = await this.db
        .select()
        .from(licenses)
        .where(
          and(
            like(licenses.stripeSessionId, 'mock_%'),
            lt(licenses.createdAt, cutoffDate)
          )
        );

      console.log(`   Found ${testLicenses.length} test licenses to clean`);

      if (!this.config.dryRun && testLicenses.length > 0) {
        await this.db
          .delete(licenses)
          .where(
            and(
              like(licenses.stripeSessionId, 'mock_%'),
              lt(licenses.createdAt, cutoffDate)
            )
          );
        console.log(chalk.green(`   ✅ Deleted ${testLicenses.length} test licenses`));
      }
    } catch (error) {
      console.error(chalk.red('   ❌ Failed to clean licenses:'), error);
    }
  }

  private async cleanUsers(cutoffDate: Date): Promise<void> {
    console.log(chalk.yellow('👤 Cleaning test users...'));

    try {
      const testUsers = await this.db
        .select()
        .from(users)
        .where(
          and(
            this.createTestPatternCondition(users.email),
            lt(users.createdAt, cutoffDate)
          )
        );

      console.log(`   Found ${testUsers.length} test users to clean`);

      if (!this.config.dryRun && testUsers.length > 0) {
        await this.db
          .delete(users)
          .where(
            and(
              this.createTestPatternCondition(users.email),
              lt(users.createdAt, cutoffDate)
            )
          );
        console.log(chalk.green(`   ✅ Deleted ${testUsers.length} test users`));
      }
    } catch (error) {
      console.error(chalk.red('   ❌ Failed to clean users:'), error);
    }
  }

  private async cleanTenants(cutoffDate: Date): Promise<void> {
    console.log(chalk.yellow('🏢 Cleaning test tenants...'));

    try {
      const testTenants = await this.db
        .select()
        .from(tenants)
        .where(
          and(
            this.createTestPatternCondition(tenants.name),
            lt(tenants.createdAt, cutoffDate)
          )
        );

      console.log(`   Found ${testTenants.length} test tenants to clean`);

      if (!this.config.dryRun && testTenants.length > 0) {
        await this.db
          .delete(tenants)
          .where(
            and(
              this.createTestPatternCondition(tenants.name),
              lt(tenants.createdAt, cutoffDate)
            )
          );
        console.log(chalk.green(`   ✅ Deleted ${testTenants.length} test tenants`));
      }
    } catch (error) {
      console.error(chalk.red('   ❌ Failed to clean tenants:'), error);
    }
  }

  private createTestPatternCondition(field: any) {
    // Create OR condition for all test patterns
    const conditions = this.config.testPatterns.map(pattern => like(field, `%${pattern}%`));
    return sql`(${conditions.map(c => sql`${c}`).join(' OR ')})`;
  }

  async verifyNoProductionData(): Promise<boolean> {
    console.log(chalk.blue('🔍 Verifying no production data will be affected...\n'));

    // Check for potential production indicators
    const productionIndicators = [
      '@gmail.com',
      '@outlook.com', 
      '@yahoo.com',
      'production',
      'prod',
      'live'
    ];

    let hasProductionRisk = false;

    for (const indicator of productionIndicators) {
      const userCount = await this.db
        .select({ count: sql`count(*)` })
        .from(users)
        .where(
          and(
            like(users.email, `%${indicator}%`),
            this.createTestPatternCondition(users.email)
          )
        );

      if (userCount[0]?.count > 0) {
        console.log(chalk.red(`⚠️  Found ${userCount[0].count} users with production indicator: ${indicator}`));
        hasProductionRisk = true;
      }
    }

    if (hasProductionRisk) {
      console.log(chalk.red('\n❌ Production data risk detected! Please review before cleanup.'));
      return false;
    }

    console.log(chalk.green('✅ No production data risk detected.\n'));
    return true;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  const config: CleanupConfig = {
    dryRun: args.includes('--dry-run'),
    olderThanHours: parseInt(args.find(arg => arg.startsWith('--hours='))?.split('=')[1] || '24'),
    testPatterns: [
      'test-',
      '@test-',
      '@sanitized-test',
      '(Test)',
      'Test Account',
      'GreenTech Recycling Solutions',
      'EcoCompliance Advisory',
      '@greentech-recycling-test',
      '@ecocompliance-test'
    ]
  };

  console.log(chalk.blue('🧹 Test Data Cleanup Configuration:\n'));
  console.log(`Dry Run: ${config.dryRun ? 'Yes' : 'No'}`);
  console.log(`Cleanup data older than: ${config.olderThanHours} hours`);
  console.log(`Test patterns: ${config.testPatterns.length} configured\n`);

  try {
    const cleaner = new TestDataCleaner(config);
    
    // Safety check
    const isSafe = await cleaner.verifyNoProductionData();
    if (!isSafe && !config.dryRun) {
      console.log(chalk.red('❌ Aborting cleanup due to production data risk.'));
      console.log(chalk.yellow('💡 Use --dry-run to see what would be cleaned.'));
      process.exit(1);
    }

    await cleaner.cleanup();
    
    if (config.dryRun) {
      console.log(chalk.yellow('\n💡 This was a dry run. Use without --dry-run to actually clean data.'));
    }
    
  } catch (error) {
    console.error(chalk.red('💥 Cleanup failed:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TestDataCleaner };
