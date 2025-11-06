
import { execSync } from 'child_process';
import chalk from 'chalk';
import fetch from 'node-fetch';

interface TestStep {
  name: string;
  command?: string;
  customCheck?: () => Promise<boolean>;
  fixCommand?: string;
  required: boolean;
}

const steps: TestStep[] = [
  {
    name: 'Environment Check',
    customCheck: async () => {
      try {
        const envPath = 'server/.env';
        const fs = await import('fs');
        if (!fs.existsSync(envPath)) return false;
        
        const envContent = fs.readFileSync(envPath, 'utf8');
        return envContent.includes('JWT_SECRET') && envContent.includes('DATABASE_URL');
      } catch {
        return false;
      }
    },
    required: true,
  },
  {
    name: 'TypeScript Check',
    command: 'npx tsc --noEmit --skipLibCheck',
    required: true,
  },
  {
    name: 'Database Health Check',
    command: 'node server/db-health-check.js',
    required: true,
  },
  {
    name: 'Dependencies Check',
    command: 'npm audit --audit-level=high',
    required: false,
  },
  {
    name: 'ESLint Check',
    command: 'npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 5',
    fixCommand: 'npx eslint . --ext .ts,.tsx,.js,.jsx --fix',
    required: true,
  },
  {
    name: 'Build Check',
    command: 'npm run build',
    required: true,
  }
];

async function runVerificationPipeline() {
  console.log(chalk.blue('🚀 Starting Comprehensive Verification & Fix Pipeline\n'));

  let allPassed = true;
  const results: { step: string; passed: boolean; fixed?: boolean }[] = [];

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
        throw new Error(`${step.name} failed`);
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ ${step.name} failed`));
      
      // Try to fix if fix command available
      if (step.fixCommand) {
        console.log(chalk.blue('🔧 Attempting auto-fix...'));
        try {
          execSync(step.fixCommand, { stdio: 'pipe' });
          
          // Re-run the check
          if (step.command) {
            execSync(step.command, { stdio: 'pipe' });
            console.log(chalk.green(`✅ ${step.name} fixed and now passes`));
            results.push({ step: step.name, passed: true, fixed: true });
            continue;
          }
        } catch (fixError) {
          console.log(chalk.yellow('⚠️  Auto-fix attempted but some issues remain'));
        }
      }

      if (step.required) {
        allPassed = false;
      }
      results.push({ step: step.name, passed: false });
    }

    console.log('');
  }

  // Summary
  console.log(chalk.blue('📊 Verification Summary:'));
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? chalk.green : chalk.red;
    const fixed = result.fixed ? chalk.cyan(' (auto-fixed)') : '';
    console.log(color(`${icon} ${result.step}${fixed}`));
  });

  if (allPassed) {
    console.log(chalk.green('\n🎉 All critical verifications passed! Ready to start development server.'));
    
    // Start development server
    console.log(chalk.blue('\n🚀 Starting development server...'));
    execSync('npm run dev', { stdio: 'inherit' });
    
  } else {
    console.log(chalk.red('\n💥 Some critical verifications failed.'));
    console.log(chalk.blue('\n💡 Next Steps:'));
    console.log(chalk.yellow('1. Check database connection and run migrations if needed'));
    console.log(chalk.yellow('2. Fix TypeScript errors manually'));
    console.log(chalk.yellow('3. Re-run: npx tsx scripts/verify-and-fix.ts'));
    process.exit(1);
  }
}

runVerificationPipeline().catch(console.error);
