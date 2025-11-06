#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';

async function runE2ETests() {
  console.log(chalk.blue('🚀 Starting E2E Frontend-Backend Sync Verification\n'));

  // Basic environment validation
  if (!process.env.DATABASE_URL) {
    console.log(chalk.yellow('⚠️  DATABASE_URL not found. Tests may fail if database is required.'));
  }

  try {
    // Check if dev servers are running
    console.log(chalk.yellow('🔍 Checking server availability...'));
    
    try {
      execSync('curl -f http://0.0.0.0:5000/api/health || curl -f http://0.0.0.0:5000/api/assessments', {
        stdio: 'pipe',
        timeout: 5000
      });
      console.log(chalk.green('✅ Backend API is responding'));
    } catch {
      console.log(chalk.red('❌ Backend API not responding. Please start with: npm run dev'));
      process.exit(1);
    }

    try {
      execSync('curl -f http://0.0.0.0:5173', {
        stdio: 'pipe',
        timeout: 5000
      });
      console.log(chalk.green('✅ Frontend is responding'));
    } catch {
      console.log(chalk.red('❌ Frontend not responding. Please start with: npm run dev'));
      process.exit(1);
    }

    // Run Playwright tests
    console.log(chalk.yellow('\n🧪 Running E2E tests...\n'));
    
    const result = execSync('npx playwright test tests/e2e/assessment.spec.ts --reporter=list', {
      stdio: 'inherit',
      encoding: 'utf8'
    });

    console.log(chalk.green('\n🎉 E2E tests completed successfully!'));

  } catch (error: any) {
    console.log(chalk.red('\n💥 E2E tests failed!'));
    console.log(chalk.yellow('\n🔧 Troubleshooting steps:'));
    console.log('1. Ensure both servers are running: npm run dev');
    console.log('2. Check database connection');
    console.log('3. Verify API endpoints are accessible');
    console.log('4. Check browser installation: npx playwright install');
    
    process.exit(1);
  }
}

runE2ETests();
