import { db } from '../db.js';
import { jobs } from '../../shared/schema.js';
import { eq, and, desc, sql, lte } from 'drizzle-orm';
import { ExportService } from './exportService.js';
import { emailService } from './emailService.js';
class JobQueueService {
    jobHandlers = new Map();
    inMemoryQueue = new Map();
    registerHandler(type, handler) {
        this.jobHandlers.set(type, handler);
        console.log(`[JobQueue] Registered handler for job type: ${type}`);
    }
    async enqueue(jobData) {
        const newJob = {
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
    async dequeue() {
        const priorityOrder = ['high', 'medium', 'low'];
        for (const priority of priorityOrder) {
            // Atomic UPDATE with WHERE clause - only claims job if still PENDING
            // This prevents race conditions where multiple workers grab the same job
            const claimedJobs = await db
                .update(jobs)
                .set({
                status: 'PROCESSING',
                updatedAt: sql `now()`
            })
                .where(and(eq(jobs.status, 'PENDING'), sql `${jobs.priority} = ${priority}`, 
            // Use subquery to get the first job by priority and creation time
            sql `${jobs.id} = (
              SELECT id FROM ${jobs}
              WHERE status = 'PENDING' AND priority = ${priority}
              ORDER BY "createdAt" ASC
              LIMIT 1
            )`))
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
    async updateStatus(jobId, status, result, error) {
        const updateData = {
            status,
            updatedAt: sql `now()`,
        };
        if (result !== undefined) {
            updateData.result = result;
        }
        if (error !== undefined) {
            updateData.error = error;
        }
        if (status === 'COMPLETED' || status === 'FAILED') {
            updateData.completedAt = sql `now()`;
        }
        await db
            .update(jobs)
            .set(updateData)
            .where(eq(jobs.id, jobId));
        this.inMemoryQueue.delete(jobId);
        console.log(`[JobQueue] Updated job ${jobId} status to ${status}`);
    }
    async incrementAttempts(jobId) {
        await db
            .update(jobs)
            .set({
            attempts: sql `${jobs.attempts} + 1`,
            updatedAt: sql `now()`
        })
            .where(eq(jobs.id, jobId));
    }
    async getJob(jobId) {
        const [job] = await db
            .select()
            .from(jobs)
            .where(eq(jobs.id, jobId));
        return job || null;
    }
    async getJobsByTenant(tenantId, limit = 50) {
        const tenantJobs = await db
            .select()
            .from(jobs)
            .where(eq(jobs.tenantId, tenantId))
            .orderBy(desc(jobs.createdAt))
            .limit(limit);
        return tenantJobs;
    }
    async retry(jobId) {
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
            updatedAt: sql `now()`,
            completedAt: null,
        })
            .where(eq(jobs.id, jobId));
        this.inMemoryQueue.set(jobId, { ...job, status: 'PENDING' });
        console.log(`[JobQueue] Retrying job ${jobId}`);
    }
    async retryJob(jobId) {
        // Read fresh job data with updated attempts
        const freshJob = await this.getJob(jobId);
        if (!freshJob) {
            throw new Error(`Job ${jobId} not found`);
        }
        // Check maxAttempts with fresh data
        if (freshJob.attempts >= freshJob.maxAttempts) {
            throw new Error(`Cannot retry job ${jobId}: max attempts (${freshJob.maxAttempts}) exceeded`);
        }
        // Re-add fresh job to in-memory queue so it can be picked up by workers
        this.inMemoryQueue.set(jobId, freshJob);
        console.log(`[JobQueue] Re-enqueued job ${jobId} for retry (attempt ${freshJob.attempts}/${freshJob.maxAttempts})`);
    }
    async cleanup(olderThanDays = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const deletedJobs = await db
            .delete(jobs)
            .where(and(sql `${jobs.status} IN ('COMPLETED', 'FAILED')`, lte(jobs.completedAt, cutoffDate)))
            .returning();
        console.log(`[JobQueue] Cleaned up ${deletedJobs.length} old jobs`);
    }
    async executeJob(job) {
        const handler = this.jobHandlers.get(job.type);
        if (!handler) {
            throw new Error(`No handler registered for job type: ${job.type}`);
        }
        console.log(`[JobQueue] Executing job ${job.id} (type: ${job.type})`);
        return await handler(job.payload);
    }
    getRegisteredHandlers() {
        return Array.from(this.jobHandlers.keys());
    }
}
export const jobQueueService = new JobQueueService();
// Helper function to get MIME type from format
function getMimeType(format) {
    const mimeTypes = {
        pdf: 'application/pdf',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[format] || 'application/octet-stream';
}
// Handler for report generation
async function handleReportGeneration(payload) {
    const { assessmentId, tenantId, format, templateType } = payload;
    console.log(`[JobQueue] Generating ${format} report for assessment ${assessmentId}`);
    let buffer;
    if (format === 'pdf') {
        buffer = await ExportService.generatePDF(assessmentId, tenantId, templateType);
    }
    else if (format === 'xlsx') {
        buffer = await ExportService.generateExcel(assessmentId, tenantId, templateType);
    }
    else if (format === 'docx') {
        buffer = await ExportService.generateWord(assessmentId, tenantId, templateType);
    }
    else {
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
async function handleEmailSending(payload) {
    const { to, subject, html, text, from } = payload;
    console.log(`[JobQueue] Sending email to ${to}: ${subject}`);
    const success = await emailService.sendEmail({ to, subject, html, text, from });
    return {
        success,
        sentAt: new Date().toISOString(),
        recipient: to
    };
}
// Handler for purging old slow query logs (Phase 3 Track 1)
async function handlePurgeSlowQueryLogs(payload) {
    console.log('[JobQueue] Purging old slow query logs...');
    const { QueryMonitoringService } = await import('./queryMonitoring.js');
    const deletedCount = await QueryMonitoringService.purgeOldSlowQueryLogs();
    const result = {
        deletedCount,
        purgedAt: new Date().toISOString(),
    };
    console.log(`[JobQueue] Purged ${result.deletedCount} old slow query log entries`);
    return result;
}
// Helper function to execute maintenance SQL with timeout (Phase 3 Track 2)
async function executeMaintenanceSQL(sqlQuery, timeout) {
    const startTime = Date.now();
    try {
        await db.execute(sql.raw(`SET LOCAL statement_timeout = '${timeout}ms'`));
        const result = await db.execute(sql.raw(sqlQuery));
        const duration = Date.now() - startTime;
        return {
            success: true,
            duration,
            query: sqlQuery,
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[JobQueue] Maintenance SQL failed after ${duration}ms:`, error.message);
        throw error;
    }
}
// Handler for ANALYZE table (Phase 3 Track 2)
async function handleAnalyzeTable(payload) {
    const { tableName } = payload;
    if (!tableName) {
        throw new Error('tableName is required for analyze_table job');
    }
    console.log(`[JobQueue] Running ANALYZE on table: ${tableName}`);
    const startTime = Date.now();
    const timeoutMs = 30000;
    try {
        const tableStatsQuery = `SELECT reltuples::bigint as row_count FROM pg_class WHERE relname = '${tableName}'`;
        const statsResult = await db.execute(sql.raw(tableStatsQuery));
        const rowCountBefore = statsResult.rows[0]?.row_count || 0;
        const analyzeQuery = `ANALYZE "${tableName}"`;
        await executeMaintenanceSQL(analyzeQuery, timeoutMs);
        const duration = Date.now() - startTime;
        const result = {
            tableName,
            operation: 'ANALYZE',
            duration,
            rowCount: rowCountBefore,
            completedAt: new Date().toISOString(),
        };
        console.log(`[JobQueue] ANALYZE completed for ${tableName} in ${duration}ms (${rowCountBefore} rows)`);
        return result;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[JobQueue] ANALYZE failed for ${tableName} after ${duration}ms:`, error.message);
        return {
            tableName,
            operation: 'ANALYZE',
            duration,
            success: false,
            error: error.message,
            completedAt: new Date().toISOString(),
        };
    }
}
// Handler for VACUUM table (Phase 3 Track 2)
async function handleVacuumTable(payload) {
    const { tableName } = payload;
    if (!tableName) {
        throw new Error('tableName is required for vacuum_table job');
    }
    console.log(`[JobQueue] Running VACUUM on table: ${tableName}`);
    const startTime = Date.now();
    const timeoutMs = 120000;
    try {
        const tableStatsQuery = `SELECT reltuples::bigint as row_count FROM pg_class WHERE relname = '${tableName}'`;
        const statsResult = await db.execute(sql.raw(tableStatsQuery));
        const rowCountBefore = statsResult.rows[0]?.row_count || 0;
        const vacuumQuery = `VACUUM "${tableName}"`;
        await executeMaintenanceSQL(vacuumQuery, timeoutMs);
        const duration = Date.now() - startTime;
        const result = {
            tableName,
            operation: 'VACUUM',
            duration,
            rowCount: rowCountBefore,
            completedAt: new Date().toISOString(),
        };
        console.log(`[JobQueue] VACUUM completed for ${tableName} in ${duration}ms (${rowCountBefore} rows)`);
        return result;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[JobQueue] VACUUM failed for ${tableName} after ${duration}ms:`, error.message);
        return {
            tableName,
            operation: 'VACUUM',
            duration,
            success: false,
            error: error.message,
            completedAt: new Date().toISOString(),
        };
    }
}
// Register handlers
jobQueueService.registerHandler('report_generation', handleReportGeneration);
jobQueueService.registerHandler('email_sending', handleEmailSending);
jobQueueService.registerHandler('purge_slow_query_logs', handlePurgeSlowQueryLogs);
jobQueueService.registerHandler('analyze_table', handleAnalyzeTable);
jobQueueService.registerHandler('vacuum_table', handleVacuumTable);
export { JobQueueService };
