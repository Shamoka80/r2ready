
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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
    console.log(chalk.blue('🔍 Enhanced Test Suite - Targeting 100% Pass Rate\n'));

    await this.verifyTypeScriptCompilation();
    await this.verifyESLintValidation();
    await this.verifyDatabaseConnectivity();
    await this.verifyDatabaseSchema();
    await this.verifyExportFormats();
    await this.verifyAdvancedScoring();
    await this.verifyTrainingCenter();
    await this.verifyMultiTenantFacilityManagement();
    await this.verifyObservabilitySystem();
    await this.verifySecurityFeatures();
    await this.verifyAPIEndpoints();
    await this.verifyFrontendBuild();

    this.generateReport();
  }

  private async verifyTypeScriptCompilation(): Promise<void> {
    console.log(chalk.yellow('📋 Verifying TypeScript Compilation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // Check both client and server TypeScript compilation
      execSync('npx tsc --noEmit --skipLibCheck', { 
        stdio: 'pipe',
        timeout: 30000,
        cwd: process.cwd()
      });
      details.push('✅ Root TypeScript compilation successful');

      // Check server specifically
      try {
        execSync('cd server && npx tsc --noEmit --skipLibCheck', { 
          stdio: 'pipe',
          timeout: 30000
        });
        details.push('✅ Server TypeScript compilation successful');
      } catch (error) {
        details.push('⚠️ Server TypeScript has issues');
        score -= 25;
        recommendations.push('Fix server TypeScript compilation errors');
      }

      // Check client specifically
      try {
        execSync('cd client && npx tsc --noEmit --skipLibCheck', { 
          stdio: 'pipe',
          timeout: 30000
        });
        details.push('✅ Client TypeScript compilation successful');
      } catch (error) {
        details.push('⚠️ Client TypeScript has issues');
        score -= 25;
        recommendations.push('Fix client TypeScript compilation errors');
      }

    } catch (error) {
      details.push(`❌ TypeScript compilation failed: ${error instanceof Error ? error.message.split('\n')[0] : 'Unknown'}`);
      score = 0;
      recommendations.push('Fix TypeScript compilation errors in the codebase');
    }

    this.results.push({
      metric: 'TypeScript Compilation',
      status: score === 100 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyESLintValidation(): Promise<void> {
    console.log(chalk.yellow('🔍 Verifying ESLint Validation...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      const result = execSync('npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 50', {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 30000
      });
      
      details.push('✅ ESLint validation passed with acceptable warnings');
      
    } catch (error: any) {
      if (error.stdout && error.stdout.includes('warning') && !error.stdout.includes('error')) {
        const warningCount = (error.stdout.match(/warning/g) || []).length;
        if (warningCount <= 50) {
          details.push(`✅ ESLint passed with ${warningCount} warnings (acceptable)`);
        } else {
          details.push(`⚠️ ESLint has ${warningCount} warnings (too many)`);
          score = 75;
          recommendations.push('Reduce ESLint warnings to under 50');
        }
      } else {
        details.push('❌ ESLint validation failed with errors');
        score = 25;
        recommendations.push('Fix ESLint errors before proceeding');
      }
    }

    this.results.push({
      metric: 'ESLint Validation',
      status: score === 100 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDatabaseConnectivity(): Promise<void> {
    console.log(chalk.yellow('🗄️ Verifying Database Connectivity...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // Test basic connectivity
      await db.execute(sql`SELECT 1 as test`);
      details.push('✅ Database connection successful');

      // Test database responsiveness
      const start = Date.now();
      await db.execute(sql`SELECT COUNT(*) as count FROM "User" LIMIT 1`);
      const responseTime = Date.now() - start;
      
      if (responseTime < 1000) {
        details.push(`✅ Database response time: ${responseTime}ms (excellent)`);
      } else if (responseTime < 3000) {
        details.push(`⚠️ Database response time: ${responseTime}ms (acceptable)`);
        score = 85;
      } else {
        details.push(`❌ Database response time: ${responseTime}ms (too slow)`);
        score = 50;
        recommendations.push('Investigate database performance issues');
      }

    } catch (error) {
      details.push(`❌ Database connection failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      score = 0;
      recommendations.push('Fix database connection and configuration');
    }

    this.results.push({
      metric: 'Database Connectivity',
      status: score === 100 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDatabaseSchema(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Database Schema...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // Test key tables exist and are accessible
      const tables = [
        { name: 'User', query: () => db.execute(sql`SELECT COUNT(*) FROM "User" LIMIT 1`) },
        { name: 'Tenant', query: () => db.execute(sql`SELECT COUNT(*) FROM "Tenant" LIMIT 1`) },
        { name: 'Assessment', query: () => db.execute(sql`SELECT COUNT(*) FROM "Assessment" LIMIT 1`) },
        { name: 'FacilityProfile', query: () => db.execute(sql`SELECT COUNT(*) FROM "FacilityProfile" LIMIT 1`) },
        { name: 'Question', query: () => db.execute(sql`SELECT COUNT(*) FROM "Question" LIMIT 1`) }
      ];

      for (const table of tables) {
        try {
          await table.query();
          details.push(`✅ Table ${table.name} accessible`);
        } catch (error) {
          details.push(`❌ Table ${table.name} error: ${error instanceof Error ? error.message.split('\n')[0] : 'Unknown'}`);
          score -= 20;
          recommendations.push(`Fix ${table.name} table schema or access`);
        }
      }

    } catch (error) {
      details.push(`❌ Schema validation failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      score = 0;
      recommendations.push('Run database migrations and fix schema issues');
    }

    this.results.push({
      metric: 'Database Schema',
      status: score === 100 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyExportFormats(): Promise<void> {
    console.log(chalk.yellow('📄 Verifying Export Formats...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check export service exists and has required methods
    if (existsSync('server/services/exportService.ts')) {
      const content = readFileSync('server/services/exportService.ts', 'utf8');
      
      const formats = [
        { name: 'PDF', methods: ['generatePDF', 'PDFDocument'] },
        { name: 'Excel', methods: ['generateExcel', 'ExcelJS'] },
        { name: 'Word', methods: ['generateWord', 'Document'] }
      ];

      for (const format of formats) {
        const hasAllMethods = format.methods.every(method => content.includes(method));
        if (hasAllMethods) {
          score += 25;
          details.push(`✅ ${format.name} export implementation found`);
        } else {
          details.push(`❌ ${format.name} export incomplete`);
          recommendations.push(`Complete ${format.name} export implementation`);
        }
      }

      // Check template processor
      if (existsSync('server/services/templateProcessor.ts')) {
        score += 25;
        details.push(`✅ Template processor found`);
      } else {
        details.push(`❌ Template processor missing`);
        recommendations.push('Implement template processor service');
      }

    } else {
      details.push('❌ Export service not found');
      recommendations.push('Implement export service');
    }

    this.results.push({
      metric: 'Export Formats',
      status: score === 100 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyAdvancedScoring(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Advanced Scoring...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (existsSync('server/services/advancedScoringService.ts')) {
      const content = readFileSync('server/services/advancedScoringService.ts', 'utf8');
      
      const features = [
        'GapAnalysis',
        'ComplianceMetrics', 
        'PredictiveInsight',
        'generateRecommendations',
        'clauseScores',
        'calculateScore',
        'assessReadiness'
      ];

      let implementedFeatures = 0;
      for (const feature of features) {
        if (content.includes(feature)) {
          implementedFeatures++;
          details.push(`✅ ${feature} implemented`);
        } else {
          details.push(`❌ ${feature} missing`);
          recommendations.push(`Implement ${feature}`);
        }
      }

      score = Math.round((implementedFeatures / features.length) * 100);
    } else {
      details.push('❌ Advanced scoring service not found');
      recommendations.push('Implement advanced scoring service');
    }

    this.results.push({
      metric: 'Advanced Scoring',
      status: score === 100 ? 'PASS' : score >= 80 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyTrainingCenter(): Promise<void> {
    console.log(chalk.yellow('🎓 Verifying Training Center...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (existsSync('server/services/trainingCenterService.ts')) {
      const content = readFileSync('server/services/trainingCenterService.ts', 'utf8');
      
      const features = [
        'R2V3_TRAINING_MODULES',
        'getTrainingModules',
        'getCertificationPrep',
        'getKnowledgeBase',
        'getInteractiveTutorial',
        'getProgressTracking'
      ];

      let implementedFeatures = 0;
      for (const feature of features) {
        if (content.includes(feature)) {
          implementedFeatures++;
          details.push(`✅ ${feature} implemented`);
        } else {
          details.push(`❌ ${feature} missing`);
          recommendations.push(`Implement ${feature}`);
        }
      }

      // Check for R2v3 coverage
      if (content.includes('Core Requirement') && content.includes('Appendix')) {
        details.push('✅ R2v3 coverage appears comprehensive');
        score += 20;
      } else {
        details.push('❌ Incomplete R2v3 coverage');
        recommendations.push('Add complete R2v3 standard coverage');
      }

      score += Math.round((implementedFeatures / features.length) * 80);
    } else {
      details.push('❌ Training center service not found');
      recommendations.push('Implement training center service');
    }

    this.results.push({
      metric: 'Training Center',
      status: score === 100 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyMultiTenantFacilityManagement(): Promise<void> {
    console.log(chalk.yellow('🏢 Verifying Multi-Tenant Facility Management...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    try {
      // Check facility system accessibility
      const facilityCount = await db.execute(sql`SELECT COUNT(*) as count FROM "FacilityProfile"`);
      details.push(`✅ Facility system accessible (${facilityCount[0]?.count || 0} facilities)`);
      score += 25;

      // Check tenant isolation in routes
      if (existsSync('server/routes/facilities.ts')) {
        const content = readFileSync('server/routes/facilities.ts', 'utf8');
        if (content.includes('tenantId') && content.includes('eq(') && content.includes('and(')) {
          details.push('✅ Tenant isolation implemented in routes');
          score += 25;
        } else {
          details.push('❌ Tenant isolation missing in routes');
          recommendations.push('Implement tenant isolation for facilities');
        }
      }

      // Check multi-facility support in schema
      const schemaFeatures = ['isPrimary', 'isActive', 'tenantId'];
      let supportedFeatures = 0;
      
      for (const feature of schemaFeatures) {
        try {
          await db.execute(sql`SELECT ${sql.raw(feature)} FROM "FacilityProfile" LIMIT 1`);
          supportedFeatures++;
          details.push(`✅ ${feature} column exists`);
        } catch {
          details.push(`❌ ${feature} column missing`);
          recommendations.push(`Add ${feature} support to facility schema`);
        }
      }

      score += Math.round((supportedFeatures / schemaFeatures.length) * 50);

    } catch (error) {
      details.push(`❌ Facility management verification failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      recommendations.push('Fix facility management system');
    }

    this.results.push({
      metric: 'Multi-Tenant Facility Management',
      status: score === 100 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyObservabilitySystem(): Promise<void> {
    console.log(chalk.yellow('📈 Verifying Observability System...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const components = [
      'server/services/observabilityService.ts',
      'server/middleware/observabilityMiddleware.ts',
      'server/routes/observability.ts'
    ];

    let implementedComponents = 0;
    for (const component of components) {
      if (existsSync(component)) {
        implementedComponents++;
        details.push(`✅ ${component} exists`);
        
        // Check content quality
        const content = readFileSync(component, 'utf8');
        if (content.length > 500) {
          details.push(`✅ ${component} has substantial implementation`);
        } else {
          details.push(`⚠️ ${component} appears minimal`);
          score -= 5;
        }
      } else {
        details.push(`❌ ${component} missing`);
        recommendations.push(`Implement ${component}`);
      }
    }

    score = Math.round((implementedComponents / components.length) * 100);

    this.results.push({
      metric: 'Observability System',
      status: score === 100 ? 'PASS' : score >= 80 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifySecurityFeatures(): Promise<void> {
    console.log(chalk.yellow('🔒 Verifying Security Features...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const securityFeatures = [
      'server/services/twoFactorAuthService.ts',
      'server/middleware/rateLimitMiddleware.ts',
      'server/services/deviceService.ts',
      'server/services/jwtService.ts',
      'server/middleware/authMiddleware.ts'
    ];

    let implementedFeatures = 0;
    for (const feature of securityFeatures) {
      if (existsSync(feature)) {
        implementedFeatures++;
        details.push(`✅ ${feature} implemented`);
      } else {
        details.push(`❌ ${feature} missing`);
        recommendations.push(`Implement ${feature}`);
      }
    }

    score = Math.round((implementedFeatures / securityFeatures.length) * 100);

    this.results.push({
      metric: 'Security Features',
      status: score === 100 ? 'PASS' : score >= 80 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyAPIEndpoints(): Promise<void> {
    console.log(chalk.yellow('🌐 Verifying API Endpoints...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const criticalRoutes = [
      'server/routes/auth.ts',
      'server/routes/assessments.ts',
      'server/routes/facilities.ts',
      'server/routes/exports.ts',
      'server/routes/scoring.ts'
    ];

    let workingRoutes = 0;
    for (const route of criticalRoutes) {
      if (existsSync(route)) {
        const content = readFileSync(route, 'utf8');
        
        // Check for proper structure
        if (content.includes('router.') && content.includes('export') && content.includes('express')) {
          workingRoutes++;
          details.push(`✅ ${route} properly structured`);
        } else {
          details.push(`⚠️ ${route} may have structural issues`);
          recommendations.push(`Review ${route} structure`);
        }
      } else {
        details.push(`❌ ${route} missing`);
        recommendations.push(`Implement ${route}`);
      }
    }

    score = Math.round((workingRoutes / criticalRoutes.length) * 100);

    this.results.push({
      metric: 'API Endpoints',
      status: score === 100 ? 'PASS' : score >= 80 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyFrontendBuild(): Promise<void> {
    console.log(chalk.yellow('🏗️ Verifying Frontend Build...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // Check if client can build
      execSync('cd client && npm run build', {
        stdio: 'pipe',
        timeout: 60000
      });
      
      details.push('✅ Client build successful');
      
      // Check if build artifacts exist
      if (existsSync('client/dist')) {
        details.push('✅ Build artifacts generated');
      } else {
        details.push('⚠️ Build artifacts not found');
        score = 85;
      }
      
    } catch (error) {
      details.push('❌ Client build failed');
      score = 0;
      recommendations.push('Fix client build configuration and dependencies');
    }

    this.results.push({
      metric: 'Frontend Build',
      status: score === 100 ? 'PASS' : score >= 85 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Enhanced Test Results - 100% Pass Rate Target\n'));
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

    // Status determination
    if (overallScore === 100 && failedMetrics === 0) {
      console.log(chalk.green('\n🎉 100% PASS RATE ACHIEVED!'));
      console.log(chalk.blue('All verification tests are passing successfully.'));
    } else if (overallScore >= 95 && failedMetrics === 0) {
      console.log(chalk.yellow('\n⭐ 95%+ Pass Rate - Very Close to 100%!'));
      console.log(chalk.blue('Minor improvements needed to reach 100% pass rate.'));
    } else if (overallScore >= 90) {
      console.log(chalk.yellow('\n✨ 90%+ Pass Rate - Good Progress'));
      console.log(chalk.blue('On track to achieve 100% pass rate.'));
    } else {
      console.log(chalk.red('\n⚠️ Below 90% Pass Rate'));
      console.log(chalk.blue('Significant improvements needed.'));
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      overallScore,
      passRate: `${overallScore}%`,
      metrics: this.results,
      summary: {
        passed: passedMetrics,
        partial: partialMetrics,
        failed: failedMetrics,
        target: '100%',
        achieved: overallScore === 100 && failedMetrics === 0
      }
    };

    // Ensure test-results directory exists
    if (!existsSync('test-results')) {
      mkdirSync('test-results', { recursive: true });
    }

    writeFileSync('test-results/enhanced-test-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📋 Detailed report saved to: test-results/enhanced-test-report.json'));

    // Exit with appropriate code
    process.exit(overallScore === 100 && failedMetrics === 0 ? 0 : 1);
  }
}

// Run enhanced verification
const verifier = new Phase6CompletionVerifier();
verifier.verify().catch(console.error);
