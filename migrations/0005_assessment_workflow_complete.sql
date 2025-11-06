
-- Migration for complete assessment workflow implementation
-- This migration adds the enhanced data model for intake-to-assessment workflow

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS "AssessmentSession";
DROP TABLE IF EXISTS "EvidenceFile";
DROP TABLE IF EXISTS "QuestionMapping";
DROP TABLE IF EXISTS "RecMapping";
DROP TABLE IF EXISTS "IntakeAnswer";
DROP TABLE IF EXISTS "IntakeQuestion";
DROP TABLE IF EXISTS "IntakeFacility";

-- Drop existing enums if they exist
DROP TYPE IF EXISTS "EvidenceType";
DROP TYPE IF EXISTS "EvidenceStatus";
DROP TYPE IF EXISTS "QuestionType";

-- Create new enums
CREATE TYPE "EvidenceType" AS ENUM ('DOCUMENT', 'IMAGE', 'VIDEO', 'CERTIFICATE', 'PROCEDURE', 'RECORD', 'OTHER');
CREATE TYPE "EvidenceStatus" AS ENUM ('UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'FILE_UPLOAD', 'JSON');

-- Add missing columns to existing tables
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "intakeFormId" varchar REFERENCES "IntakeForm"("id");
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "overallScore" real DEFAULT 0;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "compliancePercentage" real DEFAULT 0;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "criticalIssuesCount" integer DEFAULT 0;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "submittedAt" timestamp;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "dueDate" timestamp;

ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "score" real DEFAULT 0;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "maxScore" real DEFAULT 100;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "confidence" text;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "reviewRequired" boolean DEFAULT false;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "reviewedBy" varchar REFERENCES "User"("id");
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "reviewedAt" timestamp;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now();

ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "categoryCode" text;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "categoryName" text;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "tags" text[];
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now();

ALTER TABLE "Clause" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "Clause" ADD COLUMN IF NOT EXISTS "parentClauseId" varchar REFERENCES "Clause"("id");
ALTER TABLE "Clause" ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0;
ALTER TABLE "Clause" ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true;

ALTER TABLE "StandardVersion" ADD COLUMN IF NOT EXISTS "version" text DEFAULT '1.0';
ALTER TABLE "StandardVersion" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "StandardVersion" ADD COLUMN IF NOT EXISTS "effectiveDate" timestamp DEFAULT now();
ALTER TABLE "StandardVersion" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now();

-- Add completion tracking to intake forms
ALTER TABLE "IntakeForm" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "IntakeForm" ADD COLUMN IF NOT EXISTS "completionPercentage" real DEFAULT 0;
ALTER TABLE "IntakeForm" ADD COLUMN IF NOT EXISTS "lastSectionCompleted" text;

-- Create intake questions table
CREATE TABLE "IntakeQuestion" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionId" text UNIQUE NOT NULL,
	"phase" text NOT NULL,
	"section" text,
	"text" text NOT NULL,
	"questionType" "QuestionType" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" json,
	"helpText" text,
	"category" text,
	"recMapping" text[],
	"dependsOnQuestion" varchar,
	"dependsOnValue" json,
	"weight" real DEFAULT 1 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Create intake answers table
CREATE TABLE "IntakeAnswer" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intakeFormId" varchar NOT NULL,
	"userId" varchar NOT NULL,
	"intakeQuestionId" varchar NOT NULL,
	"value" json NOT NULL,
	"notes" text,
	"evidenceFiles" text[],
	"isVerified" boolean DEFAULT false NOT NULL,
	"verifiedBy" varchar,
	"verifiedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "IntakeAnswer_intakeFormId_IntakeForm_id_fk" FOREIGN KEY ("intakeFormId") REFERENCES "IntakeForm"("id") ON DELETE cascade,
	CONSTRAINT "IntakeAnswer_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id"),
	CONSTRAINT "IntakeAnswer_intakeQuestionId_IntakeQuestion_id_fk" FOREIGN KEY ("intakeQuestionId") REFERENCES "IntakeQuestion"("id"),
	CONSTRAINT "IntakeAnswer_verifiedBy_User_id_fk" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id")
);

-- Create REC mapping table
CREATE TABLE "RecMapping" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recCode" text UNIQUE NOT NULL,
	"recName" text NOT NULL,
	"description" text,
	"parentRecCode" text,
	"relatedAppendices" text[],
	"processingRequirements" json,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

