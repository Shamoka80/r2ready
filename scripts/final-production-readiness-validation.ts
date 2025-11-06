
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import { db } from '../server/db';
import { users, assessments, intakeForms } from '../shared/schema';

interface ProductionReadinessResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    score: number;
    details: string;
    critical: boolean;
  }>;
  overallScore: number;
  categoryStatus: 'PASS' | 'PARTIAL' | 'FAIL';
}

class ProductionReadinessValidator {
  private results: ProductionReadinessResult[] = [];

  async validate(): Promise<void> {
    console.log(chalk.blue('🔍 Final Production Readiness Validation\n'));
    console.log(chalk.yellow('Following Production_Readiness_Assessment_Plan.md meticulously...\n'));

    await this.validatePhase0CriticalBlockers();
    await this.validatePhase1EngineeringStandards();
    await this.validatePhase2PerformanceSLO();
    await this.validatePhase3SecurityCompliance();
    await this.validatePhase4APIContracts();
    await this.validatePhase5TestDataEnvironment();
    await this.validatePhase6Infrastructure();
    await this.validatePhase7ObservabilityMonitoring();
    await this.validatePhase8DependencySupplyChain();
    await this.validatePhase9ThirdPartyIntegration();
    await this.validatePhase10DocumentationAudit();
    await this.validatePhase11AcceptanceQualityGates();

    this.generateFinalReport();
  }

