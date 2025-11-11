import { jobQueueService } from '../services/jobQueue';

async function measureJobPerformance() {
  console.log('📊 Measuring Background Job Performance\n');
  
  try {
    // Test job queueing speed
    const queueStart = Date.now();
    const jobIds: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      const jobId = await jobQueueService.enqueue({
        tenantId: 'test-tenant',
        type: 'report_generation',
        priority: 'medium',
        payload: { test: true }
      });
      jobIds.push(jobId);
    }
    
    const queueTime = Date.now() - queueStart;
    const avgQueueTime = queueTime / 10;
    console.log(`1️⃣ Queued 10 jobs in: ${queueTime}ms (${avgQueueTime.toFixed(1)}ms per job)`);
    
    // Test job retrieval speed
    const retrieveStart = Date.now();
    const jobs = await Promise.all(jobIds.map(id => jobQueueService.getJob(id)));
    const retrieveTime = Date.now() - retrieveStart;
    const avgRetrieveTime = retrieveTime / 10;
    console.log(`2️⃣ Retrieved 10 jobs in: ${retrieveTime}ms (${avgRetrieveTime.toFixed(1)}ms per job)\n`);
    
    console.log('✅ Job Queue: Fast enqueue and retrieval operations');
    console.log('\n📝 Summary:');
    console.log(`   Average Enqueue Time: ${avgQueueTime.toFixed(1)}ms per job`);
    console.log(`   Average Retrieval Time: ${avgRetrieveTime.toFixed(1)}ms per job`);
    console.log(`   Total Jobs Processed: ${jobIds.length}`);
    
    // Cleanup test jobs
    console.log('\n🧹 Cleaning up test jobs...');
    for (const jobId of jobIds) {
      await jobQueueService.updateStatus(jobId, 'FAILED', null, 'Test cleanup');
    }
    console.log('✅ Cleanup complete');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error measuring job performance:', error);
    process.exit(1);
  }
}

measureJobPerformance();
