import express, { Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';
import { jobQueueService } from '../services/jobQueue';
import { db } from '../db';
import { assessments, facilityProfiles } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser as any);

/**
 * GET /api/reports
 * List all generated reports for the tenant
 */
router.get('/', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get all completed report_generation jobs for this tenant
    const tenantJobs = await jobQueueService.getJobsByTenant(req.user.tenantId, 100);
    
    // Filter for completed report generation jobs
    const reportJobs = tenantJobs.filter(
      job => job.type === 'report_generation' && job.status === 'COMPLETED' && job.result
    );

    // Map jobs to report format expected by frontend
    const reports = await Promise.all(
      reportJobs.map(async (job) => {
        const payload = job.payload as any;
        const result = job.result as any;
        
        // Get assessment details
        const assessment = await db.query.assessments.findFirst({
          where: and(
            eq(assessments.id, payload.assessmentId),
            eq(assessments.tenantId, req.user.tenantId)
          )
        });

        // Get facility name if available
        let facilityName: string | undefined;
        if (assessment?.facilityId) {
          const facility = await db.query.facilityProfiles.findFirst({
            where: eq(facilityProfiles.id, assessment.facilityId)
          });
          facilityName = facility?.name;
        }

        // Determine report type from format
        const format = payload.format || 'pdf';
        const typeMap: Record<string, 'PDF' | 'Excel' | 'Word' | 'Email'> = {
          'pdf': 'PDF',
          'xlsx': 'Excel',
          'excel': 'Excel',
          'docx': 'Word',
          'word': 'Word',
          'email': 'Email'
        };

        // Calculate file size from base64 buffer if available
        let fileSize: number | undefined;
        if (result?.buffer) {
          fileSize = Buffer.from(result.buffer, 'base64').length;
        }

        return {
          id: job.id,
          name: `${assessment?.title || 'Report'}_${format === 'pdf' ? 'Report' : format === 'xlsx' ? 'Dashboard' : format === 'docx' ? 'Summary' : 'Template'}`,
          type: typeMap[format] || 'PDF',
          assessmentId: payload.assessmentId,
          assessmentTitle: assessment?.title || 'Unknown Assessment',
          facilityName,
          createdAt: job.createdAt?.toISOString() || new Date().toISOString(),
          createdBy: req.user.id,
          fileSize,
          version: 1,
          downloadUrl: `/api/exports/jobs/${job.id}/download`
        };
      })
    );

    // Sort by creation date (newest first)
    reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

export default router;

