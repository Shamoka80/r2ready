
#!/usr/bin/env node

/**
 * Phase 1 Multi-Facility Foundation Verification
 * Tests multi-facility database schema, onboarding, and assessment creation
 */

import { db } from '../server/db.js';
import { 
  facilityProfiles, 
  tenants, 
  users, 
  assessments 
} from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  error?: string;
}

class Phase1Verifier {
  private results: TestResult[] = [];

  private addResult(testName: string, passed: boolean, details: string, error?: string) {
    this.results.push({ testName, passed, details, error });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${details}`);
    if (error) console.log(`   Error: ${error}`);
  }

  async testDatabaseSchema() {
    console.log('\n🔍 Testing Database Schema Updates...');
    
    try {
      // Test facility profiles table structure
      const facilityColumns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'FacilityProfile'
        ORDER BY column_name
      `);
      
      const requiredColumns = ['isPrimary', 'isActive', 'facilityScopeId'];
      const existingColumns = facilityColumns.map((col: any) => col.column_name);
      
      for (const reqCol of requiredColumns) {
        const exists = existingColumns.includes(reqCol);
        this.addResult(
          `Schema: FacilityProfile.${reqCol}`,
          exists,
          exists ? 'Column exists' : 'Column missing'
        );
      }

      // Test UserFacilityScope table
      const scopeTableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'UserFacilityScope'
        )
      `);
      
      this.addResult(
        'Schema: UserFacilityScope table',
        scopeTableExists[0]?.exists || false,
        scopeTableExists[0]?.exists ? 'Table exists' : 'Table missing'
      );

      // Test FacilityAuditLog table
      const auditTableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'FacilityAuditLog'
        )
      `);
      
      this.addResult(
        'Schema: FacilityAuditLog table',
        auditTableExists[0]?.exists || false,
        auditTableExists[0]?.exists ? 'Table exists' : 'Table missing'
      );

    } catch (error) {
      this.addResult(
        'Schema: Database connection',
        false,
        'Failed to test schema',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testMultiFacilityCreation() {
    console.log('\n🏗️ Testing Multi-Facility Creation...');
    
    try {
      // Get a test tenant
      const testTenant = await db.query.tenants.findFirst({
        where: eq(tenants.name, 'RuR2 System Administration')
      });

      if (!testTenant) {
        this.addResult(
          'Multi-Facility: Test tenant',
          false,
          'No test tenant found'
        );
        return;
      }

      // Count existing facilities
      const existingFacilities = await db.query.facilityProfiles.findMany({
        where: and(
          eq(facilityProfiles.tenantId, testTenant.id),
          eq(facilityProfiles.isActive, true)
        )
      });

      this.addResult(
        'Multi-Facility: Existing facilities query',
        true,
        `Found ${existingFacilities.length} existing facilities`
      );

      // Test primary facility logic
      const primaryFacilities = existingFacilities.filter(f => f.isPrimary);
      this.addResult(
        'Multi-Facility: Primary facility logic',
        primaryFacilities.length <= 1,
        `${primaryFacilities.length} primary facilities (should be 0 or 1)`
      );

    } catch (error) {
      this.addResult(
        'Multi-Facility: Creation test',
        false,
        'Failed to test facility creation',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testFacilityAPI() {
    console.log('\n🌐 Testing Facility API Endpoints...');
    
    try {
      // Test if facilities router exists
      const routerPath = '../server/routes/facilities.ts';
      
      try {
        await import(routerPath);
        this.addResult(
          'API: Facilities router',
          true,
          'Facilities router module loads successfully'
        );
      } catch (importError) {
        this.addResult(
          'API: Facilities router',
          false,
          'Facilities router failed to load',
          importError instanceof Error ? importError.message : String(importError)
        );
      }

      // Test routes registration (check if routes.ts includes facilities)
      const fs = await import('fs');
      const routesContent = fs.readFileSync('../server/routes.ts', 'utf-8');
      const hasFacilitiesRoute = routesContent.includes('facilitiesRoutes') && 
                                 routesContent.includes('/api/facilities');

      this.addResult(
        'API: Routes registration',
        hasFacilitiesRoute,
        hasFacilitiesRoute ? 'Facilities routes registered' : 'Facilities routes not registered'
      );

    } catch (error) {
      this.addResult(
        'API: Endpoint testing',
        false,
        'Failed to test API endpoints',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testOnboardingWizardUpdates() {
    console.log('\n🧙 Testing Onboarding Wizard Updates...');
    
    try {
      const fs = await import('fs');
      const onboardingContent = fs.readFileSync('../client/src/pages/OnboardingWizard.tsx', 'utf-8');
      
      // Check for multi-facility fields
      const hasMultiFacilityFields = onboardingContent.includes('facilitiesPlanned') && 
                                     onboardingContent.includes('multiSiteOperations');
      
      this.addResult(
        'Onboarding: Multi-facility fields',
        hasMultiFacilityFields,
        hasMultiFacilityFields ? 'Multi-facility fields present' : 'Multi-facility fields missing'
      );

      // Check for isPrimary field
      const hasPrimaryField = onboardingContent.includes('isPrimary');
      
      this.addResult(
        'Onboarding: Primary facility field',
        hasPrimaryField,
        hasPrimaryField ? 'Primary facility field present' : 'Primary facility field missing'
      );

    } catch (error) {
      this.addResult(
        'Onboarding: File analysis',
        false,
        'Failed to analyze onboarding wizard',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testAssessmentFacilitySelection() {
    console.log('\n📋 Testing Assessment Facility Selection...');
    
    try {
      const fs = await import('fs');
      const assessmentContent = fs.readFileSync('../client/src/pages/NewAssessment.tsx', 'utf-8');
      
      // Check for facility selection
      const hasFacilitySelection = assessmentContent.includes('selectedFacilityId') && 
                                   assessmentContent.includes('loadFacilities');
      
      this.addResult(
        'Assessment: Facility selection',
        hasFacilitySelection,
        hasFacilitySelection ? 'Facility selection implemented' : 'Facility selection missing'
      );

      // Check for facility interface
      const hasFacilityInterface = assessmentContent.includes('interface Facility');
      
      this.addResult(
        'Assessment: Facility interface',
        hasFacilityInterface,
        hasFacilityInterface ? 'Facility interface defined' : 'Facility interface missing'
      );

    } catch (error) {
      this.addResult(
        'Assessment: File analysis',
        false,
        'Failed to analyze assessment creation',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Phase 1 Multi-Facility Foundation Verification...\n');
    
    await this.testDatabaseSchema();
    await this.testMultiFacilityCreation();
    await this.testFacilityAPI();
    await this.testOnboardingWizardUpdates();
    await this.testAssessmentFacilitySelection();
    
    // Calculate pass rate
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const passRate = (passedTests / totalTests) * 100;
    
    console.log('\n📊 Phase 1 Verification Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Pass Rate: ${passRate.toFixed(1)}%`);
    
    if (passRate >= 95) {
      console.log('✅ Phase 1 verification PASSED - Ready for Phase 2');
      process.exit(0);
    } else {
      console.log('❌ Phase 1 verification FAILED - Fix issues before proceeding');
      
      // Show failed tests
      const failedTests = this.results.filter(r => !r.passed);
      if (failedTests.length > 0) {
        console.log('\n❌ Failed Tests:');
        failedTests.forEach(test => {
          console.log(`   • ${test.testName}: ${test.details}`);
          if (test.error) console.log(`     Error: ${test.error}`);
        });
      }
      
      process.exit(1);
    }
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  const verifier = new Phase1Verifier();
  verifier.runAllTests().catch(console.error);
}

export { Phase1Verifier };
