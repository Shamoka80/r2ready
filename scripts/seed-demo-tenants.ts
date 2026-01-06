#!/usr/bin/env tsx
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

async function seedDemoTenants() {
  console.log("🌱 Starting demo tenant seeding...");

  try {
    // Clear existing demo data  
    console.log("🧹 Cleaning existing demo data...");
    
    // Use TRUNCATE CASCADE for clean slate (faster and handles FK constraints)
    try {
      await db.execute(sql`DELETE FROM "Tenant" WHERE name LIKE '%demo-%' CASCADE`);
    } catch (error) {
      // If CASCADE doesn't work, delete manually
      console.log("Deleting demo tenants individually...");
      await db.delete(schema.tenants).where(sql`name LIKE '%demo-%'`);
    }

    // === BUSINESS TENANT ===
    console.log("🏢 Creating demo business tenant...");
    
    const businessTenantResult = await db.insert(schema.tenants).values({
      name: "demo-business-corp",
      tenantType: "BUSINESS",
      domain: "demo-business.example.com",
      licenseStatus: "active",
      settings: {
        features: ["multi_facility", "exports_v2"],
        notifications: true
      }
    }).returning();
    
    if (!businessTenantResult[0]) {
      throw new Error("Failed to create business tenant");
    }
    const businessTenant = businessTenantResult[0];

    // Business user
    const businessUserResult = await db.insert(schema.users).values({
      tenantId: businessTenant.id,
      email: "admin@demo-business.example.com",
      firstName: "Business",
      lastName: "Administrator",
      businessRole: "business_owner",
      isActive: true,
      emailVerified: true,
      setupStatus: "setup_complete",
      setupCompletedAt: new Date()
    }).returning();
    
    const businessUserArray = businessUserResult as any[];
    if (!businessUserArray || businessUserArray.length === 0 || !businessUserArray[0]) {
      throw new Error("Failed to create business user");
    }
    const businessUser = businessUserArray[0];

    // Business organization profile
    await db.insert(schema.organizationProfiles).values({
      tenantId: businessTenant.id,
      legalName: "Demo Business Corporation",
      dbaName: "Demo Business Corp",
      entityType: "CORPORATION",
      taxId: "12-3456789",
      hqAddress: "123 Business Ave",
      hqCity: "Corporate City",
      hqState: "CA",
      hqZipCode: "90210",
      hqCountry: "US",
      primaryContactName: "Business Administrator",
      primaryContactEmail: "admin@demo-business.example.com",
      primaryContactPhone: "+1-555-123-4567",
      timeZone: "America/Los_Angeles"
    });

    // Business facilities
    const facilities = [
      {
        name: "Corporate Headquarters",
        address: "123 Business Ave",
        city: "Corporate City",
        state: "CA",
        zipCode: "90210",
        isPrimary: true,
        headcount: 150,
        floorArea: 50000,
        processingActivities: ["COLLECTION", "SORTING", "DISASSEMBLY"],
        dataBearingHandling: true,
        focusMaterialsPresence: true
      },
      {
        name: "Warehouse Facility",
        address: "456 Storage Blvd",
        city: "Warehouse City",
        state: "NV",
        zipCode: "89123",
        isPrimary: false,
        headcount: 75,
        floorArea: 100000,
        processingActivities: ["STORAGE", "TRANSPORTATION"],
        dataBearingHandling: false,
        focusMaterialsPresence: false
      },
      {
        name: "Remote Processing Center",
        address: "789 Remote St",
        city: "Remote Town",
        state: "TX",
        zipCode: "75001",
        isPrimary: false,
        headcount: 50,
        floorArea: 25000,
        processingActivities: ["SHREDDING", "RECOVERY"],
        dataBearingHandling: true,
        focusMaterialsPresence: true
      }
    ];

    const businessFacilities = [];
    for (const facilityData of facilities) {
      const facilityResult = await db.insert(schema.facilityProfiles).values({
        tenantId: businessTenant.id,
        ...facilityData
      }).returning();
      
      if (!facilityResult[0]) {
        throw new Error(`Failed to create facility: ${facilityData.name}`);
      }
      const facility = facilityResult[0];
      businessFacilities.push(facility);

      // Create scope profiles for each facility
      await db.insert(schema.scopeProfiles).values({
        facilityId: facility.id,
        equipmentCategories: ["servers", "laptops", "mobile_devices"],
        dataPresent: facilityData.dataBearingHandling,
        focusMaterials: facilityData.focusMaterialsPresence,
        internalProcesses: true,
        contractedProcesses: false,
        exportMarkets: false,
        applicableCR1: true,
        applicableCR2: true,
        applicableCR3: facilityData.dataBearingHandling,
        applicableCR4: facilityData.focusMaterialsPresence,
        applicableCR5: true,
        applicableAppA: facilityData.dataBearingHandling,
        applicableAppB: facilityData.focusMaterialsPresence
      });
    }

    // Business license
    await db.insert(schema.licenses).values({
      tenantId: businessTenant.id,
      planId: "business-standard",
      planName: "Business Standard",
      accountType: "business",
      isActive: true,
      maxFacilities: 5,
      maxSeats: 25,
      features: {
        multi_facility: true,
        exports_v2: true,
        evidence_pipeline: true
      }
    });

    console.log("✅ Business tenant created with 3 facilities");

    // === CONSULTANT TENANT ===
    console.log("👥 Creating demo consultant tenant...");

    const consultantTenantResult = await db.insert(schema.tenants).values({
      name: "demo-consultant-llc",
      tenantType: "CONSULTANT",
      domain: "demo-consultant.example.com",
      licenseStatus: "active",
      settings: {
        features: ["multi_facility", "exports_v2", "security_hardening"],
        notifications: true
      }
    }).returning();
    
    if (!consultantTenantResult[0]) {
      throw new Error("Failed to create consultant tenant");
    }
    const consultantTenant = consultantTenantResult[0];

    // Consultant user
    const consultantUserResult = await db.insert(schema.users).values({
      tenantId: consultantTenant.id,
      email: "lead@demo-consultant.example.com",
      firstName: "Lead",
      lastName: "Consultant",
      consultantRole: "consultant_owner",
      isActive: true,
      emailVerified: true,
      setupStatus: "setup_complete",
      setupCompletedAt: new Date()
    }).returning();
    
    const consultantUserArray = consultantUserResult as any[];
    if (!consultantUserArray || consultantUserArray.length === 0 || !consultantUserArray[0]) {
      throw new Error("Failed to create consultant user");
    }
    const consultantUser = consultantUserArray[0];

    // Consultant license
    await db.insert(schema.licenses).values({
      tenantId: consultantTenant.id,
      planId: "consultant-pro",
      planName: "Consultant Professional",
      accountType: "consultant",
      isActive: true,
      maxFacilities: null, // Unlimited for consultants
      maxSeats: 10,
      features: {
        multi_facility: true,
        exports_v2: true,
        evidence_pipeline: true,
        security_hardening: true
      }
    });

    // Client organizations for consultant
    const clientOrgs = [
      {
        legalName: "Client Alpha Industries",
        dbaName: "Alpha Industries",
        entityType: "CORPORATION" as const,
        taxId: "98-7654321",
        hqAddress: "111 Client Alpha Dr",
        hqCity: "Alpha City",
        hqState: "FL",
        hqZipCode: "33101",
        primaryContactName: "Alpha Client Manager",
        primaryContactEmail: "manager@alpha-industries.example.com",
        primaryContactPhone: "+1-555-987-6543"
      },
      {
        legalName: "Client Beta Solutions LLC",
        dbaName: "Beta Solutions",
        entityType: "LLC" as const,
        taxId: "87-6543210",
        hqAddress: "222 Beta Solutions Way",
        hqCity: "Beta Town",
        hqState: "WA",
        hqZipCode: "98101",
        primaryContactName: "Beta Solution Lead",
        primaryContactEmail: "lead@beta-solutions.example.com",
        primaryContactPhone: "+1-555-876-5432"
      }
    ];

    for (const clientOrgData of clientOrgs) {
      const clientOrgResult = await db.insert(schema.clientOrganizations).values({
        consultantTenantId: consultantTenant.id,
        ...clientOrgData
      }).returning();
      
      if (!clientOrgResult[0]) {
        throw new Error(`Failed to create client organization: ${clientOrgData.legalName}`);
      }
      const clientOrg = clientOrgResult[0];

      // Create client facilities
      const clientFacilityData = {
        clientOrganizationId: clientOrg.id,
        name: `${clientOrgData.dbaName} Main Facility`,
        address: clientOrgData.hqAddress,
        city: clientOrgData.hqCity,
        state: clientOrgData.hqState,
        zipCode: clientOrgData.hqZipCode,
        isPrimary: true,
        headcount: 100,
        floorArea: 30000,
        processingActivities: ["COLLECTION", "SORTING", "DISASSEMBLY"],
        dataBearingHandling: true,
        focusMaterialsPresence: true
      };

      await db.insert(schema.clientFacilities).values(clientFacilityData);
    }

    console.log("✅ Consultant tenant created with 2 client organizations");

    // === SAMPLE ASSESSMENTS ===
    console.log("📋 Creating sample assessments...");

    // Get R2v3 standard (assuming it exists or create a simple one)
    const r2StandardResult = await db.select().from(schema.standardVersions).where(sql`code = 'R2v3'`);
    let r2Standard = r2StandardResult[0];
    
    if (!r2Standard) {
      const r2StandardInsertResult = await db.insert(schema.standardVersions).values({
        code: "R2v3",
        name: "Responsible Recycling Standard",
        version: "2023",
        description: "R2v3 Standard for responsible recycling practices",
        isActive: true
      }).returning();
      
      if (!r2StandardInsertResult[0]) {
        throw new Error("Failed to create R2v3 standard");
      }
      r2Standard = r2StandardInsertResult[0];

      // Create sample clauses and questions
      const clauseResult = await db.insert(schema.clauses).values({
        ref: "CR1",
        title: "Legal Compliance",
        description: "Ensure legal compliance in all operations",
        stdId: r2Standard.id,
        order: 1
      }).returning();
      
      const clauseArray = clauseResult as any[];
      if (!clauseArray || clauseArray.length === 0 || !clauseArray[0]) {
        throw new Error("Failed to create sample clause");
      }
      const clause = clauseArray[0];

      await db.insert(schema.questions).values({
        questionId: "CR1.1",
        clauseId: clause.id,
        text: "Does your organization have documented legal compliance procedures?",
        responseType: "yes_no",
        required: true,
        evidenceRequired: true,
        weight: 1.0,
        category: "Legal Compliance",
        category_code: "CR1"
      });
    }

    // Create assessment for business tenant
    const businessAssessmentResult = await db.insert(schema.assessments).values({
      tenantId: businessTenant.id,
      createdBy: businessUser.id,
      title: "Business Corp R2v3 Assessment",
      description: "Initial R2v3 certification assessment",
      stdId: r2Standard.id,
      status: "IN_PROGRESS",
      progress: 0.35,
      facilityId: businessFacilities[0]!.id,
      overallScore: 85.5,
      compliancePercentage: 78.2
    }).returning();
    
    if (!businessAssessmentResult[0]) {
      throw new Error("Failed to create business assessment");
    }
    const businessAssessment = businessAssessmentResult[0];

    // === EVIDENCE STUBS ===
    console.log("📎 Creating evidence stubs...");

    // Verify we have enough facilities for evidence objects
    if (businessFacilities.length < 3) {
      throw new Error(`Expected 3 business facilities, but only created ${businessFacilities.length}`);
    }

    // Business evidence objects
    const evidenceObjects = [
      {
        facilityId: businessFacilities[0]!.id,
        createdBy: businessUser.id,
        checksum: "sha256:a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
        size: 2048576, // 2MB
        mime: "application/pdf",
        storageUri: "s3://demo-evidence/business/compliance-manual.pdf",
        originalName: "R2v3-Compliance-Manual.pdf",
        description: "Legal compliance procedures manual",
        scanStatus: "clean",
        assessmentId: businessAssessment.id
      },
      {
        facilityId: businessFacilities[1]!.id,
        createdBy: businessUser.id,
        checksum: "sha256:b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567",
        size: 1024768, // 1MB
        mime: "image/jpeg",
        storageUri: "s3://demo-evidence/business/facility-photos.jpg",
        originalName: "warehouse-processing-area.jpg",
        description: "Processing area documentation photos",
        scanStatus: "clean"
      },
      {
        facilityId: businessFacilities[2]!.id,
        createdBy: businessUser.id,
        checksum: "sha256:c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890",
        size: 512384, // 500KB
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        storageUri: "s3://demo-evidence/business/inventory-tracking.xlsx",
        originalName: "monthly-inventory-report.xlsx",
        description: "Monthly inventory tracking spreadsheet",
        scanStatus: "clean"
      }
    ];

    for (const evidenceData of evidenceObjects) {
      await db.insert(schema.evidenceObjects).values(evidenceData);
    }

    console.log("✅ Evidence stubs created");

    // === LICENSE EVENTS ===
    console.log("💳 Creating license events...");

    await db.insert(schema.licenseEvents).values([
      {
        tenantId: businessTenant.id,
        eventType: "purchase",
        eventData: {
          planName: "Business Standard",
          features: ["multi_facility", "exports_v2"]
        },
        stripeSessionId: "cs_demo_business_123456",
        amountPaid: 29900, // $299.00
        currency: "USD",
        status: "completed"
      },
      {
        tenantId: consultantTenant.id,
        eventType: "purchase",
        eventData: {
          planName: "Consultant Professional",
          features: ["multi_facility", "exports_v2", "security_hardening"]
        },
        stripeSessionId: "cs_demo_consultant_789012",
        amountPaid: 49900, // $499.00
        currency: "USD",
        status: "completed"
      }
    ]);

    console.log("✅ License events created");

    console.log("\n🎉 Demo tenant seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   • Business Tenant: ${businessTenant.name} (3 facilities)`);
    console.log(`   • Consultant Tenant: ${consultantTenant.name} (2 client orgs)`);
    console.log(`   • Sample assessments and evidence objects created`);
    console.log(`   • License events for audit trail`);

  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

// Run the seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await seedDemoTenants();
  process.exit(0);
}

export { seedDemoTenants };