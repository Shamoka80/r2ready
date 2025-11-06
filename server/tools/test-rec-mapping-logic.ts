import { db } from "../db";
import { IntakeProcessor } from "../routes/intakeLogic";
import { intakeForms, recMapping } from "../../shared/schema";
import { eq } from "drizzle-orm";

// Test data scenarios for REC mapping validation
const TEST_SCENARIOS = [
  {
    name: "Single Facility - Basic Processing",
    intakeData: {
      id: "test-001",
      legalCompanyName: "Basic Electronics Recycler",
      businessEntityType: "CORPORATION",
      totalFacilities: "1",
      certificationStructureType: "SINGLE",
      processingActivities: ["Materials Recovery", "Refurbishment"],
      certificationType: "INITIAL",
      internationalShipments: false,
      totalDownstreamVendors: "5",
      focusMaterials: ["CRT displays"],
      applicableAppendices: ["APP-A", "APP-B", "APP-C"]
    },
    expectedRECs: ["LEGAL-01", "LEGAL-02", "LEGAL-03", "FACILITY-01", "FACILITY-02", "FACILITY-03", "PROC-02", "PROC-03", "SUPPLY-01", "APP-A", "APP-B", "APP-C", "APP-E", "CERT-01", "PERSONNEL-01"],
    expectedAppendices: ["APP-A", "APP-B", "APP-C"]
  },
  {
    name: "Multi-Facility Campus - Data Destruction",
    intakeData: {
      id: "test-002",
      legalCompanyName: "Secure Data Solutions",
      businessEntityType: "LLC",
      totalFacilities: "3",
      certificationStructureType: "CAMPUS",
      processingActivities: ["Data Destruction", "Data Sanitization", "Materials Recovery"],
      certificationType: "INITIAL",
      internationalShipments: false,
      totalDownstreamVendors: "2",
      focusMaterials: ["Mercury-containing devices"],
      applicableAppendices: ["APP-A", "APP-C", "APP-D"]
    },
    expectedRECs: ["LEGAL-01", "LEGAL-02", "LEGAL-03", "FACILITY-01", "FACILITY-02", "FACILITY-03", "PROC-02", "PROC-03", "DATA-01", "DATA-02", "SUPPLY-01", "APP-A", "APP-C", "APP-D", "APP-E", "CERT-01", "PERSONNEL-01"],
    expectedAppendices: ["APP-A", "APP-C", "APP-D"]
  },
  {
    name: "International Operations - Complex",
    intakeData: {
      id: "test-003",
      legalCompanyName: "Global Electronics Processing",
      businessEntityType: "CORPORATION",
      totalFacilities: "5",
      certificationStructureType: "GROUP",
      processingActivities: ["Materials Recovery", "Refurbishment", "Collection"],
      certificationType: "RECERTIFICATION",
      internationalShipments: true,
      totalDownstreamVendors: "15",
      numNonR2Dsv: "3",
      primaryCountries: "Canada, Mexico",
      focusMaterials: ["PCB-containing equipment", "Lead-containing components"],
      applicableAppendices: ["APP-A", "APP-B", "APP-C", "APP-E", "APP-G"]
    },
    expectedRECs: ["LEGAL-01", "LEGAL-02", "LEGAL-03", "FACILITY-01", "FACILITY-02", "FACILITY-03", "PROC-02", "PROC-03", "SUPPLY-01", "SUPPLY-02", "APP-A", "APP-B", "APP-C", "APP-E", "CERT-01", "PERSONNEL-01"],
    expectedAppendices: ["APP-A", "APP-B", "APP-C", "APP-E", "APP-G"]
  }
];

