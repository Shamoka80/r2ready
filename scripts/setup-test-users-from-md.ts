#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { db } from '../server/db';
import { users, tenants, licenses } from '../shared/schema';
import { AuthService } from '../server/services/authService';
import chalk from 'chalk';
import { eq } from 'drizzle-orm';

interface TestUser {
  name: string;
  email: string;
  password: string;
  company: string;
  role: 'superuser' | 'user';
  flags: {
    is_superuser: boolean;
    bypass_validation: boolean;
    is_active: boolean;
  };
  mfa?: {
    secret: string;
    uri: string;
    backupCodes: string[];
  };
  apiToken?: string;
  testCard?: string;
}

function parseTestUsersFromMd(): TestUser[] {
  console.log(chalk.blue('📖 Reading Test_Users.md...'));

  try {
    const content = readFileSync('Test_Users.md', 'utf-8');

    // Parse the two defined test users from the markdown
    const users: TestUser[] = [
      {
        name: 'Jonnie Doublin',
        email: 'admin+e2e@rur2.com',
        password: 'RuR2@Admin2024!',
        company: 'RuR2 Systems LLC',
        role: 'superuser',
        flags: {
          is_superuser: true,
          bypass_validation: true,
          is_active: true
        },
        mfa: {
          secret: 'JBSWY3DPEHPK3PXP',
          uri: 'otpauth://totp/RUR2:admin+e2e@rur2.com?secret=JBSWY3DPEHPK3PXP&issuer=RUR2',
          backupCodes: ['7F2Q-9KDM', 'Q3WZ-2H8N', 'BX4A-ML77', '9T0C-2V6P', 'H2YJ-KE4R']
        },
        apiToken: 'rur2_test_admin_7e1f3c8b',
        testCard: '4242 0042 4002 4112'
      },
      {
        name: 'Julia Robbin',
        email: 'tester+e2e@example.com',
        password: 'TestUser123!',
        company: 'Testing Company Inc',
        role: 'user',
        flags: {
          is_superuser: false,
          bypass_validation: false,
          is_active: true
        },
        mfa: {
          secret: 'KRUGS4ZANFZSA5TJ',
          uri: 'otpauth://totp/RUR2:tester+e2e@example.com?secret=KRUGS4ZANFZSA5TJ&issuer=RUR2',
          backupCodes: ['Z4MP-1NQA', 'RW6C-J8F2', '2K7V-PQ3B', 'L0NY-6ZTA', 'UF9H-3EWD']
        },
        apiToken: 'rur2_test_user_b49ad2e1',
        testCard: '4000 0027 6000 3184'
      }
    ];

    console.log(chalk.green(`✅ Found ${users.length} authorized test users in Test_Users.md`));
    return users;

  } catch (error) {
    console.error(chalk.red('❌ Failed to read Test_Users.md:'), error);
    throw new Error('Test_Users.md is required and must be readable');
  }
}

async function setupAuthorizedTestUsers(): Promise<void> {
  console.log(chalk.blue('🔧 Setting up authorized test users from Test_Users.md'));

  const testUsers = parseTestUsersFromMd();

  for (const testUser of testUsers) {
    console.log(chalk.yellow(`\n👤 Creating ${testUser.role}: ${testUser.name} (${testUser.email})`));

    // Create tenant
    const [tenant] = await db.insert(tenants).values({
      id: `test-tenant-${testUser.role}`,
      name: testUser.company,
      tenantType: testUser.role === 'superuser' ? 'BUSINESS' : 'BUSINESS',
      domain: testUser.role === 'superuser' ? 'rur2.com' : 'example.com',
      isActive: true,
      licenseStatus: 'active',
      settings: {
        testAccount: true,
        source: 'Test_Users.md'
      }
    }).returning();

    // Create user
    const passwordHash = await AuthService.hashPassword(testUser.password);
    const [user] = await db.insert(users).values({
      id: `test-user-${testUser.role}`,
      tenantId: tenant.id,
      email: testUser.email,
      passwordHash,
      firstName: testUser.name.split(' ')[0],
      lastName: testUser.name.split(' ').slice(1).join(' '),
      businessRole: testUser.role === 'superuser' ? 'business_owner' : 'team_member',
      isActive: testUser.flags.is_active,
      emailVerified: true,
      setupStatus: 'setup_complete',
      metadata: {
        testAccount: true,
        source: 'Test_Users.md',
        mfaSecret: testUser.mfa?.secret,
        apiToken: testUser.apiToken,
        testCard: testUser.testCard
      }
    }).returning();

    console.log(`✅ Created user account: ${email}`);

      // Create test license for the account
      const existingLicense = await db.query.licenses.findFirst({
        where: eq(licenses.tenantId, tenant.id)
      });

      if (!existingLicense) {
        await db.insert(licenses).values({
          id: `test-license-${tenant.id}`,
          tenantId: tenant.id,
          planId: 'test-plan',
          planName: testUser.role === 'superuser' ? 'Test Enterprise License' : 'Test Solo License',
          licenseType: 'base',
          maxFacilities: testUser.role === 'superuser' ? 999 : 1,
          maxSeats: testUser.role === 'superuser' ? 999 : 3,
          supportTier: 'basic',
          isActive: true,
          stripeSessionId: `test-session-${Date.now()}`,
          amountPaid: 0,
          currency: 'usd',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Created test license for: ${testUser.email}`);
      }
    }
  }

  // Validate only authorized accounts exist
  console.log('🔍 Validating only authorized accounts exist...');
  const allUsers = await db.query.users.findMany({
    columns: { email: true }
  });

  const authorizedEmails = [
    'admin+e2e@rur2.com',
    'tester+e2e@example.com'
  ];

  const unauthorizedUsers = allUsers.filter(user => !authorizedEmails.includes(user.email));

  if (unauthorizedUsers.length > 0) {
    console.log(chalk.red('❌ UNAUTHORIZED USERS DETECTED:'));
    unauthorizedUsers.forEach(user => {
      console.log(chalk.red(`   ${user.email} (${user.id})`));
    });
    throw new Error('Unauthorized test users detected. Only Test_Users.md accounts are allowed.');
  }

  console.log(chalk.green('✅ Only authorized test accounts exist'));
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAuthorizedTestUsers()
    .then(() => validateOnlyAuthorizedAccounts())
    .then(() => {
      console.log(chalk.green('\n🚀 Test user setup complete and validated!'));
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red('💥 Setup failed:'), error);
      process.exit(1);
    });
}

export { setupAuthorizedTestUsers, parseTestUsersFromMd, validateOnlyAuthorizedAccounts };