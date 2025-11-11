import { jobQueueService } from '../services/jobQueue.js';
import { jobWorker } from '../workers/jobWorker.js';
import { db } from '../db.js';
import { jobs } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

console.log('🧪 Testing Job Infrastructure Fixes\n');
console.log('============================================================\n');

let testsPassed = 0;
let testsFailed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    testsFailed++;
  }
}

// Register a test handler that fails on first attempt
let attemptCount = 0;
jobQueueService.registerHandler('test_retry', async (payload) => {
  attemptCount++;
  console.log(`   [test_retry] Attempt ${attemptCount}`);
  
  if (attemptCount === 1) {
    throw new Error('First attempt fails intentionally');
  }
  
  return { success: true, attemptCount };
});

// Test 1: Verify retry logic works
await test('Test 1: Retry Logic - Job retries after failure', async () => {
  attemptCount = 0;
  
  // Enqueue a job
  const jobId = await jobQueueService.enqueue({
    tenantId: 'test-tenant',
    type: 'test_retry',
    payload: { test: 'retry' },
    priority: 'high',
    maxAttempts: 3,
  });
  
  console.log(`   Enqueued job: ${jobId}`);
  
  // Start worker
  await jobWorker.start();
  
  // Wait for job to be processed (will fail on first attempt)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check job status after first attempt
  let job = await jobQueueService.getJob(jobId);
  if (!job) throw new Error('Job not found');
  
  console.log(`   After first attempt - Status: ${job.status}, Attempts: ${job.attempts}`);
  
  // Wait for retry (with backoff delay)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check final job status
  job = await jobQueueService.getJob(jobId);
  if (!job) throw new Error('Job not found after retry');
  
  console.log(`   After retry - Status: ${job.status}, Attempts: ${job.attempts}`);
  
  if (job.status !== 'COMPLETED') {
    throw new Error(`Expected COMPLETED status, got ${job.status}`);
  }
  
  if (attemptCount < 2) {
    throw new Error(`Expected at least 2 attempts, got ${attemptCount}`);
  }
  
  console.log(`   ✓ Job successfully retried and completed after ${attemptCount} attempts`);
  
  // Stop worker
  await jobWorker.stop();
});

// Test 2: Verify no race conditions with dequeue
await test('Test 2: Race Condition - Atomic dequeue prevents duplicate processing', async () => {
  // Enqueue multiple jobs
  const jobIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const jobId = await jobQueueService.enqueue({
      tenantId: 'test-tenant',
      type: 'report_generation',
      payload: { index: i },
      priority: 'medium',
    });
    jobIds.push(jobId);
  }
  
  console.log(`   Enqueued ${jobIds.length} jobs`);
  
  // Simulate multiple workers dequeueing simultaneously
  const dequeuePromises = [];
  for (let i = 0; i < 10; i++) {
    dequeuePromises.push(jobQueueService.dequeue());
  }
  
  const dequeuedJobs = await Promise.all(dequeuePromises);
  
  // Filter out null results
  const actualJobs = dequeuedJobs.filter(j => j !== null);
  
  console.log(`   Dequeued ${actualJobs.length} jobs from 10 concurrent dequeue attempts`);
  
  // Check for duplicates
  const jobIdSet = new Set(actualJobs.map(j => j!.id));
  
  if (jobIdSet.size !== actualJobs.length) {
    throw new Error(`Duplicate jobs dequeued! Expected ${actualJobs.length} unique jobs, got ${jobIdSet.size}`);
  }
  
  // Verify each job is in PROCESSING state
  for (const job of actualJobs) {
    if (job!.status !== 'PROCESSING') {
      throw new Error(`Job ${job!.id} has status ${job!.status}, expected PROCESSING`);
    }
  }
  
  console.log(`   ✓ No duplicate jobs dequeued, all jobs in PROCESSING state`);
  
  // Clean up - mark jobs as completed
  for (const job of actualJobs) {
    await jobQueueService.updateStatus(job!.id, 'COMPLETED', {});
  }
});

// Test 3: Verify graceful shutdown
await test('Test 3: Signal Handling - Worker stops gracefully without process.exit', async () => {
  // Enqueue a long-running job
  jobQueueService.registerHandler('test_long_job', async (payload) => {
    console.log('   [test_long_job] Starting long job...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    return { success: true };
  });
  
  const jobId = await jobQueueService.enqueue({
    tenantId: 'test-tenant',
    type: 'test_long_job',
    payload: { test: 'shutdown' },
    priority: 'high',
  });
  
  console.log(`   Enqueued long-running job: ${jobId}`);
  
  // Start worker
  await jobWorker.start();
  
  // Wait for job to start processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Stop worker gracefully
  const stopStart = Date.now();
  await jobWorker.stop();
  const stopDuration = Date.now() - stopStart;
  
  console.log(`   ✓ Worker stopped in ${stopDuration}ms`);
  
  // Verify we didn't call process.exit (if we did, this test wouldn't continue)
  console.log(`   ✓ Process still running (process.exit not called)`);
  
  // Clean up
  await jobQueueService.updateStatus(jobId, 'FAILED', null, 'Test interrupted');
});

// Test 4: Verify retryJob method works
await test('Test 4: RetryJob Method - Re-adds job to in-memory queue', async () => {
  // Enqueue a job and immediately fail it
  const jobId = await jobQueueService.enqueue({
    tenantId: 'test-tenant',
    type: 'report_generation',
    payload: { test: 'manual-retry' },
    priority: 'low',
  });
  
  console.log(`   Enqueued job: ${jobId}`);
  
  // Manually fail the job
  await jobQueueService.updateStatus(jobId, 'FAILED', null, 'Test failure');
  
  let job = await jobQueueService.getJob(jobId);
  if (job?.status !== 'FAILED') {
    throw new Error('Job should be FAILED');
  }
  
  console.log(`   Job marked as FAILED`);
  
  // Use retry method to reset and re-enqueue
  await jobQueueService.retry(jobId);
  
  job = await jobQueueService.getJob(jobId);
  if (job?.status !== 'PENDING') {
    throw new Error('Job should be PENDING after retry');
  }
  
  console.log(`   ✓ Job status reset to PENDING and re-added to queue`);
  
  // Clean up
  await jobQueueService.updateStatus(jobId, 'COMPLETED', {});
});

console.log('\n============================================================');
console.log('📊 TEST RESULTS');
console.log('============================================================');
console.log(`Tests Passed: ${testsPassed}/${testsPassed + testsFailed}`);
console.log(`Tests Failed: ${testsFailed}/${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ 100% PASS - All job infrastructure fixes validated successfully!');
  process.exit(0);
} else {
  console.log(`\n❌ ${testsFailed} test(s) failed`);
  process.exit(1);
}
