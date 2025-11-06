
-- Migration: Add Enterprise Features (Phase 5)
-- Training Center and Advanced Consultant Features

-- Create training status enum
CREATE TYPE training_status AS ENUM ('not_started', 'in_progress', 'completed', 'certified');

-- Training Progress Table
CREATE TABLE IF NOT EXISTS "training_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "module_id" text NOT NULL,
  "status" training_status NOT NULL DEFAULT 'not_started',
  "progress" integer NOT NULL DEFAULT 0,
  "time_spent" integer NOT NULL DEFAULT 0,
  "last_accessed" timestamp NOT NULL DEFAULT now(),
  "assessment_scores" json DEFAULT '{}',
  "certification_date" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Knowledge Base Articles Table
CREATE TABLE IF NOT EXISTS "knowledge_base_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "content" text NOT NULL,
  "category" text NOT NULL,
  "tags" json DEFAULT '[]',
  "difficulty" text NOT NULL,
  "read_time" integer NOT NULL,
  "r2v3_reference" text,
  "is_published" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Certification Preparation Table
CREATE TABLE IF NOT EXISTS "certification_prep" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "overall_progress" integer NOT NULL DEFAULT 0,
  "readiness_score" integer NOT NULL DEFAULT 0,
  "estimated_time_to_ready" integer NOT NULL DEFAULT 0,
  "recommendations" json DEFAULT '[]',
  "next_steps" json DEFAULT '[]',
  "last_updated" timestamp NOT NULL DEFAULT now()
);

-- Consultant-Client Relationships Table
CREATE TABLE IF NOT EXISTS "consultant_clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "consultant_user_id" text NOT NULL,
  "client_tenant_id" text NOT NULL,
  "relationship_type" text NOT NULL DEFAULT 'primary',
  "start_date" timestamp NOT NULL DEFAULT now(),
  "end_date" timestamp,
  "is_active" boolean NOT NULL DEFAULT true,
  "access_level" text NOT NULL DEFAULT 'full',
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- White-Label Reports Table
CREATE TABLE IF NOT EXISTS "white_label_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "consultant_user_id" text NOT NULL,
  "assessment_id" text NOT NULL,
  "report_id" text NOT NULL UNIQUE,
  "branding" json NOT NULL,
  "file_path" text,
  "download_count" integer NOT NULL DEFAULT 0,
  "last_downloaded" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "training_progress_user_id_idx" ON "training_progress"("user_id");
CREATE INDEX IF NOT EXISTS "training_progress_module_id_idx" ON "training_progress"("module_id");
CREATE INDEX IF NOT EXISTS "training_progress_status_idx" ON "training_progress"("status");

CREATE INDEX IF NOT EXISTS "knowledge_base_category_idx" ON "knowledge_base_articles"("category");
CREATE INDEX IF NOT EXISTS "knowledge_base_difficulty_idx" ON "knowledge_base_articles"("difficulty");
CREATE INDEX IF NOT EXISTS "knowledge_base_published_idx" ON "knowledge_base_articles"("is_published");

CREATE INDEX IF NOT EXISTS "certification_prep_user_id_idx" ON "certification_prep"("user_id");

CREATE INDEX IF NOT EXISTS "consultant_clients_consultant_idx" ON "consultant_clients"("consultant_user_id");
CREATE INDEX IF NOT EXISTS "consultant_clients_client_idx" ON "consultant_clients"("client_tenant_id");
CREATE INDEX IF NOT EXISTS "consultant_clients_active_idx" ON "consultant_clients"("is_active");

CREATE INDEX IF NOT EXISTS "white_label_reports_consultant_idx" ON "white_label_reports"("consultant_user_id");
CREATE INDEX IF NOT EXISTS "white_label_reports_assessment_idx" ON "white_label_reports"("assessment_id");
CREATE INDEX IF NOT EXISTS "white_label_reports_report_id_idx" ON "white_label_reports"("report_id");

-- Add foreign key constraints
ALTER TABLE "training_progress" 
ADD CONSTRAINT "training_progress_user_id_fkey" 
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "certification_prep" 
ADD CONSTRAINT "certification_prep_user_id_fkey" 
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "consultant_clients" 
ADD CONSTRAINT "consultant_clients_consultant_user_id_fkey" 
FOREIGN KEY ("consultant_user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "white_label_reports" 
ADD CONSTRAINT "white_label_reports_consultant_user_id_fkey" 
FOREIGN KEY ("consultant_user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "white_label_reports" 
ADD CONSTRAINT "white_label_reports_assessment_id_fkey" 
FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE "training_progress" IS 'Tracks user progress through R2v3 training modules';
COMMENT ON TABLE "knowledge_base_articles" IS 'R2v3 knowledge base articles and resources';
COMMENT ON TABLE "certification_prep" IS 'User certification preparation progress and recommendations';
COMMENT ON TABLE "consultant_clients" IS 'Consultant-client relationship management';
COMMENT ON TABLE "white_label_reports" IS 'White-label report generation and tracking';

COMMENT ON COLUMN "training_progress"."progress" IS 'Completion percentage (0-100)';
COMMENT ON COLUMN "training_progress"."time_spent" IS 'Time spent in minutes';
COMMENT ON COLUMN "knowledge_base_articles"."read_time" IS 'Estimated reading time in minutes';
COMMENT ON COLUMN "certification_prep"."estimated_time_to_ready" IS 'Estimated hours to certification readiness';
