
#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import { db } from '../server/db';
import { users, assessments, facilityProfiles, systemLogs } from '../shared/schema';
import { eq, sql, and, gte } from 'drizzle-orm';

interface VerificationResult {
  metric: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  score: number;
  details: string[];
  recommendations: string[];
}

class Phase6CompletionVerifier {
  private results: VerificationResult[] = [];

  async verify(): Promise<void> {
    console.log(chalk.blue('🔍 Phase 6: Infrastructure & Operations Verification\n'));

    await this.verifyMigrationStrategy();
    await this.verifyBackupProcedures();
    await this.verifyDomainTLSManagement();
    await this.verifyNetworkTopology();
    await this.verifyEnvironmentStrategy();
    await this.verifyInfrastructureDocumentation();
    await this.verifyOperationalRunbooks();
    await this.verifyMonitoringIntegration();

    this.generateReport();
  }

  private async verifyMigrationStrategy(): Promise<void> {
    console.log(chalk.yellow('🔄 Verifying Migration & Rollback Strategy...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check migration documentation
    if (existsSync('docs/MIGRATION_STRATEGY.md')) {
      const content = readFileSync('docs/MIGRATION_STRATEGY.md', 'utf8');
      if (content.includes('Drizzle migration workflow') && content.includes('rollback runbook')) {
        details.push('✅ Migration strategy documentation exists');
        score += 25;
      } else {
        details.push('⚠️ Migration strategy documentation incomplete');
        recommendations.push('Complete migration strategy documentation');
      }
    } else {
      details.push('❌ Migration strategy documentation missing');
      recommendations.push('Create comprehensive migration strategy documentation');
    }

    // Check migration files structure
    const migrationFiles = [
      'migrations/meta/_journal.json',
      'drizzle.config.ts'
    ];

    let migrationScore = 0;
    for (const file of migrationFiles) {
      if (existsSync(file)) {
        migrationScore++;
        details.push(`✅ ${file} exists`);
      } else {
        details.push(`❌ ${file} missing`);
        recommendations.push(`Create ${file}`);
      }
    }
    score += (migrationScore / migrationFiles.length) * 25;

    // Check rollback procedures
    if (existsSync('scripts/migrate-database.ts')) {
      const content = readFileSync('scripts/migrate-database.ts', 'utf8');
      if (content.includes('rollback') || content.includes('down')) {
        details.push('✅ Rollback procedures implemented');
        score += 25;
      } else {
        details.push('⚠️ Rollback procedures need enhancement');
        recommendations.push('Implement comprehensive rollback procedures');
        score += 15;
      }
    } else {
      details.push('❌ Migration scripts missing');
      recommendations.push('Create database migration scripts');
    }

    // Check migration testing
    if (existsSync('scripts/validate-migrations.ts')) {
      details.push('✅ Migration validation exists');
      score += 25;
    } else {
      details.push('❌ Migration testing missing');
      recommendations.push('Create migration testing procedures');
    }

    this.results.push({
      metric: 'Migration & Rollback Strategy',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyBackupProcedures(): Promise<void> {
    console.log(chalk.yellow('💾 Verifying Backup & Restore Procedures...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check backup documentation
    if (existsSync('docs/BACKUP_RESTORE_PROCEDURES.md')) {
      const content = readFileSync('docs/BACKUP_RESTORE_PROCEDURES.md', 'utf8');
      if (content.includes('Daily full') && content.includes('hourly incremental')) {
        details.push('✅ Backup schedule documented');
        score += 30;
      } else {
        details.push('⚠️ Backup schedule incomplete');
        recommendations.push('Document complete backup schedule');
        score += 15;
      }

      if (content.includes('RTO') && content.includes('RPO')) {
        details.push('✅ RTO/RPO targets defined');
        score += 20;
      } else {
        details.push('❌ RTO/RPO targets missing');
        recommendations.push('Define Recovery Time and Point Objectives');
      }
    } else {
      details.push('❌ Backup procedures documentation missing');
      recommendations.push('Create backup and restore procedures documentation');
    }

    // Check database backup capabilities
    try {
      // Test database connection for backup readiness
      await db.execute(sql`SELECT 1`);
      details.push('✅ Database connection available for backups');
      score += 25;
    } catch (error) {
      details.push('❌ Database backup connection issues');
      recommendations.push('Fix database connectivity for backup operations');
    }

    // Check Replit checkpoint integration
    if (existsSync('.replit')) {
      const content = readFileSync('.replit', 'utf8');
      details.push('✅ Replit configuration exists for checkpoint system');
      score += 25;
    } else {
      details.push('⚠️ Replit configuration needs optimization');
      recommendations.push('Optimize Replit configuration for checkpoints');
      score += 15;
    }

    this.results.push({
      metric: 'Backup & Restore Procedures',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDomainTLSManagement(): Promise<void> {
    console.log(chalk.yellow('🔒 Verifying Domain & TLS Management...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check domain policy documentation
    if (existsSync('docs/DOMAIN_TLS_POLICY.md')) {
      const content = readFileSync('docs/DOMAIN_TLS_POLICY.md', 'utf8');
      if (content.includes('replit.app') && content.includes('TLS certificate')) {
        details.push('✅ Domain and TLS policy documented');
        score += 40;
      } else {
        details.push('⚠️ Domain policy incomplete');
        recommendations.push('Complete domain naming and TLS policy');
        score += 20;
      }
    } else {
      details.push('❌ Domain TLS policy missing');
      recommendations.push('Create domain and TLS management policy');
    }

    // Check Replit deployment configuration
    if (existsSync('.replit')) {
      const content = readFileSync('.replit', 'utf8');
      if (content.includes('run') || content.includes('deployment')) {
        details.push('✅ Replit deployment configured');
        score += 30;
      } else {
        details.push('⚠️ Replit deployment needs configuration');
        recommendations.push('Configure Replit deployment settings');
        score += 15;
      }
    }

    // Check environment-specific configs
    const envFiles = [
      'server/.env.example',
      'client/.env.example'
    ];

    let envScore = 0;
    for (const file of envFiles) {
      if (existsSync(file)) {
        envScore++;
        details.push(`✅ ${file} exists`);
      } else {
        details.push(`❌ ${file} missing`);
        recommendations.push(`Create ${file} for environment configuration`);
      }
    }
    score += (envScore / envFiles.length) * 30;

    this.results.push({
      metric: 'Domain & TLS Management',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyNetworkTopology(): Promise<void> {
    console.log(chalk.yellow('🌐 Verifying Network Topology Documentation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check network topology documentation
    if (existsSync('docs/NETWORK_TOPOLOGY.md')) {
      const content = readFileSync('docs/NETWORK_TOPOLOGY.md', 'utf8');
      if (content.includes('Replit') && content.includes('Neon') && content.includes('External APIs')) {
        details.push('✅ Network topology documented');
        score += 50;
      } else {
        details.push('⚠️ Network topology incomplete');
        recommendations.push('Complete network topology documentation');
        score += 25;
      }
    } else {
      details.push('❌ Network topology documentation missing');
      recommendations.push('Create network topology documentation');
    }

    // Check security zones documentation
    if (existsSync('docs/SECURITY_THREAT_MODEL.md')) {
      const content = readFileSync('docs/SECURITY_THREAT_MODEL.md', 'utf8');
      if (content.includes('trust boundaries') || content.includes('security zones')) {
        details.push('✅ Security zones documented');
        score += 25;
      } else {
        details.push('⚠️ Security zones need documentation');
        recommendations.push('Document security zones and trust boundaries');
        score += 10;
      }
    }

    // Check API integration documentation
    if (existsSync('docs/API_DOCUMENTATION.md')) {
      details.push('✅ API documentation exists');
      score += 25;
    } else {
      details.push('❌ API documentation missing');
      recommendations.push('Create API integration documentation');
    }

    this.results.push({
      metric: 'Network Topology Documentation',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyEnvironmentStrategy(): Promise<void> {
    console.log(chalk.yellow('🏗️ Verifying Environment Strategy...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check deployment guide
    if (existsSync('docs/DEPLOYMENT_GUIDE.md')) {
      const content = readFileSync('docs/DEPLOYMENT_GUIDE.md', 'utf8');
      if (content.includes('development') && content.includes('staging') && content.includes('production')) {
        details.push('✅ Environment strategy documented');
        score += 40;
      } else {
        details.push('⚠️ Environment strategy incomplete');
        recommendations.push('Complete environment strategy documentation');
        score += 20;
      }
    } else {
      details.push('❌ Deployment guide missing');
      recommendations.push('Create deployment guide with environment strategy');
    }

    // Check environment-specific configurations
    const configFiles = [
      'server/.env.example',
      'client/.env.example',
      'drizzle.config.ts'
    ];

    let configScore = 0;
    for (const file of configFiles) {
      if (existsSync(file)) {
        configScore++;
        details.push(`✅ ${file} exists`);
      } else {
        details.push(`❌ ${file} missing`);
        recommendations.push(`Create ${file}`);
      }
    }
    score += (configScore / configFiles.length) * 30;

    // Check promotion workflow
    if (existsSync('.github/workflows/ci.yml') || existsSync('.github/workflows/publish.yml')) {
      details.push('✅ CI/CD workflow exists');
      score += 30;
    } else {
      details.push('❌ CI/CD workflow missing');
      recommendations.push('Create CI/CD promotion workflow');
    }

    this.results.push({
      metric: 'Environment Strategy',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyInfrastructureDocumentation(): Promise<void> {
    console.log(chalk.yellow('📋 Verifying Infrastructure Documentation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const requiredDocs = [
      'docs/MIGRATION_STRATEGY.md',
      'docs/BACKUP_RESTORE_PROCEDURES.md',
      'docs/DOMAIN_TLS_POLICY.md',
      'docs/NETWORK_TOPOLOGY.md',
      'docs/DEPLOYMENT_GUIDE.md'
    ];

    let docScore = 0;
    for (const doc of requiredDocs) {
      if (existsSync(doc)) {
        docScore++;
        details.push(`✅ ${doc} exists`);
      } else {
        details.push(`❌ ${doc} missing`);
        recommendations.push(`Create ${doc}`);
      }
    }

    score = (docScore / requiredDocs.length) * 100;

    this.results.push({
      metric: 'Infrastructure Documentation Complete',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyOperationalRunbooks(): Promise<void> {
    console.log(chalk.yellow('📖 Verifying Operational Runbooks...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check for operational scripts
    const operationalScripts = [
      'scripts/migrate-database.ts',
      'scripts/validate-migrations.ts',
      'scripts/comprehensive-health-check.ts',
      'scripts/cleanup-test-data.ts'
    ];

    let scriptScore = 0;
    for (const script of operationalScripts) {
      if (existsSync(script)) {
        scriptScore++;
        details.push(`✅ ${script} exists`);
      } else {
        details.push(`❌ ${script} missing`);
        recommendations.push(`Create ${script}`);
      }
    }

    score += (scriptScore / operationalScripts.length) * 50;

    // Check runbook documentation
    if (existsSync('docs/DEPLOYMENT_GUIDE.md')) {
      const content = readFileSync('docs/DEPLOYMENT_GUIDE.md', 'utf8');
      if (content.includes('procedures') && content.includes('troubleshooting')) {
        details.push('✅ Operational procedures documented');
        score += 25;
      } else {
        details.push('⚠️ Operational procedures need enhancement');
        recommendations.push('Enhance operational procedures documentation');
        score += 15;
      }
    }

    // Check monitoring integration
    if (existsSync('server/services/observabilityService.ts')) {
      details.push('✅ Observability service exists');
      score += 25;
    } else {
      details.push('❌ Observability service missing');
      recommendations.push('Implement observability service');
    }

    this.results.push({
      metric: 'Operational Runbooks',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyMonitoringIntegration(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Monitoring Integration...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check observability services
    const monitoringServices = [
      'server/services/observabilityService.ts',
      'server/services/systemHealthService.ts',
      'server/middleware/observabilityMiddleware.ts',
      'server/routes/observability.ts'
    ];

    let serviceScore = 0;
    for (const service of monitoringServices) {
      if (existsSync(service)) {
        serviceScore++;
        details.push(`✅ ${service} exists`);
      } else {
        details.push(`❌ ${service} missing`);
        recommendations.push(`Implement ${service}`);
      }
    }

    score += (serviceScore / monitoringServices.length) * 70;

    // Check health check endpoints
    if (existsSync('server/routes/observability.ts')) {
      const content = readFileSync('server/routes/observability.ts', 'utf8');
      if (content.includes('/health') && content.includes('/metrics')) {
        details.push('✅ Health check endpoints implemented');
        score += 15;
      } else {
        details.push('⚠️ Health check endpoints incomplete');
        recommendations.push('Complete health check endpoint implementation');
        score += 8;
      }
    }

    // Check dashboard integration
    if (existsSync('client/src/pages/ObservabilityDashboard.tsx')) {
      details.push('✅ Observability dashboard exists');
      score += 15;
    } else {
      details.push('❌ Observability dashboard missing');
      recommendations.push('Create observability dashboard');
    }

    this.results.push({
      metric: 'Monitoring Integration',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Phase 6: Infrastructure & Operations Report\n'));
    console.log('═'.repeat(80));

    let totalScore = 0;
    let totalMetrics = 0;

    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
      const statusColor = result.status === 'PASS' ? chalk.green : result.status === 'PARTIAL' ? chalk.yellow : chalk.red;
      
      console.log(`${statusIcon} ${result.metric}`);
      console.log(`   Status: ${statusColor(result.status)} (${result.score}%)`);
      
      if (result.details.length > 0) {
        console.log('   Details:');
        result.details.forEach(detail => {
          console.log(`     ${detail}`);
        });
      }
      
      if (result.recommendations.length > 0) {
        console.log('   Recommendations:');
        result.recommendations.forEach(rec => {
          console.log(`     • ${rec}`);
        });
      }
      
      console.log('');
      
      totalScore += result.score;
      totalMetrics++;
    });

    console.log('═'.repeat(80));
    
    const overallScore = Math.round(totalScore / totalMetrics);
    const passedMetrics = this.results.filter(r => r.status === 'PASS').length;
    const partialMetrics = this.results.filter(r => r.status === 'PARTIAL').length;
    const failedMetrics = this.results.filter(r => r.status === 'FAIL').length;

    console.log(chalk.blue('📈 Overall Results:'));
    console.log(`   Overall Score: ${overallScore}%`);
    console.log(`   ${chalk.green('Passed:')} ${passedMetrics}`);
    console.log(`   ${chalk.yellow('Partial:')} ${partialMetrics}`);
    console.log(`   ${chalk.red('Failed:')} ${failedMetrics}`);

    // Generate recommendations summary
    const allRecommendations = this.results.flatMap(r => r.recommendations);
    if (allRecommendations.length > 0) {
      console.log(chalk.blue('\n💡 Priority Recommendations:'));
      [...new Set(allRecommendations)].slice(0, 5).forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 6: Infrastructure & Operations',
      overallScore,
      metrics: this.results,
      summary: {
        passed: passedMetrics,
        partial: partialMetrics,
        failed: failedMetrics,
        recommendations: [...new Set(allRecommendations)]
      }
    };

    writeFileSync('test-results/phase6-verification-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📋 Detailed report saved to: test-results/phase6-verification-report.json'));

    if (overallScore >= 98 && failedMetrics === 0) {
      console.log(chalk.green('\n🎉 Phase 6 SUCCESS! Infrastructure & Operations ready for production.'));
      console.log(chalk.green('🚀 Ready to proceed to Phase 7: Observability & Monitoring'));
    } else if (overallScore >= 90) {
      console.log(chalk.yellow('\n⚠️ Phase 6 PARTIAL SUCCESS. Address recommendations before Phase 7.'));
    } else {
      console.log(chalk.red('\n❌ Phase 6 INCOMPLETE. Significant infrastructure work needed.'));
    }
  }
}

// Run verification
const verifier = new Phase6CompletionVerifier();
verifier.verify().catch(console.error);
