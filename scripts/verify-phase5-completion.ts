
#!/usr/bin/env tsx

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

interface Phase5Check {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
  details?: string[];
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkFileContent(filePath: string, requiredContent: string[]): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return requiredContent.every(req => content.includes(req));
  } catch {
    return false;
  }
}

async function main() {
  console.log(chalk.blue('🔍 Phase 5: Test Data & Environment Strategy Verification\n'));

  const phase5Checks: Phase5Check[] = [
    {
      name: 'Test Data Generation Policy Documentation',
      check: async () => await checkFileContent('docs/TEST_DATA_POLICY.md', [
        'Test Data Generation Policy', 'Faker.js', 'Test User Personas', 'Synthetic Data'
      ]),
      critical: true
    },
    {
      name: 'PII Anonymization Procedures Documentation',
      check: async () => await checkFileContent('docs/TEST_DATA_POLICY.md', [
        'PII Anonymization', 'hash emails', 'randomize names', 'sanitization'
      ]),
      critical: true
    },
    {
      name: 'Test Data Sanitization Script',
      check: async () => await checkFileExists('scripts/sanitize-db-dump.ts'),
      critical: true
    },
    {
      name: 'Test Data Cleanup Script',
      check: async () => await checkFileExists('scripts/cleanup-test-data.ts'),
      critical: true
    },
    {
      name: 'Test Account Setup Script',
      check: async () => await checkFileExists('server/tools/setup-test-accounts.ts'),
      critical: false
    },
    {
      name: 'Test Environment Configuration',
      check: async () => await checkFileContent('docs/TEST_DATA_POLICY.md', [
        'Environment Strategy', 'development', 'staging', 'production'
      ]),
      critical: true
    },
    {
      name: 'Faker.js Integration',
      check: async () => {
        const packageJson = path.join(process.cwd(), 'server', 'package.json');
        if (await checkFileExists(packageJson)) {
          const content = await fs.promises.readFile(packageJson, 'utf-8');
          const pkg = JSON.parse(content);
          return pkg.dependencies?.['@faker-js/faker'] || pkg.devDependencies?.['@faker-js/faker'];
        }
        return false;
      },
      critical: false
    },
    {
      name: 'Test Data Lifecycle Management',
      check: async () => await checkFileContent('docs/TEST_DATA_POLICY.md', [
        'Test Data Lifecycle', 'Teardown policy', '24 hours', 'cleanup'
      ]),
      critical: true
    }
  ];

  console.log(chalk.yellow('🧪 Phase 5: Test Data & Environment Strategy\n'));
  
  let phase5Passed = 0;
  let phase5Critical = 0;
  let totalCritical = 0;
  
  for (const check of phase5Checks) {
    const result = await check.check();
    const status = result ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    const priority = check.critical ? chalk.red('(CRITICAL)') : chalk.yellow('(WARNING)');
    
    console.log(`${status} ${check.name} ${priority}`);
    
    if (result) {
      phase5Passed++;
      if (check.critical) phase5Critical++;
    }
    if (check.critical) totalCritical++;
  }

  // Calculate success rates
  const phase5Rate = (phase5Passed / phase5Checks.length) * 100;
  const criticalRate = totalCritical > 0 ? (phase5Critical / totalCritical) * 100 : 100;

  console.log(chalk.blue('\n📈 Phase 5 Summary:\n'));
  console.log(`Phase 5 Completion: ${phase5Rate.toFixed(1)}% (${phase5Passed}/${phase5Checks.length})`);
  console.log(`Critical Items: ${criticalRate.toFixed(1)}% (${phase5Critical}/${totalCritical})`);

  console.log(`\n🎯 Phase 5 Test Data & Environment Strategy: ${phase5Rate.toFixed(1)}%`);

  if (phase5Rate >= 95) {
    console.log(chalk.green('🚀 Phase 5: EXCELLENT! Test data & environment strategy complete'));
    process.exit(0);
  } else if (phase5Rate >= 85) {
    console.log(chalk.yellow('⚠️ Phase 5: GOOD - Minor improvements needed'));
    process.exit(1);
  } else {
    console.log(chalk.red('❌ Phase 5: NEEDS WORK - Significant improvements required'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('💥 Phase 5 verification failed:'), error);
  process.exit(1);
});
