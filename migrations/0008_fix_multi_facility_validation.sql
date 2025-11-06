
-- Migration: Fix Multi-Facility Validation Issues
-- Creates UserFacilityScope table and ensures proper primary facility constraints

-- Create UserFacilityScope table for facility-scoped user permissions
CREATE TABLE IF NOT EXISTS "UserFacilityScope" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "facilityId" VARCHAR NOT NULL REFERENCES "FacilityProfile"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'team_member',
  "permissions" TEXT[] DEFAULT '{}',
  "assignedBy" VARCHAR REFERENCES "User"("id"),
  "assignedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "user_facility_scope_user_idx" ON "UserFacilityScope"("userId");
CREATE INDEX IF NOT EXISTS "user_facility_scope_facility_idx" ON "UserFacilityScope"("facilityId");
CREATE INDEX IF NOT EXISTS "user_facility_scope_active_idx" ON "UserFacilityScope"("isActive");

-- Ensure unique user-facility combinations when active
CREATE UNIQUE INDEX IF NOT EXISTS "user_facility_scope_unique_active" 
ON "UserFacilityScope"("userId", "facilityId") 
WHERE "isActive" = true;

-- Add constraint to ensure only one primary facility per tenant when facilities exist
CREATE OR REPLACE FUNCTION check_single_primary_facility()
RETURNS TRIGGER AS $$
DECLARE
  total_active_facilities INTEGER;
BEGIN
  -- Count total active facilities for this tenant
  SELECT COUNT(*) INTO total_active_facilities
  FROM "FacilityProfile" 
  WHERE "tenantId" = NEW."tenantId" AND "isActive" = true;

  IF NEW."isPrimary" = true THEN
    -- Update any existing primary facility to false for this tenant
    UPDATE "FacilityProfile" 
    SET "isPrimary" = false, "updatedAt" = now()
    WHERE "tenantId" = NEW."tenantId" 
      AND "isPrimary" = true 
      AND "id" != NEW."id"
      AND "isActive" = true;
  END IF;
  
  -- Ensure exactly one primary facility when facilities exist (allow zero primary only when total=0)
  IF OLD IS NOT NULL AND OLD."isPrimary" = true AND NEW."isPrimary" = false THEN
    -- Check if there will be any other primary facilities after this change
    IF NOT EXISTS (
      SELECT 1 FROM "FacilityProfile" 
      WHERE "tenantId" = NEW."tenantId" 
        AND "isPrimary" = true 
        AND "id" != NEW."id"
        AND "isActive" = true
    ) THEN
      -- Only allow if this is the last facility being deactivated
      IF NEW."isActive" = true OR total_active_facilities > 1 THEN
        RAISE EXCEPTION 'Exactly one facility must be marked as primary when facilities exist';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single primary facility constraint
DROP TRIGGER IF EXISTS ensure_single_primary_facility ON "FacilityProfile";
CREATE TRIGGER ensure_single_primary_facility
  BEFORE INSERT OR UPDATE ON "FacilityProfile"
  FOR EACH ROW
  EXECUTE FUNCTION check_single_primary_facility();

-- Grant initial facility access to existing users
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
WHERE u."isActive" = true 
  AND fp."isActive" = true
  AND NOT EXISTS (
    SELECT 1 FROM "UserFacilityScope" ufs 
    WHERE ufs."userId" = u."id" AND ufs."facilityId" = fp."id"
  );

COMMENT ON TABLE "UserFacilityScope" IS 'Facility-specific user permissions and role assignments';
COMMENT ON FUNCTION check_single_primary_facility() IS 'Ensures only one primary facility exists per tenant';
