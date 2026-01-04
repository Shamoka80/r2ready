import { Router } from "express";
import { db } from "../db";
import { scoringConfigs, mustPassRules, mustPassRuleQuestions, conditionalRules, conditionalRuleTargets, questions } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { AuthService } from "../services/authService";
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
/**
 * Phase 4: Configuration Layer Admin API Routes
 *
 * Provides CRUD operations for:
 * - Scoring configurations
 * - Must-pass rules
 * - Conditional branching rules
 */
// =============================
// SCORING CONFIGURATIONS
// =============================
/**
 * GET /api/configuration/scoring-configs
 * List all scoring configurations
 */
router.get("/scoring-configs", async (req, res) => {
    try {
        const configs = await db.select()
            .from(scoringConfigs)
            .orderBy(desc(scoringConfigs.createdAt));
        res.json({ configs });
    }
    catch (error) {
        console.error("Error fetching scoring configs:", error);
        res.status(500).json({ error: "Failed to fetch scoring configurations" });
    }
});
/**
 * GET /api/configuration/scoring-configs/active
 * Get the active scoring configuration
 */
router.get("/scoring-configs/active", async (req, res) => {
    try {
        const [activeConfig] = await db.select()
            .from(scoringConfigs)
            .where(eq(scoringConfigs.isActive, true))
            .orderBy(desc(scoringConfigs.effectiveDate))
            .limit(1);
        if (!activeConfig) {
            return res.status(404).json({ error: "No active scoring configuration found" });
        }
        res.json({ config: activeConfig });
    }
    catch (error) {
        console.error("Error fetching active scoring config:", error);
        res.status(500).json({ error: "Failed to fetch active scoring configuration" });
    }
});
/**
 * GET /api/configuration/scoring-configs/:id
 * Get a specific scoring configuration
 */
router.get("/scoring-configs/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [config] = await db.select()
            .from(scoringConfigs)
            .where(eq(scoringConfigs.id, id));
        if (!config) {
            return res.status(404).json({ error: "Scoring configuration not found" });
        }
        res.json({ config });
    }
    catch (error) {
        console.error("Error fetching scoring config:", error);
        res.status(500).json({ error: "Failed to fetch scoring configuration" });
    }
});
/**
 * POST /api/configuration/scoring-configs
 * Create a new scoring configuration
 */
router.post("/scoring-configs", async (req, res) => {
    try {
        const schema = z.object({
            configName: z.string().min(1),
            configVersion: z.string().min(1),
            description: z.string().optional(),
            weights: z.record(z.number()),
            appendixWeights: z.record(z.number()).nullable().optional(),
            readinessThresholds: z.record(z.number()),
            naHandling: z.enum(["EXCLUDE", "COUNT_AS_100", "COUNT_AS_0"]),
            requiredQuestionMultiplier: z.number().optional(),
            enforceMustPass: z.boolean().optional(),
            separateMaturityScoring: z.boolean().optional(),
            isActive: z.boolean().optional()
        });
        const validated = schema.parse(req.body);
        const [created] = await db.insert(scoringConfigs)
            .values(validated)
            .returning();
        res.status(201).json({ config: created });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error creating scoring config:", error);
        res.status(500).json({ error: "Failed to create scoring configuration" });
    }
});
/**
 * PATCH /api/configuration/scoring-configs/:id
 * Update a scoring configuration
 */
router.patch("/scoring-configs/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            configName: z.string().min(1).optional(),
            description: z.string().optional(),
            weights: z.record(z.number()).optional(),
            appendixWeights: z.record(z.number()).nullable().optional(),
            readinessThresholds: z.record(z.number()).optional(),
            naHandling: z.enum(["EXCLUDE", "COUNT_AS_100", "COUNT_AS_0"]).optional(),
            requiredQuestionMultiplier: z.number().optional(),
            enforceMustPass: z.boolean().optional(),
            separateMaturityScoring: z.boolean().optional(),
            isActive: z.boolean().optional()
        });
        const validated = schema.parse(req.body);
        const [updated] = await db.update(scoringConfigs)
            .set(validated)
            .where(eq(scoringConfigs.id, id))
            .returning();
        if (!updated) {
            return res.status(404).json({ error: "Scoring configuration not found" });
        }
        res.json({ config: updated });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error updating scoring config:", error);
        res.status(500).json({ error: "Failed to update scoring configuration" });
    }
});
/**
 * DELETE /api/configuration/scoring-configs/:id
 * Delete a scoring configuration
 */
