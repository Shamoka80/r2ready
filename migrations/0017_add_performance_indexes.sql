-- Performance Optimization Migration: Database Indexes
-- Phase 3.4: Critical indexes for 400+ questions, 732 REC mappings, and multi-tenant queries
-- Created: 2025-11-05

-- ===================================
-- Questions table indexes (400+ questions)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_questions_category ON "Question"(category);
CREATE INDEX IF NOT EXISTS idx_questions_category_code ON "Question"(category_code);
CREATE INDEX IF NOT EXISTS idx_questions_clause_id ON "Question"("clauseId");
CREATE INDEX IF NOT EXISTS idx_questions_question_id ON "Question"("questionId");
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON "Question"("isActive");
CREATE INDEX IF NOT EXISTS idx_questions_order ON "Question"("order");

-- ===================================
-- QuestionMapping indexes (732 mappings)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_question_mapping_assessment_question_id ON "QuestionMapping"("assessmentQuestionId");
CREATE INDEX IF NOT EXISTS idx_question_mapping_rec_code ON "QuestionMapping"("recCode");

-- ===================================
-- RecMapping indexes (61 REC codes)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_rec_mapping_rec_code ON "RecMapping"("recCode");
CREATE INDEX IF NOT EXISTS idx_rec_mapping_parent_rec_code ON "RecMapping"("parentRecCode");

