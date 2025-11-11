import { db } from '../db';
import { 
  scoringConfigs, 
  questions, 
  answers, 
  assessments 
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface ScoringConfig {
  id: string;
  configName: string;
  configVersion: string;
  weights: CategoryWeights;
  appendixWeights: CategoryWeights | null;
  readinessThresholds: {
    passing: number;
    ready: number;
  };
  naHandling: 'EXCLUDE' | 'COUNT_AS_100' | 'COUNT_AS_0';
  requiredQuestionMultiplier: number;
  isActive: boolean;
}

export interface CategoryWeights {
  [category: string]: number;
}

export interface ScoringResult {
  overallScore: number;
  weightedScore: number;
  categoryScores: CategoryScore[];
  isPassing: boolean;
  isReady: boolean;
  totalQuestions: number;
  answeredQuestions: number;
  naQuestions: number;
  effectiveQuestions: number;
  scoringConfigUsed: string;
}

export interface CategoryScore {
  category: string;
  score: number;
  weight: number;
  weightedContribution: number;
  questionCount: number;
  maxPossibleScore: number;
}

export class ConfigurableScoring {
  
  /**
   * Calculate assessment score using configuration from database
   */
  static async calculateScore(
    assessmentId: string, 
    configId?: string
  ): Promise<ScoringResult> {
    const config = configId 
      ? await this.getScoringConfig(configId)
      : await this.getDefaultScoringConfig();

    if (!config) {
      throw new Error('No scoring configuration found');
    }

    const assessmentAnswers = await this.getAssessmentAnswers(assessmentId);
    
    if (assessmentAnswers.length === 0) {
      return this.createEmptyResult(config.configName);
    }

    const categoryScores = await this.calculateCategoryScores(
      assessmentAnswers,
      config
    );

    const weightedScore = this.calculateWeightedScore(categoryScores, config);

    const naCount = assessmentAnswers.filter(a => 
      this.isNAResponse(a.value)
    ).length;

    const effectiveQuestions = config.naHandling === 'EXCLUDE' 
      ? assessmentAnswers.length - naCount 
      : assessmentAnswers.length;

    return {
      overallScore: weightedScore,
      weightedScore,
      categoryScores,
      isPassing: weightedScore >= config.readinessThresholds.passing,
      isReady: weightedScore >= config.readinessThresholds.ready,
      totalQuestions: assessmentAnswers.length,
      answeredQuestions: assessmentAnswers.length,
      naQuestions: naCount,
      effectiveQuestions,
      scoringConfigUsed: config.configName
    };
  }

  /**
   * Get scoring configuration by ID
   */
  static async getScoringConfig(configId: string): Promise<ScoringConfig | null> {
    const config = await db.query.scoringConfigs.findFirst({
      where: eq(scoringConfigs.id, configId)
    });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      configName: config.configName,
      configVersion: config.configVersion,
      weights: config.weights as CategoryWeights,
      appendixWeights: config.appendixWeights as CategoryWeights | null,
      readinessThresholds: config.readinessThresholds as { passing: number; ready: number },
      naHandling: config.naHandling as 'EXCLUDE' | 'COUNT_AS_100' | 'COUNT_AS_0',
      requiredQuestionMultiplier: config.requiredQuestionMultiplier,
      isActive: config.isActive
    };
  }

  /**
   * Get default (active) scoring configuration
   */
  static async getDefaultScoringConfig(): Promise<ScoringConfig | null> {
    const config = await db.query.scoringConfigs.findFirst({
      where: eq(scoringConfigs.isActive, true),
      orderBy: (scoringConfigs, { desc }) => [desc(scoringConfigs.createdAt)]
    });

    if (!config) {
      return this.createDefaultConfig();
    }

    return {
      id: config.id,
      configName: config.configName,
      configVersion: config.configVersion,
      weights: config.weights as CategoryWeights,
      appendixWeights: config.appendixWeights as CategoryWeights | null,
      readinessThresholds: config.readinessThresholds as { passing: number; ready: number },
      naHandling: config.naHandling as 'EXCLUDE' | 'COUNT_AS_100' | 'COUNT_AS_0',
      requiredQuestionMultiplier: config.requiredQuestionMultiplier,
      isActive: config.isActive
    };
  }

  /**
   * Create default scoring configuration (fallback)
   */
  private static createDefaultConfig(): ScoringConfig {
    return {
      id: 'default',
      configName: 'R2v3 Standard',
      configVersion: '1.0',
      weights: {
        'LEGAL': 15,
        'FACILITY': 20,
        'EHS': 25,
        'PROC': 20,
        'DATA': 10,
        'SUPPLY': 10
      },
      appendixWeights: {
        'APP-A': 5,
        'APP-B': 8,
        'APP-C': 10,
        'APP-D': 15,
        'APP-E': 7,
        'APP-F': 5,
        'APP-G': 5
      },
      readinessThresholds: {
        passing: 80,
        ready: 90
      },
      naHandling: 'COUNT_AS_100',
      requiredQuestionMultiplier: 1.5,
      isActive: true
    };
  }

  /**
   * Get all answers for an assessment with question details
   */
  private static async getAssessmentAnswers(assessmentId: string) {
    return await db.query.answers.findMany({
      where: eq(answers.assessmentId, assessmentId),
      with: {
        question: true
      }
    });
  }

  /**
   * Calculate scores for each category
   */
  private static async calculateCategoryScores(
    assessmentAnswers: any[],
    config: ScoringConfig
  ): Promise<CategoryScore[]> {
    const categoriesMap = new Map<string, {
      totalScore: number;
      maxScore: number;
      count: number;
    }>();

    for (const answer of assessmentAnswers) {
      const questionObj = Array.isArray(answer.question) ? answer.question[0] : answer.question;
      const category = questionObj?.category || 'UNKNOWN';
      const score = this.calculateAnswerScore(answer.value, config.naHandling);
      const weight = questionObj?.weightOverride ?? 1.0;

      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, { totalScore: 0, maxScore: 0, count: 0 });
      }

      const categoryData = categoriesMap.get(category)!;
      categoryData.totalScore += score * weight;
      categoryData.maxScore += 100 * weight;
      categoryData.count += 1;
    }

    const categoryScores: CategoryScore[] = [];

    for (const [category, data] of categoriesMap.entries()) {
      const categoryScore = data.maxScore > 0 
        ? (data.totalScore / data.maxScore) * 100 
        : 0;

      const categoryWeight = this.getCategoryWeight(category, config);
      
      categoryScores.push({
        category,
        score: categoryScore,
        weight: categoryWeight,
        weightedContribution: categoryScore * categoryWeight,
        questionCount: data.count,
        maxPossibleScore: 100
      });
    }

    return categoryScores;
  }

  /**
   * Get weight for a category from configuration
   */
  private static getCategoryWeight(category: string, config: ScoringConfig): number {
    const coreWeight = config.weights[category];
    if (coreWeight !== undefined) {
      return coreWeight / 100;
    }

    if (config.appendixWeights) {
      const appendixWeight = config.appendixWeights[category];
      if (appendixWeight !== undefined) {
        return appendixWeight / 100;
      }
    }

    return 0;
  }

  /**
   * Calculate weighted overall score
   */
  private static calculateWeightedScore(
    categoryScores: CategoryScore[], 
    config: ScoringConfig
  ): number {
    const totalWeight = categoryScores.reduce((sum, cat) => sum + cat.weight, 0);
    const weightedSum = categoryScores.reduce(
      (sum, cat) => sum + cat.weightedContribution, 
      0
    );

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate score for an individual answer
   */
  private static calculateAnswerScore(response: any, naHandling: string): number {
    if (this.isNAResponse(response)) {
      if (naHandling === 'EXCLUDE') {
        return 0;
      } else if (naHandling === 'COUNT_AS_100') {
        return 100;
      } else {
        return 0;
      }
    }

    if (response === null || response === undefined) {
      return 0;
    }

    if (typeof response === 'number') {
      return Math.min(100, Math.max(0, response));
    }

    if (typeof response === 'string') {
      const normalized = response.toLowerCase().trim();
      
      const scoreMap: { [key: string]: number } = {
        'yes': 100,
        'no': 0,
        'fully implemented': 100,
        'partially implemented': 50,
        'not implemented': 0,
        'compliant': 100,
        'partially compliant': 50,
        'non-compliant': 0
      };

      return scoreMap[normalized] ?? 0;
    }

    if (typeof response === 'boolean') {
      return response ? 100 : 0;
    }

    return 0;
  }

  /**
   * Check if response is N/A
   */
  private static isNAResponse(response: any): boolean {
    if (response === null || response === undefined) {
      return false;
    }

    if (typeof response === 'string') {
      const normalized = response.toLowerCase().trim();
      return normalized === 'n/a' || normalized === 'na' || normalized === 'not applicable';
    }

    return false;
  }

  /**
   * Create empty result object
   */
  private static createEmptyResult(configName: string): ScoringResult {
    return {
      overallScore: 0,
      weightedScore: 0,
      categoryScores: [],
      isPassing: false,
      isReady: false,
      totalQuestions: 0,
      answeredQuestions: 0,
      naQuestions: 0,
      effectiveQuestions: 0,
      scoringConfigUsed: configName
    };
  }

  /**
   * Create a new scoring configuration
   */
  static async createScoringConfig(config: Omit<ScoringConfig, 'id'>): Promise<string> {
    const result = await db.insert(scoringConfigs)
      .values({
        configName: config.configName,
        configVersion: config.configVersion,
        weights: config.weights as any,
        appendixWeights: config.appendixWeights as any,
        readinessThresholds: config.readinessThresholds as any,
        naHandling: config.naHandling,
        requiredQuestionMultiplier: config.requiredQuestionMultiplier,
        isActive: config.isActive
      })
      .returning();

    const insertedRecord = Array.isArray(result) ? result[0] : result;
    return insertedRecord.id;
  }

  /**
   * Update assessment with scoring results
   */
  static async updateAssessmentWithScore(
    assessmentId: string,
    result: ScoringResult,
    configId?: string
  ): Promise<void> {
    await db.update(assessments)
      .set({
        scoringConfigId: configId || null,
        readinessClassification: result.isReady ? 'READY' : result.isPassing ? 'NEEDS_WORK' : 'NOT_READY'
      })
      .where(eq(assessments.id, assessmentId));
  }
}
