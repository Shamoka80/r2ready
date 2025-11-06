
#!/usr/bin/env tsx

import { db } from '../server/db';
import { users, tenants } from '../shared/schema';
import { eq, or, like } from 'drizzle-orm';
import chalk from 'chalk';

async function removeTestAccountsFromProduction(): Promise<void> {
  console.log(chalk.red('🚀 PRODUCTION CLEANUP - Removing all test accounts'));
  
  const testPatterns = [
    'admin+e2e@rur2.com',
    'tester+e2e@example.com',
    '%+e2e@%',
    '%test%',
    '%@example.com'
  ];
  
  let totalUsersRemoved = 0;
  let totalTenantsRemoved = 0;
  
  for (const pattern of testPatterns) {
    console.log(chalk.yellow(`🔍 Checking for pattern: ${pattern}`));
    
    // Find matching users
    const matchingUsers = await db.select().from(users)
      .where(like(users.email, pattern));
    
    if (matchingUsers.length > 0) {
      console.log(chalk.red(`❌ Found ${matchingUsers.length} test users matching pattern`));
      matchingUsers.forEach(user => {
        console.log(chalk.red(`   🚫 ${user.email} (${user.firstName} ${user.lastName})`));
      });
      
      // Delete users
      await db.delete(users).where(like(users.email, pattern));
      totalUsersRemoved += matchingUsers.length;
    }
  }
  
  // Clean up test tenants
  const testTenants = await db.select().from(tenants)
    .where(or(
      like(tenants.name, '%Test%'),
      like(tenants.name, '%Testing%'),
      like(tenants.domain, '%.test'),
      like(tenants.domain, '%example.com')
    ));
  
  if (testTenants.length > 0) {
    console.log(chalk.red(`❌ Found ${testTenants.length} test tenants`));
    testTenants.forEach(tenant => {
      console.log(chalk.red(`   🚫 ${tenant.name} (${tenant.domain})`));
    });
    
    await db.delete(tenants).where(or(
      like(tenants.name, '%Test%'),
      like(tenants.name, '%Testing%'),
      like(tenants.domain, '%.test'),
      like(tenants.domain, '%example.com')
    ));
    totalTenantsRemoved = testTenants.length;
  }
  
  if (totalUsersRemoved === 0 && totalTenantsRemoved === 0) {
    console.log(chalk.green('✅ PRODUCTION CLEAN - No test accounts found'));
  } else {
    console.log(chalk.green(`✅ PRODUCTION CLEANED - Removed ${totalUsersRemoved} users and ${totalTenantsRemoved} tenants`));
  }
  
  // Verify clean state
  const remainingTestUsers = await db.select().from(users)
    .where(or(
      like(users.email, '%+e2e@%'),
      like(users.email, '%test%'),
      like(users.email, '%@example.com')
    ));
  
  if (remainingTestUsers.length > 0) {
    console.log(chalk.red('❌ PRODUCTION CLEANUP FAILED - Test users still remain:'));
    remainingTestUsers.forEach(user => {
      console.log(chalk.red(`   🚫 ${user.email}`));
    });
    process.exit(1);
  }
  
  console.log(chalk.green('🎉 PRODUCTION VERIFIED CLEAN'));
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  removeTestAccountsFromProduction()
    .catch(error => {
      console.error(chalk.red('💥 Production cleanup failed:'), error);
      process.exit(1);
    });
}

export { removeTestAccountsFromProduction };
