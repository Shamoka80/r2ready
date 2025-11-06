
-- Migration: Multi-Facility Foundation
-- Establishes proper 1-to-many tenant->facilities relationship and facility-scoped RBAC

-- Update existing facility profiles to ensure proper tenant relationship
ALTER TABLE "FacilityProfile" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FacilityProfile" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FacilityProfile" ADD COLUMN IF NOT EXISTS "facilityScopeId" VARCHAR;

-- Add facility assignment tracking for users
CREATE TABLE IF NOT EXISTS "UserFacilityScope" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "facilityId" VARCHAR NOT NULL,
  "role" TEXT NOT NULL,
  "permissions" TEXT[] DEFAULT '{}',
  "assignedBy" VARCHAR REFERENCES "User"("id"),
  "assignedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_facility_scope_user_idx" ON "UserFacilityScope"("userId");
CREATE INDEX IF NOT EXISTS "user_facility_scope_facility_idx" ON "UserFacilityScope"("facilityId");
CREATE INDEX IF NOT EXISTS "user_facility_scope_active_idx" ON "UserFacilityScope"("isActive");

-- Update assessments to require facility selection
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "selectedFacilityId" VARCHAR;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "facilityScope" TEXT DEFAULT 'single';

-- Add facility-specific intake form tracking
ALTER TABLE "IntakeForm" ADD COLUMN IF NOT EXISTS "selectedFacilityId" VARCHAR;
ALTER TABLE "IntakeForm" ADD COLUMN IF NOT EXISTS "facilityCount" INTEGER DEFAULT 1;
ALTER TABLE "IntakeForm" ADD COLUMN IF NOT EXISTS "primaryFacilityId" VARCHAR;

-- Create facility management audit trail
CREATE TABLE IF NOT EXISTS "FacilityAuditLog" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" VARCHAR NOT NULL REFERENCES "Tenant"("id"),
  "facilityId" VARCHAR,
  "userId" VARCHAR REFERENCES "User"("id"),
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "oldValues" JSON,
  "newValues" JSON,
  "metadata" JSON,
  "timestamp" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "facility_audit_tenant_time_idx" ON "FacilityAuditLog"("tenantId", "timestamp");
CREATE INDEX IF NOT EXISTS "facility_audit_facility_idx" ON "FacilityAuditLog"("facilityId");

-- Set one facility as primary for existing single-facility tenants
UPDATE "FacilityProfile" 
SET "isPrimary" = true 
WHERE "id" IN (
  SELECT DISTINCT ON ("tenantId") "id" 
  FROM "FacilityProfile" 
  ORDER BY "tenantId", "createdAt" ASC
);

-- Create facility permissions for existing users
INSERT INTO "UserFacilityScope" ("userId", "facilityId", "role", "assignedBy")
SELECT 
  u."id" as "userId",
  fp."id" as "facilityId",
  CASE 
    WHEN u."businessRole" = 'business_owner' THEN 'facility_admin'
    WHEN u."businessRole" = 'facility_manager' THEN 'facility_manager'
    WHEN u."businessRole" = 'compliance_officer' THEN 'compliance_officer'
    ELSE 'team_member'
  END as "role",
  u."id" as "assignedBy"
FROM "User" u
JOIN "FacilityProfile" fp ON u."tenantId" = fp."tenantId"
WHERE NOT EXISTS (
  SELECT 1 FROM "UserFacilityScope" ufs 
  WHERE ufs."userId" = u."id" AND ufs."facilityId" = fp."id"
);

COMMENT ON TABLE "UserFacilityScope" IS 'Facility-specific user permissions and role assignments';
COMMENT ON TABLE "FacilityAuditLog" IS 'Audit trail for facility-specific actions and changes';
