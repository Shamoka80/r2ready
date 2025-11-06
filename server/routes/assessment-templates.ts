
import { Router } from "express";
import { z } from "zod";
import { db, executeQuery } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { AuthService } from "../services/authService";
import type { AuthenticatedRequest } from "../services/authService";

const router = Router();

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  facilityTypes: z.array(z.string()),
  industryVerticals: z.array(z.string()).optional(),
  standardCode: z.string().default("R2V3_1"),
  questionCategories: z.array(z.string()),
  defaultMilestones: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    category: z.enum(["PREPARATION", "ASSESSMENT", "REVIEW", "COMPLETION", "CERTIFICATION"]),
    daysOffset: z.number(),
    criticalPath: z.boolean().default(false),
    estimatedHours: z.number().optional(),
  })).optional(),
  scoringWeights: z.record(z.string(), z.number()).optional(),
  isPublic: z.boolean().default(false),
});

const updateTemplateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  facilityTypes: z.array(z.string()).optional(),
  industryVerticals: z.array(z.string()).optional(),
  questionCategories: z.array(z.string()).optional(),
  defaultMilestones: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    category: z.enum(["PREPARATION", "ASSESSMENT", "REVIEW", "COMPLETION", "CERTIFICATION"]),
    daysOffset: z.number(),
    criticalPath: z.boolean().default(false),
    estimatedHours: z.number().optional(),
  })).optional(),
  scoringWeights: z.record(z.string(), z.number()).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// All routes require authentication
router.use(AuthService.authMiddleware);

// CREATE assessment template
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const data = createTemplateSchema.parse(req.body);

    const templateId = crypto.randomUUID();
    
    await executeQuery(`
      INSERT INTO "AssessmentTemplate" (
        id, name, description, "facilityTypes", "industryVerticals", 
        "standardCode", "questionCategories", "defaultMilestones", 
        "scoringWeights", "isPublic", "isActive", "createdBy", 
        "tenantId", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, NOW(), NOW())
    `, [
      templateId,
      data.name,
      data.description,
      JSON.stringify(data.facilityTypes),
      JSON.stringify(data.industryVerticals || []),
      data.standardCode,
      JSON.stringify(data.questionCategories),
      JSON.stringify(data.defaultMilestones || []),
      JSON.stringify(data.scoringWeights || {}),
      data.isPublic,
      req.user!.id,
      req.tenant!.id
    ]);

    // Log audit event
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'ASSESSMENT_TEMPLATE_CREATED',
      'assessment_template',
      templateId,
      undefined,
      { name: data.name, facilityTypes: data.facilityTypes }
    );

    const createdTemplate = await executeQuery(`
      SELECT * FROM "AssessmentTemplate" WHERE id = $1
    `, [templateId]);

    res.status(201).json(createdTemplate.rows[0]);
  } catch (error) {
    console.error("Error creating assessment template:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: "Failed to create assessment template" });
  }
});

// GET assessment templates
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { facility_type, industry, standard_code, public_only } = req.query;

    let whereClause = `(t."tenantId" = $1 OR t."isPublic" = true) AND t."isActive" = true`;
    const params = [req.tenant!.id];
    let paramIndex = 2;

    if (facility_type) {
      whereClause += ` AND t."facilityTypes"::jsonb ? $${paramIndex}`;
      params.push(facility_type as string);
      paramIndex++;
    }

    if (industry) {
      whereClause += ` AND t."industryVerticals"::jsonb ? $${paramIndex}`;
      params.push(industry as string);
      paramIndex++;
    }

    if (standard_code) {
      whereClause += ` AND t."standardCode" = $${paramIndex}`;
      params.push(standard_code as string);
      paramIndex++;
    }

    if (public_only === 'true') {
      whereClause += ` AND t."isPublic" = true`;
    }

    const templates = await executeQuery(`
      SELECT 
        t.*,
        u."firstName" as "createdByFirstName",
        u."lastName" as "createdByLastName",
        COUNT(a.id) as "usageCount"
      FROM "AssessmentTemplate" t
      LEFT JOIN "User" u ON t."createdBy" = u.id
      LEFT JOIN "Assessment" a ON a."templateId" = t.id
      WHERE ${whereClause}
      GROUP BY t.id, u."firstName", u."lastName"
      ORDER BY t."createdAt" DESC
    `, params);

    res.json(templates.rows);
  } catch (error) {
    console.error("Error fetching assessment templates:", error);
    res.status(500).json({ error: "Failed to fetch assessment templates" });
  }
});

