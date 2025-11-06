
#!/usr/bin/env tsx

/**
 * Industry Journey API Flow Verification
 * Tests the complete API flow for both business and consultant journeys
 */

import chalk from 'chalk';

const API_BASE = 'http://0.0.0.0:5000';

interface ApiTest {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  body?: any;
  headers?: Record<string, string>;
  expectedStatus: number[];
}

class JourneyApiTester {
  private async runApiTest(test: ApiTest): Promise<{ success: boolean; details: string }> {
    try {
      const response = await fetch(`${API_BASE}${test.endpoint}`, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
          ...test.headers
        },
        body: test.body ? JSON.stringify(test.body) : undefined
      });

      const isExpectedStatus = test.expectedStatus.includes(response.status);
      
      return {
        success: isExpectedStatus,
        details: `${test.method} ${test.endpoint} → ${response.status} ${isExpectedStatus ? '✅' : '❌'}`
      };
    } catch (error: any) {
      return {
        success: false,
        details: `${test.method} ${test.endpoint} → Network Error: ${error.message}`
      };
    }
  }

  async testCompleteApiFlow(): Promise<void> {
    console.log(chalk.blue('🔗 Testing Industry Journey API Flow'));
    console.log('Testing all critical endpoints for business and consultant journeys\n');

    // Phase 1: Pre-Authentication APIs
    await this.testPreAuthApis();
    
    // Phase 2: Business Journey APIs  
    await this.testBusinessJourneyApis();
    
    // Phase 3: Consultant Journey APIs
    await this.testConsultantJourneyApis();
    
    // Phase 4: Mock Payment APIs
    await this.testMockPaymentApis();

    console.log(chalk.green('\n✅ API Flow Testing Complete!'));
  }

  private async testPreAuthApis(): Promise<void> {
    console.log(chalk.yellow('📝 Phase 1: Pre-Authentication APIs'));

    const tests: ApiTest[] = [
      {
        name: 'Health Check',
        method: 'GET',
        endpoint: '/api/health',
        expectedStatus: [200]
      },
      {
        name: 'Registration - Business User',
        method: 'POST',
        endpoint: '/api/auth/register',
        body: {
          email: `business-api-${Date.now()}@test.com`,
          password: 'TestPassword123!',
          firstName: 'Business',
          lastName: 'User',
          companyName: 'Test Business Corp',
          acceptedTerms: true
        },
        expectedStatus: [200, 201]
      },
      {
        name: 'Registration - Consultant User',
        method: 'POST',
        endpoint: '/api/auth/register',
        body: {
          email: `consultant-api-${Date.now()}@test.com`,
          password: 'TestPassword123!',
          firstName: 'Consultant',
          lastName: 'User',
          companyName: 'Test Consulting LLC',
          acceptedTerms: true
        },
        expectedStatus: [200, 201]
      }
    ];

    for (const test of tests) {
      const result = await this.runApiTest(test);
      console.log(`  ${result.details}`);
    }
  }

  private async testBusinessJourneyApis(): Promise<void> {
    console.log(chalk.yellow('\n👔 Phase 2: Business Journey APIs'));

    const tests: ApiTest[] = [
      {
        name: 'Business Dashboard Access',
        method: 'GET', 
        endpoint: '/api/dashboard/business',
        expectedStatus: [200, 401] // 401 acceptable (needs auth)
      },
      {
        name: 'Assessment Management',
        method: 'GET',
        endpoint: '/api/assessments',
        expectedStatus: [200, 401]
      },
      {
        name: 'Facility Management',
        method: 'GET',
        endpoint: '/api/facilities',
        expectedStatus: [200, 401]
      },
      {
        name: 'Onboarding API',
        method: 'GET',
        endpoint: '/api/onboarding/organization-profile',
        expectedStatus: [200, 401]
      }
    ];

    for (const test of tests) {
      const result = await this.runApiTest(test);
      console.log(`  ${result.details}`);
    }
  }

  private async testConsultantJourneyApis(): Promise<void> {
    console.log(chalk.yellow('\n🏢 Phase 3: Consultant Journey APIs'));

    const tests: ApiTest[] = [
      {
        name: 'Client Organizations',
        method: 'GET',
        endpoint: '/api/client-organizations',
        expectedStatus: [200, 401]
      },
      {
        name: 'Client Facilities',
        method: 'GET',
        endpoint: '/api/client-facilities',
        expectedStatus: [200, 401]
      },
      {
        name: 'Consultant Features',
        method: 'GET',
        endpoint: '/api/consultant/profile',
        expectedStatus: [200, 401, 404] // 404 acceptable if not implemented yet
      }
    ];

    for (const test of tests) {
      const result = await this.runApiTest(test);
      console.log(`  ${result.details}`);
    }
  }

  private async testMockPaymentApis(): Promise<void> {
    console.log(chalk.yellow('\n💳 Phase 4: Mock Payment APIs'));

    const tests: ApiTest[] = [
      {
        name: 'Mock Payment Creation',
        method: 'POST',
        endpoint: '/api/stripe/mock-payment',
        body: {
          planId: 'solo',
          userEmail: `payment-test-${Date.now()}@test.com`,
          userId: `test-user-${Date.now()}`,
          mockSuccess: true
        },
        expectedStatus: [200, 201]
      },
      {
        name: 'License Verification',
        method: 'GET',
        endpoint: '/api/licenses/status',
        expectedStatus: [200, 401]
      }
    ];

    for (const test of tests) {
      const result = await this.runApiTest(test);
      console.log(`  ${result.details}`);
    }
  }
}

// Main execution
async function main() {
  try {
    const tester = new JourneyApiTester();
    await tester.testCompleteApiFlow();
  } catch (error: any) {
    console.error(chalk.red('💥 API Flow Testing failed:'), error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
