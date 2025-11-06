
#!/usr/bin/env tsx

import { db } from '../server/db';
import { users, tenants, userSessions, auditLog, facilityProfiles, assessments, answers, evidenceFiles, intakeAnswers, licenses, licenseEvents } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import chalk from 'chalk';

const TARGET_EMAIL = 'shamoka@gmail.com';

interface DeletionStats {
  usersDeleted: number;
  tenantsDeleted: number;
  sessionsDeleted: number;
  auditLogsDeleted: number;
  facilitiesDeleted: number;
  assessmentsDeleted: number;
  answersDeleted: number;
  evidenceFilesDeleted: number;
  intakeAnswersDeleted: number;
  licensesDeleted: number;
  licenseEventsDeleted: number;
}

async function deleteSpecificUser(email: string): Promise<DeletionStats> {
  console.log(chalk.red(`🗑️  DELETING USER: ${email}`));
  console.log(chalk.yellow('⚠️  This will delete ALL data associated with this user'));
  
  const stats: DeletionStats = {
    usersDeleted: 0,
    tenantsDeleted: 0,
    sessionsDeleted: 0,
    auditLogsDeleted: 0,
    facilitiesDeleted: 0,
    assessmentsDeleted: 0,
    answersDeleted: 0,
    evidenceFilesDeleted: 0,
    intakeAnswersDeleted: 0,
    licensesDeleted: 0,
    licenseEventsDeleted: 0
  };

  try {
    // Find the user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        tenant: true
      }
    });

    if (!user) {
      console.log(chalk.yellow(`❌ User ${email} not found`));
      return stats;
    }

    console.log(chalk.blue(`📊 Found user: ${user.firstName} ${user.lastName} (${user.email})`));
    console.log(chalk.blue(`📊 Tenant: ${user.tenant?.name} (${user.tenant?.id})`));

    const userId = user.id;
    const tenantId = user.tenantId;

    // Check if this is the only user in the tenant
    const tenantUsers = await db.query.users.findMany({
      where: eq(users.tenantId, tenantId)
    });

    const isOnlyUserInTenant = tenantUsers.length === 1;
    console.log(chalk.blue(`📊 Users in tenant: ${tenantUsers.length} (will ${isOnlyUserInTenant ? 'DELETE' : 'PRESERVE'} tenant)`));

    // Step 1: Delete user sessions
    console.log(chalk.yellow('🗑️  Deleting user sessions...'));
    const sessionResult = await db.delete(userSessions)
      .where(eq(userSessions.userId, userId));
    stats.sessionsDeleted = sessionResult.rowCount || 0;
    console.log(`   ✓ Deleted ${stats.sessionsDeleted} sessions`);

    // Step 2: Delete audit logs
    console.log(chalk.yellow('🗑️  Deleting audit logs...'));
    const auditResult = await db.delete(auditLog)
      .where(eq(auditLog.userId, userId));
    stats.auditLogsDeleted = auditResult.rowCount || 0;
    console.log(`   ✓ Deleted ${stats.auditLogsDeleted} audit logs`);

    // Step 3: Clear user references in other tables
    console.log(chalk.yellow('🗑️  Clearing user references...'));
    
    // Clear nullable references
    await db.execute(
      sql`UPDATE "Answer" SET "reviewedBy" = NULL WHERE "reviewedBy" = ${userId}`
    );
    
    await db.execute(
      sql`UPDATE "EvidenceFile" SET "reviewedBy" = NULL WHERE "reviewedBy" = ${userId}`
    );
    
    await db.execute(
      sql`UPDATE "IntakeAnswer" SET "verifiedBy" = NULL WHERE "verifiedBy" = ${userId}`
    );

    await db.execute(
      sql`UPDATE "User" SET "invitedBy" = NULL WHERE "invitedBy" = ${userId}`
    );

    console.log(`   ✓ Cleared nullable references`);

    // Step 4: Delete user-owned records
    console.log(chalk.yellow('🗑️  Deleting user-owned records...'));
    
    // Delete UserFacilityScope records
    await db.execute(
      sql`DELETE FROM "UserFacilityScope" WHERE "userId" = ${userId} OR "assignedBy" = ${userId}`
    );

    // Delete ReviewWorkflow records
    await db.execute(
      sql`DELETE FROM "ReviewWorkflow" WHERE "assignedBy" = ${userId} OR "assignedTo" = ${userId}`
    );

    console.log(`   ✓ Deleted user-owned records`);

    if (isOnlyUserInTenant) {
      // If this is the only user, delete all tenant data
      console.log(chalk.red('🗑️  Deleting all tenant data (user was sole owner)...'));

      // Delete answers for tenant assessments
      const answerResult = await db.execute(
        sql`DELETE FROM "Answer" WHERE "assessmentId" IN (
          SELECT "id" FROM "Assessment" WHERE "tenantId" = ${tenantId}
        )`
      );
      stats.answersDeleted = answerResult.rowCount || 0;

      // Delete evidence files for tenant assessments  
      const evidenceResult = await db.execute(
        sql`DELETE FROM "EvidenceFile" WHERE "assessmentId" IN (
          SELECT "id" FROM "Assessment" WHERE "tenantId" = ${tenantId}
        )`
      );
      stats.evidenceFilesDeleted = evidenceResult.rowCount || 0;

      // Delete intake answers for tenant
      const intakeResult = await db.delete(intakeAnswers)
        .where(eq(intakeAnswers.tenantId, tenantId));
      stats.intakeAnswersDeleted = intakeResult.rowCount || 0;

      // Delete assessments
      const assessmentResult = await db.delete(assessments)
        .where(eq(assessments.tenantId, tenantId));
      stats.assessmentsDeleted = assessmentResult.rowCount || 0;

      // Delete facility profiles
      const facilityResult = await db.delete(facilityProfiles)
        .where(eq(facilityProfiles.tenantId, tenantId));
      stats.facilitiesDeleted = facilityResult.rowCount || 0;

      // Delete license events
      const licenseEventResult = await db.delete(licenseEvents)
        .where(eq(licenseEvents.tenantId, tenantId));
      stats.licenseEventsDeleted = licenseEventResult.rowCount || 0;

      // Delete licenses
      const licenseResult = await db.delete(licenses)
        .where(eq(licenses.tenantId, tenantId));
      stats.licensesDeleted = licenseResult.rowCount || 0;

      console.log(`   ✓ Deleted ${stats.answersDeleted} answers`);
      console.log(`   ✓ Deleted ${stats.evidenceFilesDeleted} evidence files`);
      console.log(`   ✓ Deleted ${stats.intakeAnswersDeleted} intake answers`);
      console.log(`   ✓ Deleted ${stats.assessmentsDeleted} assessments`);
      console.log(`   ✓ Deleted ${stats.facilitiesDeleted} facilities`);
      console.log(`   ✓ Deleted ${stats.licenseEventsDeleted} license events`);
      console.log(`   ✓ Deleted ${stats.licensesDeleted} licenses`);
    }

    // Step 5: Delete the user
    console.log(chalk.yellow('🗑️  Deleting user account...'));
    const userResult = await db.delete(users)
      .where(eq(users.id, userId));
    stats.usersDeleted = userResult.rowCount || 0;
    console.log(`   ✓ Deleted ${stats.usersDeleted} user`);

    // Step 6: Delete tenant if it was the only user
    if (isOnlyUserInTenant) {
      console.log(chalk.yellow('🗑️  Deleting empty tenant...'));
      const tenantResult = await db.delete(tenants)
        .where(eq(tenants.id, tenantId));
      stats.tenantsDeleted = tenantResult.rowCount || 0;
      console.log(`   ✓ Deleted ${stats.tenantsDeleted} tenant`);
    }

    // Verify deletion
    const remainingUser = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!remainingUser) {
      console.log(chalk.green('✅ USER DELETION COMPLETE'));
    } else {
      throw new Error('User deletion failed - user still exists');
    }

    return stats;

  } catch (error) {
    console.error(chalk.red('💥 Deletion failed:'), error);
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deleteSpecificUser(TARGET_EMAIL)
    .then(async (stats) => {
      console.log(chalk.green('\n🎯 DELETION STATISTICS:'));
      console.log(`   Users deleted: ${stats.usersDeleted}`);
      console.log(`   Tenants deleted: ${stats.tenantsDeleted}`);
      console.log(`   Sessions deleted: ${stats.sessionsDeleted}`);
      console.log(`   Audit logs deleted: ${stats.auditLogsDeleted}`);
      console.log(`   Facilities deleted: ${stats.facilitiesDeleted}`);
      console.log(`   Assessments deleted: ${stats.assessmentsDeleted}`);
      console.log(`   Answers deleted: ${stats.answersDeleted}`);
      console.log(`   Evidence files deleted: ${stats.evidenceFilesDeleted}`);
      console.log(`   Intake answers deleted: ${stats.intakeAnswersDeleted}`);
      console.log(`   Licenses deleted: ${stats.licensesDeleted}`);
      console.log(`   License events deleted: ${stats.licenseEventsDeleted}`);
      
      console.log(chalk.green('\n✅ User and all associated data have been permanently deleted'));
      
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red('💥 Deletion failed:'), error);
      process.exit(1);
    });
}

export { deleteSpecificUser };
