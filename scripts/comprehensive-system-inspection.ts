#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { db } from '../server/db';

interface SystemCheck {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  critical: boolean;
}

class SystemInspector {
  private checks: SystemCheck[] = [];

  async runComprehensiveInspection(): Promise<void> {
    console.log(chalk.blue('🔍 Starting Comprehensive System Inspection\n'));

    await this.checkDatabaseConnections();
    await this.checkAPIEndpoints();
    await this.checkFrontendRouting();
    await this.checkBackendRoutes();
    await this.checkAuthFlow();
    await this.checkAssessmentWorkflow();
    await this.checkExportFunctionality();
    await this.checkIndustryJourneyAlignment();

    this.generateReport();
  }

  private async checkDatabaseConnections(): Promise<void> {
    console.log(chalk.yellow('📊 Checking Database Connections...'));

    try {
      const result = await db.execute('SELECT 1 as test');
      this.addCheck('Database', 'PASS', 'Database connection successful', true);

      // Check critical tables
      const tables = ['users', 'assessments', 'intakeForms', 'questions', 'answers'];
      for (const table of tables) {
        try {
          await db.execute(`SELECT 1 FROM ${table} LIMIT 1`);
          this.addCheck(`Table ${table}`, 'PASS', `${table} table accessible`, true);
        } catch (error) {
          this.addCheck(`Table ${table}`, 'FAIL', `${table} table inaccessible: ${error}`, true);
        }
      }
    } catch (error) {
      this.addCheck('Database', 'FAIL', `Database connection failed: ${error}`, true);
    }
  }

  private async checkAPIEndpoints(): Promise<void> {
    console.log(chalk.yellow('🌐 Checking API Endpoints...'));

    const criticalEndpoints = [
      { path: '/api/health', critical: true },
      { path: '/api/auth/me', critical: true },
      { path: '/api/assessments', critical: true },
      { path: '/api/intake-forms', critical: true },
      { path: '/api/exports/templates', critical: true },
      { path: '/api/onboarding/status', critical: true },
      { path: '/api/feature-flags', critical: false }
    ];

    for (const endpoint of criticalEndpoints) {
      try {
        const response = await fetch(`http://0.0.0.0:5000${endpoint.path}`);
        const status = response.ok || response.status === 401 ? 'PASS' : 'FAIL';
        const message = `${endpoint.path} returned ${response.status}`;
        this.addCheck(`API ${endpoint.path}`, status, message, endpoint.critical);
      } catch (error) {
        this.addCheck(`API ${endpoint.path}`, 'FAIL', `Network error: ${error}`, endpoint.critical);
      }
    }
  }

  private async checkFrontendRouting(): Promise<void> {
    console.log(chalk.yellow('🎯 Checking Frontend Routing...'));

    const criticalRoutes = [
      { path: '/', name: 'Landing' },
      { path: '/register', name: 'Registration' },
      { path: '/login', name: 'Login' },
      { path: '/verify-email', name: 'Email Verification' },
      { path: '/account-type-selection', name: 'Account Type Selection' },
      { path: '/pricing', name: 'Pricing' },
      { path: '/onboarding', name: 'Onboarding' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/assessments/new', name: 'New Assessment' }
    ];

    for (const route of criticalRoutes) {
      try {
        const response = await fetch(`http://0.0.0.0:5173${route.path}`);
        const status = response.ok ? 'PASS' : 'WARNING';
        const message = `${route.name} route returns ${response.status}`;
        this.addCheck(`Route ${route.path}`, status, message, false);
      } catch (error) {
        this.addCheck(`Route ${route.path}`, 'FAIL', `Route error: ${error}`, true);
      }
    }
  }

  private async checkBackendRoutes(): Promise<void> {
    console.log(chalk.yellow('⚙️ Checking Backend Route Registration...'));

    // Check if routes.ts properly registers all routes
    const routesPath = 'server/routes.ts';
    if (existsSync(routesPath)) {
      const routesContent = readFileSync(routesPath, 'utf8');

      const expectedRoutes = [
        'auth.ts', 'assessments.ts', 'intake-forms.ts', 
        'exports.ts', 'onboarding.ts', 'analytics.ts'
      ];

      for (const route of expectedRoutes) {
        const isRegistered = routesContent.includes(route.replace('.ts', ''));
        const status = isRegistered ? 'PASS' : 'FAIL';
        const message = isRegistered ? `${route} registered` : `${route} not registered`;
        this.addCheck(`Route Registration ${route}`, status, message, true);
      }
    } else {
      this.addCheck('Routes Configuration', 'FAIL', 'routes.ts file not found', true);
    }
  }

  private async checkAuthFlow(): Promise<void> {
    console.log(chalk.yellow('🔐 Checking Authentication Flow...'));

    // Check JWT configuration
    const jwtSecret = process.env.JWT_SECRET;
    const jwtKid = process.env.JWT_ACTIVE_KID;

    this.addCheck('JWT Configuration', 
      (jwtSecret && jwtKid) ? 'PASS' : 'FAIL',
      (jwtSecret && jwtKid) ? 'JWT properly configured' : 'JWT configuration missing',
      true
    );

    // Test registration endpoint
    try {
      const testEmail = `system-test-${Date.now()}@test.com`;
      const response = await fetch('http://0.0.0.0:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'TestPassword123!',
          firstName: 'System',
          lastName: 'Test',
          companyName: 'Test Company',
          acceptedTerms: true
        })
      });

