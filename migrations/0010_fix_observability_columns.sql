
-- Migration: Fix Observability Schema Issues
-- Adds missing columns that are causing database errors in Phase 1

-- Add missing duration column to SystemLog table
ALTER TABLE "SystemLog" ADD COLUMN IF NOT EXISTS "duration" INTEGER;

-- Add missing tags column to PerformanceMetric table  
ALTER TABLE "PerformanceMetric" ADD COLUMN IF NOT EXISTS "tags" JSON DEFAULT '{}';

-- Create indexes for the new columns for performance
CREATE INDEX IF NOT EXISTS "system_logs_duration_idx" ON "SystemLog"("duration");
CREATE INDEX IF NOT EXISTS "performance_metrics_tags_idx" ON "PerformanceMetric" USING GIN ("tags");

-- Update any existing records to have default values
UPDATE "SystemLog" SET "duration" = NULL WHERE "duration" IS NULL;
UPDATE "PerformanceMetric" SET "tags" = '{}' WHERE "tags" IS NULL;

COMMENT ON COLUMN "SystemLog"."duration" IS 'Request/operation duration in milliseconds';
COMMENT ON COLUMN "PerformanceMetric"."tags" IS 'JSON object containing metric tags for filtering and grouping';
