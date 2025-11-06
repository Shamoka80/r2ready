#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  output?: string;
}

class UITestRunner {
  private results: TestResult[] = [];

  async runTest(name: string, command: string): Promise<TestResult> {
    console.log(chalk.yellow(`🧪 Running ${name}...`));
    const startTime = Date.now();
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        timeout: 120000 // 2 minutes timeout
      });
      
      const duration = Date.now() - startTime;
      const result: TestResult = { name, passed: true, duration };
      
      console.log(chalk.green(`✅ ${name} passed (${duration}ms)`));
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        name,
        passed: false,
        duration,
        output: error.stdout || error.stderr || error.message
      };
      
      console.log(chalk.red(`❌ ${name} failed (${duration}ms)`));
      if (result.output) {
        console.log(chalk.gray(result.output.slice(0, 500)));
      }
      
      return result;
    }
  }

  async runAllTests(): Promise<void> {
    console.log(chalk.blue('🚀 Starting Comprehensive UI Testing\n'));

    // Basic environment validation
    if (!process.env.DATABASE_URL) {
      console.log(chalk.yellow('⚠️  DATABASE_URL not found. Some tests may fail if database is required.'));
    }

    // Core build and syntax tests
    this.results.push(await this.runTest('TypeScript Compilation', 'npx tsc --noEmit --skipLibCheck'));
    this.results.push(await this.runTest('ESLint Code Quality', 'npx eslint client/src --ext .ts,.tsx --max-warnings 0'));
    this.results.push(await this.runTest('Frontend Build', 'cd client && npm run build'));
    
    // Component and API tests
    this.results.push(await this.runTest('API Types Validation', 'npx tsc --noEmit client/src/api.ts'));
    this.results.push(await this.runTest('Component Types Validation', 'npx tsc --noEmit client/src/components/**/*.tsx'));
    
    // UI smoke tests (if server is running)
    try {
      const response = await fetch('http://localhost:5173/');
      if (response.ok) {
        this.results.push(await this.runTest('UI Smoke Tests', 'npx playwright test tests/ui/smoke.spec.ts --reporter=line'));
      } else {
        console.log(chalk.yellow('⚠️ Frontend server not accessible, skipping browser tests'));
      }
    } catch {
      console.log(chalk.yellow('⚠️ Frontend server not running, skipping browser tests'));
    }

    this.generateReport();
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Comprehensive UI Test Report:'));
    console.log('━'.repeat(60));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    // Individual test results
    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
      const duration = chalk.gray(`${result.duration}ms`);
      
      console.log(`${icon} ${result.name.padEnd(30)} ${status} ${duration}`);
    });

    console.log('━'.repeat(60));
    
    // Summary
    console.log(chalk.blue(`📈 Summary:`));
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ${chalk.green('Passed:')} ${passedTests}`);
    console.log(`   ${chalk.red('Failed:')} ${failedTests}`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    // Recommendations
    if (failedTests > 0) {
      console.log(chalk.yellow('\n💡 Recommended Actions:'));
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   • Fix ${result.name}`);
        if (result.output) {
          const firstError = result.output.split('\n')[0];
          console.log(`     ${chalk.gray(firstError)}`);
        }
      });
    }

    // Exit with appropriate code
    if (failedTests === 0) {
      console.log(chalk.green('\n🎉 All UI tests passed! Frontend is production-ready.'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n💥 Some UI tests failed. Please address issues before deployment.'));
      process.exit(1);
    }
  }
}

// Run tests
const runner = new UITestRunner();
runner.runAllTests().catch(error => {
  console.error(chalk.red('Test runner failed:'), error);
  process.exit(1);
});
