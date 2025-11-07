import { sql, eq } from "drizzle-orm";
import { pgTable, text, varchar, boolean, real, timestamp, json, pgEnum, uuid, index, serial, integer, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === RBAC AND TENANT SYSTEM ===

// Tenant types enum
export const tenantTypeEnum = pgEnum("TenantType", [
  "BUSINESS",
  "CONSULTANT"
]);

// Role enums
export const businessRoleEnum = pgEnum("BusinessRole", [
  "business_owner",
  "facility_manager",
  "compliance_officer",
  "team_member",
  "viewer"
]);

export const consultantRoleEnum = pgEnum("ConsultantRole", [
  "consultant_owner",
  "lead_consultant",
  "associate_consultant",
  "client_collaborator"
]);

// Session status enum
export const sessionStatusEnum = pgEnum("SessionStatus", [
  "ACTIVE",
  "EXPIRED",
  "REVOKED"
]);

// User setup status enum - tracks user journey completion
export const userSetupStatusEnum = pgEnum("UserSetupStatus", [
  "email_pending",
  "setup_pending",
  "setup_complete",
  "assessment_active",
  "reporting_ready",
  "closed"
]);

// Entity type enum for organization profile
export const entityTypeEnum = pgEnum("EntityType", [
  "CORPORATION",
  "LLC",
  "PARTNERSHIP",
  "SOLE_PROPRIETORSHIP",
  "NON_PROFIT",
  "OTHER"
]);

// Processing activity enum for facility baseline
export const processingActivityEnum = pgEnum("ProcessingActivity", [
  "COLLECTION",
  "SORTING",
  "DISASSEMBLY",
  "SHREDDING",
  "RECOVERY",
  "REFURBISHMENT",
  "STORAGE",
  "TRANSPORTATION",
  "OTHER"
]);

// Tenants table - Multi-tenant isolation
export const tenants = pgTable("Tenant", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tenantType: tenantTypeEnum("tenantType").notNull(),
  domain: text("domain"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),

  // License info (formerly subscription)
  licenseStatus: text("licenseStatus").default("inactive").notNull(), // Changed from subscriptionPlan and subscriptionStatus
  // trialExpiresAt is removed as it's not relevant for perpetual licenses

  // White-label branding (Phase 6 - for consultant tiers)
  logoUrl: text("logoUrl"), // URL to uploaded consultant logo
  brandColorPrimary: text("brandColorPrimary"), // Primary brand color (hex code)
  brandColorSecondary: text("brandColorSecondary"), // Secondary brand color (hex code)

  // Settings
  settings: json("settings").default(sql`'{}'::json`),
});