async function testRECMappingLogic() {
  console.log("🧪 Starting REC Mapping Logic Tests...\n");

  // Verify REC mappings exist
  const recMappings = await db.select().from(recMapping);
  console.log(`📊 Found ${recMappings.length} REC mappings in database`);

  let passedTests = 0;
  let totalTests = 0;

  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n🎯 Testing Scenario: ${scenario.name}`);
    console.log(`   Company: ${scenario.intakeData.legalCompanyName}`);
    console.log(`   Facilities: ${scenario.intakeData.totalFacilities} (${scenario.intakeData.certificationStructureType})`);
    console.log(`   Activities: ${scenario.intakeData.processingActivities.join(', ')}`);
    console.log(`   International: ${scenario.intakeData.internationalShipments}`);

    try {
      // Test REC determination using actual IntakeProcessor
      totalTests++;
      // First create/update a mock intake form in the database
      const { id, ...intakeDataWithoutId } = scenario.intakeData;
      await db.insert(intakeForms).values({
        id: scenario.intakeData.id,
        userId: 'test-user',
        ...intakeDataWithoutId
      }).onConflictDoUpdate({
        target: intakeForms.id,
        set: {
          userId: 'test-user',
          ...intakeDataWithoutId
        }
      });

      const assessmentScope = await IntakeProcessor.generateAssessmentScope(scenario.intakeData.id);
      const recCodes = assessmentScope.applicableRecCodes;

      console.log(`   📋 Applicable RECs: ${recCodes.join(', ')}`);

      // Verify expected RECs are included
      const missingRECs = scenario.expectedRECs.filter(expectedRec => !recCodes.includes(expectedRec));
      const unexpectedRECs = recCodes.filter((recCode: string) => !scenario.expectedRECs.includes(recCode));

      if (missingRECs.length === 0 && unexpectedRECs.length === 0) {
        console.log(`   ✅ REC Determination: PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ REC Determination: FAILED`);
        if (missingRECs.length > 0) {
          console.log(`      Missing: ${missingRECs.join(', ')}`);
        }
        if (unexpectedRECs.length > 0) {
          console.log(`      Unexpected: ${unexpectedRECs.join(', ')}`);
        }
      }

      // Test scope generation
      totalTests++;
      const scope = assessmentScope.scopeStatement;
      console.log(`   📝 Scope: ${scope.substring(0, 100)}...`);

      if (scope.includes(scenario.intakeData.legalCompanyName) && scope.includes('R2v3')) {
        console.log(`   ✅ Scope Generation: PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ Scope Generation: FAILED`);
      }

      // Test appendix determination
      totalTests++;
      const appendices = assessmentScope.requiredAppendices;
      console.log(`   📎 Appendices: ${appendices.join(', ')}`);

      const missingAppendices = scenario.expectedAppendices.filter(app => !appendices.includes(app));
      if (missingAppendices.length === 0) {
        console.log(`   ✅ Appendix Determination: PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ Appendix Determination: FAILED - Missing: ${missingAppendices.join(', ')}`);
      }

      // Test complexity calculation
      totalTests++;
      const complexity = assessmentScope.complexityFactors;
      console.log(`   🔢 Complexity Factor: ${complexity.overall.toFixed(2)}`);

      if (complexity.overall >= 0.1 && complexity.overall <= 3.0) {
        console.log(`   ✅ Complexity Calculation: PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ Complexity Calculation: FAILED`);
      }

    } catch (error) {
      console.error(`   💥 Error testing scenario: ${error}`);
    }
  }

  // Test edge cases
  console.log(`\n🔬 Testing Edge Cases...`);

  // Test empty intake data
  totalTests++;
  try {
    const emptyIntake = { id: "test-empty", legalCompanyName: "Test", processingActivities: [] };
    const emptyRECs = await testRECDetermination(emptyIntake, recMappings);
    const mandatoryRECs = emptyRECs.filter((rec: any) => rec.processingRequirements?.mandatory === true);

    if (mandatoryRECs.length > 0) {
      console.log(`   ✅ Mandatory RECs: PASSED (${mandatoryRECs.length} mandatory RECs found)`);
      passedTests++;
    } else {
      console.log(`   ❌ Mandatory RECs: FAILED (No mandatory RECs found)`);
    }
  } catch (error) {
    console.error(`   💥 Error testing empty intake: ${error}`);
  }

  // Test validation logic
  totalTests++;
  try {
    const validationResult = IntakeProcessor.validateIntakeCompleteness(TEST_SCENARIOS[0].intakeData);

    if (typeof validationResult.isComplete === 'boolean' && Array.isArray(validationResult.missingFields)) {
      console.log(`   ✅ Validation Logic: PASSED`);
      passedTests++;
    } else {
      console.log(`   ❌ Validation Logic: FAILED`);
    }
  } catch (error) {
    console.error(`   💥 Error testing validation: ${error}`);
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
  }

  return passRate;
}

// Helper test functions
async function testRECDetermination(intakeData: any, allRECs: any[]) {
  const applicableRecs = [];

  for (const rec of allRECs) {
    const isApplicable = await evaluateRECApplicability(intakeData, rec);
    if (isApplicable) {
      applicableRecs.push(rec);
    }
  }

  return applicableRecs;
}

async function evaluateRECApplicability(intakeForm: any, recMapping: any): Promise<boolean> {
  const requirements = recMapping.processingRequirements;

  if (requirements?.mandatory === true) {
    return true;
  }

  if (requirements?.triggers) {
    return evaluateTriggerConditions(intakeForm, requirements.triggers);
  }

  return evaluateDefaultApplicability(intakeForm, recMapping.recCode);
}

function evaluateTriggerConditions(intakeForm: any, triggers: any): boolean {
  for (const [, condition] of Object.entries(triggers)) {
    if (evaluateCondition(intakeForm, condition as string)) {
      return true;
    }
  }
  return false;
}

function evaluateCondition(intakeForm: any, condition: string): boolean {
  if (condition.includes('facility_count > 1')) {
    return parseInt(intakeForm.totalFacilities || '0') > 1;
  }

  if (condition.includes('international_shipments === true')) {
    return intakeForm.internationalShipments === true;
  }

  if (condition.includes('data_destruction_activities === true')) {
    return intakeForm.processingActivities?.includes('Data Destruction');
  }

  return false;
}

function evaluateDefaultApplicability(intakeForm: any, recCode: string): boolean {
  if (recCode.startsWith('FACILITY-')) {
    return parseInt(intakeForm.totalFacilities || '0') > 0;
  }

  if (recCode.startsWith('PROC-')) {
    return Array.isArray(intakeForm.processingActivities) && intakeForm.processingActivities.length > 0;
  }

  if (recCode.startsWith('APP-')) {
    const appendixCode = recCode.split('-')[1];
    return intakeForm.applicableAppendices?.includes(`APP-${appendixCode}`);
  }

  return false;
}

async function testScopeGeneration(intakeData: any, applicableRecs: any[]): Promise<string> {
  const scopeParts = [];

  scopeParts.push(`R2v3 ${intakeData.certificationType || 'INITIAL'} certification for ${intakeData.legalCompanyName}`);

  if (parseInt(intakeData.totalFacilities || '1') > 1) {
    scopeParts.push(`covering ${intakeData.totalFacilities} facilities`);
  }

  if (intakeData.processingActivities?.length > 0) {
    scopeParts.push(`including ${intakeData.processingActivities.join(', ')}`);
  }

  return scopeParts.join(', ') + '.';
}

function testAppendixDetermination(applicableRecs: any[]): string[] {
  const appendices = new Set<string>();

  for (const rec of applicableRecs) {
    if (rec.relatedAppendices && Array.isArray(rec.relatedAppendices)) {
      rec.relatedAppendices.forEach((app: string) => appendices.add(app));
    }
  }

  return Array.from(appendices).sort();
}

function testComplexityCalculation(intakeData: any, applicableRecs: any[]): any {
  const factors = {
    facilityComplexity: 1.0,
    processComplexity: 1.0,
    overall: 1.0
  };

  const facilityCount = parseInt(intakeData.totalFacilities || '1');
  if (facilityCount > 1) {
    factors.facilityComplexity = Math.min(1.5, 1.0 + (facilityCount - 1) * 0.1);
  }

  const activityCount = intakeData.processingActivities?.length || 1;
  factors.processComplexity = Math.min(2.0, 1.0 + activityCount * 0.15);

  factors.overall = (factors.facilityComplexity + factors.processComplexity) / 2;

  return factors;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('test-rec-mapping-logic.ts')) {
  testRECMappingLogic().then((passRate) => {
    if (passRate >= 95) {
      console.log("\n🚀 Phase 1.1 Ready for next phase!");
      process.exit(0);
    } else {
      console.log("\n❌ Phase 1.1 needs improvement before proceeding");
      process.exit(1);
    }
  }).catch((error) => {
    console.error("💥 Test execution failed:", error);
    process.exit(1);
  });
}

export { testRECMappingLogic };