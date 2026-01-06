import express, { Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';
import { ExportService } from '../services/exportService';
import { db } from '../db';
import { assessments, intakeForms, organizationProfiles, facilityProfiles } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import path from 'path';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { jobQueueService } from '../services/jobQueue';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser as any);

// Helper function to normalize formats for backward compatibility
function normalizeFormat(format: string): 'pdf' | 'xlsx' | 'docx' {
  const formatMap: Record<string, 'pdf' | 'xlsx' | 'docx'> = {
    'pdf': 'pdf',
    'excel': 'xlsx',
    'xlsx': 'xlsx',
    'word': 'docx',
    'docx': 'docx'
  };
  
  return formatMap[format.toLowerCase()] || 'pdf';
}

// Production-ready export validation schema
const exportRequestSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
  templateType: z.enum(['technical-report', 'executive-summary', 'gap-analysis', 'compliance-report', 'dashboard', 'analytics', 'gap-tracker', 'action-plan', 'compliance-manual', 'consultation', 'progress-update', 'completion-notice']).optional(),
  format: z.enum(['pdf', 'excel', 'word', 'email']).optional()
});

/**
 * GET /api/exports/templates
 * Get available export templates
 */
router.get('/templates', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = [
      {
        id: 'pdf-technical-report',
        name: 'PDF Technical Report',
        type: 'pdf',
        template: 'pdf_temp_export',
        description: 'Comprehensive technical assessment report in PDF format'
      },
      {
        id: 'excel-analysis',
        name: 'Excel Analysis Workbook',
        type: 'excel',
        template: 'excel_temp_export',
        description: 'Detailed analysis and data breakdown in Excel format'
      },
      {
        id: 'word-executive-summary',
        name: 'Word Executive Summary',
        type: 'word',
        template: 'word_temp_export',
        description: 'Executive summary and recommendations in Word format'
      },
      {
        id: 'scope-statement',
        name: 'Scope Statement',
        type: 'scope-statement',
        template: 'email_temp_export',
        description: 'R2v3 certification scope statement'
      }
    ];

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
}) as any);

/**
 * POST /api/exports/generate
 * Generate export document - supports both sync (default) and async modes
 */
router.post('/generate', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { async: isAsync, assessmentId, templateId, format: rawFormat, includeEvidence, includeAnalytics } = req.body;

    if (!assessmentId || !rawFormat) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: assessmentId, format'
      });
    }

    // Normalize format for backward compatibility (excel -> xlsx, word -> docx)
    const format = normalizeFormat(rawFormat);

    // Get assessment data with tenant isolation
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, assessmentId),
        eq(assessments.tenantId, req.user.tenantId)
      )
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found'
      });
    }

    // Determine template type
    const templateType = templateId || (format === 'pdf' ? 'technical-report' : format === 'xlsx' ? 'dashboard' : 'executive-summary');

    // ASYNC MODE: Enqueue job and return jobId
    if (isAsync) {
      const jobId = await jobQueueService.enqueue({
        tenantId: req.user.tenantId,
        type: 'report_generation',
        priority: 'medium',
        payload: {
          assessmentId,
          tenantId: req.user.tenantId,
          format,
          templateType
        }
      });

      console.log(`[Exports] Enqueued report generation job ${jobId} for assessment ${assessmentId}`);

      return res.json({
        success: true,
        jobId,
        async: true,
        message: 'Report generation job enqueued. Use /api/exports/jobs/:jobId to check status and download.'
      });
    }

    // SYNC MODE (DEFAULT): Generate and return file immediately
    console.log(`[Exports] Generating ${format} synchronously for assessment ${assessmentId}`);
    
    let buffer: Buffer;
    if (format === 'pdf') {
      buffer = await ExportService.generatePDF(assessmentId, req.user.tenantId, templateType);
    } else if (format === 'xlsx') {
      buffer = await ExportService.generateExcel(assessmentId, req.user.tenantId, templateType);
    } else if (format === 'docx') {
      buffer = await ExportService.generateWord(assessmentId, req.user.tenantId, templateType);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid format'
      });
    }

    // Return file directly
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    const extensions: Record<string, string> = {
      pdf: 'pdf',
      xlsx: 'xlsx',
      docx: 'docx'
    };

    res.setHeader('Content-Type', mimeTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${assessment.title}_report.${extensions[format]}"`);
    res.send(buffer);

  } catch (error) {
    console.error('Export generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate export',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

/**
 * GET /api/exports/documents/:documentId
 * Download a previously generated document
 */
router.get('/documents/:documentId', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    // For now, return a success response since we're generating documents on-demand
    // In a production environment, you might want to implement document storage and retrieval
    res.json({
      success: true,
      message: 'Document download feature not yet implemented',
      fileName: `document_${documentId}.pdf`
    });

  } catch (error) {
    console.error('Document download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download document'
    });
  }
}) as any);

