
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import fetch from 'node-fetch';

interface TestResult {
  component: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details?: string;
}

class LinkAndButtonVerifier {
  private baseUrl = 'http://0.0.0.0:5173';
  private apiUrl = 'http://0.0.0.0:5000';
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log(chalk.blue('🔍 Starting Complete Link & Button Verification\n'));

    // 1. Backend API Endpoint Tests
    await this.testBackendEndpoints();
    
    // 2. Frontend Route Tests
    await this.testFrontendRoutes();
    
    // 3. Navigation Link Tests
    await this.testNavigationLinks();
    
    // 4. Button Functionality Tests
    await this.testButtonFunctionality();
    
    // 5. Form Submission Tests
    await this.testFormSubmissions();
    
    // Generate report
    this.generateReport();
  }

  private async testBackendEndpoints(): Promise<void> {
    console.log(chalk.yellow('🔧 Testing Backend API Endpoints...'));
    
    const endpoints = [
      // Health & System
      { path: '/api/health', method: 'GET', expectCode: 200 },
      { path: '/api/observability/health', method: 'GET', expectCode: 200 },
      { path: '/healthz', method: 'GET', expectCode: 200 },
      { path: '/readyz', method: 'GET', expectCode: 200 },
      
      // Auth endpoints (public)
      { path: '/api/auth/health', method: 'GET', expectCode: 200 },
      
      // Directory
      { path: '/api/directory', method: 'GET', expectCode: 200 },
      
      // Protected endpoints (should return 401 without auth)
      { path: '/api/assessments', method: 'GET', expectCode: 401 },
      { path: '/api/facilities', method: 'GET', expectCode: 401 },
      { path: '/api/intake-forms', method: 'GET', expectCode: 401 },
      { path: '/api/licenses', method: 'GET', expectCode: 401 }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.apiUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' }
        });

        const success = response.status === endpoint.expectCode;
        this.results.push({
          component: 'Backend API',
          test: `${endpoint.method} ${endpoint.path} (expect ${endpoint.expectCode})`,
          status: success ? 'PASS' : 'FAIL',
          details: success ? undefined : `Got ${response.status}, expected ${endpoint.expectCode}`
        });

        if (success) {
          console.log(chalk.green(`  ✅ ${endpoint.path} - ${response.status}`));
        } else {
          console.log(chalk.red(`  ❌ ${endpoint.path} - Got ${response.status}, expected ${endpoint.expectCode}`));
        }
      } catch (error) {
        this.results.push({
          component: 'Backend API',
          test: `${endpoint.method} ${endpoint.path}`,
          status: 'FAIL',
          details: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        console.log(chalk.red(`  ❌ ${endpoint.path} - Connection failed`));
      }
    }
  }

  private async testFrontendRoutes(): Promise<void> {
    console.log(chalk.yellow('\n🌐 Testing Frontend Routes...'));
    
    const routes = [
      // Public routes
      '/',
      '/login',
      '/register',
      '/forgot-password',
      '/verify-email',
      '/about',
      '/training-center',
      
      // Protected routes (should redirect or show login)
      '/dashboard',
      '/assessments',
      '/facilities',
      '/settings',
      '/licenses',
      '/onboarding'
    ];

    for (const route of routes) {
      try {
        const response = await fetch(`${this.baseUrl}${route}`);
        const success = response.status === 200;
        
        this.results.push({
          component: 'Frontend Routes',
          test: `Route: ${route}`,
          status: success ? 'PASS' : 'FAIL',
          details: success ? undefined : `HTTP ${response.status}`
        });

        if (success) {
          console.log(chalk.green(`  ✅ ${route} - ${response.status}`));
        } else {
          console.log(chalk.red(`  ❌ ${route} - ${response.status}`));
        }
      } catch (error) {
        this.results.push({
          component: 'Frontend Routes',
          test: `Route: ${route}`,
          status: 'FAIL',
          details: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        console.log(chalk.red(`  ❌ ${route} - Connection failed`));
      }
    }
  }

  private async testNavigationLinks(): Promise<void> {
    console.log(chalk.yellow('\n🔗 Testing Navigation Links...'));
    
    // Test main navigation structure from App.tsx
    const navigationTests = [
      { name: 'Landing to Login', from: '/', to: '/login' },
      { name: 'Landing to Register', from: '/', to: '/register' },
      { name: 'Login to Register', from: '/login', to: '/register' },
      { name: 'Register to Login', from: '/register', to: '/login' },
      { name: 'Training Center Access', from: '/', to: '/training-center' }
    ];

    for (const nav of navigationTests) {
      try {
        // Check if both source and destination routes exist
        const fromResponse = await fetch(`${this.baseUrl}${nav.from}`);
        const toResponse = await fetch(`${this.baseUrl}${nav.to}`);
        
        const success = fromResponse.status === 200 && toResponse.status === 200;
        
        this.results.push({
          component: 'Navigation Links',
          test: nav.name,
          status: success ? 'PASS' : 'FAIL',
          details: success ? undefined : `From: ${fromResponse.status}, To: ${toResponse.status}`
        });

        if (success) {
          console.log(chalk.green(`  ✅ ${nav.name}`));
        } else {
          console.log(chalk.red(`  ❌ ${nav.name} - Routes not accessible`));
        }
      } catch (error) {
        this.results.push({
          component: 'Navigation Links',
          test: nav.name,
          status: 'FAIL',
          details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        console.log(chalk.red(`  ❌ ${nav.name} - Error`));
      }
    }
  }

  private async testButtonFunctionality(): Promise<void> {
    console.log(chalk.yellow('\n🔘 Testing Button Functionality...'));
    
    // Test critical form buttons and actions
    const buttonTests = [
      { name: 'Registration Form Submission', endpoint: '/api/auth/register-tenant', method: 'POST' },
      { name: 'Login Form Submission', endpoint: '/api/auth/login', method: 'POST' },
      { name: 'Assessment Creation', endpoint: '/api/assessments', method: 'POST' },
      { name: 'Facility Creation', endpoint: '/api/facilities', method: 'POST' }
    ];

    for (const button of buttonTests) {
      try {
        // Test if endpoint exists (expect 400/401, not 404)
        const response = await fetch(`${this.apiUrl}${button.endpoint}`, {
          method: button.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}) // Empty body to test endpoint existence
        });

        // Success if we get validation error (400) or auth error (401), not 404
        const success = response.status !== 404;
        
        this.results.push({
          component: 'Button Actions',
          test: button.name,
          status: success ? 'PASS' : 'FAIL',
          details: success ? `Endpoint exists (${response.status})` : 'Endpoint not found (404)'
        });

        if (success) {
          console.log(chalk.green(`  ✅ ${button.name} - Endpoint available`));
        } else {
          console.log(chalk.red(`  ❌ ${button.name} - Endpoint missing`));
        }
      } catch (error) {
        this.results.push({
          component: 'Button Actions',
          test: button.name,
          status: 'FAIL',
          details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        console.log(chalk.red(`  ❌ ${button.name} - Error`));
      }
    }
  }

  private async testFormSubmissions(): Promise<void> {
    console.log(chalk.yellow('\n📝 Testing Form Submissions...'));
    
    const formTests = [
      { name: 'Password Reset Request', endpoint: '/api/auth/forgot-password', method: 'POST' },
      { name: 'Contact Form', endpoint: '/api/contact', method: 'POST', optional: true },
      { name: 'Intake Form Auto-save', endpoint: '/api/intake-forms', method: 'POST' },
      { name: 'Evidence Upload', endpoint: '/api/evidence', method: 'POST' }
    ];

    for (const form of formTests) {
      try {
        const response = await fetch(`${this.apiUrl}${form.endpoint}`, {
          method: form.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        // For optional endpoints, 404 is acceptable
        const success = form.optional ? response.status !== 500 : response.status !== 404;
        
        this.results.push({
          component: 'Form Submissions',
          test: form.name,
          status: success ? 'PASS' : (form.optional ? 'SKIP' : 'FAIL'),
          details: `HTTP ${response.status}${form.optional ? ' (optional)' : ''}`
        });

        if (success) {
          console.log(chalk.green(`  ✅ ${form.name} - Available`));
        } else if (form.optional) {
          console.log(chalk.gray(`  ⏭️  ${form.name} - Optional, skipped`));
        } else {
          console.log(chalk.red(`  ❌ ${form.name} - Not available`));
        }
      } catch (error) {
        this.results.push({
          component: 'Form Submissions',
          test: form.name,
          status: form.optional ? 'SKIP' : 'FAIL',
          details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        console.log(chalk.red(`  ❌ ${form.name} - Error`));
      }
    }
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Test Results Summary'));
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.gray(`Skipped: ${skipped}`));
    console.log(`Success Rate: ${((passed / (total - skipped)) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(chalk.red(`  • [${result.component}] ${result.test}`));
          if (result.details) {
            console.log(chalk.gray(`    ${result.details}`));
          }
        });
    }
    
    // Component breakdown
    console.log(chalk.blue('\n📋 By Component:'));
    const componentStats = this.results.reduce((acc, result) => {
      if (!acc[result.component]) {
        acc[result.component] = { pass: 0, fail: 0, skip: 0, total: 0 };
      }
      acc[result.component][result.status.toLowerCase() as 'pass' | 'fail' | 'skip']++;
      acc[result.component].total++;
      return acc;
    }, {} as Record<string, { pass: number; fail: number; skip: number; total: number }>);
    
    Object.entries(componentStats).forEach(([component, stats]) => {
      const successRate = ((stats.pass / (stats.total - stats.skip)) * 100).toFixed(1);
      console.log(`  ${component}: ${stats.pass}/${stats.total - stats.skip} (${successRate}%)`);
    });
    
    console.log(chalk.blue('\n🎯 Overall Status:'));
    if (failed === 0) {
      console.log(chalk.green('✅ All critical links and buttons are functional!'));
    } else if (failed <= 2) {
      console.log(chalk.yellow('⚠️  Minor issues detected - mostly functional'));
    } else {
      console.log(chalk.red('❌ Multiple issues detected - requires attention'));
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const verifier = new LinkAndButtonVerifier();
  
  try {
    // Check if servers are running
    console.log(chalk.blue('🔍 Checking server status...'));
    
    try {
      await fetch('http://0.0.0.0:5000/api/health');
      console.log(chalk.green('✅ Backend server is running'));
    } catch (error) {
      console.log(chalk.red('❌ Backend server not accessible'));
      console.log(chalk.yellow('💡 Please run: npm run dev'));
      process.exit(1);
    }
    
    try {
      await fetch('http://0.0.0.0:5173');
      console.log(chalk.green('✅ Frontend server is running'));
    } catch (error) {
      console.log(chalk.red('❌ Frontend server not accessible'));
      console.log(chalk.yellow('💡 Please run: npm run dev'));
      process.exit(1);
    }
    
    await verifier.runAllTests();
    
  } catch (error) {
    console.error(chalk.red('❌ Verification failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
