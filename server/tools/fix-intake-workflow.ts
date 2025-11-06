
import { db } from '../db';
import { intakeForms, intakeQuestions, intakeAnswers, users, tenants } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

async function fixIntakeWorkflow() {
  console.log('🔧 Fixing Intake Workflow...');

  try {
    // 1. Ensure intake questions exist
    const questions = await db.select().from(intakeQuestions).where(eq(intakeQuestions.isActive, true));
    console.log(`📋 Found ${questions.length} active intake questions`);

    if (questions.length === 0) {
      console.log('🔧 Creating basic intake questions...');
      
      // Create essential intake questions
      const basicQuestions = [
        {
          questionText: 'Legal Company Name',
          questionType: 'TEXT',
          section: 'company_info',
          phase: 'BASIC_INFO',
          order: 1,
          required: true,
          isActive: true
        },
        {
          questionText: 'Business Entity Type',
          questionType: 'SELECT',
          section: 'company_info',
          phase: 'BASIC_INFO',
          order: 2,
          required: true,
          isActive: true
        },
        {
          questionText: 'Primary Contact Email',
          questionType: 'EMAIL',
          section: 'contact_info',
          phase: 'BASIC_INFO',
          order: 3,
          required: true,
          isActive: true
        },
        {
          questionText: 'Total Number of Facilities',
          questionType: 'NUMBER',
          section: 'facility_info',
          phase: 'FACILITY_PROFILE',
          order: 4,
          required: false,
          isActive: true
        },
        {
          questionText: 'Processing Activities',
          questionType: 'MULTI_SELECT',
          section: 'operations',
          phase: 'SCOPE_DEFINITION',
          order: 5,
          required: false,
          isActive: true
        }
      ];

      for (const question of basicQuestions) {
        await db.insert(intakeQuestions).values(question);
      }

      console.log('✅ Created basic intake questions');
    }

    // 2. Check for existing intake forms and their completion status
    const tenant = await db.query.tenants.findFirst();
    const user = await db.query.users.findFirst();

    if (!tenant || !user) {
      console.log('❌ No tenant or user found');
      return;
    }

    const forms = await db.select().from(intakeForms).where(eq(intakeForms.tenantId, tenant.id));
    console.log(`📝 Found ${forms.length} intake forms for tenant ${tenant.name}`);

    for (const form of forms) {
      console.log(`🔍 Checking form ${form.id} (status: ${form.status})`);
      
      // Get answers for this form
      const answers = await db.select().from(intakeAnswers).where(eq(intakeAnswers.intakeFormId, form.id));
      console.log(`   📋 Has ${answers.length} answers`);
      
      // If form has no answers but has data in the form fields, create answers
      if (answers.length === 0 && form.legalCompanyName) {
        console.log('🔧 Creating answers from form data...');
        
        const questionsToAnswer = await db.select().from(intakeQuestions).where(eq(intakeQuestions.isActive, true));
        
        for (const question of questionsToAnswer) {
          let value = null;
          
          // Map form fields to question answers
          if (question.questionText.includes('Legal Company Name') && form.legalCompanyName) {
            value = form.legalCompanyName;
          } else if (question.questionText.includes('Business Entity Type') && form.businessEntityType) {
            value = form.businessEntityType;
          } else if (question.questionText.includes('Email') && form.email) {
            value = form.email;
          } else if (question.questionText.includes('Total Number of Facilities') && form.totalFacilities) {
            value = form.totalFacilities;
          } else if (question.questionText.includes('Processing Activities') && form.processingActivities) {
            value = JSON.stringify(form.processingActivities);
          }
          
          if (value) {
            await db.insert(intakeAnswers).values({
              intakeFormId: form.id,
              userId: user.id,
              intakeQuestionId: question.id,
              value: value,
              notes: 'Auto-generated from form data'
            });
            console.log(`   ✅ Created answer for: ${question.questionText}`);
          }
        }
      }
      
      // Check if form should be marked as submitted
      const updatedAnswers = await db.select().from(intakeAnswers).where(eq(intakeAnswers.intakeFormId, form.id));
      const requiredQuestions = await db.select().from(intakeQuestions).where(
        and(eq(intakeQuestions.required, true), eq(intakeQuestions.isActive, true))
      );
      
      const answeredRequired = updatedAnswers.filter(a => {
        const question = requiredQuestions.find(q => q.id === a.intakeQuestionId);
        return question && a.value;
      });
      
      console.log(`   📊 Required: ${requiredQuestions.length}, Answered: ${answeredRequired.length}`);
      
      // If all required questions are answered and form is still DRAFT, update to SUBMITTED
      if (answeredRequired.length >= requiredQuestions.length && form.status === 'DRAFT') {
        console.log('🔧 Updating form status to SUBMITTED...');
        await db.update(intakeForms)
          .set({
            status: 'SUBMITTED',
            submittedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(intakeForms.id, form.id));
        console.log('✅ Form marked as SUBMITTED');
      }
    }

    console.log('✅ Intake workflow fix completed');

  } catch (error) {
    console.error('❌ Error fixing intake workflow:', error);
    throw error;
  }
}

// Run the fix
fixIntakeWorkflow().then(() => {
  console.log('🏁 Intake workflow fix completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fix failed:', error);
  process.exit(1);
});
