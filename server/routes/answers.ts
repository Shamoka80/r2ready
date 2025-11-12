
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { 
  answers, 
  assessments, 
  questions, 
  evidenceFiles,
  assessmentSessions,
  clauses
} from "../../shared/schema";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import { AuthService } from "../services/authService";
import type { AuthenticatedRequest } from "../services/authService";

const router = Router();

// All routes require authentication
router.use(AuthService.authMiddleware);

// Validation schemas
const saveAnswerSchema = z.object({
  questionId: z.string().uuid(),
  value: z.any(),
  notes: z.string().optional(),
  compliance: z.enum(["NOT_ASSESSED", "COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE"]).optional(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  evidenceFiles: z.array(z.string()).optional(),
});

const batchSaveSchema = z.object({
  answers: z.array(saveAnswerSchema),
});

// POST /api/assessments/:assessmentId/answers - Save single answer
router.post("/:assessmentId/answers", async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentId } = req.params;
    const data = saveAnswerSchema.parse(req.body);

    // Verify assessment ownership
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, assessmentId),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Verify question exists and belongs to the assessment's standard
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, data.questionId),
      with: {
        clause: true,
      }
    });

    if (!question || !question.clause || (question.clause as any).stdId !== assessment.stdId) {
      return res.status(404).json({ error: "Question not found or doesn't belong to assessment standard" });
    }

    // Check if answer already exists
    const existingAnswer = await db.query.answers.findFirst({
      where: and(
        eq(answers.assessmentId, assessmentId),
        eq(answers.questionId, data.questionId)
      ),
    });

    // Calculate score based on response
    const score = calculateQuestionScore(data.value, question, data.compliance);
    
    let answer;
    if (existingAnswer) {
      // Update existing answer
      [answer] = await db.update(answers)
        .set({
          value: data.value,
          notes: data.notes,
          compliance: data.compliance || "NOT_ASSESSED",
          confidence: data.confidence,
          evidenceFiles: data.evidenceFiles || [],
          score,
          updatedAt: new Date(),
        })
        .where(eq(answers.id, existingAnswer.id))
        .returning();
    } else {
      // Create new answer
      [answer] = await db.insert(answers).values({
        assessmentId,
        questionId: data.questionId,
        answeredBy: req.user!.id,
        value: data.value,
        notes: data.notes,
        compliance: data.compliance || "NOT_ASSESSED",
        confidence: data.confidence,
        evidenceFiles: data.evidenceFiles || [],
        score,
        maxScore: 100 * question.weight,
      }).returning();
    }

    // Update assessment progress
    await updateAssessmentProgress(assessmentId);

    // Track session activity
    await trackAssessmentActivity(assessmentId, req.user!.id, req.tenant!.id, 'QUESTION_ANSWERED');

    res.json(answer);
  } catch (error) {
    console.error("Error saving answer:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: "Failed to save answer" });
  }
});

