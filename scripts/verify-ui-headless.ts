#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import fetch from 'node-fetch';

interface VerificationStep {
  name: string;
  command?: string;
  customCheck?: () => Promise<boolean>;
  required: boolean;
}

const steps: VerificationStep[] = [
  {
    name: 'TypeScript Check',
    command: 'npx tsc --noEmit',
    required: true,
  },
  {
    name: 'ESLint Check',
    command: 'npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0',
    required: true,
  },
  {
    name: 'Frontend Build Check', 
    command: 'cd client && npm run build',
    required: true,
  },
  {
    name: 'Server Accessibility Check',
    customCheck: async () => {
      try {
        const response = await fetch('http://localhost:5173/');
        return response.ok;
      } catch {
        return false;
      }
    },
    required: true,
  },
  {
    name: 'API Endpoint Check',
    customCheck: async () => {
      try {
        const response = await fetch('http://localhost:5000/api/health');
        return response.ok;
      } catch {
        console.log(chalk.yellow('⚠️  API health check failed - server may not be running'));
        return false;
      }
    },
    required: false,
  },
];

async function runVerification(fix = false) {
  console.log(chalk.blue('🚀 Starting Headless UI Verification Pipeline\n'));

  let allPassed = true;
  const results: { step: string; passed: boolean; output?: string }[] = [];

  for (const step of steps) {
    console.log(chalk.yellow(`▶️  ${step.name}...`));

    try {
      let passed = false;

      if (step.command) {
        execSync(step.command, { 
          encoding: 'utf8',
          stdio: 'pipe',
        });
        passed = true;
      } else if (step.customCheck) {
        passed = await step.customCheck();
      }

      if (passed) {
        console.log(chalk.green(`✅ ${step.name} passed`));
        results.push({ step: step.name, passed: true });
      } else {
        throw new Error(`${step.name} failed custom check`);
      }

    } catch (error: any) {
      const failed = !step.required;
      allPassed = failed ? allPassed : false;

      console.log(chalk.red(`❌ ${step.name} failed`));
      if (error.stdout) {
        console.log(chalk.gray(error.stdout));
      }
      if (error.stderr) {
        console.log(chalk.gray(error.stderr));
      }

      results.push({ 
        step: step.name, 
        passed: false, 
        output: error.stdout || error.stderr || error.message 
      });

      // Try auto-fix for linting errors
      if (step.name === 'ESLint Check' && fix) {
        console.log(chalk.blue('🔧 Attempting auto-fix...'));
        try {
          execSync('npx eslint . --ext .ts,.tsx,.js,.jsx --fix', { stdio: 'pipe' });
          console.log(chalk.green('✅ Auto-fix applied - re-running ESLint check...'));
          // Re-run ESLint to verify fixes
          execSync('npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0', { stdio: 'pipe' });
          console.log(chalk.green('✅ ESLint Check now passes'));
          results[results.length - 1] = { step: step.name, passed: true };
        } catch {
          console.log(chalk.yellow('⚠️  Auto-fix applied but some issues remain'));
        }
      }
    }

    console.log('');
  }

  // Summary
  console.log(chalk.blue('📊 Verification Summary:'));
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? chalk.green : chalk.red;
    console.log(color(`${icon} ${result.step}`));
  });

  if (allPassed) {
    console.log(chalk.green('\n🎉 All critical verifications passed! UI is ready.'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n💥 Some critical verifications failed. Please fix issues before proceeding.'));
    
    // Provide immediate resolution suggestions
    console.log(chalk.blue('\n💡 Immediate Resolution Steps:'));
    console.log(chalk.yellow('1. Auto-fix ESLint issues: npx eslint . --ext .ts,.tsx,.js,.jsx --fix'));
    console.log(chalk.yellow('2. Check TypeScript errors and fix manually'));
    console.log(chalk.yellow('3. Ensure development server is running: npm run dev'));
    console.log(chalk.yellow('4. Re-run verification: npx tsx scripts/verify-ui-headless.ts'));
    
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');

runVerification(shouldFix);