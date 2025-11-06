import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { assessments, questions, answers, users } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { evidenceService } from "../services/evidenceService.js";
import { requireFacilityPermissionFromAssessment, type AuthenticatedRequest } from "../services/authService.js";
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';

const router = Router();

// Configure multer for temporary uploads (evidenceService will handle final storage)
const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'temp'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit (aligned with evidenceService)
    files: 5 // Max 5 files per upload (aligned with evidenceService)
  }
});

// Enhanced file upload endpoint with security hardening
router.post('/upload/:assessmentId/:questionId', 
  rateLimitMiddleware.evidenceUpload,
  requireFacilityPermissionFromAssessment('manage_assessments'),
  upload.array('files', 5), 
  async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentId, questionId } = req.params;
    const files = req.files as Express.Multer.File[];
    const { notes } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Initialize evidence service
    await evidenceService.initialize();

    // Verify assessment and question exist
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
    const [question] = await db.select().from(questions).where(eq(questions.id, questionId));

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Get user's facility ID for evidence isolation
    const facilityId = assessment.facilityId;
    if (!facilityId) {
      return res.status(400).json({ error: 'Assessment must be associated with a facility' });
    }

    const results = [];
    const errors = [];

    // Process each file through the hardened evidence service
    for (const file of files) {
      try {
        const result = await evidenceService.processEvidenceUpload(
          file,
          facilityId,
          assessmentId,
          questionId,
          req.user!.id
        );
        results.push(result);
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Update or create answer record with evidence references
    if (results.length > 0) {
      const [existingAnswer] = await db.select()
        .from(answers)
        .where(and(eq(answers.assessmentId, assessmentId), eq(answers.questionId, questionId)));

      const evidenceIds = results.map(r => r.id);

      if (existingAnswer) {
        // Update existing answer with new evidence references
        const currentEvidenceIds = Array.isArray(existingAnswer.evidenceFiles) 
          ? existingAnswer.evidenceFiles 
          : [];
        const updatedEvidenceIds = [...currentEvidenceIds, ...evidenceIds];
        
        await db.update(answers)
          .set({
            evidenceFiles: updatedEvidenceIds,
            notes: notes || existingAnswer.notes,
            updatedAt: new Date()
          })
          .where(eq(answers.id, existingAnswer.id));
      } else {
        // Create new answer with evidence references
        await db.insert(answers).values({
          id: crypto.randomUUID(),
          assessmentId,
          questionId,
          answeredBy: req.user!.id,
          value: JSON.stringify({ evidenceOnly: true }),
          evidenceFiles: evidenceIds,
          notes: notes || null
        });
      }
    }

    res.json({
      success: true,
      uploaded: results.length,
      failed: errors.length,
      results,
      errors,
      message: `Successfully uploaded ${results.length} file(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}`
    });

  } catch (error) {
    console.error('Evidence upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload evidence',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get evidence audit log endpoint
router.get('/audit/:evidenceId',
  async (req: AuthenticatedRequest, res) => {
  try {
    const { evidenceId } = req.params;
    
    const auditLog = await evidenceService.getEvidenceAuditLog(evidenceId);
    
    res.json(auditLog);
  } catch (error) {
    console.error('Evidence audit error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve evidence audit log',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint for evidence service
router.get('/health', async (req, res) => {
  try {
    await evidenceService.initialize();
    res.json({ 
      status: 'healthy',
      service: 'evidence-v2',
      features: {
        checksumValidation: true,
        antivirusScanning: true,
        immutableStorage: true,
        auditLogging: true,
        quarantine: true
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;