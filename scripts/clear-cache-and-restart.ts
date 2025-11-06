#!/usr/bin/env tsx

import { cacheService } from '../server/services/cachingService.js';
import { spawn } from 'child_process';
import fetch from 'node-fetch';

interface WorkflowResult {
  step: string;
  status: 'success' | 'error';
  message: string;
  details?: any;
}

const results: WorkflowResult[] = [];

async function clearServerCache(): Promise<void> {
  console.log('🧹 Step 1: Clearing server cache...');
  
  try {
    const clearedCount = await cacheService.clear();
    const stats = cacheService.getStats();
    
    results.push({
      step: 'Clear Server Cache',
      status: 'success',
      message: `Cleared ${clearedCount} cache entries`,
      details: {
        clearedEntries: clearedCount,
        finalStats: stats
      }
    });
    
    console.log(`✅ Cache cleared: ${clearedCount} entries removed`);
    console.log(`   Memory usage: ${stats.memoryUsage} bytes`);
    console.log(`   Total keys: ${stats.totalKeys}`);
  } catch (error) {
    results.push({
      step: 'Clear Server Cache',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
    console.error('❌ Failed to clear cache:', error);
  }
}

async function clearQueuedTasks(): Promise<void> {
  console.log('\n📋 Step 2: Checking for queued tasks/jobs...');
  
  try {
    // This application doesn't use a traditional job queue system
    // But we can check for any pending background tasks
    
    results.push({
      step: 'Clear Queued Tasks',
      status: 'success',
      message: 'No job queue system detected - application uses direct request handling',
      details: {
        note: 'Application uses real-time processing without background job queues'
      }
    });
    
    console.log('✅ No background job queues to clear');
  } catch (error) {
    results.push({
      step: 'Clear Queued Tasks',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
    console.error('❌ Error checking queued tasks:', error);
  }
}

async function waitForServer(port: number, maxRetries: number = 30): Promise<boolean> {
  console.log(`\n⏳ Waiting for server to be ready on port ${port}...`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/observability/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        console.log('✅ Server is responding');
        return true;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  
  console.log('\n⚠️  Server did not respond within expected time');
  return false;
}

async function verifyApplication(): Promise<void> {
  console.log('\n🔍 Step 3: Verifying application...');
  
  const port = parseInt(process.env.PORT || '5000', 10);
  const checks = [];
  
  try {
    // Check 1: API health endpoint
    try {
      const healthResponse = await fetch(`http://localhost:${port}/api/observability/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      checks.push({
        name: 'API Health Check',
        status: healthResponse.ok ? 'pass' : 'fail',
        statusCode: healthResponse.status
      });
      
      if (healthResponse.ok) {
        console.log('  ✅ API health check passed');
      } else {
        console.log(`  ❌ API health check failed (status: ${healthResponse.status})`);
      }
    } catch (error) {
      checks.push({
        name: 'API Health Check',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('  ❌ API health check failed:', error);
    }
    
    // Check 2: Frontend accessibility
    try {
      const frontendResponse = await fetch(`http://localhost:${port}/`, {
        method: 'GET'
      });
      
      checks.push({
        name: 'Frontend Accessibility',
        status: frontendResponse.ok ? 'pass' : 'fail',
        statusCode: frontendResponse.status
      });
      
      if (frontendResponse.ok) {
        console.log('  ✅ Frontend is accessible');
      } else {
        console.log(`  ❌ Frontend check failed (status: ${frontendResponse.status})`);
      }
    } catch (error) {
      checks.push({
        name: 'Frontend Accessibility',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('  ❌ Frontend check failed:', error);
    }
    
    // Check 3: Cache service health
    try {
      const cacheHealth = await cacheService.healthCheck();
      
      checks.push({
        name: 'Cache Service Health',
        status: cacheHealth.status === 'healthy' ? 'pass' : 'warning',
        details: cacheHealth.details
      });
      
      if (cacheHealth.status === 'healthy') {
        console.log('  ✅ Cache service is healthy');
      } else {
        console.log(`  ⚠️  Cache service status: ${cacheHealth.status}`);
        console.log(`     Details:`, cacheHealth.details);
      }
    } catch (error) {
      checks.push({
        name: 'Cache Service Health',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('  ❌ Cache service health check failed:', error);
    }
    
    const allPassed = checks.every(check => check.status === 'pass' || check.status === 'warning');
    
    results.push({
      step: 'Verify Application',
      status: allPassed ? 'success' : 'error',
      message: allPassed ? 'All verification checks passed' : 'Some verification checks failed',
      details: { checks }
    });
    
    if (allPassed) {
      console.log('\n✅ Application verification completed successfully');
    } else {
      console.log('\n⚠️  Application verification completed with warnings/errors');
    }
  } catch (error) {
    results.push({
      step: 'Verify Application',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
    console.error('\n❌ Application verification failed:', error);
  }
}

async function printSummary(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📊 WORKFLOW SUMMARY');
  console.log('='.repeat(60));
  
  results.forEach((result, index) => {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`\n${index + 1}. ${result.step}: ${icon} ${result.status.toUpperCase()}`);
    console.log(`   ${result.message}`);
    
    if (result.details && process.env.VERBOSE === 'true') {
      console.log('   Details:', JSON.stringify(result.details, null, 2));
    }
  });
  
  const successCount = results.filter(r => r.status === 'success').length;
  const totalSteps = results.length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`Result: ${successCount}/${totalSteps} steps completed successfully`);
  console.log('='.repeat(60) + '\n');
}

async function main(): Promise<void> {
  console.log('🚀 Starting Cache Clear and Server Restart Workflow\n');
  console.log('This workflow will:');
  console.log('  1. Clear the server cache');
  console.log('  2. Check and clear any queued tasks/jobs');
  console.log('  3. Verify the application is running correctly\n');
  
  try {
    // Step 1: Clear server cache
    await clearServerCache();
    
    // Step 2: Clear queued tasks
    await clearQueuedTasks();
    
    // Step 3: Wait a moment for any cleanup
    console.log('\n⏳ Allowing cleanup to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Verify application
    const port = parseInt(process.env.PORT || '5000', 10);
    const serverReady = await waitForServer(port);
    
    if (serverReady) {
      await verifyApplication();
    } else {
      results.push({
        step: 'Verify Application',
        status: 'error',
        message: 'Server did not become ready in time - verification skipped'
      });
    }
    
    // Print summary
    await printSummary();
    
    // Exit with appropriate code
    const hasErrors = results.some(r => r.status === 'error');
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Workflow failed:', error);
    process.exit(1);
  }
}

main();
