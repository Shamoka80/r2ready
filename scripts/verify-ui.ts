#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';

interface VerificationStep {
  name: string;
  command: string;
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
    command: 'npx eslint . --ext .ts,.tsx --max-warnings 0',
    required: true,
  },
  {
    name: 'Build Check',
    command: 'npm run build',
    required: true,
  },
  {
    name: 'UI Smoke Tests',
    command: 'npx playwright test tests/ui/smoke.spec.ts',
    required: true,
  },
  {
    name: 'Visual Regression Tests',
    command: 'npx playwright test tests/ui/visual.spec.ts',
    required: false,
  },
];

async function runVerification(fix = false) {
  console.log(chalk.blue('🚀 Starting UI Verification Pipeline\n'));

  let allPassed = true;
  const results: { step: string; passed: boolean; output?: string }[] = [];

  for (const step of steps) {
    console.log(chalk.yellow(`▶️  ${step.name}...`));

    try {
      execSync(step.command, { 
        encoding: 'utf8',
        stdio: 'pipe',
      });

      console.log(chalk.green(`✅ ${step.name} passed`));
      results.push({ step: step.name, passed: true });
    } catch (error: any) {
      const failed = !step.required;
      allPassed = failed ? allPassed : false;

      console.log(chalk.red(`❌ ${step.name} failed`));
      console.log(chalk.gray(error.stdout || error.message));

      results.push({ 
        step: step.name, 
        passed: false, 
        output: error.stdout || error.message 
      });

      // Try auto-fix for linting errors
      if (step.name === 'ESLint Check' && fix) {
        console.log(chalk.blue('🔧 Attempting auto-fix...'));
        try {
          execSync('npx eslint . --ext .ts,.tsx --fix', { stdio: 'pipe' });
          console.log(chalk.green('✅ Auto-fix applied'));
        } catch {
          console.log(chalk.red('❌ Auto-fix failed'));
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
    console.log(chalk.green('\n🎉 All verifications passed! UI is ready.'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n💥 Some verifications failed. Please fix issues before proceeding.'));
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');

runVerification(shouldFix);