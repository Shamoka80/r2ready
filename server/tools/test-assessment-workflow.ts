
import { db } from "../db.js";
import { IntakeProcessor } from "../routes/intakeLogic.js";
import { intakeForms, assessments, questions, answers } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

// Test scenarios for complete workflow validation
const WORKFLOW_TEST_SCENARIOS = [
  {
    name: "Basic E-waste Recycler",
    intakeData: {
      legalCompanyName: "GreenTech Recycling LLC",
      businessEntityType: "LLC",
      totalFacilities: "1",
      certificationStructureType: "SINGLE",
      processingActivities: ["Collection", "Materials Recovery"],
      dataDestructionActivities: false,
      internationalShipments: false,
      applicableAppendices: ["Appendix C: Materials Recovery"],
      certificationType: "INITIAL"
    },
    expectedOutcome: {
      minQuestions: 50,
      maxQuestions: 150,
      requiredAppendices: ["APP-C"],
      criticalRecCodes: ["LEGAL-01", "FACILITY-01", "PROC-02"]
    }
  },
  {
    name: "Data Destruction Specialist",
    intakeData: {
      legalCompanyName: "SecureWipe Data Services",
      businessEntityType: "CORPORATION",
      totalFacilities: "2",
      certificationStructureType: "MULTI_SITE",
      processingActivities: ["Data Destruction", "Data Sanitization"],
      dataDestructionActivities: true,
      internationalShipments: false,
      applicableAppendices: ["Appendix D: Data Destruction"],
      certificationType: "INITIAL"
    },
    expectedOutcome: {
      minQuestions: 80,
      maxQuestions: 200,
      requiredAppendices: ["APP-D"],
      criticalRecCodes: ["DATA-01", "FACILITY-01", "PROC-02"]
    }
  },
  {
    name: "International Multi-facility Operation",
    intakeData: {
      legalCompanyName: "Global Electronics Recovery Corp",
      businessEntityType: "CORPORATION",
      totalFacilities: "5",
      certificationStructureType: "GROUP",
      processingActivities: ["Collection", "Refurbishment", "Materials Recovery", "Data Destruction"],
      dataDestructionActivities: true,
      internationalShipments: true,
      applicableAppendices: [
        "Appendix A: Focus Materials and Components",
        "Appendix B: Equipment Refurbishment and Resale",
        "Appendix C: Materials Recovery",
        "Appendix D: Data Destruction",
        "Appendix E: Downstream Vendors"
      ],
      certificationType: "INITIAL"
    },
    expectedOutcome: {
      minQuestions: 150,
      maxQuestions: 300,
      requiredAppendices: ["APP-A", "APP-B", "APP-C", "APP-D", "APP-E"],
      criticalRecCodes: ["LEGAL-01", "FACILITY-02", "DATA-01", "SUPPLY-01"]
    }
  }
];

