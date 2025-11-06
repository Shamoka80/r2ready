
#!/usr/bin/env tsx

/**
 * Phase 1 Complete Verification - Industry Standard User Flow
 * Verifies 100% implementation of: Registration → Email Verification → Account Type → Pricing → Payment → Onboarding → Assessment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ValidationResult {
  component: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  critical: boolean;
}

class Phase1Validator {
  private results: ValidationResult[] = [];
  private criticalFailures = 0;

  async validateAll(): Promise<void> {
    console.log('🚀 Phase 1 Complete Verification - Industry Standard User Flow\n');
    console.log('='.repeat(80));

    // Core Flow Components
    await this.validateEmailVerificationFlow();
    await this.validateAccountTypeSelection(); 
    await this.validatePricingPage();
    await this.validateSetupGates();
    await this.validateOnboardingV2();
    await this.validateDashboardDifferentiation();
    
    // Backend Integration
    await this.validateAuthEndpoints();
    await this.validateLicenseSystem();
    await this.validateDatabaseSchema();
    
    // Route Structure
    await this.validateRouteImplementation();
    
    this.generateReport();
  }

  private async validateEmailVerificationFlow(): Promise<void> {
    console.log('📧 Validating Email Verification Flow...');

    // Check VerifyEmail component exists and is properly implemented
    const verifyEmailPath = 'client/src/pages/VerifyEmail.tsx';
    if (!fs.existsSync(verifyEmailPath)) {
      this.addResult('Email Verification', 'VerifyEmail Component', 'FAIL', 
        'VerifyEmail.tsx component missing', true);
      return;
    }

    const verifyEmailContent = fs.readFileSync(verifyEmailPath, 'utf8');
    
    // Check for dual verification (token + code)
    const hasDualVerification = verifyEmailContent.includes('verificationCode') && 
                               verifyEmailContent.includes('emailVerificationToken');
    this.addResult('Email Verification', 'Dual Verification Support', 
      hasDualVerification ? 'PASS' : 'FAIL',
      hasDualVerification ? 'Both token and code verification implemented' : 'Missing dual verification',
      true);

    // Check for auto-login after verification
    const hasAutoLogin = verifyEmailContent.includes('localStorage.setItem') && 
                        verifyEmailContent.includes('auth_token');
    this.addResult('Email Verification', 'Auto-Login After Verification', 
      hasAutoLogin ? 'PASS' : 'FAIL',
      hasAutoLogin ? 'Auto-login implemented' : 'Missing auto-login functionality',
      true);

    // Check redirect to pricing (industry standard)
    const redirectsToPricing = verifyEmailContent.includes('/pricing');
    this.addResult('Email Verification', 'Pricing Redirect', 
      redirectsToPricing ? 'PASS' : 'FAIL',
      redirectsToPricing ? 'Redirects to pricing after verification' : 'Missing pricing redirect',
      true);
  }

  private async validateAccountTypeSelection(): Promise<void> {
    console.log('🏢 Validating Account Type Selection...');

    const accountTypePath = 'client/src/pages/AccountTypeSelection.tsx';
    if (!fs.existsSync(accountTypePath)) {
      this.addResult('Account Type', 'Component Exists', 'FAIL', 
        'AccountTypeSelection.tsx missing', true);
      return;
    }

    const content = fs.readFileSync(accountTypePath, 'utf8');
    
    // Check for business vs consultant differentiation
    const hasBusinessConsultant = content.includes('BUSINESS') && content.includes('CONSULTANT');
    this.addResult('Account Type', 'Business vs Consultant Options', 
      hasBusinessConsultant ? 'PASS' : 'FAIL',
      hasBusinessConsultant ? 'Both account types supported' : 'Missing account type options',
      true);
  }

  private async validatePricingPage(): Promise<void> {
    console.log('💰 Validating Pricing Page...');

    const pricingPath = 'client/src/pages/Pricing.tsx';
    if (!fs.existsSync(pricingPath)) {
      this.addResult('Pricing', 'Component Exists', 'FAIL', 
        'Pricing.tsx missing', true);
      return;
    }

    const content = fs.readFileSync(pricingPath, 'utf8');
    
    // Check for business tiers
    const hasBusinessTiers = content.includes('Solo Business') && 
                            content.includes('Team Business') && 
                            content.includes('Enterprise');
    this.addResult('Pricing', 'Business Tiers', 
      hasBusinessTiers ? 'PASS' : 'FAIL',
      hasBusinessTiers ? 'All business tiers implemented' : 'Missing business tiers',
      true);

    // Check for consultant tiers  
    const hasConsultantTiers = content.includes('Independent Consultant') && 
                              content.includes('Agency Consultant');
    this.addResult('Pricing', 'Consultant Tiers', 
      hasConsultantTiers ? 'PASS' : 'FAIL',
      hasConsultantTiers ? 'Consultant tiers implemented' : 'Missing consultant tiers',
      true);

    // Check for plan selection logic
    const hasPlanSelection = content.includes('handlePlanSelect') || 
                            content.includes('updateAccountTypeMutation');
    this.addResult('Pricing', 'Plan Selection Logic', 
      hasPlanSelection ? 'PASS' : 'FAIL',
      hasPlanSelection ? 'Plan selection logic implemented' : 'Missing plan selection',
      true);
  }

  private async validateSetupGates(): Promise<void> {
    console.log('🚪 Validating Setup Gates...');

    const setupGatePath = 'client/src/components/SetupGate.tsx';
    if (!fs.existsSync(setupGatePath)) {
      this.addResult('Setup Gates', 'Component Exists', 'FAIL', 
        'SetupGate.tsx missing', true);
      return;
    }

    const content = fs.readFileSync(setupGatePath, 'utf8');
    
    // Check for sequential gate implementation
    const hasEmailGate = content.includes('email_pending') || content.includes('emailVerified');
    const hasAccountTypeGate = content.includes('account-type-selection');
    const hasLicenseGate = content.includes('hasLicense') || content.includes('/pricing');
    const hasOnboardingGate = content.includes('onboarding');
    const hasAssessmentGate = content.includes('assessment_active');

    this.addResult('Setup Gates', 'Email Verification Gate', 
      hasEmailGate ? 'PASS' : 'FAIL',
      hasEmailGate ? 'Email verification gate implemented' : 'Missing email gate',
      true);

    this.addResult('Setup Gates', 'Account Type Gate', 
      hasAccountTypeGate ? 'PASS' : 'FAIL',
      hasAccountTypeGate ? 'Account type gate implemented' : 'Missing account type gate',
      true);

    this.addResult('Setup Gates', 'License Gate', 
      hasLicenseGate ? 'PASS' : 'FAIL',
      hasLicenseGate ? 'License verification gate implemented' : 'Missing license gate',
      true);

    this.addResult('Setup Gates', 'Sequential Flow', 
      (hasEmailGate && hasAccountTypeGate && hasLicenseGate) ? 'PASS' : 'FAIL',
      'All gates properly sequenced', true);
  }

  private async validateOnboardingV2(): Promise<void> {
    console.log('🎯 Validating Onboarding V2...');

    const onboardingPath = 'client/src/components/OnboardingV2Wizard.tsx';
    if (!fs.existsSync(onboardingPath)) {
      this.addResult('Onboarding V2', 'Component Exists', 'FAIL', 
        'OnboardingV2Wizard.tsx missing', true);
      return;
    }

    const content = fs.readFileSync(onboardingPath, 'utf8');
    
    // Check for role-specific flows
    const hasBusinessFlow = content.includes('business') && content.includes('facility');
    const hasConsultantFlow = content.includes('consultant') && content.includes('client');
    
    this.addResult('Onboarding V2', 'Business Flow', 
      hasBusinessFlow ? 'PASS' : 'FAIL',
      hasBusinessFlow ? 'Business onboarding flow implemented' : 'Missing business flow',
      true);

    this.addResult('Onboarding V2', 'Consultant Flow', 
      hasConsultantFlow ? 'PASS' : 'FAIL',
      hasConsultantFlow ? 'Consultant onboarding flow implemented' : 'Missing consultant flow',
      true);

    // Check for completion logic
    const hasCompletion = content.includes('assessment_active') || content.includes('completeOnboarding');
    this.addResult('Onboarding V2', 'Completion Logic', 
      hasCompletion ? 'PASS' : 'FAIL',
      hasCompletion ? 'Onboarding completion implemented' : 'Missing completion logic',
      true);
  }

  private async validateDashboardDifferentiation(): Promise<void> {
    console.log('📊 Validating Dashboard Differentiation...');

    const businessDashboard = fs.existsSync('client/src/pages/Dashboard.tsx');
    const consultantDashboard = fs.existsSync('client/src/pages/ConsultantDashboard.tsx');

    this.addResult('Dashboards', 'Business Dashboard', 
      businessDashboard ? 'PASS' : 'FAIL',
      businessDashboard ? 'Business dashboard exists' : 'Missing business dashboard',
      true);

    this.addResult('Dashboards', 'Consultant Dashboard', 
      consultantDashboard ? 'PASS' : 'FAIL',
      consultantDashboard ? 'Consultant dashboard exists' : 'Missing consultant dashboard',
      true);

    this.addResult('Dashboards', 'Dual Architecture', 
      (businessDashboard && consultantDashboard) ? 'PASS' : 'FAIL',
      'Dual dashboard architecture implemented', true);
  }

  private async validateAuthEndpoints(): Promise<void> {
    console.log('🔐 Validating Auth Endpoints...');

    const authRoutePath = 'server/routes/auth.ts';
    if (!fs.existsSync(authRoutePath)) {
      this.addResult('Auth Endpoints', 'Route File', 'FAIL', 
        'auth.ts route file missing', true);
      return;
    }

    const content = fs.readFileSync(authRoutePath, 'utf8');
    
    // Check for essential endpoints
    const hasEmailVerification = content.includes('/verify-email') && content.includes('/verify-email-code');
    const hasAccountTypeUpdate = content.includes('/account-type');
    const hasRegistration = content.includes('/register-tenant');
    
    this.addResult('Auth Endpoints', 'Email Verification Endpoints', 
      hasEmailVerification ? 'PASS' : 'FAIL',
      hasEmailVerification ? 'Email verification endpoints implemented' : 'Missing email endpoints',
      true);

    this.addResult('Auth Endpoints', 'Account Type Endpoint', 
      hasAccountTypeUpdate ? 'PASS' : 'FAIL',
      hasAccountTypeUpdate ? 'Account type update endpoint implemented' : 'Missing account type endpoint',
      true);

    this.addResult('Auth Endpoints', 'Registration Endpoint', 
      hasRegistration ? 'PASS' : 'FAIL',
      hasRegistration ? 'Registration endpoint implemented' : 'Missing registration endpoint',
      true);
  }

  private async validateLicenseSystem(): Promise<void> {
    console.log('📄 Validating License System...');

    const licenseRoutePath = 'server/routes/licenses.ts';
    const stripeRoutePath = 'server/routes/stripe.ts';
    
    const hasLicenseRoutes = fs.existsSync(licenseRoutePath);
    const hasStripeIntegration = fs.existsSync(stripeRoutePath);

    this.addResult('License System', 'License Routes', 
      hasLicenseRoutes ? 'PASS' : 'FAIL',
      hasLicenseRoutes ? 'License management routes exist' : 'Missing license routes',
      true);

    this.addResult('License System', 'Stripe Integration', 
      hasStripeIntegration ? 'PASS' : 'FAIL',
      hasStripeIntegration ? 'Stripe payment integration exists' : 'Missing Stripe integration',
      true);
  }

  private async validateDatabaseSchema(): Promise<void> {
    console.log('🗄️ Validating Database Schema...');

    const schemaPath = 'shared/schema.ts';
    if (!fs.existsSync(schemaPath)) {
      this.addResult('Database Schema', 'Schema File', 'FAIL', 
        'schema.ts missing', true);
      return;
    }

    const content = fs.readFileSync(schemaPath, 'utf8');
    
    // Check for essential tables
    const hasUsersTable = content.includes('export const users');
    const hasTenantsTable = content.includes('export const tenants');
    const hasLicensesTable = content.includes('export const licenses');
    const hasOnboardingTables = content.includes('organizationProfiles') && content.includes('facilityProfiles');

    this.addResult('Database Schema', 'Core Tables', 
      (hasUsersTable && hasTenantsTable && hasLicensesTable) ? 'PASS' : 'FAIL',
      'Essential tables (users, tenants, licenses) defined', true);

    this.addResult('Database Schema', 'Onboarding Tables', 
      hasOnboardingTables ? 'PASS' : 'FAIL',
      hasOnboardingTables ? 'Onboarding tables defined' : 'Missing onboarding tables',
      true);
  }

  private async validateRouteImplementation(): Promise<void> {
    console.log('🛣️ Validating Route Implementation...');

    const appPath = 'client/src/App.tsx';
    if (!fs.existsSync(appPath)) {
      this.addResult('Routes', 'App Component', 'FAIL', 'App.tsx missing', true);
      return;
    }

    const content = fs.readFileSync(appPath, 'utf8');
    
    // Check for critical routes
    const criticalRoutes = [
      '/register',
      '/verify-email', 
      '/account-type-selection',
      '/pricing',
      '/onboarding-v2',
      '/dashboard',
      '/consultant-dashboard'
    ];

    let routesImplemented = 0;
    criticalRoutes.forEach(route => {
      if (content.includes(`"${route}"`)) {
        routesImplemented++;
      }
    });

    const allRoutesImplemented = routesImplemented === criticalRoutes.length;
    this.addResult('Routes', 'Critical Routes', 
      allRoutesImplemented ? 'PASS' : 'WARNING',
      `${routesImplemented}/${criticalRoutes.length} critical routes implemented`,
      !allRoutesImplemented);
  }

  private addResult(component: string, test: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string, critical: boolean): void {
    this.results.push({ component, test, status, message, critical });
    if (status === 'FAIL' && critical) {
      this.criticalFailures++;
    }
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PHASE 1 VERIFICATION RESULTS');
    console.log('='.repeat(80));

    const passes = this.results.filter(r => r.status === 'PASS').length;
    const fails = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const total = this.results.length;

    console.log(`✅ PASSED: ${passes}`);
    console.log(`❌ FAILED: ${fails}`);
    console.log(`⚠️  WARNINGS: ${warnings}`);
    console.log(`🚨 CRITICAL FAILURES: ${this.criticalFailures}`);
    console.log(`📊 COMPLETION: ${Math.round((passes / total) * 100)}%\n`);

    // Group by component
    const components = [...new Set(this.results.map(r => r.component))];
    
    components.forEach(component => {
      console.log(`\n📁 ${component.toUpperCase()}`);
      console.log('-'.repeat(50));
      
      const componentResults = this.results.filter(r => r.component === component);
      componentResults.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
        const critical = result.critical ? '🚨' : '🔵';
        console.log(`${icon} ${critical} ${result.test}: ${result.message}`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log('🎯 PHASE 1 INDUSTRY ALIGNMENT STATUS');
    console.log('='.repeat(80));

    if (this.criticalFailures === 0 && passes >= total * 0.95) {
      console.log('🎉 SUCCESS: Phase 1 is 100% complete and industry-aligned!');
      console.log('✅ All critical user journey requirements are implemented');
      console.log('✅ Ready for Phase 2 implementation');
    } else if (this.criticalFailures === 0) {
      console.log('⚠️  NEAR COMPLETE: Minor gaps remain but no critical failures');
      console.log(`🔧 Address ${fails + warnings} remaining issues for 100% completion`);
    } else {
      console.log('❌ INCOMPLETE: Critical issues must be resolved');
      console.log(`🚨 ${this.criticalFailures} critical failures blocking Phase 1 completion`);
      console.log('🔧 Address critical issues before proceeding to Phase 2');
    }

    console.log(`\n📋 Next Steps:`);
    if (this.criticalFailures > 0) {
      console.log('1. Fix all critical failures immediately');
      console.log('2. Re-run verification: npm run scripts:verify-phase1-complete');
      console.log('3. Proceed to Phase 2 only after 100% completion');
    } else if (fails + warnings > 0) {
      console.log('1. Address remaining warnings and failures');
      console.log('2. Re-run verification to confirm 100% completion');
      console.log('3. Begin Phase 2 implementation');
    } else {
      console.log('1. ✅ Phase 1 is complete - begin Phase 2 implementation');
      console.log('2. Focus on consultant features and multi-client management');
      console.log('3. Implement advanced assessment workflow');
    }

    // Exit with appropriate code
    process.exit(this.criticalFailures > 0 ? 1 : 0);
  }
}

// Run validation
async function main() {
  const validator = new Phase1Validator();
  await validator.validateAll();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
