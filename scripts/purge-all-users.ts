#!/usr/bin/env tsx

import { db } from '../server/db';
import { users, tenants, userSessions, auditLog, facilityProfiles, assessments } from '../shared/schema';
import { sql } from 'drizzle-orm';
import chalk from 'chalk';

interface PurgeStats {
  usersDeleted: number;
  tenantsDeleted: number;
  sessionsDeleted: number;
  auditLogsDeleted: number;
  facilitiesDeleted: number;
  assessmentsDeleted: number;
}

async function purgeAllUsers(): Promise<PurgeStats> {
  console.log(chalk.red('🧨 STARTING COMPLETE USER PURGE'));
  console.log(chalk.yellow('⚠️  This will delete ALL users from ALL identity stores'));
  
  const stats: PurgeStats = {
    usersDeleted: 0,
    tenantsDeleted: 0,
    sessionsDeleted: 0,
    auditLogsDeleted: 0,
    facilitiesDeleted: 0,
    assessmentsDeleted: 0
  };

  try {
    // Count existing data before deletion
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const tenantCount = await db.select({ count: sql<number>`count(*)` }).from(tenants);
    const sessionCount = await db.select({ count: sql<number>`count(*)` }).from(userSessions);
    
    stats.usersDeleted = userCount[0]?.count || 0;
    stats.tenantsDeleted = tenantCount[0]?.count || 0;
    stats.sessionsDeleted = sessionCount[0]?.count || 0;

    console.log(chalk.blue(`📊 Found ${stats.usersDeleted} users, ${stats.tenantsDeleted} tenants, ${stats.sessionsDeleted} sessions`));

    // Delete in dependency order (child tables first)
    console.log(chalk.yellow('🗑️  Deleting audit logs...'));
    await db.delete(auditLog);
    
    console.log(chalk.yellow('🗑️  Deleting user sessions...'));
    await db.delete(userSessions);
    
    console.log(chalk.yellow('🗑️  Deleting assessments...'));
    const assessmentResult = await db.delete(assessments).returning({ id: sql<string>`id` });
    stats.assessmentsDeleted = assessmentResult.length;
    
    console.log(chalk.yellow('🗑️  Deleting facility profiles...'));
    const facilityResult = await db.delete(facilityProfiles).returning({ id: sql<string>`id` });
    stats.facilitiesDeleted = facilityResult.length;
    
    console.log(chalk.yellow('🗑️  Deleting users...'));
    await db.delete(users);
    
    console.log(chalk.yellow('🗑️  Deleting tenants...'));
    await db.delete(tenants);

    // Verify complete purge
    const remainingUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
    const remainingTenants = await db.select({ count: sql<number>`count(*)` }).from(tenants);
    
    if (remainingUsers[0]?.count === 0 && remainingTenants[0]?.count === 0) {
      console.log(chalk.green('✅ PURGE COMPLETE - Zero users and tenants remain'));
    } else {
      throw new Error(`Purge incomplete: ${remainingUsers[0]?.count} users, ${remainingTenants[0]?.count} tenants remain`);
    }

    return stats;

  } catch (error) {
    console.error(chalk.red('💥 Purge failed:'), error);
    throw error;
  }
}

// Verify zero state
async function verifyZeroState(): Promise<void> {
  console.log(chalk.blue('🔍 Verifying zero state...'));
  
  const tables = [
    { name: 'users', table: users },
    { name: 'tenants', table: tenants },
    { name: 'userSessions', table: userSessions },
    { name: 'auditLog', table: auditLog },
    { name: 'facilityProfiles', table: facilityProfiles },
    { name: 'assessments', table: assessments }
  ];

  for (const { name, table } of tables) {
    const count = await db.select({ count: sql<number>`count(*)` }).from(table);
    const remaining = count[0]?.count || 0;
    
    if (remaining > 0) {
      console.log(chalk.red(`❌ ${name}: ${remaining} records remain`));
    } else {
      console.log(chalk.green(`✅ ${name}: 0 records (clean)`));
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  purgeAllUsers()
    .then(async (stats) => {
      console.log(chalk.green('\n🎯 PURGE STATISTICS:'));
      console.log(`   Users deleted: ${stats.usersDeleted}`);
      console.log(`   Tenants deleted: ${stats.tenantsDeleted}`);
      console.log(`   Sessions deleted: ${stats.sessionsDeleted}`);
      console.log(`   Audit logs deleted: ${stats.auditLogsDeleted}`);
      console.log(`   Facilities deleted: ${stats.facilitiesDeleted}`);
      console.log(`   Assessments deleted: ${stats.assessmentsDeleted}`);
      
      await verifyZeroState();
      
      console.log(chalk.blue('\n📋 NEXT STEPS:'));
      console.log('1. Run setup-test-users-from-md.ts to create authorized test accounts');
      console.log('2. All future tests must use only Test_Users.md accounts');
      console.log('3. CI will enforce this restriction');
      
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red('💥 Purge failed:'), error);
      process.exit(1);
    });
}

export { purgeAllUsers, verifyZeroState };
