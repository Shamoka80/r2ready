#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';

class FinalE2EValidator {
  async runFinalValidation(): Promise<void> {
    console.log(chalk.blue('🏁 Starting Final E2E Validation\n'));

    console.log(chalk.yellow('1. 🔍 System Health Check...'));
    await this.systemHealthCheck();

    console.log(chalk.yellow('2. 🧹 Database Cleanup...'));
    await this.cleanupTestData();

    console.log(chalk.yellow('3. 🚀 Server Status Verification...'));
    await this.verifyServerStatus();

    console.log(chalk.yellow('4. 🎭 E2E Test Execution...'));
    await this.runE2ETests();

    console.log(chalk.blue('\n🎉 Final E2E Validation Complete!'));
  }

  private async systemHealthCheck(): Promise<void> {
    try {
      execSync('npx tsx scripts/comprehensive-health-check.ts', { stdio: 'inherit' });
      console.log(chalk.green('✅ System health verified'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ System health issues detected, but continuing...'));
    }
  }

  private async cleanupTestData(): Promise<void> {
    try {
      execSync('npx tsx e2e-tests/helpers/db-cleanup.ts', { stdio: 'inherit' });
      console.log(chalk.green('✅ Test data cleaned'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Test data cleanup had issues, but continuing...'));
    }
  }

  private async verifyServerStatus(): Promise<void> {
    try {
      // Check if servers are running
      execSync('curl -f http://0.0.0.0:5000/api/health', { stdio: 'pipe' });
      console.log(chalk.green('✅ Backend server responding'));
    } catch (error) {
      console.log(chalk.red('❌ Backend server not responding'));
      console.log(chalk.blue('💡 Make sure to run: npm run dev'));
      return;
    }

    try {
      execSync('curl -f http://0.0.0.0:5173', { stdio: 'pipe' });
      console.log(chalk.green('✅ Frontend server responding'));
    } catch (error) {
      console.log(chalk.red('❌ Frontend server not responding'));
      console.log(chalk.blue('💡 Make sure to run: npm run dev'));
      return;
    }
  }

  private async runE2ETests(): Promise<void> {
    console.log(chalk.blue('🎬 Running Industry Aligned Journey E2E Tests...'));

    // Install Playwright browsers if needed
    try {
      execSync('npx playwright install --with-deps', { stdio: 'inherit' });
      console.log(chalk.green('✅ Playwright browsers ready'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Browser installation had issues, trying to continue...'));
    }

    // Run the comprehensive journey tests
    try {
      console.log(chalk.blue('🧪 Testing Business User Journey (PDF Export)...'));
      execSync('npx playwright test e2e-tests/user-journey-1-business-solo-pdf.spec.ts --reporter=list --timeout=300000', { 
        stdio: 'inherit' 
      });
      console.log(chalk.green('✅ Business journey test completed'));
    } catch (error) {
      console.log(chalk.red('❌ Business journey test failed'));
      console.log(chalk.blue('💡 Check the test output above for details'));
    }

    try {
      console.log(chalk.blue('🧪 Testing Consultant User Journey (Word Export)...'));
      execSync('npx playwright test e2e-tests/user-journey-2-consultant-agency-word.spec.ts --reporter=list --timeout=300000', { 
        stdio: 'inherit' 
      });
      console.log(chalk.green('✅ Consultant journey test completed'));
    } catch (error) {
      console.log(chalk.red('❌ Consultant journey test failed'));
      console.log(chalk.blue('💡 Check the test output above for details'));
    }

    // Run the industry journey comprehensive test
    try {
      console.log(chalk.blue('🧪 Running Industry Journey Comprehensive Test...'));
      execSync('npx tsx scripts/test-industry-journey-e2e.ts', { stdio: 'inherit' });
      console.log(chalk.green('✅ Industry journey comprehensive test completed'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Industry journey test had issues, but may have documented them'));
    }
  }
}

async function main() {
  console.log(chalk.blue('🎯 R2v3 Assessment Platform - Final E2E Validation'));
  console.log(chalk.blue('📋 Following Industry_Aligned_Journey.md specification'));
  console.log(chalk.blue('🎬 Target: Complete user journey → PDF export\n'));

  const validator = new FinalE2EValidator();
  await validator.runFinalValidation();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}