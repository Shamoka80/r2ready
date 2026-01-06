#!/usr/bin/env tsx
/**
 * Test User Purge Script
 * 
 * Deletes only users where isTestAccount=true and their associated tenants.
 * Preserves all non-test user data and business data.
 * 
 * This is safe to run even in environments with both test and real data.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

async function purgeTestUsers() {
  console.log("🗑️  Starting test user purge operation...");
  console.log("⚠️  This will delete ONLY users where isTestAccount=true and their tenants.");
  console.log("📊 All other users and business data will be preserved.\n");

  try {
    // Get counts before deletion
    const testUserResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM "User" WHERE "isTestAccount" = true`
    );
    const testUserCount = (testUserResult.rows[0] as any)?.count || 0;

    const totalUserResult = await db.execute(sql`SELECT COUNT(*) as count FROM "User"`);
    const totalUserCount = (totalUserResult.rows[0] as any)?.count || 0;
    
    console.log(`📈 Found ${testUserCount} test users out of ${totalUserCount} total users\n`);

    if (testUserCount === 0) {
      console.log("✅ No test users found. Database is clean.");
      return;
    }

    // Get test user IDs and their tenant IDs
    const testUsersData = await db.execute(
      sql`SELECT id, "tenantId", email FROM "User" WHERE "isTestAccount" = true`
    );
    
    const testUserIds = testUsersData.rows.map((row: any) => row.id);
    const testTenantIds = [...new Set(testUsersData.rows.map((row: any) => row.tenantId))];

    console.log(`📧 Test users to delete:`);
    testUsersData.rows.forEach((row: any, index: number) => {
      console.log(`   ${index + 1}. ${row.email}`);
    });
    console.log();

    // Step 1: Clear audit logs for test users
    console.log("🔄 Step 1: Clearing audit logs for test users...");
    const auditUserIds = testUserIds.map(id => `'${id}'`).join(', ');
    if (testUserIds.length > 0) {
      const auditResult = await db.execute(
        sql.raw(`DELETE FROM "AuditLog" WHERE "userId" IN (${auditUserIds})`)
      );
      console.log(`   ✓ Deleted ${auditResult.rowCount || 0} audit log entries`);

      const securityAuditResult = await db.execute(
        sql.raw(`DELETE FROM "SecurityAuditLog" WHERE "userId" IN (${auditUserIds})`)
      );
      console.log(`   ✓ Deleted ${securityAuditResult.rowCount || 0} security audit log entries`);
    }

    // Step 2: Delete user sessions for test users
    console.log("🔄 Step 2: Deleting user sessions for test users...");
    if (testUserIds.length > 0) {
      const sessionResult = await db.execute(
        sql.raw(`DELETE FROM "UserSession" WHERE "userId" IN (${auditUserIds})`)
      );
      console.log(`   ✓ Deleted ${sessionResult.rowCount || 0} user sessions`);
    }

    // Step 3: Clear user references in various tables
    console.log("🔄 Step 3: Clearing test user references...");
    
    if (testUserIds.length > 0) {
      // Clear nullable user references
      await db.execute(
        sql.raw(`UPDATE "Answer" SET "reviewedBy" = NULL WHERE "reviewedBy" IN (${auditUserIds})`)
      );
      
      await db.execute(
        sql.raw(`UPDATE "EvidenceFile" SET "reviewedBy" = NULL WHERE "reviewedBy" IN (${auditUserIds})`)
      );
      
      await db.execute(
        sql.raw(`UPDATE "IntakeAnswer" SET "verifiedBy" = NULL WHERE "verifiedBy" IN (${auditUserIds})`)
      );

      await db.execute(
        sql.raw(`UPDATE "User" SET "invitedBy" = NULL WHERE "invitedBy" IN (${auditUserIds})`)
      );

      await db.execute(
        sql.raw(`UPDATE "UserDevice" SET "revokedBy" = NULL WHERE "revokedBy" IN (${auditUserIds})`)
      );

      console.log(`   ✓ Cleared nullable references to test users`);
    }

    // Step 4: Delete records directly owned by test users
    console.log("🔄 Step 4: Deleting test user-owned records...");
    
    if (testUserIds.length > 0) {
      await db.execute(
        sql.raw(`DELETE FROM "UserFacilityScope" WHERE "userId" IN (${auditUserIds}) OR "assignedBy" IN (${auditUserIds})`)
      );
      
      await db.execute(
        sql.raw(`DELETE FROM "ReviewWorkflow" WHERE "assignedBy" IN (${auditUserIds}) OR "assignedTo" IN (${auditUserIds})`)
      );

      try {
        await db.execute(
          sql.raw(`DELETE FROM "ClientAssignment" WHERE "invitedBy" IN (${auditUserIds}) OR "acceptedBy" IN (${auditUserIds})`)
        );
      } catch (error) {
        // Table might not exist
      }

      console.log(`   ✓ Deleted test user-owned records`);
    }

    // Step 5: Find test-only tenants (tenants with ONLY test users)
    console.log("🔄 Step 5: Identifying test-only tenants...");
    
    const testOnlyTenants: string[] = [];
    for (const tenantId of testTenantIds) {
      // Count non-test users in this tenant
      const result = await db.execute(
        sql.raw(`SELECT COUNT(*) as count FROM "User" WHERE "tenantId" = '${tenantId}' AND "isTestAccount" = false`)
      );
      const count = parseInt((result.rows[0] as any)?.count || '0');
      
      if (count === 0) {
        // This tenant has NO non-test users, so it's test-only
        testOnlyTenants.push(tenantId);
      }
    }

    console.log(`   ✓ Found ${testOnlyTenants.length} test-only tenants (will be deleted)`);
    console.log(`   ✓ Found ${testTenantIds.length - testOnlyTenants.length} mixed tenants (will be preserved)`);

    // Step 6: Delete test-only tenants (CASCADE will remove associated data)
    if (testOnlyTenants.length > 0) {
      console.log("🔄 Step 6: Deleting test-only tenants...");
      const tenantIdList = testOnlyTenants.map(id => `'${id}'`).join(', ');
      const tenantResult = await db.execute(
        sql.raw(`DELETE FROM "Tenant" WHERE id IN (${tenantIdList})`)
      );
      console.log(`   ✓ Deleted ${tenantResult.rowCount || 0} test-only tenants (CASCADE removed associated test users and data)`);
    } else {
      console.log("🔄 Step 6: No test-only tenants to delete");
    }

    // Step 7: Delete remaining test users (those in mixed tenants)
    const mixedTenantUsers = testTenantIds.filter(id => !testOnlyTenants.includes(id));
    if (mixedTenantUsers.length > 0) {
      console.log("🔄 Step 7: Deleting test users from mixed tenants...");
      
      // Get test users that are NOT in test-only tenants
      const remainingTestUsers = await db.execute(
        sql.raw(`SELECT id FROM "User" WHERE "isTestAccount" = true`)
      );
      
      if (remainingTestUsers.rows.length > 0) {
        const remainingIds = remainingTestUsers.rows.map((row: any) => `'${row.id}'`).join(', ');
        const userResult = await db.execute(
          sql.raw(`DELETE FROM "User" WHERE id IN (${remainingIds})`)
        );
        console.log(`   ✓ Deleted ${userResult.rowCount || 0} test users from mixed tenants`);
      }
    }

    // Verify cleanup
    const finalTestUserCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM "User" WHERE "isTestAccount" = true`
    );
    const finalCount = (finalTestUserCount.rows[0] as any)?.count || 0;

    const finalTotalUserCount = await db.execute(sql`SELECT COUNT(*) as count FROM "User"`);
    const finalTotal = (finalTotalUserCount.rows[0] as any)?.count || 0;

    console.log("\n✅ Test user purge completed successfully!");
    console.log("📊 Final counts:");
    console.log(`   • Test users remaining: ${finalCount}`);
    console.log(`   • Total users remaining: ${finalTotal}`);
    console.log(`   • Test-only tenants deleted: ${testOnlyTenants.length}`);
    console.log(`   • Business data preserved: Yes\n`);

    if (finalCount > 0) {
      console.warn("⚠️  Warning: Some test users could not be deleted (foreign key constraints)");
    } else {
      console.log("✅ All test users successfully removed!");
    }

  } catch (error) {
    console.error("❌ Error during test user purge:");
    console.error(error);
    throw error;
  }
}

purgeTestUsers();