// Enhanced Users table with tenant isolation
export const users: any = pgTable("User", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Auth fields
  email: text("email").notNull(),
  passwordHash: text("passwordHash"),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  emailVerificationToken: text("emailVerificationToken"),
  emailVerificationCode: varchar("emailVerificationCode", { length: 6 }),
  emailVerificationTokenExpiry: timestamp("emailVerificationTokenExpiry"),
  passwordResetToken: text('passwordResetToken'),
  passwordResetTokenExpiry: timestamp('passwordResetTokenExpiry'),

  // Profile fields
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  profileImage: text("profileImage"),
  phone: text("phone"),

  // Role assignments
  businessRole: businessRoleEnum("businessRole"),
  consultantRole: consultantRoleEnum("consultantRole"),

  // Status fields
  isActive: boolean("isActive").default(true).notNull(),
  isTestAccount: boolean("isTestAccount").default(false).notNull(),
  legacyVerified: boolean("legacyVerified").default(false).notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
  invitedBy: varchar("invitedBy").references(() => users.id),
  invitedAt: timestamp("invitedAt"),

  // User journey tracking
  setupStatus: userSetupStatusEnum("setupStatus").default("setup_pending").notNull(),
  setupCompletedAt: timestamp("setupCompletedAt"),

  // Timestamps
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// User Sessions table
export const userSessions = pgTable("UserSession", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  sessionToken: text("sessionToken").notNull().unique(),
  status: sessionStatusEnum("status").default("ACTIVE").notNull(),

  // Session metadata
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  lastActivityAt: timestamp("lastActivityAt").default(sql`now()`).notNull(),

  // Expiration
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Permissions table - Granular permissions
export const permissions = pgTable("Permission", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Role permissions mapping
export const rolePermissions = pgTable("RolePermission", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull(),
  permissionId: varchar("permissionId").notNull().references(() => permissions.id),
  facilityId: varchar("facilityId").references(() => facilityProfiles.id), // Optional: facility-specific permissions
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// User-Facility scope assignments for granular access control
export const userFacilityScope = pgTable("UserFacilityScope", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  facilityId: varchar("facilityId").notNull().references(() => facilityProfiles.id, { onDelete: "cascade" }),

  // Facility-specific role and permissions
  facilityRole: text("facilityRole"), // Facility-specific role (e.g., "facility_manager", "compliance_officer")
  permissions: text("permissions").array().default(sql`'{}'`).notNull(), // Specific permissions for this facility

  // Assignment metadata
  assignedBy: varchar("assignedBy").notNull().references(() => users.id),
  assignedAt: timestamp("assignedAt").default(sql`now()`).notNull(),
  isActive: boolean("isActive").default(true).notNull(),

  // Access level configuration
  canManageUsers: boolean("canManageUsers").default(false).notNull(),
  canManageAssessments: boolean("canManageAssessments").default(true).notNull(),
  canViewReports: boolean("canViewReports").default(true).notNull(),
  canEditFacility: boolean("canEditFacility").default(false).notNull(),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Audit log for RBAC changes
export const auditLog = pgTable("AuditLog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id),
  userId: varchar("userId").references(() => users.id),
  facilityId: varchar("facilityId").references(() => facilityProfiles.id), // Facility context for audit events

  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resourceId"),

  // Changes
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  metadata: json("metadata"),

  // Context
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),

  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
});

// === ORGANIZATION & FACILITY DATA ===

// Organization Profile - Extended tenant information for compliance
export const organizationProfiles = pgTable("OrganizationProfile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Legal entity information
  legalName: text("legalName").notNull(),
  dbaName: text("dbaName"),
  entityType: entityTypeEnum("entityType"), // Optional for streamlined onboarding
  taxId: text("taxId"), // Optional for streamlined onboarding

  // Address information
  hqAddress: text("hqAddress").notNull(),
  hqCity: text("hqCity").notNull(),
  hqState: text("hqState").notNull(),
  hqZipCode: text("hqZipCode").notNull(),
  hqCountry: text("hqCountry").default("US").notNull(),

  // Contact information
  primaryContactName: text("primaryContactName").notNull(),
  primaryContactEmail: text("primaryContactEmail").notNull(),
  primaryContactPhone: text("primaryContactPhone"),
  billingContactName: text("billingContactName"),
  billingContactEmail: text("billingContactEmail"),
  complianceContactName: text("complianceContactName"),
  complianceContactEmail: text("complianceContactEmail"),
  securityContactName: text("securityContactName"),
  securityContactEmail: text("securityContactEmail"),

  // Settings
  timeZone: text("timeZone").default("America/New_York").notNull(),
  logo: text("logo"),
  dataProcessingRegion: text("dataProcessingRegion").default("US").notNull(),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Facility Baseline - Physical facility information
export const facilityProfiles = pgTable("FacilityProfile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Basic facility info
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zipCode").notNull(),
  country: text("country").default("US").notNull(),

  // Operational details
  timeZone: text("timeZone").default("America/New_York").notNull(),
  operatingStatus: text("operatingStatus").default("ACTIVE").notNull(),
  hoursOfOperation: text("hoursOfOperation"),
  headcount: integer("headcount"),
  floorArea: integer("floorArea"),

  // Processing capabilities
  processingActivities: text("processingActivities").array().default(sql`'{}'`).notNull(),
  estimatedAnnualVolume: integer("estimatedAnnualVolume"),
  dataBearingHandling: boolean("dataBearingHandling").default(false).notNull(),
  focusMaterialsPresence: boolean("focusMaterialsPresence").default(false).notNull(),

  // Facility details
  processCells: integer("processCells"),
  storageTypes: text("storageTypes").array().default(sql`'{}'`).notNull(),
  dataSanitizationMethods: text("dataSanitizationMethods").array().default(sql`'{}'`).notNull(),
  repairRefurbCapability: boolean("repairRefurbCapability").default(false).notNull(),
  shreddingCapacity: text("shreddingCapacity"),

  // Multi-facility support
  isPrimary: boolean("isPrimary").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  facilityScopeId: varchar("facilityScopeId"),
  hazardousWasteStorage: boolean("hazardousWasteStorage").default(false).notNull(),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Scope and Applicability Profile - CR1-CR10 and Appendices A-G mapping
export const scopeProfiles = pgTable("ScopeProfile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  facilityId: varchar("facilityId").notNull().references(() => facilityProfiles.id, { onDelete: "cascade" }),

  // Equipment and processes
  equipmentCategories: text("equipmentCategories").array().default(sql`'{}'`).notNull(),
  dataPresent: boolean("dataPresent").default(false).notNull(),
  focusMaterials: boolean("focusMaterials").default(false).notNull(),
  internalProcesses: boolean("internalProcesses").default(true).notNull(),
  contractedProcesses: boolean("contractedProcesses").default(false).notNull(),
  exportMarkets: boolean("exportMarkets").default(false).notNull(),

  // Prior certifications
  priorCertifications: text("priorCertifications").array().default(sql`'{}'`).notNull(),

  // CR mapping (Core Requirements 1-10)
  applicableCR1: boolean("applicableCR1").default(false).notNull(),
  applicableCR2: boolean("applicableCR2").default(false).notNull(),
  applicableCR3: boolean("applicableCR3").default(false).notNull(),
  applicableCR4: boolean("applicableCR4").default(false).notNull(),
  applicableCR5: boolean("applicableCR5").default(false).notNull(),
  applicableCR6: boolean("applicableCR6").default(false).notNull(),
  applicableCR7: boolean("applicableCR7").default(false).notNull(),
  applicableCR8: boolean("applicableCR8").default(false).notNull(),
  applicableCR9: boolean("applicableCR9").default(false).notNull(),
  applicableCR10: boolean("applicableCR10").default(false).notNull(),

  // Appendices mapping (A-G)
  applicableAppA: boolean("applicableAppA").default(false).notNull(),
  applicableAppB: boolean("applicableAppB").default(false).notNull(),
  applicableAppC: boolean("applicableAppC").default(false).notNull(),
  applicableAppD: boolean("applicableAppD").default(false).notNull(),
  applicableAppE: boolean("applicableAppE").default(false).notNull(),
  applicableAppF: boolean("applicableAppF").default(false).notNull(),
  applicableAppG: boolean("applicableAppG").default(false).notNull(),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// License Management - Perpetual license system for one-time purchases
export const licenses = pgTable("License", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // License details
  licenseType: text("licenseType").notNull(), // "base", "facility_pack", "seats", "support_tier"
  planName: text("planName").notNull(), // "R2v3 Base License", "5 Facility Pack", "Premium Support"
  accountType: text("accountType").notNull(), // "business" or "consultant"
  tier: text("tier"), // "solo", "team", "enterprise", "independent", "agency", "enterprise_agency"
  planId: text("planId").notNull(), // Stripe-compatible plan identifier

  // Payment information - One-time purchase tracking
  stripeSessionId: text("stripeSessionId"),
  stripePaymentIntentId: text("stripePaymentIntentId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  amountPaid: integer("amountPaid").notNull(), // Amount in cents
  currency: text("currency").default("USD").notNull(),

  // License status and validity
  status: text("status").default("ACTIVE").notNull(), // ACTIVE, PAST_DUE, CANCELLED, EXPIRED
  isActive: boolean("isActive").default(true).notNull(),
  activatedAt: timestamp("activatedAt").default(sql`now()`).notNull(),
  expiresAt: timestamp("expiresAt"), // NULL for perpetual licenses
  cancelledAt: timestamp("cancelledAt"), // Timestamp when license was cancelled

  // Entitlements - what this license provides
  maxFacilities: integer("maxFacilities"), // Additional facilities allowed
  maxSeats: integer("maxSeats"), // Additional seats allowed
  maxClients: integer("maxClients"), // For consultant tiers - max client businesses
  supportHours: integer("supportHours"), // For support service packages
  features: json("features").default('{}').notNull(), // Feature toggles and limits
  supportTier: text("supportTier"), // "basic", "premium", "enterprise"

  // Pricing and discounts
  originalPrice: integer("originalPrice"), // Original price before discounts
  discountPercent: integer("discountPercent").default(0), // Volume discount applied
  discountAmount: integer("discountAmount").default(0), // Discount amount in cents
  quantity: integer("quantity").default(1), // Quantity purchased for bulk pricing

  // Metadata
  purchasedBy: varchar("purchasedBy").notNull().references(() => users.id),
  notes: text("notes"),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// License Add-ons - Modular add-on purchases
export const licenseAddons = pgTable("LicenseAddon", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  licenseId: varchar("licenseId").references(() => licenses.id, { onDelete: "cascade" }), // Optional: link to base license

  // Add-on details
  addonType: text("addonType").notNull(), // "facility_pack", "seats", "advanced_reporting", "api_access"
  addonName: text("addonName").notNull(),
  quantity: integer("quantity").default(1).notNull(),

  // Payment tracking
  stripeSessionId: text("stripeSessionId"),
  stripePaymentIntentId: text("stripePaymentIntentId"),
  amountPaid: integer("amountPaid").notNull(),
  currency: text("currency").default("USD").notNull(),

  // Status and validity
  isActive: boolean("isActive").default(true).notNull(),
  activatedAt: timestamp("activatedAt").default(sql`now()`).notNull(),
  expiresAt: timestamp("expiresAt"), // NULL for perpetual add-ons

  // Entitlements
  entitlements: json("entitlements").default('{}').notNull(),

  // Metadata
  purchasedBy: varchar("purchasedBy").notNull().references(() => users.id),
  notes: text("notes"),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// License Events - Audit trail for all license-related activities
export const licenseEvents = pgTable("LicenseEvent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  licenseId: varchar("licenseId").references(() => licenses.id, { onDelete: "cascade" }),
  addonId: varchar("addonId").references(() => licenseAddons.id, { onDelete: "cascade" }),

  // Event details
  eventType: text("eventType").notNull(), // "purchase", "activation", "deactivation", "upgrade", "renewal"
  eventDescription: text("eventDescription").notNull(),
  eventData: json("eventData").default('{}').notNull(), // Additional event-specific data

  // Payment tracking
  stripeSessionId: text("stripeSessionId"),
  stripePaymentIntentId: text("stripePaymentIntentId"),
  amount: integer("amount"), // Amount involved in this event (if any)
  currency: text("currency").default("USD"),

  // Context
  triggeredBy: varchar("triggeredBy").references(() => users.id),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),

  // Idempotency
  idempotencyKey: text("idempotencyKey").unique(), // Prevent duplicate events

  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
});

// === OBSERVABILITY AND MONITORING ===

// Log levels enum for system logging
export const logLevelEnum = pgEnum("LogLevel", [
  "debug",
  "info",
  "warn",
  "error",
  "critical"
]);

// Error severity enum
export const errorSeverityEnum = pgEnum("ErrorSeverity", [
  "low",
  "medium",
  "high",
  "critical"
]);

// System logs table - Centralized application logging
export const systemLogs = pgTable("SystemLog", {
  id: serial("id").primaryKey(),
  level: logLevelEnum("level").notNull(),
  message: text("message").notNull(),
  service: text("service").notNull(),
  operation: text("operation"),
  userId: text("userId"),
  sessionId: text("sessionId"),
  tenantId: text("tenantId"),
  metadata: json("metadata").default(sql`'{}'::json`),
  duration: integer("duration"), // in milliseconds
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
});

// Performance metrics table - Application performance tracking
export const performanceMetrics = pgTable("PerformanceMetric", {
  id: serial("id").primaryKey(),
  metricName: text("metricName").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull().default("ms"),
  service: text("service").notNull(),
  operation: text("operation"),
  userId: text("userId"),
  tenantId: text("tenantId"),
  tags: json("tags").default(sql`'{}'::json`),
  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
});

// Error logs table - Detailed error tracking and debugging
export const errorLogs = pgTable("ErrorLog", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  stackTrace: text("stackTrace"),
  service: text("service").notNull(),
  operation: text("operation"),
  userId: text("userId"),
  sessionId: text("sessionId"),
  tenantId: text("tenantId"),
  severity: errorSeverityEnum("severity").notNull().default("medium"),
  metadata: json("metadata").default(sql`'{}'::json`),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
});

// === CONSULTANT CLIENT MANAGEMENT ===

// Review workflow status enum
export const reviewStatusEnum = pgEnum("ReviewStatus", [
  "PENDING_ASSIGNMENT",
  "ASSIGNED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUESTED"
]);

// Decision types enum
export const decisionTypeEnum = pgEnum("DecisionType", [
  "ASSIGNMENT",
  "REVIEW_START",
  "APPROVAL",
  "REJECTION",
  "REVISION_REQUEST",
  "REASSIGNMENT"
]);

// Client Organizations table - For consultants to manage multiple client businesses
export const clientOrganizations = pgTable("ClientOrganization", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  consultantTenantId: varchar("consultantTenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  businessTenantId: varchar("businessTenantId").references(() => tenants.id, { onDelete: "cascade" }),

  // Legal entity information
  legalName: text("legalName").notNull(),
  dbaName: text("dbaName"),
  entityType: entityTypeEnum("entityType"),
  taxId: text("taxId"),

  // Address information
  hqAddress: text("hqAddress").notNull(),
  hqCity: text("hqCity").notNull(),
  hqState: text("hqState").notNull(),
  hqZipCode: text("hqZipCode").notNull(),
  hqCountry: text("hqCountry").default("US").notNull(),

  // Contact information
  primaryContactName: text("primaryContactName").notNull(),
  primaryContactEmail: text("primaryContactEmail").notNull(),
  primaryContactPhone: text("primaryContactPhone"),

  // Status and collaboration
  isActive: boolean("isActive").default(true).notNull(),
  collaborationStatus: text("collaborationStatus").default("ACTIVE").notNull(), // ACTIVE, PAUSED, COMPLETED

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Client Facilities table - Facilities belonging to client organizations
export const clientFacilities = pgTable("ClientFacility", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  clientOrganizationId: varchar("clientOrganizationId").notNull().references(() => clientOrganizations.id, { onDelete: "cascade" }),

  // Basic facility info
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zipCode").notNull(),
  country: text("country").default("US").notNull(),

  // Operational details
  timeZone: text("timeZone").default("America/New_York").notNull(),
  operatingStatus: text("operatingStatus").default("ACTIVE").notNull(),
  hoursOfOperation: text("hoursOfOperation"),
  headcount: integer("headcount"),
  floorArea: integer("floorArea"),

  // Processing capabilities
  processingActivities: text("processingActivities").array().default(sql`'{}'`).notNull(),
  estimatedAnnualVolume: integer("estimatedAnnualVolume"),
  dataBearingHandling: boolean("dataBearingHandling").default(false).notNull(),
  focusMaterialsPresence: boolean("focusMaterialsPresence").default(false).notNull(),

  // Status
  isPrimary: boolean("isPrimary").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Review workflows table - Tracks assignment and review process
export const reviewWorkflows = pgTable("ReviewWorkflow", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessmentId").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  clientOrganizationId: varchar("clientOrganizationId").notNull().references(() => clientOrganizations.id, { onDelete: "cascade" }),
  consultantTenantId: varchar("consultantTenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Assignment details
  assignedBy: varchar("assignedBy").notNull().references(() => users.id),
  assignedTo: varchar("assignedTo").references(() => users.id),
  assignedAt: timestamp("assignedAt"),

  // Current status
  status: reviewStatusEnum("status").default("PENDING_ASSIGNMENT").notNull(),
  priority: text("priority").default("NORMAL").notNull(), // LOW, NORMAL, HIGH, URGENT
  dueDate: timestamp("dueDate"),

  // Review details
  reviewStartedAt: timestamp("reviewStartedAt"),
  reviewCompletedAt: timestamp("reviewCompletedAt"),
  reviewComments: text("reviewComments"),

  // Final decision
  finalDecision: text("finalDecision"), // APPROVED, REJECTED, REVISION_REQUESTED
  decisionReason: text("decisionReason"),
  decisionNotes: text("decisionNotes"),

  // Metadata
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Decision log table - Immutable audit trail of all workflow decisions
export const decisionLog = pgTable("DecisionLog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewWorkflowId: varchar("reviewWorkflowId").notNull().references(() => reviewWorkflows.id, { onDelete: "cascade" }),

  // Decision details
  decisionType: decisionTypeEnum("decisionType").notNull(),
  decisionBy: varchar("decisionBy").notNull().references(() => users.id),
  decisionAt: timestamp("decisionAt").default(sql`now()`).notNull(),

  // Previous and new state
  previousStatus: reviewStatusEnum("previousStatus"),
  newStatus: reviewStatusEnum("newStatus").notNull(),

  // Decision context
  reason: text("reason"),
  comments: text("comments"),
  metadata: json("metadata").default(sql`'{}'::json`),

  // Audit trail
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  sessionId: text("sessionId"),

  // Immutable - no updates or deletes allowed
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Client invitations table - Track consultant invitations to client users
export const clientInvitations = pgTable("ClientInvitation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientOrganizationId: varchar("clientOrganizationId").notNull().references(() => clientOrganizations.id, { onDelete: "cascade" }),
  consultantTenantId: varchar("consultantTenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Invitation details
  invitedBy: varchar("invitedBy").notNull().references(() => users.id),
  invitedEmail: text("invitedEmail").notNull(),
  invitedRole: businessRoleEnum("invitedRole").notNull(),

  // Token and expiration
  invitationToken: text("invitationToken").notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),

  // Status tracking
  status: text("status").default("PENDING").notNull(), // PENDING, ACCEPTED, EXPIRED, REVOKED
  acceptedBy: varchar("acceptedBy").references(() => users.id),
  acceptedAt: timestamp("acceptedAt"),

  // Message customization
  customMessage: text("customMessage"),
  permissions: json("permissions").default(sql`'{}'::json`),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// === ASSESSMENT SYSTEM ===

// Assessment system enums
export const assessmentStatusEnum = pgEnum("AssessmentStatus", [
  "DRAFT",
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "COMPLETED",
  "ARCHIVED"
]);

export const complianceLevelEnum = pgEnum("ComplianceLevel", [
  "NOT_ASSESSED",
  "COMPLIANT",
  "PARTIALLY_COMPLIANT",
  "NON_COMPLIANT",
  "NOT_APPLICABLE"
]);

// Standard versions
export const standardVersions = pgTable("StandardVersion", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  effectiveDate: timestamp("effectiveDate").default(sql`now()`).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Clauses within standards
export const clauses: any = pgTable("Clause", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ref: text("ref").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  stdId: varchar("stdId").notNull().references(() => standardVersions.id),
  parentClauseId: varchar("parentClauseId").references(() => clauses.id),
  order: integer("order").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

// Questions within clauses
export const questions = pgTable("Question", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: text("questionId").notNull().unique(),
  clauseId: varchar("clauseId").notNull().references(() => clauses.id),
  text: text("text").notNull(),
  responseType: text("responseType").notNull().default("yes_no"),
  required: boolean("required").default(false).notNull(),
  evidenceRequired: boolean("evidenceRequired").default(false).notNull(),
  appendix: text("appendix"),
  weight: real("weight").default(1).notNull(),
  helpText: text("helpText"),
  category: text("category"),
  category_code: text("category_code"),
  categoryName: text("category_name"),
  tags: text("tags").array(),
  order: integer("order").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Assessments with tenant isolation
export const assessments = pgTable("Assessment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  createdBy: varchar("createdBy").notNull().references(() => users.id),

  // Assessment metadata
  title: text("title").notNull(),
  description: text("description"),
  stdId: varchar("stdId").notNull().references(() => standardVersions.id),

  // Status and progress
  status: assessmentStatusEnum("status").default("DRAFT").notNull(),
  progress: real("progress").default(0).notNull(),

  // Intake integration
  intakeFormId: varchar("intakeFormId").references(() => intakeForms.id),

  // Access control
  assignedUsers: varchar("assignedUsers").array(),
  facilityId: varchar("facilityId").references(() => facilityProfiles.id),

  // Consultant-specific: Client organization and facility references
  clientOrganizationId: varchar("clientOrganizationId").references(() => clientOrganizations.id),
  clientFacilityId: varchar("clientFacilityId").references(() => clientFacilities.id),

  // Scoring and compliance
  overallScore: real("overallScore").default(0),
  compliancePercentage: real("compliancePercentage").default(0),
  criticalIssuesCount: integer("criticalIssuesCount").default(0),

  // REC mapping and intelligent filtering metadata
  filteringInfo: json("filteringInfo"),

  // Timestamps
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
  submittedAt: timestamp("submittedAt"),
  completedAt: timestamp("completedAt"),
  dueDate: timestamp("dueDate"),
});

// Assessment answers
export const answers = pgTable("Answer", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessmentId").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  questionId: varchar("questionId").notNull().references(() => questions.id),
  answeredBy: varchar("answeredBy").notNull().references(() => users.id),

  // Answer data
  value: json("value").notNull(),
  notes: text("notes"),
  evidenceFiles: text("evidenceFiles").array(),
  compliance: complianceLevelEnum("compliance").default("NOT_ASSESSED").notNull(),

  // Scoring
  score: real("score").default(0),
  maxScore: real("maxScore").default(100),

  // Metadata
  confidence: text("confidence"), // LOW, MEDIUM, HIGH
  reviewRequired: boolean("reviewRequired").default(false),
  reviewedBy: varchar("reviewedBy").references(() => users.id),
  reviewedAt: timestamp("reviewedAt"),

  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
}
// Indexes temporarily disabled due to Drizzle version mismatch
// , (table) => ({
//   assessmentQuestionIdx: index("answer_assessment_question_idx").on(table.assessmentId, table.questionId),
//   answeredByIdx: index("answer_answered_by_idx").on(table.answeredBy),
//   complianceIdx: index("answer_compliance_idx").on(table.compliance),
// })
);

// === INTAKE SYSTEM ===

export const intakeStatusEnum = pgEnum("IntakeStatus", [
  "DRAFT",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED"
]);

export const facilityTypeEnum = pgEnum("FacilityType", [
  "SINGLE",
  "CAMPUS",
  "SHARED",
  "COMMON_PARENT",
  "GROUP",
  "UNSURE"
]);

export const businessEntityTypeEnum = pgEnum("BusinessEntityType", [
  "CORPORATION",
  "LLC",
  "PARTNERSHIP",
  "OTHER"
]);

export const certificationTypeEnum = pgEnum("CertificationType", [
  "INITIAL",
  "RECERTIFICATION",
  "TRANSFER",
  "SCOPE_EXTENSION",
  "OTHER"
]);

// Intake forms with tenant isolation
export const intakeForms = pgTable("IntakeForm", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("userId").notNull().references(() => users.id),
  facilityId: varchar("facilityId").references(() => facilityProfiles.id),
  status: intakeStatusEnum("status").default("DRAFT").notNull(),

  // Form metadata
  title: text("title"),
  formData: json("formData").default(sql`'{}'::json`),
  submittedBy: varchar("submittedBy").references(() => users.id),
  dateOfIntake: timestamp("dateOfIntake"),
  intakeConductedBy: text("intakeConductedBy"),
  submittedAt: timestamp("submittedAt"),

  // Organization info
  legalCompanyName: text("legalCompanyName"),
  dbaTradeNames: text("dbaTradeNames"),
  businessEntityType: businessEntityTypeEnum("businessEntityType"),
  taxIdEin: text("taxIdEin"),
  yearEstablished: text("yearEstablished"),

  // Address
  hqStreet: text("hqStreet"),
  hqCity: text("hqCity"),
  hqStateProvince: text("hqStateProvince"),
  hqCountry: text("hqCountry"),
  hqPostalCode: text("hqPostalCode"),

  // Contact info
  mainPhone: text("mainPhone"),
  email: text("email"),
  website: text("website"),

  // Key personnel
  primaryR2ContactName: text("primaryR2ContactName"),
  primaryR2ContactTitle: text("primaryR2ContactTitle"),
  primaryR2ContactEmail: text("primaryR2ContactEmail"),
  primaryR2ContactPhone: text("primaryR2ContactPhone"),

  // Operations
  totalFacilities: text("totalFacilities"),
  certificationStructureType: facilityTypeEnum("certificationStructureType"),
  totalEmployees: text("totalEmployees"),
  operatingSchedule: text("operatingSchedule"),

  // Processing activities
  processingActivities: text("processingActivities").array(),
  electronicsTypes: text("electronicsTypes").array(),
  equipment: text("equipment").array(),
  monthlyTonnage: text("monthlyTonnage"),
  focusMaterials: text("focusMaterials").array(),

  // Supply chain
  totalDownstreamVendors: text("totalDownstreamVendors"),
  internationalShipments: boolean("internationalShipments").default(false),
  primaryCountries: text("primaryCountries"),

  // R2v3 appendices
  applicableAppendices: text("applicableAppendices").array(),

  // Certification objectives
  certificationType: certificationTypeEnum("certificationType"),
  previousR2CertHistory: text("previousR2CertHistory"),
  targetTimeline: text("targetTimeline"),

  // Initial Compliance Status (Section 10)
  legalComplianceStatus: text("legalComplianceStatus"),
  recentViolations: text("recentViolations"),
  seriDeceptivePracticsCheck: text("seriDeceptivePracticesCheck"),
  dataSecurityReadiness: text("dataSecurityReadiness"),

  // Completion tracking
  completionPercentage: real("completionPercentage").default(0),
  lastSectionCompleted: text("lastSectionCompleted"),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Intake facilities
export const intakeFacilities = pgTable("IntakeFacility", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intakeFormId: varchar("intakeFormId").notNull().references(() => intakeForms.id, { onDelete: "cascade" }),
  facilityNumber: text("facilityNumber").notNull(),
  nameIdentifier: text("nameIdentifier"),
  address: text("address"),
  squareFootage: text("squareFootage"),
  zoning: text("zoning"),
  employeesAtLocation: text("employeesAtLocation"),
  shifts: text("shifts"),
  primaryFunction: text("primaryFunction"),

  // Processing data for facility-level REC mapping (inherited from intake-level data)
  processingActivities: text("processingActivities").array(),
  equipment: text("equipment").array(),
  electronicsTypes: text("electronicsTypes").array(),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// === EVIDENCE MANAGEMENT ===

export const evidenceTypeEnum = pgEnum("EvidenceType", [
  "DOCUMENT",
  "IMAGE",
  "VIDEO",
  "CERTIFICATE",
  "PROCEDURE",
  "RECORD",
  "OTHER"
]);

export const evidenceStatusEnum = pgEnum("EvidenceStatus", [
  "UPLOADED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED"
]);

// Evidence files
export const evidenceFiles = pgTable("EvidenceFile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: varchar("assessmentId").references(() => assessments.id, { onDelete: "cascade" }),
  questionId: varchar("questionId").references(() => questions.id),
  uploadedBy: varchar("uploadedBy").notNull().references(() => users.id),

  // File metadata
  originalName: text("originalName").notNull(),
  fileName: text("fileName").notNull(),
  filePath: text("filePath").notNull(),
  mimeType: text("mimeType").notNull(),
  fileSize: integer("fileSize").notNull(),

  // Evidence classification
  evidenceType: evidenceTypeEnum("evidenceType").notNull(),
  status: evidenceStatusEnum("status").default("UPLOADED").notNull(),

  // Review tracking
  reviewedBy: varchar("reviewedBy").references(() => users.id),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),

  // Security and integrity
  sha256Hash: text("sha256Hash"),
  encryptionStatus: boolean("encryptionStatus").default(false),
  accessLevel: text("accessLevel").default("STANDARD"),

  // Expiration and retention
  expiresAt: timestamp("expiresAt"),
  retentionPeriod: integer("retentionPeriod"), // in days

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// === QUESTION FILTERING SYSTEM ===

export const questionTypeEnum = pgEnum("QuestionType", [
  "TEXT",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "CHECKBOX",
  "FILE_UPLOAD",
  "JSON"
]);

// Intake questions
export const intakeQuestions = pgTable("IntakeQuestion", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: text("questionId").notNull().unique(),
  phase: text("phase").notNull(),
  section: text("section"),
  text: text("text").notNull(),
  questionType: questionTypeEnum("questionType").notNull(),
  required: boolean("required").default(false).notNull(),
  options: json("options"),
  helpText: text("helpText"),
  category: text("category"),
  recMapping: text("recMapping").array(),
  dependsOnQuestion: varchar("dependsOnQuestion"),
  dependsOnValue: json("dependsOnValue"),
  weight: real("weight").default(1).notNull(),
  order: integer("order").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Intake answers
export const intakeAnswers = pgTable("IntakeAnswer", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intakeFormId: varchar("intakeFormId").notNull().references(() => intakeForms.id, { onDelete: "cascade" }),
  userId: varchar("userId").notNull().references(() => users.id),
  intakeQuestionId: varchar("intakeQuestionId").notNull().references(() => intakeQuestions.id),
  value: json("value").notNull(),
  notes: text("notes"),
  evidenceFiles: text("evidenceFiles").array(),
  isVerified: boolean("isVerified").default(false).notNull(),
  verifiedBy: varchar("verifiedBy").references(() => users.id),
  verifiedAt: timestamp("verifiedAt"),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// REC (Requirement Element Code) mapping
export const recMapping = pgTable("RecMapping", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recCode: text("recCode").notNull().unique(),
  recName: text("recName").notNull(),
  description: text("description"),
  parentRecCode: text("parentRecCode"),
  relatedAppendices: text("relatedAppendices").array(),
  processingRequirements: json("processingRequirements"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Question mapping for intelligent filtering
export const questionMapping = pgTable("QuestionMapping", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intakeQuestionId: varchar("intakeQuestionId").notNull().references(() => intakeQuestions.id),
  assessmentQuestionId: varchar("assessmentQuestionId").notNull().references(() => questions.id),
  recCode: text("recCode").notNull().references(() => recMapping.recCode),
  mappingLogic: json("mappingLogic"),
  priority: text("priority").default("MEDIUM"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
}, (table) => ({
  uniqueQuestionRecMapping: uniqueIndex("unique_question_rec_mapping")
    .on(table.assessmentQuestionId, table.recCode),
}));


// Evidence Objects - Hardened evidence storage with integrity features
export const evidenceObjects = pgTable("EvidenceObject", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  facilityId: varchar("facilityId").notNull().references(() => facilityProfiles.id, { onDelete: "cascade" }),
  createdBy: varchar("createdBy").notNull().references(() => users.id),

  // File integrity
  checksum: text("checksum").notNull(), // SHA-256 hash
  size: integer("size").notNull(), // File size in bytes
  mime: text("mime").notNull(), // MIME type
  storageUri: text("storageUri").notNull(), // Immutable storage path

  // Metadata
  originalName: text("originalName").notNull(),
  description: text("description"),

  // Security and compliance
  scanStatus: text("scanStatus").default("pending").notNull(), // "pending", "clean", "infected", "failed"
  scanResults: json("scanResults"),
  accessLevel: text("accessLevel").default("standard").notNull(),

  // References
  assessmentId: varchar("assessmentId").references(() => assessments.id),
  questionId: varchar("questionId").references(() => questions.id),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// === PHASE 5: SECURITY AND SESSION HARDENING ===

// Two-Factor Authentication table
export const userTwoFactorAuth = pgTable("UserTwoFactorAuth", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),

  // TOTP Configuration
  secret: text("secret").notNull(), // Base32 encoded TOTP secret
  backupCodes: text("backupCodes").array().default(sql`'{}'`).notNull(), // Array of hashed backup codes
  isEnabled: boolean("isEnabled").default(false).notNull(),

  // Recovery
  usedBackupCodes: text("usedBackupCodes").array().default(sql`'{}'`).notNull(),

  // Metadata
  qrCodeUrl: text("qrCodeUrl"), // Temporary QR code URL for setup
  setupCompletedAt: timestamp("setupCompletedAt"),
  lastUsedAt: timestamp("lastUsedAt"),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Device management for session tracking
export const userDevices = pgTable("UserDevice", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Device identification
  deviceFingerprint: text("deviceFingerprint").notNull().unique(), // Hash of device characteristics
  deviceName: text("deviceName"), // User-assigned device name
  deviceType: text("deviceType"), // "desktop", "mobile", "tablet"

  // Browser/OS info
  userAgent: text("userAgent").notNull(),
  ipAddress: text("ipAddress").notNull(),
  platform: text("platform"), // "Windows", "macOS", "iOS", etc.
  browser: text("browser"), // "Chrome", "Safari", "Firefox", etc.

  // Trust and security
  isTrusted: boolean("isTrusted").default(false).notNull(),
  isRevoked: boolean("isRevoked").default(false).notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedBy: varchar("revokedBy").references(() => users.id),
  revokeReason: text("revokeReason"),

  // Activity tracking
  firstSeenAt: timestamp("firstSeenAt").default(sql`now()`).notNull(),
  lastSeenAt: timestamp("lastSeenAt").default(sql`now()`).notNull(),
  loginCount: integer("loginCount").default(1).notNull(),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// Enhanced session management with refresh tokens
export const refreshTokens = pgTable("RefreshToken", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("sessionId").notNull().references(() => userSessions.id, { onDelete: "cascade" }),
  deviceId: varchar("deviceId").references(() => userDevices.id, { onDelete: "cascade" }),

  // Token data
  tokenHash: text("tokenHash").notNull().unique(), // SHA-256 hash of the refresh token
  jti: text("jti").notNull().unique(), // JWT ID for tracking

  // Token lifecycle
  isRevoked: boolean("isRevoked").default(false).notNull(),
  revokedAt: timestamp("revokedAt"),
  revokeReason: text("revokeReason"),

  // Security tracking
  ipAddress: text("ipAddress").notNull(),
  userAgent: text("userAgent").notNull(),
  lastUsedAt: timestamp("lastUsedAt").default(sql`now()`).notNull(),
  useCount: integer("useCount").default(0).notNull(),

  // Expiration
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Rate limiting and security tracking
export const rateLimitEvents = pgTable("RateLimitEvent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Rate limit identification
  identifier: text("identifier").notNull(), // IP address, user ID, or API key
  identifierType: text("identifierType").notNull(), // "ip", "user", "api_key"
  resource: text("resource").notNull(), // "auth", "exports", "uploads", etc.
  action: text("action").notNull(), // "login", "export_pdf", "upload_evidence", etc.

  // Request details
  ipAddress: text("ipAddress").notNull(),
  userAgent: text("userAgent"),
  userId: varchar("userId").references(() => users.id),

  // Rate limiting result
  isBlocked: boolean("isBlocked").default(false).notNull(),
  currentCount: integer("currentCount").notNull(),
  maxAllowed: integer("maxAllowed").notNull(),
  windowSize: integer("windowSize").notNull(), // In seconds
  resetAt: timestamp("resetAt").notNull(),

  // Request metadata
  endpoint: text("endpoint"), // Full API endpoint
  method: text("method"), // HTTP method
  statusCode: integer("statusCode"),
  responseTime: integer("responseTime"), // In milliseconds

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Security audit log for sensitive operations
export const securityAuditLog = pgTable("SecurityAuditLog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Event identification
  eventType: text("eventType").notNull(), // "2fa_enabled", "device_revoked", "password_changed", etc.
  severity: text("severity").notNull(), // "info", "warning", "critical"

  // Actor information
  userId: varchar("userId").references(() => users.id),
  sessionId: varchar("sessionId").references(() => userSessions.id),
  deviceId: varchar("deviceId").references(() => userDevices.id),

  // Target information (what was affected)
  targetUserId: varchar("targetUserId").references(() => users.id),
  targetResourceType: text("targetResourceType"), // "user", "device", "session", etc.
  targetResourceId: text("targetResourceId"),

  // Request context
  ipAddress: text("ipAddress").notNull(),
  userAgent: text("userAgent"),
  endpoint: text("endpoint"),
  method: text("method"),

  // Event details
  description: text("description").notNull(),
  metadata: json("metadata").default(sql`'{}'::json`),

  // Security context
  riskScore: real("riskScore"), // 0.0 to 1.0 risk assessment
  isSuccessful: boolean("isSuccessful").default(true).notNull(),
  errorMessage: text("errorMessage"),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
});

// Cloud storage provider enum for user-owned storage
export const cloudStorageProviderEnum = pgEnum("CloudStorageProvider", [
  "google_drive",
  "onedrive",
  "dropbox",
  "azure_blob"
]);

// User cloud storage connections for user-owned storage
export const userCloudStorageConnections = pgTable("UserCloudStorageConnection", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Provider details
  provider: cloudStorageProviderEnum("provider").notNull(),
  providerUserId: text("providerUserId"), // User's ID at the provider
  providerEmail: text("providerEmail"), // User's email at the provider

  // OAuth tokens (encrypted)
  accessToken: text("accessToken").notNull(), // Encrypted access token
  refreshToken: text("refreshToken"), // Encrypted refresh token
  tokenExpiresAt: timestamp("tokenExpiresAt"),

  // Storage configuration
  folderPath: text("folderPath").default("/RUR2_Evidence").notNull(), // Where to store files
  isDefault: boolean("isDefault").default(false).notNull(), // Is this the user's default provider
  isActive: boolean("isActive").default(true).notNull(),

  // Quota tracking
  quotaUsed: real("quotaUsed").default(0),
  quotaLimit: real("quotaLimit"),
  lastQuotaCheck: timestamp("lastQuotaCheck"),

  // Connection health
  lastSuccessfulConnection: timestamp("lastSuccessfulConnection").default(sql`now()`).notNull(),
  lastFailedConnection: timestamp("lastFailedConnection"),
  failureCount: integer("failureCount").default(0).notNull(),
  lastErrorMessage: text("lastErrorMessage"),

  createdAt: timestamp("createdAt").default(sql`now()`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`now()`).notNull(),
});

// === REPORTING AND ANALYTICS ===

// Assessment sessions for progress tracking
export const assessmentSessions = pgTable("AssessmentSession", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessmentId").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  userId: varchar("userId").notNull().references(() => users.id),
  tenantId: varchar("tenantId").notNull().references(() => tenants.id),

  sessionStart: timestamp("sessionStart").default(sql`now()`).notNull(),
  sessionEnd: timestamp("sessionEnd"),
  durationMinutes: integer("durationMinutes"),

  questionsAnswered: integer("questionsAnswered").default(0),
  questionsSkipped: integer("questionsSkipped").default(0),
  evidenceUploaded: integer("evidenceUploaded").default(0),

  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
});

// === RELATIONS ===

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  assessments: many(assessments),
  intakeForms: many(intakeForms),
  sessions: many(userSessions),
  auditLogs: many(auditLog),
  evidenceFiles: many(evidenceFiles),
  clientOrganizations: many(clientOrganizations),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  invitedByUser: one(users, {
    fields: [users.invitedBy],
    references: [users.id],
  }),
  sessions: many(userSessions),
  assessments: many(assessments),
  answers: many(answers),
  intakeForms: many(intakeForms),
  intakeAnswers: many(intakeAnswers),
  evidenceFiles: many(evidenceFiles),
  assessmentSessions: many(assessmentSessions),
  twoFactorAuth: one(userTwoFactorAuth),
  devices: many(userDevices),
  refreshTokens: many(refreshTokens),
  securityAuditLogs: many(securityAuditLog),
}));

export const standardVersionsRelations = relations(standardVersions, ({ many }) => ({
  clauses: many(clauses),
  assessments: many(assessments),
}));

export const clausesRelations = relations(clauses, ({ one, many }) => ({
  standard: one(standardVersions, {
    fields: [clauses.stdId],
    references: [standardVersions.id],
  }),
  parentClause: one(clauses, {
    fields: [clauses.parentClauseId],
    references: [clauses.id],
  }),
  childClauses: many(clauses),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  clause: one(clauses, {
    fields: [questions.clauseId],
    references: [clauses.id],
  }),
  answers: many(answers),
  evidenceFiles: many(evidenceFiles),
  questionMappings: many(questionMapping),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [assessments.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [assessments.createdBy],
    references: [users.id],
  }),
  standard: one(standardVersions, {
    fields: [assessments.stdId],
    references: [standardVersions.id],
  }),
  intakeForm: one(intakeForms, {
    fields: [assessments.intakeFormId],
    references: [intakeForms.id],
  }),
  clientOrganization: one(clientOrganizations, {
    fields: [assessments.clientOrganizationId],
    references: [clientOrganizations.id],
  }),
  clientFacility: one(clientFacilities, {
    fields: [assessments.clientFacilityId],
    references: [clientFacilities.id],
  }),
  answers: many(answers),
  evidenceFiles: many(evidenceFiles),
  sessions: many(assessmentSessions),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  assessment: one(assessments, {
    fields: [answers.assessmentId],
    references: [assessments.id],
  }),
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
  answeredByUser: one(users, {
    fields: [answers.answeredBy],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [answers.reviewedBy],
    references: [users.id],
  }),
}));

export const intakeFormsRelations = relations(intakeForms, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [intakeForms.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [intakeForms.userId],
    references: [users.id],
  }),
  facilities: many(intakeFacilities),
  intakeAnswers: many(intakeAnswers),
  assessments: many(assessments),
}));

export const intakeFacilitiesRelations = relations(intakeFacilities, ({ one }) => ({
  intakeForm: one(intakeForms, {
    fields: [intakeFacilities.intakeFormId],
    references: [intakeForms.id],
  }),
}));

export const intakeQuestionsRelations = relations(intakeQuestions, ({ one, many }) => ({
  dependsOnQuestion: one(intakeQuestions, {
    fields: [intakeQuestions.dependsOnQuestion],
    references: [intakeQuestions.id],
  }),
  intakeAnswers: many(intakeAnswers),
  questionMappings: many(questionMapping),
}));

export const intakeAnswersRelations = relations(intakeAnswers, ({ one }) => ({
  intakeForm: one(intakeForms, {
    fields: [intakeAnswers.intakeFormId],
    references: [intakeForms.id],
  }),
  user: one(users, {
    fields: [intakeAnswers.userId],
    references: [users.id],
  }),
  intakeQuestion: one(intakeQuestions, {
    fields: [intakeAnswers.intakeQuestionId],
    references: [intakeQuestions.id],
  }),
  verifiedByUser: one(users, {
    fields: [intakeAnswers.verifiedBy],
    references: [users.id],
  }),
}));

export const evidenceFilesRelations = relations(evidenceFiles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [evidenceFiles.tenantId],
    references: [tenants.id],
  }),
  assessment: one(assessments, {
    fields: [evidenceFiles.assessmentId],
    references: [assessments.id],
  }),
  question: one(questions, {
    fields: [evidenceFiles.questionId],
    references: [questions.id],
  }),
  uploadedByUser: one(users, {
    fields: [evidenceFiles.uploadedBy],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [evidenceFiles.reviewedBy],
    references: [users.id],
  }),
}));

export const questionMappingRelations = relations(questionMapping, ({ one }) => ({
  intakeQuestion: one(intakeQuestions, {
    fields: [questionMapping.intakeQuestionId],
    references: [intakeQuestions.id],
  }),
  assessmentQuestion: one(questions, {
    fields: [questionMapping.assessmentQuestionId],
    references: [questions.id],
  }),
  recMappingRef: one(recMapping, {
    fields: [questionMapping.recCode],
    references: [recMapping.recCode],
  }),
}));

export const recMappingRelations = relations(recMapping, ({ one, many }) => ({
  parent: one(recMapping, {
    fields: [recMapping.parentRecCode],
    references: [recMapping.recCode],
  }),
  children: many(recMapping),
  questionMappings: many(questionMapping),
}));

// Client Organizations relations
export const clientOrganizationsRelations = relations(clientOrganizations, ({ one, many }) => ({
  consultantTenant: one(tenants, {
    fields: [clientOrganizations.consultantTenantId],
    references: [tenants.id],
  }),
  clientFacilities: many(clientFacilities),
}));

// Client Facilities relations
export const clientFacilitiesRelations = relations(clientFacilities, ({ one }) => ({
  clientOrganization: one(clientOrganizations, {
    fields: [clientFacilities.clientOrganizationId],
    references: [clientOrganizations.id],
  }),
}));

// License relations
export const licensesRelations = relations(licenses, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [licenses.tenantId],
    references: [tenants.id],
  }),
  addons: many(licenseAddons),
  events: many(licenseEvents),
}));

// License Addons relations
export const licenseAddonsRelations = relations(licenseAddons, ({ one }) => ({
  license: one(licenses, {
    fields: [licenseAddons.licenseId],
    references: [licenses.id],
  }),
  tenant: one(tenants, {
    fields: [licenseAddons.tenantId],
    references: [tenants.id],
  }),
}));

// License Events relations
export const licenseEventsRelations = relations(licenseEvents, ({ one }) => ({
  license: one(licenses, {
    fields: [licenseEvents.licenseId],
    references: [licenses.id],
  }),
  tenant: one(tenants, {
    fields: [licenseEvents.tenantId],
    references: [tenants.id],
  }),
  triggeredByUser: one(users, {
    fields: [licenseEvents.triggeredBy],
    references: [users.id],
  }),
}));

// Evidence Objects relations
export const evidenceObjectsRelations = relations(evidenceObjects, ({ one }) => ({
  facility: one(facilityProfiles, {
    fields: [evidenceObjects.facilityId],
    references: [facilityProfiles.id],
  }),
  createdByUser: one(users, {
    fields: [evidenceObjects.createdBy],
    references: [users.id],
  }),
  assessment: one(assessments, {
    fields: [evidenceObjects.assessmentId],
    references: [assessments.id],
  }),
  question: one(questions, {
    fields: [evidenceObjects.questionId],
    references: [questions.id],
  }),
}));

// === PHASE 5 SECURITY RELATIONS ===

// Two-Factor Authentication relations
export const userTwoFactorAuthRelations = relations(userTwoFactorAuth, ({ one }) => ({
  user: one(users, {
    fields: [userTwoFactorAuth.userId],
    references: [users.id],
  }),
}));

// User Device relations
export const userDevicesRelations = relations(userDevices, ({ one, many }) => ({
  user: one(users, {
    fields: [userDevices.userId],
    references: [users.id],
  }),
  revokedByUser: one(users, {
    fields: [userDevices.revokedBy],
    references: [users.id],
  }),
  refreshTokens: many(refreshTokens),
}));

// Refresh Token relations
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
  session: one(userSessions, {
    fields: [refreshTokens.sessionId],
    references: [userSessions.id],
  }),
  device: one(userDevices, {
    fields: [refreshTokens.deviceId],
    references: [userDevices.id],
  }),
}));

// Rate Limit Events relations
export const rateLimitEventsRelations = relations(rateLimitEvents, ({ one }) => ({
  user: one(users, {
    fields: [rateLimitEvents.userId],
    references: [users.id],
  }),
}));

// Security Audit Log relations
export const securityAuditLogRelations = relations(securityAuditLog, ({ one }) => ({
  user: one(users, {
    fields: [securityAuditLog.userId],
    references: [users.id],
  }),
  targetUser: one(users, {
    fields: [securityAuditLog.targetUserId],
    references: [users.id],
  }),
  session: one(userSessions, {
    fields: [securityAuditLog.sessionId],
    references: [userSessions.id],
  }),
  device: one(userDevices, {
    fields: [securityAuditLog.deviceId],
    references: [userDevices.id],
  }),
}));

// User Cloud Storage Connection relations
export const userCloudStorageConnectionsRelations = relations(userCloudStorageConnections, ({ one }) => ({
  user: one(users, {
    fields: [userCloudStorageConnections.userId],
    references: [users.id],
  }),
}));

// === ZOD SCHEMAS ===

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntakeFormSchema = createInsertSchema(intakeForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnswerSchema = createInsertSchema(answers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvidenceFileSchema = createInsertSchema(evidenceFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// New table schemas for user journey
export const insertOrganizationProfileSchema = createInsertSchema(organizationProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFacilityProfileSchema = createInsertSchema(facilityProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScopeProfileSchema = createInsertSchema(scopeProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLicenseSchema = createInsertSchema(licenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Client organization schemas
export const insertClientOrganizationSchema = createInsertSchema(clientOrganizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientFacilitySchema = createInsertSchema(clientFacilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// License add-on schemas
export const insertLicenseAddonSchema = createInsertSchema(licenseAddons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntakeFacilitySchema = createInsertSchema(intakeFacilities).omit({
  id: true,
  facilityNumber: true,
  createdAt: true,
});

// License event schemas
export const insertLicenseEventSchema = createInsertSchema(licenseEvents).omit({
  id: true,
  timestamp: true,
});

export const insertEvidenceObjectSchema = createInsertSchema(evidenceObjects).omit({
  id: true,
  createdAt: true,
});

// === PHASE 5 SECURITY SCHEMAS ===

// Two-Factor Authentication schemas
export const insertUserTwoFactorAuthSchema = createInsertSchema(userTwoFactorAuth).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User Device schemas
export const insertUserDeviceSchema = createInsertSchema(userDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Refresh Token schemas
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

// Rate Limit Event schemas
export const insertRateLimitEventSchema = createInsertSchema(rateLimitEvents).omit({
  id: true,
  createdAt: true,
});

// Security Audit Log schemas
export const insertSecurityAuditLogSchema = createInsertSchema(securityAuditLog).omit({
  id: true,
  createdAt: true,
});

// User Cloud Storage Connection schemas
export const insertUserCloudStorageConnectionSchema = createInsertSchema(userCloudStorageConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Consultant Client Relationship Schema
// Note: consultantClients table not yet implemented
// export const insertConsultantClientSchema = createInsertSchema(consultantClients).omit({
//   id: true,
//   createdAt: true,
//   updatedAt: true,
// });

// Type exports for TypeScript
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type SelectLicense = typeof licenses.$inferSelect;
export type InsertLicenseAddon = z.infer<typeof insertLicenseAddonSchema>;
export type SelectLicenseAddon = typeof licenseAddons.$inferSelect;
export type InsertLicenseEvent = z.infer<typeof insertLicenseEventSchema>;
export type SelectLicenseEvent = typeof licenseEvents.$inferSelect;


// Type definitions for better inference
export type NewUser = typeof users.$inferInsert;
export type NewTenant = typeof tenants.$inferInsert;
export type NewAssessment = typeof assessments.$inferInsert;
export type NewAnswer = typeof answers.$inferInsert;
export type NewIntakeForm = typeof intakeForms.$inferInsert;
export type NewLicense = typeof licenses.$inferInsert;
// export type NewConsultantClient = typeof consultantClients.$inferInsert;

// Type exports for frontend
export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type IntakeForm = typeof intakeForms.$inferSelect;
export type IntakeAnswer = typeof intakeAnswers.$inferSelect;
export type EvidenceFile = typeof evidenceFiles.$inferSelect;
export type AssessmentSession = typeof assessmentSessions.$inferSelect;

// Observability types
export type SystemLog = typeof systemLogs.$inferSelect;
export type NewSystemLog = typeof systemLogs.$inferInsert;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type NewErrorLog = typeof errorLogs.$inferInsert;

// Review workflow types
export type ReviewWorkflow = typeof reviewWorkflows.$inferSelect;
export type NewReviewWorkflow = typeof reviewWorkflows.$inferInsert;
export type DecisionLog = typeof decisionLog.$inferSelect;
export type NewDecisionLog = typeof decisionLog.$inferInsert;
export type ClientInvitation = typeof clientInvitations.$inferSelect;
export type NewClientInvitation = typeof clientInvitations.$inferInsert;

// New type exports for user journey
export type OrganizationProfile = typeof organizationProfiles.$inferSelect;
export type FacilityProfile = typeof facilityProfiles.$inferSelect;
export type ScopeProfile = typeof scopeProfiles.$inferSelect;
export type License = typeof licenses.$inferSelect;

// Client organization type exports
export type ClientOrganization = typeof clientOrganizations.$inferSelect;
export type ClientFacility = typeof clientFacilities.$inferSelect;

// License type exports
export type LicenseAddon = typeof licenseAddons.$inferSelect;
export type LicenseEvent = typeof licenseEvents.$inferSelect;
export type EvidenceObject = typeof evidenceObjects.$inferSelect;

// Additional insert types (duplicates removed)
export type NewEvidenceFile = typeof evidenceFiles.$inferInsert;
export type NewOrganizationProfile = typeof organizationProfiles.$inferInsert;
export type NewFacilityProfile = typeof facilityProfiles.$inferInsert;
export type NewScopeProfile = typeof scopeProfiles.$inferInsert;

// Client organization insert types
export type NewClientOrganization = typeof clientOrganizations.$inferInsert;
export type NewClientFacility = typeof clientFacilities.$inferInsert;

// License insert types
export type NewLicenseAddon = typeof licenseAddons.$inferInsert;
export type NewLicenseEvent = typeof licenseEvents.$inferInsert;
export type NewEvidenceObject = typeof evidenceObjects.$inferInsert;

// === PHASE 5 SECURITY TYPE EXPORTS ===

// Two-Factor Authentication types
export type UserTwoFactorAuth = typeof userTwoFactorAuth.$inferSelect;
export type NewUserTwoFactorAuth = typeof userTwoFactorAuth.$inferInsert;

// User Device types
export type UserDevice = typeof userDevices.$inferSelect;
export type NewUserDevice = typeof userDevices.$inferInsert;

// Refresh Token types
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

// Rate Limit Event types
export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;
export type NewRateLimitEvent = typeof rateLimitEvents.$inferInsert;

// Security Audit Log types
export type SecurityAuditLog = typeof securityAuditLog.$inferSelect;
export type NewSecurityAuditLog = typeof securityAuditLog.$inferInsert;

// User Cloud Storage Connection types
export type UserCloudStorageConnection = typeof userCloudStorageConnections.$inferSelect;
export type NewUserCloudStorageConnection = typeof userCloudStorageConnections.$inferInsert;
export type CloudStorageProvider = "google_drive" | "onedrive" | "dropbox" | "azure_blob";

// Intake Facility types
export type IntakeFacility = typeof intakeFacilities.$inferSelect;
export type NewIntakeFacility = typeof intakeFacilities.$inferInsert;
export type InsertIntakeFacility = z.infer<typeof insertIntakeFacilitySchema>;

// Legacy alias for compatibility
export type InsertUser = NewUser;