      const status = response.ok ? 'PASS' : 'FAIL';
      const message = `Registration endpoint returns ${response.status}`;
      this.addCheck('Registration Flow', status, message, true);

      // Cleanup test user
      if (response.ok) {
        await this.cleanupTestUser(testEmail);
      }
    } catch (error) {
      this.addCheck('Registration Flow', 'FAIL', `Registration test failed: ${error}`, true);
    }
  }

  private async checkAssessmentWorkflow(): Promise<void> {
    console.log(chalk.yellow('📋 Checking Assessment Workflow...'));

    // Check if assessment workflow components are aligned
    const components = [
      'client/src/pages/NewAssessment.tsx',
      'client/src/pages/IntakeForm.tsx', 
      'client/src/pages/AssessmentDetail.tsx',
      'server/routes/assessments.ts',
      'server/routes/intake-forms.ts'
    ];

    for (const component of components) {
      const exists = existsSync(component);
      this.addCheck(`Component ${component}`, 
        exists ? 'PASS' : 'FAIL',
        exists ? 'Component exists' : 'Component missing',
        true
      );
    }
  }

  private async checkExportFunctionality(): Promise<void> {
    console.log(chalk.yellow('📄 Checking Export Functionality...'));

    // Check export service and routes
    const exportComponents = [
      'server/services/exportService.ts',
      'server/routes/exports.ts',
      'client/src/pages/ExportCenter.tsx'
    ];

    for (const component of exportComponents) {
      const exists = existsSync(component);
      this.addCheck(`Export ${component}`, 
        exists ? 'PASS' : 'FAIL',
        exists ? 'Export component exists' : 'Export component missing',
        true
      );
    }

    // Test export templates endpoint
    try {
      const response = await fetch('http://0.0.0.0:5000/api/exports/templates');
      const status = response.ok || response.status === 401 ? 'PASS' : 'FAIL';
      this.addCheck('Export Templates API', status, `Templates endpoint returns ${response.status}`, true);
    } catch (error) {
      this.addCheck('Export Templates API', 'FAIL', `Export API error: ${error}`, true);
    }
  }

  private async checkIndustryJourneyAlignment(): Promise<void> {
    console.log(chalk.yellow('🎯 Checking Industry Journey Alignment...'));

    // Check if journey specification components exist
    const journeyComponents = [
      'client/src/pages/AccountTypeSelection.tsx',
      'client/src/pages/Pricing.tsx',
      'client/src/components/OnboardingV2Wizard.tsx',
      'client/src/components/SetupGate.tsx'
    ];

    for (const component of journeyComponents) {
      const exists = existsSync(component);
      this.addCheck(`Journey ${component}`, 
        exists ? 'PASS' : 'FAIL',
        exists ? 'Journey component exists' : 'Journey component missing',
        true
      );
    }
  }

  private async cleanupTestUser(email: string): Promise<void> {
    try {
      await db.execute('DELETE FROM users WHERE email = ?', [email]);
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not cleanup test user: ${error}`));
    }
  }

  private addCheck(component: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string, critical: boolean): void {
    this.checks.push({ component, status, message, critical });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 System Inspection Report'));
    console.log('='.repeat(80));

    const criticalFailures = this.checks.filter(c => c.status === 'FAIL' && c.critical).length;
    const warnings = this.checks.filter(c => c.status === 'WARNING').length;
    const passes = this.checks.filter(c => c.status === 'PASS').length;

    console.log(`✅ Passed: ${passes}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`❌ Critical Failures: ${criticalFailures}`);

    console.log('\n📋 Detailed Results:');
    this.checks.forEach(check => {
      const icon = check.status === 'PASS' ? '✅' : check.status === 'WARNING' ? '⚠️' : '❌';
      const priority = check.critical ? '🚨' : '🔵';
      console.log(`${icon} ${priority} ${check.component}: ${check.message}`);
    });

    if (criticalFailures === 0) {
      console.log(chalk.green('\n🎉 System Ready for E2E Testing!'));
    } else {
      console.log(chalk.red(`\n💥 ${criticalFailures} Critical Issues Must Be Fixed Before E2E Testing`));
    }
  }
}

async function main() {
  const inspector = new SystemInspector();
  await inspector.runComprehensiveInspection();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}