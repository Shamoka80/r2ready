import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Workload Simulation Framework
 * 
 * Simulates realistic user loads to test database and application performance
 * under different traffic scenarios.
 * 
 * Usage:
 *   npx tsx server/tools/workload-simulator.ts normal
 *   npx tsx server/tools/workload-simulator.ts peak
 *   npx tsx server/tools/workload-simulator.ts stress
 *   npx tsx server/tools/workload-simulator.ts normal --save-report
 */

type ScenarioType = 'normal' | 'peak' | 'stress';

interface LoadTestReport {
  scenario: ScenarioType;
  concurrentUsers: number;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  errorRate: number;
  responseTimes: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    avg: number;
  };
  requestsPerSecond: number;
  errors: Array<{ endpoint: string; error: string; count: number }>;
  endpointMetrics: Array<{
    endpoint: string;
    method: string;
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
  }>;
  bottlenecks: string[];
  timestamp: string;
}

interface RequestResult {
  endpoint: string;
  method: string;
  duration: number;
  success: boolean;
  statusCode?: number;
  error?: string;
}

const SCENARIOS = {
  normal: {
    concurrentUsers: 100,
    duration: 60, // seconds
    description: '100 concurrent users - Normal traffic',
  },
  peak: {
    concurrentUsers: 500,
    duration: 60,
    description: '500 concurrent users - Peak traffic',
  },
  stress: {
    concurrentUsers: 1000,
    duration: 60,
    description: '1000 concurrent users - Stress test',
  },
};

// Simulated endpoints to test
const ENDPOINTS = [
  { method: 'GET', path: '/api/assessments', weight: 30 },
  { method: 'GET', path: '/api/dashboard', weight: 20 },
  { method: 'GET', path: '/api/questions', weight: 15 },
  { method: 'POST', path: '/api/answers', weight: 15 },
  { method: 'GET', path: '/api/facilities', weight: 10 },
  { method: 'GET', path: '/api/evidence', weight: 10 },
];

function selectRandomEndpoint(): { method: string; path: string } {
  const totalWeight = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
  const random = Math.random() * totalWeight;
  
  let cumulative = 0;
  for (const endpoint of ENDPOINTS) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      return { method: endpoint.method, path: endpoint.path };
    }
  }
  
  return ENDPOINTS[0];
}

