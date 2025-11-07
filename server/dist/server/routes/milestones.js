import { Router } from "express";
import { z } from "zod";
import { executeQuery } from "../db";
import { AuthService } from "../services/authService";
const router = Router();
// Validation schemas
const createMilestoneSchema = z.object({
    assessmentId: z.string().uuid(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    targetDate: z.string().datetime(),
    category: z.enum(["PREPARATION", "ASSESSMENT", "REVIEW", "COMPLETION", "CERTIFICATION"]),
    dependencies: z.array(z.string().uuid()).optional(),
    criticalPath: z.boolean().default(false),
    estimatedHours: z.number().min(0).optional(),
});
const updateMilestoneSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    targetDate: z.string().datetime().optional(),
    category: z.enum(["PREPARATION", "ASSESSMENT", "REVIEW", "COMPLETION", "CERTIFICATION"]).optional(),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "BLOCKED"]).optional(),
    progress: z.number().min(0).max(100).optional(),
    completedDate: z.string().datetime().optional(),
    dependencies: z.array(z.string().uuid()).optional(),
    criticalPath: z.boolean().optional(),
    estimatedHours: z.number().min(0).optional(),
    actualHours: z.number().min(0).optional(),
    notes: z.string().optional(),
});
// All routes require authentication
router.use(AuthService.authMiddleware);
// CREATE milestone
router.post("/", async (req, res) => {
    try {
        const data = createMilestoneSchema.parse(req.body);
        // Verify assessment exists and user has access
        const assessment = await executeQuery(`
      SELECT a.id, a."tenantId" FROM "Assessment" a 
      WHERE a.id = $1 AND a."tenantId" = $2
    `, [data.assessmentId, req.tenant.id]);
        if (assessment.rowCount === 0) {
            return res.status(404).json({ error: "Assessment not found" });
        }
        const milestoneId = crypto.randomUUID();
        await executeQuery(`
      INSERT INTO "Milestone" (
        id, "assessmentId", name, description, "targetDate", category,
        status, progress, dependencies, "criticalPath", "estimatedHours",
        "createdBy", "tenantId", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 0, $7, $8, $9, $10, $11, NOW(), NOW())
    `, [
            milestoneId,
            data.assessmentId,
            data.name,
            data.description,
            new Date(data.targetDate),
            data.category,
            JSON.stringify(data.dependencies || []),
            data.criticalPath,
            data.estimatedHours,
            req.user.id,
            req.tenant.id
        ]);
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'MILESTONE_CREATED', 'milestone', milestoneId, undefined, { name: data.name, category: data.category, assessmentId: data.assessmentId });
        const createdMilestone = await executeQuery(`
      SELECT * FROM "Milestone" WHERE id = $1
    `, [milestoneId]);
        res.status(201).json(createdMilestone.rows[0]);
    }
    catch (error) {
        console.error("Error creating milestone:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create milestone" });
    }
});
// GET milestones for assessment
router.get("/assessment/:assessmentId", async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { category, status, critical_path } = req.query;
        let whereClause = `m."assessmentId" = $1 AND m."tenantId" = $2`;
        const params = [assessmentId, req.tenant.id];
        let paramIndex = 3;
        if (category) {
            whereClause += ` AND m.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        if (status) {
            whereClause += ` AND m.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        if (critical_path === 'true') {
            whereClause += ` AND m."criticalPath" = true`;
        }
        const milestones = await executeQuery(`
      SELECT 
        m.*,
        u."firstName" as "createdByFirstName",
        u."lastName" as "createdByLastName"
      FROM "Milestone" m
      LEFT JOIN "User" u ON m."createdBy" = u.id
      WHERE ${whereClause}
      ORDER BY m."targetDate" ASC, m."criticalPath" DESC
    `, params);
        res.json(milestones.rows);
    }
    catch (error) {
        console.error("Error fetching milestones:", error);
        res.status(500).json({ error: "Failed to fetch milestones" });
    }
});
// UPDATE milestone
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateMilestoneSchema.parse(req.body);
        // Verify milestone exists and user has access
        const existing = await executeQuery(`
      SELECT * FROM "Milestone" 
      WHERE id = $1 AND "tenantId" = $2
    `, [id, req.tenant.id]);
        if (existing.rowCount === 0) {
            return res.status(404).json({ error: "Milestone not found" });
        }
        const updateFields = [];
        const updateParams = [];
        let paramIndex = 1;
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                if (key === 'targetDate' || key === 'completedDate') {
                    updateFields.push(`"${key}" = $${paramIndex}`);
                    updateParams.push(value ? new Date(value) : null);
                }
                else if (key === 'dependencies') {
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
      UPDATE "Milestone" 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `, updateParams);
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'MILESTONE_UPDATED', 'milestone', id, existing.rows[0], data);
        const updated = await executeQuery(`
      SELECT * FROM "Milestone" WHERE id = $1
    `, [id]);
        res.json(updated.rows[0]);
    }
    catch (error) {
        console.error("Error updating milestone:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to update milestone" });
    }
});
// GET milestone progress dashboard
router.get("/dashboard/:assessmentId", async (req, res) => {
    try {
        const { assessmentId } = req.params;
        // Get milestone statistics
        const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue,
        COUNT(CASE WHEN "criticalPath" = true THEN 1 END) as critical_path,
        AVG(progress) as average_progress,
        SUM("estimatedHours") as total_estimated_hours,
        SUM("actualHours") as total_actual_hours
      FROM "Milestone"
      WHERE "assessmentId" = $1 AND "tenantId" = $2
    `, [assessmentId, req.tenant.id]);
        // Get upcoming milestones
        const upcoming = await executeQuery(`
      SELECT * FROM "Milestone"
      WHERE "assessmentId" = $1 AND "tenantId" = $2 
        AND status NOT IN ('COMPLETED') 
        AND "targetDate" >= NOW()
      ORDER BY "targetDate" ASC
      LIMIT 5
    `, [assessmentId, req.tenant.id]);
        // Get critical path milestones
        const criticalPath = await executeQuery(`
      SELECT * FROM "Milestone"
      WHERE "assessmentId" = $1 AND "tenantId" = $2 
        AND "criticalPath" = true
      ORDER BY "targetDate" ASC
    `, [assessmentId, req.tenant.id]);
        res.json({
            statistics: stats.rows[0],
            upcoming: upcoming.rows,
            criticalPath: criticalPath.rows
        });
    }
    catch (error) {
        console.error("Error fetching milestone dashboard:", error);
        res.status(500).json({ error: "Failed to fetch milestone dashboard" });
    }
});
export default router;
