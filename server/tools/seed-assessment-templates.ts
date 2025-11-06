import { db } from "../db.js";
import { sql } from "drizzle-orm";

interface TemplateDefinition {
  name: string;
  description: string;
  facilityTypes: string[];
  questionCategories: string[];
  estimatedDuration: string;
  standardCode: string;
  isPublic: boolean;
}

const ASSESSMENT_TEMPLATES: TemplateDefinition[] = [
  {
    name: "Electronics Recycling Facility - Full R2v3",
    description: "Comprehensive assessment for electronics recycling operations covering all core requirements (CR1-CR10) and relevant appendices. Ideal for full-service e-waste recycling facilities handling diverse equipment types, focus materials, and data-bearing devices.",
    facilityTypes: ["electronics_recycling", "full_service"],
    questionCategories: [
      // All Core Requirements
      "CORE REQUIREMENT 1",
      "CORE REQUIREMENT 2",
      "CORE REQUIREMENT 3",
      "CORE REQUIREMENT 4",
      "CORE REQUIREMENT 5",
      "CORE REQUIREMENT 6",
      "CORE REQUIREMENT 7",
      "CORE REQUIREMENT 8",
      "CORE REQUIREMENT 9",
      "CORE REQUIREMENT 10",
      // All Appendices
      "APPENDIX A",
      "APPENDIX B",
      "APPENDIX C",
      "APPENDIX D",
      "APPENDIX E",
      "APPENDIX F",
      "APPENDIX G",
      // Supporting categories
      "ENVIRONMENTAL COMPLIANCE",
      "WORKER SAFETY AND TRAINING",
      "QUALITY CONTROL AND VERIFICATION",
      "RISK MANAGEMENT AND COMPLIANCE",
      "AUDIT PROCESS AND DOCUMENTATION"
    ],
    estimatedDuration: "8-12 weeks",
    standardCode: "R2V3_1",
    isPublic: true
  },

  {
    name: "Universal Waste Handler - Streamlined Path",
    description: "Simplified compliance assessment for universal waste handlers focusing on legal compliance (CR1), management systems (CR2), environmental health & safety (CR3), and transportation (CR10). Suitable for facilities with limited processing activities.",
    facilityTypes: ["universal_waste", "collector", "transporter"],
    questionCategories: [
      // Core Requirements subset
      "CORE REQUIREMENT 1",  // Legal compliance
      "CORE REQUIREMENT 2",  // Management systems
      "CORE REQUIREMENT 3",  // EHS management
      "CORE REQUIREMENT 10", // Transportation
      // Relevant appendix
      "APPENDIX G",          // Transportation & Storage
      // Supporting categories
      "ENVIRONMENTAL COMPLIANCE",
      "WORKER SAFETY AND TRAINING",
      "RISK MANAGEMENT AND COMPLIANCE"
    ],
    estimatedDuration: "4-6 weeks",
    standardCode: "R2V3_1",
    isPublic: true
  },

  {
    name: "Refurbishment & Repair Operation",
    description: "Specialized assessment for electronics refurbishment operations emphasizing testing & repair procedures (Appendix C), data sanitization (Appendix B), and quality control. Covers all relevant core requirements for facilities focused on equipment reuse and repair.",
    facilityTypes: ["refurbishment", "repair", "reuse"],
    questionCategories: [
      // Core Requirements for refurb operations
      "CORE REQUIREMENT 1",  // Legal compliance
      "CORE REQUIREMENT 2",  // Management systems  
      "CORE REQUIREMENT 3",  // EHS management
      "CORE REQUIREMENT 4",  // Data security awareness
      "CORE REQUIREMENT 5",  // Downstream responsibility
      "CORE REQUIREMENT 6",  // Storage & handling
      "CORE REQUIREMENT 7",  // Data security for data-bearing
      "CORE REQUIREMENT 9",  // Reuse hierarchy preference
      "CORE REQUIREMENT 10", // Transportation
      // Refurbishment-specific appendices
      "APPENDIX B",          // Data Sanitization Methods
      "APPENDIX C",          // Test & Repair Procedures
      "APPENDIX E",          // Downstream Vendors
      // Supporting categories
      "QUALITY CONTROL AND VERIFICATION",
      "WORKER SAFETY AND TRAINING",
      "ENVIRONMENTAL COMPLIANCE",
      "CONTINUOUS IMPROVEMENT"
    ],
    estimatedDuration: "6-8 weeks",
    standardCode: "R2V3_1",
    isPublic: true
  },

  {
    name: "Data Destruction & Sanitization Center",
    description: "Focused assessment for data destruction facilities with heavy emphasis on data security (CR7), sanitization methods (Appendix B & D), and downstream vendor management (CR5, Appendix E). Comprehensive documentation and verification requirements.",
    facilityTypes: ["data_destruction", "data_sanitization", "itad"],
    questionCategories: [
      // Data security focused core requirements
      "CORE REQUIREMENT 1",  // Legal compliance
      "CORE REQUIREMENT 2",  // Management systems
      "CORE REQUIREMENT 3",  // EHS management
      "CORE REQUIREMENT 5",  // Downstream management
      "CORE REQUIREMENT 7",  // Data security - CRITICAL
      "CORE REQUIREMENT 10", // Transportation
      // Data destruction specific appendices
      "APPENDIX B",          // Data Sanitization Methods - CRITICAL
      "APPENDIX D",          // Data Destruction - CRITICAL
      "APPENDIX E",          // Downstream Vendors
      // Supporting categories
      "QUALITY CONTROL AND VERIFICATION",
      "AUDIT PROCESS AND DOCUMENTATION",
      "RISK MANAGEMENT AND COMPLIANCE",
      "WORKER SAFETY AND TRAINING"
    ],
    estimatedDuration: "5-7 weeks",
    standardCode: "R2V3_1",
    isPublic: true
  }
];

