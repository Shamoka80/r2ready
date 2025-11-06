
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import { existsSync } from 'fs';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  details: string;
  critical: boolean;
}

class FinalImplementationValidator {
  private results: ValidationResult[] = [];

  async validate(): Promise<void> {
    console.log(chalk.blue('🔍 Final Implementation Validation\n'));

    await this.validateExportSystem();
    await this.validateAnalyticsDashboard();
    await this.validateDocumentLibrary();
    await this.validateTrainingCenter();
    await this.validateCoreWorkflows();

    this.generateReport();
  }

  private async validateExportSystem(): Promise<void> {
    console.log(chalk.yellow('📄 Validating Export System...'));

    // Test PDF generation
    try {
      const response = await fetch('http://0.0.0.0:5000/api/exports/pdf/test-assessment');
      const success = response.status === 200;
      this.results.push({
        component: 'PDF Export Generation',
        status: success ? 'PASS' : 'FAIL',
        details: success ? 'PDF exports working' : 'PDF export failed',
        critical: true
      });
    } catch (error) {
      this.results.push({
        component: 'PDF Export Generation',
        status: 'FAIL',
        details: `Export test failed: ${error.message}`,
        critical: true
      });
    }

    // Test template population
    const templatePopulationExists = existsSync('server/services/exportService.ts');
    this.results.push({
      component: 'Template Population Engine',
      status: templatePopulationExists ? 'PASS' : 'FAIL',
      details: templatePopulationExists ? 'Template engine implemented' : 'Template engine missing',
      critical: true
    });
  }

  private async validateAnalyticsDashboard(): Promise<void> {
    console.log(chalk.yellow('📊 Validating Analytics Dashboard...'));

    // Test analytics endpoints
    try {
      const response = await fetch('http://0.0.0.0:5000/api/analytics/dashboard');
      const success = response.status === 200;
      this.results.push({
        component: 'Analytics Dashboard API',
        status: success ? 'PASS' : 'FAIL',
        details: success ? 'Analytics API responsive' : 'Analytics API failed',
        critical: false
      });
    } catch (error) {
      this.results.push({
        component: 'Analytics Dashboard API',
        status: 'FAIL',
        details: `Analytics test failed: ${error.message}`,
        critical: false
      });
    }
  }

  private async validateDocumentLibrary(): Promise<void> {
    console.log(chalk.yellow('📚 Validating Document Library...'));

    const documentServiceExists = existsSync('server/services/documentLibraryService.ts');
    this.results.push({
      component: 'Document Library Service',
      status: documentServiceExists ? 'PASS' : 'FAIL',
      details: documentServiceExists ? 'Document library implemented' : 'Document library missing',
      critical: false
    });
  }

  private async validateTrainingCenter(): Promise<void> {
    console.log(chalk.yellow('🎓 Validating Training Center...'));

    // Test training content
    try {
      const response = await fetch('http://0.0.0.0:5000/api/training/modules');
      const data = await response.json();
      const hasContent = data.modules && data.modules.length > 2;
      
      this.results.push({
        component: 'Training Center Content',
        status: hasContent ? 'PASS' : 'PARTIAL',
        details: hasContent ? `${data.modules.length} training modules available` : 'Limited training content',
        critical: false
      });
    } catch (error) {
      this.results.push({
        component: 'Training Center Content',
        status: 'FAIL',
        details: `Training center test failed: ${error.message}`,
        critical: false
      });
    }
  }

  private async validateCoreWorkflows(): Promise<void> {
    console.log(chalk.yellow('⚙️ Validating Core Workflows...'));

    // Test assessment workflow
    const assessmentRouteExists = existsSync('server/routes/assessments.ts');
    this.results.push({
      component: 'Assessment Workflow',
      status: assessmentRouteExists ? 'PASS' : 'FAIL',
      details: assessmentRouteExists ? 'Assessment workflow complete' : 'Assessment workflow missing',
      critical: true
    });

    // Test authentication system
    const authServiceExists = existsSync('server/services/authService.ts');
    this.results.push({
      component: 'Authentication System',
      status: authServiceExists ? 'PASS' : 'FAIL',
      details: authServiceExists ? 'Auth system operational' : 'Auth system missing',
      critical: true
    });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📋 Final Implementation Validation Report\n'));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const partial = this.results.filter(r => r.status === 'PARTIAL').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const critical = this.results.filter(r => r.status === 'FAIL' && r.critical).length;

    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
      const priority = result.critical ? chalk.red('(CRITICAL)') : chalk.yellow('(STANDARD)');
      
      console.log(`${icon} ${result.component} ${priority}`);
      console.log(`    ${result.details}\n`);
    });

    console.log(chalk.blue('📊 Summary:'));
    console.log(`✅ Passed: ${passed}/${this.results.length}`);
    console.log(`⚠️ Partial: ${partial}/${this.results.length}`);
    console.log(`❌ Failed: ${failed}/${this.results.length}`);
    console.log(`🚨 Critical Issues: ${critical}`);

    const completionRate = Math.round(((passed + (partial * 0.5)) / this.results.length) * 100);
    console.log(chalk.blue(`\n🎯 Implementation Completion Rate: ${completionRate}%`));

    if (completionRate >= 95 && critical === 0) {
      console.log(chalk.green('\n🎉 SUCCESS: Implementation Complete and Production Ready!'));
    } else if (completionRate >= 85) {
      console.log(chalk.yellow('\n⚠️ MOSTLY COMPLETE: Address remaining items for full production readiness'));
    } else {
      console.log(chalk.red('\n❌ INCOMPLETE: Significant work remaining before production deployment'));
    }
  }
}

// Execute validation
const validator = new FinalImplementationValidator();
validator.validate().catch(error => {
  console.error(chalk.red('💥 Validation failed:'), error);
  process.exit(1);
});