-- ===================================
-- Assessment indexes (multi-tenant queries)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_assessments_tenant_id ON "Assessment"("tenantId");
CREATE INDEX IF NOT EXISTS idx_assessments_status ON "Assessment"(status);
CREATE INDEX IF NOT EXISTS idx_assessments_facility_id ON "Assessment"("facilityId");
CREATE INDEX IF NOT EXISTS idx_assessments_tenant_status ON "Assessment"("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON "Assessment"("createdAt");
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON "Assessment"("createdBy");
CREATE INDEX IF NOT EXISTS idx_assessments_client_org_id ON "Assessment"("clientOrganizationId");
CREATE INDEX IF NOT EXISTS idx_assessments_client_facility_id ON "Assessment"("clientFacilityId");
CREATE INDEX IF NOT EXISTS idx_assessments_intake_form_id ON "Assessment"("intakeFormId");

-- ===================================
-- Answer indexes (frequent joins)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_answers_assessment_id ON "Answer"("assessmentId");
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON "Answer"("questionId");
CREATE INDEX IF NOT EXISTS idx_answers_composite ON "Answer"("assessmentId", "questionId");
CREATE INDEX IF NOT EXISTS idx_answers_answered_by ON "Answer"("answeredBy");
CREATE INDEX IF NOT EXISTS idx_answers_compliance ON "Answer"(compliance);

-- ===================================
-- User indexes (auth queries)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_users_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON "User"("tenantId");
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON "User"("emailVerified");
CREATE INDEX IF NOT EXISTS idx_users_is_active ON "User"("isActive");
CREATE INDEX IF NOT EXISTS idx_users_business_role ON "User"("businessRole");
CREATE INDEX IF NOT EXISTS idx_users_consultant_role ON "User"("consultantRole");
CREATE INDEX IF NOT EXISTS idx_users_setup_status ON "User"("setupStatus");

-- ===================================
-- UserSession indexes (auth lookups)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON "UserSession"("userId");
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON "UserSession"("tenantId");
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON "UserSession"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON "UserSession"("sessionToken");
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON "UserSession"(status);

-- ===================================
-- Evidence indexes
-- ===================================
CREATE INDEX IF NOT EXISTS idx_evidence_assessment_id ON "EvidenceFile"("assessmentId");
CREATE INDEX IF NOT EXISTS idx_evidence_question_id ON "EvidenceFile"("questionId");
CREATE INDEX IF NOT EXISTS idx_evidence_tenant_id ON "EvidenceFile"("tenantId");
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON "EvidenceFile"("uploadedBy");
CREATE INDEX IF NOT EXISTS idx_evidence_status ON "EvidenceFile"(status);

-- ===================================
-- Facility indexes
-- ===================================
CREATE INDEX IF NOT EXISTS idx_facilities_tenant_id ON "FacilityProfile"("tenantId");
CREATE INDEX IF NOT EXISTS idx_facilities_operating_status ON "FacilityProfile"("operatingStatus");
CREATE INDEX IF NOT EXISTS idx_facilities_is_active ON "FacilityProfile"("isActive");
CREATE INDEX IF NOT EXISTS idx_facilities_is_primary ON "FacilityProfile"("isPrimary");

-- ===================================
-- License indexes
-- ===================================
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON "License"("tenantId");
CREATE INDEX IF NOT EXISTS idx_licenses_is_active ON "License"("isActive");
CREATE INDEX IF NOT EXISTS idx_licenses_purchased_by ON "License"("purchasedBy");
CREATE INDEX IF NOT EXISTS idx_licenses_activated_at ON "License"("activatedAt");

-- ===================================
-- Audit log indexes (compliance queries)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON "AuditLog"("tenantId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_facility_id ON "AuditLog"("facilityId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON "AuditLog"(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON "AuditLog"(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON "AuditLog"(resource);

-- ===================================
-- Tenant indexes
-- ===================================
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_type ON "Tenant"("tenantType");
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON "Tenant"("isActive");
CREATE INDEX IF NOT EXISTS idx_tenants_license_status ON "Tenant"("licenseStatus");

-- ===================================
-- Organization & Client indexes
-- ===================================
CREATE INDEX IF NOT EXISTS idx_org_profiles_tenant_id ON "OrganizationProfile"("tenantId");
CREATE INDEX IF NOT EXISTS idx_client_orgs_tenant_id ON "ClientOrganization"("tenantId");
CREATE INDEX IF NOT EXISTS idx_client_orgs_consultant_tenant_id ON "ClientOrganization"("consultantTenantId");
CREATE INDEX IF NOT EXISTS idx_client_orgs_business_tenant_id ON "ClientOrganization"("businessTenantId");
CREATE INDEX IF NOT EXISTS idx_client_orgs_is_active ON "ClientOrganization"("isActive");
CREATE INDEX IF NOT EXISTS idx_client_facilities_tenant_id ON "ClientFacility"("tenantId");
CREATE INDEX IF NOT EXISTS idx_client_facilities_client_org_id ON "ClientFacility"("clientOrganizationId");
CREATE INDEX IF NOT EXISTS idx_client_facilities_is_active ON "ClientFacility"("isActive");

-- ===================================
-- Review Workflow indexes (consultant features)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_review_workflows_assessment_id ON "ReviewWorkflow"("assessmentId");
CREATE INDEX IF NOT EXISTS idx_review_workflows_client_org_id ON "ReviewWorkflow"("clientOrganizationId");
CREATE INDEX IF NOT EXISTS idx_review_workflows_consultant_tenant_id ON "ReviewWorkflow"("consultantTenantId");
CREATE INDEX IF NOT EXISTS idx_review_workflows_status ON "ReviewWorkflow"(status);
CREATE INDEX IF NOT EXISTS idx_review_workflows_assigned_to ON "ReviewWorkflow"("assignedTo");
CREATE INDEX IF NOT EXISTS idx_review_workflows_due_date ON "ReviewWorkflow"("dueDate");

-- ===================================
-- Intake Form indexes
-- ===================================
CREATE INDEX IF NOT EXISTS idx_intake_forms_tenant_id ON "IntakeForm"("tenantId");
CREATE INDEX IF NOT EXISTS idx_intake_forms_user_id ON "IntakeForm"("userId");
CREATE INDEX IF NOT EXISTS idx_intake_forms_facility_id ON "IntakeForm"("facilityId");
CREATE INDEX IF NOT EXISTS idx_intake_forms_status ON "IntakeForm"(status);

-- ===================================
-- User Facility Scope indexes
-- ===================================
CREATE INDEX IF NOT EXISTS idx_user_facility_scope_user_id ON "UserFacilityScope"("userId");
CREATE INDEX IF NOT EXISTS idx_user_facility_scope_facility_id ON "UserFacilityScope"("facilityId");
CREATE INDEX IF NOT EXISTS idx_user_facility_scope_is_active ON "UserFacilityScope"("isActive");

-- ===================================
-- Permissions and RBAC indexes
-- ===================================
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON "Permission"(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON "Permission"(action);
CREATE INDEX IF NOT EXISTS idx_permissions_is_active ON "Permission"("isActive");
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON "RolePermission"(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON "RolePermission"("permissionId");
CREATE INDEX IF NOT EXISTS idx_role_permissions_facility_id ON "RolePermission"("facilityId");

-- ===================================
-- Observability indexes (monitoring)
-- ===================================
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON "SystemLog"(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON "SystemLog"(service);
CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_id ON "SystemLog"("tenantId");
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON "SystemLog"(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON "ErrorLog"(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_service ON "ErrorLog"(service);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON "ErrorLog"(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_service ON "PerformanceMetric"(service);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON "PerformanceMetric"(timestamp);
