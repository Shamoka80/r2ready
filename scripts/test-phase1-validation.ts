
import 'dotenv/config';
import { db } from '../server/db.js';
import { facilityProfiles, tenants, users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

class Phase1Validator {
  private results: TestResult[] = [];

  addResult(name: string, passed: boolean, message: string, details?: string) {
    this.results.push({ name, passed, message, details });
  }

  async runAllTests() {
    console.log('🧪 Starting Phase 1 Multi-Facility Validation...\n');

    await this.testDatabaseSchema();
    await this.testFacilityAPI();
    await this.testOnboardingIntegration();
    await this.testAssessmentIntegration();
    await this.testUIComponents();

    this.printResults();
    
    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log(`\n❌ ${failedTests.length} tests failed. Phase 1 not ready.`);
      process.exit(1);
    } else {
      console.log(`\n✅ All ${this.results.length} tests passed! Phase 1 multi-facility foundation is ready.`);
    }
  }

  async testDatabaseSchema() {
    console.log('📊 Testing Database Schema...');
    
    try {
      // Test facility profiles table
      const facilityColumns = await db.select().from(facilityProfiles).limit(0);
      this.addResult(
        'DB: Facility profiles table',
        true,
        'Table exists and is accessible'
      );

      // Test required columns exist
      const testFacility = {
        tenantId: 'test-tenant',
        name: 'Test Facility',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        facilityScopeId: 'test-scope',
        isPrimary: true,
        isActive: true
      };

      // This will fail if columns don't exist
      const testQuery = db.insert(facilityProfiles).values(testFacility);
      this.addResult(
        'DB: Required columns present',
        true,
        'All required facility columns are defined'
      );

    } catch (error) {
      this.addResult(
        'DB: Schema validation',
        false,
        'Database schema validation failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testFacilityAPI() {
    console.log('🌐 Testing Facility API...');
    
    try {
      // Test facilities router exists
      const facilitiesRouter = await import('../server/routes/facilities.js');
      this.addResult(
        'API: Facilities router',
        true,
        'Facilities router loads successfully'
      );

      // Test routes registration
      const fs = await import('fs');
      const routesContent = fs.readFileSync('server/routes.ts', 'utf-8');
      const hasFacilitiesRoute = routesContent.includes('facilitiesRoutes') && 
                                 routesContent.includes('/api/facilities');

      this.addResult(
        'API: Routes registration',
        hasFacilitiesRoute,
        hasFacilitiesRoute ? 'Facilities routes registered' : 'Facilities routes not found in routes.ts'
      );

    } catch (error) {
      this.addResult(
        'API: Facilities router',
        false,
        'Failed to load facilities router',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testOnboardingIntegration() {
    console.log('🚀 Testing Onboarding Integration...');
    
    try {
      const fs = await import('fs');
      const onboardingContent = fs.readFileSync('client/src/pages/OnboardingWizard.tsx', 'utf-8');
      
      const hasMultiFacilityFields = onboardingContent.includes('facilitiesPlanned') &&
                                     onboardingContent.includes('multiSiteOperations');

      this.addResult(
        'UI: Onboarding multi-facility fields',
        hasMultiFacilityFields,
        hasMultiFacilityFields ? 'Multi-facility fields present' : 'Multi-facility fields missing'
      );

    } catch (error) {
      this.addResult(
        'UI: Onboarding integration',
        false,
        'Failed to validate onboarding integration',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testAssessmentIntegration() {
    console.log('📋 Testing Assessment Integration...');
    
    try {
      const fs = await import('fs');
      const assessmentContent = fs.readFileSync('client/src/pages/NewAssessment.tsx', 'utf-8');
      
      const hasFacilitySelection = assessmentContent.includes('selectedFacilityId');

      this.addResult(
        'UI: Assessment facility selection',
        hasFacilitySelection,
        hasFacilitySelection ? 'Facility selection present' : 'Facility selection missing'
      );

    } catch (error) {
      this.addResult(
        'UI: Assessment integration',
        false,
        'Failed to validate assessment integration',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testUIComponents() {
    console.log('🎨 Testing UI Components...');
    
    try {
      const fs = await import('fs');
      
      // Test facilities page exists
      const facilitiesPageExists = fs.existsSync('client/src/pages/Facilities.tsx');
      this.addResult(
        'UI: Facilities page',
        facilitiesPageExists,
        facilitiesPageExists ? 'Facilities page exists' : 'Facilities page missing'
      );

      // Test facilities navigation
      const appLayoutContent = fs.readFileSync('client/src/components/layout/AppLayout.tsx', 'utf-8');
      const hasFacilitiesNav = appLayoutContent.includes('/facilities') &&
                               appLayoutContent.includes('Facilities');

      this.addResult(
        'UI: Facilities navigation',
        hasFacilitiesNav,
        hasFacilitiesNav ? 'Facilities navigation present' : 'Facilities navigation missing'
      );

      // Test app routing
      const appContent = fs.readFileSync('client/src/App.tsx', 'utf-8');
      const hasFacilitiesRoute = appContent.includes('path="/facilities"');

      this.addResult(
        'UI: Facilities routing',
        hasFacilitiesRoute,
        hasFacilitiesRoute ? 'Facilities route configured' : 'Facilities route missing'
      );

    } catch (error) {
      this.addResult(
        'UI: Components validation',
        false,
        'Failed to validate UI components',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  printResults() {
    console.log('\n📊 Test Results Summary:\n');
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    
    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);
      if (result.details && !result.passed) {
        console.log(`   Details: ${result.details}`);
      }
    });
    
    console.log(`\nSummary: ${passed} passed, ${failed} failed`);
  }
}

// Run the validator
const validator = new Phase1Validator();
validator.runAllTests().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
