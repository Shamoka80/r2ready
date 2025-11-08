
import { db } from '../db';
import { sql, eq, and, gte, lte, desc, asc } from 'drizzle-orm';
import { assessments, users, facilityProfiles, clientOrganizations } from '../../shared/schema';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  type: 'milestone' | 'deadline' | 'audit' | 'certification' | 'training' | 'review';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  category: string;
  relatedEntityId?: string;
  relatedEntityType?: 'assessment' | 'facility' | 'client';
  assignedUsers: string[];
  reminders: ReminderConfig[];
  recurrence?: RecurrenceConfig;
  location?: string;
  isAllDay: boolean;
  color: string;
  metadata?: Record<string, any>;
}

export interface ReminderConfig {
  type: 'email' | 'notification' | 'sms';
  timeOffset: number; // minutes before event
  recipients: string[];
}

export interface RecurrenceConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  occurrences?: number;
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  dayOfMonth?: number;
  monthOfYear?: number;
}

export interface CalendarFilter {
  startDate?: Date;
  endDate?: Date;
  types?: string[];
  priorities?: string[];
  statuses?: string[];
  categories?: string[];
  assignedTo?: string;
  facilityId?: string;
  clientId?: string;
}

export class CalendarService {
  
  async createEvent(tenantId: string, userId: string, eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const eventId = crypto.randomUUID();
    
    const event: CalendarEvent = {
      id: eventId,
      title: eventData.title || 'Untitled Event',
      description: eventData.description,
      startDate: eventData.startDate || new Date(),
      endDate: eventData.endDate,
      type: eventData.type || 'milestone',
      priority: eventData.priority || 'medium',
      status: eventData.status || 'scheduled',
      category: eventData.category || 'general',
      relatedEntityId: eventData.relatedEntityId,
      relatedEntityType: eventData.relatedEntityType,
      assignedUsers: eventData.assignedUsers || [userId],
      reminders: eventData.reminders || [],
      recurrence: eventData.recurrence,
      location: eventData.location,
      isAllDay: eventData.isAllDay || false,
      color: eventData.color || this.getDefaultColorForType(eventData.type || 'milestone'),
      metadata: eventData.metadata || {}
    };

    // Store in database (using a dedicated calendar_events table)
    await db.execute(sql`
      INSERT INTO "CalendarEvent" (
        id, "tenantId", "createdBy", title, description, "startDate", "endDate",
        type, priority, status, category, "relatedEntityId", "relatedEntityType",
        "assignedUsers", reminders, recurrence, location, "isAllDay", color, metadata,
        "createdAt", "updatedAt"
      ) VALUES (
        ${eventId}, ${tenantId}, ${userId}, ${event.title}, ${event.description},
        ${event.startDate}, ${event.endDate}, ${event.type}, ${event.priority},
        ${event.status}, ${event.category}, ${event.relatedEntityId}, ${event.relatedEntityType},
        ${JSON.stringify(event.assignedUsers)}, ${JSON.stringify(event.reminders)},
        ${JSON.stringify(event.recurrence)}, ${event.location}, ${event.isAllDay},
        ${event.color}, ${JSON.stringify(event.metadata)}, NOW(), NOW()
      )
    `);

    // Schedule reminders
    if (event.reminders.length > 0) {
      await this.scheduleReminders(event);
    }

    // Generate recurring events if configured
    if (event.recurrence) {
      await this.generateRecurringEvents(tenantId, userId, event);
    }

    return event;
  }

