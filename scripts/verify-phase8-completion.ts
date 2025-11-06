
#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import { db } from '../server/db';
import { systemLogs } from '../shared/schema';
import { eq, sql, and, gte } from 'drizzle-orm';

interface VerificationResult {
  metric: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  score: number;
  details: string[];
  recommendations: string[];
}

class Phase8CompletionVerifier {
  private results: VerificationResult[] = [];

  async verify(): Promise<void> {
    console.log(chalk.blue('🔍 Phase 8: Dependency & Supply Chain Security Verification\n'));

    await this.verifyRenovateConfiguration();
    await this.verifyDependencyAuditAutomation();
    await this.verifyLicenseCompliance();
    await this.verifySoftwareBillOfMaterials();
    await this.verifyVulnerabilityScanning();
    await this.verifyDependencyMonitoring();
    await this.verifySupplyChainSecurity();
    await this.verifyAutomatedUpdates();

    this.generateReport();
  }

  private async verifyRenovateConfiguration(): Promise<void> {
    console.log(chalk.yellow('🔄 Verifying Renovate Configuration...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check renovate configuration file
    if (existsSync('renovate.json')) {
      const content = readFileSync('renovate.json', 'utf8');
      try {
        const config = JSON.parse(content);
        if (config.schedule && config.automerge && config.grouping) {
          details.push('✅ Comprehensive Renovate configuration');
          score += 50;
        } else {
          details.push('⚠️ Basic Renovate configuration needs enhancement');
          recommendations.push('Enhance Renovate with scheduling and automerge rules');
          score += 30;
        }
      } catch (error) {
        details.push('❌ Invalid Renovate configuration JSON');
        recommendations.push('Fix Renovate configuration syntax');
      }
    } else {
      details.push('❌ Renovate configuration missing');
      recommendations.push('Create renovate.json configuration');
    }

    // Check GitHub dependabot
    if (existsSync('.github/dependabot.yml')) {
      details.push('✅ GitHub Dependabot configured');
      score += 25;
    } else {
      details.push('❌ GitHub Dependabot missing');
      recommendations.push('Configure GitHub Dependabot');
    }

    // Check for automated dependency scripts
    if (existsSync('scripts/dependency-check.ts')) {
      details.push('✅ Dependency check script exists');
      score += 25;
    } else {
      details.push('❌ Dependency check script missing');
      recommendations.push('Create dependency check automation script');
    }

    this.results.push({
      metric: 'Renovate Configuration',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDependencyAuditAutomation(): Promise<void> {
    console.log(chalk.yellow('🔍 Verifying Dependency Audit Automation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check package.json for audit scripts
    if (existsSync('package.json')) {
      const content = readFileSync('package.json', 'utf8');
      const pkg = JSON.parse(content);
      if (pkg.scripts && pkg.scripts['audit:check']) {
        details.push('✅ NPM audit script configured');
        score += 30;
      } else {
        details.push('❌ NPM audit script missing');
        recommendations.push('Add npm audit script to package.json');
      }
    }

    // Check server package.json
    if (existsSync('server/package.json')) {
      const content = readFileSync('server/package.json', 'utf8');
      const pkg = JSON.parse(content);
      if (pkg.scripts && pkg.scripts['audit:check']) {
        details.push('✅ Server NPM audit script configured');
        score += 30;
      } else {
        details.push('❌ Server NPM audit script missing');
        recommendations.push('Add npm audit script to server package.json');
      }
    }

    // Check CI/CD integration
    if (existsSync('.github/workflows/security-audit.yml')) {
      details.push('✅ Security audit workflow exists');
      score += 40;
    } else {
      details.push('❌ Security audit workflow missing');
      recommendations.push('Create security audit GitHub workflow');
    }

    this.results.push({
      metric: 'Dependency Audit Automation',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyLicenseCompliance(): Promise<void> {
    console.log(chalk.yellow('📜 Verifying License Compliance...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check license compliance documentation
    if (existsSync('docs/LICENSE_COMPLIANCE.md')) {
      const content = readFileSync('docs/LICENSE_COMPLIANCE.md', 'utf8');
      if (content.includes('MIT') && content.includes('Apache-2.0') && content.includes('BSD-3-Clause')) {
        details.push('✅ License compliance policy documented');
        score += 40;
      } else {
        details.push('⚠️ License policy needs enhancement');
        recommendations.push('Complete license compliance documentation');
        score += 20;
      }
    } else {
      details.push('❌ License compliance documentation missing');
      recommendations.push('Create license compliance documentation');
    }

    // Check license report generation script
    if (existsSync('scripts/generate-license-report.ts')) {
      details.push('✅ License report generator exists');
      score += 30;
    } else {
      details.push('❌ License report generator missing');
      recommendations.push('Create license report generation script');
    }

    // Check for license scanner in CI
    if (existsSync('.github/workflows/license-check.yml')) {
      details.push('✅ License scanning in CI');
      score += 30;
    } else {
      details.push('❌ License scanning not automated');
      recommendations.push('Add license scanning to CI pipeline');
    }

    this.results.push({
      metric: 'License Compliance',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifySoftwareBillOfMaterials(): Promise<void> {
    console.log(chalk.yellow('📋 Verifying Software Bill of Materials (SBOM)...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check SBOM generation script
    if (existsSync('scripts/generate-sbom.ts')) {
      details.push('✅ SBOM generation script exists');
      score += 40;
    } else {
      details.push('❌ SBOM generation script missing');
      recommendations.push('Create SBOM generation script');
    }

    // Check releases directory for SBOM storage
    if (existsSync('releases/')) {
      details.push('✅ Releases directory exists for SBOM storage');
      score += 20;
    } else {
      details.push('❌ Releases directory missing');
      recommendations.push('Create releases directory for SBOM storage');
    }

    // Check SBOM automation in CI
    if (existsSync('.github/workflows/sbom-generation.yml')) {
      details.push('✅ SBOM generation automated');
      score += 40;
    } else {
      details.push('❌ SBOM generation not automated');
      recommendations.push('Automate SBOM generation in release process');
    }

    this.results.push({
      metric: 'Software Bill of Materials (SBOM)',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyVulnerabilityScanning(): Promise<void> {
    console.log(chalk.yellow('🛡️ Verifying Vulnerability Scanning...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check vulnerability scanning service
    if (existsSync('server/services/vulnerabilityScanningService.ts')) {
      details.push('✅ Vulnerability scanning service exists');
      score += 35;
    } else {
      details.push('❌ Vulnerability scanning service missing');
      recommendations.push('Create vulnerability scanning service');
    }

    // Check Snyk or similar tool integration
    if (existsSync('.snyk') || existsSync('package.json')) {
      const packageContent = readFileSync('package.json', 'utf8');
      if (packageContent.includes('snyk') || packageContent.includes('audit')) {
        details.push('✅ Vulnerability scanning tools configured');
        score += 35;
      } else {
        details.push('⚠️ Basic scanning available, enhanced tools recommended');
        recommendations.push('Integrate advanced vulnerability scanning tools');
        score += 20;
      }
    }

    // Check vulnerability database updates
    if (existsSync('scripts/update-vulnerability-db.ts')) {
      details.push('✅ Vulnerability database update script');
      score += 30;
    } else {
      details.push('❌ Vulnerability database update automation missing');
      recommendations.push('Create vulnerability database update automation');
    }

    this.results.push({
      metric: 'Vulnerability Scanning',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDependencyMonitoring(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Dependency Monitoring...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check dependency monitoring service
    if (existsSync('server/services/dependencyMonitoringService.ts')) {
      details.push('✅ Dependency monitoring service exists');
      score += 40;
    } else {
      details.push('❌ Dependency monitoring service missing');
      recommendations.push('Create dependency monitoring service');
    }

    // Check dependency health dashboard
    if (existsSync('client/src/pages/DependencyDashboard.tsx')) {
      details.push('✅ Dependency health dashboard exists');
      score += 30;
    } else {
      details.push('❌ Dependency health dashboard missing');
      recommendations.push('Create dependency health dashboard');
    }

    // Check monitoring integration
    if (existsSync('server/routes/dependency-monitoring.ts')) {
      details.push('✅ Dependency monitoring API endpoints');
      score += 30;
    } else {
      details.push('❌ Dependency monitoring API missing');
      recommendations.push('Create dependency monitoring API endpoints');
    }

    this.results.push({
      metric: 'Dependency Monitoring',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifySupplyChainSecurity(): Promise<void> {
    console.log(chalk.yellow('🔗 Verifying Supply Chain Security...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check supply chain security documentation
    if (existsSync('docs/SUPPLY_CHAIN_SECURITY.md')) {
      details.push('✅ Supply chain security policy documented');
      score += 30;
    } else {
      details.push('❌ Supply chain security documentation missing');
      recommendations.push('Create supply chain security documentation');
    }

    // Check package-lock integrity
    if (existsSync('package-lock.json') && existsSync('server/package-lock.json')) {
      details.push('✅ Package lock files present for integrity');
      score += 25;
    } else {
      details.push('⚠️ Some package lock files missing');
      recommendations.push('Ensure all package lock files are committed');
      score += 15;
    }

    // Check integrity verification
    if (existsSync('scripts/verify-package-integrity.ts')) {
      details.push('✅ Package integrity verification script');
      score += 25;
    } else {
      details.push('❌ Package integrity verification missing');
      recommendations.push('Create package integrity verification');
    }

    // Check supply chain attack protection
    if (existsSync('server/middleware/supplyChainProtectionMiddleware.ts')) {
      details.push('✅ Supply chain protection middleware');
      score += 20;
    } else {
      details.push('❌ Supply chain protection middleware missing');
      recommendations.push('Implement supply chain protection middleware');
    }

    this.results.push({
      metric: 'Supply Chain Security',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyAutomatedUpdates(): Promise<void> {
    console.log(chalk.yellow('🤖 Verifying Automated Updates...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check automated update service
    if (existsSync('server/services/automatedUpdateService.ts')) {
      details.push('✅ Automated update service exists');
      score += 40;
    } else {
      details.push('❌ Automated update service missing');
      recommendations.push('Create automated update service');
    }

    // Check update policies
    if (existsSync('docs/UPDATE_POLICY.md')) {
      details.push('✅ Update policy documented');
      score += 30;
    } else {
      details.push('❌ Update policy documentation missing');
      recommendations.push('Create update policy documentation');
    }

    // Check automated testing for updates
    if (existsSync('.github/workflows/dependency-updates.yml')) {
      details.push('✅ Automated testing for dependency updates');
      score += 30;
    } else {
      details.push('❌ Automated update testing missing');
      recommendations.push('Create automated testing for dependency updates');
    }

    this.results.push({
      metric: 'Automated Updates',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Phase 8: Dependency & Supply Chain Security Report\n'));
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
      phase: 'Phase 8: Dependency & Supply Chain Security',
      overallScore,
      metrics: this.results,
      summary: {
        passed: passedMetrics,
        partial: partialMetrics,
        failed: failedMetrics,
        recommendations: [...new Set(allRecommendations)]
      }
    };

    writeFileSync('test-results/phase8-verification-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📋 Detailed report saved to: test-results/phase8-verification-report.json'));

    if (overallScore >= 98 && failedMetrics === 0) {
      console.log(chalk.green('\n🎉 Phase 8 SUCCESS! Dependency & Supply Chain Security production-ready.'));
      console.log(chalk.green('🚀 Ready to proceed to Phase 9: Third-Party Integration Governance'));
    } else if (overallScore >= 90) {
      console.log(chalk.yellow('\n⚠️ Phase 8 PARTIAL SUCCESS. Address recommendations for optimal security.'));
    } else {
      console.log(chalk.red('\n❌ Phase 8 INCOMPLETE. Significant dependency security work needed.'));
    }
  }
}

// Run verification
const verifier = new Phase8CompletionVerifier();
verifier.verify().catch(console.error);
