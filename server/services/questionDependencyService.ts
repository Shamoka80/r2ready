
import { db } from '../db';
import { questions, answers, assessments } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import ObservabilityService from './observabilityService';

export interface QuestionDependency {
  questionId: string;
  dependsOn: string;
  condition: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number | boolean;
  operator?: 'AND' | 'OR';
}

export interface ConditionalQuestion {
  id: string;
  text: string;
  section: string;
  category: string;
  dependencies: QuestionDependency[];
  isVisible: boolean;
  isRequired: boolean;
  facilityTypeSpecific?: string[];
}

export interface QuestionFilter {
  facilityType?: string;
  businessModel?: string;
  hasDataDestruction?: boolean;
  hasRefurbishment?: boolean;
  squareFootage?: number;
  employeeCount?: string;
  processingVolume?: string;
  securityClearance?: boolean;
}

/**
 * Advanced Question Dependency Service
 * Implements intelligent question filtering and conditional logic for Phase 4
 */
export class QuestionDependencyService {

  private static readonly FACILITY_TYPE_QUESTIONS = {
    'processor': [
      'data_sanitization_methods',
      'material_separation_processes',
      'downstream_vendor_management',
      'processing_volume_tracking',
      'environmental_controls'
    ],
    'refurbisher': [
      'testing_protocols',
      'warranty_management',
      'quality_assurance_procedures',
      'remarketing_channels',
      'customer_data_handling'
    ],
    'dismantler': [
      'disassembly_procedures',
      'component_sorting_methods',
      'hazardous_material_handling',
      'recovery_rate_tracking',
      'safety_protocols'
    ],
    'broker': [
      'vendor_verification_procedures',
      'chain_of_custody_tracking',
      'due_diligence_processes',
      'documentation_requirements',
      'risk_assessment_procedures'
    ],
    'collector': [
      'collection_procedures',
      'transportation_protocols',
      'storage_requirements',
      'pickup_scheduling',
      'customer_communication'
    ],
    'transporter': [
      'vehicle_requirements',
      'driver_training',
      'route_optimization',
      'cargo_security',
      'incident_reporting'
    ]
  };

  private static readonly CONDITIONAL_DEPENDENCIES: QuestionDependency[] = [
    // Data destruction dependencies
    {
      questionId: 'data_wiping_procedures',
      dependsOn: 'hasDataDestruction',
      condition: 'equals',
      value: true
    },
    {
      questionId: 'sanitization_verification',
      dependsOn: 'hasDataDestruction',
      condition: 'equals',
      value: true
    },
    {
      questionId: 'security_clearance_protocols',
      dependsOn: 'securityClearance',
      condition: 'equals',
      value: true
    },
    
    // Refurbishment dependencies
    {
      questionId: 'testing_equipment_calibration',
      dependsOn: 'hasRefurbishment',
      condition: 'equals',
      value: true
    },
    {
      questionId: 'warranty_policy',
      dependsOn: 'hasRefurbishment',
      condition: 'equals',
      value: true
    },
    
    // Scale-based dependencies
    {
      questionId: 'environmental_management_system',
      dependsOn: 'squareFootage',
      condition: 'greater_than',
      value: 50000
    },
    {
      questionId: 'multi_site_coordination',
      dependsOn: 'employeeCount',
      condition: 'equals',
      value: '100+'
    },
    
    // Processing volume dependencies
    {
      questionId: 'automated_sorting_systems',
      dependsOn: 'processingVolume',
      condition: 'equals',
      value: '10000+'
    },
    {
      questionId: 'batch_tracking_procedures',
      dependsOn: 'processingVolume',
      condition: 'greater_than',
      value: '500-2000'
    }
  ];

