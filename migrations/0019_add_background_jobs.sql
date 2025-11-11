-- Create JobStatus enum
DO $$ BEGIN
  CREATE TYPE "JobStatus" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create JobPriority enum
DO $$ BEGIN
  CREATE TYPE "JobPriority" AS ENUM('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create Job table
CREATE TABLE IF NOT EXISTS "Job" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" varchar NOT NULL,
  "type" varchar NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "JobPriority" NOT NULL DEFAULT 'medium',
  "payload" jsonb NOT NULL,
  "result" jsonb,
  "error" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "maxAttempts" integer NOT NULL DEFAULT 3,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);

-- Add foreign key constraint to Tenant table
ALTER TABLE "Job" ADD CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

-- Create indexes for efficient job queue queries
CREATE INDEX IF NOT EXISTS "idx_job_status_priority" ON "Job"("status", "priority", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_job_tenant" ON "Job"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_job_type" ON "Job"("type");
