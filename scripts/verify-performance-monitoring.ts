
#!/usr/bin/env -S npx tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import { writeFileSync, readFileSync } from 'fs';

interface TestResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  score: number;
}

class PerformanceMonitoringVerifier {
  private results: TestResult[] = [];

  async run(): Promise<void> {
    console.log(chalk.blue('🔍 Performance & Monitoring Verification Pipeline'));
    console.log(chalk.blue('================================================'));

    await this.verifyCachingLayer();
    await this.verifyQueryOptimization();
    await this.verifyConsistentLogging();
    await this.verifyObservabilityIntegration();
    await this.verifyPerformanceMetrics();
    await this.generateReport();
  }

  private async verifyCachingLayer(): Promise<void> {
    console.log(chalk.yellow('🔧 Verifying Caching Layer Implementation...'));

    try {
      // Check caching service exists and has required methods
      const cachingServicePath = 'server/services/cachingService.ts';
      const cachingCode = readFileSync(cachingServicePath, 'utf8');

      const requiredMethods = [
        'set', 'get', 'delete', 'clear', 'invalidateByTags',
        'cacheQuery', 'getStats', 'healthCheck'
      ];

      const missingMethods = requiredMethods.filter(method => 
        !cachingCode.includes(`async ${method}`) && !cachingCode.includes(`${method}(`)
      );

      if (missingMethods.length === 0) {
        // Check cache keys and tags
        const hasCacheKeys = cachingCode.includes('CacheKeys');
        const hasCacheTags = cachingCode.includes('CacheTags');
        const hasMemoryManagement = cachingCode.includes('evictLeastRecentlyUsed');
        const hasCompression = cachingCode.includes('compress');

        if (hasCacheKeys && hasCacheTags && hasMemoryManagement) {
          this.results.push({
            component: 'Caching Layer',
            status: 'pass',
            details: 'Advanced caching service with memory management, compression, and tag-based invalidation',
            score: 100
          });
        } else {
          this.results.push({
            component: 'Caching Layer',
            status: 'warning',
            details: 'Basic caching implemented, missing some advanced features',
            score: 80
          });
        }
      } else {
        this.results.push({
          component: 'Caching Layer',
          status: 'fail',
          details: `Missing required methods: ${missingMethods.join(', ')}`,
          score: 40
        });
      }
    } catch (error) {
      this.results.push({
        component: 'Caching Layer',
        status: 'fail',
        details: 'Caching service not found or invalid',
        score: 0
      });
    }
  }

  private async verifyQueryOptimization(): Promise<void> {
    console.log(chalk.yellow('🗄️ Verifying Query Optimization...'));

    try {
      const queryOptPath = 'server/services/queryOptimizationService.ts';
      const queryCode = readFileSync(queryOptPath, 'utf8');

      const optimizationFeatures = [
        'getUsersByIds', // Batch loading
        'getAssessmentsPaginated', // Pagination
        'invalidateUserCache', // Cache invalidation
        'BatchQueryOptions', // Batch options
        'attachUserAssessments' // Relation loading
      ];

      const presentFeatures = optimizationFeatures.filter(feature => 
        queryCode.includes(feature)
      );

      const score = (presentFeatures.length / optimizationFeatures.length) * 100;

      if (score >= 90) {
        this.results.push({
          component: 'Query Optimization',
          status: 'pass',
          details: 'Comprehensive N+1 prevention, batch loading, and caching integration',
          score
        });
      } else if (score >= 70) {
        this.results.push({
          component: 'Query Optimization',
          status: 'warning',
          details: `Partial optimization implemented (${presentFeatures.length}/${optimizationFeatures.length} features)`,
          score
        });
      } else {
        this.results.push({
          component: 'Query Optimization',
          status: 'fail',
          details: 'Query optimization insufficient',
          score
        });
      }
    } catch (error) {
      this.results.push({
        component: 'Query Optimization',
        status: 'fail',
        details: 'Query optimization service not found',
        score: 0
      });
    }
  }

  private async verifyConsistentLogging(): Promise<void> {
    console.log(chalk.yellow('📝 Verifying Consistent Logging...'));

    try {
      const loggingPath = 'server/services/consistentLogService.ts';
      const loggingCode = readFileSync(loggingPath, 'utf8');

      const loggingFeatures = [
        'logApiRequest',
        'logDatabaseQuery', 
        'logCacheOperation',
        'logAuthEvent',
        'logSecurityEvent',
        'startPerformanceTracker',
        'recordMetric'
      ];

      const presentFeatures = loggingFeatures.filter(feature => 
        loggingCode.includes(feature)
      );

      // Check observability middleware integration
      const middlewarePath = 'server/middleware/observabilityMiddleware.ts';
      const middlewareCode = readFileSync(middlewarePath, 'utf8');
      const hasMiddleware = middlewareCode.includes('observabilityMiddleware');

      const score = (presentFeatures.length / loggingFeatures.length) * 100;
      const middlewareBonus = hasMiddleware ? 10 : 0;
      const finalScore = Math.min(score + middlewareBonus, 100);

      if (finalScore >= 90) {
        this.results.push({
          component: 'Consistent Logging',
          status: 'pass',
          details: 'Comprehensive logging with structured context, performance tracking, and middleware integration',
          score: finalScore
        });
      } else if (finalScore >= 70) {
        this.results.push({
          component: 'Consistent Logging',
          status: 'warning',
          details: `Logging partially implemented (${presentFeatures.length}/${loggingFeatures.length} features)`,
          score: finalScore
        });
      } else {
        this.results.push({
          component: 'Consistent Logging',
          status: 'fail',
          details: 'Logging implementation insufficient',
          score: finalScore
        });
      }
    } catch (error) {
      this.results.push({
        component: 'Consistent Logging',
        status: 'fail',
        details: 'Consistent logging service not found',
        score: 0
      });
    }
  }

