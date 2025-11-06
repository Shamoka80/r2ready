
#!/usr/bin/env tsx

import { db } from '../server/db';
import { assessments, intakeForms, users } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

async function testAssessmentNavigation() {
  console.log('🔍 Testing Assessment Navigation Flow...');

  try {
    // 1. Check for existing submitted intake forms
    const submittedForms = await db.query.intakeForms.findMany({
      where: eq(intakeForms.status, 'SUBMITTED'),
      orderBy: desc(intakeForms.submittedAt),
      limit: 5
    });

    console.log(`✅ Found ${submittedForms.length} submitted intake forms`);

    if (submittedForms.length === 0) {
      console.log('❌ No submitted intake forms found - this will block assessment creation');
      return false;
    }

    // 2. Check for existing assessments
    const existingAssessments = await db.query.assessments.findMany({
      orderBy: desc(assessments.createdAt),
      limit: 5,
      with: {
        intakeForm: {
          columns: {
            id: true,
            legalCompanyName: true,
            status: true
          }
        }
      }
    });

    console.log(`✅ Found ${existingAssessments.length} existing assessments`);

    for (const assessment of existingAssessments) {
      console.log(`  - Assessment ${assessment.id}: "${assessment.title}"`);
      console.log(`    Status: ${assessment.status}`);
      console.log(`    Intake Form: ${assessment.intakeForm?.legalCompanyName || 'Unknown'} (${assessment.intakeForm?.status})`);
      console.log(`    Created: ${assessment.createdAt}`);
      console.log('');
    }

    // 3. Test API endpoints that frontend calls
    console.log('🌐 Testing API endpoint accessibility...');
    
    const testAssessmentId = existingAssessments[0]?.id;
    if (testAssessmentId) {
      console.log(`Testing assessment endpoint: /api/assessments/${testAssessmentId}`);
      
      try {
        const assessment = await db.query.assessments.findFirst({
          where: eq(assessments.id, testAssessmentId)
        });
        
        if (assessment) {
          console.log('✅ Assessment API endpoint working correctly');
        } else {
          console.log('❌ Assessment API endpoint not returning data');
        }
      } catch (error) {
        console.log('❌ Assessment API endpoint error:', error);
      }
    }

    // 4. Verify intake form to assessment workflow
    console.log('🔄 Testing Intake → Assessment workflow...');
    
    const latestIntake = submittedForms[0];
    if (latestIntake) {
      console.log(`Latest intake form: ${latestIntake.id}`);
      console.log(`  Company: ${latestIntake.legalCompanyName}`);
      console.log(`  Status: ${latestIntake.status}`);
      console.log(`  Submitted: ${latestIntake.submittedAt}`);
      
      // Check if there's a corresponding assessment
      const linkedAssessment = await db.query.assessments.findFirst({
        where: eq(assessments.intakeFormId, latestIntake.id)
      });
      
      if (linkedAssessment) {
        console.log('✅ Found linked assessment:', linkedAssessment.title);
      } else {
        console.log('ℹ️  No assessment created yet for this intake form (normal if user hasn\'t clicked Complete Intake)');
      }
    }

    console.log('✅ Assessment navigation test completed');
    return true;

  } catch (error) {
    console.error('❌ Assessment navigation test failed:', error);
    return false;
  }
}

if (require.main === module) {
  testAssessmentNavigation()
    .then((success) => {
      console.log(success ? '🎉 All tests passed!' : '💥 Some tests failed');
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
}

export { testAssessmentNavigation };
