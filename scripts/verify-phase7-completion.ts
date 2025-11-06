
#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import { db } from '../server/db';
import { systemLogs, performanceMetrics } from '../shared/schema';
import { eq, sql, and, gte } from 'drizzle-orm';

interface VerificationResult {
  metric: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  score: number;
  details: string[];
  recommendations: string[];
}

class Phase7CompletionVerifier {
  private results: VerificationResult[] = [];

  async verify(): Promise<void> {
    console.log(chalk.blue('🔍 Phase 7: Observability & Monitoring Verification\n'));

    await this.verifyLogSchemaStandardization();
    await this.verifyObservabilityPlatformSetup();
    await this.verifyAlertingRules();
    await this.verifyPerformanceMonitoring();
    await this.verifySystemHealthChecks();
    await this.verifyRealTimeAnalytics();
    await this.verifyDashboardIntegration();
    await this.verifyComprehensiveLogging();

    this.generateReport();
  }

  private async verifyLogSchemaStandardization(): Promise<void> {
    console.log(chalk.yellow('📝 Verifying Log Schema Standardization...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check structured logging service
    if (existsSync('server/services/consistentLogService.ts')) {
      const content = readFileSync('server/services/consistentLogService.ts', 'utf8');
      if (content.includes('logApiRequest') && content.includes('logDatabaseQuery')) {
        details.push('✅ Consistent logging service implemented');
        score += 35;
      } else {
        details.push('⚠️ Logging service needs enhancement');
        recommendations.push('Complete consistent logging service implementation');
        score += 20;
      }
    } else {
      details.push('❌ Consistent logging service missing');
      recommendations.push('Create consistent logging service');
    }

    // Check observability middleware
    if (existsSync('server/middleware/observabilityMiddleware.ts')) {
      const content = readFileSync('server/middleware/observabilityMiddleware.ts', 'utf8');
      if (content.includes('correlationId') && content.includes('requestCompletion')) {
        details.push('✅ Observability middleware integrated');
        score += 35;
      } else {
        details.push('⚠️ Observability middleware partial');
        recommendations.push('Enhance observability middleware');
        score += 20;
      }
    } else {
      details.push('❌ Observability middleware missing');
      recommendations.push('Implement observability middleware');
    }

    // Check log schema documentation
    if (existsSync('docs/LOGGING_STANDARD.md')) {
      details.push('✅ Logging standards documented');
      score += 30;
    } else {
      details.push('❌ Logging standards documentation missing');
      recommendations.push('Create logging standards documentation');
    }

    this.results.push({
      metric: 'Log Schema Standardization',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyObservabilityPlatformSetup(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Observability Platform Setup...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check observability service
    if (existsSync('server/services/observabilityService.ts')) {
      const content = readFileSync('server/services/observabilityService.ts', 'utf8');
      if (content.includes('getSystemHealth') && content.includes('getPerformanceAnalytics')) {
        details.push('✅ Observability service comprehensive');
        score += 40;
      } else {
        details.push('⚠️ Observability service basic');
        recommendations.push('Enhance observability service features');
        score += 25;
      }
    } else {
      details.push('❌ Observability service missing');
      recommendations.push('Create observability service');
    }

    // Check dashboard service
    if (existsSync('server/services/observabilityDashboardService.ts')) {
      const content = readFileSync('server/services/observabilityDashboardService.ts', 'utf8');
      if (content.includes('getSystemMetrics') && content.includes('generateHealthReport')) {
        details.push('✅ Dashboard service implemented');
        score += 40;
      } else {
        details.push('⚠️ Dashboard service incomplete');
        recommendations.push('Complete dashboard service implementation');
        score += 20;
      }
    } else {
      details.push('❌ Dashboard service missing');
      recommendations.push('Create dashboard service');
    }

    // Check observability routes
    if (existsSync('server/routes/observability.ts')) {
      const content = readFileSync('server/routes/observability.ts', 'utf8');
      if (content.includes('/health') && content.includes('/metrics')) {
        details.push('✅ Observability endpoints implemented');
        score += 20;
      } else {
        details.push('⚠️ Observability endpoints incomplete');
        recommendations.push('Complete observability endpoints');
        score += 10;
      }
    } else {
      details.push('❌ Observability routes missing');
      recommendations.push('Create observability routes');
    }

    this.results.push({
      metric: 'Observability Platform Setup',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyAlertingRules(): Promise<void> {
    console.log(chalk.yellow('🚨 Verifying Alerting Rules...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check system health service with alerting
    if (existsSync('server/services/systemHealthService.ts')) {
      const content = readFileSync('server/services/systemHealthService.ts', 'utf8');
      if (content.includes('performHealthCheck') && content.includes('checkErrorRate')) {
        details.push('✅ System health monitoring with alerts');
        score += 50;
      } else {
        details.push('⚠️ System health monitoring basic');
        recommendations.push('Enhance health monitoring with alerting');
        score += 30;
      }
    } else {
      details.push('❌ System health service missing');
      recommendations.push('Create system health service');
    }

    // Check alert runbook documentation
    if (existsSync('docs/ALERT_RUNBOOK.md')) {
      details.push('✅ Alert runbook documented');
      score += 25;
    } else {
      details.push('❌ Alert runbook missing');
      recommendations.push('Create alert runbook documentation');
    }

    // Check performance alerting
    if (existsSync('server/middleware/performanceMonitoringMiddleware.ts')) {
      const content = readFileSync('server/middleware/performanceMonitoringMiddleware.ts', 'utf8');
      if (content.includes('performanceMetrics') && content.includes('slowRequests')) {
        details.push('✅ Performance alerting configured');
        score += 25;
      } else {
        details.push('⚠️ Performance monitoring needs alerting');
        recommendations.push('Add alerting to performance monitoring');
        score += 15;
      }
    }

    this.results.push({
      metric: 'Alerting Rules',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyPerformanceMonitoring(): Promise<void> {
    console.log(chalk.yellow('⚡ Verifying Performance Monitoring...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check performance monitoring middleware
    if (existsSync('server/middleware/performanceMonitoringMiddleware.ts')) {
      const content = readFileSync('server/middleware/performanceMonitoringMiddleware.ts', 'utf8');
      if (content.includes('performanceMetrics') && content.includes('memoryUsage')) {
        details.push('✅ Performance monitoring middleware active');
        score += 40;
      } else {
        details.push('⚠️ Performance monitoring basic');
        recommendations.push('Enhance performance monitoring');
        score += 25;
      }
    } else {
      details.push('❌ Performance monitoring middleware missing');
      recommendations.push('Create performance monitoring middleware');
    }

    // Check caching service for performance
    if (existsSync('server/services/cachingService.ts')) {
      const content = readFileSync('server/services/cachingService.ts', 'utf8');
      if (content.includes('getStats') && content.includes('healthCheck')) {
        details.push('✅ Caching performance monitoring');
        score += 30;
      } else {
        details.push('⚠️ Caching service needs monitoring');
        recommendations.push('Add monitoring to caching service');
        score += 15;
      }
    }

    // Check query optimization monitoring
    if (existsSync('server/services/queryOptimizationService.ts')) {
      const content = readFileSync('server/services/queryOptimizationService.ts', 'utf8');
      if (content.includes('getQueryStats') && content.includes('slowQueries')) {
        details.push('✅ Query optimization monitoring');
        score += 30;
      } else {
        details.push('⚠️ Query optimization needs monitoring');
        recommendations.push('Add monitoring to query optimization');
        score += 15;
      }
    }

    this.results.push({
      metric: 'Performance Monitoring',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifySystemHealthChecks(): Promise<void> {
    console.log(chalk.yellow('🏥 Verifying System Health Checks...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Test actual health check functionality
    try {
      // Test database connectivity
      await db.execute(sql`SELECT 1 as health_check`);
      details.push('✅ Database health check operational');
      score += 35;
    } catch (error) {
      details.push('❌ Database health check failed');
      recommendations.push('Fix database connectivity issues');
    }

    // Check comprehensive health check script
    if (existsSync('scripts/comprehensive-health-check.ts')) {
      const content = readFileSync('scripts/comprehensive-health-check.ts', 'utf8');
      if (content.includes('runAllChecks') && content.includes('generateSummary')) {
        details.push('✅ Comprehensive health check script');
        score += 35;
      } else {
        details.push('⚠️ Health check script incomplete');
        recommendations.push('Complete health check script');
        score += 20;
      }
    } else {
      details.push('❌ Comprehensive health check script missing');
      recommendations.push('Create comprehensive health check script');
    }

    // Check system health service
    if (existsSync('server/services/systemHealthService.ts')) {
      details.push('✅ System health service exists');
      score += 30;
    } else {
      details.push('❌ System health service missing');
      recommendations.push('Create system health service');
    }

    this.results.push({
      metric: 'System Health Checks',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyRealTimeAnalytics(): Promise<void> {
    console.log(chalk.yellow('📈 Verifying Real-time Analytics...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check user activity analytics service
    if (existsSync('server/services/userActivityAnalyticsService.ts')) {
      const content = readFileSync('server/services/userActivityAnalyticsService.ts', 'utf8');
      if (content.includes('getUserActivityMetrics') && content.includes('generateUserReport')) {
        details.push('✅ User activity analytics comprehensive');
        score += 40;
      } else {
        details.push('⚠️ User activity analytics basic');
        recommendations.push('Enhance user activity analytics');
        score += 25;
      }
    } else {
      details.push('❌ User activity analytics missing');
      recommendations.push('Create user activity analytics service');
    }

    // Check analytics dashboard page
    if (existsSync('client/src/pages/AnalyticsDashboard.tsx')) {
      const content = readFileSync('client/src/pages/AnalyticsDashboard.tsx', 'utf8');
      if (content.includes('real-time') && content.includes('metrics')) {
        details.push('✅ Analytics dashboard implemented');
        score += 30;
      } else {
        details.push('⚠️ Analytics dashboard basic');
        recommendations.push('Enhance analytics dashboard');
        score += 20;
      }
    } else {
      details.push('❌ Analytics dashboard missing');
      recommendations.push('Create analytics dashboard');
    }

    // Check observability dashboard
    if (existsSync('client/src/pages/ObservabilityDashboard.tsx')) {
      details.push('✅ Observability dashboard exists');
      score += 30;
    } else {
      details.push('❌ Observability dashboard missing');
      recommendations.push('Create observability dashboard');
    }

    this.results.push({
      metric: 'Real-time Analytics',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyDashboardIntegration(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Dashboard Integration...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check if analytics dashboard is accessible
    const analyticsRoutes = [
      'client/src/pages/AnalyticsDashboard.tsx',
      'client/src/pages/ObservabilityDashboard.tsx'
    ];

    let routeScore = 0;
    for (const route of analyticsRoutes) {
      if (existsSync(route)) {
        routeScore++;
        details.push(`✅ ${route.split('/').pop()} exists`);
      } else {
        details.push(`❌ ${route.split('/').pop()} missing`);
        recommendations.push(`Create ${route.split('/').pop()}`);
      }
    }
    score += (routeScore / analyticsRoutes.length) * 50;

    // Check main app routing
    if (existsSync('client/src/App.tsx')) {
      const content = readFileSync('client/src/App.tsx', 'utf8');
      if (content.includes('AnalyticsDashboard') || content.includes('ObservabilityDashboard')) {
        details.push('✅ Analytics routes integrated in App.tsx');
        score += 25;
      } else {
        details.push('⚠️ Analytics routes not integrated');
        recommendations.push('Integrate analytics routes in App.tsx');
        score += 10;
      }
    }

    // Check navigation integration
    if (existsSync('client/src/components/layout/AppLayout.tsx')) {
      const content = readFileSync('client/src/components/layout/AppLayout.tsx', 'utf8');
      if (content.includes('Analytics') || content.includes('Observability')) {
        details.push('✅ Analytics navigation integrated');
        score += 25;
      } else {
        details.push('⚠️ Analytics navigation missing');
        recommendations.push('Add analytics navigation to layout');
        score += 10;
      }
    }

    this.results.push({
      metric: 'Dashboard Integration',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private async verifyComprehensiveLogging(): Promise<void> {
    console.log(chalk.yellow('📋 Verifying Comprehensive Logging...'));
    
    const details: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check server index integration
    if (existsSync('server/index.ts')) {
      const content = readFileSync('server/index.ts', 'utf8');
      if (content.includes('observabilityMiddleware') || content.includes('performanceMonitor')) {
        details.push('✅ Logging middleware integrated');
        score += 40;
      } else {
        details.push('⚠️ Logging middleware not integrated');
        recommendations.push('Integrate logging middleware in server');
        score += 20;
      }
    }

    // Check comprehensive testing suite
    if (existsSync('scripts/comprehensive-testing-suite.ts')) {
      details.push('✅ Comprehensive testing suite exists');
      score += 30;
    } else {
      details.push('❌ Comprehensive testing suite missing');
      recommendations.push('Create comprehensive testing suite');
    }

    // Check observability setup documentation
    if (existsSync('docs/OBSERVABILITY_SETUP.md')) {
      details.push('✅ Observability setup documented');
      score += 30;
    } else {
      details.push('❌ Observability setup documentation missing');
      recommendations.push('Create observability setup documentation');
    }

    this.results.push({
      metric: 'Comprehensive Logging',
      status: score >= 95 ? 'PASS' : score >= 75 ? 'PARTIAL' : 'FAIL',
      score,
      details,
      recommendations
    });
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Phase 7: Observability & Monitoring Report\n'));
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
      phase: 'Phase 7: Observability & Monitoring',
      overallScore,
      metrics: this.results,
      summary: {
        passed: passedMetrics,
        partial: partialMetrics,
        failed: failedMetrics,
        recommendations: [...new Set(allRecommendations)]
      }
    };

    writeFileSync('test-results/phase7-verification-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📋 Detailed report saved to: test-results/phase7-verification-report.json'));

    if (overallScore >= 98 && failedMetrics === 0) {
      console.log(chalk.green('\n🎉 Phase 7 SUCCESS! Observability & Monitoring system production-ready.'));
      console.log(chalk.green('🚀 RUR2 Application is now fully operational with comprehensive monitoring!'));
    } else if (overallScore >= 90) {
      console.log(chalk.yellow('\n⚠️ Phase 7 PARTIAL SUCCESS. Address recommendations for optimal monitoring.'));
    } else {
      console.log(chalk.red('\n❌ Phase 7 INCOMPLETE. Significant observability work needed.'));
    }
  }
}

// Run verification
const verifier = new Phase7CompletionVerifier();
verifier.verify().catch(console.error);