async function seedAssessmentTemplates() {
  console.log("🌱 Starting Assessment Template Seeding...\n");

  try {
    // Get a system user and tenant for template creation
    const systemUser = await db.execute(sql`
      SELECT id FROM "User" WHERE "isTestAccount" = false LIMIT 1
    `);

    const systemTenant = await db.execute(sql`
      SELECT id FROM "Tenant" LIMIT 1
    `);

    if (systemUser.rows.length === 0 || systemTenant.rows.length === 0) {
      throw new Error("No user or tenant found in database. Please ensure the database is properly initialized.");
    }

    const userId = systemUser.rows[0].id;
    const tenantId = systemTenant.rows[0].id;

    console.log(`Using User ID: ${userId}`);
    console.log(`Using Tenant ID: ${tenantId}\n`);

    // Check if templates already exist
    const existingTemplates = await db.execute(sql`
      SELECT COUNT(*) as count FROM "AssessmentTemplate"
    `);

    const templateCount = parseInt(existingTemplates.rows[0].count);
    
    if (templateCount > 0) {
      console.log(`⚠️  Found ${templateCount} existing template(s).`);
      console.log("Do you want to continue? This will add new templates. (Ctrl+C to cancel)\n");
    }

    // Insert templates
    let templatesCreated = 0;
    let totalQuestionsLinked = 0;

    for (const template of ASSESSMENT_TEMPLATES) {
      console.log(`\n📋 Creating template: ${template.name}`);
      console.log(`   Description: ${template.description.substring(0, 100)}...`);
      console.log(`   Facility Types: ${template.facilityTypes.join(", ")}`);
      console.log(`   Question Categories: ${template.questionCategories.length} categories`);

      // Count questions that match this template's categories
      const categoriesArray = template.questionCategories.map(cat => `'${cat}'`).join(',');
      const questionCountResult = await db.execute(sql`
        SELECT COUNT(DISTINCT id) as count 
        FROM "Question" 
        WHERE "category_code" = ANY(ARRAY[${sql.raw(categoriesArray)}])
        AND "isActive" = true
      `);

      const questionCount = parseInt(questionCountResult.rows[0].count);
      console.log(`   📊 Questions matched: ${questionCount}`);

      // Insert the template
      const templateId = crypto.randomUUID();
      
      await db.execute(sql`
        INSERT INTO "AssessmentTemplate" (
          "id",
          "name",
          "description",
          "facilityTypes",
          "questionCategories",
          "standardCode",
          "isPublic",
          "isActive",
          "usageCount",
          "createdBy",
          "tenantId",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${templateId},
          ${template.name},
          ${template.description},
          ${JSON.stringify(template.facilityTypes)}::jsonb,
          ${JSON.stringify(template.questionCategories)}::jsonb,
          ${template.standardCode},
          ${template.isPublic},
          true,
          0,
          ${userId},
          ${tenantId},
          NOW(),
          NOW()
        )
      `);

      console.log(`   ✅ Template created with ID: ${templateId}`);
      templatesCreated++;
      totalQuestionsLinked += questionCount;
    }

    console.log("\n" + "=".repeat(80));
    console.log("✨ Assessment Template Seeding Complete!");
    console.log("=".repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   - Templates Created: ${templatesCreated}`);
    console.log(`   - Total Questions Covered: ${totalQuestionsLinked} question-template links`);
    console.log(`\n🔍 Template Details:\n`);

    // Verify and display created templates
    const createdTemplates = await db.execute(sql`
      SELECT 
        "id",
        "name",
        "facilityTypes",
        jsonb_array_length("questionCategories") as category_count,
        "isPublic",
        "createdAt"
      FROM "AssessmentTemplate"
      ORDER BY "createdAt" DESC
      LIMIT ${ASSESSMENT_TEMPLATES.length}
    `);

    for (const t of createdTemplates.rows) {
      const facilityTypes = typeof t.facilityTypes === 'string' 
        ? JSON.parse(t.facilityTypes) 
        : t.facilityTypes;
      
      const questionCount = await db.execute(sql`
        SELECT COUNT(DISTINCT id) as count 
        FROM "Question" 
        WHERE "category_code" = ANY(
          SELECT jsonb_array_elements_text("questionCategories")
          FROM "AssessmentTemplate"
          WHERE "id" = ${t.id}
        )
        AND "isActive" = true
      `);

      console.log(`   📋 ${t.name}`);
      console.log(`      ID: ${t.id}`);
      console.log(`      Facility Types: ${Array.isArray(facilityTypes) ? facilityTypes.join(", ") : facilityTypes}`);
      console.log(`      Categories: ${t.category_count}`);
      console.log(`      Questions: ${questionCount.rows[0].count}`);
      console.log(`      Public: ${t.isPublic}`);
      console.log(``);
    }

    console.log("=".repeat(80));
    console.log("✅ All templates are ready to use!\n");

  } catch (error) {
    console.error("\n❌ Error seeding assessment templates:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAssessmentTemplates()
    .then(() => {
      console.log("Seeding completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export { seedAssessmentTemplates };