router.delete("/scoring-configs/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [deleted] = await db.delete(scoringConfigs)
            .where(eq(scoringConfigs.id, id))
            .returning();
        if (!deleted) {
            return res.status(404).json({ error: "Scoring configuration not found" });
        }
        res.json({ message: "Scoring configuration deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting scoring config:", error);
        res.status(500).json({ error: "Failed to delete scoring configuration" });
    }
});
// =============================
// MUST-PASS RULES
// =============================
/**
 * GET /api/configuration/must-pass-rules
 * List all must-pass rules with question counts
 */
router.get("/must-pass-rules", async (req, res) => {
    try {
        const rules = await db.select()
            .from(mustPassRules)
            .orderBy(mustPassRules.priority);
        // Get question counts for each rule
        const rulesWithCounts = await Promise.all(rules.map(async (rule) => {
            const questionMappings = await db.select()
                .from(mustPassRuleQuestions)
                .where(eq(mustPassRuleQuestions.mustPassRuleId, rule.id));
            return {
                ...rule,
                questionCount: questionMappings.length
            };
        }));
        res.json({ rules: rulesWithCounts });
    }
    catch (error) {
        console.error("Error fetching must-pass rules:", error);
        res.status(500).json({ error: "Failed to fetch must-pass rules" });
    }
});
/**
 * GET /api/configuration/must-pass-rules/:id
 * Get a specific must-pass rule with its questions
 */
router.get("/must-pass-rules/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [rule] = await db.select()
            .from(mustPassRules)
            .where(eq(mustPassRules.id, id));
        if (!rule) {
            return res.status(404).json({ error: "Must-pass rule not found" });
        }
        // Get mapped questions
        const mappings = await db.select({
            questionId: mustPassRuleQuestions.questionId,
            acceptableValues: mustPassRuleQuestions.acceptableValues,
            order: mustPassRuleQuestions.order,
            question: questions
        })
            .from(mustPassRuleQuestions)
            .leftJoin(questions, eq(mustPassRuleQuestions.questionId, questions.id))
            .where(eq(mustPassRuleQuestions.mustPassRuleId, id));
        res.json({
            rule,
            questions: mappings.map(m => ({
                ...m.question,
                acceptableValues: m.acceptableValues,
                order: m.order
            }))
        });
    }
    catch (error) {
        console.error("Error fetching must-pass rule:", error);
        res.status(500).json({ error: "Failed to fetch must-pass rule" });
    }
});
/**
 * POST /api/configuration/must-pass-rules
 * Create a new must-pass rule
 */
router.post("/must-pass-rules", async (req, res) => {
    try {
        const schema = z.object({
            ruleCode: z.string().min(1),
            ruleName: z.string().min(1),
            description: z.string().optional(),
            ruleType: z.string(),
            blockerSeverity: z.string().optional(),
            failureMessage: z.string().optional(),
            isActive: z.boolean().optional(),
            priority: z.number().optional()
        });
        const validated = schema.parse(req.body);
        const [created] = await db.insert(mustPassRules)
            .values(validated)
            .returning();
        res.status(201).json({ rule: created });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error creating must-pass rule:", error);
        res.status(500).json({ error: "Failed to create must-pass rule" });
    }
});
/**
 * PATCH /api/configuration/must-pass-rules/:id
 * Update a must-pass rule
 */
