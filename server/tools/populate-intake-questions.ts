
import { db } from "../db";
import { intakeQuestions, recMapping, questionMapping } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

// R2v3 Intake Questions based on the 12-section intake form
const INTAKE_QUESTIONS = [
  // Section 1: Legal Entity Information
  {
    questionId: "legal-company-name",
    phase: "1",
    section: "Legal Entity",
    text: "What is your legal company name?",
    questionType: "TEXT" as const,
    required: true,
    category: "Legal Information",
    recMapping: ["LEGAL-01"]
  },
  {
    questionId: "business-entity-type",
    phase: "1", 
    section: "Legal Entity",
    text: "What type of business entity are you?",
    questionType: "SELECT" as const,
    required: true,
    options: {
      choices: ["CORPORATION", "LLC", "PARTNERSHIP", "OTHER"]
    },
    category: "Legal Information",
    recMapping: ["LEGAL-02"]
  },
  {
    questionId: "total-facilities",
    phase: "3",
    section: "Facility Structure",
    text: "How many facilities does your organization operate?",
    questionType: "NUMBER" as const,
    required: true,
    category: "Facility Structure",
    recMapping: ["FACILITY-01"]
  },
  {
    questionId: "certification-structure-type",
    phase: "3",
    section: "Facility Structure", 
    text: "What type of certification structure applies to your organization?",
    questionType: "SELECT" as const,
    required: true,
    options: {
      choices: ["SINGLE", "CAMPUS", "SHARED", "COMMON_PARENT", "GROUP", "UNSURE"]
    },
    category: "Facility Structure",
    recMapping: ["FACILITY-02"]
  },
  {
    questionId: "processing-activities",
    phase: "6",
    section: "Processing Activities",
    text: "Which processing activities does your organization perform?",
    questionType: "MULTI_SELECT" as const,
    required: true,
    options: {
      choices: ["Collection", "Testing", "Refurbishment", "Resale", "Data Destruction", "Materials Recovery", "Disposal"]
    },
    category: "Processing Activities",
    recMapping: ["PROC-01", "PROC-02", "PROC-03"]
  },
  {
    questionId: "data-destruction-activities",
    phase: "6",
    section: "Processing Activities",
    text: "Do you perform data destruction activities?",
    questionType: "BOOLEAN" as const,
    required: true,
    dependsOnQuestion: "processing-activities",
    dependsOnValue: { contains: "Data Destruction" },
    category: "Data Security",
    recMapping: ["DATA-01"]
  },
  {
    questionId: "international-shipments",
    phase: "7",
    section: "Downstream Vendors",
    text: "Do you make international shipments?",
    questionType: "BOOLEAN" as const,
    required: true,
    category: "Supply Chain",
    recMapping: ["SUPPLY-01"]
  },
  {
    questionId: "applicable-appendices",
    phase: "8",
    section: "R2v3 Appendices",
    text: "Which R2v3 appendices apply to your operations?",
    questionType: "MULTI_SELECT" as const,
    required: true,
    options: {
      choices: [
        "Appendix A: Focus Materials and Components",
        "Appendix B: Equipment Refurbishment and Resale", 
        "Appendix C: Materials Recovery",
        "Appendix D: Data Destruction",
        "Appendix E: Downstream Vendors",
        "Appendix F: Disposition Hierarchy",
        "Appendix G: Transportation and Storage"
      ]
    },
    category: "R2v3 Scope",
    recMapping: ["APP-A", "APP-B", "APP-C", "APP-D", "APP-E", "APP-F", "APP-G"]
  },
  {
    questionId: "certification-type",
    phase: "9",
    section: "Certification Objectives",
    text: "What type of certification are you pursuing?",
    questionType: "SELECT" as const,
    required: true,
    options: {
      choices: ["INITIAL", "RECERTIFICATION", "TRANSFER", "SCOPE_EXTENSION", "OTHER"]
    },
    category: "Certification Type",
    recMapping: ["CERT-01"]
  },
  {
    questionId: "current-certifications",
    phase: "5",
    section: "Current Certifications",
    text: "Do you have existing management system certifications?",
    questionType: "BOOLEAN" as const,
    required: false,
    category: "Existing Systems",
    recMapping: ["MGMT-01"]
  }
];