// GET specific template
router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const template = await executeQuery(`
      SELECT 
        t.*,
        u."firstName" as "createdByFirstName",
        u."lastName" as "createdByLastName"
      FROM "AssessmentTemplate" t
      LEFT JOIN "User" u ON t."createdBy" = u.id
      WHERE t.id = $1 AND (t."tenantId" = $2 OR t."isPublic" = true)
    `, [id, req.tenant!.id]);

    if (template.rowCount === 0) {
      return res.status(404).json({ error: "Assessment template not found" });
    }

    res.json(template.rows[0]);
  } catch (error) {
    console.error("Error fetching assessment template:", error);
    res.status(500).json({ error: "Failed to fetch assessment template" });
  }
});

// UPDATE assessment template
router.put("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateTemplateSchema.parse(req.body);

    // Verify template exists and user has access
    const existing = await executeQuery(`
      SELECT * FROM "AssessmentTemplate" 
      WHERE id = $1 AND "tenantId" = $2
    `, [id, req.tenant!.id]);

    if (existing.rowCount === 0) {
      return res.status(404).json({ error: "Assessment template not found" });
    }

    const updateFields = [];
    const updateParams = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value) || typeof value === 'object') {
          updateFields.push(`"${key}" = $${paramIndex}`);
          updateParams.push(JSON.stringify(value));
        } else {
          updateFields.push(`"${key}" = $${paramIndex}`);
          updateParams.push(value);
        }
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updateFields.push(`"updatedAt" = NOW()`);
    updateParams.push(id);

    await executeQuery(`
      UPDATE "AssessmentTemplate" 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `, updateParams);

    // Log audit event
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'ASSESSMENT_TEMPLATE_UPDATED',
      'assessment_template',
      id,
      existing.rows[0],
      data
    );

    const updated = await executeQuery(`
      SELECT * FROM "AssessmentTemplate" WHERE id = $1
    `, [id]);

    res.json(updated.rows[0]);
  } catch (error) {
    console.error("Error updating assessment template:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: "Failed to update assessment template" });
  }
});

// CREATE assessment from template
router.post("/:id/create-assessment", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { title, facilityId, intakeFormId } = req.body;

    // Get template
    const template = await executeQuery(`
      SELECT * FROM "AssessmentTemplate" t
      WHERE t.id = $1 AND (t."tenantId" = $2 OR t."isPublic" = true)
    `, [id, req.tenant!.id]);

    if (template.rowCount === 0) {
      return res.status(404).json({ error: "Assessment template not found" });
    }

    const templateData = template.rows[0];
    const assessmentId = crypto.randomUUID();

    // Create assessment from template
    await executeQuery(`
      INSERT INTO "Assessment" (
        id, "tenantId", "createdBy", "stdId", title, description,
        "facilityId", "intakeFormId", "templateId", status, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, 
        (SELECT id FROM "StandardVersion" WHERE code = $4 LIMIT 1),
        $5, $6, $7, $8, $9, 'DRAFT', NOW(), NOW())
    `, [
      assessmentId,
      req.tenant!.id,
      req.user!.id,
      templateData.standardCode,
      title,
      templateData.description,
      facilityId,
      intakeFormId,
      id
    ]);

    // Create default milestones if provided
    if (templateData.defaultMilestones) {
      const milestones = JSON.parse(templateData.defaultMilestones);
      for (const milestone of milestones) {
        const milestoneId = crypto.randomUUID();
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + milestone.daysOffset);

        await executeQuery(`
          INSERT INTO "Milestone" (
            id, "assessmentId", name, description, "targetDate", category,
            "criticalPath", "estimatedHours", status, progress,
            "createdBy", "tenantId", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', 0, $9, $10, NOW(), NOW())
        `, [
          milestoneId,
          assessmentId,
          milestone.name,
          milestone.description,
          targetDate,
          milestone.category,
          milestone.criticalPath,
          milestone.estimatedHours,
          req.user!.id,
          req.tenant!.id
        ]);
      }
    }

    res.status(201).json({ assessmentId, message: "Assessment created from template successfully" });
  } catch (error) {
    console.error("Error creating assessment from template:", error);
    res.status(500).json({ error: "Failed to create assessment from template" });
  }
});

export default router;
