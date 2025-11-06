
-- Migration: Add RBAC and Multi-Tenant Support
-- This migration adds comprehensive RBAC system with multi-tenant isolation

-- Create enums for RBAC system
CREATE TYPE "TenantType" AS ENUM('BUSINESS', 'CONSULTANT');
CREATE TYPE "BusinessRole" AS ENUM('business_owner', 'facility_manager', 'compliance_officer', 'team_member', 'viewer');
CREATE TYPE "ConsultantRole" AS ENUM('consultant_owner', 'lead_consultant', 'associate_consultant', 'client_collaborator');
CREATE TYPE "SessionStatus" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED');

-- Create tenants table for multi-tenant isolation
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "tenantType" "TenantType" NOT NULL,
  "domain" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "subscriptionPlan" TEXT,
  "subscriptionStatus" TEXT DEFAULT 'trial',
  "trialExpiresAt" TIMESTAMP,
  "settings" JSON DEFAULT '{}',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tenant_domain_idx" ON "Tenant"("domain");

-- Create enhanced users table with tenant isolation and RBAC
CREATE TABLE IF NOT EXISTS "User" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" VARCHAR NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "emailVerifiedAt" TIMESTAMP,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "profileImage" TEXT,
  "phone" TEXT,
  "businessRole" "BusinessRole",
  "consultantRole" "ConsultantRole",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP,
  "invitedBy" VARCHAR REFERENCES "User"("id"),
  "invitedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_email_tenant_idx" ON "User"("email", "tenantId");
CREATE INDEX IF NOT EXISTS "user_tenant_idx" ON "User"("tenantId");

-- Create user sessions table
CREATE TABLE IF NOT EXISTS "UserSession" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tenantId" VARCHAR NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "lastActivityAt" TIMESTAMP NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "session_token_idx" ON "UserSession"("sessionToken");
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "UserSession"("userId");
CREATE INDEX IF NOT EXISTS "session_expires_idx" ON "UserSession"("expiresAt");

-- Create permissions table
CREATE TABLE IF NOT EXISTS "Permission" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "permission_resource_action_idx" ON "Permission"("resource", "action");

-- Create role permissions mapping
CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "role" TEXT NOT NULL,
  "permissionId" VARCHAR NOT NULL REFERENCES "Permission"("id"),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "role_permission_idx" ON "RolePermission"("role", "permissionId");

-- Create facility assignments table
CREATE TABLE IF NOT EXISTS "UserFacilityAssignment" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "facilityId" VARCHAR,
  "role" TEXT NOT NULL,
  "assignedBy" VARCHAR REFERENCES "User"("id"),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_facility_idx" ON "UserFacilityAssignment"("userId", "facilityId");

-- Create audit log table
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" VARCHAR NOT NULL REFERENCES "Tenant"("id"),
  "userId" VARCHAR REFERENCES "User"("id"),
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "oldValues" JSON,
  "newValues" JSON,
  "metadata" JSON,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "timestamp" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_tenant_time_idx" ON "AuditLog"("tenantId", "timestamp");
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "AuditLog"("action");

-- Add tenant isolation to existing Assessment table
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "tenantId" VARCHAR REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "createdBy" VARCHAR REFERENCES "User"("id");
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "assignedUsers" VARCHAR[] DEFAULT '{}';
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "facilityId" VARCHAR;

CREATE INDEX IF NOT EXISTS "assessment_tenant_idx" ON "Assessment"("tenantId");
CREATE INDEX IF NOT EXISTS "assessment_created_by_idx" ON "Assessment"("createdBy");

-- Add tenant isolation to existing IntakeForm table
ALTER TABLE "IntakeForm" ADD COLUMN IF NOT EXISTS "tenantId" VARCHAR REFERENCES "Tenant"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "intake_tenant_idx" ON "IntakeForm"("tenantId");

-- Add answeredBy to Answer table for better tracking
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "answeredBy" VARCHAR REFERENCES "User"("id");

-- Insert default permissions for the RBAC system
INSERT INTO "Permission" ("name", "resource", "action", "description") VALUES
-- Account Management
('manage_account', 'account', 'manage', 'Full account management including billing and settings'),
('view_billing', 'billing', 'read', 'View billing information and invoices'),
('manage_billing', 'billing', 'manage', 'Manage billing, payments, and subscriptions'),

-- User Management
('invite_users', 'users', 'create', 'Invite new users to the organization'),
('manage_users', 'users', 'manage', 'Full user management including role assignments'),
('view_users', 'users', 'read', 'View user list and basic information'),
('assign_roles', 'users', 'assign', 'Assign roles to users'),

-- Facility Management
('manage_facilities', 'facilities', 'manage', 'Full facility management'),
('view_facilities', 'facilities', 'read', 'View facility information'),
('assign_facilities', 'facilities', 'assign', 'Assign users to facilities'),

-- Assessment Management
('create_assessments', 'assessments', 'create', 'Create new assessments'),
('manage_assessments', 'assessments', 'manage', 'Full assessment management'),
('complete_assessments', 'assessments', 'update', 'Complete and update assessments'),
('view_assessments', 'assessments', 'read', 'View assessments and progress'),
('delete_assessments', 'assessments', 'delete', 'Delete assessments'),

