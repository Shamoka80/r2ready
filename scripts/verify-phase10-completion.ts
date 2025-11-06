
#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';

interface VerificationResult {
  metric: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  score: number;
  details: string[];
  recommendations: string[];
}

class Phase10CompletionVerifier {
  private results: VerificationResult[] = [];

  async verify(): Promise<void> {
    console.log(chalk.blue('🔍 Phase 10: Documentation Audit & Updates Verification\n'));

    await this.verifyUserJourneyDocumentation();
    await this.verifyAPIDocumentationAccuracy();
    await this.verifyDeploymentGuideAccuracy();
    await this.verifyDocumentationIndex();
    await this.verifyDocumentationCompleteness();
    await this.verifyDocumentationConsistency();
    await this.verifyTechnicalDocumentation();
    await this.verifyComplianceDocumentation();

    this.generateReport();
  }

  private async verifyUserJourneyDocumentation(): Promise<void> {
    console.log(chalk.yellow('👤 Verifying User Journey Documentation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check if User_Flow.md exists and is current
    if (existsSync('User_Flow.md')) {
      const content = readFileSync('User_Flow.md', 'utf8');
      if (content.includes('payment-first registration') || content.includes('onboarding before payment')) {
        details.push('✅ User_Flow.md reflects current registration flow');
        score += 30;
      } else {
        details.push('⚠️ User_Flow.md needs update for current registration flow');
        recommendations.push('Update User_Flow.md to reflect payment-first registration');
        score += 15;
      }

      if (content.includes('license activation') && content.includes('setup completion')) {
        details.push('✅ License activation flow documented');
        score += 20;
      } else {
        details.push('❌ License activation flow missing from documentation');
        recommendations.push('Add license activation flow to User_Flow.md');
      }
    } else {
      details.push('❌ User_Flow.md missing');
      recommendations.push('Create comprehensive User_Flow.md');
    }

    // Check Returning_User_Flow.md
    if (existsSync('Returning_User_Flow.md')) {
      const content = readFileSync('Returning_User_Flow.md', 'utf8');
      if (content.includes('setup_complete') && content.includes('dashboard access')) {
        details.push('✅ Returning user flow accurately documented');
        score += 25;
      } else {
        details.push('⚠️ Returning user flow needs accuracy updates');
        recommendations.push('Update returning user flow for current implementation');
        score += 15;
      }
    } else {
      details.push('❌ Returning_User_Flow.md missing');
      recommendations.push('Create Returning_User_Flow.md');
    }

    // Check recent changes documentation
    if (existsSync('replit.md')) {
      const content = readFileSync('replit.md', 'utf8');
      if (content.includes('Phase 10') || content.includes('documentation audit')) {
        details.push('✅ Recent changes documented in replit.md');
        score += 25;
      } else {
        details.push('⚠️ Recent changes not fully documented');
        recommendations.push('Update replit.md with Phase 10 changes');
        score += 15;
      }
    }

    this.results.push({
      metric: 'User Journey Documentation',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyAPIDocumentationAccuracy(): Promise<void> {
    console.log(chalk.yellow('🔌 Verifying API Documentation Accuracy...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check API documentation exists
    if (existsSync('docs/API_DOCUMENTATION.md')) {
      const content = readFileSync('docs/API_DOCUMENTATION.md', 'utf8');
      
      // Check for key endpoints
      const keyEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/assessments',
        '/api/facilities',
        '/api/stripe/webhook'
      ];

      let endpointScore = 0;
      for (const endpoint of keyEndpoints) {
        if (content.includes(endpoint)) {
          endpointScore++;
        }
      }
      
      if (endpointScore === keyEndpoints.length) {
        details.push('✅ All key API endpoints documented');
        score += 40;
      } else {
        details.push(`⚠️ Missing ${keyEndpoints.length - endpointScore} key endpoints in documentation`);
        recommendations.push('Complete API endpoint documentation');
        score += (endpointScore / keyEndpoints.length) * 40;
      }

      // Check for authentication documentation
      if (content.includes('JWT') && content.includes('Authorization: Bearer')) {
        details.push('✅ Authentication properly documented');
        score += 30;
      } else {
        details.push('❌ Authentication documentation incomplete');
        recommendations.push('Update authentication documentation');
      }

      // Check for error handling documentation
      if (content.includes('error') && content.includes('HTTP Status Codes')) {
        details.push('✅ Error handling documented');
        score += 30;
      } else {
        details.push('❌ Error handling documentation missing');
        recommendations.push('Add comprehensive error handling documentation');
      }

    } else {
      details.push('❌ API documentation missing');
      recommendations.push('Create comprehensive API documentation');
    }

    this.results.push({
      metric: 'API Documentation Accuracy',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDeploymentGuideAccuracy(): Promise<void> {
    console.log(chalk.yellow('🚀 Verifying Deployment Guide Accuracy...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check deployment guide exists
    if (existsSync('docs/DEPLOYMENT_GUIDE.md')) {
      const content = readFileSync('docs/DEPLOYMENT_GUIDE.md', 'utf8');

      // Check for Replit-specific instructions
      if (content.includes('Replit') && content.includes('.replit')) {
        details.push('✅ Replit deployment instructions present');
        score += 30;
      } else {
        details.push('⚠️ Replit deployment instructions need enhancement');
        recommendations.push('Update deployment guide for Replit platform');
        score += 15;
      }

      // Check for environment variables
      if (content.includes('DATABASE_URL') && content.includes('JWT_SECRET')) {
        details.push('✅ Environment variables documented');
        score += 25;
      } else {
        details.push('❌ Environment variables documentation incomplete');
        recommendations.push('Complete environment variables documentation');
      }

      // Check for troubleshooting section
      if (content.includes('Troubleshooting') || content.includes('Common Issues')) {
        details.push('✅ Troubleshooting section included');
        score += 25;
      } else {
        details.push('❌ Troubleshooting section missing');
        recommendations.push('Add troubleshooting section to deployment guide');
      }

      // Check for production optimization
      if (content.includes('production') && content.includes('optimization')) {
        details.push('✅ Production optimization guidance included');
        score += 20;
      } else {
        details.push('⚠️ Production optimization guidance needs improvement');
        recommendations.push('Enhance production optimization guidance');
        score += 10;
      }

    } else {
      details.push('❌ Deployment guide missing');
      recommendations.push('Create comprehensive deployment guide');
    }

    this.results.push({
      metric: 'Deployment Guide Accuracy',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDocumentationIndex(): Promise<void> {
    console.log(chalk.yellow('📇 Verifying Documentation Index...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check for documentation index
    if (existsSync('docs/INDEX.md')) {
      const content = readFileSync('docs/INDEX.md', 'utf8');
      
      // Check for organized sections
      if (content.includes('developer') && content.includes('ops') && content.includes('business')) {
        details.push('✅ Documentation organized by audience');
        score += 40;
      } else {
        details.push('⚠️ Documentation organization needs improvement');
        recommendations.push('Organize documentation by audience (developer, ops, business)');
        score += 20;
      }

      // Check for comprehensive coverage
      const keyDocs = [
        'API_DOCUMENTATION.md',
        'DEPLOYMENT_GUIDE.md',
        'DEVELOPMENT_SETUP.md',
        'SECURITY_THREAT_MODEL.md',
        'COMPLIANCE_FRAMEWORK.md'
      ];

      let docCoverage = 0;
      for (const doc of keyDocs) {
        if (content.includes(doc)) {
          docCoverage++;
        }
      }

      if (docCoverage === keyDocs.length) {
        details.push('✅ All key documentation linked in index');
        score += 40;
      } else {
        details.push(`⚠️ Missing ${keyDocs.length - docCoverage} key documents in index`);
        recommendations.push('Complete documentation index with all key documents');
        score += (docCoverage / keyDocs.length) * 40;
      }

      // Check for search/navigation aids
      if (content.includes('Quick Start') || content.includes('Getting Started')) {
        details.push('✅ Quick start guidance provided');
        score += 20;
      } else {
        details.push('❌ Quick start guidance missing');
        recommendations.push('Add quick start section to documentation index');
      }

    } else {
      details.push('❌ Documentation index missing');
      recommendations.push('Create comprehensive documentation index');
    }

    this.results.push({
      metric: 'Documentation Index',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDocumentationCompleteness(): Promise<void> {
    console.log(chalk.yellow('📋 Verifying Documentation Completeness...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check for all required documentation files
    const requiredDocs = [
      'docs/API_DOCUMENTATION.md',
      'docs/DEPLOYMENT_GUIDE.md',
      'docs/DEVELOPMENT_SETUP.md',
      'docs/SECURITY_THREAT_MODEL.md',
      'docs/COMPLIANCE_FRAMEWORK.md',
      'docs/DATA_CLASSIFICATION.md',
      'docs/PERFORMANCE_BUDGETS.md',
      'docs/SLO_TARGETS.md',
      'docs/DEFINITION_OF_DONE.md',
      'docs/TESTING_GUIDE.md'
    ];

    let completedDocs = 0;
    for (const doc of requiredDocs) {
      if (existsSync(doc)) {
        completedDocs++;
        details.push(`✅ ${doc.split('/').pop()} exists`);
      } else {
        details.push(`❌ ${doc.split('/').pop()} missing`);
        recommendations.push(`Create ${doc.split('/').pop()}`);
      }
    }

    score = (completedDocs / requiredDocs.length) * 100;

    this.results.push({
      metric: 'Documentation Completeness',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDocumentationConsistency(): Promise<void> {
    console.log(chalk.yellow('🔄 Verifying Documentation Consistency...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check README.md
    if (existsSync('README.md')) {
      const content = readFileSync('README.md', 'utf8');
      
      // Check for current project description
      if (content.includes('RuR2') || content.includes('R2v3')) {
        details.push('✅ README reflects current project name');
        score += 25;
      } else {
        details.push('❌ README needs project name update');
        recommendations.push('Update README with current project information');
      }

      // Check for setup instructions
      if (content.includes('npm install') && content.includes('npm run dev')) {
        details.push('✅ Basic setup instructions present');
        score += 25;
      } else {
        details.push('❌ Setup instructions missing or incomplete');
        recommendations.push('Add comprehensive setup instructions to README');
      }

      // Check for links to detailed documentation
      if (content.includes('docs/') || content.includes('documentation')) {
        details.push('✅ Links to documentation provided');
        score += 25;
      } else {
        details.push('❌ Links to documentation missing');
        recommendations.push('Add links to detailed documentation in README');
      }

      // Check for current technology stack
      if (content.includes('React') && content.includes('Express') && content.includes('PostgreSQL')) {
        details.push('✅ Current technology stack documented');
        score += 25;
      } else {
        details.push('⚠️ Technology stack documentation needs update');
        recommendations.push('Update technology stack information in README');
        score += 15;
      }

    } else {
      details.push('❌ README.md missing');
      recommendations.push('Create comprehensive README.md');
    }

    this.results.push({
      metric: 'Documentation Consistency',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyTechnicalDocumentation(): Promise<void> {
    console.log(chalk.yellow('⚙️ Verifying Technical Documentation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check codebase structure documentation
    if (existsSync('docs/CODEBASE_STRUCTURE.md')) {
      const content = readFileSync('docs/CODEBASE_STRUCTURE.md', 'utf8');
      if (content.includes('client/') && content.includes('server/') && content.includes('shared/')) {
        details.push('✅ Codebase structure documented');
        score += 30;
      } else {
        details.push('⚠️ Codebase structure documentation incomplete');
        recommendations.push('Update codebase structure documentation');
        score += 15;
      }
    } else {
      details.push('❌ Codebase structure documentation missing');
      recommendations.push('Create codebase structure documentation');
    }

    // Check development setup guide
    if (existsSync('docs/DEVELOPMENT_SETUP.md')) {
      const content = readFileSync('docs/DEVELOPMENT_SETUP.md', 'utf8');
      if (content.includes('Prerequisites') && content.includes('Quick Start')) {
        details.push('✅ Development setup guide comprehensive');
        score += 35;
      } else {
        details.push('⚠️ Development setup guide needs enhancement');
        recommendations.push('Enhance development setup guide');
        score += 20;
      }
    }

    // Check testing documentation
    if (existsSync('docs/TESTING_GUIDE.md')) {
      const content = readFileSync('docs/TESTING_GUIDE.md', 'utf8');
      if (content.includes('mock payment') && content.includes('test accounts')) {
        details.push('✅ Testing guide includes mock payment documentation');
        score += 35;
      } else {
        details.push('⚠️ Testing guide needs mock payment documentation');
        recommendations.push('Update testing guide with mock payment instructions');
        score += 20;
      }
    }

    this.results.push({
      metric: 'Technical Documentation',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyComplianceDocumentation(): Promise<void> {
    console.log(chalk.yellow('📜 Verifying Compliance Documentation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check security documentation
    if (existsSync('docs/SECURITY_THREAT_MODEL.md')) {
      const content = readFileSync('docs/SECURITY_THREAT_MODEL.md', 'utf8');
      if (content.includes('STRIDE') && content.includes('authentication')) {
        details.push('✅ Security threat model comprehensive');
        score += 25;
      } else {
        details.push('⚠️ Security threat model needs enhancement');
        recommendations.push('Enhance security threat model documentation');
        score += 15;
      }
    }

    // Check compliance framework
    if (existsSync('docs/COMPLIANCE_FRAMEWORK.md')) {
      const content = readFileSync('docs/COMPLIANCE_FRAMEWORK.md', 'utf8');
      if (content.includes('GDPR') && content.includes('data subject rights')) {
        details.push('✅ Compliance framework comprehensive');
        score += 25;
      } else {
        details.push('⚠️ Compliance framework needs enhancement');
        recommendations.push('Enhance compliance framework documentation');
        score += 15;
      }
    }

    // Check data classification
    if (existsSync('docs/DATA_CLASSIFICATION.md')) {
      details.push('✅ Data classification policy documented');
      score += 25;
    } else {
      details.push('❌ Data classification documentation missing');
      recommendations.push('Create data classification documentation');
    }

    // Check data retention policy
    if (existsSync('docs/DATA_RETENTION_POLICY.md')) {
      details.push('✅ Data retention policy documented');
      score += 25;
    } else {
      details.push('❌ Data retention policy documentation missing');
      recommendations.push('Create data retention policy documentation');
    }

    this.results.push({
      metric: 'Compliance Documentation',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Phase 10: Documentation Audit & Updates Report\n'));
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
      phase: 'Phase 10: Documentation Audit & Updates',
      overallScore,
      metrics: this.results,
      summary: {
        passed: passedMetrics,
        partial: partialMetrics,
        failed: failedMetrics,
        recommendations: [...new Set(allRecommendations)]
      }
    };

    writeFileSync('test-results/phase10-verification-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📋 Detailed report saved to: test-results/phase10-verification-report.json'));

    if (overallScore >= 98 && failedMetrics === 0) {
      console.log(chalk.green('\n🎉 Phase 10 SUCCESS! Documentation audit complete - production ready!'));
      console.log(chalk.green('🚀 Ready to proceed to Phase 11: Acceptance & Quality Gates'));
    } else if (overallScore >= 90) {
      console.log(chalk.yellow('\n⚠️ Phase 10 PARTIAL SUCCESS. Address recommendations for optimal documentation.'));
    } else {
      console.log(chalk.red('\n❌ Phase 10 INCOMPLETE. Significant documentation work needed.'));
    }
  }
}

// Run verification
const verifier = new Phase10CompletionVerifier();
verifier.verify().catch(console.error);
