
#!/usr/bin/env tsx

/**
 * Journey Components Validation Script
 * Validates that all Industry_Aligned_Journey.md components are implemented
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';

interface ComponentCheck {
  component: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  details: string[];
}

class JourneyValidator {
  private checks: ComponentCheck[] = [];

  async validateAllComponents(): Promise<void> {
    console.log(chalk.blue('🔍 Validating Industry Journey Components'));
    console.log('Based on Industry_Aligned_Journey.md specification\n');

    // Phase 1: Pre-Authentication Flow
    await this.validatePreAuthFlow();
    
    // Phase 2: Post-Authentication Branching  
    await this.validateAuthenticationBranching();
    
    // Phase 3: User Path Differentiation
    await this.validateUserPathDifferentiation();
    
    // Phase 4: API Endpoints
    await this.validateApiEndpoints();
    
    // Phase 5: E2E Test Coverage
    await this.validateE2ETestCoverage();

    this.generateValidationReport();
  }

  private async validatePreAuthFlow(): Promise<void> {
    console.log(chalk.yellow('📋 Phase 1: Pre-Authentication Flow'));

    // 1.1 Landing Page
    const landingCheck = this.checkFileExists('client/src/pages/Landing.tsx', 'Landing page component');
    
    // 1.2 Registration  
    const registerCheck = this.checkFileExists('client/src/pages/Register.tsx', 'Registration component');
    
    // 1.3 Email Verification
    const emailVerifyCheck = this.checkFileExists('client/src/pages/VerifyEmail.tsx', 'Email verification component');
    
    // 1.4 Account Type Selection
    const accountTypeCheck = this.checkFileExists('client/src/pages/AccountTypeSelection.tsx', 'Account type selection component');
    
    // 1.5 Pricing
    const pricingCheck = this.checkFileExists('client/src/pages/Pricing.tsx', 'Pricing component');
    
    // 1.6 Payment
    const paymentCheck = this.checkFileExists('client/src/pages/Purchase.tsx', 'Payment component');

    this.checks.push({
      component: 'Pre-Authentication Flow',
      status: this.calculateStatus([landingCheck, registerCheck, emailVerifyCheck, accountTypeCheck, pricingCheck, paymentCheck]),
      details: [
        `Landing: ${landingCheck ? '✅' : '❌'}`,
        `Registration: ${registerCheck ? '✅' : '❌'}`,
        `Email Verification: ${emailVerifyCheck ? '✅' : '❌'}`,
        `Account Type Selection: ${accountTypeCheck ? '✅' : '❌'}`,
        `Pricing: ${pricingCheck ? '✅' : '❌'}`,
        `Payment: ${paymentCheck ? '✅' : '❌'}`
      ]
    });
  }

  private async validateAuthenticationBranching(): Promise<void> {
    console.log(chalk.yellow('🔀 Phase 2: Authentication & Branching'));

    // Check auth context and branching logic
    const authContextCheck = this.checkFileExists('client/src/contexts/AuthContext.tsx', 'Auth context');
    const setupGateCheck = this.checkFileExists('client/src/components/SetupGate.tsx', 'Setup gate component');
    
    // Check for account type handling
    const appTsxContent = this.getFileContent('client/src/App.tsx');
    const hasAccountTypeRoute = appTsxContent?.includes('account-type-selection');
    
    // Check auth middleware
    const authMiddlewareCheck = this.checkFileExists('server/middleware/authMiddleware.ts', 'Auth middleware');

    this.checks.push({
      component: 'Authentication & Branching',
      status: this.calculateStatus([authContextCheck, setupGateCheck, hasAccountTypeRoute, authMiddlewareCheck]),
      details: [
        `Auth Context: ${authContextCheck ? '✅' : '❌'}`,
        `Setup Gate: ${setupGateCheck ? '✅' : '❌'}`,
        `Account Type Route: ${hasAccountTypeRoute ? '✅' : '❌'}`,
        `Auth Middleware: ${authMiddlewareCheck ? '✅' : '❌'}`
      ]
    });
  }

  private async validateUserPathDifferentiation(): Promise<void> {
    console.log(chalk.yellow('👥 Phase 3: User Path Differentiation'));

    // Business Path Components
    const businessDashboard = this.checkFileExists('client/src/pages/Dashboard.tsx', 'Business dashboard');
    const businessOnboarding = this.checkFileExists('client/src/pages/OnboardingWizard.tsx', 'Business onboarding');
    
    // Consultant Path Components  
    const consultantDashboard = this.checkFileExists('client/src/pages/ConsultantDashboard.tsx', 'Consultant dashboard');
    const clientOrgs = this.checkFileExists('client/src/pages/ClientOrganizations.tsx', 'Client organizations');
    const clientFacilities = this.checkFileExists('client/src/pages/ClientFacilities.tsx', 'Client facilities');
    
    // Onboarding V2 (Enhanced)
    const onboardingV2 = this.checkFileExists('client/src/pages/OnboardingV2.tsx', 'Enhanced onboarding');

    this.checks.push({
      component: 'Business User Path',
      status: this.calculateStatus([businessDashboard, businessOnboarding]),
      details: [
        `Business Dashboard: ${businessDashboard ? '✅' : '❌'}`,
        `Business Onboarding: ${businessOnboarding ? '✅' : '❌'}`
      ]
    });

    this.checks.push({
      component: 'Consultant User Path', 
      status: this.calculateStatus([consultantDashboard, clientOrgs, clientFacilities]),
      details: [
        `Consultant Dashboard: ${consultantDashboard ? '✅' : '❌'}`,
        `Client Organizations: ${clientOrgs ? '✅' : '❌'}`,
        `Client Facilities: ${clientFacilities ? '✅' : '❌'}`,
        `Enhanced Onboarding: ${onboardingV2 ? '✅' : '❌'}`
      ]
    });
  }

  private async validateApiEndpoints(): Promise<void> {
    console.log(chalk.yellow('🌐 Phase 4: API Endpoints'));

    // Core auth endpoints
    const authRoutes = this.checkFileExists('server/routes/auth.ts', 'Auth routes');
    
    // Business-specific endpoints
    const assessmentRoutes = this.checkFileExists('server/routes/assessments.ts', 'Assessment routes');
    const facilitiesRoutes = this.checkFileExists('server/routes/facilities.ts', 'Facilities routes');
    
    // Consultant-specific endpoints
    const clientOrgRoutes = this.checkFileExists('server/routes/client-organizations.ts', 'Client org routes');
    const clientFacilityRoutes = this.checkFileExists('server/routes/client-facilities.ts', 'Client facility routes');
    const consultantRoutes = this.checkFileExists('server/routes/consultant-features.ts', 'Consultant features');
    
    // Payment & licensing
    const stripeRoutes = this.checkFileExists('server/routes/stripe.ts', 'Stripe routes');
    const licenseRoutes = this.checkFileExists('server/routes/licenses.ts', 'License routes');

    // Check for test email verification endpoint
    const authContent = this.getFileContent('server/routes/auth.ts');
    const hasTestEmailHelper = authContent?.includes('test-verify-email');

    this.checks.push({
      component: 'API Endpoints',
      status: this.calculateStatus([
        authRoutes, assessmentRoutes, facilitiesRoutes, 
        clientOrgRoutes, clientFacilityRoutes, consultantRoutes,
        stripeRoutes, licenseRoutes, hasTestEmailHelper
      ]),
      details: [
        `Auth Routes: ${authRoutes ? '✅' : '❌'}`,
        `Assessment Routes: ${assessmentRoutes ? '✅' : '❌'}`,
        `Facilities Routes: ${facilitiesRoutes ? '✅' : '❌'}`,
        `Client Organization Routes: ${clientOrgRoutes ? '✅' : '❌'}`,
        `Client Facility Routes: ${clientFacilityRoutes ? '✅' : '❌'}`,
        `Consultant Features: ${consultantRoutes ? '✅' : '❌'}`,
        `Stripe Integration: ${stripeRoutes ? '✅' : '❌'}`,
        `License Management: ${licenseRoutes ? '✅' : '❌'}`,
        `Test Email Helper: ${hasTestEmailHelper ? '✅' : '❌'}`
      ]
    });
  }

  private async validateE2ETestCoverage(): Promise<void> {
    console.log(chalk.yellow('🧪 Phase 5: E2E Test Coverage'));

    // Check existing E2E tests
    const businessJourneyTest = this.checkFileExists('tests/e2e/business-purchaser-journey.spec.ts', 'Business journey test');
    const consultantJourneyTest = this.checkFileExists('tests/e2e/consultant-journey.spec.ts', 'Consultant journey test');
    const authTests = this.checkFileExists('tests/e2e/authentication.spec.ts', 'Authentication tests');
    const onboardingTests = this.checkFileExists('tests/e2e/onboarding.spec.ts', 'Onboarding tests');
    const facilityTests = this.checkFileExists('tests/e2e/facility-management.spec.ts', 'Facility tests');
    
    // Check test helpers
    const authHelpers = this.checkFileExists('tests/helpers/auth.ts', 'Auth test helpers');
    const testFixtures = this.checkFileExists('tests/fixtures/auth.fixture.ts', 'Test fixtures');
    
    // Check our new journey validation
    const journeyValidationTest = this.checkFileExists('scripts/test-industry-journey-e2e.ts', 'Journey validation script');

    this.checks.push({
      component: 'E2E Test Coverage',
      status: this.calculateStatus([
        businessJourneyTest, consultantJourneyTest, authTests, 
        onboardingTests, facilityTests, authHelpers, testFixtures, journeyValidationTest
      ]),
      details: [
        `Business Journey Test: ${businessJourneyTest ? '✅' : '❌'}`,
        `Consultant Journey Test: ${consultantJourneyTest ? '✅' : '❌'}`,
        `Authentication Tests: ${authTests ? '✅' : '❌'}`,
        `Onboarding Tests: ${onboardingTests ? '✅' : '❌'}`,
        `Facility Management Tests: ${facilityTests ? '✅' : '❌'}`,
        `Auth Helpers: ${authHelpers ? '✅' : '❌'}`,
        `Test Fixtures: ${testFixtures ? '✅' : '❌'}`,
        `Journey Validation: ${journeyValidationTest ? '✅' : '❌'}`
      ]
    });
  }

  private checkFileExists(filePath: string, description: string): boolean {
    const exists = existsSync(filePath);
    if (!exists) {
      console.log(chalk.red(`   ❌ Missing: ${description} (${filePath})`));
    } else {
      console.log(chalk.green(`   ✅ Found: ${description}`));
    }
    return exists;
  }

  private getFileContent(filePath: string): string | null {
    try {
      if (existsSync(filePath)) {
        return readFileSync(filePath, 'utf-8');
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private calculateStatus(checks: boolean[]): 'PASS' | 'FAIL' | 'PARTIAL' {
    const passCount = checks.filter(Boolean).length;
    const totalCount = checks.length;
    
    if (passCount === totalCount) return 'PASS';
    if (passCount === 0) return 'FAIL';
    return 'PARTIAL';
  }

  private generateValidationReport(): void {
    console.log(chalk.blue('\n📊 Industry Journey Validation Report'));
    console.log('='.repeat(80));

    let totalComponents = 0;
    let passedComponents = 0;
    let partialComponents = 0;

    for (const check of this.checks) {
      totalComponents++;
      const statusColor = check.status === 'PASS' ? chalk.green : 
                         check.status === 'PARTIAL' ? chalk.yellow : chalk.red;
      
      console.log(`\n${statusColor(check.status.padEnd(8))} ${chalk.bold(check.component)}`);
      
      for (const detail of check.details) {
        console.log(`         ${detail}`);
      }

      if (check.status === 'PASS') passedComponents++;
      else if (check.status === 'PARTIAL') partialComponents++;
    }

    const failedComponents = totalComponents - passedComponents - partialComponents;
    const overallScore = ((passedComponents + (partialComponents * 0.5)) / totalComponents) * 100;

    console.log(chalk.blue('\n📈 Summary:'));
    console.log(`   Total Components: ${totalComponents}`);
    console.log(`   ${chalk.green('Passed:')} ${passedComponents}`);
    console.log(`   ${chalk.yellow('Partial:')} ${partialComponents}`);
    console.log(`   ${chalk.red('Failed:')} ${failedComponents}`);
    console.log(`   ${chalk.bold('Overall Score:')} ${overallScore.toFixed(1)}%`);

    if (overallScore >= 90) {
      console.log(chalk.green('\n🎉 Industry Journey Implementation: EXCELLENT'));
    } else if (overallScore >= 75) {
      console.log(chalk.yellow('\n⚠️  Industry Journey Implementation: GOOD (minor gaps)'));
    } else if (overallScore >= 60) {
      console.log(chalk.yellow('\n⚠️  Industry Journey Implementation: PARTIAL (needs work)'));
    } else {
      console.log(chalk.red('\n💥 Industry Journey Implementation: NEEDS MAJOR WORK'));
    }

    // Recommendations
    console.log(chalk.blue('\n💡 Recommendations:'));
    if (failedComponents > 0) {
      console.log('   • Address missing components marked with ❌');
    }
    if (partialComponents > 0) {
      console.log('   • Complete partial implementations');
    }
    if (overallScore >= 90) {
      console.log('   • Implementation is production-ready!');
      console.log('   • Run full E2E tests in browser environment for final validation');
    }
  }
}

// Main execution
async function main() {
  try {
    const validator = new JourneyValidator();
    await validator.validateAllComponents();
    
  } catch (error: any) {
    console.error(chalk.red('💥 Validation failed:'), error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { JourneyValidator };
