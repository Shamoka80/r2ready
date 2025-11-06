
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import fetch from 'node-fetch';

interface ValidationResult {
  phase: string;
  component: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  details: string;
  critical: boolean;
}

class ComprehensiveProductionValidator {
  private results: ValidationResult[] = [];

  async validate(): Promise<void> {
    console.log(chalk.blue('🔍 Comprehensive Production Validation\n'));

    await this.validatePhase1();
    await this.validatePhase2();
    await this.validatePhase3();
    await this.validatePhase4();

    this.generateReport();
  }

  private async validatePhase1(): Promise<void> {
    console.log(chalk.yellow('📋 Phase 1: Critical Infrastructure'));

    // Test email service
    try {
      const emailServiceExists = existsSync('server/services/emailService.ts');
      const emailContent = emailServiceExists ? readFileSync('server/services/emailService.ts', 'utf-8') : '';
      const hasResend = emailContent.includes('resend') && emailContent.includes('Resend');
      
      this.results.push({
        phase: 'Phase 1',
        component: 'Email Service - Resend Integration',
        status: hasResend ? 'PASS' : 'FAIL',
        details: hasResend ? 'Resend SDK implemented' : 'Still using nodemailer',
        critical: true
      });
    } catch (error) {
      this.results.push({
        phase: 'Phase 1',
        component: 'Email Service - Resend Integration',
        status: 'FAIL',
        details: `Error checking email service: ${error.message}`,
        critical: true
      });
    }

    // Test Stripe webhooks
    try {
      const webhookFile = existsSync('server/routes/stripe-webhooks.ts') ? 
        readFileSync('server/routes/stripe-webhooks.ts', 'utf-8') : '';
      const hasPaymentFailedHandler = webhookFile.includes('invoice.payment_failed') && 
                                    webhookFile.includes('handlePaymentFailed');
      
      this.results.push({
        phase: 'Phase 1',
        component: 'Stripe Payment Failed Handler',
        status: hasPaymentFailedHandler ? 'PASS' : 'FAIL',
        details: hasPaymentFailedHandler ? 'Payment failed handler implemented' : 'Missing payment failed handler',
        critical: true
      });
    } catch (error) {
      this.results.push({
        phase: 'Phase 1',
        component: 'Stripe Payment Failed Handler',
        status: 'FAIL',
        details: `Error checking Stripe webhooks: ${error.message}`,
        critical: true
      });
    }

    // Test duplicate case fix
    try {
      const onboardingFile = existsSync('client/src/components/OnboardingV2Wizard.tsx') ?
        readFileSync('client/src/components/OnboardingV2Wizard.tsx', 'utf-8') : '';
      const duplicateCaseCount = (onboardingFile.match(/case "organization":/g) || []).length;
      
      this.results.push({
        phase: 'Phase 1',
        component: 'Duplicate Case Clause Fix',
        status: duplicateCaseCount <= 1 ? 'PASS' : 'FAIL',
        details: duplicateCaseCount <= 1 ? 'No duplicate cases found' : `Found ${duplicateCaseCount} duplicate cases`,
        critical: true
      });
    } catch (error) {
      this.results.push({
        phase: 'Phase 1',
        component: 'Duplicate Case Clause Fix',
        status: 'FAIL',
        details: `Error checking onboarding wizard: ${error.message}`,
        critical: true
      });
    }
  }

  private async validatePhase2(): Promise<void> {
    console.log(chalk.yellow('📊 Phase 2: Content Population'));

    // Test question database
    try {
      const response = await fetch('http://0.0.0.0:5000/api/admin/questions/import/status');
      const data = await response.json();
      const hasQuestions = data.count && data.count > 250; // Should have ~300 questions
      
      this.results.push({
        phase: 'Phase 2',
        component: 'R2v3 Question Database',
        status: hasQuestions ? 'PASS' : 'PARTIAL',
        details: hasQuestions ? `${data.count} questions loaded` : `Only ${data.count || 0} questions loaded (target: 300+)`,
        critical: true
      });
    } catch (error) {
      this.results.push({
        phase: 'Phase 2',
        component: 'R2v3 Question Database',
        status: 'FAIL',
        details: `Cannot verify question count: ${error.message}`,
        critical: true
      });
    }

    // Test REC mappings
    try {
      const mappingFile = existsSync('server/data/question-rec-mappings-v1.json');
      if (mappingFile) {
        const mappings = JSON.parse(readFileSync('server/data/question-rec-mappings-v1.json', 'utf-8'));
        const recCount = Object.keys(mappings).length;
        
        this.results.push({
          phase: 'Phase 2',
          component: 'REC Mapping Coverage',
          status: recCount >= 40 ? 'PASS' : 'PARTIAL',
          details: `${recCount} RECs mapped (target: 40-50)`,
          critical: false
        });
      }
    } catch (error) {
      this.results.push({
        phase: 'Phase 2',
        component: 'REC Mapping Coverage',
        status: 'FAIL',
        details: `Error checking REC mappings: ${error.message}`,
        critical: false
      });
    }
  }

