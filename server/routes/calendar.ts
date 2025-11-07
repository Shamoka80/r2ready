
import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/authService";
import type { AuthenticatedRequest } from "../services/authService";
import { calendarService } from "../services/calendarService";
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';

const router = Router();

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  type: z.enum(['milestone', 'deadline', 'audit', 'certification', 'training', 'review']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.string().max(100),
  relatedEntityId: z.string().uuid().optional(),
  relatedEntityType: z.enum(['assessment', 'facility', 'client']).optional(),
  assignedUsers: z.array(z.string().uuid()).default([]),
  reminders: z.array(z.object({
    type: z.enum(['email', 'notification', 'sms']),
    timeOffset: z.number().min(0), // minutes
    recipients: z.array(z.string().uuid())
  })).default([]),
  recurrence: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().min(1).max(365),
    endDate: z.string().datetime().optional(),
    occurrences: z.number().min(1).max(1000).optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    monthOfYear: z.number().min(1).max(12).optional()
  }).optional(),
  location: z.string().max(200).optional(),
  isAllDay: z.boolean().default(false),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
});

const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'overdue', 'cancelled']).optional()
});

const calendarFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  types: z.array(z.string()).optional(),
  priorities: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  assignedTo: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  view: z.enum(['month', 'week', 'day', 'agenda']).default('month')
});

// All routes require authentication
router.use(AuthService.authMiddleware);

// GET /api/calendar/events - Get calendar events
router.get("/events", 
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
    try {
      const filterData = calendarFilterSchema.parse(req.query);
      
      const filter = {
        ...filterData,
        startDate: filterData.startDate ? new Date(filterData.startDate) : undefined,
        endDate: filterData.endDate ? new Date(filterData.endDate) : undefined
      };

      const events = await calendarService.getEvents(req.tenant!.id, filter);
      
      res.json({
        success: true,
        events,
        view: filterData.view,
        total: events.length
      });
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid filter parameters', details: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  }
);

// POST /api/calendar/events - Create calendar event
router.post("/events",
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
    try {
      const eventData = createEventSchema.parse(req.body);
      
      // Convert date strings to Date objects
      const event = await calendarService.createEvent(req.tenant!.id, req.user!.id, {
        ...eventData,
        startDate: new Date(eventData.startDate),
        endDate: eventData.endDate ? new Date(eventData.endDate) : undefined,
        assignedUsers: eventData.assignedUsers.length > 0 ? eventData.assignedUsers : [req.user!.id],
        recurrence: eventData.recurrence ? {
          ...eventData.recurrence,
          endDate: eventData.recurrence.endDate ? new Date(eventData.recurrence.endDate) : undefined
        } : undefined
      });

      // Log audit event
      await AuthService.logAuditEvent(
        req.tenant!.id,
        req.user!.id,
        'CALENDAR_EVENT_CREATED',
        'calendar_event',
        event.id,
        undefined,
        { title: event.title, type: event.type, startDate: event.startDate }
      );

      res.status(201).json({
        success: true,
        event
      });
    } catch (error) {
      console.error("Error creating calendar event:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid event data', details: error.errors });
      }
      res.status(500).json({ error: "Failed to create calendar event" });
    }
  }
);

// PUT /api/calendar/events/:id - Update calendar event
router.put("/events/:id",
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updateData = updateEventSchema.parse(req.body);
      
      // Implementation would update the event
      // For now, just update status as an example
      if (updateData.status) {
        await calendarService.updateEventStatus(req.tenant!.id, id, updateData.status);
      }

      await AuthService.logAuditEvent(
        req.tenant!.id,
        req.user!.id,
        'CALENDAR_EVENT_UPDATED',
        'calendar_event',
        id,
        undefined,
        updateData
      );

      res.json({
        success: true,
        message: 'Event updated successfully'
      });
    } catch (error) {
      console.error("Error updating calendar event:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid update data', details: error.errors });
      }
      res.status(500).json({ error: "Failed to update calendar event" });
    }
  }
);

// GET /api/calendar/upcoming-deadlines - Get upcoming deadlines
router.get("/upcoming-deadlines",
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const deadlines = await calendarService.getUpcomingDeadlines(req.tenant!.id, days);
      
      res.json({
        success: true,
        deadlines,
        timeframe: `${days} days`,
        count: deadlines.length
      });
    } catch (error) {
      console.error("Error fetching upcoming deadlines:", error);
      res.status(500).json({ error: "Failed to fetch upcoming deadlines" });
    }
  }
);

// POST /api/calendar/generate-compliance-calendar - Generate compliance calendar for assessment
router.post("/generate-compliance-calendar",
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { assessmentId } = z.object({
        assessmentId: z.string().uuid()
      }).parse(req.body);

      const events = await calendarService.generateComplianceCalendar(req.tenant!.id, assessmentId);
      
      await AuthService.logAuditEvent(
        req.tenant!.id,
        req.user!.id,
        'COMPLIANCE_CALENDAR_GENERATED',
        'assessment',
        assessmentId,
        undefined,
        { eventsCount: events.length }
      );

      res.json({
        success: true,
        message: 'Compliance calendar generated successfully',
        events,
        count: events.length
      });
    } catch (error) {
      console.error("Error generating compliance calendar:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      res.status(500).json({ error: "Failed to generate compliance calendar" });
    }
  }
);

// GET /api/calendar/dashboard - Calendar dashboard data
router.get("/dashboard",
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
    try {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [todayEvents, upcomingDeadlines, thisWeekEvents, overdueEvents] = await Promise.all([
        calendarService.getEvents(req.tenant!.id, {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }),
        calendarService.getUpcomingDeadlines(req.tenant!.id, 30),
        calendarService.getEvents(req.tenant!.id, {
          startDate: today,
          endDate: nextWeek
        }),
        calendarService.getEvents(req.tenant!.id, {
          endDate: today,
          statuses: ['scheduled', 'in_progress']
        })
      ]);

      const eventsByType = thisWeekEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const eventsByPriority = thisWeekEvents.reduce((acc, event) => {
        acc[event.priority] = (acc[event.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        dashboard: {
          todayEvents: todayEvents.length,
          upcomingDeadlines: upcomingDeadlines.length,
          thisWeekEvents: thisWeekEvents.length,
          overdueEvents: overdueEvents.length,
          eventsByType,
          eventsByPriority,
          nextCriticalDeadline: upcomingDeadlines
            .filter(e => e.priority === 'critical')
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0],
          recentEvents: todayEvents.slice(0, 5),
          upcomingEvents: thisWeekEvents
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
            .slice(0, 10)
        }
      });
    } catch (error) {
      console.error("Error fetching calendar dashboard:", error);
      res.status(500).json({ error: "Failed to fetch calendar dashboard" });
    }
  }
);

export default router;
