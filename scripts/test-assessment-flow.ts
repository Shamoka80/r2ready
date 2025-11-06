
import { db } from '../server/db';
import { users, tenants, intakeForms, assessments, facilityProfiles } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import fetch from 'node-fetch';

interface TestResult {
  step: string;
  success: boolean;
  details: string;
  error?: string;
}

async function testAssessmentFlow(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const baseUrl = 'http://localhost:5000';
  
  console.log('🧪 Testing Complete Assessment Flow...\n');

  try {
    // Step 1: Verify demo user exists
    const demoUser = await db.query.users.findFirst({
      where: eq(users.email, 'demo@example.com')
    });

    if (!demoUser) {
      results.push({
        step: 'Demo User Check',
        success: false,
        details: 'Demo user not found',
        error: 'Run setup-demo-session.ts first'
      });
      return results;
    }

    results.push({
      step: 'Demo User Check',
      success: true,
      details: `Found demo user: ${demoUser.id}`
    });

    // Step 2: Check if tenant exists
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, demoUser.tenantId!)
    });

    results.push({
      step: 'Tenant Check',
      success: !!tenant,
      details: tenant ? `Tenant found: ${tenant.name}` : 'Tenant not found'
    });

    // Step 3: Check facilities
    const facilities = await db.query.facilityProfiles.findMany({
      where: and(
        eq(facilityProfiles.tenantId, demoUser.tenantId!),
        eq(facilityProfiles.isActive, true)
      )
    });

    results.push({
      step: 'Facility Check',
      success: facilities.length > 0,
      details: `Found ${facilities.length} active facilities`
    });

    if (facilities.length === 0) {
      results.push({
        step: 'Facility Creation',
        success: false,
        details: 'No facilities found for assessment creation',
        error: 'Create at least one facility'
      });
    }

    // Step 4: Check intake forms
    const intakeForms_ = await db.query.intakeForms.findMany({
      where: eq(intakeForms.tenantId, demoUser.tenantId!)
    });

    const submittedIntakes = intakeForms_.filter(form => form.status === 'SUBMITTED');

    results.push({
      step: 'Intake Forms Check',
      success: submittedIntakes.length > 0,
      details: `Found ${intakeForms_.length} intake forms, ${submittedIntakes.length} submitted`
    });

    // Step 5: Test API endpoints
    const authToken = process.env.DEMO_AUTH_TOKEN || '';
    
    if (!authToken) {
      results.push({
        step: 'Auth Token Check',
        success: false,
        details: 'No demo auth token found',
        error: 'Set DEMO_AUTH_TOKEN environment variable'
      });
    } else {
      // Test intake forms endpoint
      try {
        const intakeResponse = await fetch(`${baseUrl}/api/intake-forms`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        const intakeData = await intakeResponse.json();
        
        results.push({
          step: 'Intake Forms API',
          success: intakeResponse.ok,
          details: intakeResponse.ok ? 
            `API returned ${intakeData.data?.length || intakeData.forms?.length || 0} forms` :
            `API error: ${intakeData.error || intakeResponse.statusText}`
        });
      } catch (error) {
        results.push({
          step: 'Intake Forms API',
          success: false,
          details: 'API request failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Test facilities endpoint
      try {
        const facilitiesResponse = await fetch(`${baseUrl}/api/facilities`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        const facilitiesData = await facilitiesResponse.json();
        
        results.push({
          step: 'Facilities API',
          success: facilitiesResponse.ok,
          details: facilitiesResponse.ok ? 
            `API returned ${Array.isArray(facilitiesData) ? facilitiesData.length : 0} facilities` :
            `API error: ${facilitiesData.error || facilitiesResponse.statusText}`
        });
      } catch (error) {
        results.push({
          step: 'Facilities API',
          success: false,
          details: 'API request failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Test assessment creation if we have prerequisites
      if (submittedIntakes.length > 0 && facilities.length > 0) {
        try {
          const assessmentData = {
            title: 'Test Assessment Flow',
            description: 'Automated test assessment',
            stdCode: 'R2V3_1',
            intakeFormId: submittedIntakes[0].id,
            facilityId: facilities[0].id
          };

          const createResponse = await fetch(`${baseUrl}/api/assessments`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(assessmentData)
          });

          const createResult = await createResponse.json();
          
          if (createResponse.ok) {
            results.push({
              step: 'Assessment Creation API',
              success: true,
              details: `Assessment created: ${createResult.assessment?.id || createResult.id}`
            });

            // Clean up test assessment
            const assessmentId = createResult.assessment?.id || createResult.id;
            if (assessmentId) {
              await fetch(`${baseUrl}/api/assessments/${assessmentId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                }
              });
            }
          } else {
            results.push({
              step: 'Assessment Creation API',
              success: false,
              details: `API error: ${createResult.error || createResponse.statusText}`,
              error: JSON.stringify(createResult, null, 2)
            });
          }
        } catch (error) {
          results.push({
            step: 'Assessment Creation API',
            success: false,
            details: 'API request failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        results.push({
          step: 'Assessment Creation API',
          success: false,
          details: 'Prerequisites missing - skipping assessment creation test',
          error: `Need submitted intake forms (${submittedIntakes.length}) and facilities (${facilities.length})`
        });
      }
    }

  } catch (error) {
    results.push({
      step: 'Test Execution',
      success: false,
      details: 'Test execution failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return results;
}

async function main() {
  console.log('🧪 Starting Assessment Flow Test\n');
  
  const results = await testAssessmentFlow();
  
  console.log('📊 Test Results:\n');
  
  let passed = 0;
  let failed = 0;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const number = (index + 1).toString().padStart(2, '0');
    
    console.log(`${status} ${number}. ${result.step}: ${result.details}`);
    
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
    
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
  console.log(`🎯 Success Rate: ${Math.round((passed / results.length) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Assessment flow is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
  
  process.exit(failed === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

export { testAssessmentFlow };
