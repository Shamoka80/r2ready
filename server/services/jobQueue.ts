import { db } from '../db.js';
import { jobs, Job, NewJob } from '../../shared/schema.js';
import { eq, and, desc, sql, lte } from 'drizzle-orm';
import { ExportService } from './exportService.js';
import { emailService } from './emailService.js';

type JobHandler = (payload: any) => Promise<any>;

class JobQueueService {
  private jobHandlers: Map<string, JobHandler> = new Map();
  private inMemoryQueue: Map<string, Job> = new Map();

  registerHandler(type: string, handler: JobHandler): void {
    this.jobHandlers.set(type, handler);
    console.log(`[JobQueue] Registered handler for job type: ${type}`);
  }

  async enqueue(jobData: {
    tenantId: string;
    type: string;
    payload: any;
    priority?: 'low' | 'medium' | 'high';
    maxAttempts?: number;
  }): Promise<string> {
    const newJob: NewJob = {
      tenantId: jobData.tenantId,
      type: jobData.type,
      status: 'PENDING',
      priority: jobData.priority || 'medium',
      payload: jobData.payload,
      result: null,
      error: null,
      attempts: 0,
      maxAttempts: jobData.maxAttempts || 3,
    };

    const [insertedJob] = await db.insert(jobs).values(newJob).returning();

    this.inMemoryQueue.set(insertedJob.id, insertedJob);
    console.log(`[JobQueue] Enqueued job ${insertedJob.id} (type: ${insertedJob.type}, priority: ${insertedJob.priority})`);

    return insertedJob.id;
  }

  async dequeue(): Promise<Job | null> {
    const priorityOrder: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];

    for (const priority of priorityOrder) {
      // Atomic UPDATE with WHERE clause - only claims job if still PENDING
      // This prevents race conditions where multiple workers grab the same job
      const claimedJobs = await db
        .update(jobs)
        .set({ 
          status: 'PROCESSING',
          updatedAt: sql`now()`
        })
        .where(
          and(
            eq(jobs.status, 'PENDING'),
            sql`${jobs.priority} = ${priority}`,
            // Use subquery to get the first job by priority and creation time
            sql`${jobs.id} = (
              SELECT id FROM ${jobs}
              WHERE status = 'PENDING' AND priority = ${priority}
              ORDER BY "createdAt" ASC
              LIMIT 1
            )`
          )
        )
        .returning();

      if (claimedJobs.length > 0) {
        const job = claimedJobs[0];
        this.inMemoryQueue.delete(job.id);
        
        console.log(`[JobQueue] Dequeued job ${job.id} (type: ${job.type}, priority: ${job.priority})`);
        return job;
      }
    }

    return null;
  }

  async updateStatus(
    jobId: string,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    result?: any,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: sql`now()`,
    };

    if (result !== undefined) {
      updateData.result = result;
    }

    if (error !== undefined) {
      updateData.error = error;
    }

    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = sql`now()`;
    }

    await db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, jobId));

    this.inMemoryQueue.delete(jobId);
    console.log(`[JobQueue] Updated job ${jobId} status to ${status}`);
  }

  async incrementAttempts(jobId: string): Promise<void> {
    await db
      .update(jobs)
      .set({ 
        attempts: sql`${jobs.attempts} + 1`,
        updatedAt: sql`now()`
      })
      .where(eq(jobs.id, jobId));
  }

  async getJob(jobId: string): Promise<Job | null> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId));

    return job || null;
  }

  async getJobsByTenant(tenantId: string, limit: number = 50): Promise<Job[]> {
    const tenantJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.tenantId, tenantId))
      .orderBy(desc(jobs.createdAt))
      .limit(limit);

    return tenantJobs;
  }

  async retry(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'FAILED') {
      throw new Error(`Job ${jobId} is not in FAILED state`);
    }

    await db
      .update(jobs)
      .set({
        status: 'PENDING',
        error: null,
        attempts: 0,
        updatedAt: sql`now()`,
        completedAt: null,
      })
      .where(eq(jobs.id, jobId));

    this.inMemoryQueue.set(jobId, { ...job, status: 'PENDING' });
    console.log(`[JobQueue] Retrying job ${jobId}`);
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Re-add job to in-memory queue so it can be picked up by workers
    this.inMemoryQueue.set(jobId, job);
    console.log(`[JobQueue] Re-enqueued job ${jobId} for retry (attempt ${job.attempts}/${job.maxAttempts})`);
  }

  async cleanup(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deletedJobs = await db
      .delete(jobs)
      .where(
        and(
          sql`${jobs.status} IN ('COMPLETED', 'FAILED')`,
          lte(jobs.completedAt, cutoffDate)
        )
      )
      .returning();

    console.log(`[JobQueue] Cleaned up ${deletedJobs.length} old jobs`);
  }

  async executeJob(job: Job): Promise<any> {
    const handler = this.jobHandlers.get(job.type);

    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.type}`);
    }

    console.log(`[JobQueue] Executing job ${job.id} (type: ${job.type})`);
    return await handler(job.payload);
  }

  getRegisteredHandlers(): string[] {
    return Array.from(this.jobHandlers.keys());
  }
}

export const jobQueueService = new JobQueueService();

// Helper function to get MIME type from format
function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[format] || 'application/octet-stream';
}

// Handler for report generation
async function handleReportGeneration(payload: any): Promise<any> {
  const { assessmentId, tenantId, format, templateType } = payload;
  
  console.log(`[JobQueue] Generating ${format} report for assessment ${assessmentId}`);
  
  let buffer: Buffer;
  if (format === 'pdf') {
    buffer = await ExportService.generatePDF(assessmentId, tenantId, templateType);
  } else if (format === 'xlsx') {
    buffer = await ExportService.generateExcel(assessmentId, tenantId, templateType);
  } else if (format === 'docx') {
    buffer = await ExportService.generateWord(assessmentId, tenantId, templateType);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
  
  // Store buffer as base64 in job result
  return {
    filename: `report_${Date.now()}.${format}`,
    buffer: buffer.toString('base64'),
    mimeType: getMimeType(format)
  };
}

// Handler for email sending
async function handleEmailSending(payload: any): Promise<any> {
  const { to, subject, html, text, from } = payload;
  
  console.log(`[JobQueue] Sending email to ${to}: ${subject}`);
  
  const success = await emailService.sendEmail({ to, subject, html, text, from });
  
  return {
    success,
    sentAt: new Date().toISOString(),
    recipient: to
  };
}

// Register handlers
jobQueueService.registerHandler('report_generation', handleReportGeneration);
jobQueueService.registerHandler('email_sending', handleEmailSending);

export { JobQueueService };
