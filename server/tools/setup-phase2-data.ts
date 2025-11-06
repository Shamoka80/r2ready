
import { populateIntakeQuestions } from "./populate-intake-questions.js";
import { populateQuestionMappings } from "./populate-question-mappings.js";
import { populateRECMappings } from "./populate-rec-mappings.js";

export async function setupPhase2Data() {
  console.log('🚀 Setting up Phase 2 data infrastructure...\n');
  
  try {
    // Step 1: Populate intake questions
    console.log('📝 Step 1: Setting up intake questions...');
    const intakeResult = await populateIntakeQuestions();
    console.log(`✅ Intake questions: ${intakeResult.count} created\n`);
    
    // Step 2: Populate question mappings
    console.log('🔗 Step 2: Setting up question mappings...');
    const mappingResult = await populateQuestionMappings();
    console.log(`✅ Question mappings: ${mappingResult.count} created\n`);
    
    // Step 3: Populate REC mappings
    console.log('🎯 Step 3: Setting up REC mappings...');
    const recResult = await populateRECMappings();
    console.log(`✅ REC mappings: ${recResult.count} created\n`);
    
    const totalItems = intakeResult.count + mappingResult.count + recResult.count;
    
    console.log('🎉 Phase 2 data setup complete!');
    console.log('=' .repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   • Intake Questions: ${intakeResult.count}`);
    console.log(`   • Question Mappings: ${mappingResult.count}`);
    console.log(`   • REC Mappings: ${recResult.count}`);
    console.log(`   • Total Items: ${totalItems}`);
    console.log('=' .repeat(50));
    
    return {
      success: true,
      intakeQuestions: intakeResult.count,
      questionMappings: mappingResult.count,
      recMappings: recResult.count,
      total: totalItems
    };
    
  } catch (error) {
    console.error('💥 Phase 2 data setup failed:', error);
    throw error;
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('setup-phase2-data.ts')) {
  setupPhase2Data().then((result) => {
    console.log(`\n🎯 Phase 2 data setup successful! ${result.total} total items configured.`);
    process.exit(0);
  }).catch((error) => {
    console.error("\n💥 Phase 2 data setup failed:", error);
    process.exit(1);
  });
}
