/**
 * Pre-Deployment Verification Script
 * 
 * Verifies that no test users exist in the database before deployment to production.
 * This should be run as part of the deployment pipeline to prevent test data pollution.
 */

import 'dotenv/config';
import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq, or, sql, like } from 'drizzle-orm';

interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isTestAccount: boolean;
}

/**
 * Test email patterns to check
 */
const TEST_EMAIL_PATTERNS = [
  '%@example.com',      // RFC reserved test domain
  '%@test.com',         // Common test domain
  '%+e2e@%',            // Plus-aliased test emails
  '%+test@%',           // Plus-aliased test emails
  'test%@%',            // Emails starting with 'test'
  'demo%@%',            // Emails starting with 'demo'
];

async function verifyNoTestUsers(): Promise<void> {
  console.log('🔍 Pre-Deployment Verification: Checking for test users...\n');

  try {
    // Check for users with isTestAccount flag
    const flaggedTestUsers = await db.query.users.findMany({
      where: eq(users.isTestAccount, true),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isTestAccount: true,
      },
    });

    // Check for users with test email patterns
    const patternConditions = TEST_EMAIL_PATTERNS.map(pattern => 
      like(users.email, pattern)
    );
    
    const patternTestUsers = await db.query.users.findMany({
      where: or(...patternConditions),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isTestAccount: true,
      },
    });

    // Combine and deduplicate
    const allTestUsers = new Map<string, TestUser>();
    
    [...flaggedTestUsers, ...patternTestUsers].forEach(user => {
      allTestUsers.set(user.id, user as TestUser);
    });

    if (allTestUsers.size === 0) {
      console.log('✅ VERIFICATION PASSED');
      console.log('   No test users found in the database.');
      console.log('   Safe to deploy to production.\n');
      process.exit(0);
    }

    // Test users found - print detailed report
    console.error('❌ VERIFICATION FAILED\n');
    console.error(`Found ${allTestUsers.size} test user(s) in the database:\n`);
    
    let index = 1;
    allTestUsers.forEach(user => {
      console.error(`${index}. ${user.firstName} ${user.lastName}`);
      console.error(`   Email: ${user.email}`);
      console.error(`   ID: ${user.id}`);
      console.error(`   Test Account Flag: ${user.isTestAccount ? 'YES' : 'NO (pattern match)'}\n`);
      index++;
    });

    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║  ⚠️  DEPLOYMENT BLOCKED: Test users detected                  ║');
    console.error('╠════════════════════════════════════════════════════════════════╣');
    console.error('║  Test users MUST NOT exist in production databases.           ║');
    console.error('║                                                                ║');
    console.error('║  To fix this issue:                                            ║');
    console.error('║                                                                ║');
    console.error('║  Option 1: Manual deletion (recommended for production)        ║');
    console.error('║    • Log into the database                                     ║');
    console.error('║    • Manually delete the test users listed above               ║');
    console.error('║    • Re-run this verification script                           ║');
    console.error('║                                                                ║');
    console.error('║  Option 2: Purge script (safe for mixed environments)          ║');
    console.error('║    • This will delete ONLY test users and their tenants        ║');
    console.error('║    • Run: npx tsx scripts/purge-users.ts                       ║');
    console.error('║    • Business data and non-test users are preserved            ║');
    console.error('║    • Safe to use in dev/staging with mixed data                ║');
    console.error('║                                                                ║');
    console.error('║  After cleanup, verify again with:                             ║');
    console.error('║    npx tsx scripts/verify-no-test-users.ts                     ║');
    console.error('╚════════════════════════════════════════════════════════════════╝\n');

    process.exit(1);

  } catch (error) {
    console.error('❌ Verification script failed with error:');
    console.error(error);
    console.error('\nUnable to verify database state. Deployment should be blocked.\n');
    process.exit(1);
  }
}

// Run verification
verifyNoTestUsers();
