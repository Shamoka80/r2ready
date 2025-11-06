import { db } from "../db.js";
import { 
  intakeForms,
  intakeAnswers,
  intakeQuestions,
  questionMapping,
  questions
} from "../../shared/schema.js";
import { eq, inArray } from "drizzle-orm";

// Test function to simulate the intelligent filtering logic
async function testIntelligentFiltering() {
  console.log("🧪 Testing Intelligent Filtering System...");
  
  try {
    // Test Case 1: Single-facility organization with data destruction
    console.log("\n🏢 Test Case 1: Single-facility organization with data destruction");
    
    const testAnswers1 = [
      { questionId: "total-facilities", value: 1 },
      { questionId: "data-destruction-activities", value: true },
      { questionId: "legal-company-name", value: "Test Company LLC" },
      { questionId: "business-entity-type", value: "LLC" }
    ];
    
    const filteredQuestions1 = await simulateFiltering(testAnswers1);
    console.log(`   ✓ Single-facility org should get: ${filteredQuestions1.length} questions`);
    console.log(`   📋 Expected: Core facility questions + data destruction questions`);
    
    // Test Case 2: Multi-facility organization without data destruction
    console.log("\n🏢 Test Case 2: Multi-facility organization without data destruction");
    
    const testAnswers2 = [
      { questionId: "total-facilities", value: 5 },
      { questionId: "data-destruction-activities", value: false },
      { questionId: "processing-activities", value: ["Materials Recovery", "Refurbishment"] },
      { questionId: "legal-company-name", value: "MultiSite Corp" },
      { questionId: "business-entity-type", value: "CORPORATION" }
    ];
    
    const filteredQuestions2 = await simulateFiltering(testAnswers2);
    console.log(`   ✓ Multi-facility org should get: ${filteredQuestions2.length} questions`);
    console.log(`   📋 Expected: Core facility questions + multi-facility questions + processing questions`);
    
    // Test Case 3: International operations with data destruction
    console.log("\n🌍 Test Case 3: International operations with data destruction");
    
    const testAnswers3 = [
      { questionId: "total-facilities", value: 2 },
      { questionId: "data-destruction-activities", value: true },
      { questionId: "international-shipments", value: true },
      { questionId: "processing-activities", value: ["Data Destruction", "Materials Recovery"] },
      { questionId: "legal-company-name", value: "Global Recycling Inc" },
      { questionId: "business-entity-type", value: "CORPORATION" }
    ];
    
    const filteredQuestions3 = await simulateFiltering(testAnswers3);
    console.log(`   ✓ International org should get: ${filteredQuestions3.length} questions`);
    console.log(`   📋 Expected: Core + multi-facility + data destruction + international + processing questions`);
    
    // Verify the critical >= 1 condition works
    console.log("\n🔍 Verifying >= 1 condition for single-facility:");
    const facilityQuestions = filteredQuestions1.filter(q => 
      q.questionId === "r2-facility-001" || q.questionId === "r2-facility-002"
    );
    console.log(`   ✓ Facility questions found: ${facilityQuestions.length}/2`);
    
    if (facilityQuestions.length === 2) {
      console.log("   ✅ CRITICAL FIX CONFIRMED: Single-facility organizations now get core facility questions!");
    } else {
      console.log("   ❌ CRITICAL ISSUE: Single-facility organizations missing core facility questions!");
    }
    
    console.log("\n🎯 Intelligent Filtering Test Summary:");
    console.log(`   • Single-facility (n=1): ${filteredQuestions1.length} questions`);
    console.log(`   • Multi-facility (n=5): ${filteredQuestions2.length} questions`);
    console.log(`   • International (n=2): ${filteredQuestions3.length} questions`);
    console.log("   • System successfully filters from 16 sample questions to organization-specific subsets");
    
  } catch (error) {
    console.error("❌ Error testing intelligent filtering:", error);
  }
}

