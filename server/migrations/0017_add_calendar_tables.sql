
-- Calendar Events table
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    "createdBy" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL,
    description text,
    "startDate" timestamp with time zone NOT NULL,
    "endDate" timestamp with time zone,
    type varchar(20) NOT NULL CHECK (type IN ('milestone', 'deadline', 'audit', 'certification', 'training', 'review')),
    priority varchar(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'overdue', 'cancelled')),
    category varchar(100) NOT NULL,
    "relatedEntityId" uuid,
    "relatedEntityType" varchar(20) CHECK ("relatedEntityType" IN ('assessment', 'facility', 'client')),
    "assignedUsers" jsonb NOT NULL DEFAULT '[]',
    reminders jsonb NOT NULL DEFAULT '[]',
    recurrence jsonb,
    location varchar(200),
    "isAllDay" boolean NOT NULL DEFAULT false,
    color varchar(7) NOT NULL DEFAULT '#757575',
    metadata jsonb NOT NULL DEFAULT '{}',
    "createdAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Scheduled Reminders table
CREATE TABLE IF NOT EXISTS "ScheduledReminder" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "eventId" uuid NOT NULL REFERENCES "CalendarEvent"(id) ON DELETE CASCADE,
    "reminderTime" timestamp with time zone NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('email', 'notification', 'sms')),
    recipients jsonb NOT NULL,
    sent boolean NOT NULL DEFAULT false,
    "sentAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Calendar Subscriptions table for external calendar integration
CREATE TABLE IF NOT EXISTS "CalendarSubscription" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    provider varchar(50) NOT NULL CHECK (provider IN ('google', 'outlook', 'apple', 'ical')),
    "externalCalendarId" varchar(200) NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "syncEnabled" boolean NOT NULL DEFAULT true,
    "lastSyncAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    UNIQUE("tenantId", "userId", provider, "externalCalendarId")
);

-- Event Templates table
CREATE TABLE IF NOT EXISTS "CalendarEventTemplate" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
    "createdBy" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    description text,
    "templateData" jsonb NOT NULL,
    category varchar(100) NOT NULL,
    "isPublic" boolean NOT NULL DEFAULT false,
    "usageCount" integer NOT NULL DEFAULT 0,
    "createdAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "CalendarEvent_tenantId_startDate_idx" ON "CalendarEvent"("tenantId", "startDate");
CREATE INDEX IF NOT EXISTS "CalendarEvent_tenantId_type_idx" ON "CalendarEvent"("tenantId", type);
CREATE INDEX IF NOT EXISTS "CalendarEvent_tenantId_status_idx" ON "CalendarEvent"("tenantId", status);
CREATE INDEX IF NOT EXISTS "CalendarEvent_tenantId_priority_idx" ON "CalendarEvent"("tenantId", priority);
CREATE INDEX IF NOT EXISTS "CalendarEvent_relatedEntityId_idx" ON "CalendarEvent"("relatedEntityId");

CREATE INDEX IF NOT EXISTS "ScheduledReminder_reminderTime_sent_idx" ON "ScheduledReminder"("reminderTime", sent);
CREATE INDEX IF NOT EXISTS "ScheduledReminder_eventId_idx" ON "ScheduledReminder"("eventId");

CREATE INDEX IF NOT EXISTS "CalendarSubscription_tenantId_userId_idx" ON "CalendarSubscription"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "CalendarSubscription_syncEnabled_idx" ON "CalendarSubscription"("syncEnabled");

-- Add updated_at trigger for CalendarEvent
CREATE OR REPLACE FUNCTION update_calendar_event_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calendar_event_updated_at
    BEFORE UPDATE ON "CalendarEvent"
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_event_updated_at();

-- Add updated_at trigger for CalendarSubscription
CREATE TRIGGER update_calendar_subscription_updated_at
    BEFORE UPDATE ON "CalendarSubscription"
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_event_updated_at();

-- Add updated_at trigger for CalendarEventTemplate
CREATE TRIGGER update_calendar_event_template_updated_at
    BEFORE UPDATE ON "CalendarEventTemplate"
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_event_updated_at();
