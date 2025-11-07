import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware';
import { ExportService } from '../services/exportService';
import { db } from '../db';
import { assessments, intakeForms, organizationProfiles, facilityProfiles } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod'; // Import Zod for validation
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware'; // Assuming rateLimitMiddleware is available
const router = express.Router();
// Apply authentication middleware to all routes
router.use(authenticateUser);
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
router.get('/templates', (async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch templates'
        });
    }
}));
/**
 * POST /api/exports/generate
 * Generate export document
 */
router.post('/generate', (async (req, res) => {
    try {
        const { assessmentId, templateId, format, includeEvidence, includeAnalytics } = req.body;
        if (!assessmentId || !templateId || !format) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: assessmentId, templateId, format'
            });
        }
        // Validate format
        if (!['pdf', 'xlsx', 'docx'].includes(format)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid format. Must be pdf, xlsx, or docx'
            });
        }
        // Get assessment data with tenant isolation
        const assessment = await db.query.assessments.findFirst({
            where: and(eq(assessments.id, assessmentId), eq(assessments.tenantId, req.user.tenantId))
        });
        if (!assessment) {
            return res.status(404).json({
                success: false,
                error: 'Assessment not found'
            });
        }
        // Get related intake data
        let intakeData = null;
        if (assessment.intakeFormId) {
            intakeData = await db.query.intakeForms.findFirst({
                where: and(eq(intakeForms.id, assessment.intakeFormId), eq(intakeForms.tenantId, req.user.tenantId))
            });
        }
        // Get organization profile
        const organizationProfile = await db.query.organizationProfiles.findFirst({
            where: eq(organizationProfiles.tenantId, req.user.tenantId)
        });
        // Get facility profiles  
        const facilityProfilesData = await db.query.facilityProfiles.findMany({
            where: eq(facilityProfiles.tenantId, req.user.tenantId)
        });
        // Prepare onboarding data
        const onboardingData = {
            organizationProfile,
            facilityProfiles: facilityProfilesData
        };
        // Generate the document based on format
        let buffer;
        const templateType = templateId || (format === 'pdf' ? 'technical-report' : format === 'xlsx' ? 'dashboard' : 'executive-summary');
        if (format === 'pdf') {
            buffer = await ExportService.generatePDF(assessmentId, req.user.tenantId, templateType);
        }
        else if (format === 'xlsx') {
            buffer = await ExportService.generateExcel(assessmentId, req.user.tenantId, templateType);
        }
        else if (format === 'docx') {
            buffer = await ExportService.generateWord(assessmentId, req.user.tenantId, templateType);
        }
        else {
            throw new Error('Invalid format specified');
        }
        // Set appropriate headers
        const mimeTypes = {
            pdf: 'application/pdf',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        const extensions = {
            pdf: 'pdf',
            xlsx: 'xlsx',
            docx: 'docx'
        };
        const filename = `${assessment.title || 'assessment'}_${Date.now()}.${extensions[format]}`;
        res.setHeader('Content-Type', mimeTypes[format]);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    }
    catch (error) {
        console.error('Export generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate export',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
/**
 * GET /api/exports/documents/:documentId
 * Download a previously generated document
 */
router.get('/documents/:documentId', (async (req, res) => {
    try {
        const { documentId } = req.params;
        // For now, return a success response since we're generating documents on-demand
        // In a production environment, you might want to implement document storage and retrieval
        res.json({
            success: true,
            message: 'Document download feature not yet implemented',
            fileName: `document_${documentId}.pdf`
        });
    }
    catch (error) {
        console.error('Document download error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download document'
        });
    }
}));
/**
 * GET /api/exports/assessment/:assessmentId/summary
 * Get assessment export summary
 */
router.get('/assessment/:assessmentId/summary', (async (req, res) => {
    try {
        const { assessmentId } = req.params;
        // Get assessment with tenant isolation
        const assessment = await db.query.assessments.findFirst({
            where: and(eq(assessments.id, assessmentId), eq(assessments.tenantId, req.user.tenantId))
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
    }
    catch (error) {
        console.error('Error fetching assessment summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch assessment summary'
        });
    }
}));
// Enhanced PDF export with multiple template options
router.get("/:assessmentId/pdf/:templateType?", rateLimitMiddleware.pdfExport, (async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { templateType } = req.params; // Extract templateType from params
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
            where: and(eq(assessments.id, validatedAssessmentId), eq(assessments.tenantId, req.user.tenantId))
        });
        if (!assessment) {
            return res.status(404).json({
                success: false,
                error: 'Assessment not found'
            });
        }
        // Generate the document using ExportService
        const buffer = await ExportService.generatePDF(validatedAssessmentId, req.user.tenantId, validatedTemplateType || 'technical-report');
        const filename = `${assessment.title || 'assessment'}_${validatedTemplateType || 'report'}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    }
    catch (error) {
        console.error('PDF export generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate PDF export',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
export default router;
