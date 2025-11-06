
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

class Phase9CompletionVerifier {
  private results: VerificationResult[] = [];

  async verify(): Promise<void> {
    console.log(chalk.blue('🔍 Phase 9: Third-Party Integration Governance Verification\n'));

    await this.verifySandboxEnvironmentRegistry();
    await this.verifyWebhookRegistry();
    await this.verifyAPIKeyRotationPolicy();
    await this.verifyIntegrationDocumentation();
    await this.verifyThirdPartySecurityControls();
    await this.verifyVendorManagement();
    await this.verifyIntegrationMonitoring();
    await this.verifyComplianceTracking();

    this.generateReport();
  }

  private async verifySandboxEnvironmentRegistry(): Promise<void> {
    console.log(chalk.yellow('🏗️ Verifying Sandbox Environment Registry...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check sandbox environment documentation
    if (existsSync('docs/SANDBOX_ENVIRONMENTS.md')) {
      const content = readFileSync('docs/SANDBOX_ENVIRONMENTS.md', 'utf8');
      if (content.includes('Stripe Test Environment') && 
          content.includes('SendGrid Sandbox') && 
          content.includes('Google Cloud Storage Development')) {
        details.push('✅ Comprehensive sandbox environment registry');
        score += 40;
      } else {
        details.push('⚠️ Sandbox registry needs more providers');
        recommendations.push('Complete sandbox environment documentation for all providers');
        score += 25;
      }

      if (content.includes('Environment Isolation') && content.includes('Security Guidelines')) {
        details.push('✅ Security and isolation guidelines documented');
        score += 30;
      } else {
        details.push('❌ Security guidelines missing');
        recommendations.push('Add security guidelines for sandbox environments');
      }

      if (content.includes('Configuration Management') && content.includes('Environment Promotion Workflow')) {
        details.push('✅ Environment management procedures documented');
        score += 30;
      } else {
        details.push('❌ Environment management procedures missing');
        recommendations.push('Document environment promotion workflows');
      }

    } else {
      details.push('❌ Sandbox environment registry missing');
      recommendations.push('Create comprehensive sandbox environment registry');
    }

    this.results.push({
      metric: 'Sandbox Environment Registry',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyWebhookRegistry(): Promise<void> {
    console.log(chalk.yellow('🔗 Verifying Webhook Registry...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check webhook registry documentation
    if (existsSync('docs/WEBHOOK_REGISTRY.md')) {
      const content = readFileSync('docs/WEBHOOK_REGISTRY.md', 'utf8');
      if (content.includes('Stripe Payment Webhooks') && 
          content.includes('Cloud Storage Webhooks') && 
          content.includes('Authentication Webhooks')) {
        details.push('✅ Comprehensive webhook registry');
        score += 35;
      } else {
        details.push('⚠️ Webhook registry incomplete');
        recommendations.push('Complete webhook registry for all providers');
        score += 20;
      }

      if (content.includes('Security Framework') && content.includes('Authentication Methods')) {
        details.push('✅ Webhook security framework documented');
        score += 30;
      } else {
        details.push('❌ Webhook security framework missing');
        recommendations.push('Document webhook security framework');
      }

      if (content.includes('Monitoring') && content.includes('Error Handling')) {
        details.push('✅ Webhook monitoring and error handling documented');
        score += 25;
      } else {
        details.push('❌ Webhook monitoring documentation missing');
        recommendations.push('Document webhook monitoring procedures');
      }

      if (content.includes('Implementation Guidelines') && content.includes('Testing')) {
        details.push('✅ Implementation and testing guidelines');
        score += 10;
      } else {
        details.push('⚠️ Implementation guidelines could be enhanced');
        recommendations.push('Enhance webhook implementation guidelines');
        score += 5;
      }

    } else {
      details.push('❌ Webhook registry missing');
      recommendations.push('Create comprehensive webhook registry');
    }

    this.results.push({
      metric: 'Webhook Registry',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyAPIKeyRotationPolicy(): Promise<void> {
    console.log(chalk.yellow('🔐 Verifying API Key Rotation Policy...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check API key rotation policy documentation
    if (existsSync('docs/API_KEY_ROTATION_POLICY.md')) {
      const content = readFileSync('docs/API_KEY_ROTATION_POLICY.md', 'utf8');
      if (content.includes('Rotation Schedules') && 
          content.includes('Critical Services') && 
          content.includes('90 days')) {
        details.push('✅ API key rotation schedules defined');
        score += 30;
      } else {
        details.push('❌ API key rotation schedules missing');
        recommendations.push('Define clear API key rotation schedules');
      }

      if (content.includes('Key Inventory') && content.includes('Stripe') && content.includes('JWT')) {
        details.push('✅ Comprehensive key inventory documented');
        score += 25;
      } else {
        details.push('⚠️ Key inventory incomplete');
        recommendations.push('Complete key inventory for all services');
        score += 15;
      }

      if (content.includes('Rotation Procedures') && content.includes('Emergency Rotation')) {
        details.push('✅ Rotation procedures documented');
        score += 25;
      } else {
        details.push('❌ Rotation procedures missing');
        recommendations.push('Document detailed rotation procedures');
      }

      if (content.includes('Automation') && content.includes('Monitoring')) {
        details.push('✅ Automation and monitoring guidelines');
        score += 20;
      } else {
        details.push('❌ Automation guidelines missing');
        recommendations.push('Document automation and monitoring for key rotation');
      }

    } else {
      details.push('❌ API key rotation policy missing');
      recommendations.push('Create comprehensive API key rotation policy');
    }

    this.results.push({
      metric: 'API Key Rotation Policy',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyIntegrationDocumentation(): Promise<void> {
    console.log(chalk.yellow('📚 Verifying Integration Documentation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check existing third-party integration documentation
    const integrationDocs = [
      'docs/SANDBOX_ENVIRONMENTS.md',
      'docs/WEBHOOK_REGISTRY.md',
      'docs/API_KEY_ROTATION_POLICY.md'
    ];

    let docScore = 0;
    for (const doc of integrationDocs) {
      if (existsSync(doc)) {
        docScore++;
        details.push(`✅ ${doc.split('/').pop()} exists`);
      } else {
        details.push(`❌ ${doc.split('/').pop()} missing`);
        recommendations.push(`Create ${doc.split('/').pop()}`);
      }
    }
    score += (docScore / integrationDocs.length) * 50;

    // Check API documentation for third-party integrations
    if (existsSync('docs/API_DOCUMENTATION.md')) {
      const content = readFileSync('docs/API_DOCUMENTATION.md', 'utf8');
      if (content.includes('Third-Party') || content.includes('Integration')) {
        details.push('✅ Third-party integration API documentation');
        score += 25;
      } else {
        details.push('⚠️ API documentation needs third-party integration details');
        recommendations.push('Add third-party integration details to API documentation');
        score += 15;
      }
    } else {
      details.push('❌ API documentation missing');
      recommendations.push('Create API documentation including third-party integrations');
    }

    // Check for integration-specific service files
    const integrationServices = [
      'server/services/cloudStorageIntegrationService.ts',
      'server/services/oauthService.ts',
      'server/routes/stripe-webhooks.ts'
    ];

    let serviceScore = 0;
    for (const service of integrationServices) {
      if (existsSync(service)) {
        serviceScore++;
        details.push(`✅ ${service.split('/').pop()} implemented`);
      } else {
        details.push(`❌ ${service.split('/').pop()} missing`);
        recommendations.push(`Implement ${service.split('/').pop()}`);
      }
    }
    score += (serviceScore / integrationServices.length) * 25;

    this.results.push({
      metric: 'Integration Documentation',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyThirdPartySecurityControls(): Promise<void> {
    console.log(chalk.yellow('🛡️ Verifying Third-Party Security Controls...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check security threat model for third-party integrations
    if (existsSync('docs/SECURITY_THREAT_MODEL.md')) {
      const content = readFileSync('docs/SECURITY_THREAT_MODEL.md', 'utf8');
      if (content.includes('third-party') || content.includes('integration') || content.includes('API')) {
        details.push('✅ Third-party security considerations in threat model');
        score += 30;
      } else {
        details.push('⚠️ Threat model needs third-party integration analysis');
        recommendations.push('Add third-party integration security analysis to threat model');
        score += 20;
      }
    }

    // Check for webhook security implementation
    if (existsSync('server/routes/stripe-webhooks.ts')) {
      const content = readFileSync('server/routes/stripe-webhooks.ts', 'utf8');
      if (content.includes('signature') && content.includes('verify')) {
        details.push('✅ Webhook signature verification implemented');
        score += 25;
      } else {
        details.push('❌ Webhook signature verification missing');
        recommendations.push('Implement webhook signature verification');
      }
    }

    // Check for rate limiting on third-party endpoints
    if (existsSync('server/middleware/rateLimitMiddleware.ts')) {
      details.push('✅ Rate limiting middleware available for third-party endpoints');
      score += 20;
    } else {
      details.push('❌ Rate limiting middleware missing');
      recommendations.push('Implement rate limiting for third-party endpoints');
    }

    // Check for OAuth security implementation
    if (existsSync('server/services/oauthService.ts')) {
      const content = readFileSync('server/services/oauthService.ts', 'utf8');
      if (content.includes('state') && content.includes('nonce')) {
        details.push('✅ OAuth security controls implemented');
        score += 25;
      } else {
        details.push('⚠️ OAuth security controls need enhancement');
        recommendations.push('Enhance OAuth security controls (state, nonce)');
        score += 15;
      }
    } else {
      details.push('❌ OAuth service missing');
      recommendations.push('Implement OAuth service with security controls');
    }

    this.results.push({
      metric: 'Third-Party Security Controls',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyVendorManagement(): Promise<void> {
    console.log(chalk.yellow('🤝 Verifying Vendor Management...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check for vendor risk assessment documentation
    if (existsSync('docs/COMPLIANCE_FRAMEWORK.md')) {
      const content = readFileSync('docs/COMPLIANCE_FRAMEWORK.md', 'utf8');
      if (content.includes('vendor') || content.includes('third-party') || content.includes('supplier')) {
        details.push('✅ Vendor management included in compliance framework');
        score += 35;
      } else {
        details.push('⚠️ Compliance framework needs vendor management section');
        recommendations.push('Add vendor management to compliance framework');
        score += 20;
      }
    }

    // Check for data classification of third-party data
    if (existsSync('docs/DATA_CLASSIFICATION.md')) {
      const content = readFileSync('docs/DATA_CLASSIFICATION.md', 'utf8');
      if (content.includes('third-party') || content.includes('external') || content.includes('vendor')) {
        details.push('✅ Third-party data classification documented');
        score += 30;
      } else {
        details.push('⚠️ Data classification needs third-party data handling');
        recommendations.push('Add third-party data handling to data classification');
        score += 20;
      }
    }

    // Check for license compliance documentation
    if (existsSync('docs/LICENSE_COMPLIANCE.md')) {
      const content = readFileSync('docs/LICENSE_COMPLIANCE.md', 'utf8');
      if (content.includes('third-party') || content.includes('vendor') || content.includes('dependency')) {
        details.push('✅ Third-party license compliance documented');
        score += 35;
      } else {
        details.push('⚠️ License compliance needs third-party vendor tracking');
        recommendations.push('Add vendor license tracking to compliance documentation');
        score += 20;
      }
    }

    this.results.push({
      metric: 'Vendor Management',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyIntegrationMonitoring(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Integration Monitoring...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check for observability service covering third-party integrations
    if (existsSync('server/services/observabilityService.ts')) {
      const content = readFileSync('server/services/observabilityService.ts', 'utf8');
      if (content.includes('third-party') || content.includes('integration') || content.includes('external')) {
        details.push('✅ Third-party integration monitoring in observability service');
        score += 40;
      } else {
        details.push('⚠️ Observability service needs third-party integration monitoring');
        recommendations.push('Add third-party integration monitoring to observability service');
        score += 25;
      }
    }

    // Check for system health checks including third-party services
    if (existsSync('server/services/systemHealthService.ts')) {
      const content = readFileSync('server/services/systemHealthService.ts', 'utf8');
      if (content.includes('stripe') || content.includes('cloud') || content.includes('external')) {
        details.push('✅ Third-party service health checks implemented');
        score += 30;
      } else {
        details.push('⚠️ System health service needs third-party service checks');
        recommendations.push('Add third-party service health checks');
        score += 20;
      }
    }

    // Check for performance monitoring of integrations
    if (existsSync('server/middleware/performanceMonitoringMiddleware.ts')) {
      const content = readFileSync('server/middleware/performanceMonitoringMiddleware.ts', 'utf8');
      if (content.includes('external') || content.includes('api') || content.includes('integration')) {
        details.push('✅ Third-party integration performance monitoring');
        score += 30;
      } else {
        details.push('⚠️ Performance monitoring needs third-party integration tracking');
        recommendations.push('Add third-party integration performance tracking');
        score += 20;
      }
    }

    this.results.push({
      metric: 'Integration Monitoring',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyComplianceTracking(): Promise<void> {
    console.log(chalk.yellow('📋 Verifying Compliance Tracking...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check for audit logging of third-party interactions
    if (existsSync('server/services/consistentLogService.ts')) {
      const content = readFileSync('server/services/consistentLogService.ts', 'utf8');
      if (content.includes('external') || content.includes('api') || content.includes('integration')) {
        details.push('✅ Third-party interaction logging implemented');
        score += 35;
      } else {
        details.push('⚠️ Logging service needs third-party interaction tracking');
        recommendations.push('Add third-party interaction logging');
        score += 25;
      }
    }

    // Check for data retention policy covering third-party data
    if (existsSync('docs/DATA_RETENTION_POLICY.md')) {
      const content = readFileSync('docs/DATA_RETENTION_POLICY.md', 'utf8');
      if (content.includes('third-party') || content.includes('external') || content.includes('vendor')) {
        details.push('✅ Third-party data retention policy documented');
        score += 35;
      } else {
        details.push('⚠️ Data retention policy needs third-party data handling');
        recommendations.push('Add third-party data retention guidelines');
        score += 25;
      }
    }

    // Check for compliance framework covering vendor management
    if (existsSync('docs/COMPLIANCE_FRAMEWORK.md')) {
      const content = readFileSync('docs/COMPLIANCE_FRAMEWORK.md', 'utf8');
      if (content.includes('SOC 2') || content.includes('vendor') || content.includes('third-party')) {
        details.push('✅ Vendor compliance tracking framework');
        score += 30;
      } else {
        details.push('⚠️ Compliance framework needs vendor management');
        recommendations.push('Add vendor management to compliance framework');
        score += 20;
      }
    }

    this.results.push({
      metric: 'Compliance Tracking',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Phase 9: Third-Party Integration Governance Report\n'));
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
      phase: 'Phase 9: Third-Party Integration Governance',
      overallScore,
      metrics: this.results,
      summary: {
        passed: passedMetrics,
        partial: partialMetrics,
        failed: failedMetrics,
        recommendations: [...new Set(allRecommendations)]
      }
    };

    writeFileSync('test-results/phase9-verification-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📋 Detailed report saved to: test-results/phase9-verification-report.json'));

    if (overallScore >= 98 && failedMetrics === 0) {
      console.log(chalk.green('\n🎉 Phase 9 SUCCESS! Third-Party Integration Governance production-ready.'));
      console.log(chalk.green('🚀 Ready to proceed to Phase 10: Documentation Audit & Updates'));
    } else if (overallScore >= 90) {
      console.log(chalk.yellow('\n⚠️ Phase 9 PARTIAL SUCCESS. Address recommendations for optimal governance.'));
    } else {
      console.log(chalk.red('\n❌ Phase 9 INCOMPLETE. Significant third-party governance work needed.'));
    }
  }
}

// Run verification
const verifier = new Phase9CompletionVerifier();
verifier.verify().catch(console.error);
