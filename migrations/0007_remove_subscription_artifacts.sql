
-- Migration to remove subscription artifacts and convert to perpetual licensing
-- This migration updates existing data structures to reflect perpetual licensing

-- Update tenants table to use licenseStatus instead of subscription fields
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'inactive';

-- Migrate existing subscription statuses to license statuses
UPDATE tenants 
SET license_status = CASE 
  WHEN subscription_status = 'active' THEN 'active'
  WHEN subscription_status = 'expired' THEN 'expired'
  ELSE 'inactive'
END
WHERE license_status IS NULL OR license_status = 'inactive';

-- Remove old subscription columns (commented out for safety - uncomment after verification)
-- ALTER TABLE tenants DROP COLUMN IF EXISTS subscription_plan;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS subscription_status;

-- Update any existing licenses to be perpetual (remove expiration dates for standard plans)
UPDATE licenses 
SET expires_at = NULL 
WHERE plan_id IN ('solo', 'team', 'enterprise', 'independent', 'agency', 'enterprise-consultant')
AND expires_at IS NOT NULL;

-- Add index for license status lookups
CREATE INDEX IF NOT EXISTS idx_tenants_license_status ON tenants(license_status);

-- Update any existing feature flag references
UPDATE feature_flags 
SET description = REPLACE(description, 'subscription', 'license')
WHERE description LIKE '%subscription%';

COMMENT ON COLUMN tenants.license_status IS 'Status of perpetual license: active, expired, or inactive';
