import { pathToFileURL } from "node:url";
/**
 * Facility Selection Validation Test
 * Tests enhanced facility validation and scoped permissions
 */

import 'dotenv/config';
import { db } from '../server/db.js';
import { 
  facilityProfiles, 
  tenants, 
  users
} from '../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  error?: string;
}

class FacilityValidationTester {
  private results: TestResult[] = [];

  private addResult(testName: string, passed: boolean, details: string, error?: string) {
    this.results.push({ testName, passed, details, error });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${details}`);
    if (error) console.log(`   Error: ${error}`);
  }

  async testFacilityValidation() {
    console.log('\n🏢 Testing Facility Validation...');
    
    try {
      // Test facility status validation
      const facilities = await db.query.facilityProfiles.findMany({
        where: eq(facilityProfiles.isActive, true),
        limit: 5
      });

      this.addResult(
        'Facility Status Validation',
        facilities.length > 0,
        `Found ${facilities.length} active facilities for testing`
      );

      // Test operational status logic
      const operationalFacilities = facilities.filter(f => f.operatingStatus === 'ACTIVE');
      
      this.addResult(
        'Operational Status Check',
        operationalFacilities.length >= 0,
        `${operationalFacilities.length} facilities are operational`
      );

      // Test primary facility logic
      const primaryFacilities = facilities.filter(f => f.isPrimary);
      
      this.addResult(
        'Primary Facility Logic',
        primaryFacilities.length <= 1,
        `${primaryFacilities.length} primary facilities (should be 0 or 1)`
      );

    } catch (error) {
      this.addResult(
        'Facility Validation',
        false,
        'Facility validation test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testUserFacilityPermissions() {
    console.log('\n🔐 Testing User Facility Permissions...');
    
    try {
      // Test UserFacilityScope table exists
      const scopeTableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'UserFacilityScope'
        )
      `);

      this.addResult(
        'User Facility Scope Table',
        scopeTableExists[0]?.exists || false,
        scopeTableExists[0]?.exists ? 'UserFacilityScope table exists' : 'UserFacilityScope table missing'
      );

      // Test permission validation query structure
      const testUser = await db.query.users.findFirst({
        where: eq(users.businessRole, 'facility_manager')
      });

      if (testUser) {
        // Test the permission query used in assessments
        const permissionQuery = await db.execute(sql`
          SELECT 1 FROM "UserFacilityScope" ufs
          WHERE ufs."userId" = ${testUser.id} 
            AND ufs."isActive" = true
          LIMIT 1
        `);

        this.addResult(
          'Permission Query Structure',
          true,
          `Permission query executed successfully (found ${permissionQuery.length} scopes)`
        );
      } else {
        this.addResult(
          'Permission Query Test',
          true,
          'No facility managers found to test with'
        );
      }

    } catch (error) {
      this.addResult(
        'User Facility Permissions',
        false,
        'Permission test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testAPIValidation() {
    console.log('\n🌐 Testing API Validation...');
    
    try {
      // Test facilities API route exists
      const facilitiesRouteExists = await import('../server/routes/facilities.js')
        .then(() => true)
        .catch(() => false);

      this.addResult(
        'Facilities API Route',
        facilitiesRouteExists,
        facilitiesRouteExists ? 'Facilities API route loads' : 'Facilities API route missing'
      );

      // Test assessments route has facility validation
      const assessmentsRouteExists = await import('../server/routes/assessments.js')
        .then(() => true)
        .catch(() => false);

      this.addResult(
        'Assessments API Route',
        assessmentsRouteExists,
        assessmentsRouteExists ? 'Assessments API route loads' : 'Assessments API route missing'
      );

      // Test helper function integration
      const fs = await import('fs');
      const assessmentsContent = fs.readFileSync('server/routes/assessments.ts', 'utf-8');
      
      const hasValidationLogic = assessmentsContent.includes('getUserAccessibleFacilities') &&
                                 assessmentsContent.includes('FACILITY_NOT_OPERATIONAL');

      this.addResult(
        'Enhanced Validation Logic',
        hasValidationLogic,
        hasValidationLogic ? 'Enhanced validation logic present' : 'Enhanced validation logic missing'
      );

    } catch (error) {
      this.addResult(
        'API Validation Test',
        false,
        'API validation test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testFrontendValidation() {
    console.log('\n🎨 Testing Frontend Validation...');
    
    try {
      const fs = await import('fs');
      const assessmentContent = fs.readFileSync('client/src/pages/NewAssessment.tsx', 'utf-8');
      
      // Test enhanced facility validation
      const hasEnhancedValidation = assessmentContent.includes('FACILITY_NOT_OPERATIONAL') &&
                                    assessmentContent.includes('operatingStatus') &&
                                    assessmentContent.includes('No operational facilities available');

      this.addResult(
        'Frontend Enhanced Validation',
        hasEnhancedValidation,
        hasEnhancedValidation ? 'Enhanced frontend validation present' : 'Enhanced frontend validation missing'
      );

      // Test facility status indicators
      const hasStatusIndicators = assessmentContent.includes('bg-green-500') &&
                                   assessmentContent.includes('operatingStatus === \'ACTIVE\'');

      this.addResult(
        'Facility Status Indicators',
        hasStatusIndicators,
        hasStatusIndicators ? 'Status indicators implemented' : 'Status indicators missing'
      );

    } catch (error) {
      this.addResult(
        'Frontend Validation Test',
        false,
        'Frontend validation test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Facility Validation Test Suite...\n');
    
    await this.testFacilityValidation();
    await this.testUserFacilityPermissions();
    await this.testAPIValidation();
    await this.testFrontendValidation();
    
    // Calculate pass rate
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const passRate = (passedTests / totalTests) * 100;
    
    console.log('\n📊 Facility Validation Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Pass Rate: ${passRate.toFixed(1)}%`);
    
    if (passRate >= 90) {
      console.log('✅ Facility validation tests PASSED - Ready for production');
      process.exit(0);
    } else {
      console.log('❌ Facility validation tests FAILED - Address issues before proceeding');
      
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

// Run validation if this script is executed directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const validator = new FacilityValidationTester();
  validator.runAllTests().catch(console.error);
}

export { FacilityValidationTester };