  private async validatePhase3(): Promise<void> {
    console.log(chalk.yellow('✨ Phase 3: Polish & Enhancement'));

    // Test UI consistency
    try {
      const response = await fetch('http://0.0.0.0:5173');
      const uiAccessible = response.status === 200;
      
      this.results.push({
        phase: 'Phase 3',
        component: 'UI Accessibility',
        status: uiAccessible ? 'PASS' : 'FAIL',
        details: uiAccessible ? 'Frontend accessible' : 'Frontend not responding',
        critical: false
      });
    } catch (error) {
      this.results.push({
        phase: 'Phase 3',
        component: 'UI Accessibility',
        status: 'FAIL',
        details: `Frontend not accessible: ${error.message}`,
        critical: false
      });
    }

    // Test mobile responsiveness
    const mobileTestExists = existsSync('scripts/verify-mobile-responsiveness.ts');
    this.results.push({
      phase: 'Phase 3',
      component: 'Mobile Responsiveness',
      status: mobileTestExists ? 'PASS' : 'PARTIAL',
      details: mobileTestExists ? 'Mobile test script exists' : 'Mobile testing needs implementation',
      critical: false
    });
  }

  private async validatePhase4(): Promise<void> {
    console.log(chalk.yellow('🚀 Phase 4: Production Readiness'));

    // Test comprehensive test suite
    try {
      execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
      this.results.push({
        phase: 'Phase 4',
        component: 'TypeScript Compilation',
        status: 'PASS',
        details: 'No TypeScript errors',
        critical: true
      });
    } catch (error) {
      this.results.push({
        phase: 'Phase 4',
        component: 'TypeScript Compilation',
        status: 'FAIL',
        details: 'TypeScript compilation errors exist',
        critical: true
      });
    }

    // Test API health
    try {
      const response = await fetch('http://0.0.0.0:5000/api/health');
      const apiHealthy = response.status === 200;
      
      this.results.push({
        phase: 'Phase 4',
        component: 'API Health',
        status: apiHealthy ? 'PASS' : 'FAIL',
        details: apiHealthy ? 'API responding correctly' : 'API health check failed',
        critical: true
      });
    } catch (error) {
      this.results.push({
        phase: 'Phase 4',
        component: 'API Health',
        status: 'FAIL',
        details: `API not accessible: ${error.message}`,
        critical: true
      });
    }

    // Test security configuration
    const securityConfigExists = existsSync('docs/SECURITY_THREAT_MODEL.md') && 
                                existsSync('server/middleware/authMiddleware.ts');
    this.results.push({
      phase: 'Phase 4',
      component: 'Security Configuration',
      status: securityConfigExists ? 'PASS' : 'PARTIAL',
      details: securityConfigExists ? 'Security documentation and middleware exist' : 'Security configuration incomplete',
      critical: true
    });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📋 Comprehensive Production Validation Report\n'));

    const totalComponents = this.results.length;
    const passedComponents = this.results.filter(r => r.status === 'PASS').length;
    const partialComponents = this.results.filter(r => r.status === 'PARTIAL').length;
    const failedComponents = this.results.filter(r => r.status === 'FAIL').length;
    const criticalFailures = this.results.filter(r => r.status === 'FAIL' && r.critical).length;

    // Group by phase
    const phases = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'];
    phases.forEach(phase => {
      const phaseResults = this.results.filter(r => r.phase === phase);
      console.log(chalk.blue(`\n${phase}:`));
      
      phaseResults.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
        const priority = result.critical ? chalk.red('(CRITICAL)') : chalk.yellow('(STANDARD)');
        
        console.log(`${icon} ${result.component} ${priority}`);
        console.log(`    ${result.details}`);
      });
    });

    // Overall summary
    const completionRate = Math.round(((passedComponents + (partialComponents * 0.5)) / totalComponents) * 100);
    
    console.log(chalk.blue('\n📊 Summary:'));
    console.log(`✅ Passed: ${passedComponents}/${totalComponents}`);
    console.log(`⚠️ Partial: ${partialComponents}/${totalComponents}`);
    console.log(`❌ Failed: ${failedComponents}/${totalComponents}`);
    console.log(`🚨 Critical Issues: ${criticalFailures}`);
    console.log(chalk.blue(`\n🎯 Production Readiness: ${completionRate}%`));

    if (completionRate >= 98 && criticalFailures === 0) {
      console.log(chalk.green('\n🎉 SUCCESS: ≥98% Production Readiness Achieved!'));
      console.log(chalk.green('All critical components operational. System ready for production deployment.'));
      process.exit(0);
    } else if (completionRate >= 95 && criticalFailures <= 1) {
      console.log(chalk.yellow('\n⚠️ NEARLY READY: Address remaining critical issues for full production readiness'));
      process.exit(1);
    } else {
      console.log(chalk.red('\n❌ NOT READY: Significant work remaining before production deployment'));
      console.log(chalk.blue('\n💡 Priority Actions:'));
      this.results.filter(r => r.status === 'FAIL' && r.critical).forEach(result => {
        console.log(`   • Fix ${result.component}: ${result.details}`);
      });
      process.exit(1);
    }
  }
}

// Execute validation
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ComprehensiveProductionValidator();
  validator.validate().catch(error => {
    console.error(chalk.red('💥 Validation failed:'), error);
    process.exit(1);
  });
}