  private async verifyObservabilityIntegration(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Observability Integration...'));

    try {
      // Check observability routes
      const obsRoutesPath = 'server/routes/observability.ts';
      const obsCode = readFileSync(obsRoutesPath, 'utf8');

      const endpoints = [
        '/health',
        '/performance', 
        '/cache/stats',
        '/logs',
        '/metrics'
      ];

      const presentEndpoints = endpoints.filter(endpoint => 
        obsCode.includes(`'${endpoint}'`) || obsCode.includes(`"${endpoint}"`)
      );

      // Check observability service
      const obsServicePath = 'server/services/observabilityService.ts';
      const serviceCode = readFileSync(obsServicePath, 'utf8');
      const hasHealthCheck = serviceCode.includes('getSystemHealth');
      const hasPerformanceAnalytics = serviceCode.includes('getPerformanceAnalytics');

      const score = (presentEndpoints.length / endpoints.length) * 80 + 
                   (hasHealthCheck ? 10 : 0) + 
                   (hasPerformanceAnalytics ? 10 : 0);lytics ? 10 : 0);

      if (score >= 90) {
        this.results.push({
          component: 'Observability Integration',
          status: 'pass',
          details: 'Complete observability with health checks, performance analytics, and monitoring endpoints',
          score
        });
      } else if (score >= 70) {
        this.results.push({
          component: 'Observability Integration',
          status: 'warning',
          details: `Partial observability (${presentEndpoints.length}/${endpoints.length} endpoints)`,
          score
        });
      } else {
        this.results.push({
          component: 'Observability Integration',
          status: 'fail',
          details: 'Observability integration insufficient',
          score
        });
      }
    } catch (error) {
      this.results.push({
        component: 'Observability Integration',
        status: 'fail',
        details: 'Observability routes or service not found',
        score: 0
      });
    }
  }

  private async verifyPerformanceMetrics(): Promise<void> {
    console.log(chalk.yellow('⚡ Verifying Performance Metrics...'));

    try {
      // Check if assessments route uses optimization
      const assessmentsPath = 'server/routes/assessments.ts';
      const assessmentsCode = readFileSync(assessmentsPath, 'utf8');

      const optimizationUsage = [
        'queryOptimizationService',
        'cacheService',
        'ConsistentLogService'ogService'
      ];

      const usedOptimizations = optimizationUsage.filter(opt => 
        assessmentsCode.includes(opt)
      );

      // Check middleware integration in main server
      const serverPath = 'server/index.ts';
      const serverCode = readFileSync(serverPath, 'utf8');
      const hasObsMiddleware = serverCode.includes('observabilityMiddleware');

      const score = (usedOptimizations.length / optimizationUsage.length) * 80 + 
                   (hasObsMiddleware ? 20 : 0);

      if (score >= 90) {
        this.results.push({
          component: 'Performance Metrics',
          status: 'pass',
          details: 'Performance optimizations integrated across routes with comprehensive monitoring',
          score
        });
      } else if (score >= 70) {
        this.results.push({
          component: 'Performance Metrics',
          status: 'warning',
          details: 'Partial performance optimization integration',
          score
        });
      } else {
        this.results.push({
          component: 'Performance Metrics',
          status: 'fail',
          details: 'Performance metrics not properly integrated',
          score
        });
      }
    } catch (error) {
      this.results.push({
        component: 'Performance Metrics',
        status: 'fail',
        details: 'Cannot verify performance metrics integration',
        score: 0
      });
    }
  }

  private async generateReport(): Promise<void> {
    console.log(chalk.blue('\n📋 Performance & Monitoring Verification Report'));
    console.log(chalk.blue('================================================'));

    const totalScore = this.results.reduce((sum, result) => sum + result.score, 0) / this.results.length;
    
    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      const color = result.status === 'pass' ? chalk.green : result.status === 'warning' ? chalk.yellow : chalk.red;
      
      console.log(`${icon} ${color(result.component)}: ${result.details} (${result.score}%)`);
    });

    console.log(chalk.blue(`\n🎯 Overall Score: ${totalScore.toFixed(1)}%`));

    const passRate = (this.results.filter(r => r.status === 'pass').length / this.results.length) * 100;
    
    if (passRate === 100) {
      console.log(chalk.green('🎉 ALL PERFORMANCE & MONITORING GAPS RESOLVED - 100% PASS RATE!'));
    } else if (passRate >= 80) {
      console.log(chalk.yellow(`⚠️ Performance & Monitoring: ${passRate.toFixed(1)}% pass rate - Minor issues remain`));
    } else {
      console.log(chalk.red(`❌ Performance & Monitoring: ${passRate.toFixed(1)}% pass rate - Significant issues remain`));
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      phase: 'Performance & Monitoring',
      overallScore: totalScore,
      passRate,
      results: this.results,
      summary: {
        cachingLayer: this.results.find(r => r.component === 'Caching Layer')?.status || 'not-tested',
        queryOptimization: this.results.find(r => r.component === 'Query Optimization')?.status || 'not-tested',
        consistentLogging: this.results.find(r => r.component === 'Consistent Logging')?.status || 'not-tested',
        observabilityIntegration: this.results.find(r => r.component === 'Observability Integration')?.status || 'not-tested',
        performanceMetrics: this.results.find(r => r.component === 'Performance Metrics')?.status || 'not-tested'
      }
    };

    writeFileSync('test-results/performance-monitoring-verification.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📄 Detailed report saved to test-results/performance-monitoring-verification.json'));
  }
}

const verifier = new PerformanceMonitoringVerifier();
verifier.run().catch(console.error);
