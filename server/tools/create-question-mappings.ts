
import { db } from "../db";
import { questionMapping, intakeQuestions, questions } from "../../shared/schema";
import { eq, and, like } from "drizzle-orm";

// Mapping logic between intake responses and assessment questions
const QUESTION_MAPPINGS = [
  // Data Destruction Mapping
  {
    intakeQuestionId: "data-destruction-activities",
    assessmentQuestionFilter: { appendix: "APP-D" },
    recCode: "DATA-01",
    mappingLogic: {
      condition: "intake_value === true",
      action: "include_all_appendix_d_questions",
      priority: "high"
    }
  },
  
  // Processing Activities Mapping
  {
    intakeQuestionId: "processing-activities",
    assessmentQuestionFilter: { category_code: ["CR4", "CR5", "CR6"] },
    recCode: "PROC-02",
    mappingLogic: {
      condition: "intake_value.includes('Refurbishment')",
      action: "include_refurbishment_questions",
      priority: "high"
    }
  },
  
  // Materials Recovery Mapping
  {
    intakeQuestionId: "processing-activities",
    assessmentQuestionFilter: { appendix: "APP-C" },
    recCode: "APP-C",
    mappingLogic: {
      condition: "intake_value.includes('Materials Recovery')",
      action: "include_materials_recovery_questions",
      priority: "high"
    }
  },
  
  // International Shipments Mapping
  {
    intakeQuestionId: "international-shipments",
    assessmentQuestionFilter: { appendix: "APP-E" },
    recCode: "SUPPLY-01",
    mappingLogic: {
      condition: "intake_value === true",
      action: "include_international_vendor_questions",
      priority: "medium"
    }
  },
  
  // Facility Structure Mapping
  {
    intakeQuestionId: "certification-structure-type",
    assessmentQuestionFilter: { category_code: ["CR2", "CR8"] },
    recCode: "FACILITY-02",
    mappingLogic: {
      condition: "intake_value === 'GROUP' || intake_value === 'CAMPUS'",
      action: "include_multi_site_questions",
      priority: "high"
    }
  },
  
  // Appendix A - Focus Materials
  {
    intakeQuestionId: "applicable-appendices",
    assessmentQuestionFilter: { appendix: "APP-A" },
    recCode: "APP-A",
    mappingLogic: {
      condition: "intake_value.includes('Appendix A: Focus Materials and Components')",
      action: "include_focus_materials_questions",
      priority: "high"
    }
  },
  
  // Appendix B - Equipment Refurbishment
  {
    intakeQuestionId: "applicable-appendices",
    assessmentQuestionFilter: { appendix: "APP-B" },
    recCode: "APP-B", 
    mappingLogic: {
      condition: "intake_value.includes('Appendix B: Equipment Refurbishment and Resale')",
      action: "include_refurbishment_questions",
      priority: "high"
    }
  },
  
  // Appendix G - Transportation
  {
    intakeQuestionId: "applicable-appendices",
    assessmentQuestionFilter: { appendix: "APP-G" },
    recCode: "APP-G",
    mappingLogic: {
      condition: "intake_value.includes('Appendix G: Transportation and Storage')",
      action: "include_transportation_questions", 
      priority: "medium"
    }
  },
  
  // Core Requirements - Always Include
  {
    intakeQuestionId: "legal-company-name",
    assessmentQuestionFilter: { category_code: ["CR1", "CR2", "CR3"] },
    recCode: "LEGAL-01",
    mappingLogic: {
      condition: "intake_value !== null && intake_value !== ''",
      action: "include_core_requirements",
      priority: "mandatory"
    }
  }
];

// Smart logic conditions for complex dependencies
const SMART_LOGIC_CONDITIONS = [
  {
    ruleId: "data-destruction-complex",
    triggerQuestionId: "processing-activities",
    dependentQuestionId: "data-destruction-activities",
    conditionType: "CONTAINS",
    expectedValue: "Data Destruction",
    logicalOperator: "AND"
  },
  {
    ruleId: "international-vendor-complex",
    triggerQuestionId: "international-shipments",
    dependentQuestionId: "applicable-appendices",
    conditionType: "EQUALS", 
    expectedValue: true,
    logicalOperator: "AND"
  },
  {
    ruleId: "multi-facility-complex",
    triggerQuestionId: "total-facilities",
    dependentQuestionId: "certification-structure-type",
    conditionType: "GREATER_THAN",
    expectedValue: 1,
    logicalOperator: "AND"
  }
];

