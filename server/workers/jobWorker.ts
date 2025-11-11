import { jobQueueService } from '../services/jobQueue.js';
import { Job } from '../../shared/schema.js';

class JobWorker {
  private isRunning = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private processingJobs: Set<string> = new Set();
  private readonly POLL_INTERVAL_MS = 2000;

  async start(): Promise<void> {
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

  async stop(): Promise<void> {
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

  private async pollAndProcess(): Promise<void> {
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

    } catch (error) {
      console.error('[JobWorker] Error polling queue:', error);
    }
  }

  private async processJob(job: Job): Promise<void> {
    console.log(`[JobWorker] Processing job ${job.id} (type: ${job.type}, attempt: ${job.attempts + 1}/${job.maxAttempts})`);

    try {
      await jobQueueService.incrementAttempts(job.id);

      const result = await jobQueueService.executeJob(job);

      await jobQueueService.updateStatus(job.id, 'COMPLETED', result);
      console.log(`[JobWorker] Job ${job.id} completed successfully`);

    } catch (error: any) {
      const currentAttempts = job.attempts + 1;
      const maxAttempts = job.maxAttempts || 3;

      console.error(`[JobWorker] Job ${job.id} failed (attempt ${currentAttempts}/${maxAttempts}):`, error.message);

      if (currentAttempts >= maxAttempts) {
        await jobQueueService.updateStatus(
          job.id,
          'FAILED',
          null,
          error.message || 'Unknown error'
        );
        console.error(`[JobWorker] Job ${job.id} failed permanently after ${maxAttempts} attempts`);
      } else {
        const backoffDelay = this.calculateBackoff(currentAttempts);
        console.log(`[JobWorker] Retrying job ${job.id} in ${backoffDelay}ms`);

        setTimeout(async () => {
          try {
            await jobQueueService.updateStatus(job.id, 'PENDING');
            // CRITICAL FIX: Re-enqueue job in in-memory queue so worker can pick it up
            await jobQueueService.retryJob(job.id);
          } catch (retryError) {
            console.error(`[JobWorker] Error requeueing job ${job.id}:`, retryError);
          }
        }, backoffDelay);
      }
    }
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    return delay;
  }
}

export const jobWorker = new JobWorker();
