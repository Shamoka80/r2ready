import { jobQueueService } from '../services/jobQueue.js';
import { jobs } from '../../shared/schema.js';
import { db } from '../db.js';
import { eq, sql } from 'drizzle-orm';
class JobWorker {
    isRunning = false;
    pollingInterval = null;
    processingJobs = new Set();
    POLL_INTERVAL_MS = 2000;
    async start() {
        if (this.isRunning) {
            console.log('[JobWorker] Already running');
            return;
        }
        this.isRunning = true;
        console.log('[JobWorker] Starting worker process');
        console.log(`[JobWorker] Registered handlers: ${jobQueueService.getRegisteredHandlers().join(', ')}`);
        this.pollingInterval = setInterval(async () => {
            await this.pollAndProcess();
        }, this.POLL_INTERVAL_MS);
        await this.pollAndProcess();
    }
    async stop() {
        console.log('[JobWorker] Stopping worker process...');
        this.isRunning = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        const maxWaitTime = 30000;
        const startTime = Date.now();
        while (this.processingJobs.size > 0 && (Date.now() - startTime) < maxWaitTime) {
            console.log(`[JobWorker] Waiting for ${this.processingJobs.size} jobs to complete...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (this.processingJobs.size > 0) {
            console.warn(`[JobWorker] Force stopping with ${this.processingJobs.size} jobs still processing`);
        }
        console.log('[JobWorker] Worker stopped');
    }
    async pollAndProcess() {
        if (!this.isRunning) {
            return;
        }
        try {
            const job = await jobQueueService.dequeue();
            if (!job) {
                return;
            }
            this.processingJobs.add(job.id);
            this.processJob(job)
                .catch(error => {
                console.error(`[JobWorker] Error processing job ${job.id}:`, error);
            })
                .finally(() => {
                this.processingJobs.delete(job.id);
            });
        }
        catch (error) {
            console.error('[JobWorker] Error polling queue:', error);
        }
    }
    async processJob(job) {
        console.log(`[JobWorker] Processing job ${job.id} (type: ${job.type}, attempt: ${job.attempts + 1}/${job.maxAttempts})`);
        try {
            await jobQueueService.incrementAttempts(job.id);
            const result = await jobQueueService.executeJob(job);
            await jobQueueService.updateStatus(job.id, 'COMPLETED', result);
            console.log(`[JobWorker] Job ${job.id} completed successfully`);
        }
        catch (error) {
            const currentAttempts = job.attempts + 1;
            const maxAttempts = job.maxAttempts || 3;
            console.error(`[JobWorker] Job ${job.id} failed (attempt ${currentAttempts}/${maxAttempts}):`, error.message);
            // Check if job has exceeded max attempts
            if (currentAttempts >= maxAttempts) {
                await jobQueueService.updateStatus(job.id, 'FAILED', null, `Max attempts (${maxAttempts}) exceeded: ${error.message || 'Unknown error'}`);
                console.error(`[JobWorker] Job ${job.id} failed permanently after ${maxAttempts} attempts`);
            }
            else {
                // Calculate exponential backoff
                const backoffMs = Math.pow(2, currentAttempts) * 1000;
                console.log(`[JobWorker] Retrying job ${job.id} in ${backoffMs}ms (attempt ${currentAttempts}/${maxAttempts})`);
                // Wait for backoff period
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                // CRITICAL: Update attempts atomically BEFORE retrying
                await db.update(jobs)
                    .set({
                    attempts: currentAttempts,
                    status: 'PENDING',
                    updatedAt: sql `now()`
                })
                    .where(eq(jobs.id, job.id));
                // Then re-enqueue with updated attempts
                try {
                    await jobQueueService.retryJob(job.id);
                }
                catch (retryError) {
                    console.error(`[JobWorker] Error requeueing job ${job.id}:`, retryError);
                }
            }
        }
    }
    calculateBackoff(attempt) {
        const baseDelay = 1000;
        const maxDelay = 30000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        return delay;
    }
}
export const jobWorker = new JobWorker();
