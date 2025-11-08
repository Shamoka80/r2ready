import { Router } from "express";
import { z } from "zod";
import { executeQuery } from '../db.js';
import { AuthService } from '../services/authService.js';
const router = Router();
// Validation schemas
const createCorrectiveActionSchema = z.object({
    assessmentId: z.string().uuid(),
    questionId: z.string().uuid().optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    assignedTo: z.string().uuid().optional(),
    dueDate: z.string().datetime().optional(),
    evidenceRequired: z.boolean().default(false),
    tags: z.array(z.string()).optional(),
});
const updateCorrectiveActionSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "DEFERRED", "CANCELLED"]).optional(),
    assignedTo: z.string().uuid().optional(),
    dueDate: z.string().datetime().optional(),
    completedDate: z.string().datetime().optional(),
    resolution: z.string().optional(),
    evidenceRequired: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
});
// All routes require authentication
router.use(AuthService.authMiddleware);
// CREATE corrective action
router.post("/", async (req, res) => {
    try {
        const data = createCorrectiveActionSchema.parse(req.body);
        // Verify assessment exists and user has access
        const assessment = await executeQuery(`
      SELECT a.id, a."tenantId" FROM "Assessment" a 
      WHERE a.id = $1 AND a."tenantId" = $2
    `, [data.assessmentId, req.tenant.id]);
        if (assessment.rowCount === 0) {
            return res.status(404).json({ error: "Assessment not found" });
        }
        const actionId = crypto.randomUUID();
        await executeQuery(`
      INSERT INTO "CorrectiveAction" (
        id, "assessmentId", "questionId", title, description, priority,
        status, "assignedTo", "dueDate", "evidenceRequired", tags,
        "createdBy", "tenantId", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $8, $9, $10, $11, $12, NOW(), NOW())
    `, [
            actionId,
            data.assessmentId,
            data.questionId,
            data.title,
            data.description,
            data.priority,
            data.assignedTo,
            data.dueDate ? new Date(data.dueDate) : null,
            data.evidenceRequired,
            JSON.stringify(data.tags || []),
            req.user.id,
            req.tenant.id
        ]);
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'CORRECTIVE_ACTION_CREATED', 'corrective_action', actionId, undefined, { title: data.title, priority: data.priority, assessmentId: data.assessmentId });
        const createdAction = await executeQuery(`
      SELECT * FROM "CorrectiveAction" WHERE id = $1
    `, [actionId]);
        res.status(201).json(createdAction.rows[0]);
    }
    catch (error) {
        console.error("Error creating corrective action:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create corrective action" });
    }
});
// GET corrective actions for assessment
router.get("/assessment/:assessmentId", async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { status, priority, assignedTo } = req.query;
        let whereClause = `ca."assessmentId" = $1 AND ca."tenantId" = $2`;
        const params = [assessmentId, req.tenant.id];
        let paramIndex = 3;
        if (status) {
            whereClause += ` AND ca.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        if (priority) {
            whereClause += ` AND ca.priority = $${paramIndex}`;
            params.push(priority);
            paramIndex++;
        }
        if (assignedTo) {
            whereClause += ` AND ca."assignedTo" = $${paramIndex}`;
            params.push(assignedTo);
            paramIndex++;
        }
        const actions = await executeQuery(`
      SELECT 
        ca.*,
        u1."firstName" as "createdByFirstName",
        u1."lastName" as "createdByLastName",
        u2."firstName" as "assignedToFirstName",
        u2."lastName" as "assignedToLastName",
        q."text" as "questionText"
      FROM "CorrectiveAction" ca
      LEFT JOIN "User" u1 ON ca."createdBy" = u1.id
      LEFT JOIN "User" u2 ON ca."assignedTo" = u2.id
      LEFT JOIN "Question" q ON ca."questionId" = q.id
      WHERE ${whereClause}
      ORDER BY ca."createdAt" DESC
    `, params);
        res.json(actions.rows);
    }
    catch (error) {
        console.error("Error fetching corrective actions:", error);
        res.status(500).json({ error: "Failed to fetch corrective actions" });
    }
});
// UPDATE corrective action
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateCorrectiveActionSchema.parse(req.body);
        // Verify action exists and user has access
        const existing = await executeQuery(`
      SELECT * FROM "CorrectiveAction" 
      WHERE id = $1 AND "tenantId" = $2
    `, [id, req.tenant.id]);
        if (existing.rowCount === 0) {
            return res.status(404).json({ error: "Corrective action not found" });
        }
        const updateFields = [];
        const updateParams = [];
        let paramIndex = 1;
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                if (key === 'dueDate' || key === 'completedDate') {
                    updateFields.push(`"${key}" = $${paramIndex}`);
                    updateParams.push(value && typeof value === 'string' ? new Date(value) : null);
                }
                else if (key === 'tags') {
                    updateFields.push(`"${key}" = $${paramIndex}`);
                    updateParams.push(JSON.stringify(value));
                }
                else {
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
      UPDATE "CorrectiveAction" 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `, updateParams);
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'CORRECTIVE_ACTION_UPDATED', 'corrective_action', id, existing.rows[0], data);
        const updated = await executeQuery(`
      SELECT * FROM "CorrectiveAction" WHERE id = $1
    `, [id]);
        res.json(updated.rows[0]);
    }
    catch (error) {
        console.error("Error updating corrective action:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to update corrective action" });
    }
});
// GET corrective action statistics
router.get("/stats/:assessmentId", async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN priority = 'CRITICAL' THEN 1 END) as critical,
        COUNT(CASE WHEN priority = 'HIGH' THEN 1 END) as high,
        COUNT(CASE WHEN "dueDate" < NOW() AND status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 END) as overdue
      FROM "CorrectiveAction"
      WHERE "assessmentId" = $1 AND "tenantId" = $2
    `, [assessmentId, req.tenant.id]);
        res.json(stats.rows[0]);
    }
    catch (error) {
        console.error("Error fetching corrective action stats:", error);
        res.status(500).json({ error: "Failed to fetch corrective action statistics" });
    }
});
export default router;