-- Report Management
('generate_reports', 'reports', 'create', 'Generate assessment reports'),
('view_reports', 'reports', 'read', 'View generated reports'),
('export_reports', 'reports', 'export', 'Export reports in various formats'),

-- Data Management
('export_data', 'data', 'export', 'Export organization data'),
('import_data', 'data', 'create', 'Import data into the system'),

-- Integration Management
('manage_integrations', 'integrations', 'manage', 'Manage API access and integrations'),
('view_integrations', 'integrations', 'read', 'View integration settings'),

-- Audit & Compliance
('view_audit_logs', 'audit_logs', 'read', 'View audit logs and user activity'),
('manage_compliance', 'compliance', 'manage', 'Manage compliance tracking and deadlines'),

-- Branding & White-label
('manage_branding', 'branding', 'manage', 'Manage white-label branding and customization');

-- Insert role permissions for Business roles
INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'business_owner', "id" FROM "Permission";  -- Business owners get all permissions

INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'facility_manager', "id" FROM "Permission" WHERE "name" IN (
  'manage_facilities', 'view_facilities', 'assign_facilities',
  'create_assessments', 'manage_assessments', 'complete_assessments', 'view_assessments',
  'generate_reports', 'view_reports', 'export_reports',
  'invite_users', 'view_users'
);

INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'compliance_officer', "id" FROM "Permission" WHERE "name" IN (
  'complete_assessments', 'view_assessments',
  'view_reports', 'export_reports',
  'manage_compliance'
);

INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'team_member', "id" FROM "Permission" WHERE "name" IN (
  'complete_assessments', 'view_assessments'
);

INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'viewer', "id" FROM "Permission" WHERE "name" IN (
  'view_assessments', 'view_reports'
);

-- Insert role permissions for Consultant roles
INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'consultant_owner', "id" FROM "Permission" WHERE "name" NOT IN ('manage_facilities', 'assign_facilities');

INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'lead_consultant', "id" FROM "Permission" WHERE "name" IN (
  'create_assessments', 'manage_assessments', 'complete_assessments', 'view_assessments',
  'generate_reports', 'view_reports', 'export_reports',
  'invite_users', 'view_users', 'manage_compliance'
);

INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'associate_consultant', "id" FROM "Permission" WHERE "name" IN (
  'complete_assessments', 'view_assessments',
  'view_reports', 'manage_compliance'
);

INSERT INTO "RolePermission" ("role", "permissionId") SELECT 
'client_collaborator', "id" FROM "Permission" WHERE "name" IN (
  'complete_assessments', 'view_assessments', 'view_reports'
);

-- Create superuser tenant for system admins
INSERT INTO "Tenant" ("id", "name", "tenantType", "isActive", "subscriptionStatus") 
VALUES ('system-admin', 'RuR2 System Administration', 'BUSINESS', true, 'enterprise');

-- Create superuser accounts (these bypass normal RBAC)
INSERT INTO "User" ("id", "tenantId", "email", "firstName", "lastName", "businessRole", "isActive", "emailVerified") 
VALUES 
('admin-001', 'system-admin', 'admin@rur2.com', 'Admin', 'User', 'business_owner', true, true),
('test-001', 'system-admin', 'test@example.com', 'Test', 'User', 'business_owner', true, true);

-- Create function to automatically clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions() RETURNS void AS $$
BEGIN
  UPDATE "UserSession" 
  SET "status" = 'EXPIRED' 
  WHERE "expiresAt" < now() AND "status" = 'ACTIVE';
END;
$$ LANGUAGE plpgsql;

-- Create function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_tenant_id VARCHAR,
  p_user_id VARCHAR DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_resource TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_old_values JSON DEFAULT NULL,
  p_new_values JSON DEFAULT NULL,
  p_metadata JSON DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO "AuditLog" (
    "tenantId", "userId", "action", "resource", "resourceId",
    "oldValues", "newValues", "metadata", "ipAddress", "userAgent"
  ) VALUES (
    p_tenant_id, p_user_id, p_action, p_resource, p_resource_id,
    p_old_values, p_new_values, p_metadata, p_ip_address, p_user_agent
  );
END;
$$ LANGUAGE plpgsql;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "user_active_idx" ON "User"("isActive");
CREATE INDEX IF NOT EXISTS "session_active_idx" ON "UserSession"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "assessment_status_idx" ON "Assessment"("status");
CREATE INDEX IF NOT EXISTS "audit_resource_idx" ON "AuditLog"("resource", "resourceId");

COMMENT ON TABLE "Tenant" IS 'Multi-tenant isolation for organizations';
COMMENT ON TABLE "User" IS 'Enhanced users table with RBAC and tenant isolation';
COMMENT ON TABLE "UserSession" IS 'User session management with security tracking';
COMMENT ON TABLE "Permission" IS 'Granular permissions for RBAC system';
COMMENT ON TABLE "RolePermission" IS 'Role to permission mappings';
COMMENT ON TABLE "AuditLog" IS 'Comprehensive audit logging for compliance';