-- Create question mapping table
CREATE TABLE "QuestionMapping" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intakeQuestionId" varchar NOT NULL,
	"assessmentQuestionId" varchar NOT NULL,
	"recCode" text NOT NULL,
	"mappingLogic" json,
	"priority" text DEFAULT 'MEDIUM',
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "QuestionMapping_intakeQuestionId_IntakeQuestion_id_fk" FOREIGN KEY ("intakeQuestionId") REFERENCES "IntakeQuestion"("id"),
	CONSTRAINT "QuestionMapping_assessmentQuestionId_Question_id_fk" FOREIGN KEY ("assessmentQuestionId") REFERENCES "Question"("id"),
	CONSTRAINT "QuestionMapping_recCode_RecMapping_recCode_fk" FOREIGN KEY ("recCode") REFERENCES "RecMapping"("recCode")
);

-- Create evidence files table
CREATE TABLE "EvidenceFile" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" varchar NOT NULL,
	"assessmentId" varchar,
	"questionId" varchar,
	"uploadedBy" varchar NOT NULL,
	"originalName" text NOT NULL,
	"fileName" text NOT NULL,
	"filePath" text NOT NULL,
	"mimeType" text NOT NULL,
	"fileSize" integer NOT NULL,
	"evidenceType" "EvidenceType" NOT NULL,
	"status" "EvidenceStatus" DEFAULT 'UPLOADED' NOT NULL,
	"reviewedBy" varchar,
	"reviewedAt" timestamp,
	"reviewNotes" text,
	"sha256Hash" text,
	"encryptionStatus" boolean DEFAULT false,
	"accessLevel" text DEFAULT 'STANDARD',
	"expiresAt" timestamp,
	"retentionPeriod" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EvidenceFile_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE cascade,
	CONSTRAINT "EvidenceFile_assessmentId_Assessment_id_fk" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE cascade,
	CONSTRAINT "EvidenceFile_questionId_Question_id_fk" FOREIGN KEY ("questionId") REFERENCES "Question"("id"),
	CONSTRAINT "EvidenceFile_uploadedBy_User_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id"),
	CONSTRAINT "EvidenceFile_reviewedBy_User_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id")
);

-- Create assessment sessions table for progress tracking
CREATE TABLE "AssessmentSession" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessmentId" varchar NOT NULL,
	"userId" varchar NOT NULL,
	"tenantId" varchar NOT NULL,
	"sessionStart" timestamp DEFAULT now() NOT NULL,
	"sessionEnd" timestamp,
	"durationMinutes" integer,
	"questionsAnswered" integer DEFAULT 0,
	"questionsSkipped" integer DEFAULT 0,
	"evidenceUploaded" integer DEFAULT 0,
	"ipAddress" text,
	"userAgent" text,
	CONSTRAINT "AssessmentSession_assessmentId_Assessment_id_fk" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE cascade,
	CONSTRAINT "AssessmentSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id"),
	CONSTRAINT "AssessmentSession_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "assessment_intake_idx" ON "Assessment" ("intakeFormId");
CREATE INDEX IF NOT EXISTS "assessment_status_idx" ON "Assessment" ("status");
CREATE INDEX IF NOT EXISTS "answer_compliance_idx" ON "Answer" ("compliance");
CREATE INDEX IF NOT EXISTS "question_category_idx" ON "Question" ("categoryCode");
CREATE INDEX IF NOT EXISTS "clause_parent_idx" ON "Clause" ("parentClauseId");
CREATE INDEX IF NOT EXISTS "intake_status_idx" ON "IntakeForm" ("status");
CREATE INDEX IF NOT EXISTS "intake_user_idx" ON "IntakeForm" ("userId");
CREATE INDEX IF NOT EXISTS "evidence_tenant_idx" ON "EvidenceFile" ("tenantId");
CREATE INDEX IF NOT EXISTS "evidence_assessment_idx" ON "EvidenceFile" ("assessmentId");
CREATE INDEX IF NOT EXISTS "evidence_question_idx" ON "EvidenceFile" ("questionId");
CREATE INDEX IF NOT EXISTS "evidence_status_idx" ON "EvidenceFile" ("status");
CREATE INDEX IF NOT EXISTS "evidence_uploaded_by_idx" ON "EvidenceFile" ("uploadedBy");
CREATE INDEX IF NOT EXISTS "session_assessment_user_idx" ON "AssessmentSession" ("assessmentId", "userId");
CREATE INDEX IF NOT EXISTS "session_tenant_idx" ON "AssessmentSession" ("tenantId");

-- Add foreign key constraints that weren't created initially
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'IntakeQuestion_dependsOnQuestion_IntakeQuestion_id_fk') THEN
        ALTER TABLE "IntakeQuestion" ADD CONSTRAINT "IntakeQuestion_dependsOnQuestion_IntakeQuestion_id_fk" FOREIGN KEY ("dependsOnQuestion") REFERENCES "IntakeQuestion"("id");
    END IF;
END $$;