  async getEvents(tenantId: string, filter: CalendarFilter = {}): Promise<CalendarEvent[]> {
    let whereClause = `"tenantId" = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filter.startDate) {
      whereClause += ` AND "startDate" >= $${paramIndex}`;
      params.push(filter.startDate);
      paramIndex++;
    }

    if (filter.endDate) {
      whereClause += ` AND "startDate" <= $${paramIndex}`;
      params.push(filter.endDate);
      paramIndex++;
    }

    if (filter.types && filter.types.length > 0) {
      whereClause += ` AND type = ANY($${paramIndex})`;
      params.push(filter.types);
      paramIndex++;
    }

    if (filter.statuses && filter.statuses.length > 0) {
      whereClause += ` AND status = ANY($${paramIndex})`;
      params.push(filter.statuses);
      paramIndex++;
    }

    if (filter.assignedTo) {
      whereClause += ` AND $${paramIndex} = ANY("assignedUsers"::jsonb)`;
      params.push(`"${filter.assignedTo}"`);
      paramIndex++;
    }

    // Note: Using raw SQL with proper parameter binding
    const query = `SELECT * FROM "CalendarEvent" WHERE ${whereClause} ORDER BY "startDate" ASC`;
    const result = await db.execute(sql.raw(query));

    return result.rows.map(row => this.mapRowToEvent(row));
  }

  async generateComplianceCalendar(tenantId: string, assessmentId: string): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    const assessment = await db.query.assessments.findFirst({
      where: and(eq(assessments.id, assessmentId), eq(assessments.tenantId, tenantId)),
      with: {
        standard: true
        // facility: true  // Remove if facility is not a relation on assessments
      }
    });

    if (!assessment) return events;

    const startDate = new Date();
    const certificationTarget = new Date(startDate.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months

    // Assessment Milestones
    const milestoneEvents = [
      {
        title: `${assessment.title} - Initial Assessment`,
        startDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        type: 'milestone' as const,
        category: 'assessment-phase',
        priority: 'high' as const
      },
      {
        title: `${assessment.title} - Evidence Collection Complete`,
        startDate: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        type: 'milestone' as const,
        category: 'evidence',
        priority: 'high' as const
      },
      {
        title: `${assessment.title} - Gap Analysis Review`,
        startDate: new Date(startDate.getTime() + 45 * 24 * 60 * 60 * 1000),
        type: 'review' as const,
        category: 'analysis',
        priority: 'medium' as const
      },
      {
        title: `${assessment.title} - Internal Audit`,
        startDate: new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000),
        type: 'audit' as const,
        category: 'internal-audit',
        priority: 'critical' as const
      },
      {
        title: `${assessment.title} - Certification Audit`,
        startDate: certificationTarget,
        type: 'certification' as const,
        category: 'external-audit',
        priority: 'critical' as const
      }
    ];

    for (const milestone of milestoneEvents) {
      const event = await this.createEvent(tenantId, assessment.createdBy, {
        ...milestone,
        relatedEntityId: assessmentId,
        relatedEntityType: 'assessment',
        reminders: [
          { type: 'email', timeOffset: 7 * 24 * 60, recipients: [assessment.createdBy] },
          { type: 'email', timeOffset: 24 * 60, recipients: [assessment.createdBy] }
        ]
      });
      events.push(event);
    }

    // Training Schedule
    const trainingEvents = await this.generateTrainingSchedule(tenantId, assessment.createdBy, startDate);
    events.push(...trainingEvents);

    // Review Cycles
    const reviewEvents = await this.generateReviewCycle(tenantId, assessment.createdBy, startDate, certificationTarget);
    events.push(...reviewEvents);

    return events;
  }

  async generateTrainingSchedule(tenantId: string, userId: string, startDate: Date): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    const trainingModules = [
      { name: 'R2v3 Overview Training', duration: 2, priority: 'high' as const },
      { name: 'Data Sanitization Training', duration: 4, priority: 'critical' as const },
      { name: 'Chain of Custody Training', duration: 2, priority: 'high' as const },
      { name: 'Focus Materials Training', duration: 3, priority: 'medium' as const },
      { name: 'Environmental Management', duration: 2, priority: 'medium' as const }
    ];

    let currentDate = new Date(startDate);
    
    for (const module of trainingModules) {
      const trainingDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const event = await this.createEvent(tenantId, userId, {
        title: module.name,
        startDate: trainingDate,
        endDate: new Date(trainingDate.getTime() + module.duration * 60 * 60 * 1000),
        type: 'training',
        category: 'compliance-training',
        priority: module.priority,
        reminders: [
          { type: 'email', timeOffset: 24 * 60, recipients: [userId] }
        ]
      });
      
      events.push(event);
      currentDate = trainingDate;
    }

    return events;
  }

  async generateReviewCycle(tenantId: string, userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    const reviewTypes = [
      { name: 'Monthly Compliance Review', frequency: 'monthly' as const, priority: 'medium' as const },
      { name: 'Quarterly Management Review', frequency: 'monthly' as const, interval: 3, priority: 'high' as const },
      { name: 'Semi-Annual Policy Review', frequency: 'monthly' as const, interval: 6, priority: 'high' as const }
    ];

    for (const review of reviewTypes) {
      const interval = review.interval || 1;
      let reviewDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      while (reviewDate <= endDate) {
        const event = await this.createEvent(tenantId, userId, {
          title: review.name,
          startDate: reviewDate,
          type: 'review',
          category: 'periodic-review',
          priority: review.priority,
          recurrence: {
            frequency: review.frequency,
            interval: interval,
            endDate: endDate
          },
          reminders: [
            { type: 'email', timeOffset: 3 * 24 * 60, recipients: [userId] },
            { type: 'email', timeOffset: 24 * 60, recipients: [userId] }
          ]
        });
        
        events.push(event);
        reviewDate = new Date(reviewDate.getTime() + interval * 30 * 24 * 60 * 60 * 1000);
      }
    }

    return events;
  }

  async getUpcomingDeadlines(tenantId: string, days: number = 30): Promise<CalendarEvent[]> {
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    return this.getEvents(tenantId, {
      startDate: new Date(),
      endDate: endDate,
      types: ['deadline', 'audit', 'certification'],
      statuses: ['scheduled', 'in_progress']
    });
  }

  async updateEventStatus(tenantId: string, eventId: string, status: CalendarEvent['status']): Promise<void> {
    await db.execute(sql`
      UPDATE "CalendarEvent" 
      SET status = ${status}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "tenantId" = ${tenantId}
    `);
  }

  private async scheduleReminders(event: CalendarEvent): Promise<void> {
    // Implementation would integrate with notification service
    // For now, store reminder jobs in database
    for (const reminder of event.reminders) {
      const reminderTime = new Date(event.startDate.getTime() - reminder.timeOffset * 60 * 1000);
      
      await db.execute(sql`
        INSERT INTO "ScheduledReminder" (
          id, "eventId", "reminderTime", type, recipients, "createdAt"
        ) VALUES (
          ${crypto.randomUUID()}, ${event.id}, ${reminderTime}, 
          ${reminder.type}, ${JSON.stringify(reminder.recipients)}, NOW()
        )
      `);
    }
  }

  private async generateRecurringEvents(tenantId: string, userId: string, parentEvent: CalendarEvent): Promise<void> {
    if (!parentEvent.recurrence) return;

    const { frequency, interval, endDate, occurrences } = parentEvent.recurrence;
    let currentDate = new Date(parentEvent.startDate);
    let count = 0;
    const maxOccurrences = occurrences || 100;

    while ((endDate && currentDate <= endDate) || count < maxOccurrences) {
      currentDate = this.calculateNextOccurrence(currentDate, frequency, interval);
      
      if (endDate && currentDate > endDate) break;
      if (count >= maxOccurrences) break;

      const recurringEvent = {
        ...parentEvent,
        id: crypto.randomUUID(),
        startDate: new Date(currentDate),
        endDate: parentEvent.endDate ? 
          new Date(currentDate.getTime() + (parentEvent.endDate.getTime() - parentEvent.startDate.getTime())) : 
          undefined,
        metadata: {
          ...parentEvent.metadata,
          parentEventId: parentEvent.id,
          occurrenceNumber: count + 1
        }
      };

      await this.createEvent(tenantId, userId, recurringEvent);
      count++;
    }
  }

  private calculateNextOccurrence(currentDate: Date, frequency: string, interval: number): Date {
    const next = new Date(currentDate);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + interval);
        break;
      case 'weekly':
        next.setDate(next.getDate() + (interval * 7));
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + interval);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + interval);
        break;
    }
    
    return next;
  }

  private getDefaultColorForType(type: string): string {
    const colorMap: Record<string, string> = {
      milestone: '#4CAF50',
      deadline: '#FF9800',
      audit: '#F44336',
      certification: '#9C27B0',
      training: '#2196F3',
      review: '#607D8B'
    };
    
    return colorMap[type] || '#757575';
  }

  private mapRowToEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: new Date(row.startDate),
      endDate: row.endDate ? new Date(row.endDate) : undefined,
      type: row.type,
      priority: row.priority,
      status: row.status,
      category: row.category,
      relatedEntityId: row.relatedEntityId,
      relatedEntityType: row.relatedEntityType,
      assignedUsers: JSON.parse(row.assignedUsers || '[]'),
      reminders: JSON.parse(row.reminders || '[]'),
      recurrence: row.recurrence ? JSON.parse(row.recurrence) : undefined,
      location: row.location,
      isAllDay: row.isAllDay,
      color: row.color,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
}

export const calendarService = new CalendarService();
