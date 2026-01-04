import { db } from '../db';
import { maturityScores, answers, assessments } from '../../shared/schema';
import { eq } from 'drizzle-orm';
export class MaturityEngine {
    static MATURITY_THRESHOLDS = {
        'BASIC': 0,
        'DEVELOPING': 40,
        'ESTABLISHED': 60,
        'ADVANCED': 80,
        'OPTIMIZED': 95
    };
    static DIMENSION_WEIGHTS = {
        'BCP': 0.35,
        'CI': 0.35,
        'STAKEHOLDER': 0.30
    };
    /**
     * Calculate comprehensive maturity score for an assessment
     */
    static async calculateMaturityScore(assessmentId) {
        const maturityQuestions = await this.getMaturityQuestions(assessmentId);
        if (maturityQuestions.length === 0) {
            return this.createEmptyMaturityScore();
        }
        const bcpScore = await this.calculateDimensionScore(assessmentId, 'BCP', maturityQuestions);
        const ciScore = await this.calculateDimensionScore(assessmentId, 'CI', maturityQuestions);
        const stakeholderScore = await this.calculateDimensionScore(assessmentId, 'STAKEHOLDER', maturityQuestions);
        const overallMaturity = (bcpScore.score * this.DIMENSION_WEIGHTS.BCP +
            ciScore.score * this.DIMENSION_WEIGHTS.CI +
            stakeholderScore.score * this.DIMENSION_WEIGHTS.STAKEHOLDER);
        const maturityLevel = this.determineMaturityLevel(overallMaturity);
        return {
            overallMaturity,
            businessContinuityScore: bcpScore.score,
            continuousImprovementScore: ciScore.score,
            stakeholderEngagementScore: stakeholderScore.score,
            maturityLevel,
            dimensionDetails: [bcpScore, ciScore, stakeholderScore]
        };
    }
    /**
     * OPTIMIZATION: Batch fetch all answers+questions with single JOIN query
     * Previously: Would potentially query questions separately
     * Now: Single query with JOIN loads everything, then filter in memory
     * Eliminates potential N+1 when processing maturity questions
     */
    static async getMaturityQuestions(assessmentId) {
        // OPTIMIZATION: Single query fetches answers with questions joined
        const assessmentAnswers = await db.query.answers.findMany({
            where: eq(answers.assessmentId, assessmentId),
            with: {
                question: true
            }
        });
        // Filter maturity questions in memory - no additional queries
        const maturityAnswers = assessmentAnswers.filter(answer => {
            const questionObj = Array.isArray(answer.question) ? answer.question[0] : answer.question;
            return questionObj?.isMaturityQuestion === true;
        });
        // Process all maturity questions in memory - question data already loaded
        return maturityAnswers.map(answer => {
            const questionObj = Array.isArray(answer.question) ? answer.question[0] : answer.question;
            const score = this.calculateAnswerScore(answer.value);
            const weight = questionObj?.weightOverride ?? 1.0;
            return {
                questionId: answer.questionId,
                questionText: questionObj?.text || 'Unknown',
                category: questionObj?.category || 'UNKNOWN',
                maturityCategory: questionObj?.maturityCategory || 'CI',
                score,
                weight,
                contributionToOverall: score * weight
            };
        });
    }
    /**
     * Calculate score for a specific maturity dimension
     */
    static async calculateDimensionScore(assessmentId, dimension, allMaturityQuestions) {
        const dimensionQuestions = allMaturityQuestions.filter(q => q.maturityCategory === dimension);
        if (dimensionQuestions.length === 0) {
            return {
                name: this.getDimensionName(dimension),
                category: dimension,
                score: 0,
                level: 'BASIC',
                strengths: [],
                improvementAreas: ['No questions answered in this dimension'],
                questionCount: 0
            };
        }
        const totalWeight = dimensionQuestions.reduce((sum, q) => sum + q.weight, 0);
        const weightedScore = dimensionQuestions.reduce((sum, q) => sum + (q.score * q.weight), 0);
        const dimensionScore = totalWeight > 0 ? (weightedScore / totalWeight) : 0;
        const strengths = dimensionQuestions
            .filter(q => q.score >= 80)
            .map(q => q.questionText)
            .slice(0, 5);
        const improvementAreas = dimensionQuestions
            .filter(q => q.score < 60)
            .map(q => q.questionText)
            .slice(0, 5);
        return {
            name: this.getDimensionName(dimension),
            category: dimension,
            score: dimensionScore,
            level: this.determineMaturityLevel(dimensionScore),
            strengths,
            improvementAreas,
            questionCount: dimensionQuestions.length
        };
    }
    /**
     * Determine maturity level based on score
     */
    static determineMaturityLevel(score) {
        if (score >= this.MATURITY_THRESHOLDS.OPTIMIZED)
            return 'OPTIMIZED';
        if (score >= this.MATURITY_THRESHOLDS.ADVANCED)
            return 'ADVANCED';
        if (score >= this.MATURITY_THRESHOLDS.ESTABLISHED)
            return 'ESTABLISHED';
        if (score >= this.MATURITY_THRESHOLDS.DEVELOPING)
            return 'DEVELOPING';
        return 'BASIC';
    }
    /**
     * Get human-readable dimension name
     */
    static getDimensionName(dimension) {
        const names = {
            'BCP': 'Business Continuity Planning',
            'CI': 'Continuous Improvement',
            'STAKEHOLDER': 'Stakeholder Engagement'
        };
        return names[dimension];
    }
    /**
     * Calculate score for an answer response
     */
    static calculateAnswerScore(response) {
        if (response === null || response === undefined) {
            return 0;
        }
        if (typeof response === 'number') {
            return Math.min(100, Math.max(0, response));
        }
        if (typeof response === 'string') {
            const normalized = response.toLowerCase().trim();
            const scoreMap = {
                'yes': 100,
                'no': 0,
                'fully implemented': 100,
                'largely implemented': 85,
                'partially implemented': 50,
                'minimally implemented': 25,
                'not implemented': 0,
                'advanced': 100,
                'established': 75,
                'developing': 50,
                'basic': 25,
                'none': 0,
                'n/a': 0
            };
            return scoreMap[normalized] ?? 0;
        }
        if (typeof response === 'boolean') {
            return response ? 100 : 0;
        }
        return 0;
    }
    /**
     * Create empty maturity score object
     */
    static createEmptyMaturityScore() {
        return {
            overallMaturity: 0,
            businessContinuityScore: 0,
            continuousImprovementScore: 0,
            stakeholderEngagementScore: 0,
            maturityLevel: 'BASIC',
            dimensionDetails: []
        };
    }
    /**
     * Save maturity score to database
     */
    static async saveMaturityScore(assessmentId, maturityScore) {
        const result = await db.insert(maturityScores)
            .values({
            assessmentId,
            overallMaturity: maturityScore.overallMaturity,
            businessContinuityScore: maturityScore.businessContinuityScore,
            continuousImprovementScore: maturityScore.continuousImprovementScore,
            stakeholderEngagementScore: maturityScore.stakeholderEngagementScore,
            maturityLevel: maturityScore.maturityLevel,
            dimensionDetails: maturityScore.dimensionDetails
        })
            .returning();
        const insertedRecord = Array.isArray(result) ? result[0] : result;
        await db.update(assessments)
            .set({
            maturityScoreId: insertedRecord.id
        })
            .where(eq(assessments.id, assessmentId));
        return insertedRecord.id;
    }
    /**
     * Get latest maturity score for an assessment
     */
    static async getMaturityScore(assessmentId) {
        const score = await db.query.maturityScores.findFirst({
            where: eq(maturityScores.assessmentId, assessmentId),
            orderBy: (maturityScores, { desc }) => [desc(maturityScores.calculatedAt)]
        });
        if (!score) {
            return null;
        }
        return {
            overallMaturity: score.overallMaturity,
            businessContinuityScore: score.businessContinuityScore,
            continuousImprovementScore: score.continuousImprovementScore,
            stakeholderEngagementScore: score.stakeholderEngagementScore,
            maturityLevel: score.maturityLevel,
            dimensionDetails: score.dimensionDetails
        };
    }
    /**
     * Get maturity trend over time
     */
    static async getMaturityTrend(assessmentId) {
        const scores = await db.query.maturityScores.findMany({
            where: eq(maturityScores.assessmentId, assessmentId),
            orderBy: (maturityScores, { asc }) => [asc(maturityScores.calculatedAt)]
        });
        return {
            dates: scores.map(s => s.calculatedAt.toISOString()),
            overallScores: scores.map(s => s.overallMaturity),
            bcpScores: scores.map(s => s.businessContinuityScore),
            ciScores: scores.map(s => s.continuousImprovementScore),
            stakeholderScores: scores.map(s => s.stakeholderEngagementScore)
        };
    }
}
