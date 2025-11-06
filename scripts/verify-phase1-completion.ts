
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

interface PhaseCheck {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
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
  console.log(chalk.blue('🔍 Phase 1 & 2 Completion Verification\n'));

  const phase1Checks: PhaseCheck[] = [
    {
      name: 'Prettier Configuration',
      check: async () => await checkFileExists('.prettierrc'),
      critical: true
    },
    {
      name: 'Husky Pre-commit Hook',
      check: async () => await checkFileExists('.husky/pre-commit'),
      critical: true
    },
    {
      name: 'Husky Pre-push Hook', 
      check: async () => await checkFileExists('.husky/pre-push'),
      critical: true
    },
    {
      name: 'Definition of Done Template',
      check: async () => await checkFileExists('docs/DEFINITION_OF_DONE.md'),
      critical: true
    },
    {
      name: 'Lint-staged Configuration',
      check: async () => await checkFileExists('.lintstagedrc.json'),
      critical: true
    },
    {
      name: 'Package.json Quality Scripts',
      check: async () => await checkFileContent('package.json', [
        'lint', 'type-check', 'format', 'quality-check'
      ]),
      critical: true
    }
  ];

  const phase2Checks: PhaseCheck[] = [
    {
      name: 'Performance Budget Documentation',
      check: async () => await checkFileContent('docs/PERFORMANCE_BUDGETS.md', [
        'API Response Time Targets', 'Frontend Performance Budgets', 'Monitoring & Alerting'
      ]),
      critical: true
    },
    {
      name: 'SLO Targets Documentation',
      check: async () => await checkFileContent('docs/SLO_TARGETS.md', [
        'Availability SLOs', '99.9%', 'Recovery Time Objective', 'Recovery Point Objective'
      ]),
      critical: true
    },
    {
      name: 'Accessibility Acceptance Criteria',
      check: async () => await checkFileContent('docs/ACCESSIBILITY_ACCEPTANCE_CRITERIA.md', [
        'WCAG 2.2 Level AA', 'Screen Reader Compatibility', 'Keyboard Navigation'
      ]),
      critical: true
    },
    {
      name: 'Performance Monitoring Setup',
      check: async () => await checkFileExists('server/middleware/performanceMonitoringMiddleware.ts'),
      critical: false
    },
    {
      name: 'Observability Middleware',
      check: async () => await checkFileExists('server/middleware/observabilityMiddleware.ts'),
      critical: false
    }
  ];

  console.log(chalk.yellow('📋 Phase 1: Engineering Standards & Quality Gates\n'));
  
  let phase1Passed = 0;
  let phase1Critical = 0;
  
  for (const check of phase1Checks) {
    const result = await check.check();
    const status = result ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    const priority = check.critical ? chalk.red('(CRITICAL)') : chalk.yellow('(WARNING)');
    
    console.log(`${status} ${check.name} ${priority}`);
    
    if (result) phase1Passed++;
    if (check.critical) phase1Critical++;
  }

  console.log(chalk.yellow('\n📊 Phase 2: Performance & SLO Baseline\n'));
  
  let phase2Passed = 0;
  let phase2Critical = 0;
  
  for (const check of phase2Checks) {
    const result = await check.check();
    const status = result ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    const priority = check.critical ? chalk.red('(CRITICAL)') : chalk.yellow('(WARNING)');
    
    console.log(`${status} ${check.name} ${priority}`);
    
    if (result) phase2Passed++;
    if (check.critical) phase2Critical++;
  }

  // Calculate overall success rates
  const phase1Rate = (phase1Passed / phase1Checks.length) * 100;
  const phase2Rate = (phase2Passed / phase2Checks.length) * 100;
  const overallRate = ((phase1Passed + phase2Passed) / (phase1Checks.length + phase2Checks.length)) * 100;

  console.log(chalk.blue('\n📈 Summary:\n'));
  console.log(`Phase 1 Completion: ${phase1Rate.toFixed(1)}% (${phase1Passed}/${phase1Checks.length})`);
  console.log(`Phase 2 Completion: ${phase2Rate.toFixed(1)}% (${phase2Passed}/${phase2Checks.length})`);
  console.log(`Overall Completion: ${overallRate.toFixed(1)}% (${phase1Passed + phase2Passed}/${phase1Checks.length + phase2Checks.length})`);

  console.log(`\n🎯 Phase 1 + 2 Combined: ${overallRate.toFixed(1)}%`);

  if (overallRate >= 98) {
    console.log(chalk.green('🚀 Phases 1 & 2: COMPLETE! Ready for Phase 3'));
    process.exit(0);
  } else if (overallRate >= 85) {
    console.log(chalk.yellow('⚠️ Phases 1 & 2: MOSTLY COMPLETE - Address remaining items'));
    process.exit(1);
  } else {
    console.log(chalk.red('❌ Phases 1 & 2: INCOMPLETE - Address critical issues'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('💥 Verification failed:'), error);
  process.exit(1);
});
