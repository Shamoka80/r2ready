#!/usr/bin/env tsx
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

/**
 * Test user definitions from Test_Users.md
 * These are the ONLY test users allowed in the system
 */
const TEST_USERS = [
  {
    // Superuser Tester
    email: "admin+e2e@rur2.com",
    password: "RuR2@Admin2024!",
    firstName: "Jonnie",
    lastName: "Doublin",
    companyName: "RuR2 Systems LLC",
    tenantType: "BUSINESS" as const,
    role: "business_owner" as const,
    mfaSecret: "JBSWY3DPEHPK3PXP",
    apiToken: "rur2_test_admin_7e1f3c8b",
  },
  {
    // Regular User Tester
    email: "tester+e2e@example.com",
    password: "TestUser123!",
    firstName: "Julia",
    lastName: "Robbin",
    companyName: "Testing Company Inc",
    tenantType: "BUSINESS" as const,
    role: "team_member" as const,
    mfaSecret: "KRUGS4ZANFZSA5TJ",
    apiToken: "rur2_test_user_b49ad2e1",
  },
] as const;

async function seedTestUsers() {
  console.log("🌱 Starting test user seeding from Test_Users.md...");
  console.log("📋 These are the ONLY authorized test accounts for this system.\n");

  try {
    // Check if users already exist
    const existingUsersResult = await db.execute(
      sql`SELECT email FROM "User" WHERE "isTestAccount" = true`
    );
    
    if (existingUsersResult.rows.length > 0) {
      console.log("⚠️  Test users already exist:");
      existingUsersResult.rows.forEach((row: any) => {
        console.log(`   • ${row.email}`);
      });
      console.log("\n💡 Run purge-users script first if you want to recreate them.\n");
      return;
    }

    let usersCreated = 0;

    for (const testUser of TEST_USERS) {
      console.log(`\n👤 Creating test user: ${testUser.firstName} ${testUser.lastName}`);
      console.log(`   📧 Email: ${testUser.email}`);
      console.log(`   🏢 Company: ${testUser.companyName}`);

      // Create tenant
      console.log("   🔄 Creating tenant...");
      const tenantResult = await db.insert(schema.tenants).values({
        name: testUser.companyName,
        tenantType: testUser.tenantType,
        domain: testUser.email.split("@")[1],
        licenseStatus: "active",
        isActive: true,
        settings: {
          testAccount: true,
          features: ["multi_facility", "exports_v2"],
        },
      }).returning();

      if (!tenantResult[0]) {
        throw new Error(`Failed to create tenant for ${testUser.email}`);
      }
      const tenant = tenantResult[0];
      console.log(`   ✓ Tenant created: ${tenant.id}`);

      // Hash password
      console.log("   🔄 Hashing password...");
      const passwordHash = await bcrypt.hash(testUser.password, 10);
      console.log("   ✓ Password hashed");

      // Create user
      console.log("   🔄 Creating user account...");
      const userResult = await db.insert(schema.users).values({
        tenantId: tenant.id,
        email: testUser.email,
        passwordHash: passwordHash,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        businessRole: testUser.role,
        consultantRole: null,
        isActive: true,
        isTestAccount: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        setupStatus: "setup_complete",
        setupCompletedAt: new Date(),
      }).returning();

      if (!userResult[0]) {
        throw new Error(`Failed to create user ${testUser.email}`);
      }
      const user = userResult[0];
      console.log(`   ✓ User created: ${user.id}`);

      // Create organization profile
      console.log("   🔄 Creating organization profile...");
      await db.insert(schema.organizationProfiles).values({
        tenantId: tenant.id,
        legalName: testUser.companyName,
        hqAddress: "123 Test Street",
        hqCity: "Test City",
        hqState: "CA",
        hqZipCode: "90210",
        hqCountry: "US",
        primaryContactName: `${testUser.firstName} ${testUser.lastName}`,
        primaryContactEmail: testUser.email,
        timeZone: "America/Los_Angeles",
      });
      console.log("   ✓ Organization profile created");

      // Create a test facility
      console.log("   🔄 Creating test facility...");
      await db.insert(schema.facilityProfiles).values({
        tenantId: tenant.id,
        name: `${testUser.companyName} - Main Facility`,
        address: "123 Test Street",
        city: "Test City",
        state: "CA",
        zipCode: "90210",
        country: "US",
        isPrimary: true,
        isActive: true,
        processingActivities: ["COLLECTION", "SORTING"],
        dataBearingHandling: true,
        focusMaterialsPresence: false,
      });
      console.log("   ✓ Test facility created");

      // Skip license creation - not essential for test users
      // The tenant licenseStatus is already set to "active" which is sufficient
      console.log("   ⏭️  License creation skipped (not required for test users)");

      console.log(`   ✅ ${testUser.firstName} ${testUser.lastName} setup complete!`);
      usersCreated++;
    }

    console.log("\n🎉 Test user seeding completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   • Test users created: ${usersCreated}`);
    console.log(`   • All users marked with isTestAccount=true`);
    console.log(`   • Source: Test_Users.md`);
    console.log("\n📝 Test User Credentials:");
    console.log("   1. Superuser:");
    console.log("      Email: admin+e2e@rur2.com");
    console.log("      Password: RuR2@Admin2024!");
    console.log("   2. Regular User:");
    console.log("      Email: tester+e2e@example.com");
    console.log("      Password: TestUser123!");
    console.log("\n⚠️  These are the ONLY test accounts allowed.");
    console.log("   Any other test users must be added to Test_Users.md first.\n");

  } catch (error) {
    console.error("❌ Error during test user seeding:", error);
    throw error;
  }
}

// Run the seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await seedTestUsers();
  process.exit(0);
}

export { seedTestUsers };
