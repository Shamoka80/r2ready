
#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { readFile, access } from 'fs/promises';
import chalk from 'chalk';

interface InfrastructureCheck {
  name: string;
  check: () => Promise<boolean>;
  fix?: () => Promise<void>;
  critical: boolean;
}

const infrastructureChecks: InfrastructureCheck[] = [
  {
    name: 'Database Migration Strategy',
    critical: true,
    check: async () => {
      try {
        await access('./scripts/migrate-database.ts');
        await access('./scripts/validate-migrations.ts');
        return true;
      } catch {
        return false;
      }
    }
  },
  {
    name: 'React Error Boundaries',
    critical: true,
    check: async () => {
      try {
        await access('./client/src/components/ErrorBoundary.tsx');
        const appContent = await readFile('./client/src/App.tsx', 'utf-8');
        return appContent.includes('ErrorBoundary');
      } catch {
        return false;
      }
    }
  },
  {
    name: 'CORS Configuration',
    critical: true,
    check: async () => {
      try {
        await access('./server/middleware/corsMiddleware.ts');
        const indexContent = await readFile('./server/index.ts', 'utf-8');
        return indexContent.includes('corsMiddleware') || indexContent.includes('cors');
      } catch {
        return false;
      }
    }
  },
  {
    name: 'Test Coverage Cleanup',
    critical: false,
    check: async () => {
      try {
        await access('./scripts/cleanup-tests.ts');
        await access('./scripts/run-comprehensive-tests.ts');
        return true;
      } catch {
        return false;
      }
    }
  },
  {
    name: 'TypeScript Configuration',
    critical: true,
    check: async () => {
      try {
        execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    }
  }
];

async function verifyInfrastructureReliability() {
  console.log(chalk.blue('🏗️ Verifying Infrastructure & Reliability...'));

  let totalChecks = infrastructureChecks.length;
  let passedChecks = 0;
  let criticalFailures: string[] = [];

  for (const check of infrastructureChecks) {
    console.log(chalk.yellow(`▶️ Checking ${check.name}...`));

    try {
      const passed = await check.check();
      
      if (passed) {
        passedChecks++;
        console.log(chalk.green(`✅ ${check.name} - PASSED`));
      } else {
        if (check.critical) {
          criticalFailures.push(check.name);
        }
        console.log(chalk.red(`❌ ${check.name} - FAILED${check.critical ? ' (CRITICAL)' : ''}`));
        
        if (check.fix) {
          console.log(chalk.yellow(`🔧 Attempting to fix ${check.name}...`));
          try {
            await check.fix();
            console.log(chalk.green(`✅ ${check.name} - FIXED`));
            passedChecks++;
          } catch (fixError) {
            console.log(chalk.red(`❌ Failed to fix ${check.name}:`, fixError));
          }
        }
      }
    } catch (error) {
      if (check.critical) {
        criticalFailures.push(check.name);
      }
      console.log(chalk.red(`❌ ${check.name} - ERROR:`, error));
    }
  }

  const passRate = ((passedChecks / totalChecks) * 100).toFixed(1);
  
  console.log(chalk.blue('\n📊 Infrastructure Verification Results:'));
  console.log(chalk.green(`   ✅ Passed: ${passedChecks}/${totalChecks} (${passRate}%)`));
  
  if (criticalFailures.length > 0) {
    console.log(chalk.red(`   ❌ Critical Failures: ${criticalFailures.join(', ')}`));
    console.log(chalk.red('\n💥 Infrastructure verification failed due to critical issues!'));
    process.exit(1);
  }

  if (passRate === '100.0') {
    console.log(chalk.green('\n🎉 100% Pass Rate Achieved! Infrastructure & Reliability gaps resolved!'));
  } else {
    console.log(chalk.yellow(`\n⚠️ Pass rate: ${passRate}% - Some non-critical checks failed`));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyInfrastructureReliability();
}
