import chalk from 'chalk';
import { performance } from 'perf_hooks';
import { cacheService } from '../server/services/cachingService';
import { queryOptimizationService } from '../server/services/queryOptimizationService';
import { ConsistentLogService } from '../server/services/consistentLogService';
import { ObservabilityService } from '../server/services/observabilityService';
import { randomUUID } from 'crypto';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  opsPerSecond: number;
  success: boolean;
  error?: string;
}

class PerformanceBenchmark {
  private logger = ConsistentLogService.getInstance();
  private results: BenchmarkResult[] = [];

  async run(): Promise<void> {
    console.log(chalk.blue('⚡ Performance Benchmarking Suite'));
    console.log(chalk.blue('=================================='));

    await this.benchmarkCacheOperations();
    await this.benchmarkQueryOptimization();
    await this.benchmarkLoggingPerformance();
    await this.benchmarkObservabilityOverhead();
    await this.generateBenchmarkReport();
  }

  private async benchmarkCacheOperations(): Promise<void> {
    console.log(chalk.yellow('🔧 Benchmarking Cache Operations...'));

    // Cache SET operations
    await this.runBenchmark('Cache SET operations', 1000, async (i) => {
      await cacheService.set(`test:key:${i}`, { data: `value-${i}`, timestamp: Date.now() });
    });

    // Cache GET operations
    await this.runBenchmark('Cache GET operations', 1000, async (i) => {
      await cacheService.get(`test:key:${i % 100}`); // Get from existing keys
    });

    // Cache invalidation by tags
    await this.runBenchmark('Cache tag invalidation', 10, async (i) => {
      await cacheService.invalidateByTags([`tag-${i}`]);
    });

    // Complex cache query
    await this.runBenchmark('Cache query operations', 100, async (i) => {
      await cacheService.cacheQuery(
        `complex:query:${i}`,
        async () => ({ complexData: Array.from({ length: 100 }, (_, j) => `item-${j}`) }),
        { ttl: 60000, tags: ['complex', `query-${i}`] }
      );
    });
  }

  private async benchmarkQueryOptimization(): Promise<void> {
    console.log(chalk.yellow('🗄️ Benchmarking Query Optimization...'));

    // Single user queries (with cache)
    await this.runBenchmark('Single user query (cached)', 100, async (i) => {
      await queryOptimizationService.getUserById(`user-${i % 10}`, { useCache: true });
    });

    // Batch user queries
    await this.runBenchmark('Batch user queries', 20, async (i) => {
      const userIds = Array.from({ length: 10 }, (_, j) => `user-${i * 10 + j}`);
      await queryOptimizationService.getUsersByIds(userIds, { useCache: true });
    });

    // Paginated assessments
    await this.runBenchmark('Paginated assessments', 50, async (i) => {
      await queryOptimizationService.getAssessmentsPaginated(
        `tenant-${i % 5}`,
        { limit: 25, offset: i * 25, useCache: true }
      );
    });

    // Assessment with details
    await this.runBenchmark('Assessment with details', 50, async (i) => {
      await queryOptimizationService.getAssessmentWithDetails(
        `assessment-${i % 20}`,
        { useCache: true, includeRelations: ['answers', 'evidence'] }
      );
    });
  }

  private async benchmarkLoggingPerformance(): Promise<void> {
    console.log(chalk.yellow('📝 Benchmarking Logging Performance...'));

    // Basic logging operations
    await this.runBenchmark('Debug logging', 500, async (i) => {
      await this.logger.debug(`Debug message ${i}`, {
        service: 'benchmark',
        operation: 'test',
        metadata: { iteration: i }
      });
    });

    await this.runBenchmark('Info logging', 500, async (i) => {
      await this.logger.info(`Info message ${i}`, {
        service: 'benchmark',
        operation: 'test',
        userId: `user-${i % 10}`,
        tenantId: `tenant-${i % 3}`
      });
    });

    // Structured logging
    await this.runBenchmark('API request logging', 200, async (i) => {
      await this.logger.logApiRequest(
        'GET',
        `/api/test/${i}`,
        200,
        Math.random() * 1000,
        {
          service: 'benchmark',
          operation: 'test-api',
          userId: `user-${i % 10}`
        }
      );
    });

    // Performance tracking
    await this.runBenchmark('Performance tracking', 100, async (i) => {
      const trackerId = `bench-${i}`;
      this.logger.startPerformanceTracker(trackerId, {
        service: 'benchmark',
        operation: 'performance-test',
        userId: `user-${i % 10}`
      });

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

      await this.logger.endPerformanceTracker(trackerId, {
        queryCount: Math.floor(Math.random() * 5),
        cacheHits: Math.floor(Math.random() * 3)
      });
    });
  }

  private async benchmarkObservabilityOverhead(): Promise<void> {
    console.log(chalk.yellow('📊 Benchmarking Observability Overhead...'));

    // Health check operations
    await this.runBenchmark('System health checks', 50, async () => {
      await ObservabilityService.getSystemHealth();
    });

    // Performance analytics
    await this.runBenchmark('Performance analytics', 20, async () => {
      await ObservabilityService.getPerformanceAnalytics('1h');
    });

    // Metric recording
    await this.runBenchmark('Metric recording', 200, async (i) => {
      await ObservabilityService.recordMetric(
        'test_metric',
        Math.random() * 100,
        'ms',
        {
          service: 'benchmark',
          operation: 'test',
          userId: `user-${i % 10}`
        }
      );
    });

    // Log retrieval
    await this.runBenchmark('Log retrieval', 30, async (i) => {
      await ObservabilityService.getLogs({
        service: 'benchmark',
        limit: 50,
        since: new Date(Date.now() - 60000) // Last minute
      });
    });
  }