async function makeRequest(baseUrl: string, authToken?: string): Promise<RequestResult> {
  const endpoint = selectRandomEndpoint();
  const url = `${baseUrl}${endpoint.path}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const startTime = Date.now();
  
  try {
    const options: any = {
      method: endpoint.method,
      headers,
      timeout: 30000, // 30 second timeout
    };
    
    // Add body for POST requests
    if (endpoint.method === 'POST') {
      options.body = JSON.stringify({
        // Simulated payload - would need to be customized per endpoint
        value: { answer: 'yes' },
        notes: 'Simulated test answer',
      });
    }
    
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    
    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      duration,
      success: response.ok,
      statusCode: response.status,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      duration,
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function simulateUser(
  baseUrl: string,
  durationMs: number,
  authToken?: string
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  const endTime = Date.now() + durationMs;
  
  while (Date.now() < endTime) {
    const result = await makeRequest(baseUrl, authToken);
    results.push(result);
    
    // Random delay between requests (0.5-2 seconds) to simulate human behavior
    const delay = 500 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  return results;
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function analyzeResults(results: RequestResult[], scenario: ScenarioType, durationMs: number): LoadTestReport {
  const totalRequests = results.length;
  const successfulRequests = results.filter(r => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  
  const responseTimes = results.map(r => r.duration);
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  
  // Calculate response time percentiles
  const p50 = calculatePercentile(responseTimes, 50);
  const p95 = calculatePercentile(responseTimes, 95);
  const p99 = calculatePercentile(responseTimes, 99);
  const max = Math.max(...responseTimes, 0);
  const min = Math.min(...responseTimes, 0);
  const avg = responseTimes.length > 0 
    ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length 
    : 0;
  
  // Aggregate errors
  const errorMap = new Map<string, { endpoint: string; error: string; count: number }>();
  results.filter(r => !r.success).forEach(r => {
    const key = `${r.endpoint}:${r.error || 'Unknown'}`;
    if (errorMap.has(key)) {
      errorMap.get(key)!.count++;
    } else {
      errorMap.set(key, {
        endpoint: r.endpoint,
        error: r.error || 'Unknown error',
        count: 1,
      });
    }
  });
  
  // Endpoint-level metrics
  const endpointMap = new Map<string, RequestResult[]>();
  results.forEach(r => {
    const key = `${r.method} ${r.endpoint}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, []);
    }
    endpointMap.get(key)!.push(r);
  });
  
  const endpointMetrics = Array.from(endpointMap.entries()).map(([key, requests]) => {
    const [method, endpoint] = key.split(' ', 2);
    const successful = requests.filter(r => r.success).length;
    const avgTime = requests.reduce((sum, r) => sum + r.duration, 0) / requests.length;
    
    return {
      endpoint,
      method,
      totalRequests: requests.length,
      successRate: (successful / requests.length) * 100,
      avgResponseTime: avgTime,
    };
  });
  
  // Identify bottlenecks
  const bottlenecks: string[] = [];
  if (errorRate > 5) {
    bottlenecks.push(`High error rate: ${errorRate.toFixed(2)}%`);
  }
  if (p95 > 500) {
    bottlenecks.push(`Slow p95 response time: ${p95.toFixed(0)}ms (target: <500ms)`);
  }
  if (p99 > 1000) {
    bottlenecks.push(`Very slow p99 response time: ${p99.toFixed(0)}ms (target: <1000ms)`);
  }
  
  endpointMetrics.forEach(e => {
    if (e.successRate < 90) {
      bottlenecks.push(`${e.method} ${e.endpoint} has low success rate: ${e.successRate.toFixed(1)}%`);
    }
    if (e.avgResponseTime > 300) {
      bottlenecks.push(`${e.method} ${e.endpoint} is slow: ${e.avgResponseTime.toFixed(0)}ms avg`);
    }
  });
  
  if (bottlenecks.length === 0) {
    bottlenecks.push('No significant bottlenecks detected');
  }
  
  return {
    scenario,
    concurrentUsers: SCENARIOS[scenario].concurrentUsers,
    duration: durationMs / 1000,
    totalRequests,
    successfulRequests,
    failedRequests,
    successRate,
    errorRate,
    responseTimes: { p50, p95, p99, max, min, avg },
    requestsPerSecond: totalRequests / (durationMs / 1000),
    errors: Array.from(errorMap.values()).sort((a, b) => b.count - a.count),
    endpointMetrics: endpointMetrics.sort((a, b) => b.totalRequests - a.totalRequests),
    bottlenecks,
    timestamp: new Date().toISOString(),
  };
}

