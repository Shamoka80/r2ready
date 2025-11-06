/**
 * Database Cleanup Helper for E2E Tests
 * 
 * This utility cleans up test data before running E2E tests.
 * It removes test users and their associated data while preserving
 * system data (standards, clauses, questions).
 */

import { db } from '../../server/db';
import { 
  users, 
  tenants,
  organizationProfiles,
  facilityProfiles,
  assessments,
  intakeForms,
  answers,
  evidenceFiles,
  auditLog
} from '../../shared/schema';
import { eq, or, inArray } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const TEST_EMAILS = [
  'shamoka@gmail.com',
  'jorelaiken@gmail.com'
];

/**
 * Clean database of all test users and their data
 */
export async function cleanupTestData() {
  console.log('🧹 Starting database cleanup for test users...\n');
  
  try {
    // Find test users
    const testUsers = await db.query.users.findMany({
      where: or(
        ...TEST_EMAILS.map(email => eq(users.email, email))
      )
    });
    
    if (testUsers.length === 0) {
      console.log('✅ No test users found in database. Database is clean.\n');
      return;
    }
    
    console.log(`Found ${testUsers.length} test user(s):`);
    testUsers.forEach(user => console.log(`  - ${user.email} (ID: ${user.id})`));
    console.log('');
    
    const userIds = testUsers.map(u => u.id);
    const tenantIds = testUsers.map(u => u.tenantId).filter((id): id is string => id !== null);
    
    // Delete in reverse dependency order
    // Note: Many deletes will cascade automatically via database constraints
    
    console.log('  Deleting tenant-related data...');
    
    // 1. Delete audit logs (must be first as they reference users and tenants)
    if (userIds.length > 0 || tenantIds.length > 0) {
      try {
        if (userIds.length > 0) {
          await db.delete(auditLog)
            .where(inArray(auditLog.userId, userIds));
        }
        if (tenantIds.length > 0) {
          await db.delete(auditLog)
            .where(inArray(auditLog.tenantId, tenantIds));
        }
        console.log(`    ✓ Deleted audit logs`);
      } catch (err) {
        console.log(`    ⚠️  Audit logs deletion failed:`, (err as Error).message);
      }
    }
    
    // 2. Delete evidence files
    if (tenantIds.length > 0) {
      try {
        const deletedEvidence = await db.delete(evidenceFiles)
          .where(inArray(evidenceFiles.tenantId, tenantIds));
        console.log(`    ✓ Deleted evidence files`);
      } catch (err) {
        console.log(`    ⚠️  Evidence files deletion skipped (may not exist)`);
      }
    }
    
    // 3. Delete assessments (will cascade delete answers)
    if (tenantIds.length > 0) {
      try {
        const deletedAssessments = await db.delete(assessments)
          .where(inArray(assessments.tenantId, tenantIds));
        console.log(`    ✓ Deleted assessments (and cascaded answers)`);
      } catch (err) {
        console.log(`    ⚠️  Assessments deletion skipped`);
      }
    }
    
    // 4. Delete intake forms
    if (tenantIds.length > 0) {
      try {
        const deletedIntakes = await db.delete(intakeForms)
          .where(inArray(intakeForms.tenantId, tenantIds));
        console.log(`    ✓ Deleted intake forms`);
      } catch (err) {
        console.log(`    ⚠️  Intake forms deletion skipped`);
      }
    }
    
    // 5. Delete facility profiles
    if (tenantIds.length > 0) {
      try {
        const deletedFacilities = await db.delete(facilityProfiles)
          .where(inArray(facilityProfiles.tenantId, tenantIds));
        console.log(`    ✓ Deleted facility profiles`);
      } catch (err) {
        console.log(`    ⚠️  Facility profiles deletion skipped`);
      }
    }
    
    // 6. Delete organization profiles
    if (tenantIds.length > 0) {
      try {
        const deletedOrgs = await db.delete(organizationProfiles)
          .where(inArray(organizationProfiles.tenantId, tenantIds));
        console.log(`    ✓ Deleted organization profiles`);
      } catch (err) {
        console.log(`    ⚠️  Organization profiles deletion skipped`);
      }
    }
    
    // 7. Delete users first (will allow tenant deletion)
    try {
      const deletedUsers = await db.delete(users)
        .where(inArray(users.id, userIds));
      console.log(`    ✓ Deleted users`);
    } catch (err) {
      console.log(`    ⚠️  Users deletion failed:`, (err as Error).message);
    }
    
    // 8. Delete tenants
    if (tenantIds.length > 0) {
      try {
        const deletedTenants = await db.delete(tenants)
          .where(inArray(tenants.id, tenantIds));
        console.log(`    ✓ Deleted tenants`);
      } catch (err) {
        console.log(`    ⚠️  Tenants deletion failed:`, (err as Error).message);
      }
    }
    
    console.log('\n✅ Database cleanup completed successfully!\n');
    
    // Verify cleanup
    const remainingUsers = await db.query.users.findMany({
      where: or(
        ...TEST_EMAILS.map(email => eq(users.email, email))
      )
    });
    
    if (remainingUsers.length === 0) {
      console.log('✅ Verification: All test users removed from database\n');
    } else {
      console.warn(`⚠️  Warning: ${remainingUsers.length} test user(s) still in database\n`);
    }
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    throw error;
  }
}

/**
 * Main execution - run if this file is executed directly
 */
const __filename = fileURLToPath(import.meta.url);

// Check if this is the main module being executed
if (process.argv[1] && process.argv[1].endsWith('db-cleanup.ts')) {
  cleanupTestData()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}
