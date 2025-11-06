
import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface QuestionFilter {
  facilityType?: string;
  clauses?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  category?: string;
  tags?: string[];
  dependsOn?: string[];
}

export interface CorrectiveAction {
  id: string;
  questionId: string;
  assessmentId: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  dueDate?: string;
  status: 'open' | 'in-progress' | 'completed' | 'deferred';
  evidenceRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  assessmentId: string;
  name: string;
  description: string;
  targetDate: string;
  completed: boolean;
  completedDate?: string;
  dependencies: string[];
  criticalPath: boolean;
}

export interface AssessmentTemplate {
  id: string;
  name: string;
  description: string;
  facilityTypes: string[];
  questions: string[];
  scoringWeights: Record<string, number>;
  milestones: Milestone[];
  createdAt: string;
}

export class AssessmentManagementService {
  
  async filterQuestions(filter: QuestionFilter): Promise<any[]> {
    try {
      let query = 'SELECT * FROM "Question" WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.facilityType) {
        query += ` AND facility_type = $${paramIndex}`;
        params.push(filter.facilityType);
        paramIndex++;
      }

      if (filter.clauses && filter.clauses.length > 0) {
        query += ` AND clause = ANY($${paramIndex})`;
        params.push(filter.clauses);
        paramIndex++;
      }

      if (filter.category) {
        query += ` AND category = $${paramIndex}`;
        params.push(filter.category);
        paramIndex++;
      }

      if (filter.tags && filter.tags.length > 0) {
        query += ` AND tags::jsonb ?| $${paramIndex}`;
        params.push(filter.tags);
        paramIndex++;
      }

      const result = await db.execute(sql.raw(query));
      return (result as any).rows || [];
    } catch (error) {
      console.error('Question filtering error:', error);
      return [];
    }
  }

  async createCorrectiveAction(action: Omit<CorrectiveAction, 'id' | 'createdAt' | 'updatedAt'>): Promise<CorrectiveAction> {
    const newAction: CorrectiveAction = {
      ...action,
      id: `ca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // In a full implementation, this would save to database
    return newAction;
  }

  async trackCorrectiveActions(assessmentId: string): Promise<CorrectiveAction[]> {
    // Mock implementation - would query database in production
    return [
      {
        id: 'ca_1',
        questionId: 'q_1',
        assessmentId,
        description: 'Update data sanitization procedures',
        priority: 'high',
        status: 'in-progress',
        evidenceRequired: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  async createMilestone(milestone: Omit<Milestone, 'id'>): Promise<Milestone> {
    const newMilestone: Milestone = {
      ...milestone,
      id: `ms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    return newMilestone;
  }

  async trackProgress(assessmentId: string): Promise<{
    totalQuestions: number;
    completedQuestions: number;
    completionPercentage: number;
    milestones: Milestone[];
    nextMilestone?: Milestone;
  }> {
    // Mock implementation - would calculate from database in production
    const totalQuestions = 150;
    const completedQuestions = 120;
    const completionPercentage = Math.round((completedQuestions / totalQuestions) * 100);

    const milestones: Milestone[] = [
      {
        id: 'ms_1',
        assessmentId,
        name: 'Initial Assessment Complete',
        description: 'Complete all initial assessment questions',
        targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        completed: true,
        completedDate: new Date().toISOString(),
        dependencies: [],
        criticalPath: true
      },
      {
        id: 'ms_2',
        assessmentId,
        name: 'Evidence Collection',
        description: 'Gather all required evidence documents',
        targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        completed: false,
        dependencies: ['ms_1'],
        criticalPath: true
      }
    ];

    const nextMilestone = milestones.find(m => !m.completed);

    return {
      totalQuestions,
      completedQuestions,
      completionPercentage,
      milestones,
      nextMilestone
    };
  }

  async createAssessmentTemplate(template: Omit<AssessmentTemplate, 'id' | 'createdAt'>): Promise<AssessmentTemplate> {
    const newTemplate: AssessmentTemplate = {
      ...template,
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };

    return newTemplate;
  }

  async buildQuestionDependencies(questions: any[]): Promise<Map<string, string[]>> {
    const dependencies = new Map<string, string[]>();

    for (const question of questions) {
      const deps: string[] = [];
      
      // Example dependency logic
      if (question.category === 'data-sanitization' && question.clause !== '2.1') {
        // Data sanitization questions depend on policy questions
        const policyQuestions = questions.filter(q => 
          q.category === 'policy' && q.clause === '2.1'
        );
        deps.push(...policyQuestions.map(q => q.id));
      }

      if (question.tags?.includes('advanced')) {
        // Advanced questions depend on basic questions in same clause
        const basicQuestions = questions.filter(q => 
          q.clause === question.clause && q.tags?.includes('basic')
        );
        deps.push(...basicQuestions.map(q => q.id));
      }

      if (deps.length > 0) {
        dependencies.set(question.id, deps);
      }
    }

    return dependencies;
  }
}

export const assessmentManagementService = new AssessmentManagementService();
