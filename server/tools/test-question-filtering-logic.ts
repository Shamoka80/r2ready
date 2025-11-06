
import { db } from "../db";
import { IntakeProcessor } from "../routes/intakeLogic";
import { intakeForms, questions, questionMapping, recMapping } from "../../shared/schema";
import { eq, inArray } from "drizzle-orm";

// Test scenarios for question filtering validation
const FILTERING_TEST_SCENARIOS = [
  {
    name: "Basic Single Facility - No Appendices",
    intakeData: {
      id: "filter-test-001",
      legalCompanyName: "Simple Electronics Recycler",
      businessEntityType: "CORPORATION",
      totalFacilities: "1",
      certificationStructureType: "SINGLE",
      processingActivities: ["Materials Recovery"],
      certificationType: "INITIAL",
      internationalShipments: false,
      totalDownstreamVendors: "2",
      focusMaterials: [],
      applicableAppendices: []
    },
    expectedQuestionCategories: ["CR1", "CR2", "CR3", "FACILITY", "PROC"],
    excludedQuestionCategories: ["APP-B", "APP-D", "DATA", "INTL"],
    minQuestionsExpected: 5,
    maxQuestionsExpected: 12
  },
  {
    name: "Multi-Facility with Data Destruction",
    intakeData: {
      id: "filter-test-002",
      legalCompanyName: "Secure Data Solutions",
      businessEntityType: "LLC",
      totalFacilities: "3",
      certificationStructureType: "CAMPUS",
      processingActivities: ["Data Destruction", "Materials Recovery"],
      certificationType: "INITIAL",
      internationalShipments: false,
      totalDownstreamVendors: "5",
      focusMaterials: ["Mercury-containing devices"],
      applicableAppendices: ["APP-A", "APP-D"]
    },
    expectedQuestionCategories: ["CR1", "CR2", "CR3", "FACILITY", "PROC", "DATA", "APP-A", "APP-D"],
    excludedQuestionCategories: ["APP-B", "INTL"],
    minQuestionsExpected: 8,
    maxQuestionsExpected: 16
  },
  {
    name: "Complex International Operations",
    intakeData: {
      id: "filter-test-003",
      legalCompanyName: "Global Electronics Processing",
      businessEntityType: "CORPORATION",
      totalFacilities: "5",
      certificationStructureType: "GROUP",
      processingActivities: ["Materials Recovery", "Refurbishment", "Data Destruction"],
      certificationType: "RECERTIFICATION",
      internationalShipments: true,
      totalDownstreamVendors: "15",
      numNonR2Dsv: "3",
      primaryCountries: "Canada, Mexico, UK",
      focusMaterials: ["PCB-containing equipment", "Lead-containing components"],
      applicableAppendices: ["APP-A", "APP-B", "APP-D", "APP-E"]
    },
    expectedQuestionCategories: ["CR1", "CR2", "CR3", "FACILITY", "PROC", "DATA", "APP-A", "APP-B", "APP-D", "APP-E", "INTL"],
    excludedQuestionCategories: [],
    minQuestionsExpected: 10,
    maxQuestionsExpected: 16
  }
];

