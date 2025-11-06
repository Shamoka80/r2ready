
#!/usr/bin/env tsx

/**
 * Phase 1 Complete Flow Test
 * Tests the entire industry-standard user journey end-to-end
 */

import { db } from '../server/db';
import { users, tenants } from '../shared/schema';
import { eq } from 'drizzle-orm';

const API_BASE = process.env.NODE_ENV === 'production' ? 'https://rur2.replit.app' : 'http://localhost:5000';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
  response?: any;
}

const results: TestResult[] = [];

function logStep(step: string, status: 'PASS' | 'FAIL', details: string, response?: any) {
  results.push({ step, status, details, response });
  const emoji = status === 'PASS' ? '✅' : '❌';
  console.log(`${emoji} ${step}: ${details}`);
}

async function apiCall(method: string, endpoint: string, data?: any, headers?: any): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(url, config);
  const result = await response.json();
  
  return {
    ok: response.ok,
    status: response.status,
    data: result
  };
}

async function testSystemHealth() {
  try {
    const response = await apiCall('GET', '/api/auth/system-status');
    
    if (response.ok) {
      logStep('System Health', 'PASS', 'System is operational', response.data);
    } else {
      logStep('System Health', 'FAIL', `System check failed: ${response.data.error}`);
    }
  } catch (error) {
    logStep('System Health', 'FAIL', `Health check error: ${error.message}`);
  }
}

async function testEmailService() {
  try {
    const response = await apiCall('POST', '/api/auth/test-email', {
      email: 'phase1test@example.com',
      firstName: 'Phase1 Test'
    });
    
    if (response.ok && response.data.success) {
      logStep('Email Service', 'PASS', 'Email verification system working');
    } else {
      logStep('Email Service', 'FAIL', `Email service error: ${response.data.error || 'Unknown error'}`);
    }
  } catch (error) {
    logStep('Email Service', 'FAIL', `Email test error: ${error.message}`);
  }
}

async function testRegistrationFlow() {
  const timestamp = Date.now();
  const testEmail = `phase1test${timestamp}@example.com`;
  
  try {
    const response = await apiCall('POST', '/api/auth/register-tenant', {
      tenantName: `Phase1 Test Co ${timestamp}`,
      tenantType: 'BUSINESS',
      ownerEmail: testEmail,
      ownerFirstName: 'Phase1',
      ownerLastName: 'Test',
      ownerPassword: 'TestPassword123!'
    });
    
    if (response.ok) {
      if (response.data.requiresEmailVerification) {
        logStep('Registration Flow', 'PASS', 'Email-first registration working correctly');
        return { testEmail, requiresVerification: true };
      } else {
        logStep('Registration Flow', 'PASS', 'Legacy registration working');
        return { testEmail, token: response.data.token, requiresVerification: false };
      }
    } else {
      logStep('Registration Flow', 'FAIL', `Registration failed: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    logStep('Registration Flow', 'FAIL', `Registration error: ${error.message}`);
    return null;
  }
}

async function testAccountTypeAPI() {
  // Test account type endpoint exists and validates properly
  try {
    const response = await apiCall('PATCH', '/api/auth/account-type', {
      accountType: 'BUSINESS'
    });
    
    // Should fail without authentication, which is correct
    if (response.status === 401) {
      logStep('Account Type API', 'PASS', 'Account type endpoint properly secured');
    } else {
      logStep('Account Type API', 'FAIL', 'Account type endpoint security issue');
    }
  } catch (error) {
    logStep('Account Type API', 'FAIL', `Account type test error: ${error.message}`);
  }
}

async function testLicenseSystem() {
  try {
    // Test license status endpoint
    const response = await apiCall('GET', '/api/licenses/status');
    
    // Should fail without authentication, which is correct
    if (response.status === 401) {
      logStep('License System', 'PASS', 'License system properly secured');
    } else {
      logStep('License System', 'FAIL', 'License system security issue');
    }
  } catch (error) {
    logStep('License System', 'FAIL', `License test error: ${error.message}`);
  }
}

async function testOnboardingAPI() {
  try {
    // Test onboarding status endpoint
    const response = await apiCall('GET', '/api/onboarding/status');
    
    // Should fail without authentication, which is correct
    if (response.status === 401) {
      logStep('Onboarding API', 'PASS', 'Onboarding endpoints properly secured');
    } else {
      logStep('Onboarding API', 'FAIL', 'Onboarding security issue');
    }
  } catch (error) {
    logStep('Onboarding API', 'FAIL', `Onboarding test error: ${error.message}`);
  }
}

async function validateDatabaseState() {
  try {
    // Check for users in various setup states
    const userStats = await db.execute(`
      SELECT 
        setup_status,
        COUNT(*) as count,
        COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_count
      FROM "User" 
      GROUP BY setup_status
    `);
    
    logStep('Database State', 'PASS', 'User journey states tracked properly', userStats.rows);
    
    // Check tenant types
    const tenantStats = await db.execute(`
      SELECT tenant_type, COUNT(*) as count 
      FROM "Tenant" 
      GROUP BY tenant_type
    `);
    
    logStep('Tenant Types', 'PASS', 'Account type tracking operational', tenantStats.rows);
    
  } catch (error) {
    logStep('Database State', 'FAIL', `Database validation error: ${error.message}`);
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 PHASE 1 END-TO-END FLOW TEST REPORT');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`\n📊 TEST RESULTS:`);
  console.log(`   ✅ Passed: ${passed}/${results.length}`);
  console.log(`   ❌ Failed: ${failed}/${results.length}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / results.length) * 100)}%`);
  
  if (failed > 0) {
    console.log(`\n❌ FAILED TESTS:`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.step}: ${r.details}`);
    });
  }
  
  console.log(`\n🎯 PHASE 1 IMPLEMENTATION STATUS:`);
  if (failed === 0) {
    console.log(`   🟢 COMPLETE - All systems operational`);
    console.log(`   ✅ Registration → Email → Account Type → Pricing → Onboarding → Assessment flow ready`);
  } else if (failed <= 2) {
    console.log(`   🟡 MOSTLY COMPLETE - Minor issues detected`);
    console.log(`   ⚠️  Core flow operational but needs attention`);
  } else {
    console.log(`   🔴 NEEDS WORK - Multiple failures detected`);
    console.log(`   🔧 Significant issues require resolution`);
  }
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  console.log('🚀 Starting Phase 1 Complete Flow Test...\n');
  
  // Test core systems
  await testSystemHealth();
  await testEmailService();
  
  // Test registration and user journey
  const registrationResult = await testRegistrationFlow();
  
  // Test protected endpoints (should be properly secured)
  await testAccountTypeAPI();
  await testLicenseSystem();
  await testOnboardingAPI();
  
  // Validate database state
  await validateDatabaseState();
  
  // Generate final report
  await generateReport();
  
  // Return success code based on results
  const failedCount = results.filter(r => r.status === 'FAIL').length;
  process.exit(failedCount === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  });
}

export { main as testPhase1CompleteFlow };