async function createQuestionMappings() {
  try {
    console.log("🔗 Starting question mapping creation...");

    // Clear existing mappings
    console.log("🧹 Clearing existing question mappings...");
    await db.delete(smartLogicConditions);
    await db.delete(questionMapping);

    // Get all intake questions for reference
    const allIntakeQuestions = await db.select().from(intakeQuestions);
    const allAssessmentQuestions = await db.select().from(questions);

    console.log(`📊 Found ${allIntakeQuestions.length} intake questions`);
    console.log(`📊 Found ${allAssessmentQuestions.length} assessment questions`);

    // Create question mappings
    console.log("🎯 Creating question mappings...");
    
    for (const mapping of QUESTION_MAPPINGS) {
      // Find the intake question
      const intakeQuestion = allIntakeQuestions.find(q => q.questionId === mapping.intakeQuestionId);
      if (!intakeQuestion) {
        console.warn(`⚠️  Intake question not found: ${mapping.intakeQuestionId}`);
        continue;
      }

      // Find matching assessment questions
      let matchingAssessmentQuestions;
      
      if (mapping.assessmentQuestionFilter.appendix) {
        matchingAssessmentQuestions = allAssessmentQuestions.filter(q => 
          q.appendix === mapping.assessmentQuestionFilter.appendix
        );
      } else if (mapping.assessmentQuestionFilter.category_code) {
        matchingAssessmentQuestions = allAssessmentQuestions.filter(q =>
          mapping.assessmentQuestionFilter.category_code!.includes(q.category_code!)
        );
      } else {
        matchingAssessmentQuestions = [];
      }

      console.log(`   📋 Mapping ${mapping.intakeQuestionId} to ${matchingAssessmentQuestions.length} assessment questions`);

      // Create mappings for each matching assessment question
      for (const assessmentQuestion of matchingAssessmentQuestions) {
        await db.insert(questionMapping).values({
          intakeQuestionId: intakeQuestion.id,
          assessmentQuestionId: assessmentQuestion.id,
          recCode: mapping.recCode,
          mappingLogic: mapping.mappingLogic,
          isActive: true
        });
      }
    }

    // Create smart logic conditions
    console.log("🧠 Creating smart logic conditions...");
    
    for (const condition of SMART_LOGIC_CONDITIONS) {
      const triggerQuestion = allIntakeQuestions.find(q => q.questionId === condition.triggerQuestionId);
      const dependentQuestion = allIntakeQuestions.find(q => q.questionId === condition.dependentQuestionId);
      
      if (!triggerQuestion || !dependentQuestion) {
        console.warn(`⚠️  Question not found for condition: ${condition.ruleId}`);
        continue;
      }

      // Find a question mapping to link to (use first available)
      const relatedMapping = await db.select().from(questionMapping)
        .where(eq(questionMapping.intakeQuestionId, triggerQuestion.id))
        .limit(1);
      
      if (relatedMapping.length > 0) {
        await db.insert(smartLogicConditions).values({
          ruleId: condition.ruleId,
          questionMappingId: relatedMapping[0].id,
          triggerQuestionId: triggerQuestion.id,
          dependentQuestionId: dependentQuestion.id,
          conditionType: condition.conditionType,
          expectedValue: condition.expectedValue,
          logicalOperator: condition.logicalOperator,
          isActive: true
        });
        
        console.log(`   🔗 Created logic condition: ${condition.ruleId}`);
      }
    }

    // Verify creation
    const mappingCount = await db.select().from(questionMapping);
    const conditionCount = await db.select().from(smartLogicConditions);
    
    console.log(`\n✅ Question mapping creation completed!`);
    console.log(`   🔗 Created ${mappingCount.length} question mappings`);
    console.log(`   🧠 Created ${conditionCount.length} smart logic conditions`);

    // Display mapping summary
    const mappingsByRec = mappingCount.reduce((acc, m) => {
      if (!acc[m.recCode]) acc[m.recCode] = 0;
      acc[m.recCode]++;
      return acc;
    }, {} as Record<string, number>);

    console.log("\n📈 Mappings by REC Code:");
    Object.entries(mappingsByRec).forEach(([recCode, count]) => {
      console.log(`   ${recCode}: ${count} mappings`);
    });

  } catch (error) {
    console.error("❌ Error creating question mappings:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createQuestionMappings().then(() => {
    console.log("🎯 Question mapping creation complete!");
    process.exit(0);
  }).catch((error) => {
    console.error("💥 Mapping creation failed:", error);
    process.exit(1);
  });
}

export { createQuestionMappings };
