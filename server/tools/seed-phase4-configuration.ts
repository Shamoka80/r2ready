import { db } from "../db";
import { 
  mustPassRules, 
  mustPassRuleQuestions, 
  scoringConfigs, 
  conditionalRules, 
  conditionalRuleTargets,
  questions 
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Phase 4: Configuration Layer Seed Data
 * 
 * This script creates:
 * 1. 8 R2v3 must-pass rules (EHSMS, legal, focus materials, DSV, data security, closure, financial, SERI)
 * 2. Default R2v3 scoring configuration
 * 3. Conditional rules migrated from hardcoded logic
 */

export async function seedPhase4Configuration() {
  console.log("🌱 Starting Phase 4 Configuration Layer seeding...\n");

  try {
    // Step 0: Clear existing configuration (for re-seeding)
    console.log("🧹 Step 0: Clearing existing Phase 4 configuration...");
    await clearExistingConfiguration();
    console.log("✅ Cleared existing configuration\n");

    // Step 1: Create the 8 must-pass rules
    console.log("📋 Step 1: Creating 8 R2v3 must-pass rules...");
    const ruleIds = await createMustPassRules();
    console.log(`✅ Created ${Object.keys(ruleIds).length} must-pass rules\n`);

    // Step 2: Map questions to must-pass rules
    console.log("🔗 Step 2: Mapping questions to must-pass rules...");
    const mappingCount = await mapQuestionsToRules(ruleIds);
    console.log(`✅ Created ${mappingCount} question mappings\n`);

    // Step 3: Create default R2v3 scoring configuration
    console.log("⚖️ Step 3: Creating default R2v3 scoring configuration...");
    const scoringConfigId = await createDefaultScoringConfig();
    console.log(`✅ Created scoring configuration: ${scoringConfigId}\n`);

    // Step 4: Create conditional rules
    console.log("🔀 Step 4: Creating conditional branching rules...");
    const conditionalRuleCount = await createConditionalRules();
    console.log(`✅ Created ${conditionalRuleCount} conditional rules\n`);

    console.log("🎉 Phase 4 configuration seeding complete!");
    return {
      success: true,
      mustPassRules: ruleIds.length,
      questionMappings: mappingCount,
      scoringConfigId,
      conditionalRules: conditionalRuleCount
    };

  } catch (error) {
    console.error("❌ Error seeding Phase 4 configuration:", error);
    throw error;
  }
}

/**
 * Clear existing Phase 4 configuration
 */
async function clearExistingConfiguration() {
  // Delete in order respecting FK constraints
  // mustPassRuleQuestions has CASCADE on delete, so deleting rules will cascade
  await db.delete(conditionalRuleTargets);
  await db.delete(conditionalRules);
  await db.delete(mustPassRuleQuestions);
  await db.delete(mustPassRules);
  await db.delete(scoringConfigs);
  console.log("  ✓ Cleared must-pass rules, conditional rules, and scoring configs");
}

/**
 * Create the 8 R2v3 must-pass rules
 */
async function createMustPassRules() {
  const rules = [
    {
      ruleCode: "MUST_PASS_EHSMS",
      ruleName: "EH&S Management System",
      description: "Organization must have a documented and implemented Environmental, Health & Safety Management System compliant with R2v3 Core Requirement 3",
      ruleType: "CRITICAL_REQUIREMENT",
      blockerSeverity: "CRITICAL",
      failureMessage: "R2v3 certification requires a compliant EH&S Management System. This is a fundamental requirement for all facilities.",
      isActive: true,
      effectiveDate: new Date("2025-01-01")
    },
    {
      ruleCode: "MUST_PASS_LEGAL",
      ruleName: "Legal and Regulatory Compliance Plan",
      description: "Organization must maintain documented legal compliance including business licenses, permits, and regulatory requirements per R2v3 Core Requirement 4",
      ruleType: "CRITICAL_REQUIREMENT",
      blockerSeverity: "CRITICAL",
      failureMessage: "R2v3 certification requires documented legal authorization to operate and compliance with all applicable laws.",
      isActive: true,
      effectiveDate: new Date("2025-01-01")
    },
    {
      ruleCode: "MUST_PASS_FOCUS_MATERIALS",
      ruleName: "Focus Materials Management Plan",
      description: "If handling focus materials (mercury, PCBs, CRTs, batteries, etc.), must have documented management plan per R2v3 Core Requirement 8",
      ruleType: "CONDITIONAL_REQUIREMENT",
      blockerSeverity: "CRITICAL",
      failureMessage: "Organizations handling focus materials must have a compliant management plan. This is required for facilities processing batteries, CRTs, mercury devices, or other hazardous components.",
      isActive: true,
      effectiveDate: new Date("2025-01-01")
    },
    {
      ruleCode: "MUST_PASS_DSV",
      ruleName: "Downstream Supplier Verification (DSV)",
      description: "Organization must conduct due diligence and verification of all downstream recycling partners per R2v3 Appendix A requirements",
      ruleType: "CRITICAL_REQUIREMENT",
      blockerSeverity: "CRITICAL",
      failureMessage: "R2v3 requires documented due diligence on all downstream vendors receiving electronics or components.",
      isActive: true,
      effectiveDate: new Date("2025-01-01")
    },
    {
      ruleCode: "MUST_PASS_DATA_SECURITY",
      ruleName: "Data Security and Sanitization",
      description: "If handling data-bearing devices, must have NIST 800-88 compliant data destruction procedures per R2v3 Core Requirement 7",
      ruleType: "CONDITIONAL_REQUIREMENT",
      blockerSeverity: "CRITICAL",
      failureMessage: "Facilities handling data-bearing devices must implement NIST 800-88 compliant data sanitization or destruction procedures.",
      isActive: true,
      effectiveDate: new Date("2025-01-01")
    },
    {
      ruleCode: "MUST_PASS_CLOSURE",
      ruleName: "Facility Closure Plan",
      description: "Organization must have a documented closure plan addressing proper handling of remaining inventory and environmental remediation",
      ruleType: "CRITICAL_REQUIREMENT",
      blockerSeverity: "HIGH",
      failureMessage: "R2v3 requires a documented plan for facility closure to ensure responsible materials management in all scenarios.",
      isActive: true,
      effectiveDate: new Date("2025-01-01")
    },
    {
      ruleCode: "MUST_PASS_FINANCIAL",
      ruleName: "Financial Assurance",
      description: "Organization must demonstrate financial capacity to properly manage electronics through insurance, bonds, or other financial instruments",
      ruleType: "CRITICAL_REQUIREMENT",
      blockerSeverity: "HIGH",
      failureMessage: "R2v3 requires demonstration of financial assurance to ensure responsible operations and closure capability.",
      isActive: true,
      effectiveDate: new Date("2025-01-01")
    },
    {
      ruleCode: "MUST_PASS_SERI_LICENSE",
      ruleName: "SERI R2 License Agreement",
      description: "Organization must have a current, valid license agreement with SERI to use the R2 certification mark",
      ruleType: "ADMINISTRATIVE_REQUIREMENT",
      blockerSeverity: "CRITICAL",
      failureMessage: "A valid SERI license agreement is required for R2v3 certification and mark usage.",
      isActive: true,
      effectiveDate: new Date("2025-01-01")
    }
  ];

  const ruleIds: { [key: string]: string } = {};

  for (const rule of rules) {
    const [inserted] = await db.insert(mustPassRules)
      .values(rule)
      .returning({ id: mustPassRules.id });
    
    ruleIds[rule.ruleCode] = inserted.id;
    console.log(`  ✓ Created rule: ${rule.ruleName} (${rule.ruleCode})`);
  }

  return ruleIds;
}

/**
 * Map questions to must-pass rules based on category and content
 */
async function mapQuestionsToRules(ruleIds: { [key: string]: string }) {
  let mappingCount = 0;

  // Query questions and map them to rules based on category and content
  const allQuestions = await db.select().from(questions).where(eq(questions.isActive, true));

  const mappings: Array<{ 
    mustPassRuleId: string; 
    questionId: string; 
    acceptableValues: any;
    order: number;
  }> = [];

  for (const question of allQuestions) {
    // EH&S Management System - Core Requirement 3
    if (question.category?.includes("CORE REQUIREMENT 3: EH&S MANAGEMENT SYSTEM") ||
        question.category?.toLowerCase().includes("environmental") ||
        question.questionId?.includes("enviro")) {
      mappings.push({
        mustPassRuleId: ruleIds.MUST_PASS_EHSMS,
        questionId: question.id,
        acceptableValues: ["YES"],
        order: mappings.length
      });
    }

    // Legal Compliance - Core Requirement 4
    if (question.category?.includes("CORE REQUIREMENT 4: LEGAL AND OTHER REQUIREMENTS") ||
        question.category?.toLowerCase().includes("legal") ||
        question.questionId?.includes("legal")) {
      mappings.push({
        mustPassRuleId: ruleIds.MUST_PASS_LEGAL,
        questionId: question.id,
        acceptableValues: ["YES"],
        order: mappings.length
      });
    }

    // Focus Materials - Core Requirement 8
    if (question.category?.includes("CORE REQUIREMENT 8: FOCUS MATERIALS") ||
        question.text?.toLowerCase().includes("focus material") ||
        question.text?.toLowerCase().includes("mercury") ||
        question.text?.toLowerCase().includes("pcb") ||
        question.text?.toLowerCase().includes("battery")) {
      mappings.push({
        mustPassRuleId: ruleIds.MUST_PASS_FOCUS_MATERIALS,
        questionId: question.id,
        acceptableValues: ["YES"],
        order: mappings.length
      });
    }

    // Downstream Supplier Verification - Appendix A
    if (question.category?.includes("APPENDIX A: DOWNSTREAM RECYCLING CHAIN") ||
        question.text?.toLowerCase().includes("downstream") ||
        question.text?.toLowerCase().includes("vendor verification") ||
        question.text?.toLowerCase().includes("due diligence")) {
      mappings.push({
        mustPassRuleId: ruleIds.MUST_PASS_DSV,
        questionId: question.id,
        acceptableValues: ["YES"],
        order: mappings.length
      });
    }

    // Data Security - Core Requirement 7
    if (question.category?.includes("CORE REQUIREMENT 7: DATA SECURITY") ||
        question.category?.toLowerCase().includes("data security") ||
        question.questionId?.includes("data-security") ||
        question.text?.toLowerCase().includes("nist 800-88")) {
      mappings.push({
        mustPassRuleId: ruleIds.MUST_PASS_DATA_SECURITY,
        questionId: question.id,
        acceptableValues: ["YES"],
        order: mappings.length
      });
    }

    // Closure Plan - typically in business continuity or legal sections
    if (question.text?.toLowerCase().includes("closure plan") ||
        question.text?.toLowerCase().includes("facility closure") ||
        question.category?.toLowerCase().includes("business continuity")) {
      mappings.push({
        mustPassRuleId: ruleIds.MUST_PASS_CLOSURE,
        questionId: question.id,
        acceptableValues: ["YES"],
        order: mappings.length
      });
    }

    // Financial Assurance
    if (question.text?.toLowerCase().includes("financial assurance") ||
        question.text?.toLowerCase().includes("insurance") ||
        question.text?.toLowerCase().includes("bond") ||
        question.text?.toLowerCase().includes("financial capacity")) {
      mappings.push({
        mustPassRuleId: ruleIds.MUST_PASS_FINANCIAL,
        questionId: question.id,
        acceptableValues: ["YES"],
        order: mappings.length
      });
    }

    // SERI License
    if (question.text?.toLowerCase().includes("seri") ||
        question.text?.toLowerCase().includes("license agreement") ||
        question.text?.toLowerCase().includes("r2 certificate")) {
      mappings.push({
        mustPassRuleId: ruleIds.MUST_PASS_SERI_LICENSE,
        questionId: question.id,
        acceptableValues: ["YES"],
        order: mappings.length
      });
    }
  }

  // Insert mappings in batches
  if (mappings.length > 0) {
    for (const mapping of mappings) {
      await db.insert(mustPassRuleQuestions).values(mapping);
      mappingCount++;
    }
    console.log(`  ✓ Mapped ${mappingCount} questions to must-pass rules`);
  }

  return mappingCount;
}

/**
 * Create default R2v3 scoring configuration
 */
async function createDefaultScoringConfig() {
  const defaultConfig = {
    configName: "R2v3 Standard Scoring",
    configVersion: "1.0.0",
    description: "Official R2v3 scoring configuration with standard category weights and thresholds",
    
    // Core category weights (must total 100%)
    weights: {
      LEGAL: 15,         // Legal and regulatory compliance
      FACILITY: 15,      // Facility management and operations
      EHS: 20,           // Environmental, Health & Safety
      PROCESSING: 15,    // Processing and tracking
      DATA: 15,          // Data security and sanitization
      SUPPLY_CHAIN: 10,  // Downstream supplier management
      MANAGEMENT: 10     // Management systems and documentation
    },
    
    // Appendix category weights (applied separately if applicable)
    appendixWeights: {
      APPENDIX_A: 100,  // Downstream Recycling Chain
      APPENDIX_B: 100,  // Data Sanitization
      APPENDIX_C: 100,  // Test and Repair
      APPENDIX_D: 100,  // Specialty Electronics Reuse
      APPENDIX_E: 100,  // Materials Recovery
      APPENDIX_F: 100,  // Brokering
      APPENDIX_G: 100   // Photovoltaic Modules
    },
    
    // Readiness thresholds (percentage scores)
    readinessThresholds: {
      passing: 75,      // Minimum score to pass assessment
      ready: 85,        // Minimum score for certification-ready status
      excellent: 95     // Excellence threshold
    },
    
    // N/A (Not Applicable) handling strategy
    naHandling: "EXCLUDE",  // Options: EXCLUDE, COUNT_AS_100, COUNT_AS_0
    
    // Multiplier for required questions vs optional
    requiredQuestionMultiplier: 1.5,
    
    // Must-pass enforcement
    enforceMustPass: true,
    
    // Separate maturity scoring
    separateMaturityScoring: true,
    
    isActive: true,
    effectiveDate: new Date("2025-01-01")
  };

  const [inserted] = await db.insert(scoringConfigs)
    .values(defaultConfig)
    .returning({ id: scoringConfigs.id });

  console.log(`  ✓ Created scoring config: ${defaultConfig.configName} v${defaultConfig.configVersion}`);
  console.log(`  ✓ Core weights: ${JSON.stringify(defaultConfig.weights)}`);
  console.log(`  ✓ Thresholds: passing=${defaultConfig.readinessThresholds.passing}%, ready=${defaultConfig.readinessThresholds.ready}%`);
  console.log(`  ✓ N/A handling: ${defaultConfig.naHandling}`);

  return inserted.id;
}

/**
 * Create conditional rules migrated from hardcoded logic
 */
async function createConditionalRules() {
  const rules = [
    {
      ruleId: "COND_FOCUS_MATERIALS",
      ruleName: "Focus Materials Questions",
      description: "Show focus materials questions only if organization handles batteries, CRTs, mercury devices, or other focus materials",
      triggeredBy: "INTAKE_FORM",
      triggerCondition: {
        field: "focusMaterials",
        operator: "HAS_ANY",
        value: ["BATTERIES", "CRTS", "MERCURY", "PCBS"]
      },
      action: "SHOW",
      priority: 100,
      isActive: true
    },
    {
      ruleId: "COND_DATA_SECURITY",
      ruleName: "Data Security Questions",
      description: "Show data security questions only if organization performs data destruction or sanitization activities",
      triggeredBy: "INTAKE_FORM",
      triggerCondition: {
        field: "processingActivities",
        operator: "CONTAINS",
        value: "data"
      },
      action: "SHOW",
      priority: 100,
      isActive: true
    },
    {
      ruleId: "COND_INTERNATIONAL_SHIPMENTS",
      ruleName: "International Shipment Questions",
      description: "Show international compliance questions if organization handles international shipments",
      triggeredBy: "INTAKE_FORM",
      triggerCondition: {
        field: "internationalShipments",
        operator: "EQUALS",
        value: true
      },
      action: "SHOW",
      priority: 100,
      isActive: true
    },
    {
      ruleId: "COND_MULTI_FACILITY",
      ruleName: "Multi-Facility Management Questions",
      description: "Show multi-facility management questions if organization operates more than one facility",
      triggeredBy: "INTAKE_FORM",
      triggerCondition: {
        field: "totalFacilities",
        operator: "GREATER_THAN",
        value: 1
      },
      action: "SHOW",
      priority: 100,
      isActive: true
    },
    {
      ruleId: "COND_DOWNSTREAM_VENDORS",
      ruleName: "Downstream Supplier Questions",
      description: "Show downstream supplier verification questions if organization has downstream recycling partners",
      triggeredBy: "INTAKE_FORM",
      triggerCondition: {
        field: "totalDownstreamVendors",
        operator: "GREATER_THAN",
        value: 0
      },
      action: "SHOW",
      priority: 100,
      isActive: true
    }
  ];

  let ruleCount = 0;
  const ruleIdMap: { [key: string]: string } = {};

  // Insert conditional rules
  for (const rule of rules) {
    const [inserted] = await db.insert(conditionalRules)
      .values(rule)
      .returning({ id: conditionalRules.id });
    
    ruleIdMap[rule.ruleId] = inserted.id;
    console.log(`  ✓ Created conditional rule: ${rule.ruleName}`);
    ruleCount++;
  }

  // Map conditional rules to target questions
  const allQuestions = await db.select().from(questions).where(eq(questions.isActive, true));

  // Focus Materials rule targets
  const focusMaterialsQuestions = allQuestions.filter(q => 
    q.category?.includes("CORE REQUIREMENT 8: FOCUS MATERIALS") ||
    q.text?.toLowerCase().includes("focus material")
  );
  
  for (const q of focusMaterialsQuestions) {
    await db.insert(conditionalRuleTargets).values({
      conditionalRuleId: ruleIdMap.COND_FOCUS_MATERIALS,
      targetQuestionId: q.id,
      actionType: "SHOW"
    });
  }

  // Data Security rule targets
  const dataSecurityQuestions = allQuestions.filter(q => 
    q.category?.includes("CORE REQUIREMENT 7: DATA SECURITY") ||
    q.category?.includes("APPENDIX B: DATA SANITIZATION")
  );
  
  for (const q of dataSecurityQuestions) {
    await db.insert(conditionalRuleTargets).values({
      conditionalRuleId: ruleIdMap.COND_DATA_SECURITY,
      targetQuestionId: q.id,
      actionType: "SHOW"
    });
  }

  console.log(`  ✓ Mapped conditional rules to target questions`);

  return ruleCount;
}

// Execute if run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedPhase4Configuration()
    .then((result) => {
      console.log("\n✅ Seeding completed successfully!");
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Seeding failed:", error);
      process.exit(1);
    });
}