// REC Mapping definitions
const REC_MAPPINGS = [
  {
    recCode: "LEGAL-01",
    recName: "Legal Entity Identification",
    description: "Basic legal entity information required for all assessments",
    relatedAppendices: [],
    processingRequirements: { mandatory: true, weight: 1.0 }
  },
  {
    recCode: "LEGAL-02", 
    recName: "Business Entity Classification",
    description: "Business entity type classification for regulatory compliance",
    relatedAppendices: [],
    processingRequirements: { mandatory: true, weight: 1.0 }
  },
  {
    recCode: "FACILITY-01",
    recName: "Facility Count",
    description: "Number of facilities determines audit scope and complexity",
    relatedAppendices: ["APP-G"],
    processingRequirements: { 
      mandatory: true, 
      weight: 1.0,
      triggers: { multisite: "value > 1" }
    }
  },
  {
    recCode: "FACILITY-02",
    recName: "Certification Structure",
    description: "Determines how facilities are organized for certification",
    relatedAppendices: ["APP-G"],
    processingRequirements: { 
      mandatory: true, 
      weight: 2.0,
      triggers: { 
        campus: "value === 'CAMPUS'",
        group: "value === 'GROUP'"
      }
    }
  },
  {
    recCode: "PROC-01",
    recName: "Collection Activities",
    description: "Electronic waste collection processes",
    relatedAppendices: ["APP-A", "APP-E"],
    processingRequirements: { weight: 1.5 }
  },
  {
    recCode: "PROC-02", 
    recName: "Processing Activities",
    description: "Core processing activities determine applicable requirements",
    relatedAppendices: ["APP-A", "APP-B", "APP-C"],
    processingRequirements: { weight: 2.0 }
  },
  {
    recCode: "PROC-03",
    recName: "Disposal Activities", 
    description: "Final disposition and disposal processes",
    relatedAppendices: ["APP-F"],
    processingRequirements: { weight: 1.5 }
  },
  {
    recCode: "DATA-01",
    recName: "Data Destruction",
    description: "Data destruction and sanitization processes",
    relatedAppendices: ["APP-D"],
    processingRequirements: { 
      weight: 3.0,
      triggers: { dataDestruction: "value === true" }
    }
  },
  {
    recCode: "SUPPLY-01",
    recName: "International Supply Chain",
    description: "International shipment and supply chain management",
    relatedAppendices: ["APP-E", "APP-G"],
    processingRequirements: { 
      weight: 2.0,
      triggers: { international: "value === true" }
    }
  },
  {
    recCode: "APP-A",
    recName: "Focus Materials and Components",
    description: "Appendix A: Focus Materials and Components requirements",
    relatedAppendices: ["APP-A"],
    processingRequirements: { weight: 2.0 }
  },
  {
    recCode: "APP-B", 
    recName: "Equipment Refurbishment",
    description: "Appendix B: Equipment Refurbishment and Resale requirements",
    relatedAppendices: ["APP-B"],
    processingRequirements: { weight: 2.5 }
  },
  {
    recCode: "APP-C",
    recName: "Materials Recovery",
    description: "Appendix C: Materials Recovery requirements", 
    relatedAppendices: ["APP-C"],
    processingRequirements: { weight: 2.0 }
  },
  {
    recCode: "APP-D",
    recName: "Data Destruction",
    description: "Appendix D: Data Destruction requirements",
    relatedAppendices: ["APP-D"], 
    processingRequirements: { weight: 3.0 }
  },
  {
    recCode: "APP-E",
    recName: "Downstream Vendors",
    description: "Appendix E: Downstream Vendor requirements",
    relatedAppendices: ["APP-E"],
    processingRequirements: { weight: 2.0 }
  },
  {
    recCode: "APP-F",
    recName: "Disposition Hierarchy", 
    description: "Appendix F: Disposition Hierarchy requirements",
    relatedAppendices: ["APP-F"],
    processingRequirements: { weight: 1.5 }
  },
  {
    recCode: "APP-G",
    recName: "Transportation and Storage",
    description: "Appendix G: Transportation and Storage requirements",
    relatedAppendices: ["APP-G"],
    processingRequirements: { weight: 1.5 }
  },
  {
    recCode: "CERT-01",
    recName: "Certification Type",
    description: "Type of certification being pursued",
    relatedAppendices: [],
    processingRequirements: { mandatory: true, weight: 1.0 }
  },
  {
    recCode: "MGMT-01",
    recName: "Management Systems",
    description: "Existing management system certifications",
    relatedAppendices: [],
    processingRequirements: { weight: 0.5 }
  }
];

async function populateIntakeQuestions() {
  try {
    console.log("🚀 Starting intake questions population...");

    // Clear existing data
    console.log("📝 Clearing existing intake questions...");
    await db.delete(intakeQuestions);
    await db.delete(recMapping);

    // Insert REC mappings first
    console.log("📋 Inserting REC mappings...");
    for (const rec of REC_MAPPINGS) {
      await db.insert(recMapping).values(rec);
      console.log(`   ✓ Added REC: ${rec.recCode} - ${rec.recName}`);
    }

    // Insert intake questions
    console.log("❓ Inserting intake questions...");
    for (const question of INTAKE_QUESTIONS) {
      await db.insert(intakeQuestions).values(question);
      console.log(`   ✓ Added question: ${question.questionId} (Phase ${question.phase})`);
    }

    // Verify insertion
    const questionCount = await db.select().from(intakeQuestions);
    const recCount = await db.select().from(recMapping);
    
    console.log(`\n✅ Population completed successfully!`);
    console.log(`   📊 Inserted ${questionCount.length} intake questions`);
    console.log(`   🔗 Inserted ${recCount.length} REC mappings`);
    console.log(`   📋 Questions span ${INTAKE_QUESTIONS.length} phases of the intake process`);

    // Display summary by phase
    const phaseGroups = questionCount.reduce((acc, q) => {
      const phase = q.phase;
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(q);
      return acc;
    }, {} as Record<string, any[]>);

    console.log("\n📈 Questions by Phase:");
    Object.entries(phaseGroups).forEach(([phase, questions]) => {
      console.log(`   Phase ${phase}: ${questions.length} questions`);
    });

  } catch (error) {
    console.error("❌ Error populating intake questions:", error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('populate-intake-questions.ts')) {
  populateIntakeQuestions().then(() => {
    console.log("🎯 Intake questions population complete!");
    process.exit(0);
  }).catch((error) => {
    console.error("💥 Population failed:", error);
    process.exit(1);
  });
}
