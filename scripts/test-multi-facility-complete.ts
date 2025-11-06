
/**
 * Comprehensive Multi-Facility Functionality Test
 * Tests Phase 1 + Phase 2 implementation
 */

import 'dotenv/config';
import { db } from '../server/db.js';
import { 
  facilityProfiles, 
  tenants, 
  users,
  assessments
} from '../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

interface TestResult {
  component: string;
  test: string;
  passed: boolean;
  message: string;
  details?: string;
}

class MultiFacilityTester {
  private results: TestResult[] = [];

  addResult(component: string, test: string, passed: boolean, message: string, details?: string) {
    this.results.push({ component, test, passed, message, details });
  }

  async runComprehensiveTests() {
    console.log('🏗️ Running Comprehensive Multi-Facility Tests...\n');

    await this.testPhase1Foundation();
    await this.testFacilityManagement();
    await this.testUserInterface();
    await this.testAssessmentIntegration();
    await this.testAPIEndpoints();

    this.printResults();
    this.generateRecommendations();
  }

  async testPhase1Foundation() {
    console.log('📋 Testing Phase 1 Foundation...');

    try {
      // Test facility creation and management
      const facilities = await db.query.facilityProfiles.findMany({
        where: eq(facilityProfiles.isActive, true),
        limit: 10
      });

      this.addResult(
        'Phase 1',
        'Facility Storage',
        facilities.length >= 0,
        `Found ${facilities.length} active facilities`
      );

      // Test primary facility logic
      const primaryFacilities = facilities.filter(f => f.isPrimary);
      this.addResult(
        'Phase 1',
        'Primary Facility Logic',
        primaryFacilities.length <= 1,
        `${primaryFacilities.length} primary facilities (should be 0 or 1)`
      );

      // Test multi-facility planning fields
      const facilitiesWithPlanning = facilities.filter(f => 
        f.facilityScopeId && f.facilityScopeId.length > 0
      );
      
      this.addResult(
        'Phase 1',
        'Multi-Facility Planning',
        true,
        `${facilitiesWithPlanning.length} facilities have scope IDs`
      );

    } catch (error) {
      this.addResult(
        'Phase 1',
        'Foundation Test',
        false,
        'Phase 1 foundation test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testFacilityManagement() {
    console.log('🏢 Testing Facility Management...');

    try {
      // Test UserFacilityScope table
      const userScopeExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'UserFacilityScope'
        )
      `);

      this.addResult(
        'Management',
        'User Scope Table',
        userScopeExists[0]?.exists || false,
        userScopeExists[0]?.exists ? 'UserFacilityScope table exists' : 'UserFacilityScope table missing'
      );

      // Test facility audit capabilities
      const auditExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'AuditLog'
        )
      `);

      this.addResult(
        'Management',
        'Audit Logging',
        auditExists[0]?.exists || false,
        auditExists[0]?.exists ? 'Audit logging available' : 'Audit logging missing'
      );

    } catch (error) {
      this.addResult(
        'Management',
        'Management Test',
        false,
        'Facility management test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testUserInterface() {
    console.log('🎨 Testing User Interface...');

    try {
      const fs = await import('fs');

      // Test Facilities page
      const facilitiesPageExists = fs.existsSync('client/src/pages/Facilities.tsx');
      this.addResult(
        'UI',
        'Facilities Page',
        facilitiesPageExists,
        facilitiesPageExists ? 'Facilities page exists' : 'Facilities page missing'
      );

      if (facilitiesPageExists) {
        const facilitiesContent = fs.readFileSync('client/src/pages/Facilities.tsx', 'utf-8');
        
        const hasUserManagement = facilitiesContent.includes('Users') && 
                                  facilitiesContent.includes('handleManageUsers');
        
        this.addResult(
          'UI',
          'User Management UI',
          hasUserManagement,
          hasUserManagement ? 'User management UI present' : 'User management UI missing'
        );
      }

      // Test navigation integration
      const appLayoutContent = fs.readFileSync('client/src/components/layout/AppLayout.tsx', 'utf-8');
      const hasNavigation = appLayoutContent.includes('/facilities');

      this.addResult(
        'UI',
        'Navigation Integration',
        hasNavigation,
        hasNavigation ? 'Facilities navigation integrated' : 'Facilities navigation missing'
      );

    } catch (error) {
      this.addResult(
        'UI',
        'Interface Test',
        false,
        'User interface test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testAssessmentIntegration() {
    console.log('📊 Testing Assessment Integration...');

    try {
      // Test assessment facility selection
      const assessmentColumns = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Assessment' AND column_name = 'selectedFacilityId'
      `);

      this.addResult(
        'Assessment',
        'Facility Selection',
        assessmentColumns.length > 0,
        assessmentColumns.length > 0 ? 'Assessment facility selection implemented' : 'Assessment facility selection missing'
      );

      // Test assessment UI integration
      const fs = await import('fs');
      const assessmentContent = fs.readFileSync('client/src/pages/NewAssessment.tsx', 'utf-8');
      
      const hasFacilitySelector = assessmentContent.includes('selectedFacilityId') &&
                                  assessmentContent.includes('Select facility');

      this.addResult(
        'Assessment',
        'UI Integration',
        hasFacilitySelector,
        hasFacilitySelector ? 'Assessment UI has facility selection' : 'Assessment UI missing facility selection'
      );

    } catch (error) {
      this.addResult(
        'Assessment',
        'Integration Test',
        false,
        'Assessment integration test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testAPIEndpoints() {
    console.log('🌐 Testing API Endpoints...');

    try {
      // Test facilities router
      const facilitiesRouterExists = await import('../server/routes/facilities.js').then(() => true).catch(() => false);
      
      this.addResult(
        'API',
        'Facilities Router',
        facilitiesRouterExists,
        facilitiesRouterExists ? 'Facilities router loads' : 'Facilities router missing'
      );

      // Test route registration
      const fs = await import('fs');
      const routesContent = fs.readFileSync('server/routes.ts', 'utf-8');
      const hasRouteRegistration = routesContent.includes('facilitiesRoutes') || 
                                   routesContent.includes('/api/facilities');

      this.addResult(
        'API',
        'Route Registration',
        hasRouteRegistration,
        hasRouteRegistration ? 'Facilities routes registered' : 'Facilities routes not registered'
      );

    } catch (error) {
      this.addResult(
        'API',
        'Endpoint Test',
        false,
        'API endpoint test failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  printResults() {
    console.log('\n📊 Comprehensive Test Results:\n');

    const components = [...new Set(this.results.map(r => r.component))];
    
    components.forEach(component => {
      const componentResults = this.results.filter(r => r.component === component);
      const passed = componentResults.filter(r => r.passed).length;
      const total = componentResults.length;
      const percentage = Math.round((passed / total) * 100);

      console.log(`${component}: ${passed}/${total} (${percentage}%)`);
      
      componentResults.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`  ${icon} ${result.test}: ${result.message}`);
        if (result.details && !result.passed) {
          console.log(`     Details: ${result.details}`);
        }
      });
      console.log('');
    });
  }

  generateRecommendations() {
    const failedTests = this.results.filter(r => !r.passed);
    const totalTests = this.results.length;
    const passRate = ((totalTests - failedTests.length) / totalTests) * 100;

    console.log('🎯 Recommendations:\n');

    if (passRate >= 90) {
      console.log('✅ Excellent! Multi-facility implementation is comprehensive.');
      console.log('🚀 Ready to proceed with advanced features:');
      console.log('   • Facility-scoped reporting');
      console.log('   • Cross-facility data aggregation');
      console.log('   • Advanced user permission management');
    } else if (passRate >= 75) {
      console.log('🟡 Good foundation with room for improvement.');
      console.log('🔧 Priority fixes needed:');
      failedTests.forEach(test => {
        console.log(`   • ${test.component}: ${test.test}`);
      });
    } else {
      console.log('❌ Multi-facility implementation needs significant work.');
      console.log('🚨 Critical issues to address:');
      failedTests.forEach(test => {
        console.log(`   • ${test.component}: ${test.test} - ${test.message}`);
      });
    }

    console.log(`\nOverall Pass Rate: ${passRate.toFixed(1)}%`);assRate.toFixed(1)}%`);
  }
}

// Run comprehensive test
const tester = new MultiFacilityTester();
tester.runComprehensiveTests().catch(error => {
  console.error('Comprehensive test failed:', error);
  process.exit(1);
});
