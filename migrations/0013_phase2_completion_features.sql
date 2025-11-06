-- Add CorrectiveAction table
CREATE TABLE IF NOT EXISTS "CorrectiveAction" (
  "id" TEXT PRIMARY KEY,
  "assessmentId" TEXT NOT NULL REFERENCES "Assessment"("id") ON DELETE CASCADE,
  "questionId" TEXT REFERENCES "Question"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED', 'CANCELLED')),
  "assignedTo" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "dueDate" TIMESTAMP,
  "completedDate" TIMESTAMP,
  "resolution" TEXT,
  "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "tags" JSONB DEFAULT '[]',
  "createdBy" TEXT NOT NULL REFERENCES "User"("id"),
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add Milestone table
CREATE TABLE IF NOT EXISTS "Milestone" (
  "id" TEXT PRIMARY KEY,
  "assessmentId" TEXT NOT NULL REFERENCES "Assessment"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "targetDate" TIMESTAMP NOT NULL,
  "completedDate" TIMESTAMP,
  "category" TEXT NOT NULL CHECK ("category" IN ('PREPARATION', 'ASSESSMENT', 'REVIEW', 'COMPLETION', 'CERTIFICATION')),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'BLOCKED')),
  "progress" INTEGER NOT NULL DEFAULT 0 CHECK ("progress" >= 0 AND "progress" <= 100),
  "dependencies" JSONB DEFAULT '[]',
  "criticalPath" BOOLEAN NOT NULL DEFAULT false,
  "estimatedHours" DECIMAL(8,2),
  "actualHours" DECIMAL(8,2),
  "notes" TEXT,
  "createdBy" TEXT NOT NULL REFERENCES "User"("id"),
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add AssessmentTemplate table
CREATE TABLE IF NOT EXISTS "AssessmentTemplate" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "facilityTypes" JSONB NOT NULL DEFAULT '[]',
  "industryVerticals" JSONB DEFAULT '[]',
  "standardCode" TEXT NOT NULL DEFAULT 'R2V3_1',
  "questionCategories" JSONB NOT NULL DEFAULT '[]',
  "defaultMilestones" JSONB DEFAULT '[]',
  "scoringWeights" JSONB DEFAULT '{}',
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL REFERENCES "User"("id"),
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add templateId to Assessment table
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "templateId" TEXT REFERENCES "AssessmentTemplate"("id") ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_corrective_action_assessment" ON "CorrectiveAction"("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_corrective_action_status" ON "CorrectiveAction"("status");
CREATE INDEX IF NOT EXISTS "idx_corrective_action_priority" ON "CorrectiveAction"("priority");
CREATE INDEX IF NOT EXISTS "idx_corrective_action_due_date" ON "CorrectiveAction"("dueDate");

CREATE INDEX IF NOT EXISTS "idx_milestone_assessment" ON "Milestone"("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_milestone_status" ON "Milestone"("status");
CREATE INDEX IF NOT EXISTS "idx_milestone_target_date" ON "Milestone"("targetDate");
CREATE INDEX IF NOT EXISTS "idx_milestone_critical_path" ON "Milestone"("criticalPath");

CREATE INDEX IF NOT EXISTS "idx_assessment_template_facility_types" ON "AssessmentTemplate" USING GIN ("facilityTypes");
CREATE INDEX IF NOT EXISTS "idx_assessment_template_categories" ON "AssessmentTemplate" USING GIN ("questionCategories");
CREATE INDEX IF NOT EXISTS "idx_assessment_template_public" ON "AssessmentTemplate"("isPublic") WHERE "isPublic" = true;

-- Add prediction insights table
CREATE TABLE IF NOT EXISTS "prediction_insights" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "assessment_id" text NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
  "insight_type" text NOT NULL,
  "prediction_data" jsonb NOT NULL,
  "confidence_score" real NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add smart intake features tables
CREATE TABLE IF NOT EXISTS "conditional_question_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "rule_name" text NOT NULL,
  "triggered_by_field" text NOT NULL,
  "condition_logic" jsonb NOT NULL,
  "target_questions" text[] NOT NULL,
  "action_type" text NOT NULL,
  "priority" integer NOT NULL DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "smart_pre_population" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "intake_form_id" text NOT NULL REFERENCES "intake_forms"("id") ON DELETE CASCADE,
  "source_type" text NOT NULL,
  "pre_populated_data" jsonb NOT NULL,
  "confidence_score" real NOT NULL,
  "applied_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "question_dependencies" (
  "id" text PRIMARY KEY NOT NULL,
  "question_id" text NOT NULL,
  "depends_on_questions" text[] NOT NULL,
  "dependency_logic" jsonb NOT NULL,
  "condition_type" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);