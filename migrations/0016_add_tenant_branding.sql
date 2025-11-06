
-- Add tenant branding columns for white-label customization
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "brandColorPrimary" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "brandColorSecondary" TEXT;
