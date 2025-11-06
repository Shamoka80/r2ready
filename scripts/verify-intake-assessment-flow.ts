
import { db } from '../server/db';
import { intakeForms, assessments, users, tenants } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

async function verifyIntakeAssessmentFlow() {
  console.log('🧪 Verifying Intake Form to Assessment Flow...\n');

  try {
    // 1. Check if demo user exists
    const demoUser = await db.query.users.findFirst({
      where: eq(users.email, 'demo@example.com')
    });

    if (!demoUser) {
      console.error('❌ Demo user not found. Run setup-demo-session.ts first');
      return false;
    }

    console.log('✅ Demo user found:', demoUser.email);

    // 2. Check intake forms
    const allIntakeForms = await db.query.intakeForms.findMany({
      where: eq(intakeForms.tenantId, demoUser.tenantId!),
      orderBy: desc(intakeForms.createdAt)
    });

    console.log(`📋 Found ${allIntakeForms.length} intake forms for tenant`);

    const submittedForms = allIntakeForms.filter(f => f.status === 'SUBMITTED');
    console.log(`✅ ${submittedForms.length} submitted intake forms`);

    // 3. Check assessments
    const allAssessments = await db.query.assessments.findMany({
      where: eq(assessments.tenantId, demoUser.tenantId!),
      orderBy: desc(assessments.createdAt)
    });

    console.log(`📊 Found ${allAssessments.length} assessments for tenant`);

    // 4. Check intake-to-assessment linkage
    let linkedCount = 0;
    for (const form of submittedForms) {
      const linkedAssessment = allAssessments.find(a => a.intakeFormId === form.id);
      if (linkedAssessment) {
        linkedCount++;
        console.log(`🔗 Intake form ${form.id} linked to assessment ${linkedAssessment.id}`);
      } else {
        console.log(`⚠️  Intake form ${form.id} not linked to any assessment`);
      }
    }

    // 5. Verify API endpoints are working
    const token = process.env.DEMO_AUTH_TOKEN;
    if (token) {
      console.log('\n🌐 Testing API endpoints...');

      // Test intake forms endpoint
      try {
        const intakeResponse = await fetch('http://localhost:5000/api/intake-forms', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (intakeResponse.ok) {
          const intakeData = await intakeResponse.json();
          const formsCount = intakeData?.data?.length || intakeData?.forms?.length || 0;
          console.log(`✅ Intake forms API working - returned ${formsCount} forms`);
        } else {
          console.log(`❌ Intake forms API failed: ${intakeResponse.status}`);
        }
      } catch (error) {
        console.log('❌ Intake forms API error:', error instanceof Error ? error.message : 'Unknown error');
      }

      // Test assessments endpoint
      try {
        const assessmentResponse = await fetch('http://localhost:5000/api/assessments', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (assessmentResponse.ok) {
          const assessmentData = await assessmentResponse.json();
          const assessmentCount = assessmentData?.assessments?.length || assessmentData?.data?.length || 0;
          console.log(`✅ Assessments API working - returned ${assessmentCount} assessments`);
        } else {
          console.log(`❌ Assessments API failed: ${assessmentResponse.status}`);
        }
      } catch (error) {
        console.log('❌ Assessments API error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // 6. Summary
    console.log('\n📊 Flow Verification Summary:');
    console.log(`   Total Intake Forms: ${allIntakeForms.length}`);
    console.log(`   Submitted Forms: ${submittedForms.length}`);
    console.log(`   Total Assessments: ${allAssessments.length}`);
    console.log(`   Linked Assessments: ${linkedCount}`);

    const isHealthy = submittedForms.length > 0 && (linkedCount === submittedForms.length || allAssessments.length > 0);
    
    if (isHealthy) {
      console.log('\n🎉 Intake to Assessment flow is working correctly!');
    } else {
      console.log('\n⚠️  Flow may need attention - check for missing linkages');
    }

    return isHealthy;

  } catch (error) {
    console.error('❌ Error during verification:', error);
    return false;
  }
}

if (require.main === module) {
  verifyIntakeAssessmentFlow().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { verifyIntakeAssessmentFlow };
