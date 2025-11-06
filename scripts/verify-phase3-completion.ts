
import chalk from 'chalk';
import fs from 'fs';

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
  console.log(chalk.blue('🔍 Phase 3: Security & Compliance Framework Verification\n'));

  const phase3Checks: PhaseCheck[] = [
    {
      name: 'Data Classification Policy',
      check: async () => await checkFileContent('docs/DATA_CLASSIFICATION.md', [
        'Data Classification Tiers', 'Public Data', 'Internal Data', 'Confidential Data', 'Restricted Data'
      ]),
      critical: true
    },
    {
      name: 'Data Retention Policy',
      check: async () => await checkFileContent('docs/DATA_RETENTION_POLICY.md', [
        'Retention Framework', 'User Account Data', 'Assessment Data', 'Audit and Security Data'
      ]),
      critical: true
    },
    {
      name: 'Compliance Framework Mapping',
      check: async () => await checkFileContent('docs/COMPLIANCE_FRAMEWORK.md', [
        'GDPR', 'CCPA', 'Data Subject Rights', 'Consent Management'
      ]),
      critical: true
    },
    {
      name: 'Security Threat Model',
      check: async () => await checkFileContent('docs/SECURITY_THREAT_MODEL.md', [
        'STRIDE', 'Threat Analysis', 'Risk Assessment', 'Security Controls'
      ]),
      critical: true
    },
    {
      name: 'Two-Factor Authentication Service',
      check: async () => await checkFileExists('server/services/twoFactorAuthService.ts'),
      critical: false
    },
    {
      name: 'Rate Limiting Middleware',
      check: async () => await checkFileExists('server/middleware/rateLimitMiddleware.ts'),
      critical: false
    },
    {
      name: 'Security Middleware Implementation',
      check: async () => await checkFileExists('server/middleware/authMiddleware.ts'),
      critical: false
    },
    {
      name: 'JWT Security Configuration',
      check: async () => await checkFileExists('docs/JWT_CONFIGURATION.md'),
      critical: false
    }
  ];

  console.log(chalk.yellow('🛡️  Phase 3: Security & Compliance Framework\n'));
  
  let phase3Passed = 0;
  let phase3Critical = 0;
  let totalCritical = 0;
  
  for (const check of phase3Checks) {
    const result = await check.check();
    const status = result ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    const priority = check.critical ? chalk.red('(CRITICAL)') : chalk.yellow('(WARNING)');
    
    console.log(`${status} ${check.name} ${priority}`);
    
    if (result) {
      phase3Passed++;
      if (check.critical) phase3Critical++;
    }
    if (check.critical) totalCritical++;
  }

  // Calculate success rates
  const phase3Rate = (phase3Passed / phase3Checks.length) * 100;
  const criticalRate = totalCritical > 0 ? (phase3Critical / totalCritical) * 100 : 100;

  console.log(chalk.blue('\n📈 Phase 3 Summary:\n'));
  console.log(`Phase 3 Completion: ${phase3Rate.toFixed(1)}% (${phase3Passed}/${phase3Checks.length})`);
  console.log(`Critical Items: ${criticalRate.toFixed(1)}% (${phase3Critical}/${totalCritical})`);

  console.log(`\n🎯 Phase 3 Security & Compliance: ${phase3Rate.toFixed(1)}%`);

  if (phase3Rate >= 95) {
    console.log(chalk.green('🚀 Phase 3: COMPLETE! Security & compliance framework established'));
    process.exit(0);
  } else if (phase3Rate >= 80) {
    console.log(chalk.yellow('⚠️ Phase 3: MOSTLY COMPLETE - Address remaining security items'));
    process.exit(1);
  } else {
    console.log(chalk.red('❌ Phase 3: INCOMPLETE - Critical security work required'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('💥 Phase 3 verification failed:'), error);
  process.exit(1);
});