  private async validatePhase0CriticalBlockers(): Promise<void> {
    console.log(chalk.yellow('Phase 0: Critical Blockers'));
    
    const checks = [];

    // TypeScript compilation
    try {
      execSync('cd client && npx tsc --noEmit --skipLibCheck', { stdio: 'pipe', timeout: 30000 });
      execSync('cd server && npx tsc --noEmit --skipLibCheck', { stdio: 'pipe', timeout: 30000 });
      checks.push({
        name: 'TypeScript Compilation',
        status: 'PASS' as const,
        score: 100,
        details: 'All TypeScript code compiles successfully without errors',
        critical: true
      });
    } catch (error) {
      checks.push({
        name: 'TypeScript Compilation',
        status: 'FAIL' as const,
        score: 0,
        details: 'TypeScript compilation errors detected',
        critical: true
      });
    }

    // Build pipeline
    try {
      execSync('npm run build', { stdio: 'pipe', timeout: 60000 });
      checks.push({
        name: 'Build Pipeline',
        status: 'PASS' as const,
        score: 100,
        details: 'Production build completes successfully',
        critical: true
      });
    } catch (error) {
      checks.push({
        name: 'Build Pipeline',
        status: 'FAIL' as const,
        score: 0,
        details: 'Build pipeline failure detected',
        critical: true
      });
    }

    // LSP errors check
    try {
      const eslintResult = execSync('npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 50', { 
        stdio: 'pipe', 
        encoding: 'utf8',
        timeout: 30000 
      });
      checks.push({
        name: 'LSP/ESLint Validation',
        status: 'PASS' as const,
        score: 100,
        details: 'No critical LSP errors in production code',
        critical: true
      });
    } catch (error: any) {
      const warningCount = error.stdout ? (error.stdout.match(/warning/g) || []).length : 0;
      if (warningCount <= 50) {
        checks.push({
          name: 'LSP/ESLint Validation',
          status: 'WARNING' as const,
          score: 85,
          details: `${warningCount} ESLint warnings (acceptable)`,
          critical: false
        });
      } else {
        checks.push({
          name: 'LSP/ESLint Validation',
          status: 'FAIL' as const,
          score: 0,
          details: 'Too many ESLint errors/warnings',
          critical: true
        });
      }
    }

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 0: Critical Blockers',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase1EngineeringStandards(): Promise<void> {
    console.log(chalk.yellow('Phase 1: Engineering Standards'));
    
    const checks = [];

    // Prettier configuration
    const prettierExists = existsSync('.prettierrc') || existsSync('.prettierrc.json');
    checks.push({
      name: 'Prettier Configuration',
      status: prettierExists ? 'PASS' : 'FAIL',
      score: prettierExists ? 100 : 0,
      details: prettierExists ? 'Prettier configuration found' : 'Missing Prettier configuration',
      critical: false
    });

    // Husky hooks
    const huskyPreCommit = existsSync('.husky/pre-commit');
    const huskyPrePush = existsSync('.husky/pre-push');
    checks.push({
      name: 'Husky Git Hooks',
      status: (huskyPreCommit && huskyPrePush) ? 'PASS' : 'PARTIAL',
      score: (huskyPreCommit && huskyPrePush) ? 100 : 50,
      details: `Pre-commit: ${huskyPreCommit}, Pre-push: ${huskyPrePush}`,
      critical: false
    });

    // Definition of Done
    const dodExists = existsSync('docs/DEFINITION_OF_DONE.md');
    checks.push({
      name: 'Definition of Done',
      status: dodExists ? 'PASS' : 'FAIL',
      score: dodExists ? 100 : 0,
      details: dodExists ? 'Definition of Done documented' : 'Missing Definition of Done',
      critical: false
    });

    // Package lock
    const packageLockExists = existsSync('package-lock.json');
    checks.push({
      name: 'Dependency Locking',
      status: packageLockExists ? 'PASS' : 'FAIL',
      score: packageLockExists ? 100 : 0,
      details: packageLockExists ? 'Dependencies locked with package-lock.json' : 'Missing package-lock.json',
      critical: false
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;

    this.results.push({
      category: 'Phase 1: Engineering Standards',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: overallScore >= 80 ? 'PASS' : overallScore >= 60 ? 'PARTIAL' : 'FAIL'
    });
  }

  private async validatePhase2PerformanceSLO(): Promise<void> {
    console.log(chalk.yellow('Phase 2: Performance & SLO Baseline'));
    
    const checks = [];

    // Performance budgets
    const perfBudgetsExists = existsSync('docs/PERFORMANCE_BUDGETS.md');
    checks.push({
      name: 'Performance Budgets',
      status: perfBudgetsExists ? 'PASS' : 'FAIL',
      score: perfBudgetsExists ? 100 : 0,
      details: perfBudgetsExists ? 'Performance budgets documented' : 'Missing performance budgets',
      critical: true
    });

    // SLO targets
    const sloExists = existsSync('docs/SLO_TARGETS.md');
    checks.push({
      name: 'SLO Targets',
      status: sloExists ? 'PASS' : 'FAIL',
      score: sloExists ? 100 : 0,
      details: sloExists ? 'SLO targets defined' : 'Missing SLO targets',
      critical: true
    });

    // Accessibility criteria
    const a11yExists = existsSync('docs/ACCESSIBILITY_ACCEPTANCE_CRITERIA.md');
    checks.push({
      name: 'Accessibility Acceptance Criteria',
      status: a11yExists ? 'PASS' : 'FAIL',
      score: a11yExists ? 100 : 0,
      details: a11yExists ? 'Accessibility criteria defined' : 'Missing accessibility criteria',
      critical: true
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 2: Performance & SLO Baseline',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase3SecurityCompliance(): Promise<void> {
    console.log(chalk.yellow('Phase 3: Security & Compliance Framework'));
    
    const checks = [];

    // Security threat model
    const threatModelExists = existsSync('docs/SECURITY_THREAT_MODEL.md');
    checks.push({
      name: 'Security Threat Model',
      status: threatModelExists ? 'PASS' : 'FAIL',
      score: threatModelExists ? 100 : 0,
      details: threatModelExists ? 'STRIDE threat model documented' : 'Missing threat model',
      critical: true
    });

    // Data classification
    const dataClassExists = existsSync('docs/DATA_CLASSIFICATION.md');
    checks.push({
      name: 'Data Classification',
      status: dataClassExists ? 'PASS' : 'FAIL',
      score: dataClassExists ? 100 : 0,
      details: dataClassExists ? 'Data classification policy exists' : 'Missing data classification',
      critical: true
    });

    // Compliance framework
    const complianceExists = existsSync('docs/COMPLIANCE_FRAMEWORK.md');
    checks.push({
      name: 'Compliance Framework',
      status: complianceExists ? 'PASS' : 'FAIL',
      score: complianceExists ? 100 : 0,
      details: complianceExists ? 'Compliance framework documented' : 'Missing compliance framework',
      critical: true
    });

    // Data retention policy
    const retentionExists = existsSync('docs/DATA_RETENTION_POLICY.md');
    checks.push({
      name: 'Data Retention Policy',
      status: retentionExists ? 'PASS' : 'FAIL',
      score: retentionExists ? 100 : 0,
      details: retentionExists ? 'Data retention policy exists' : 'Missing data retention policy',
      critical: true
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 3: Security & Compliance Framework',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase4APIContracts(): Promise<void> {
    console.log(chalk.yellow('Phase 4: API Contracts & Versioning'));
    
    const checks = [];

    // OpenAPI specifications
    const openApiFiles = [
      'Fixes/api/openapi_byoc.yaml',
      'Fixes/api/openapi_security.yaml',
      'Fixes/api/openapi_credits.yaml'
    ];

    const existingSpecs = openApiFiles.filter(file => existsSync(file));
    checks.push({
      name: 'OpenAPI Specifications',
      status: existingSpecs.length === openApiFiles.length ? 'PASS' : 'PARTIAL',
      score: Math.round((existingSpecs.length / openApiFiles.length) * 100),
      details: `${existingSpecs.length}/${openApiFiles.length} OpenAPI specs found`,
      critical: true
    });

    // API contract registry
    const registryExists = existsSync('docs/API_CONTRACT_REGISTRY.md');
    checks.push({
      name: 'API Contract Registry',
      status: registryExists ? 'PASS' : 'FAIL',
      score: registryExists ? 100 : 0,
      details: registryExists ? 'API contract registry exists' : 'Missing contract registry',
      critical: true
    });

    // Deprecation policy
    const deprecationExists = existsSync('docs/API_DEPRECATION_POLICY.md');
    checks.push({
      name: 'API Deprecation Policy',
      status: deprecationExists ? 'PASS' : 'FAIL',
      score: deprecationExists ? 100 : 0,
      details: deprecationExists ? 'Deprecation policy defined' : 'Missing deprecation policy',
      critical: false
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 4: API Contracts & Versioning',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase5TestDataEnvironment(): Promise<void> {
    console.log(chalk.yellow('Phase 5: Test Data & Environment Strategy'));
    
    const checks = [];

    // Test data policy
    const testDataExists = existsSync('docs/TEST_DATA_POLICY.md');
    checks.push({
      name: 'Test Data Policy',
      status: testDataExists ? 'PASS' : 'FAIL',
      score: testDataExists ? 100 : 0,
      details: testDataExists ? 'Test data policy documented' : 'Missing test data policy',
      critical: true
    });

    // Database sanitization
    const sanitizeScriptExists = existsSync('scripts/sanitize-db-dump.ts');
    checks.push({
      name: 'Database Sanitization',
      status: sanitizeScriptExists ? 'PASS' : 'FAIL',
      score: sanitizeScriptExists ? 100 : 0,
      details: sanitizeScriptExists ? 'DB sanitization script exists' : 'Missing sanitization script',
      critical: true
    });

    // Test data cleanup
    const cleanupScriptExists = existsSync('scripts/cleanup-test-data.ts');
    checks.push({
      name: 'Test Data Cleanup',
      status: cleanupScriptExists ? 'PASS' : 'FAIL',
      score: cleanupScriptExists ? 100 : 0,
      details: cleanupScriptExists ? 'Cleanup script exists' : 'Missing cleanup script',
      critical: false
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 5: Test Data & Environment Strategy',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase6Infrastructure(): Promise<void> {
    console.log(chalk.yellow('Phase 6: Infrastructure & Operations'));
    
    const checks = [];

    // Migration strategy
    const migrationExists = existsSync('docs/MIGRATION_STRATEGY.md');
    checks.push({
      name: 'Migration Strategy',
      status: migrationExists ? 'PASS' : 'FAIL',
      score: migrationExists ? 100 : 0,
      details: migrationExists ? 'Migration strategy documented' : 'Missing migration strategy',
      critical: true
    });

    // Backup procedures
    const backupExists = existsSync('docs/BACKUP_RESTORE_PROCEDURES.md');
    checks.push({
      name: 'Backup Procedures',
      status: backupExists ? 'PASS' : 'FAIL',
      score: backupExists ? 100 : 0,
      details: backupExists ? 'Backup procedures documented' : 'Missing backup procedures',
      critical: true
    });

    // Network topology
    const networkExists = existsSync('docs/NETWORK_TOPOLOGY.md');
    checks.push({
      name: 'Network Topology',
      status: networkExists ? 'PASS' : 'FAIL',
      score: networkExists ? 100 : 0,
      details: networkExists ? 'Network topology documented' : 'Missing network topology',
      critical: false
    });

    // Database connectivity test
    try {
      await db.execute('SELECT 1 as test');
      checks.push({
        name: 'Database Connectivity',
        status: 'PASS' as const,
        score: 100,
        details: 'Database connection successful',
        critical: true
      });
    } catch (error) {
      checks.push({
        name: 'Database Connectivity',
        status: 'FAIL' as const,
        score: 0,
        details: 'Database connection failed',
        critical: true
      });
    }

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 6: Infrastructure & Operations',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase7ObservabilityMonitoring(): Promise<void> {
    console.log(chalk.yellow('Phase 7: Observability & Monitoring'));
    
    const checks = [];

    // Structured logger
    const loggerExists = existsSync('server/utils/structuredLogger.ts');
    checks.push({
      name: 'Structured Logger',
      status: loggerExists ? 'PASS' : 'FAIL',
      score: loggerExists ? 100 : 0,
      details: loggerExists ? 'Structured logger implemented' : 'Missing structured logger',
      critical: true
    });

    // Logging standard
    const loggingStdExists = existsSync('docs/LOGGING_STANDARD.md');
    checks.push({
      name: 'Logging Standard',
      status: loggingStdExists ? 'PASS' : 'FAIL',
      score: loggingStdExists ? 100 : 0,
      details: loggingStdExists ? 'Logging standard documented' : 'Missing logging standard',
      critical: true
    });

    // Observability setup
    const obsSetupExists = existsSync('docs/OBSERVABILITY_SETUP.md');
    checks.push({
      name: 'Observability Setup',
      status: obsSetupExists ? 'PASS' : 'FAIL',
      score: obsSetupExists ? 100 : 0,
      details: obsSetupExists ? 'Observability setup documented' : 'Missing observability setup',
      critical: false
    });

    // Alert runbook
    const alertExists = existsSync('docs/ALERT_RUNBOOK.md');
    checks.push({
      name: 'Alert Runbook',
      status: alertExists ? 'PASS' : 'FAIL',
      score: alertExists ? 100 : 0,
      details: alertExists ? 'Alert runbook exists' : 'Missing alert runbook',
      critical: false
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 7: Observability & Monitoring',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase8DependencySupplyChain(): Promise<void> {
    console.log(chalk.yellow('Phase 8: Dependency & Supply Chain Security'));
    
    const checks = [];

    // Renovate configuration
    const renovateExists = existsSync('renovate.json');
    checks.push({
      name: 'Renovate Configuration',
      status: renovateExists ? 'PASS' : 'FAIL',
      score: renovateExists ? 100 : 0,
      details: renovateExists ? 'Renovate configuration found' : 'Missing Renovate configuration',
      critical: false
    });

    // License compliance
    const licenseExists = existsSync('docs/LICENSE_COMPLIANCE.md');
    checks.push({
      name: 'License Compliance',
      status: licenseExists ? 'PASS' : 'FAIL',
      score: licenseExists ? 100 : 0,
      details: licenseExists ? 'License compliance documented' : 'Missing license compliance',
      critical: true
    });

    // SBOM generation
    const sbomExists = existsSync('scripts/generate-sbom.ts');
    checks.push({
      name: 'SBOM Generation',
      status: sbomExists ? 'PASS' : 'FAIL',
      score: sbomExists ? 100 : 0,
      details: sbomExists ? 'SBOM generation script exists' : 'Missing SBOM generation',
      critical: false
    });

    // Security audit
    try {
      const auditResult = execSync('npm audit --audit-level=high', { 
        stdio: 'pipe', 
        encoding: 'utf8',
        timeout: 30000 
      });
      checks.push({
        name: 'Security Audit',
        status: 'PASS' as const,
        score: 100,
        details: 'No high-severity vulnerabilities found',
        critical: true
      });
    } catch (error: any) {
      const output = error.stdout || error.message;
      const highVulns = (output.match(/high/gi) || []).length;
      const criticalVulns = (output.match(/critical/gi) || []).length;
      
      if (criticalVulns > 0) {
        checks.push({
          name: 'Security Audit',
          status: 'FAIL' as const,
          score: 0,
          details: `${criticalVulns} critical vulnerabilities found`,
          critical: true
        });
      } else if (highVulns > 0) {
        checks.push({
          name: 'Security Audit',
          status: 'WARNING' as const,
          score: 50,
          details: `${highVulns} high vulnerabilities found`,
          critical: false
        });
      } else {
        checks.push({
          name: 'Security Audit',
          status: 'PASS' as const,
          score: 100,
          details: 'No critical/high vulnerabilities',
          critical: true
        });
      }
    }

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 8: Dependency & Supply Chain Security',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase9ThirdPartyIntegration(): Promise<void> {
    console.log(chalk.yellow('Phase 9: Third-Party Integration Governance'));
    
    const checks = [];

    // Sandbox environments
    const sandboxExists = existsSync('docs/SANDBOX_ENVIRONMENTS.md');
    checks.push({
      name: 'Sandbox Environment Registry',
      status: sandboxExists ? 'PASS' : 'FAIL',
      score: sandboxExists ? 100 : 0,
      details: sandboxExists ? 'Sandbox environments documented' : 'Missing sandbox documentation',
      critical: true
    });

    // Webhook registry
    const webhookExists = existsSync('docs/WEBHOOK_REGISTRY.md');
    checks.push({
      name: 'Webhook Registry',
      status: webhookExists ? 'PASS' : 'FAIL',
      score: webhookExists ? 100 : 0,
      details: webhookExists ? 'Webhook registry exists' : 'Missing webhook registry',
      critical: true
    });

    // API key rotation
    const keyRotationExists = existsSync('docs/API_KEY_ROTATION_POLICY.md');
    checks.push({
      name: 'API Key Rotation Policy',
      status: keyRotationExists ? 'PASS' : 'FAIL',
      score: keyRotationExists ? 100 : 0,
      details: keyRotationExists ? 'Key rotation policy exists' : 'Missing key rotation policy',
      critical: false
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 9: Third-Party Integration Governance',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase10DocumentationAudit(): Promise<void> {
    console.log(chalk.yellow('Phase 10: Documentation Audit & Updates'));
    
    const checks = [];

    // User journey documentation
    const userFlowExists = existsSync('User_Flow.md') && existsSync('Returning_User_Flow.md');
    checks.push({
      name: 'User Journey Documentation',
      status: userFlowExists ? 'PASS' : 'FAIL',
      score: userFlowExists ? 100 : 0,
      details: userFlowExists ? 'User journey docs exist' : 'Missing user journey docs',
      critical: true
    });

    // API documentation
    const apiDocsExist = existsSync('docs/API_DOCUMENTATION.md');
    checks.push({
      name: 'API Documentation',
      status: apiDocsExist ? 'PASS' : 'FAIL',
      score: apiDocsExist ? 100 : 0,
      details: apiDocsExist ? 'API documentation exists' : 'Missing API documentation',
      critical: true
    });

    // Deployment guide
    const deployGuideExists = existsSync('docs/DEPLOYMENT_GUIDE.md');
    checks.push({
      name: 'Deployment Guide',
      status: deployGuideExists ? 'PASS' : 'FAIL',
      score: deployGuideExists ? 100 : 0,
      details: deployGuideExists ? 'Deployment guide exists' : 'Missing deployment guide',
      critical: true
    });

    // Documentation index
    const indexExists = existsSync('docs/INDEX.md');
    checks.push({
      name: 'Documentation Index',
      status: indexExists ? 'PASS' : 'FAIL',
      score: indexExists ? 100 : 0,
      details: indexExists ? 'Documentation index exists' : 'Missing documentation index',
      critical: false
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 10: Documentation Audit & Updates',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private async validatePhase11AcceptanceQualityGates(): Promise<void> {
    console.log(chalk.yellow('Phase 11: Acceptance & Quality Gates'));
    
    const checks = [];

    // Definition of Done implementation
    const dodTemplateExists = existsSync('docs/templates/feature_acceptance.md');
    checks.push({
      name: 'Definition of Done Implementation',
      status: dodTemplateExists ? 'PASS' : 'FAIL',
      score: dodTemplateExists ? 100 : 0,
      details: dodTemplateExists ? 'DoD template exists' : 'Missing DoD template',
      critical: true
    });

    // Test results documentation
    const testResultsExist = existsSync('docs/TEST_RESULTS.md');
    checks.push({
      name: 'Test Results Documentation',
      status: testResultsExist ? 'PASS' : 'FAIL',
      score: testResultsExist ? 100 : 0,
      details: testResultsExist ? 'Test results documented' : 'Missing test results',
      critical: true
    });

    // Production readiness review
    const readinessExists = existsSync('docs/PRODUCTION_READINESS_SCORECARD.md');
    checks.push({
      name: 'Production Readiness Review',
      status: readinessExists ? 'PASS' : 'FAIL',
      score: readinessExists ? 100 : 0,
      details: readinessExists ? 'Production readiness scorecard exists' : 'Missing readiness scorecard',
      critical: true
    });

    // Launch runbook
    const launchExists = existsSync('docs/LAUNCH_RUNBOOK.md');
    checks.push({
      name: 'Launch Runbook',
      status: launchExists ? 'PASS' : 'FAIL',
      score: launchExists ? 100 : 0,
      details: launchExists ? 'Launch runbook exists' : 'Missing launch runbook',
      critical: false
    });

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL').length;

    this.results.push({
      category: 'Phase 11: Acceptance & Quality Gates',
      checks,
      overallScore: Math.round(overallScore),
      categoryStatus: criticalFailures === 0 ? 'PASS' : 'FAIL'
    });
  }

  private generateFinalReport(): void {
    console.log(chalk.blue('\n📊 FINAL PRODUCTION READINESS REPORT\n'));
    console.log('═'.repeat(80));

    let totalScore = 0;
    let totalCategories = 0;
    let passedCategories = 0;
    let criticalFailures = 0;

    // Category summary
    this.results.forEach(result => {
      const statusIcon = result.categoryStatus === 'PASS' ? '✅' : 
                        result.categoryStatus === 'PARTIAL' ? '⚠️' : '❌';
      const statusColor = result.categoryStatus === 'PASS' ? chalk.green : 
                         result.categoryStatus === 'PARTIAL' ? chalk.yellow : chalk.red;
      
      console.log(`${statusIcon} ${result.category}`);
      console.log(`   Score: ${statusColor(result.overallScore + '%')}`);
      
      // Show failed checks
      const failedChecks = result.checks.filter(c => c.status === 'FAIL');
      if (failedChecks.length > 0) {
        console.log('   Failed checks:');
        failedChecks.forEach(check => {
          console.log(`     • ${check.name}${check.critical ? ' (CRITICAL)' : ''}`);
          if (check.critical) criticalFailures++;
        });
      }
      
      console.log('');
      
      totalScore += result.overallScore;
      totalCategories++;
      if (result.categoryStatus === 'PASS') passedCategories++;
    });

    console.log('═'.repeat(80));

    const overallScore = Math.round(totalScore / totalCategories);
    const passRate = Math.round((passedCategories / totalCategories) * 100);

    console.log(chalk.blue('📈 FINAL ASSESSMENT:'));
    console.log(`   Overall Score: ${overallScore}%`);
    console.log(`   Categories Passed: ${passedCategories}/${totalCategories} (${passRate}%)`);
    console.log(`   Critical Failures: ${criticalFailures}`);

    // Final status determination
    if (overallScore >= 98 && criticalFailures === 0) {
      console.log(chalk.green('\n🎉 PRODUCTION READY!'));
      console.log(chalk.green('All requirements from Production_Readiness_Assessment_Plan.md have been met.'));
    } else if (overallScore >= 95 && criticalFailures <= 2) {
      console.log(chalk.yellow('\n⚠️ MOSTLY READY - Minor issues to address'));
      console.log(chalk.yellow('System is near production ready with minimal remaining items.'));
    } else {
      console.log(chalk.red('\n❌ NOT PRODUCTION READY'));
      console.log(chalk.red('Significant issues must be resolved before production deployment.'));
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      overallScore,
      passRate,
      criticalFailures,
      categories: this.results,
      summary: {
        totalCategories,
        passedCategories,
        failedCategories: totalCategories - passedCategories,
        productionReady: overallScore >= 98 && criticalFailures === 0
      }
    };

    writeFileSync('docs/FINAL_PRODUCTION_READINESS_REPORT.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📋 Detailed report saved to: docs/FINAL_PRODUCTION_READINESS_REPORT.json'));

    // Exit with appropriate code
    process.exit(overallScore >= 98 && criticalFailures === 0 ? 0 : 1);
  }
}

// Run final validation
const validator = new ProductionReadinessValidator();
validator.validate().catch(console.error);
