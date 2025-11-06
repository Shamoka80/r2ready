
-- Migration: Add missing observability columns
-- SystemLog duration column and PerformanceMetric tags column

-- Add duration column to SystemLog if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'SystemLog' AND column_name = 'duration'
    ) THEN
        ALTER TABLE "SystemLog" ADD COLUMN "duration" INTEGER;
    END IF;
END $$;

-- Add tags column to PerformanceMetric if it doesn't exist  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PerformanceMetric' AND column_name = 'tags'
    ) THEN
        ALTER TABLE "PerformanceMetric" ADD COLUMN "tags" JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_systemlog_duration ON "SystemLog"("duration");
CREATE INDEX IF NOT EXISTS idx_performancemetric_tags ON "PerformanceMetric" USING GIN("tags");