/**
 * GET /api/exports/assessment/:assessmentId/summary
 * Get assessment export summary
 */
router.get('/assessment/:assessmentId/summary', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;

    // Get assessment with tenant isolation
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, assessmentId),
        eq(assessments.tenantId, req.user.tenantId)
      )
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found'
      });
    }

    // Get related data counts
    const intakeData = assessment.intakeFormId ? await db.query.intakeForms.findFirst({
      where: eq(intakeForms.id, assessment.intakeFormId)
    }) : null;

    const summary = {
      assessmentId: assessment.id,
      title: assessment.title,
      status: assessment.status,
      progress: assessment.progress,
      overallScore: assessment.overallScore,
      compliancePercentage: assessment.compliancePercentage,
      criticalIssuesCount: assessment.criticalIssuesCount,
      hasIntakeData: !!intakeData,
      createdAt: assessment.createdAt,
      lastUpdated: assessment.updatedAt
    };

    res.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Error fetching assessment summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assessment summary'
    });
  }
}) as any);

/**
 * GET /api/exports/jobs/:jobId
 * Get job status (structured response, not raw file download)
 */
router.get('/jobs/:jobId', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await jobQueueService.getJob(jobId);

    if (!job || job.tenantId !== req.user.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Return structured status (not raw download)
    const response: any = {
      success: true,
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts
    };

    if (job.status === 'COMPLETED' && job.result) {
      // Include download URL instead of raw file
      response.downloadUrl = `/api/exports/jobs/${job.id}/download`;
      const result = job.result as any;
      response.filename = result.filename;
      response.mimeType = result.mimeType;
    }

    if (job.status === 'FAILED') {
      response.error = job.error;
    }

    res.json(response);
  } catch (error) {
    console.error('Job status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

/**
 * GET /api/exports/jobs/:jobId/download
 * Download completed job result
 */
router.get('/jobs/:jobId/download', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await jobQueueService.getJob(jobId);

    if (!job || job.tenantId !== req.user.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    if (job.status !== 'COMPLETED' || !job.result) {
      return res.status(400).json({
        success: false,
        error: 'Job not completed or no result available',
        status: job.status
      });
    }

    // Decode base64 buffer and send file
    const result = job.result as { buffer: string; mimeType: string; filename: string };
    const buffer = Buffer.from(result.buffer, 'base64');
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Job download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download job result',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

// Enhanced PDF export - synchronous (most common use case)
router.get("/:assessmentId/pdf/:templateType?", 
  rateLimitMiddleware.pdfExport,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { assessmentId, templateType } = req.params;
      const validationResult = exportRequestSchema.safeParse({ assessmentId, templateType, format: 'pdf' });

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request parameters',
          details: validationResult.error.errors
        });
      }

      const { assessmentId: validatedAssessmentId, templateType: validatedTemplateType } = validationResult.data;

      // Get assessment data with tenant isolation
      const assessment = await db.query.assessments.findFirst({
        where: and(
          eq(assessments.id, validatedAssessmentId),
          eq(assessments.tenantId, req.user.tenantId)
        )
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          error: 'Assessment not found'
        });
      }

      // Generate and return PDF immediately (synchronous)
      console.log(`[Exports] Generating PDF synchronously for assessment ${validatedAssessmentId}`);
      
      const buffer = await ExportService.generatePDF(
        validatedAssessmentId,
        req.user.tenantId,
        validatedTemplateType || 'technical-report'
      );

      // Validate buffer before sending
      if (!buffer || buffer.length === 0) {
        console.error('[Exports] Generated PDF buffer is empty');
        return res.status(500).json({
          success: false,
          error: 'Failed to generate PDF export',
          details: 'PDF buffer is empty'
        });
      }

      console.log(`[Exports] PDF generated successfully, size: ${buffer.length} bytes`);

      // Set proper headers for PDF download - MUST be set before sending
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="R2v3_Technical_Report.pdf"');
      res.setHeader('Content-Length', buffer.length.toString());
      
      // Send binary buffer directly - do NOT use res.json()
      res.send(buffer);

    } catch (error) {
      console.error('PDF export generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF export',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
}) as any);

export default router;