router.patch("/must-pass-rules/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            ruleName: z.string().min(1).optional(),
            description: z.string().optional(),
            ruleType: z.string().optional(),
            blockerSeverity: z.string().optional(),
            failureMessage: z.string().optional(),
            isActive: z.boolean().optional(),
            priority: z.number().optional()
        });
        const validated = schema.parse(req.body);
        const [updated] = await db.update(mustPassRules)
            .set(validated)
            .where(eq(mustPassRules.id, id))
            .returning();
        if (!updated) {
            return res.status(404).json({ error: "Must-pass rule not found" });
        }
        res.json({ rule: updated });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error updating must-pass rule:", error);
        res.status(500).json({ error: "Failed to update must-pass rule" });
    }
});
/**
 * DELETE /api/configuration/must-pass-rules/:id
 * Delete a must-pass rule (cascades to question mappings)
 */
router.delete("/must-pass-rules/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [deleted] = await db.delete(mustPassRules)
            .where(eq(mustPassRules.id, id))
            .returning();
        if (!deleted) {
            return res.status(404).json({ error: "Must-pass rule not found" });
        }
        res.json({ message: "Must-pass rule deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting must-pass rule:", error);
        res.status(500).json({ error: "Failed to delete must-pass rule" });
    }
});
/**
 * POST /api/configuration/must-pass-rules/:id/questions
 * Add a question to a must-pass rule
 */
router.post("/must-pass-rules/:id/questions", async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            questionId: z.string(),
            acceptableValues: z.array(z.string()),
            order: z.number().optional()
        });
        const validated = schema.parse(req.body);
        const [created] = await db.insert(mustPassRuleQuestions)
            .values({
            mustPassRuleId: id,
            ...validated
        })
            .returning();
        res.status(201).json({ mapping: created });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error adding question to must-pass rule:", error);
        res.status(500).json({ error: "Failed to add question to must-pass rule" });
    }
});
/**
 * DELETE /api/configuration/must-pass-rules/:ruleId/questions/:questionId
 * Remove a question from a must-pass rule
 */
router.delete("/must-pass-rules/:ruleId/questions/:questionId", async (req, res) => {
    try {
        const { ruleId, questionId } = req.params;
        const [deleted] = await db.delete(mustPassRuleQuestions)
            .where(and(eq(mustPassRuleQuestions.mustPassRuleId, ruleId), eq(mustPassRuleQuestions.questionId, questionId)))
            .returning();
        if (!deleted) {
            return res.status(404).json({ error: "Question mapping not found" });
        }
        res.json({ message: "Question removed from must-pass rule successfully" });
    }
    catch (error) {
        console.error("Error removing question from must-pass rule:", error);
        res.status(500).json({ error: "Failed to remove question from must-pass rule" });
    }
});
// =============================
// CONDITIONAL RULES
// =============================
/**
 * GET /api/configuration/conditional-rules
 * List all conditional rules with target question counts
 */
router.get("/conditional-rules", async (req, res) => {
    try {
        const rules = await db.select()
            .from(conditionalRules)
            .orderBy(conditionalRules.priority);
        // Get target question counts for each rule
        const rulesWithCounts = await Promise.all(rules.map(async (rule) => {
            const targets = await db.select()
                .from(conditionalRuleTargets)
                .where(eq(conditionalRuleTargets.conditionalRuleId, rule.id));
            return {
                ...rule,
                targetQuestionCount: targets.length
            };
        }));
        res.json({ rules: rulesWithCounts });
    }
    catch (error) {
        console.error("Error fetching conditional rules:", error);
        res.status(500).json({ error: "Failed to fetch conditional rules" });
    }
});
/**
 * GET /api/configuration/conditional-rules/:id
 * Get a specific conditional rule with its target questions
 */
