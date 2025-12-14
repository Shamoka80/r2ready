import { jobQueueService } from '../services/jobQueue.js';
import { Job, jobs } from '../../shared/schema.js';
import { db } from '../db.js';
import { eq, sql } from 'drizzle-orm';

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

    try {
      this.isRunning = true;
      console.log('[JobWorker] Starting worker process');
      console.log(`[JobWorker] Registered handlers: ${jobQueueService.getRegisteredHandlers().join(', ')}`);

      this.pollingInterval = setInterval(async () => {
        await this.pollAndProcess();
      }, this.POLL_INTERVAL_MS);

      await this.pollAndProcess();
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isBillingError = 
        errorMessage.includes('account payments have failed') ||
        errorMessage.includes('spending limit') ||
        errorMessage.includes('billing') ||
        errorMessage.includes('payment') ||
        errorMessage.includes('Billing & plans');
      
      if (isBillingError) {
        // Don't set isRunning to true if billing error - worker won't start
        this.isRunning = false;
        throw error; // Re-throw so caller can handle it
      }
      throw error; // Re-throw other errors
    }
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

    } catch (error: any) {
      // Check if this is a connection error - if so, silently skip (database unavailable)
      const errorMessage = error?.message || String(error);
      const isConnectionError = 
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('connect');
      
      const isBillingError = 
        errorMessage.includes('account payments have failed') ||
        errorMessage.includes('spending limit') ||
        errorMessage.includes('billing') ||
        errorMessage.includes('payment');
      
      if (isBillingError) {
        // Stop polling if billing error - worker should not continue
        this.isRunning = false;
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        console.warn('[JobWorker] Stopped due to billing/payment issue. Please resolve billing to resume background jobs.');
        return;
      }
      
      if (!isConnectionError) {
        // Only log non-connection errors
        console.error('[JobWorker] Error polling queue:', error);
      }
      // Silently skip connection errors - database is unavailable, will retry when available
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

      // Check if job has exceeded max attempts
      if (currentAttempts >= maxAttempts) {
        await jobQueueService.updateStatus(
          job.id,
          'FAILED',
          null,
          `Max attempts (${maxAttempts}) exceeded: ${error.message || 'Unknown error'}`
        );
        console.error(`[JobWorker] Job ${job.id} failed permanently after ${maxAttempts} attempts`);
      } else {
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
            updatedAt: new Date()
          })
          .where(eq(jobs.id, job.id));

        // Then re-enqueue with updated attempts
        try {
          await jobQueueService.retryJob(job.id);
        } catch (retryError) {
          console.error(`[JobWorker] Error requeueing job ${job.id}:`, retryError);
        }
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