async function testAssessmentWorkflow() {
  console.log("🔄 Testing Complete Assessment Workflow...\n");

  let totalTests = 0;
  let passedTests = 0;

  // Verify system readiness
  console.log("📊 System Readiness Check:");
  const allQuestions = await db.select().from(questions);
  const sampleIntakeForms = await db.select().from(intakeForms).limit(1);
  
  console.log(`   Questions Available: ${allQuestions.length}`);
  console.log(`   Sample Intake Forms: ${sampleIntakeForms.length}`);
  
  if (allQuestions.length === 0) {
    console.log("❌ No assessment questions found. Please run question population tools first.");
    return;
  }

  console.log("\n🎯 Testing Workflow Scenarios:");

  for (const scenario of WORKFLOW_TEST_SCENARIOS) {
    console.log(`\n📋 Scenario: ${scenario.name}`);
    console.log(`   Company: ${scenario.intakeData.legalCompanyName}`);
    
    totalTests++;

    try {
      // Create test intake form
      const [intakeForm] = await db.insert(intakeForms).values({
        tenantId: "test-tenant-" + Date.now(),
        title: `Test Intake - ${scenario.name}`,
        status: "SUBMITTED",
        ...scenario.intakeData,
        focusMaterials: scenario.intakeData.applicableAppendices.includes("Appendix A: Focus Materials and Components") 
          ? ["CRT displays", "Mercury-containing devices"] 
          : [],
        completionPercentage: 100
      }).returning();

      console.log(`   ✓ Created intake form: ${intakeForm.id}`);

      // Generate assessment scope
      const scope = await IntakeProcessor.generateAssessmentScope(intakeForm.id);
      console.log(`   📊 Generated scope with ${scope.applicableRecCodes.length} REC codes`);

      // Filter questions
      const questionFiltering = await IntakeProcessor.filterQuestionsForAssessment(
        intakeForm.id, 
        "test-assessment-" + Date.now()
      );

      console.log(`   📝 Filtered to ${questionFiltering.relevantQuestions} questions`);
      console.log(`   📈 Filtering efficiency: ${(questionFiltering.filteringRatio * 100).toFixed(1)}%`);

      // Validate expectations
      let scenarioValid = true;
      const issues = [];

      // Check question count range
      if (questionFiltering.relevantQuestions < scenario.expectedOutcome.minQuestions) {
        issues.push(`Too few questions: ${questionFiltering.relevantQuestions} < ${scenario.expectedOutcome.minQuestions}`);
        scenarioValid = false;
      }
      if (questionFiltering.relevantQuestions > scenario.expectedOutcome.maxQuestions) {
        issues.push(`Too many questions: ${questionFiltering.relevantQuestions} > ${scenario.expectedOutcome.maxQuestions}`);
        scenarioValid = false;
      }

      // Check required appendices
      for (const requiredAppendix of scenario.expectedOutcome.requiredAppendices) {
        if (!scope.requiredAppendices.includes(requiredAppendix)) {
          issues.push(`Missing required appendix: ${requiredAppendix}`);
          scenarioValid = false;
        }
      }

      // Check critical REC codes
      for (const criticalRec of scenario.expectedOutcome.criticalRecCodes) {
        if (!scope.applicableRecCodes.includes(criticalRec)) {
          issues.push(`Missing critical REC: ${criticalRec}`);
          scenarioValid = false;
        }
      }

      // Check filtering efficiency (should be 65-85%)
      if (questionFiltering.filteringRatio < 0.65 || questionFiltering.filteringRatio > 0.85) {
        issues.push(`Filtering ratio outside optimal range: ${(questionFiltering.filteringRatio * 100).toFixed(1)}%`);
        scenarioValid = false;
      }

      if (scenarioValid) {
        console.log(`   ✅ ${scenario.name}: PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ ${scenario.name}: FAILED`);
        issues.forEach(issue => console.log(`     - ${issue}`));
      }

      // Clean up test data
      await db.delete(intakeForms).where(eq(intakeForms.id, intakeForm.id));

    } catch (error) {
      console.log(`   ❌ ${scenario.name}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test edge cases
  console.log("\n🔬 Testing Edge Cases:");

  totalTests++;
  try {
    // Test minimal intake (should still produce valid scope)
    const [minimalIntake] = await db.insert(intakeForms).values({
      tenantId: "test-tenant-minimal",
      title: "Minimal Test Intake",
      status: "SUBMITTED",
      legalCompanyName: "Minimal Test Company",
      businessEntityType: "LLC",
      totalFacilities: "1",
      processingActivities: ["Collection"],
      completionPercentage: 50
    }).returning();

    const minimalScope = await IntakeProcessor.generateAssessmentScope(minimalIntake.id);
    
    if (minimalScope.applicableRecCodes.length > 0 && minimalScope.scopeStatement.length > 0) {
      console.log("   ✅ Minimal Intake: PASSED (Generated valid scope)");
      passedTests++;
    } else {
      console.log("   ❌ Minimal Intake: FAILED (Invalid scope generated)");
    }

    await db.delete(intakeForms).where(eq(intakeForms.id, minimalIntake.id));

  } catch (error) {
    console.log("   ❌ Minimal Intake: ERROR");
  }

  // Performance test
  totalTests++;
  try {
    console.log("\n⚡ Performance Test:");
    const startTime = Date.now();
    
    const [perfIntake] = await db.insert(intakeForms).values({
      tenantId: "test-tenant-perf",
      title: "Performance Test",
      status: "SUBMITTED",
      legalCompanyName: "Performance Test Corp",
      businessEntityType: "CORPORATION",
      totalFacilities: "3",
      processingActivities: ["Collection", "Refurbishment", "Materials Recovery"],
      completionPercentage: 100
    }).returning();

    const perfScope = await IntakeProcessor.generateAssessmentScope(perfIntake.id);
    const perfFiltering = await IntakeProcessor.filterQuestionsForAssessment(perfIntake.id, "perf-test");
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`   ⏱️  Processing time: ${duration}ms`);
    
    if (duration < 5000) { // Should complete within 5 seconds
      console.log("   ✅ Performance: PASSED (< 5s)");
      passedTests++;
    } else {
      console.log("   ❌ Performance: FAILED (> 5s)");
    }

    await db.delete(intakeForms).where(eq(intakeForms.id, perfIntake.id));

  } catch (error) {
    console.log("   ❌ Performance: ERROR");
  }

  // Summary
  console.log("\n📊 Assessment Workflow Test Results:");
  console.log(`   ✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(`   📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log("\n🎉 All workflow tests passed! Assessment workflow is ready for Phase 2.");
  } else {
    console.log("\n⚠️  Some tests failed. Review the issues above before proceeding.");
  }

  return {
    totalTests,
    passedTests,
    successRate: (passedTests / totalTests) * 100
  };
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('test-assessment-workflow.ts')) {
  testAssessmentWorkflow().then((results) => {
    console.log(`\n🎯 Workflow testing complete! ${results.successRate.toFixed(1)}% success rate.`);
    process.exit(results.successRate === 100 ? 0 : 1);
  }).catch((error) => {
    console.error("💥 Workflow testing failed:", error);
    process.exit(1);
  });
}

export { testAssessmentWorkflow };