  /**
   * Get filtered questions based on facility characteristics
   */
  static async getFilteredQuestions(
    filter: QuestionFilter,
    assessmentId?: string
  ): Promise<ConditionalQuestion[]> {
    try {
      const startTime = Date.now();

      // Get base questions
      const baseQuestions = await db
        .select()
        .from(questions)
        .orderBy(questions.order);

      // Apply facility type filtering
      let filteredQuestions = this.filterByFacilityType(baseQuestions, filter.facilityType);

      // Apply conditional logic
      filteredQuestions = this.applyConditionalLogic(filteredQuestions, filter);

      // If assessment ID provided, get existing answers for context
      let existingAnswers: any[] = [];
      if (assessmentId) {
        existingAnswers = await db
          .select()
          .from(answers)
          .where(eq(answers.assessmentId, assessmentId));
      }

      // Build conditional questions with visibility logic
      const conditionalQuestions: ConditionalQuestion[] = filteredQuestions.map(question => {
        const dependencies = this.getDependenciesForQuestion(question.id);
        const isVisible = this.evaluateVisibility(dependencies, filter, existingAnswers);
        const isRequired = this.evaluateRequirement(question, filter);

        return {
          id: question.id,
          text: question.text,
          section: '', // Section property removed from schema but required by interface
          category: question.category,
          dependencies,
          isVisible,
          isRequired,
          facilityTypeSpecific: this.getFacilityTypeSpecific(question.id)
        };
      });

      await ObservabilityService.recordMetric(
        'question_filtering_time',
        Date.now() - startTime,
        'ms',
        {
          service: 'question_dependency',
          operation: 'getFilteredQuestions',
          tags: {
            facilityType: filter.facilityType || 'unknown',
            totalQuestions: String(baseQuestions.length),
            filteredQuestions: String(conditionalQuestions.length),
            visibleQuestions: String(conditionalQuestions.filter(q => q.isVisible).length)
          }
        }
      );

      return conditionalQuestions;

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'question_dependency',
        operation: 'getFilteredQuestions',
        severity: 'medium',
        metadata: { filter }
      });
      throw error;
    }
  }

  /**
   * Filter questions by facility type
   */
  private static filterByFacilityType(questions: any[], facilityType?: string): any[] {
    if (!facilityType) return questions;

    const typeSpecificQuestions = this.FACILITY_TYPE_QUESTIONS[facilityType as keyof typeof this.FACILITY_TYPE_QUESTIONS] || [];
    
    // Include general questions + facility-specific questions
    return questions.filter(question => {
      // General questions (apply to all facility types)
      if (!question.facilityTypeSpecific) return true;
      
      // Facility-specific questions
      const questionTypes = question.facilityTypeSpecific.split(',').map((t: string) => t.trim());
      return questionTypes.includes(facilityType) || typeSpecificQuestions.includes(question.id);
    });
  }

  /**
   * Apply conditional logic to filter questions
   */
  private static applyConditionalLogic(questions: any[], filter: QuestionFilter): any[] {
    return questions.filter(question => {
      const dependencies = this.getDependenciesForQuestion(question.id);
      if (dependencies.length === 0) return true;

      return this.evaluateVisibility(dependencies, filter, []);
    });
  }

  /**
   * Get dependencies for a specific question
   */
  private static getDependenciesForQuestion(questionId: string): QuestionDependency[] {
    return this.CONDITIONAL_DEPENDENCIES.filter(dep => dep.questionId === questionId);
  }

  /**
   * Evaluate if a question should be visible based on dependencies
   */
  private static evaluateVisibility(
    dependencies: QuestionDependency[],
    filter: QuestionFilter,
    existingAnswers: any[]
  ): boolean {
    if (dependencies.length === 0) return true;

    return dependencies.every(dependency => {
      const filterValue = this.getFilterValue(dependency.dependsOn, filter, existingAnswers);
      return this.evaluateCondition(filterValue, dependency.condition, dependency.value);
    });
  }

  /**
   * Evaluate if a question should be required
   */
  private static evaluateRequirement(question: any, filter: QuestionFilter): boolean {
    // High-risk facilities have more required questions
    if ((filter as any).hasDataDestruction || (filter as any).securityClearance) {
      return question.category === 'security' || question.category === 'data_management';
    }

    // Large facilities have more required questions
    if ((filter as any).floorArea && (filter as any).floorArea > 50000) {
      return question.category === 'environmental' || question.category === 'management_systems';
    }

    return question.required || false;
  }

  /**
   * Get filter value for dependency evaluation
   */
  private static getFilterValue(dependsOn: string, filter: QuestionFilter, existingAnswers: any[]): any {
    // Check filter first
    if (dependsOn in filter) {
      return (filter as any)[dependsOn];
    }

    // Check existing answers
    const answer = existingAnswers.find(a => a.questionId === dependsOn);
    if (answer) {
      return answer.value;
    }

    return undefined;
  }

  /**
   * Evaluate a condition
   */
  private static evaluateCondition(value: any, condition: string, expectedValue: any): boolean {
    switch (condition) {
      case 'equals':
        return value === expectedValue;
      case 'not_equals':
        return value !== expectedValue;
      case 'contains':
        return Array.isArray(value) ? value.includes(expectedValue) : false;
      case 'greater_than':
        return typeof value === 'number' && value > (expectedValue as number);
      case 'less_than':
        return typeof value === 'number' && value < (expectedValue as number);
      default:
        return false;
    }
  }

  /**
   * Get facility types that this question applies to
   */
  private static getFacilityTypeSpecific(questionId: string): string[] | undefined {
    for (const [facilityType, questions] of Object.entries(this.FACILITY_TYPE_QUESTIONS)) {
      if (questions.includes(questionId)) {
        return [facilityType];
      }
    }
    return undefined;
  }

  /**
   * Get smart question recommendations based on facility profile
   */
  static async getSmartRecommendations(
    filter: QuestionFilter,
    assessmentId: string
  ): Promise<{
    priorityQuestions: string[];
    optionalQuestions: string[];
    facilitySpecificQuestions: string[];
  }> {
    try {
      const filteredQuestions = await this.getFilteredQuestions(filter, assessmentId);
      
      const priorityQuestions = filteredQuestions
        .filter(q => q.isRequired && q.isVisible)
        .map(q => q.id);

      const optionalQuestions = filteredQuestions
        .filter(q => !q.isRequired && q.isVisible)
        .map(q => q.id);

      const facilitySpecificQuestions = filteredQuestions
        .filter(q => q.facilityTypeSpecific && q.isVisible)
        .map(q => q.id);

      await ObservabilityService.log('INFO', 'Smart recommendations generated', {
        service: 'question_dependency',
        operation: 'getSmartRecommendations',
        metadata: {
          assessmentId,
          facilityType: filter.facilityType,
          priorityCount: priorityQuestions.length,
          optionalCount: optionalQuestions.length,
          facilitySpecificCount: facilitySpecificQuestions.length
        }
      });

      return {
        priorityQuestions,
        optionalQuestions,
        facilitySpecificQuestions
      };

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'question_dependency',
        operation: 'getSmartRecommendations',
        severity: 'medium',
        metadata: { filter, assessmentId }
      });
      throw error;
    }
  }

  /**
   * Update question visibility based on answer changes
   */
  static async updateQuestionVisibility(
    assessmentId: string,
    changedAnswers: { questionId: string; value: any }[]
  ): Promise<{
    newlyVisible: string[];
    newlyHidden: string[];
    changedRequirements: string[];
  }> {
    try {
      // Get current assessment and facility info
      const assessment = await db.query.assessments.findFirst({
        where: eq(assessments.id, assessmentId)
      });

      if (!assessment) {
        throw new Error(`Assessment not found: ${assessmentId}`);
      }

      // Build filter from answers
      const filter: QuestionFilter = {
        // Add filter properties based on answers
      };

      // Get all current answers
      const allAnswers = await db
        .select()
        .from(answers)
        .where(eq(answers.assessmentId, assessmentId));

      // Apply changed answers
      const updatedAnswers = allAnswers.map(answer => {
        const changed = changedAnswers.find(ca => ca.questionId === answer.questionId);
        return changed ? { ...answer, value: changed.value } : answer;
      });

      // Get visibility for current state
      const currentQuestions = await this.getFilteredQuestions(filter, assessmentId);
      
      // Update answers and recalculate
      // ... implementation for visibility changes

      return {
        newlyVisible: [],
        newlyHidden: [],
        changedRequirements: []
      };

    } catch (error) {
      await ObservabilityService.logError(error as Error, {
        service: 'question_dependency',
        operation: 'updateQuestionVisibility',
        severity: 'medium',
        metadata: { assessmentId, changedAnswers }
      });
      throw error;
    }
  }
}
