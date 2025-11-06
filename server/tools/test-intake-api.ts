
import fetch from 'node-fetch';

async function checkServerStatus(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:5000/api/onboarding/status', {
      method: 'HEAD',
      timeout: 3000
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function testIntakeAPI() {
  console.log('🧪 Testing Intake API endpoints...');
  
  // First check if server is running
  const serverRunning = await checkServerStatus();
  if (!serverRunning) {
    console.log('❌ Server is not running on port 5000');
    console.log('🚀 Please start the development server first:');
    console.log('   npm run dev');
    console.log('   OR click the Run button in Replit');
    console.log('⏳ Then run this test again');
    process.exit(1);
  }

  const baseUrl = 'http://localhost:5000/api';
  
  // Get auth token from the demo session setup
  const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtFeS0yMDI1LTA3LTE5In0.eyJ1c2VySWQiOiIyNzIxN2QzOS01NTE2LTRkZGEtYWFjMy0zMjc5NWJjZDE3ZDAiLCJ0ZW5hbnRJZCI6IjEwOTUwMjkzLTcyNjItNGE0Yi1hYjNmLWE5OGQwYTIyNzY4YyIsInNlc3Npb25JZCI6ImUyYjgxODhlLTlmYmQtNDY5YS05MmFjLTY1ZmEyOTkwODA0NiIsImlhdCI6MTc1OTAxNzMwMiwiZXhwIjoxNzU5MTAzNzAyfQ.5HnCN5NUW8eH1_eon_cc2Okn7eFc20jHw602tvtx6E0';
  
  const headers = {
    'Authorization': `Bearer ${testToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Get onboarding status
    console.log('📊 Testing onboarding status...');
    const onboardingResponse = await fetch(`${baseUrl}/onboarding/status`, { headers });
    console.log(`   Status: ${onboardingResponse.status}`);
    if (onboardingResponse.ok) {
      const onboardingData = await onboardingResponse.json();
      console.log('   ✅ Onboarding data:', JSON.stringify(onboardingData, null, 2));
    } else {
      const error = await onboardingResponse.text();
      console.log('   ❌ Onboarding error:', error);
    }

    // Test 2: Get intake forms
    console.log('📋 Testing intake forms...');
    const intakeResponse = await fetch(`${baseUrl}/intake-forms`, { headers });
    console.log(`   Status: ${intakeResponse.status}`);
    if (intakeResponse.ok) {
      const intakeData = await intakeResponse.json();
      console.log('   ✅ Intake forms:', JSON.stringify(intakeData, null, 2));
    } else {
      const error = await intakeResponse.text();
      console.log('   ❌ Intake forms error:', error);
    }

    // Test 3: Get assessments
    console.log('🎯 Testing assessments...');
    const assessmentResponse = await fetch(`${baseUrl}/assessments`, { headers });
    console.log(`   Status: ${assessmentResponse.status}`);
    if (assessmentResponse.ok) {
      const assessmentData = await assessmentResponse.json();
      console.log('   ✅ Assessments:', JSON.stringify(assessmentData, null, 2));
    } else {
      const error = await assessmentResponse.text();
      console.log('   ❌ Assessment error:', error);
    }

  } catch (error) {
    console.error('❌ API test error:', error);
  }
}

testIntakeAPI().then(() => {
  console.log('🏁 API test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 API test failed:', error);
  process.exit(1);
});
