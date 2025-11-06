CREATE TYPE "public"."AssessmentStatus" AS ENUM('DRAFT', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."BusinessEntityType" AS ENUM('CORPORATION', 'LLC', 'PARTNERSHIP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."CertificationType" AS ENUM('INITIAL', 'RECERTIFICATION', 'TRANSFER', 'SCOPE_EXTENSION', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."ComplianceLevel" AS ENUM('NOT_ASSESSED', 'COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE');--> statement-breakpoint
CREATE TYPE "public"."FacilityType" AS ENUM('SINGLE', 'CAMPUS', 'SHARED', 'COMMON_PARENT', 'GROUP', 'UNSURE');--> statement-breakpoint
CREATE TYPE "public"."IntakeStatus" AS ENUM('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."QuestionType" AS ENUM('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'FILE_UPLOAD', 'JSON');--> statement-breakpoint
CREATE TABLE "Answer" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessmentId" varchar NOT NULL,
	"questionId" varchar NOT NULL,
	"value" json NOT NULL,
	"notes" text,
	"evidenceFiles" text[],
	"compliance" "ComplianceLevel" DEFAULT 'NOT_ASSESSED' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Assessment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stdId" varchar NOT NULL,
	"title" text,
	"description" text,
	"status" "AssessmentStatus" DEFAULT 'DRAFT' NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "Clause" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"title" text NOT NULL,
	"stdId" varchar NOT NULL,
	CONSTRAINT "Clause_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE "IntakeAnswer" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intakeFormId" varchar NOT NULL,
	"userId" varchar NOT NULL,
	"assessmentId" varchar,
	"intakeQuestionId" varchar NOT NULL,
	"value" json NOT NULL,
	"notes" text,
	"evidenceFiles" text[],
	"isVerified" boolean DEFAULT false NOT NULL,
	"verifiedBy" varchar,
	"verifiedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "IntakeFacility" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intakeFormId" varchar NOT NULL,
	"facilityNumber" text NOT NULL,
	"nameIdentifier" text,
	"address" text,
	"squareFootage" text,
	"zoning" text,
	"employeesAtLocation" text,
	"shifts" text,
	"primaryFunction" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "IntakeForm" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar NOT NULL,
	"assessmentId" varchar,
	"status" "IntakeStatus" DEFAULT 'DRAFT' NOT NULL,
	"dateOfIntake" timestamp,
	"intakeConductedBy" text,
	"legalCompanyName" text,
	"dbaTradeNames" text,
	"businessEntityType" "BusinessEntityType",
	"taxIdEin" text,
	"yearEstablished" text,
	"primaryBusinessLicense" text,
	"hqStreet" text,
	"hqCity" text,
	"hqStateProvince" text,
	"hqCountry" text,
	"hqPostalCode" text,
	"mainPhone" text,
	"email" text,
	"website" text,
	"primaryR2ContactName" text,
	"primaryR2ContactTitle" text,
	"primaryR2ContactEmail" text,
	"primaryR2ContactPhone" text,
	"topMgmtRepName" text,
	"topMgmtRepTitle" text,
	"topMgmtRepEmail" text,
	"topMgmtRepPhone" text,
	"dataProtectionRepName" text,
	"dataProtectionRepTitle" text,
	"totalFacilities" text,
	"certificationStructureType" "FacilityType",
	"totalEmployees" text,
	"seasonalWorkforceVariations" boolean DEFAULT false NOT NULL,
	"seasonalRangeFrom" text,
	"seasonalRangeTo" text,
	"operatingSchedule" text,
	"languagesSpokenByMgmt" text,
	"ehsmsType" text,
	"ehsmsYear" text,
	"qmsType" text,
	"qmsYear" text,
	"otherCertifications" text,
	"processingActivities" text[],
	"electronicsTypes" text[],
	"monthlyTonnage" text,
	"annualVolume" text,
	"focusMaterials" text[],
	"totalDownstreamVendors" text,
	"numR2CertifiedDsv" text,
	"numNonR2Dsv" text,
	"internationalShipments" boolean DEFAULT false NOT NULL,
	"primaryCountries" text,
	"applicableAppendices" text[],
	"certificationType" "CertificationType",
	"previousR2CertHistory" text,
	"targetTimeline" text,
	"businessDrivers" text,
	"legalComplianceStatus" text,
	"recentViolations" text,
	"seriDeceptivePracticesCheck" text,
	"dataSecurityReadiness" text,
	"estimatedAuditTimeCategory" text,
	"complexityFactors" text[],
	"integrationOpportunities" text,
	"fileClientId" text,
	"cbReference" text,
	"leadAuditor" text,
	"teamMember" text,
	"technicalSpecialist" text,
	"nextStepsRequired" text[],
	"specialConsiderations" text,
	"formCompletedBy" text,
	"signature" text,
	"eligibilityStatus" text,
	"followupRequired" text,
	"priorityLevel" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"submittedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "IntakeQuestion" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionId" text NOT NULL,
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
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "IntakeQuestion_questionId_unique" UNIQUE("questionId")
);
--> statement-breakpoint
CREATE TABLE "QuestionMapping" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intakeQuestionId" varchar NOT NULL,
	"assessmentQuestionId" varchar NOT NULL,
	"recCode" text NOT NULL,
	"mappingLogic" json,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Question" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionId" text NOT NULL,
	"clauseId" varchar NOT NULL,
	"text" text NOT NULL,
	"responseType" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"evidenceRequired" boolean DEFAULT false NOT NULL,
	"appendix" text,
	"weight" real DEFAULT 1 NOT NULL,
	"helpText" text,
	"category" text,
	"category_code" text,
	"category_name" text,
	CONSTRAINT "Question_questionId_unique" UNIQUE("questionId")
);
--> statement-breakpoint
CREATE TABLE "RecMapping" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recCode" text NOT NULL,
	"recName" text NOT NULL,
	"description" text,
	"parentRecCode" text,
	"relatedAppendices" text[],
	"processingRequirements" json,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "RecMapping_recCode_unique" UNIQUE("recCode")
);
--> statement-breakpoint
CREATE TABLE "SmartLogicCondition" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ruleId" varchar NOT NULL,
	"questionMappingId" varchar NOT NULL,
	"triggerQuestionId" varchar NOT NULL,
	"dependentQuestionId" varchar NOT NULL,
	"conditionType" text NOT NULL,
	"expectedValue" json NOT NULL,
	"logicalOperator" text DEFAULT 'AND' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StandardVersion" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	CONSTRAINT "StandardVersion_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "QuestionMapping" ADD CONSTRAINT "QuestionMapping_recCode_RecMapping_recCode_fk" FOREIGN KEY ("recCode") REFERENCES "public"."RecMapping"("recCode") ON DELETE no action ON UPDATE no action;