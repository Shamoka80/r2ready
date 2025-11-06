
-- Migration: Add UserFacilityScope table for facility-scoped user permissions
-- This enables facility-specific role assignments and permissions

CREATE TABLE IF NOT EXISTS "UserFacilityScope" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "facilityId" varchar NOT NULL REFERENCES "FacilityProfile"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'team_member',
  "permissions" jsonb DEFAULT '[]'::jsonb,
  "assignedBy" varchar NOT NULL REFERENCES "User"("id"),
  "isActive" boolean DEFAULT true NOT NULL,
  "assignedAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  
  -- Constraints
  UNIQUE("userId", "facilityId") -- One role per user per facility
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "user_facility_scope_user_idx" ON "UserFacilityScope"("userId");
CREATE INDEX IF NOT EXISTS "user_facility_scope_facility_idx" ON "UserFacilityScope"("facilityId");
CREATE INDEX IF NOT EXISTS "user_facility_scope_active_idx" ON "UserFacilityScope"("isActive");

-- Comments for documentation
COMMENT ON TABLE "UserFacilityScope" IS 'Facility-scoped user role assignments and permissions';
COMMENT ON COLUMN "UserFacilityScope"."role" IS 'Facility-specific role: facility_admin, facility_manager, compliance_officer, team_member, viewer';
COMMENT ON COLUMN "UserFacilityScope"."permissions" IS 'Array of specific permissions for this facility assignment';