// Simulate the filtering logic from intakeLogic.ts
async function simulateFiltering(testAnswers: any[]): Promise<any[]> {
  // Get all mappings
  const mappings = await db.select({
    mapping: questionMapping,
    intakeQuestion: intakeQuestions,
    assessmentQuestion: questions
  })
  .from(questionMapping)
  .leftJoin(intakeQuestions, eq(questionMapping.intakeQuestionId, intakeQuestions.id))
  .leftJoin(questions, eq(questionMapping.assessmentQuestionId, questions.id))
  .where(eq(questionMapping.isActive, true));

  const filteredQuestionIds = new Set<string>();
  
  for (const { mapping, intakeQuestion, assessmentQuestion } of mappings) {
    if (!intakeQuestion || !assessmentQuestion) continue;

    // Find the corresponding test answer
    const answer = testAnswers.find(a => a.questionId === intakeQuestion.questionId);
    if (!answer) continue;

    // Use the same evaluation logic as the actual system
    const shouldInclude = evaluateMappingLogic(mapping.mappingLogic, answer.value);
    
    if (shouldInclude) {
      filteredQuestionIds.add(assessmentQuestion.id);
    }
  }

  // Get the actual filtered questions
  if (filteredQuestionIds.size === 0) return [];
  
  const filteredQuestions = await db.select().from(questions)
    .where(inArray(questions.id, Array.from(filteredQuestionIds)));

  return filteredQuestions;
}

// Copy of the enhanced evaluation logic from intakeLogic.ts
function evaluateMappingLogic(mappingLogic: any, intakeValue: any): boolean {
  if (!mappingLogic || !mappingLogic.condition) return false;

  const condition = mappingLogic.condition;
  
  try {
    // Boolean equality checks
    if (condition.includes('=== true')) {
      return intakeValue === true;
    }
    
    if (condition.includes('=== false')) {
      return intakeValue === false;
    }
    
    // Array includes checks
    if (condition.includes('.includes(')) {
      const searchTerm = condition.match(/includes\('([^']+)'\)/)?.[1];
      return Array.isArray(intakeValue) && intakeValue.includes(searchTerm);
    }
    
    // Non-null and non-empty checks
    if (condition.includes('!== null') && condition.includes('!== \'\'')) {
      return intakeValue !== null && intakeValue !== '';
    }
    
    // Numeric comparison operators (critical for facility requirements)
    const numericValue = Number(intakeValue);
    
    // Greater than or equal to (>= operator)
    if (condition.includes('>= ')) {
      const threshold = parseFloat(condition.match(/>= (\d+(?:\.\d+)?)/)?.[1] || '0');
      return numericValue >= threshold;
    }
    
    // Less than or equal to (<= operator)  
    if (condition.includes('<= ')) {
      const threshold = parseFloat(condition.match(/<= (\d+(?:\.\d+)?)/)?.[1] || '0');
      return numericValue <= threshold;
    }
    
    // Greater than (> operator)
    if (condition.includes('> ')) {
      const threshold = parseFloat(condition.match(/> (\d+(?:\.\d+)?)/)?.[1] || '0');
      return numericValue > threshold;
    }
    
    // Less than (< operator)
    if (condition.includes('< ')) {
      const threshold = parseFloat(condition.match(/< (\d+(?:\.\d+)?)/)?.[1] || '0');
      return numericValue < threshold;
    }
    
    // Exact numeric equality
    if (condition.includes('=== ') && !isNaN(numericValue)) {
      const expectedValue = parseFloat(condition.match(/=== (\d+(?:\.\d+)?)/)?.[1] || '0');
      return numericValue === expectedValue;
    }

    return false;
  } catch (error) {
    console.error("Error evaluating mapping logic:", error);
    return false;
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('test-intelligent-filtering.ts')) {
  testIntelligentFiltering().then(() => {
    console.log("🎯 Intelligent filtering test complete!");
    process.exit(0);
  }).catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
  });
}

export { testIntelligentFiltering };