function printReport(report: LoadTestReport): void {
  console.log('\n📊 WORKLOAD SIMULATION REPORT');
  console.log('═'.repeat(70));
  console.log(`Scenario: ${report.scenario.toUpperCase()} (${report.concurrentUsers} concurrent users)`);
  console.log(`Duration: ${report.duration}s`);
  console.log(`Timestamp: ${report.timestamp}\n`);
  
  console.log('📈 THROUGHPUT');
  console.log(`   Total Requests: ${report.totalRequests}`);
  console.log(`   Requests/sec: ${report.requestsPerSecond.toFixed(2)}`);
  console.log(`   Success Rate: ${report.successRate.toFixed(2)}%`);
  console.log(`   Error Rate: ${report.errorRate.toFixed(2)}%\n`);
  
  console.log('⚡ RESPONSE TIMES (ms)');
  console.log(`   Min: ${report.responseTimes.min.toFixed(0)}ms`);
  console.log(`   Avg: ${report.responseTimes.avg.toFixed(0)}ms`);
  console.log(`   p50: ${report.responseTimes.p50.toFixed(0)}ms`);
  console.log(`   p95: ${report.responseTimes.p95.toFixed(0)}ms`);
  console.log(`   p99: ${report.responseTimes.p99.toFixed(0)}ms`);
  console.log(`   Max: ${report.responseTimes.max.toFixed(0)}ms\n`);
  
  if (report.errors.length > 0) {
    console.log('❌ TOP ERRORS');
    report.errors.slice(0, 5).forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.endpoint}: ${e.error} (${e.count}x)`);
    });
    console.log();
  }
  
  console.log('🎯 ENDPOINT PERFORMANCE');
  console.log('   Method | Endpoint                  | Requests | Success | Avg Time');
  console.log('   ' + '─'.repeat(75));
  report.endpointMetrics.forEach(e => {
    const method = e.method.padEnd(6);
    const endpoint = e.endpoint.padEnd(25);
    const requests = e.totalRequests.toString().padStart(8);
    const success = `${e.successRate.toFixed(1)}%`.padStart(7);
    const avgTime = `${e.avgResponseTime.toFixed(0)}ms`.padStart(8);
    console.log(`   ${method} | ${endpoint} | ${requests} | ${success} | ${avgTime}`);
  });
  
  console.log('\n🚨 BOTTLENECK ANALYSIS');
  report.bottlenecks.forEach((b, i) => {
    console.log(`   ${i + 1}. ${b}`);
  });
  
  console.log('\n' + '═'.repeat(70));
}

function saveReport(report: LoadTestReport): void {
  const filename = `workload-report-${report.scenario}-${Date.now()}.json`;
  const outputPath = path.join(process.cwd(), filename);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: ${outputPath}`);
}

async function runSimulation(scenario: ScenarioType, saveReportFlag: boolean = false): Promise<void> {
  const scenarioConfig = SCENARIOS[scenario];
  
  console.log(`\n🚀 Starting ${scenarioConfig.description}...`);
  console.log(`   Duration: ${scenarioConfig.duration}s`);
  console.log(`   Concurrent Users: ${scenarioConfig.concurrentUsers}\n`);
  
  // Determine base URL
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  console.log(`   Target: ${baseUrl}\n`);
  
  const durationMs = scenarioConfig.duration * 1000;
  const startTime = Date.now();
  
  // Simulate concurrent users
  console.log('⏳ Simulating user traffic...\n');
  const userPromises: Promise<RequestResult[]>[] = [];
  
  for (let i = 0; i < scenarioConfig.concurrentUsers; i++) {
    userPromises.push(simulateUser(baseUrl, durationMs));
  }
  
  // Wait for all simulations to complete
  const userResults = await Promise.all(userPromises);
  const allResults = userResults.flat();
  
  const actualDuration = Date.now() - startTime;
  
  console.log(`✅ Simulation complete in ${(actualDuration / 1000).toFixed(1)}s\n`);
  
  // Analyze and report results
  const report = analyzeResults(allResults, scenario, actualDuration);
  printReport(report);
  
  if (saveReportFlag) {
    saveReport(report);
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  if (report.errorRate > 5) {
    console.log('   - High error rate detected. Check server logs and database connection pool.');
  }
  if (report.responseTimes.p95 > 500) {
    console.log('   - Slow response times. Consider adding indexes or scaling database.');
  }
  if (report.successRate < 95) {
    console.log('   - Low success rate. Investigate failing endpoints and fix issues.');
  }
  if (report.bottlenecks.length === 1 && report.bottlenecks[0].includes('No significant')) {
    console.log('   - System performing well under this load! ✨');
  }
  console.log();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scenario = (args[0] as ScenarioType) || 'normal';
  const saveReportFlag = args.includes('--save-report');
  
  if (!['normal', 'peak', 'stress'].includes(scenario)) {
    console.error('❌ Invalid scenario. Use: normal, peak, or stress');
    console.log('   Example: npx tsx server/tools/workload-simulator.ts normal');
    process.exit(1);
  }
  
  console.log('⚠️  WARNING: This will generate significant load on the system.');
  console.log('   Ensure you are running against a test environment, not production!\n');
  
  try {
    await runSimulation(scenario, saveReportFlag);
    process.exit(0);
  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

export { runSimulation, LoadTestReport };

// Run if called directly
main();
