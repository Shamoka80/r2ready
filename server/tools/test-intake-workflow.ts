
import { db } from '../db';
import { intakeForms, intakeQuestions, intakeAnswers, users, tenants } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

async function testIntakeWorkflow() {
  console.log('🧪 Testing Intake Workflow...');

  try {
    // Check if intake questions exist
    const questions = await db.select().from(intakeQuestions).where(eq(intakeQuestions.isActive, true));
    console.log(`📋 Found ${questions.length} active intake questions`);

    if (questions.length === 0) {
      console.log('❌ No intake questions found! Running setup...');
      // Import the setup function
      const { populateIntakeQuestions } = await import('./populate-intake-questions');
      await populateIntakeQuestions();
      console.log('✅ Intake questions populated');
    }

    // Check required questions
    const requiredQuestions = questions.filter(q => q.required);
    console.log(`📋 Found ${requiredQuestions.length} required intake questions`);

    // Get demo tenant and user
    const tenant = await db.query.tenants.findFirst();
    const user = await db.query.users.findFirst();

    if (!tenant || !user) {
      console.log('❌ No tenant or user found for testing');
      return;
    }

    console.log(`👤 Testing with tenant: ${tenant.name}, user: ${user.email}`);

    // Check existing intake forms
    const existingForms = await db.select().from(intakeForms).where(eq(intakeForms.tenantId, tenant.id));
    console.log(`📝 Found ${existingForms.length} existing intake forms`);

    for (const form of existingForms) {
      console.log(`📝 Form ${form.id}: status=${form.status}, submitted=${form.submittedAt}`);
      
      // Check answers for this form
      const answers = await db.select().from(intakeAnswers).where(eq(intakeAnswers.intakeFormId, form.id));
      console.log(`   📋 Has ${answers.length} answers`);
      
      // Check if all required questions are answered
      const answeredQuestionIds = answers.map(a => a.intakeQuestionId);
      const unansweredRequired = requiredQuestions.filter(q => !answeredQuestionIds.includes(q.id));
      
      if (unansweredRequired.length > 0) {
        console.log(`   ❌ Missing ${unansweredRequired.length} required answers:`);
        unansweredRequired.forEach(q => console.log(`      - ${q.questionText}`));
      } else {
        console.log(`   ✅ All required questions answered`);
      }
    }

    // Test API endpoint simulation
    console.log('\n🔧 Testing submission logic...');
    
    if (existingForms.length > 0) {
      const testForm = existingForms[0];
      
      // Simulate the submission validation logic
      const answeredRequired = await db.query.intakeAnswers.findMany({
        where: eq(intakeAnswers.intakeFormId, testForm.id),
        with: {
          intakeQuestion: true,
        }
      });

      const answeredRequiredIds = answeredRequired
        .filter(a => a.intakeQuestion?.required)
        .map(a => a.intakeQuestionId);

      const missingRequired = requiredQuestions.filter(q => 
        !answeredRequiredIds.includes(q.id)
      );

      console.log(`📊 Validation results for form ${testForm.id}:`);
      console.log(`   - Required questions: ${requiredQuestions.length}`);
      console.log(`   - Answered required: ${answeredRequiredIds.length}`);
      console.log(`   - Missing required: ${missingRequired.length}`);
      console.log(`   - Can submit: ${missingRequired.length === 0}`);
      console.log(`   - Current status: ${testForm.status}`);
    }

  } catch (error) {
    console.error('❌ Error testing intake workflow:', error);
  }
}

// Run the test
testIntakeWorkflow().then(() => {
  console.log('🏁 Intake workflow test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