// POST /api/assessments/:assessmentId/answers/batch - Save multiple answers
router.post("/:assessmentId/answers/batch", async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentId } = req.params;
    const { answers: answerData } = batchSaveSchema.parse(req.body);

    // Verify assessment ownership
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, assessmentId),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const savedAnswers = [];
    const questionIds = answerData.map(a => a.questionId);
    
    // Get all questions for validation and scoring
    const assessmentQuestions = await db.query.questions.findMany({
      where: inArray(questions.id, questionIds),
      with: {
        clause: true,
      }
    });

    // Process each answer
    for (const answerItem of answerData) {
      const question = assessmentQuestions.find(q => q.id === answerItem.questionId);
      
      if (!question || !question.clause || (question.clause as any).stdId !== assessment.stdId) {
        continue; // Skip invalid questions
      }

      const score = calculateQuestionScore(answerItem.value, question, answerItem.compliance);

      // Check for existing answer
      const existingAnswer = await db.query.answers.findFirst({
        where: and(
          eq(answers.assessmentId, assessmentId),
          eq(answers.questionId, answerItem.questionId)
        ),
      });

      if (existingAnswer) {
        // Update existing
        const [updated] = await db.update(answers)
          .set({
            value: answerItem.value,
            notes: answerItem.notes,
            compliance: answerItem.compliance || "NOT_ASSESSED",
            confidence: answerItem.confidence,
            evidenceFiles: answerItem.evidenceFiles || [],
            score,
            updatedAt: new Date(),
          })
          .where(eq(answers.id, existingAnswer.id))
          .returning();
        
        savedAnswers.push(updated);
      } else {
        // Create new
        const [created] = await db.insert(answers).values({
          assessmentId,
          questionId: answerItem.questionId,
          answeredBy: req.user!.id,
          value: answerItem.value,
          notes: answerItem.notes,
          compliance: answerItem.compliance || "NOT_ASSESSED",
          confidence: answerItem.confidence,
          evidenceFiles: answerItem.evidenceFiles || [],
          score,
          maxScore: 100 * question.weight,
        }).returning();
        
        savedAnswers.push(created);
      }
    }

    // Update assessment progress
    await updateAssessmentProgress(assessmentId);

    // Track session activity
    await trackAssessmentActivity(assessmentId, req.user!.id, req.tenant!.id, 'BATCH_ANSWERED');

    res.json({
      savedAnswers,
      count: savedAnswers.length,
      message: `Successfully saved ${savedAnswers.length} answers`
    });
  } catch (error) {
    console.error("Error batch saving answers:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: "Failed to batch save answers" });
  }
});

// GET /api/assessments/:assessmentId/answers - Get all answers for assessment
router.get("/:assessmentId/answers", async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentId } = req.params;

    // Verify assessment ownership
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, assessmentId),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const assessmentAnswers = await db.query.answers.findMany({
      where: eq(answers.assessmentId, assessmentId),
      with: {
        question: {
          columns: {
            questionId: true,
            text: true,
            required: true,
            evidenceRequired: true,
            category: true,
            categoryCode: true,
          }
        },
        answeredByUser: {
          columns: {
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      },
      orderBy: [answers.updatedAt],
    });

    res.json(assessmentAnswers);
  } catch (error) {
    console.error("Error fetching answers:", error);
    res.status(500).json({ error: "Failed to fetch answers" });
  }
});

// GET /api/assessments/:assessmentId/answers/:questionId - Get specific answer
router.get("/:assessmentId/answers/:questionId", async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentId, questionId } = req.params;

    // Verify assessment ownership
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, assessmentId),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const answer = await db.query.answers.findFirst({
      where: and(
        eq(answers.assessmentId, assessmentId),
        eq(answers.questionId, questionId)
      ),
      with: {
        question: true,
        answeredByUser: {
          columns: {
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        reviewedByUser: {
          columns: {
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      },
    });

    if (!answer) {
      return res.status(404).json({ error: "Answer not found" });
    }

    res.json(answer);
  } catch (error) {
    console.error("Error fetching answer:", error);
    res.status(500).json({ error: "Failed to fetch answer" });
  }
});

// DELETE /api/assessments/:assessmentId/answers/:questionId - Delete answer
router.delete("/:assessmentId/answers/:questionId", async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentId, questionId } = req.params;

    // Verify assessment ownership
    const assessment = await db.query.assessments.findFirst({
      where: and(
        eq(assessments.id, assessmentId),
        eq(assessments.tenantId, req.tenant!.id)
      ),
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const existingAnswer = await db.query.answers.findFirst({
      where: and(
        eq(answers.assessmentId, assessmentId),
        eq(answers.questionId, questionId)
      ),
    });

    if (!existingAnswer) {
      return res.status(404).json({ error: "Answer not found" });
    }

    await db.delete(answers)
      .where(eq(answers.id, existingAnswer.id));

    // Update assessment progress
    await updateAssessmentProgress(assessmentId);

    res.json({ message: "Answer deleted successfully" });
  } catch (error) {
    console.error("Error deleting answer:", error);
    res.status(500).json({ error: "Failed to delete answer" });
  }
});

// Helper functions

