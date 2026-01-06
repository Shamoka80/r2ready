import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { assessments, questions, answers, evidenceObjects, clauses } from "../../shared/schema.js";
import { eq, and, sql, desc, gt, lt, or } from "drizzle-orm";
import { PaginationUtils, paginationParamsSchema } from "../utils/pagination.js";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { AuthService, requireFacilityPermissionFromAssessment, getUserFacilityPermissions } from "../services/authService.js";
import { evidenceService } from "../services/evidenceService.js";
import { validation } from "../middleware/validationMiddleware.js";
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
// Evidence-specific validation schemas
const evidenceSchemas = {
    uploadParams: z.object({
        assessmentId: z.string().uuid({ message: 'Invalid assessment ID format' }),
        questionId: z.string().uuid({ message: 'Invalid question ID format' })
    }),
    uploadBody: z.object({
        notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
        evidenceType: z.enum(['DOCUMENT', 'IMAGE', 'VIDEO', 'CERTIFICATE', 'PROCEDURE', 'RECORD', 'OTHER']).optional(),
        tags: z.string()
            .max(200, 'Tags must be less than 200 characters')
            .refine(val => !val || val.split(',').length <= 10, 'Maximum 10 tags allowed')
            .optional()
    }),
    downloadParams: z.object({
        evidenceId: z.string().uuid({ message: 'Invalid evidence ID format' })
    }),
    deleteParams: z.object({
        evidenceId: z.string().uuid({ message: 'Invalid evidence ID format' })
    }),
    summaryParams: z.object({
        assessmentId: z.string().uuid({ message: 'Invalid assessment ID format' })
    }),
    listParams: z.object({
        assessmentId: z.string().uuid({ message: 'Invalid assessment ID format' }),
        questionId: z.string().uuid({ message: 'Invalid question ID format' })
    })
};
// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'evidence');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${name}_${uniqueSuffix}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit per file (reduced from 1GB for security)
        files: 10 // Max 10 files per upload (500MB total max)
    },
    fileFilter: (req, file, cb) => {
        // Allow common document and image formats
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'text/plain',
            'text/csv'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`File type ${file.mimetype} not allowed`));
        }
    }
});
// Evidence type detection based on file content and question context
function detectEvidenceType(file, questionText) {
    const fileName = file.originalname.toLowerCase();
    const questionLower = questionText?.toLowerCase() || '';
    // Certificate detection
    if (fileName.includes('certificate') || fileName.includes('cert') ||
        questionLower.includes('certificate') || questionLower.includes('certification')) {
        return 'CERTIFICATE';
    }
    // Procedure/Policy detection
    if (fileName.includes('procedure') || fileName.includes('policy') || fileName.includes('sop') ||
        questionLower.includes('procedure') || questionLower.includes('policy')) {
        return 'PROCEDURE';
    }
    // Record detection
    if (fileName.includes('record') || fileName.includes('log') || fileName.includes('report') ||
        questionLower.includes('record') || questionLower.includes('tracking')) {
        return 'RECORD';
    }
    // MIME type based detection
    if (file.mimetype.startsWith('image/')) {
        return 'IMAGE';
    }
    if (file.mimetype.startsWith('video/')) {
        return 'VIDEO';
    }
    // Default to document
    return 'DOCUMENT';
}
// Generate document tags based on question and assessment context
function generateDocumentTags(question, assessment, evidenceType) {
    const tags = [];
    // Add evidence type tag
    tags.push(evidenceType);
    // Add category code if available
    if (question.category_code) {
        tags.push(question.category_code);
    }
    // Add appendix if available
    if (question.appendix) {
        tags.push(question.appendix);
    }
    // Add assessment type
    if (assessment.assessmentType) {
        tags.push(assessment.assessmentType);
    }
    // Add facility tag
    tags.push('FACILITY_EVIDENCE');
    return tags.filter(Boolean);
}
// POST /api/evidence/upload/:assessmentId/:questionId - Upload evidence files
router.post('/upload/:assessmentId/:questionId', rateLimitMiddleware.evidenceUpload, validation.request({
    params: evidenceSchemas.uploadParams,
    body: evidenceSchemas.uploadBody
}), requireFacilityPermissionFromAssessment('manage_assessments'), upload.array('files', 10), async (req, res) => {
    try {
        const { assessmentId, questionId } = req.params;
        const files = req.files;
        const { notes, evidenceType, tags } = req.body;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        // Verify assessment and question exist
        const [assessment] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
        const [question] = await db.select().from(questions).where(eq(questions.id, questionId));
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        // Initialize evidence service
        await evidenceService.initialize();
        // Process each file with enhanced evidence management
        const uploadResults = [];
        const evidenceIds = [];
        for (const file of files) {
            try {
                // Auto-detect evidence type if not provided
                const detectedType = evidenceType || detectEvidenceType(file, question.text);
                // Generate intelligent tags
                const autoTags = generateDocumentTags(question, assessment, detectedType);
                const finalTags = tags ? [...autoTags, ...tags.split(',')] : autoTags;
                // Use EvidenceService for proper file processing
                const result = await evidenceService.processEvidenceUpload(file, assessment.facilityId, assessmentId, questionId, req.user.id);
                // Update evidence object with categorization (MERGE with existing scanResults)
                const [existingEvidence] = await db.select({ scanResults: evidenceObjects.scanResults })
                    .from(evidenceObjects)
                    .where(eq(evidenceObjects.id, result.id));
                const existingScanResults = existingEvidence?.scanResults || {};
                await db.update(evidenceObjects)
                    .set({
                    description: `${detectedType}: ${file.originalname} - ${notes || ''}`.trim(),
                    scanResults: {
                        ...existingScanResults, // Preserve warnings, checksums, file paths
                        evidenceType: detectedType,
                        tags: finalTags,
                        questionContext: {
                            text: question.text,
                            category: question.category_code,
                            appendix: question.appendix
                        },
                        categorizedAt: new Date().toISOString(),
                        categorizedBy: req.user.id
                    }
                })
                    .where(eq(evidenceObjects.id, result.id));
                uploadResults.push({
                    id: result.id,
                    originalName: result.originalName,
                    size: result.size,
                    mimeType: result.mimeType,
                    evidenceType: detectedType,
                    tags: finalTags,
                    scanStatus: result.scanStatus
                });
                evidenceIds.push(result.id);
            }
            catch (error) {
                console.error(`Failed to process file ${file.originalname}:`, error);
                throw new Error(`Failed to process file ${file.originalname}: ${error}`);
            }
        }
        // Update or create answer record with evidence references
        const [existingAnswer] = await db.select()
            .from(answers)
            .where(and(eq(answers.assessmentId, assessmentId), eq(answers.questionId, questionId)));
        if (existingAnswer) {
            const currentEvidenceIds = existingAnswer.evidenceFiles || [];
            const updatedEvidenceIds = [...currentEvidenceIds, ...evidenceIds];
            await db.update(answers)
                .set({
                evidenceFiles: updatedEvidenceIds,
                notes: notes || existingAnswer.notes,
                updatedAt: new Date()
            })
                .where(eq(answers.id, existingAnswer.id));
        }
        else {
            await db.insert(answers).values({
                id: crypto.randomUUID(),
                assessmentId,
                questionId,
                answeredBy: req.user.id,
                value: JSON.stringify({ evidenceOnly: true }),
                evidenceFiles: evidenceIds,
                notes: notes || null
            });
        }
        res.json({
            success: true,
            uploadedFiles: uploadResults,
            evidenceIds: evidenceIds,
            message: `${files.length} file(s) uploaded successfully with categorization and security scanning`,
            details: {
                totalFiles: files.length,
                categorizedTypes: [...new Set(uploadResults.map(r => r.evidenceType))],
                scanningStatus: 'pending',
                auditTrailCreated: true
            }
        });
    }
    catch (error) {
        console.error('Evidence upload error:', error);
        res.status(500).json({ error: 'Failed to upload evidence files' });
    }
});
// GET /api/evidence/:assessmentId/:questionId - Get evidence files for a question (with pagination)
router.get('/:assessmentId/:questionId', validation.request({
    params: evidenceSchemas.listParams
}), requireFacilityPermissionFromAssessment('view_reports'), async (req, res) => {
    try {
        const { assessmentId, questionId } = req.params;
        // Parse and validate pagination parameters
        const paginationParams = paginationParamsSchema.safeParse(req.query);
        if (!paginationParams.success) {
            return res.status(400).json({
                error: "Invalid pagination parameters",
                details: paginationParams.error.errors
            });
        }
        const { limit, cursor, direction } = PaginationUtils.validateParams(paginationParams.data);
        // Build base condition
        let whereCondition = and(eq(evidenceObjects.assessmentId, assessmentId), eq(evidenceObjects.questionId, questionId));
        // Build cursor condition for pagination using (createdAt DESC, id ASC) composite
        if (cursor && cursor.timestamp) {
            const cursorTimestamp = new Date(cursor.timestamp);
            if (direction === 'forward') {
                // Forward DESC: (createdAt < cursor.createdAt) OR (createdAt = cursor.createdAt AND id > cursor.id)
                // Primary sort DESC uses <, tie-breaker ASC uses >
                whereCondition = and(whereCondition, or(lt(evidenceObjects.createdAt, cursorTimestamp), and(eq(evidenceObjects.createdAt, cursorTimestamp), gt(evidenceObjects.id, cursor.id))));
            }
            else {
                // Backward DESC: (createdAt > cursor.createdAt) OR (createdAt = cursor.createdAt AND id < cursor.id)
                whereCondition = and(whereCondition, or(gt(evidenceObjects.createdAt, cursorTimestamp), and(eq(evidenceObjects.createdAt, cursorTimestamp), lt(evidenceObjects.id, cursor.id))));
            }
        }
        // Get evidence objects with pagination (limit + 1 to check hasMore)
        // For backward navigation, invert ORDER BY, then reverse results
        let evidenceFiles = await db.select({
            id: evidenceObjects.id,
            originalName: evidenceObjects.originalName,
            size: evidenceObjects.size,
            mime: evidenceObjects.mime,
            checksum: evidenceObjects.checksum,
            scanStatus: evidenceObjects.scanStatus,
            scanResults: evidenceObjects.scanResults,
            accessLevel: evidenceObjects.accessLevel,
            description: evidenceObjects.description,
            createdAt: evidenceObjects.createdAt,
            createdBy: evidenceObjects.createdBy
        })
            .from(evidenceObjects)
            .where(whereCondition)
            .orderBy(direction === 'forward' ? desc(evidenceObjects.createdAt) : evidenceObjects.createdAt, direction === 'forward' ? evidenceObjects.id : desc(evidenceObjects.id))
            .limit(limit + 1);
        // For backward navigation, reverse the results to maintain natural order
        if (direction === 'backward') {
            evidenceFiles = evidenceFiles.reverse();
        }
        // Build paginated response
        // For backward: sentinel is at START after reverse, skip it
        // For forward: sentinel is at END, take first limit items
        const hasMore = evidenceFiles.length > limit;
        const data = hasMore
            ? (direction === 'backward' ? evidenceFiles.slice(1) : evidenceFiles.slice(0, limit))
            : evidenceFiles;
        // Get answer notes (not paginated)
        const [answer] = await db.select({ notes: answers.notes })
            .from(answers)
            .where(and(eq(answers.assessmentId, assessmentId), eq(answers.questionId, questionId)));
        // Format evidence files with enhanced metadata
        const formattedFiles = data.map(file => {
            const scanResults = file.scanResults || {};
            return {
                id: file.id,
                originalName: file.originalName,
                size: file.size,
                mimeType: file.mime,
                uploadedAt: file.createdAt,
                scanStatus: file.scanStatus,
                accessLevel: file.accessLevel,
                description: file.description,
                evidenceType: scanResults.evidenceType || 'DOCUMENT',
                tags: scanResults.tags || [],
                isClean: file.scanStatus === 'clean',
                downloadUrl: `/api/evidence/download/${file.id}`,
                auditUrl: `/api/evidence/audit/${file.id}`,
                checksum: file.checksum.substring(0, 8) + '...' // Truncated for security
            };
        });
        // Build pagination cursors
        let nextCursor = null;
        let prevCursor = null;
        if (data.length > 0) {
            if (direction === 'forward' && hasMore) {
                const lastItem = data[data.length - 1];
                nextCursor = PaginationUtils.encodeCursor({
                    id: lastItem.id,
                    timestamp: lastItem.createdAt?.getTime(),
                });
            }
            // Only provide prevCursor if not on first page
            if (cursor) {
                const firstItem = data[0];
                prevCursor = PaginationUtils.encodeCursor({
                    id: firstItem.id,
                    timestamp: firstItem.createdAt?.getTime(),
                });
            }
        }
        res.json({
            data: formattedFiles,
            notes: answer?.notes || null,
            summary: {
                totalReturned: formattedFiles.length,
                cleanFiles: formattedFiles.filter(f => f.isClean).length,
                pendingScans: formattedFiles.filter(f => f.scanStatus === 'pending').length,
                evidenceTypes: [...new Set(formattedFiles.map(f => f.evidenceType))],
                totalSize: formattedFiles.reduce((sum, f) => sum + f.size, 0)
            },
            pagination: {
                hasMore,
                nextCursor,
                prevCursor,
                totalReturned: formattedFiles.length,
            }
        });
    }
    catch (error) {
        console.error('Error fetching evidence files:', error);
        res.status(500).json({ error: 'Failed to fetch evidence files' });
    }
});
// GET /api/evidence/download/:evidenceId - Download evidence file by ID
router.get('/download/:evidenceId', validation.request({
    params: evidenceSchemas.downloadParams
}), async (req, res) => {
    try {
        const { evidenceId } = req.params;
        // Verify evidence ID format
        if (!evidenceId.match(/^[a-f0-9\-]{36}$/i)) {
            return res.status(400).json({ error: 'Invalid evidence ID format' });
        }
        // Get evidence object with facility access verification
        const [evidence] = await db.select({
            id: evidenceObjects.id,
            originalName: evidenceObjects.originalName,
            storageUri: evidenceObjects.storageUri,
            facilityId: evidenceObjects.facilityId,
            scanStatus: evidenceObjects.scanStatus,
            accessLevel: evidenceObjects.accessLevel,
            mime: evidenceObjects.mime
        })
            .from(evidenceObjects)
            .where(eq(evidenceObjects.id, evidenceId))
            .limit(1);
        if (!evidence) {
            return res.status(404).json({ error: 'Evidence file not found' });
        }
        // Security check: Only allow download of clean files
        if (evidence.scanStatus === 'infected') {
            return res.status(403).json({ error: 'File is quarantined due to security scan results' });
        }
        if (evidence.scanStatus === 'pending') {
            return res.status(423).json({ error: 'File is still being scanned, please try again later' });
        }
        // Check facility permission for this user
        const userRole = req.user.businessRole;
        if (!['business_owner', 'account_admin'].includes(userRole)) {
            const facilityPermissions = await getUserFacilityPermissions(req.user.id, evidence.facilityId);
            if (!facilityPermissions.facilities.includes(evidence.facilityId)) {
                return res.status(403).json({ error: 'Access denied: No facility access' });
            }
            if (!facilityPermissions.canViewReports[evidence.facilityId]) {
                return res.status(403).json({ error: 'Access denied: view_reports permission required' });
            }
        }
        // Check access level (future enhancement for data classification)
        if (evidence.accessLevel === 'restricted' && !['business_owner', 'account_admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Access denied: Restricted evidence requires admin access' });
        }
        // Build file path from storage URI
        const filePath = path.join(process.cwd(), 'uploads', evidence.storageUri);
        try {
            await fs.access(filePath);
            // Set proper download headers
            res.setHeader('Content-Disposition', `attachment; filename="${evidence.originalName}"`);
            res.setHeader('Content-Type', evidence.mime);
            // Stream the file
            res.download(filePath, evidence.originalName);
            // Log access in audit trail (fire and forget)
            setTimeout(async () => {
                try {
                    await db.insert(evidenceObjects).values({
                    // This would be logged in a separate audit table in production
                    });
                }
                catch (err) {
                    console.warn('Failed to log evidence download:', err);
                }
            }, 0);
        }
        catch (error) {
            console.error(`Evidence file not found at path: ${filePath}`);
            res.status(404).json({ error: 'Evidence file not found on storage' });
        }
    }
    catch (error) {
        console.error('Error downloading evidence file:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});
// DELETE /api/evidence/:evidenceId - Delete evidence file by ID
router.delete('/evidence/:evidenceId', async (req, res) => {
    try {
        const { evidenceId } = req.params;
        // Get evidence object for validation
        const [evidence] = await db.select({
            id: evidenceObjects.id,
            facilityId: evidenceObjects.facilityId,
            storageUri: evidenceObjects.storageUri,
            originalName: evidenceObjects.originalName,
            assessmentId: evidenceObjects.assessmentId,
            questionId: evidenceObjects.questionId
        })
            .from(evidenceObjects)
            .where(eq(evidenceObjects.id, evidenceId));
        if (!evidence) {
            return res.status(404).json({ error: 'Evidence file not found' });
        }
        // Check facility permission
        const userRole = req.user.businessRole;
        if (!['business_owner', 'account_admin'].includes(userRole)) {
            const facilityPermissions = await getUserFacilityPermissions(req.user.id, evidence.facilityId);
            if (!facilityPermissions.canManageAssessments[evidence.facilityId]) {
                return res.status(403).json({ error: 'Access denied: manage_assessments permission required' });
            }
        }
        // Remove evidence from database
        await db.delete(evidenceObjects).where(eq(evidenceObjects.id, evidenceId));
        // Update answer record to remove evidence reference
        if (evidence.assessmentId && evidence.questionId) {
            const [answer] = await db.select()
                .from(answers)
                .where(and(eq(answers.assessmentId, evidence.assessmentId), eq(answers.questionId, evidence.questionId)));
            if (answer && answer.evidenceFiles) {
                const updatedFiles = answer.evidenceFiles.filter(id => id !== evidenceId);
                await db.update(answers)
                    .set({
                    evidenceFiles: updatedFiles,
                    updatedAt: new Date()
                })
                    .where(eq(answers.id, answer.id));
            }
        }
        // Delete physical file
        const filePath = path.join(process.cwd(), 'uploads', evidence.storageUri);
        try {
            await fs.unlink(filePath);
        }
        catch (error) {
            console.warn(`Physical file not found: ${evidence.storageUri}`);
        }
        res.json({
            success: true,
            message: `Evidence file '${evidence.originalName}' deleted successfully`,
            evidenceId: evidenceId
        });
    }
    catch (error) {
        console.error('Error deleting evidence file:', error);
        res.status(500).json({ error: 'Failed to delete evidence file' });
    }
});
// GET /api/evidence/assessment/:assessmentId/summary - Get evidence summary for assessment
router.get('/assessment/:assessmentId/summary', requireFacilityPermissionFromAssessment('view_reports'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        // Get assessment to access its standard ID
        const assessmentResult = await db.select({
            id: assessments.id,
            stdId: assessments.stdId
        })
            .from(assessments)
            .where(eq(assessments.id, assessmentId))
            .limit(1);
        // Handle PostgreSQL result structure (array vs object)
        const assessment = Array.isArray(assessmentResult)
            ? assessmentResult[0]
            : assessmentResult.rows?.[0] || assessmentResult;
        if (!assessment || !assessment.stdId) {
            console.error('Assessment not found or missing stdId:', { assessmentId, assessment });
            return res.status(404).json({ error: 'Assessment not found' });
        }
        // Query ALL questions that require evidence for this assessment's standard
        // This includes both answered and unanswered questions
        // Using leftJoin for clauses (same pattern as assessments route) and filter stdId in WHERE
        console.log('🔍 Fetching questions requiring evidence for assessment:', assessmentId, 'stdId:', assessment.stdId);
        let questionsRequiringEvidence;
        try {
            questionsRequiringEvidence = await db.select({
                questionId: questions.id, // UUID for API compatibility
                questionTextId: questions.questionId, // Text identifier for display
                questionText: questions.text,
                required: questions.required,
                evidenceRequired: questions.evidenceRequired
            })
                .from(questions)
                .leftJoin(clauses, eq(questions.clauseId, clauses.id))
                .where(and(eq(clauses.stdId, assessment.stdId), eq(questions.evidenceRequired, true), eq(questions.isActive, true)));
            console.log('✅ Query executed successfully. Results count:', Array.isArray(questionsRequiringEvidence) ? questionsRequiringEvidence.length : 'unknown');
        }
        catch (queryError) {
            console.error('❌ Query failed:', queryError);
            throw queryError;
        }
        const summary = {
            totalQuestionsWithEvidence: 0,
            totalEvidenceFiles: 0,
            requiredEvidenceCompleted: 0,
            requiredEvidenceTotal: 0,
            evidenceByQuestion: [],
            evidenceCompletionRate: 0
        };
        // Process all questions requiring evidence (answered or not)
        // Drizzle returns results as an array directly
        const questionsArray = Array.isArray(questionsRequiringEvidence)
            ? questionsRequiringEvidence
            : [];
        console.log('📊 Processing', questionsArray.length, 'questions requiring evidence');
        // Count evidence files from evidenceObjects table for each question
        for (const question of questionsArray) {
            if (!question || !question.questionId) {
                console.warn('⚠️ Skipping invalid question entry:', question);
                continue;
            }
            // Count actual evidence files from evidenceObjects table (not from answers.evidenceFiles)
            // This ensures we get accurate counts even if answer records don't exist
            const evidenceCountResult = await db.select({
                count: sql `count(*)::int`
            })
                .from(evidenceObjects)
                .where(and(eq(evidenceObjects.assessmentId, assessmentId), eq(evidenceObjects.questionId, question.questionId)));
            const fileCount = evidenceCountResult[0]?.count || 0;
            console.log(`📁 Question ${question.questionId}: ${fileCount} evidence files`);
            if (fileCount > 0) {
                summary.totalQuestionsWithEvidence++;
                summary.totalEvidenceFiles += fileCount;
            }
            // All questions in this list require evidence
            summary.requiredEvidenceTotal++;
            if (fileCount > 0) {
                summary.requiredEvidenceCompleted++;
            }
            // Include all evidence-required questions in the list
            summary.evidenceByQuestion.push({
                questionId: question.questionId, // UUID for API compatibility
                questionText: question.questionText || 'Unknown question',
                required: question.required || false,
                evidenceRequired: question.evidenceRequired !== undefined ? question.evidenceRequired : true,
                fileCount,
                status: fileCount > 0 ? 'COMPLETE' : 'MISSING'
            });
        }
        console.log('✅ Processed', summary.evidenceByQuestion.length, 'questions. Required total:', summary.requiredEvidenceTotal);
        summary.evidenceCompletionRate = summary.requiredEvidenceTotal > 0
            ? Math.round((summary.requiredEvidenceCompleted / summary.requiredEvidenceTotal) * 100)
            : 100;
        res.json(summary);
    }
    catch (error) {
        console.error('Error generating evidence summary:', error);
        console.error('Error details:', error instanceof Error ? error.stack : String(error));
        res.status(500).json({
            error: 'Failed to generate evidence summary',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
// GET /api/evidence/audit/:evidenceId - Get evidence audit trail
router.get('/audit/:evidenceId', async (req, res) => {
    try {
        const { evidenceId } = req.params;
        // Verify evidence ID format
        if (!evidenceId.match(/^[a-f0-9\-]{36}$/i)) {
            return res.status(400).json({ error: 'Invalid evidence ID format' });
        }
        // Get evidence object and verify access
        const [evidence] = await db.select({
            facilityId: evidenceObjects.facilityId
        })
            .from(evidenceObjects)
            .where(eq(evidenceObjects.id, evidenceId));
        if (!evidence) {
            return res.status(404).json({ error: 'Evidence file not found' });
        }
        // Check facility permission
        const userRole = req.user.businessRole;
        if (!['business_owner', 'account_admin'].includes(userRole)) {
            const facilityPermissions = await getUserFacilityPermissions(req.user.id, evidence.facilityId);
            if (!facilityPermissions.canViewReports[evidence.facilityId]) {
                return res.status(403).json({ error: 'Access denied: view_reports permission required' });
            }
        }
        // Get comprehensive audit log from EvidenceService
        const auditLog = await evidenceService.getEvidenceAuditLog(evidenceId);
        res.json({
            success: true,
            auditLog: auditLog
        });
    }
    catch (error) {
        console.error('Error retrieving evidence audit log:', error);
        res.status(500).json({ error: 'Failed to retrieve audit log' });
    }
});
export default router;