router.get("/conditional-rules/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [rule] = await db.select()
            .from(conditionalRules)
            .where(eq(conditionalRules.id, id));
        if (!rule) {
            return res.status(404).json({ error: "Conditional rule not found" });
        }
        // Get target questions
        const targets = await db.select({
            targetQuestionId: conditionalRuleTargets.targetQuestionId,
            actionOverride: conditionalRuleTargets.actionOverride,
            question: questions
        })
            .from(conditionalRuleTargets)
            .leftJoin(questions, eq(conditionalRuleTargets.targetQuestionId, questions.id))
            .where(eq(conditionalRuleTargets.conditionalRuleId, id));
        res.json({
            rule,
            targetQuestions: targets.map(t => ({
                ...t.question,
                actionOverride: t.actionOverride
            }))
        });
    }
    catch (error) {
        console.error("Error fetching conditional rule:", error);
        res.status(500).json({ error: "Failed to fetch conditional rule" });
    }
});
/**
 * POST /api/configuration/conditional-rules
 * Create a new conditional rule
 */
router.post("/conditional-rules", async (req, res) => {
    try {
        const schema = z.object({
            ruleId: z.string().min(1),
            ruleName: z.string().min(1),
            description: z.string().optional(),
            triggeredBy: z.string(),
            triggerCondition: z.record(z.any()),
            action: z.string(),
            priority: z.number().optional(),
            isActive: z.boolean().optional()
        });
        const validated = schema.parse(req.body);
        const [created] = await db.insert(conditionalRules)
            .values(validated)
            .returning();
        res.status(201).json({ rule: created });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error creating conditional rule:", error);
        res.status(500).json({ error: "Failed to create conditional rule" });
    }
});
/**
 * PATCH /api/configuration/conditional-rules/:id
 * Update a conditional rule
 */
router.patch("/conditional-rules/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            ruleName: z.string().min(1).optional(),
            description: z.string().optional(),
            triggerCondition: z.record(z.any()).optional(),
            action: z.string().optional(),
            priority: z.number().optional(),
            isActive: z.boolean().optional()
        });
        const validated = schema.parse(req.body);
        const [updated] = await db.update(conditionalRules)
            .set(validated)
            .where(eq(conditionalRules.id, id))
            .returning();
        if (!updated) {
            return res.status(404).json({ error: "Conditional rule not found" });
        }
        res.json({ rule: updated });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error updating conditional rule:", error);
        res.status(500).json({ error: "Failed to update conditional rule" });
    }
});
/**
 * DELETE /api/configuration/conditional-rules/:id
 * Delete a conditional rule (cascades to targets)
 */
router.delete("/conditional-rules/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [deleted] = await db.delete(conditionalRules)
            .where(eq(conditionalRules.id, id))
            .returning();
        if (!deleted) {
            return res.status(404).json({ error: "Conditional rule not found" });
        }
        res.json({ message: "Conditional rule deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting conditional rule:", error);
        res.status(500).json({ error: "Failed to delete conditional rule" });
    }
});
/**
 * POST /api/configuration/conditional-rules/:id/targets
 * Add a target question to a conditional rule
 */
router.post("/conditional-rules/:id/targets", async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            targetQuestionId: z.string(),
            actionOverride: z.string().optional()
        });
        const validated = schema.parse(req.body);
        const [created] = await db.insert(conditionalRuleTargets)
            .values({
            conditionalRuleId: id,
            ...validated
        })
            .returning();
        res.status(201).json({ target: created });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error adding target to conditional rule:", error);
        res.status(500).json({ error: "Failed to add target to conditional rule" });
    }
});
/**
 * DELETE /api/configuration/conditional-rules/:ruleId/targets/:questionId
 * Remove a target question from a conditional rule
 */
router.delete("/conditional-rules/:ruleId/targets/:questionId", async (req, res) => {
    try {
        const { ruleId, questionId } = req.params;
        const [deleted] = await db.delete(conditionalRuleTargets)
            .where(and(eq(conditionalRuleTargets.conditionalRuleId, ruleId), eq(conditionalRuleTargets.targetQuestionId, questionId)))
            .returning();
        if (!deleted) {
            return res.status(404).json({ error: "Target mapping not found" });
        }
        res.json({ message: "Target removed from conditional rule successfully" });
    }
    catch (error) {
        console.error("Error removing target from conditional rule:", error);
        res.status(500).json({ error: "Failed to remove target from conditional rule" });
    }
});
export default router;
