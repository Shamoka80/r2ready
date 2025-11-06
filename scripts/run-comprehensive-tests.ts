
import { execSync } from 'child_process';
import chalk from 'chalk';

async function runComprehensiveTests() {
  console.log(chalk.blue('🧪 Running Comprehensive Test Suite...'));

  const testSuites = [
    {
      name: 'TypeScript Compilation',
      command: 'npx tsc --noEmit --skipLibCheck',
      required: true
    },
    {
      name: 'ESLint Analysis',
      command: 'npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0',
      required: true
    },
    {
      name: 'Unit Tests',
      command: 'npm test --if-present',
      required: false
    },
    {
      name: 'Database Migration Validation',
      command: 'npx tsx scripts/validate-migrations.ts',
      required: true
    },
    {
      name: 'Build Verification',
      command: 'npm run build',
      required: true
    },
    {
      name: 'E2E Smoke Tests',
      command: 'npx playwright test tests/ui/smoke.spec.ts --reporter=list',
      required: false
    }
  ];

  let totalTests = 0;
  let passedTests = 0;
  const failedTests: string[] = [];

  for (const suite of testSuites) {
    totalTests++;
    console.log(chalk.yellow(`▶️ Running ${suite.name}...`));

    try {
      execSync(suite.command, { 
        stdio: 'pipe',
        timeout: 60000 
      });
      
      passedTests++;
      console.log(chalk.green(`✅ ${suite.name} - PASSED`));
    } catch (error) {
      if (suite.required) {
        failedTests.push(suite.name);
        console.log(chalk.red(`❌ ${suite.name} - FAILED`));
      } else {
        console.log(chalk.yellow(`⚠️ ${suite.name} - SKIPPED (optional)`));
      }
    }
  }

  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log(chalk.blue('\n📊 Test Results Summary:'));
  console.log(chalk.green(`   ✅ Passed: ${passedTests}/${totalTests} (${passRate}%)`));
  
  if (failedTests.length > 0) {
    console.log(chalk.red(`   ❌ Failed: ${failedTests.join(', ')}`));
    process.exit(1);
  }

  console.log(chalk.green('\n🎉 All required tests passed!'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests();
}
