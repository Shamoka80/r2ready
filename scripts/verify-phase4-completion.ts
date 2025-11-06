
#!/usr/bin/env tsx

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface Phase4Check {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
  details?: string[];
}

async function main() {
  console.log(chalk.blue('🔍 Phase 4: API Contracts & Versioning Verification\n'));

  const phase4Checks: Phase4Check[] = [
    {
      name: 'BYOC API Versioned to v1.0.0',
      check: async () => {
        const filePath = path.join(process.cwd(), 'Fixes', 'api', 'openapi_byoc.yaml');
        if (!fs.existsSync(filePath)) return false;
        const content = fs.readFileSync(filePath, 'utf8');
        const spec = yaml.load(content) as any;
        return spec?.info?.version === '1.0.0';
      },
      critical: true
    },
    {
      name: 'Security API Versioned to v1.0.0',
      check: async () => {
        const filePath = path.join(process.cwd(), 'Fixes', 'api', 'openapi_security.yaml');
        if (!fs.existsSync(filePath)) return false;
        const content = fs.readFileSync(filePath, 'utf8');
        const spec = yaml.load(content) as any;
        return spec?.info?.version === '1.0.0';
      },
      critical: true
    },
    {
      name: 'Credits API Specification Created',
      check: async () => {
        const filePath = path.join(process.cwd(), 'Fixes', 'api', 'openapi_credits.yaml');
        if (!fs.existsSync(filePath)) return false;
        const content = fs.readFileSync(filePath, 'utf8');
        const spec = yaml.load(content) as any;
        return spec?.info?.version === '1.0.0';
      },
      critical: true
    },
    {
      name: 'API Contract Registry Documentation',
      check: async () => {
        const filePath = path.join(process.cwd(), 'docs', 'API_CONTRACT_REGISTRY.md');
        if (!fs.existsSync(filePath)) return false;
        const content = fs.readFileSync(filePath, 'utf8');
        return content.includes('API Contract Versioning Strategy') &&
               content.includes('Breaking vs Non-Breaking Changes') &&
               content.includes('Deprecation Policy');
      },
      critical: true
    },
    {
      name: 'API Deprecation Policy Documentation',
      check: async () => {
        const filePath = path.join(process.cwd(), 'docs', 'API_DEPRECATION_POLICY.md');
        if (!fs.existsSync(filePath)) return false;
        const content = fs.readFileSync(filePath, 'utf8');
        return content.includes('6-month notice') &&
               content.includes('Breaking Changes Policy') &&
               content.includes('Migration Support');
      },
      critical: true
    },
    {
      name: 'API Contract Validation Script',
      check: async () => {
        const filePath = path.join(process.cwd(), 'scripts', 'validate-api-contracts.ts');
        return fs.existsSync(filePath);
      },
      critical: false
    },
    {
      name: 'All APIs Include Breaking Changes Policy',
      check: async () => {
        const apiFiles = [
          'Fixes/api/openapi_byoc.yaml',
          'Fixes/api/openapi_security.yaml',
          'Fixes/api/openapi_credits.yaml'
        ];
        
        for (const file of apiFiles) {
          const filePath = path.join(process.cwd(), file);
          if (!fs.existsSync(filePath)) return false;
          const content = fs.readFileSync(filePath, 'utf8');
          const spec = yaml.load(content) as any;
          if (!spec?.info?.description?.includes('Breaking Changes Policy')) {
            return false;
          }
        }
        return true;
      },
      critical: true
    },
    {
      name: 'All APIs Include Contact Information',
      check: async () => {
        const apiFiles = [
          'Fixes/api/openapi_byoc.yaml',
          'Fixes/api/openapi_security.yaml',
          'Fixes/api/openapi_credits.yaml'
        ];
        
        for (const file of apiFiles) {
          const filePath = path.join(process.cwd(), file);
          if (!fs.existsSync(filePath)) return false;
          const content = fs.readFileSync(filePath, 'utf8');
          const spec = yaml.load(content) as any;
          if (!spec?.info?.contact) {
            return false;
          }
        }
        return true;
      },
      critical: false
    }
  ];

  console.log(chalk.yellow('🎯 Phase 4: API Contracts & Versioning\n'));
  
  let phase4Passed = 0;
  let phase4Critical = 0;
  let totalCritical = 0;
  
  for (const check of phase4Checks) {
    const result = await check.check();
    const status = result ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    const priority = check.critical ? chalk.red('(CRITICAL)') : chalk.yellow('(WARNING)');
    
    console.log(`${status} ${check.name} ${priority}`);
    
    if (result) {
      phase4Passed++;
      if (check.critical) phase4Critical++;
    }
    if (check.critical) totalCritical++;
  }

  // Calculate success rates
  const phase4Rate = (phase4Passed / phase4Checks.length) * 100;
  const criticalRate = totalCritical > 0 ? (phase4Critical / totalCritical) * 100 : 100;

  console.log(chalk.blue('\n📈 Phase 4 Summary:\n'));
  console.log(`Phase 4 Completion: ${phase4Rate.toFixed(1)}% (${phase4Passed}/${phase4Checks.length})`);
  console.log(`Critical Items: ${criticalRate.toFixed(1)}% (${phase4Critical}/${totalCritical})`);

  console.log(`\n🎯 Phase 4 API Contracts & Versioning: ${phase4Rate.toFixed(1)}%`);

  if (phase4Rate >= 98) {
    console.log(chalk.green('🚀 Phase 4: EXCELLENT! API contracts & versioning complete'));
    process.exit(0);
  } else if (phase4Rate >= 90) {
    console.log(chalk.yellow('⚠️ Phase 4: GOOD - Minor improvements needed'));
    process.exit(1);
  } else {
    console.log(chalk.red('❌ Phase 4: NEEDS WORK - Significant improvements required'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('💥 Phase 4 verification failed:'), error);
  process.exit(1);
});