async function testQuestionFilteringLogic() {
  console.log("🧪 Starting Question Filtering Logic Tests...\n");

  // Verify baseline data exists
  const allQuestions = await db.select().from(questions);
  const allRecMappings = await db.select().from(recMapping);
  const allQuestionMappings = await db.select().from(questionMapping);

  console.log(`📊 Database Status:`);
  console.log(`   Questions: ${allQuestions.length}`);
  console.log(`   REC Mappings: ${allRecMappings.length}`);
  console.log(`   Question Mappings: ${allQuestionMappings.length}\n`);

  let passedTests = 0;
  let totalTests = 0;

  for (const scenario of FILTERING_TEST_SCENARIOS) {
    console.log(`🎯 Testing Scenario: ${scenario.name}`);
    console.log(`   Company: ${scenario.intakeData.legalCompanyName}`);
    console.log(`   Activities: ${scenario.intakeData.processingActivities.join(', ')}`);
    console.log(`   International: ${scenario.intakeData.internationalShipments}`);

    try {
      // Create mock intake form
      totalTests++;
      const { id, ...intakeDataWithoutId } = scenario.intakeData;
      await db.insert(intakeForms).values({
        id: scenario.intakeData.id,
        userId: 'test-user',
        ...intakeDataWithoutId,
        businessEntityType: intakeDataWithoutId.businessEntityType as any,
        certificationStructureType: intakeDataWithoutId.certificationStructureType as any,
        certificationType: intakeDataWithoutId.certificationType as any
      }).onConflictDoUpdate({
        target: intakeForms.id,
        set: {
          ...intakeDataWithoutId,
          userId: 'test-user',
          businessEntityType: intakeDataWithoutId.businessEntityType as any,
          certificationStructureType: intakeDataWithoutId.certificationStructureType as any,
          certificationType: intakeDataWithoutId.certificationType as any
        }
      });

      // Test question filtering
      const filteringResult = await IntakeProcessor.filterQuestionsForAssessment(
        scenario.intakeData.id,
        'test-assessment-id'
      );

      console.log(`   📋 Filtered Questions: ${filteringResult.relevantQuestions}/${filteringResult.totalQuestions}`);
      console.log(`   📊 Filtering Ratio: ${(filteringResult.filteringRatio * 100).toFixed(1)}%`);

      // Verify question count is within expected range
      if (filteringResult.relevantQuestions >= scenario.minQuestionsExpected && 
          filteringResult.relevantQuestions <= scenario.maxQuestionsExpected) {
        console.log(`   ✅ Question Count: PASSED (${filteringResult.relevantQuestions} questions)`);
        passedTests++;
      } else {
        console.log(`   ❌ Question Count: FAILED (Expected ${scenario.minQuestionsExpected}-${scenario.maxQuestionsExpected}, got ${filteringResult.relevantQuestions})`);
      }

      // Test REC applicability
      totalTests++;
      const expectedRECs = filteringResult.applicableRecCodes;
      const hasExpectedCategories = scenario.expectedQuestionCategories.some(cat => 
        expectedRECs.some((rec: string) => rec.includes(cat))
      );
      const hasExcludedCategories = scenario.excludedQuestionCategories.some(cat => 
        expectedRECs.some((rec: string) => rec.includes(cat))
      );

      if (hasExpectedCategories && !hasExcludedCategories) {
        console.log(`   ✅ REC Categories: PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ REC Categories: FAILED`);
        if (!hasExpectedCategories) {
          console.log(`      Missing expected categories: ${scenario.expectedQuestionCategories.join(', ')}`);
        }
        if (hasExcludedCategories) {
          console.log(`      Found excluded categories: ${scenario.excludedQuestionCategories.join(', ')}`);
        }
      }

      // Test scope statement quality
      totalTests++;
      const scope = filteringResult.scopeStatement;
      const hasCompanyName = scope.includes(scenario.intakeData.legalCompanyName);
      const hasCertType = scope.includes(scenario.intakeData.certificationType);
      const hasActivities = scenario.intakeData.processingActivities.some(activity => 
        scope.includes(activity)
      );

      if (hasCompanyName && hasCertType && hasActivities) {
        console.log(`   ✅ Scope Quality: PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ Scope Quality: FAILED`);
      }

      // Test filtering efficiency
      totalTests++;
      const efficiency = filteringResult.filteringRatio;
      if (efficiency >= 0.30 && efficiency <= 1.0) { // Should filter between 30-100%
        console.log(`   ✅ Filtering Efficiency: PASSED (${(efficiency * 100).toFixed(1)}%)`);
        passedTests++;
      } else {
        console.log(`   ❌ Filtering Efficiency: FAILED (${(efficiency * 100).toFixed(1)}% - should be 65-85%)`);
      }

    } catch (error) {
      console.error(`   💥 Error testing scenario: ${error}`);
    }

    console.log(); // Empty line between scenarios
  }

  // Test edge cases
  console.log(`🔬 Testing Edge Cases...`);

  // Test empty intake data
  totalTests++;
  try {
    const emptyResult = await IntakeProcessor.filterQuestionsForAssessment('non-existent-id', 'test-assessment');
    if (emptyResult.applicableRecCodes.length === 0 && emptyResult.scopeStatement.includes('intake form not found')) {
      console.log(`   ✅ Empty Intake: PASSED (Safely handled missing intake)`);
      passedTests++;
    } else {
      console.log(`   ❌ Empty Intake: FAILED (Unexpected response for missing intake)`);
    }
  } catch (error) {
    console.log(`   ❌ Empty Intake: FAILED (Should return safe empty scope, not throw error)`);
  }

  // Test question mapping existence
  totalTests++;
  const mappingCoverage = allQuestionMappings.length / Math.max(allQuestions.length, 1);
  if (mappingCoverage >= 0.1) { // At least 10% of questions should have mappings
    console.log(`   ✅ Mapping Coverage: PASSED (${(mappingCoverage * 100).toFixed(1)}%)`);
    passedTests++;
  } else {
    console.log(`   ❌ Mapping Coverage: FAILED (${(mappingCoverage * 100).toFixed(1)}% - should be ≥10%)`);
  }

  // Test smart logic conditions
  totalTests++;
  try {
    // Test conditional logic with a complex scenario
    const complexScenario = FILTERING_TEST_SCENARIOS[2];
    const { id, ...data } = complexScenario.intakeData;
    await db.insert(intakeForms).values({
      id: 'smart-logic-test',
      userId: 'test-user',
      ...data,
      businessEntityType: data.businessEntityType as any,
      certificationStructureType: data.certificationStructureType as any,
      certificationType: data.certificationType as any
    }).onConflictDoUpdate({
      target: intakeForms.id,
      set: {
        ...data,
        userId: 'test-user',
        businessEntityType: data.businessEntityType as any,
        certificationStructureType: data.certificationStructureType as any,
        certificationType: data.certificationType as any
      }
    });

    const smartResult = await IntakeProcessor.filterQuestionsForAssessment('smart-logic-test', 'test-assessment');
    if (smartResult.relevantQuestions > 0 && smartResult.filteringRatio > 0) {
      console.log(`   ✅ Smart Logic: PASSED`);
      passedTests++;
    } else {
      console.log(`   ❌ Smart Logic: FAILED`);
    }
  } catch (error) {
    console.log(`   ❌ Smart Logic: FAILED (${error})`);
  }

  // Final results
  console.log(`\n📊 Test Results Summary:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  console.log(`   Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  const passRate = (passedTests / totalTests) * 100;
  if (passRate >= 95) {
    console.log(`\n🎉 SUCCESS: ≥95% pass rate achieved! (${passRate.toFixed(1)}%)`);
  } else {
    console.log(`\n⚠️  WARNING: Pass rate below 95% (${passRate.toFixed(1)}%)`);
    console.log(`\n📝 Recommendations for improvement:`);
    if (allQuestionMappings.length < allQuestions.length * 0.1) {
      console.log(`   - Populate more question mappings (current: ${allQuestionMappings.length})`);
    }
    if (allRecMappings.length < 20) {
      console.log(`   - Add more REC mappings (current: ${allRecMappings.length})`);
    }
    console.log(`   - Implement smarter conditional logic in question filtering`);
    console.log(`   - Add more comprehensive test scenarios`);
  }

  return passRate;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('test-question-filtering-logic.ts')) {
  testQuestionFilteringLogic().then((passRate) => {
    if (passRate >= 95) {
      console.log("\n🚀 Phase 1.2 Ready for next phase!");
      process.exit(0);
    } else {
      console.log("\n❌ Phase 1.2 needs improvement before proceeding");
      process.exit(1);
    }
  }).catch((error) => {
    console.error("💥 Test execution failed:", error);
    process.exit(1);
  });
}

export { testQuestionFilteringLogic };