  private async runBenchmark(
    operation: string,
    iterations: number,
    testFunction: (iteration: number) => Promise<void>
  ): Promise<void> {
    console.log(chalk.gray(`  Running ${operation}...`));

    const startTime = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < iterations; i++) {
        await testFunction(i);
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    const opsPerSecond = 1000 / averageTime;

    this.results.push({
      operation,
      iterations,
      totalTime,
      averageTime,
      opsPerSecond,
      success,
      error
    });

    if (success) {
      console.log(chalk.green(`    ✅ ${operation}: ${averageTime.toFixed(2)}ms avg, ${opsPerSecond.toFixed(0)} ops/sec`));
    } else {
      console.log(chalk.red(`    ❌ ${operation}: Failed - ${error}`));
    }
  }

  private async generateBenchmarkReport(): Promise<void> {
    console.log(chalk.blue('\n📊 Performance Benchmark Report'));
    console.log(chalk.blue('================================'));

    const successfulBenchmarks = this.results.filter(r => r.success);
    const failedBenchmarks = this.results.filter(r => !r.success);

    console.log(chalk.green(`✅ Successful benchmarks: ${successfulBenchmarks.length}`));
    console.log(chalk.red(`❌ Failed benchmarks: ${failedBenchmarks.length}`));

    if (successfulBenchmarks.length > 0) {
      console.log(chalk.blue('\n🏆 Top Performing Operations:'));
      const sortedByOps = successfulBenchmarks
        .sort((a, b) => b.opsPerSecond - a.opsPerSecond)
        .slice(0, 5);

      sortedByOps.forEach((result, index) => {
        console.log(`${index + 1}. ${result.operation}: ${result.opsPerSecond.toFixed(0)} ops/sec`);
      });

      console.log(chalk.blue('\n⏱️ Fastest Operations (by average time):'));
      const sortedByTime = successfulBenchmarks
        .sort((a, b) => a.averageTime - b.averageTime)
        .slice(0, 5);

      sortedByTime.forEach((result, index) => {
        console.log(`${index + 1}. ${result.operation}: ${result.averageTime.toFixed(2)}ms avg`);
      });
    }

    if (failedBenchmarks.length > 0) {
      console.log(chalk.red('\n🚨 Failed Operations:'));
      failedBenchmarks.forEach(result => {
        console.log(`❌ ${result.operation}: ${result.error}`);
      });
    }

    // Performance thresholds
    const cacheOps = successfulBenchmarks.filter(r => r.operation.includes('Cache'));
    const queryOps = successfulBenchmarks.filter(r => r.operation.includes('query') || r.operation.includes('Assessment'));
    const loggingOps = successfulBenchmarks.filter(r => r.operation.includes('logging') || r.operation.includes('API request'));

    console.log(chalk.blue('\n🎯 Performance Analysis:'));

    if (cacheOps.length > 0) {
      const avgCacheOps = cacheOps.reduce((sum, r) => sum + r.opsPerSecond, 0) / cacheOps.length;
      const cacheRating = avgCacheOps > 1000 ? 'Excellent' : avgCacheOps > 500 ? 'Good' : 'Needs Improvement';
      console.log(`Cache Performance: ${avgCacheOps.toFixed(0)} avg ops/sec - ${cacheRating}`);
    }

    if (queryOps.length > 0) {
      const avgQueryTime = queryOps.reduce((sum, r) => sum + r.averageTime, 0) / queryOps.length;
      const queryRating = avgQueryTime < 50 ? 'Excellent' : avgQueryTime < 100 ? 'Good' : 'Needs Improvement';
      console.log(`Query Performance: ${avgQueryTime.toFixed(2)}ms avg - ${queryRating}`);
    }

    if (loggingOps.length > 0) {
      const avgLoggingOps = loggingOps.reduce((sum, r) => sum + r.opsPerSecond, 0) / loggingOps.length;
      const loggingRating = avgLoggingOps > 2000 ? 'Excellent' : avgLoggingOps > 1000 ? 'Good' : 'Needs Improvement';
      console.log(`Logging Performance: ${avgLoggingOps.toFixed(0)} avg ops/sec - ${loggingRating}`);
    }

    // Save detailed benchmark results
    const fs = await import('fs');
    fs.writeFileSync('test-results/performance-benchmark.json', JSON.stringify(report, null, 2));
    console.log(chalk.blue('\n📄 Detailed benchmark saved to test-results/performance-benchmark.json'));

    // Clean up test data
    console.log(chalk.gray('\n🧹 Cleaning up test data...'));
    try {
      await cacheService.clear();
      console.log(chalk.green('✅ Cache cleared'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not clear cache (may not be critical)'));
    }
  }
}

const benchmark = new PerformanceBenchmark();
benchmark.run().catch(console.error);