function calculateQuestionScore(value: any, question: any, compliance?: string): number {
  // Basic scoring algorithm - can be enhanced based on business rules
  let baseScore = 0;
  
  // Normalize value: handle JSON-encoded strings and convert to lowercase for comparison
  let normalizedValue = value;
  if (typeof value === 'string') {
    normalizedValue = value.toLowerCase().trim();
  }
  
  if (compliance) {
    switch (compliance) {
      case "COMPLIANT":
        baseScore = 100;
        break;
      case "PARTIALLY_COMPLIANT":
        baseScore = 50;
        break;
      case "NON_COMPLIANT":
        baseScore = 0;
        break;
      case "NOT_APPLICABLE":
        baseScore = 100; // N/A treated as compliant for scoring
        break;
      default:
        baseScore = 0;
    }
  } else if (question.responseType === "yes_no") {
    // Case-insensitive matching for answer values
    if (normalizedValue === "yes" || value === true) baseScore = 100;
    else if (normalizedValue === "no" || value === false) baseScore = 0;
    else if (normalizedValue === "partial") baseScore = 50;
    else if (normalizedValue === "n/a") baseScore = 100;
    else if (normalizedValue === "in progress") baseScore = 25;
  } else if (question.responseType === "scale") {
    // Assume scale of 1-5, normalize to 0-100
    const numValue = typeof value === 'number' ? value : parseInt(value) || 0;
    baseScore = Math.min(100, Math.max(0, (numValue / 5) * 100));
  } else {
    // For text responses, default to moderate score if provided
    baseScore = value && value.toString().trim() ? 60 : 0;
  }
  
  // Apply question weight
  return Math.round(baseScore * (question.weight || 1));
}

async function updateAssessmentProgress(assessmentId: string): Promise<void> {
  try {
    // Get total questions for assessment
    const assessment = await db.query.assessments.findFirst({
      where: eq(assessments.id, assessmentId),
    });

    if (!assessment) return;

    // Calculate progress
    const [totalQuestions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(eq(clauses.stdId, assessment.stdId));

    const [answeredQuestions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(answers)
      .where(eq(answers.assessmentId, assessmentId));

    const [scoreData] = await db
      .select({ 
        avgScore: sql<number>`avg(${answers.score})`,
        totalScore: sql<number>`sum(${answers.score})`,
        maxScore: sql<number>`sum(${answers.maxScore})`
      })
      .from(answers)
      .where(eq(answers.assessmentId, assessmentId));

    const progress = totalQuestions.count > 0 ? 
      Math.round((answeredQuestions.count / totalQuestions.count) * 100) : 0;
    
    const overallScore = scoreData.avgScore || 0;
    const compliancePercentage = scoreData.maxScore > 0 ? 
      Math.round((scoreData.totalScore / scoreData.maxScore) * 100) : 0;

    // Update assessment
    await db.update(assessments)
      .set({
        progress,
        overallScore,
        compliancePercentage,
        updatedAt: new Date(),
      })
      .where(eq(assessments.id, assessmentId));
  } catch (error) {
    console.error("Error updating assessment progress:", error);
  }
}

async function trackAssessmentActivity(
  assessmentId: string, 
  userId: string, 
  tenantId: string, 
  activityType: string
): Promise<void> {
  try {
    // Find or create current session
    const activeSession = await db.query.assessmentSessions.findFirst({
      where: and(
        eq(assessmentSessions.assessmentId, assessmentId),
        eq(assessmentSessions.userId, userId),
        isNull(assessmentSessions.sessionEnd)
      ),
    });

    if (activeSession) {
      // Update existing session
      const questionsAnswered = activityType === 'QUESTION_ANSWERED' ? 
        (activeSession.questionsAnswered || 0) + 1 : activeSession.questionsAnswered || 0;
      
      await db.update(assessmentSessions)
        .set({ 
          questionsAnswered,
          durationMinutes: Math.floor((Date.now() - activeSession.sessionStart.getTime()) / 60000),
        })
        .where(eq(assessmentSessions.id, activeSession.id));
    } else {
      // Create new session
      await db.insert(assessmentSessions).values({
        assessmentId,
        userId,
        tenantId,
        questionsAnswered: activityType === 'QUESTION_ANSWERED' ? 1 : 0,
      });
    }
  } catch (error) {
    console.error("Error tracking assessment activity:", error);
  }
}

export default router;
