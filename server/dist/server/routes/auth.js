import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import Stripe from 'stripe';
import { db } from '../db.js';
import { users, tenants, userSessions, auditLog, licenses, licenseEvents, questionMapping, questions } from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { AuthService } from '../services/authService.js';
import { rateLimitMiddleware, strictRateLimit } from '../middleware/rateLimitMiddleware.js';
import { blockTestUserLogin, blockTestUserRegistration } from '../middleware/testUserGuard.js';
import { emailService } from '../services/emailService.js';
import { flagService } from '../../shared/flags.js';
const router = Router();
const stripeSecretKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY or TESTING_STRIPE_SECRET_KEY environment variable is required');
}
const stripe = new Stripe(stripeSecretKey);
// Role hierarchy validation
const businessRoleHierarchy = {
    business_owner: 4,
    facility_manager: 3,
    compliance_officer: 2,
    team_member: 1,
    viewer: 0
};
const consultantRoleHierarchy = {
    consultant_owner: 3,
    lead_consultant: 2,
    associate_consultant: 1,
    client_collaborator: 0
};
/**
 * Validates if a user with assignerRole can assign targetRole
 * @param assignerRole - Role of the user performing the assignment
 * @param targetRole - Role being assigned to the target user
 * @returns Promise<boolean> - true if assignment is allowed
 */
async function validateRoleAssignment(assignerRole, targetRole) {
    // Check if roles are from the same category (business or consultant)
    const assignerIsBusiness = assignerRole in businessRoleHierarchy;
    const targetIsBusiness = targetRole in businessRoleHierarchy;
    const assignerIsConsultant = assignerRole in consultantRoleHierarchy;
    const targetIsConsultant = targetRole in consultantRoleHierarchy;
    // Cannot mix business and consultant roles
    if (assignerIsBusiness !== targetIsBusiness) {
        return false;
    }
    // Business role validation
    if (assignerIsBusiness && targetIsBusiness) {
        const assignerLevel = businessRoleHierarchy[assignerRole];
        const targetLevel = businessRoleHierarchy[targetRole];
        // Can only assign roles at or below your level
        return assignerLevel >= targetLevel;
    }
    // Consultant role validation
    if (assignerIsConsultant && targetIsConsultant) {
        const assignerLevel = consultantRoleHierarchy[assignerRole];
        const targetLevel = consultantRoleHierarchy[targetRole];
        // Can only assign roles at or below your level
        return assignerLevel >= targetLevel;
    }
    return false;
}
// License configurations for perpetual licenses (aligned with stripe.ts)
const licenseConfigs = {
    // === BUSINESS TIERS ===
    "solo_business": {
        name: "Solo Business",
        price: 39900,
        description: "1 facility, 1–3 seats, full feature access (Self-Assessment, REC Mapping, Scope Generator, Exports, Corrective Action Tracker, Training Center)",
        licenseType: "base",
        accountType: "business",
        tier: "solo",
        maxFacilities: 1,
        maxSeats: 3,
        features: {
            self_assessment: true,
            rec_mapping: true,
            scope_generator: true,
            exports: true,
            corrective_action_tracker: true,
            training_center: true,
            business_admin_panel: false,
            internal_oversight_tools: false
        }
    },
    "team_business": {
        name: "Team Business",
        price: 89900,
        description: "2 facilities, up to 10 seats, all features + Business Admin Panel",
        licenseType: "base",
        accountType: "business",
        tier: "team",
        maxFacilities: 2,
        maxSeats: 10,
        features: {
            self_assessment: true,
            rec_mapping: true,
            scope_generator: true,
            exports: true,
            corrective_action_tracker: true,
            training_center: true,
            business_admin_panel: true,
            internal_oversight_tools: false
        }
    },
    "enterprise_business": {
        name: "Enterprise Multi-Site",
        price: 179900,
        description: "3 facilities, up to 25 seats, all features + internal oversight tools",
        licenseType: "base",
        accountType: "business",
        tier: "enterprise",
        maxFacilities: 3,
        maxSeats: 25,
        features: {
            self_assessment: true,
            rec_mapping: true,
            scope_generator: true,
            exports: true,
            corrective_action_tracker: true,
            training_center: true,
            business_admin_panel: true,
            internal_oversight_tools: true
        }
    },
    // === CONSULTANT TIERS ===
    "independent_consultant": {
        name: "Independent Consultant",
        price: 59900,
        description: "Manage up to 5 client businesses, all toolkit features",
        licenseType: "base",
        accountType: "consultant",
        tier: "independent",
        maxClients: 5,
        maxSeats: 10,
        features: {
            self_assessment: true,
            rec_mapping: true,
            scope_generator: true,
            exports: true,
            corrective_action_tracker: true,
            training_center: true,
            client_management: true,
            collaboration_tools: false,
            white_label_branding: false
        }
    },
    "agency_consultant": {
        name: "Agency Consultant",
        price: 119900,
        description: "Manage up to 15 businesses, dedicated collaboration tools",
        licenseType: "base",
        accountType: "consultant",
        tier: "agency",
        maxClients: 15,
        maxSeats: 25,
        features: {
            self_assessment: true,
            rec_mapping: true,
            scope_generator: true,
            exports: true,
            corrective_action_tracker: true,
            training_center: true,
            client_management: true,
            collaboration_tools: true,
            white_label_branding: false
        }
    },
    "enterprise_consultant": {
        name: "Enterprise Agency / CB",
        price: 249900,
        description: "Manage up to 50 businesses, white-label branding & premium dashboards",
        licenseType: "base",
        accountType: "consultant",
        tier: "enterprise_agency",
        maxClients: 50,
        maxSeats: 100,
        features: {
            self_assessment: true,
            rec_mapping: true,
            scope_generator: true,
            exports: true,
            corrective_action_tracker: true,
            training_center: true,
            client_management: true,
            collaboration_tools: true,
            white_label_branding: true,
            premium_dashboards: true
        }
    },
    // === ADD-ONS ===
    "extra_facility": {
        name: "Extra Facility",
        price: 40000,
        description: "Add 1 facility (+5 seats included)",
        licenseType: "facility_addon",
        accountType: "business",
        maxFacilities: 1,
        maxSeats: 5,
        features: {}
    },
    "extra_seat_solo": {
        name: "Extra Seat (Solo)",
        price: 5000,
        description: "Add 1 extra seat for Solo Business tier",
        licenseType: "seat_addon",
        accountType: "business",
        targetTier: "solo",
        maxSeats: 1,
        features: {}
    },
    "extra_seat_team": {
        name: "Extra Seat (Team)",
        price: 4500,
        description: "Add 1 extra seat for Team Business tier",
        licenseType: "seat_addon",
        accountType: "business",
        targetTier: "team",
        maxSeats: 1,
        features: {}
    },
    "extra_client_independent": {
        name: "Extra Client (Independent)",
        price: 10000,
        description: "Add 1 extra client for Independent Consultant",
        licenseType: "client_addon",
        accountType: "consultant",
        targetTier: "independent",
        maxClients: 1,
        features: {}
    },
    "extra_client_agency": {
        name: "Extra Client (Agency)",
        price: 9000,
        description: "Add 1 extra client for Agency Consultant",
        licenseType: "client_addon",
        accountType: "consultant",
        targetTier: "agency",
        maxClients: 1,
        features: {}
    },
    "extra_client_enterprise": {
        name: "Extra Client (Enterprise)",
        price: 7500,
        description: "Add 1 extra client for Enterprise Agency",
        licenseType: "client_addon",
        accountType: "consultant",
        targetTier: "enterprise_agency",
        maxClients: 1,
        features: {}
    },
    "cross_facility_oversight": {
        name: "Cross-Facility Oversight",
        price: 100000,
        description: "Consultant Dashboard for Enterprises - oversee all facilities in one pane of glass",
        licenseType: "feature_addon",
        accountType: "business",
        targetTier: "enterprise",
        features: {
            consultant_dashboard: true,
            cross_facility_oversight: true
        }
    },
    // === SUPPORT & SERVICES ===
    "lite_support_pack": {
        name: "Lite Support Pack",
        price: 50000,
        description: "Email support for self-assessment review, 3-hour consultant Q&A block",
        licenseType: "support_service",
        accountType: "both",
        supportHours: 3,
        supportTier: "lite",
        features: {
            email_support: true,
            assessment_review: true,
            consultant_qa: true
        }
    },
    "full_guidance_pack": {
        name: "Full Guidance Pack",
        price: 175000,
        description: "Dedicated consultant hours (up to 12 hrs), live video sessions, mock audit walkthrough",
        licenseType: "support_service",
        accountType: "both",
        supportHours: 12,
        supportTier: "full",
        features: {
            dedicated_consultant: true,
            live_video_sessions: true,
            mock_audit_walkthrough: true
        }
    },
    "premium_hourly": {
        name: "Premium Hourly",
        price: 22500,
        description: "Rush or specialty consulting (Appendix B data sanitization, downstream vendor mapping, etc.)",
        licenseType: "support_service",
        accountType: "both",
        supportHours: 1,
        supportTier: "premium",
        features: {
            rush_consulting: true,
            specialty_consulting: true,
            appendix_b_support: true,
            vendor_mapping: true
        }
    }
};
// Validation schemas
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
const registerTenantSchema = z.object({
    tenantName: z.string().min(1),
    tenantType: z.enum(['BUSINESS', 'CONSULTANT']),
    domain: z.string().optional(),
    ownerEmail: z.string().email(),
    ownerFirstName: z.string().min(1),
    ownerLastName: z.string().min(1),
    ownerPassword: z.string().min(8),
});
const inviteUserSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum([
        'business_owner', 'facility_manager', 'compliance_officer', 'team_member', 'viewer',
        'consultant_owner', 'lead_consultant', 'associate_consultant', 'client_collaborator'
    ]),
    sendEmail: z.boolean().default(false),
});
const assignRoleSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum([
        'business_owner', 'facility_manager', 'compliance_officer', 'team_member', 'viewer',
        'consultant_owner', 'lead_consultant', 'associate_consultant', 'client_collaborator'
    ]),
});
const setPasswordSchema = z.object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});
const sendVerificationEmailSchema = z.object({
    email: z.string().email('Invalid email address'),
});
const verifyEmailSchema = z.object({
    token: z.string().min(1, 'Token is required'),
});
const verifyEmailCodeSchema = z.object({
    code: z.string().length(6, 'Verification code must be 6 digits'),
});
const updateAccountTypeSchema = z.object({
    accountType: z.enum(['BUSINESS', 'CONSULTANT'], {
        required_error: 'Account type is required',
        invalid_type_error: 'Account type must be either BUSINESS or CONSULTANT',
    }),
});
/**
 * GET /api/auth/system-status
 * Get system status including REC mapping
 */
router.get('/system-status', async (req, res) => {
    try {
        // Check REC mapping status
        const recMappings = await db.select({ count: sql `count(*)` }).from(questionMapping);
        const recMappingsCount = Number(recMappings[0]?.count || 0);
        // Check questions count
        const questionsResult = await db.select({ count: sql `count(*)` }).from(questions);
        const questionsCount = Number(questionsResult[0]?.count || 0);
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            system: {
                questionsCount,
                recMappingsCount,
                recMappingStatus: recMappingsCount > 0 ? 'active' : 'empty',
                emailService: process.env.RESEND_API_KEY ? 'resend' : 'console'
            },
            recommendations: recMappingsCount === 0 ? [
                'Run SEED_MODE=merge npm run seed:mappings to populate REC mappings'
            ] : []
        });
    }
    catch (error) {
        console.error('System status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get system status'
        });
    }
});
/**
 * GET /api/auth/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Auth service is healthy',
        timestamp: new Date().toISOString()
    });
});
/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
router.post('/login', rateLimitMiddleware.login, blockTestUserLogin, async (req, res) => {
    try {
        const { email, password } = req.body; // Use validated body
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');
        const authResult = await AuthService.authenticate(email, password, ipAddress, userAgent);
        if (!authResult) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const { user, tenant, session, token, permissions } = authResult;
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.businessRole || user.consultantRole,
                setupStatus: user.setupStatus,
                emailVerified: user.emailVerified,
                isActive: user.isActive,
                lastLoginAt: user.lastLoginAt,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                type: tenant.tenantType,
                licenseStatus: tenant.licenseStatus,
            },
            token,
            permissions,
            expiresAt: session.expiresAt,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Login failed' });
    }
});
/**
 * POST /api/auth/register-tenant
 * Register a new tenant with owner account
 * Supports dual-mode registration based on enable_email_verification feature flag
 * RECOVERY MODE: Allows re-registration if user is stuck in incomplete state
 */
router.post('/register-tenant', rateLimitMiddleware.login, blockTestUserRegistration, async (req, res) => {
    try {
        // Check feature flag for email verification flow
        const emailVerificationEnabled = await flagService.isEnabled('enable_email_verification');
        // Validate input data
        const data = registerTenantSchema.parse(req.body);
        // Check if email already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, data.ownerEmail),
        });
        if (existingUser) {
            // RECOVERY LOGIC: Allow re-registration if user is stuck in incomplete state
            const isStuckInIncompleteState = existingUser.setupStatus === 'email_pending' ||
                existingUser.setupStatus === 'setup_pending';
            if (!isStuckInIncompleteState) {
                // User has completed setup or is further along - don't allow re-registration
                return res.status(400).json({ error: 'Email already registered' });
            }
            // RECOVERY MODE: User is stuck, allow them to restart the registration process
            console.log('🔄 RECOVERY MODE: Re-registering stuck user:', {
                email: data.ownerEmail,
                userId: existingUser.id,
                currentSetupStatus: existingUser.setupStatus
            });
            // SECURITY: Revoke all existing sessions for this user before reset
            // This prevents stale tokens from being used after re-registration
            await db.update(userSessions)
                .set({ status: 'REVOKED' })
                .where(eq(userSessions.userId, existingUser.id));
            console.log('🔒 RECOVERY MODE: Revoked all sessions for user before reset:', {
                email: data.ownerEmail,
                userId: existingUser.id
            });
            // Update the existing user's password and reset verification state
            const passwordHash = await AuthService.hashPassword(data.ownerPassword);
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            await db.update(users)
                .set({
                firstName: data.ownerFirstName,
                lastName: data.ownerLastName,
                passwordHash,
                emailVerified: false,
                emailVerifiedAt: null,
                setupStatus: 'email_pending',
                emailVerificationToken: verificationToken,
                emailVerificationCode: verificationCode,
                emailVerificationTokenExpiry: tokenExpiry,
                updatedAt: new Date()
            })
                .where(eq(users.id, existingUser.id));
            // Also update tenant name if provided
            await db.update(tenants)
                .set({
                name: data.tenantName,
                tenantType: data.tenantType,
                updatedAt: new Date()
            })
                .where(eq(tenants.id, existingUser.tenantId));
            // Send verification email
            try {
                const emailSent = await emailService.sendVerificationEmail(data.ownerEmail, verificationToken, verificationCode, data.ownerFirstName);
                if (!emailSent) {
                    console.error('Failed to send verification email to:', data.ownerEmail);
                    return res.status(500).json({
                        error: 'Failed to send verification email. Please try again later.'
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending verification email:', emailError);
                return res.status(500).json({
                    error: 'Failed to send verification email. Please try again later.'
                });
            }
            // Log audit event for recovery flow
            await AuthService.logAuditEvent(existingUser.tenantId, existingUser.id, 'REGISTRATION_RECOVERY_RESTART', 'user', existingUser.id, { email: data.ownerEmail, previousStatus: existingUser.setupStatus });
            // Return success response
            return res.status(201).json({
                success: true,
                requiresEmailVerification: true,
                recoveryMode: true,
                message: 'Registration restarted. Please check your email to verify your account.',
                email: data.ownerEmail,
                userId: existingUser.id
            });
        }
        // Create tenant and owner
        const { tenant, user } = await AuthService.createTenant(data.tenantName, data.tenantType, data.ownerEmail, data.ownerFirstName, data.ownerLastName, data.domain);
        // Set password
        const passwordHash = await AuthService.hashPassword(data.ownerPassword);
        if (emailVerificationEnabled) {
            // ===== NEW EMAIL-FIRST FLOW =====
            // Generate email verification token and 6-digit code
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
            const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            // Update user with verification token, code, and set setupStatus to 'email_pending'
            await db.update(users)
                .set({
                passwordHash,
                emailVerified: false,
                setupStatus: 'email_pending',
                emailVerificationToken: verificationToken,
                emailVerificationCode: verificationCode,
                emailVerificationTokenExpiry: tokenExpiry,
                updatedAt: new Date()
            })
                .where(eq(users.id, user.id));
            // Send verification email
            try {
                const emailSent = await emailService.sendVerificationEmail(data.ownerEmail, verificationToken, verificationCode, data.ownerFirstName);
                if (!emailSent) {
                    console.error('Failed to send verification email to:', data.ownerEmail);
                    return res.status(500).json({
                        error: 'Failed to send verification email. Please try again later.'
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending verification email:', emailError);
                return res.status(500).json({
                    error: 'Failed to send verification email. Please try again later.'
                });
            }
            // Log audit event for new flow
            await AuthService.logAuditEvent(tenant.id, user.id, 'REGISTRATION_PENDING_EMAIL_VERIFICATION', 'user', user.id, { email: data.ownerEmail, tenantName: data.tenantName });
            // Return success response WITHOUT session token
            res.status(201).json({
                success: true,
                requiresEmailVerification: true,
                message: 'Registration successful. Please check your email to verify your account.',
                email: data.ownerEmail,
                userId: user.id
            });
        }
        else {
            // ===== LEGACY FLOW (existing behavior) =====
            // Set password and mark email as verified
            await db.update(users)
                .set({ passwordHash, emailVerified: true })
                .where(eq(users.id, user.id));
            // Create session
            const { session, token } = await AuthService.createSession(user.id, tenant.id, req.ip, req.get('User-Agent'));
            const permissions = await AuthService.getUserPermissions(data.tenantType === 'BUSINESS' ? 'business_owner' : 'consultant_owner');
            // Return success response WITH session token (user is logged in)
            res.status(201).json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.businessRole || user.consultantRole,
                    setupStatus: user.setupStatus,
                },
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    type: tenant.tenantType,
                    licenseStatus: tenant.licenseStatus,
                },
                token,
                permissions,
                expiresAt: session.expiresAt,
            });
        }
    }
    catch (error) {
        console.error('Registration error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});
/**
 * POST /api/auth/logout
 * Logout current user (revoke session)
 */
router.post('/logout', AuthService.authMiddleware, async (req, res) => {
    try {
        if (req.session) {
            await AuthService.logout(req.session.id);
            await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'SESSION_REVOKED', 'session', req.session.id);
        }
        res.json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});
/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', AuthService.authMiddleware, async (req, res) => {
    try {
        const permissions = await AuthService.getUserPermissions(req.user.businessRole || req.user.consultantRole);
        res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                role: req.user.businessRole || req.user.consultantRole,
                setupStatus: req.user.setupStatus,
                emailVerified: req.user.emailVerified,
                profileImage: req.user.profileImage,
                phone: req.user.phone,
                isActive: req.user.isActive,
                lastLoginAt: req.user.lastLoginAt,
            },
            tenant: {
                id: req.tenant.id,
                name: req.tenant.name,
                type: req.tenant.tenantType,
                domain: req.tenant.domain,
                licenseStatus: req.tenant.licenseStatus,
                settings: req.tenant.settings,
            },
            permissions,
            session: {
                id: req.session.id,
                expiresAt: req.session.expiresAt,
                lastActivityAt: req.session.lastActivityAt,
            },
        });
    }
    catch (error) {
        console.error('Me endpoint error:', error);
        res.status(500).json({ error: 'Failed to get user information' });
    }
});
/**
 * POST /api/auth/invite-user
 * Invite a new user to the tenant
 */
router.post('/invite-user', AuthService.authMiddleware, async (req, res) => {
    try {
        const data = inviteUserSchema.parse(req.body);
        // Validate role assignment permissions
        const userRole = req.user.businessRole || req.user.consultantRole;
        const canAssignRole = await validateRoleAssignment(userRole, data.role);
        if (!canAssignRole) {
            return res.status(403).json({ error: 'Cannot assign this role' });
        }
        const user = await AuthService.inviteUser(req.tenant.id, req.user.id, data.email, data.firstName, data.lastName, data.role, data.sendEmail);
        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.businessRole || user.consultantRole,
                isActive: user.isActive,
                invitedAt: user.invitedAt,
            },
        });
    }
    catch (error) {
        console.error('Invite user error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        if (error instanceof Error && error.message === 'User already exists in this tenant') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to invite user' });
    }
});
/**
 * POST /api/auth/assign-role
 * Assign role to existing user
 */
router.post('/assign-role', AuthService.authMiddleware, async (req, res) => {
    try {
        const data = assignRoleSchema.parse(req.body);
        // Validate role assignment permissions
        const userRole = req.user.businessRole || req.user.consultantRole;
        const canAssignRole = await validateRoleAssignment(userRole, data.role);
        if (!canAssignRole) {
            return res.status(403).json({ error: 'Cannot assign this role' });
        }
        // Verify target user is in same tenant
        const targetUser = await db.query.users.findFirst({
            where: and(eq(users.id, data.userId), eq(users.tenantId, req.tenant.id)),
        });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        await AuthService.assignRole(data.userId, data.role, req.user.id);
        res.json({ success: true, message: 'Role assigned successfully' });
    }
    catch (error) {
        console.error('Assign role error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to assign role' });
    }
});
/**
 * POST /api/auth/update-setup-status
 * Update user setup status
 */
router.post('/update-setup-status', AuthService.authMiddleware, async (req, res) => {
    try {
        const { setupStatus } = req.body;
        // Validate setup status
        const validStatuses = ['not_started', 'setup_incomplete', 'setup_complete', 'assessment_active'];
        if (!validStatuses.includes(setupStatus)) {
            return res.status(400).json({ error: 'Invalid setup status' });
        }
        await db.update(users)
            .set({
            setupStatus,
            updatedAt: new Date()
        })
            .where(eq(users.id, req.user.id));
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'SETUP_STATUS_UPDATED', 'user', req.user.id, { newStatus: setupStatus });
        res.json({ success: true, message: 'Setup status updated successfully' });
    }
    catch (error) {
        console.error('Update setup status error:', error);
        res.status(500).json({ error: 'Failed to update setup status' });
    }
});
/**
 * PATCH /api/auth/account-type
 * Update user's account type (tenant type)
 */
router.patch('/account-type', AuthService.authMiddleware, async (req, res) => {
    try {
        const data = updateAccountTypeSchema.parse(req.body);
        // Update the tenant's type
        await db.update(tenants)
            .set({
            tenantType: data.accountType,
            updatedAt: new Date()
        })
            .where(eq(tenants.id, req.tenant.id));
        // Log the audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'ACCOUNT_TYPE_UPDATED', 'tenant', req.tenant.id, {
            oldType: req.tenant.tenantType,
            newType: data.accountType
        });
        res.json({
            success: true,
            message: 'Account type updated successfully',
            accountType: data.accountType
        });
    }
    catch (error) {
        console.error('Update account type error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to update account type' });
    }
});
/**
 * POST /api/auth/set-password
 * Set password for invited user
 */
router.post('/set-password', strictRateLimit.passwordChange, AuthService.authMiddleware, async (req, res) => {
    try {
        const data = setPasswordSchema.parse(req.body);
        // Only allow if user doesn't have a password yet (invited user)
        if (req.user.passwordHash) {
            return res.status(400).json({ error: 'Password already set. Use change password instead.' });
        }
        const passwordHash = await AuthService.hashPassword(data.password);
        await db.update(users)
            .set({
            passwordHash,
            emailVerified: true,
            lastLoginAt: new Date()
        })
            .where(eq(users.id, req.user.id));
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'PASSWORD_SET', 'user', req.user.id);
        res.json({ success: true, message: 'Password set successfully' });
    }
    catch (error) {
        console.error('Set password error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to set password' });
    }
});
/**
 * GET /api/auth/users
 * Get all users in tenant
 */
router.get('/users', AuthService.authMiddleware, async (req, res) => {
    try {
        const tenantUsers = await db.query.users.findMany({
            where: eq(users.tenantId, req.tenant.id),
            columns: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                businessRole: true,
                consultantRole: true,
                isActive: true,
                lastLoginAt: true,
                invitedAt: true,
                createdAt: true,
            },
        });
        res.json({
            success: true,
            users: tenantUsers.map(user => ({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.businessRole || user.consultantRole,
                isActive: user.isActive,
                lastLoginAt: user.lastLoginAt,
                invitedAt: user.invitedAt,
                createdAt: user.createdAt,
            })),
        });
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});
/**
 * GET /api/auth/audit-logs
 * Get audit logs for tenant
 */
router.get('/audit-logs', AuthService.authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const logs = await db
            .select()
            .from(auditLog)
            .where(sql `${auditLog.tenantId} = ${req.tenant.id}`)
            .orderBy(sql `${auditLog.timestamp} DESC`)
            .limit(limit)
            .offset(offset);
        const totalResult = await db
            .select({ count: sql `count(*)` })
            .from(auditLog)
            .where(sql `${auditLog.tenantId} = ${req.tenant.id}`)
            .then(result => result[0] || { count: 0 });
        res.json({
            success: true,
            logs: logs.map((log) => ({
                id: log.id,
                action: log.action,
                resource: log.resource,
                resourceAction: log.resourceAction,
                resourceId: log.resourceId,
                metadata: log.metadata,
                requestData: log.requestData,
                timestamp: log.timestamp,
            })),
            pagination: {
                page,
                limit,
                total: totalResult.count,
                pages: Math.ceil(totalResult.count / limit),
            },
        });
    }
    catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});
/**
 * POST /api/auth/complete-registration
 * Complete registration after successful Stripe payment by setting password
 */
router.post('/complete-registration', rateLimitMiddleware.login, async (req, res) => {
    try {
        const { sessionId, password } = req.body;
        if (!sessionId || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        // Verify Stripe session
        let session;
        if (sessionId.startsWith('mock_cs_test_')) {
            // Mock session for testing
            const mockSessions = global.mockSessions || {};
            session = mockSessions[sessionId];
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }
        }
        else {
            // Real Stripe session (sensitive data not logged)
            session = await stripe.checkout.sessions.retrieve(sessionId);
        }
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed' });
        }
        const email = session.customer_email || session.metadata?.email;
        if (!email) {
            return res.status(400).json({ error: 'No email found in session' });
        }
        // Find the user created by the webhook
        let user = await db.query.users.findFirst({
            where: eq(users.email, email),
            with: { tenant: true }
        });
        // DEVELOPMENT FALLBACK: If webhook hasn't run yet (local testing scenario where webhooks can't reach localhost)
        if (!user && session.metadata?.registrationFlow === 'true' && process.env.NODE_ENV !== 'production') {
            // Development fallback: Create user if webhook hasn't run (local testing only)
            const { firstName, lastName, companyName, tenantType } = session.metadata;
            if (!firstName || !lastName || !companyName) {
                return res.status(400).json({ error: 'Missing registration data in session' });
            }
            // Create tenant
            const tenantResult = await db.insert(tenants).values({
                name: companyName,
                tenantType: tenantType === 'CONSULTANT' ? 'CONSULTANT' : 'BUSINESS',
                licenseStatus: 'active',
                isActive: true,
            }).returning();
            const newTenant = tenantResult[0];
            // Create user
            const userResult = await db.insert(users).values({
                tenantId: newTenant.id,
                email,
                firstName,
                lastName,
                businessRole: tenantType === 'BUSINESS' ? 'business_owner' : null,
                consultantRole: tenantType === 'CONSULTANT' ? 'consultant_owner' : null,
                isActive: false,
                setupStatus: 'setup_pending',
            }).returning();
            const newUser = userResult[0];
            // Reload user with tenant
            user = await db.query.users.findFirst({
                where: eq(users.id, newUser.id),
                with: { tenant: true }
            });
            // User created from session metadata (development fallback)
            // ALSO CREATE LICENSE (same logic as webhook handleSuccessfulCheckout)
            const licenseId = session.metadata?.licenseId;
            if (licenseId) {
                const licenseConfig = licenseConfigs[licenseId];
                if (licenseConfig) {
                    // Creating license for new tenant (development fallback)
                    const [newLicense] = await db.insert(licenses).values({
                        tenantId: newTenant.id,
                        planId: licenseId,
                        planName: licenseConfig.name,
                        accountType: licenseConfig.accountType,
                        licenseType: licenseConfig.licenseType,
                        stripeSessionId: session.id,
                        amountPaid: session.amount_total || 0,
                        currency: session.currency || 'usd',
                        isActive: true,
                        maxFacilities: licenseConfig.maxFacilities ?? null,
                        maxSeats: licenseConfig.maxSeats ?? null,
                        maxClients: licenseConfig.maxClients ?? null,
                        supportHours: licenseConfig.supportHours ?? null,
                        supportTier: licenseConfig.supportTier ?? null,
                        features: licenseConfig.features || {},
                        purchasedBy: newUser.id,
                    }).returning();
                    // License created successfully (development fallback)
                    // Create license event record
                    await db.insert(licenseEvents).values({
                        tenantId: newTenant.id,
                        licenseId: newLicense.id,
                        eventType: 'purchase',
                        eventDescription: `License purchased via Stripe session ${session.id}`,
                        eventData: {
                            stripeSessionId: session.id,
                            amountPaid: session.amount_total || 0,
                            licenseType: licenseConfig.licenseType,
                            devFallback: true
                        }
                    });
                    // License and event created for development fallback
                }
                else {
                    console.warn('⚠️ [DEV ONLY] Unknown license ID in session metadata:', licenseId);
                }
            }
            else {
                console.warn('⚠️ [DEV ONLY] No licenseId in session metadata - license not created');
            }
        }
        // PRODUCTION: Wait briefly for webhook to complete, then return helpful error
        if (!user && session.metadata?.registrationFlow === 'true' && process.env.NODE_ENV === 'production') {
            console.log('⏳ [PROD] User not found immediately - waiting for webhook processing...');
            // Poll for user creation (webhook might be processing)
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                user = await db.query.users.findFirst({
                    where: eq(users.email, email),
                    with: { tenant: true }
                });
                if (user) {
                    console.log('✅ [PROD] User found after polling');
                    break;
                }
            }
            if (!user) {
                return res.status(409).json({
                    error: 'Registration still processing. Please wait a moment and try again.'
                });
            }
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found. Please contact support.' });
        }
        if (user.passwordHash) {
            return res.status(400).json({ error: 'Account already activated' });
        }
        // Hash password and activate user
        console.log('🔵 COMPLETE-REG: Activating user', {
            userId: user.id,
            tenantId: user.tenantId,
            email: user.email
        });
        const passwordHash = await AuthService.hashPassword(password); // Use consistent 12 rounds
        await db.update(users)
            .set({
            passwordHash,
            isActive: true,
            setupStatus: 'setup_pending',
            updatedAt: new Date(),
        })
            .where(eq(users.id, user.id));
        console.log('🟢 COMPLETE-REG: User activated with setupStatus=setup_pending', {
            userId: user.id,
            tenantId: user.tenantId
        });
        // Create session and generate token
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent') || '';
        const { session: userSession, token } = await AuthService.createSession(user.id, user.tenantId, ipAddress, userAgent);
        // Get permissions
        const permissions = await AuthService.getUserPermissions(user.businessRole || user.consultantRole || 'business_owner');
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.businessRole || user.consultantRole,
                setupStatus: 'setup_pending',
                isActive: true,
            },
            tenant: {
                id: user.tenant?.id || user.tenantId,
                name: user.tenant?.name || 'Unknown',
                type: user.tenant?.tenantType || 'BUSINESS',
                licenseStatus: user.tenant?.licenseStatus || 'active',
            },
            token,
            permissions,
            expiresAt: userSession.expiresAt,
        });
    }
    catch (error) {
        console.error('Complete registration error:', error);
        res.status(500).json({ error: 'Failed to complete registration' });
    }
});
/**
 * POST /api/auth/auto-provision-test-license
 * Auto-provision a free license for test accounts
 */
router.post('/auto-provision-test-license', AuthService.authMiddleware, async (req, res) => {
    try {
        const { isTestEmail } = await import('../middleware/testUserGuard.js');
        // Check if this is a test account
        if (!isTestEmail(req.user.email)) {
            return res.status(403).json({ error: 'This endpoint is only available for test accounts' });
        }
        console.log('🧪 Auto-provisioning free license for test account:', req.user.email);
        // Import licenses table
        const { licenses, licenseEvents } = await import('../../shared/schema.js');
        // Check if license already exists
        const existingLicense = await db.query.licenses.findFirst({
            where: (licenses, { eq, and }) => and(eq(licenses.tenantId, req.tenant.id), eq(licenses.isActive, true))
        });
        if (existingLicense) {
            console.log('✅ Test account already has an active license');
            return res.json({
                success: true,
                message: 'License already exists',
                license: existingLicense
            });
        }
        // Determine license type based on tenant type
        const isBusiness = req.tenant.tenantType === 'BUSINESS';
        const licenseConfig = {
            planId: isBusiness ? 'test_business' : 'test_consultant',
            planName: isBusiness ? 'Test Business License' : 'Test Consultant License',
            licenseType: 'base',
            accountType: isBusiness ? 'business' : 'consultant',
            tier: 'test',
            maxFacilities: 10,
            maxSeats: 50,
            maxClients: isBusiness ? 0 : 20,
            supportTier: 'premium',
            features: {
                self_assessment: true,
                rec_mapping: true,
                scope_generator: true,
                exports: true,
                corrective_action_tracker: true,
                training_center: true,
                business_admin_panel: true,
                internal_oversight_tools: true,
                client_management: !isBusiness,
                collaboration_tools: !isBusiness,
                white_label_branding: !isBusiness
            }
        };
        // Create test license
        const licenseResult = await db.insert(licenses).values({
            tenantId: req.tenant.id,
            planId: licenseConfig.planId,
            planName: licenseConfig.planName,
            licenseType: licenseConfig.licenseType,
            accountType: licenseConfig.accountType,
            tier: licenseConfig.tier,
            stripeSessionId: `test_session_${Date.now()}`,
            amountPaid: 0, // Free for test accounts
            currency: 'usd',
            isActive: true,
            maxFacilities: licenseConfig.maxFacilities,
            maxSeats: licenseConfig.maxSeats,
            maxClients: licenseConfig.maxClients,
            supportTier: licenseConfig.supportTier,
            features: licenseConfig.features,
            purchasedBy: req.user.id,
            notes: 'Auto-provisioned test account license'
        }).returning();
        const newLicense = Array.isArray(licenseResult) ? licenseResult[0] : licenseResult.rows[0];
        // Create license event
        await db.insert(licenseEvents).values({
            tenantId: req.tenant.id,
            licenseId: newLicense.id,
            eventType: 'auto_provision',
            eventDescription: 'Test account license auto-provisioned',
            eventData: {
                testAccount: true,
                email: req.user.email
            }
        });
        // Update tenant license status
        await db.update(tenants)
            .set({
            licenseStatus: 'active',
            updatedAt: new Date()
        })
            .where(eq(tenants.id, req.tenant.id));
        // Update user setup status to assessment_active
        await db.update(users)
            .set({
            setupStatus: 'assessment_active',
            setupCompletedAt: new Date(),
            updatedAt: new Date()
        })
            .where(eq(users.id, req.user.id));
        console.log('✅ Test license auto-provisioned successfully:', {
            licenseId: newLicense.id,
            tenantId: req.tenant.id,
            userId: req.user.id
        });
        res.json({
            success: true,
            message: 'Test license auto-provisioned successfully',
            license: newLicense
        });
    }
    catch (error) {
        console.error('Auto-provision test license error:', error);
        res.status(500).json({ error: 'Failed to auto-provision test license' });
    }
});
/**
 * POST /api/auth/send-verification-email
 * Send (or resend) verification email to a user
 * RECOVERY MODE: Allows resending even if emailVerified=true but setupStatus is incomplete
 */
router.post('/send-verification-email', strictRateLimit.passwordChange, async (req, res) => {
    try {
        const { email } = sendVerificationEmailSchema.parse(req.body);
        // Find user by email
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // RECOVERY LOGIC: Allow resending if user is stuck in incomplete state
        // A user is considered "stuck" if emailVerified=true but setupStatus indicates incomplete registration
        const isStuckInIncompleteState = user.emailVerified &&
            (user.setupStatus === 'email_pending' || user.setupStatus === 'setup_pending');
        // Check if already fully verified and setup complete
        if (user.emailVerified && !isStuckInIncompleteState && user.setupStatus === 'setup_complete') {
            return res.status(400).json({ error: 'Email already verified and setup complete' });
        }
        // Generate secure random token and 6-digit code
        const token = crypto.randomBytes(32).toString('hex');
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
        // Set token expiry to 10 minutes from now
        const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        // RECOVERY: Reset emailVerified to false if user is stuck
        const updateData = {
            emailVerificationToken: token,
            emailVerificationCode: verificationCode,
            emailVerificationTokenExpiry: tokenExpiry,
            updatedAt: new Date(),
        };
        if (isStuckInIncompleteState) {
            // Reset the user back to unverified state to allow proper re-verification
            updateData.emailVerified = false;
            updateData.emailVerifiedAt = null;
            updateData.setupStatus = 'email_pending';
            console.log('🔄 RECOVERY MODE: Resetting stuck user to email_pending state:', { email, userId: user.id });
        }
        // Update user record with verification token, code, and expiry
        await db.update(users)
            .set(updateData)
            .where(eq(users.id, user.id));
        // Send verification email
        const emailSent = await emailService.sendVerificationEmail(email, token, verificationCode, user.firstName);
        if (!emailSent) {
            console.error('Failed to send verification email to:', email);
            return res.status(500).json({ error: 'Failed to send verification email' });
        }
        // Log verification email sent
        await AuthService.logAuditEvent(user.tenantId, user.id, isStuckInIncompleteState ? 'VERIFICATION_EMAIL_RESENT_RECOVERY' : 'VERIFICATION_EMAIL_SENT', 'user', user.id, { email, recoveryMode: isStuckInIncompleteState });
        console.log('✅ Verification email sent successfully:', {
            email,
            userId: user.id,
            recoveryMode: isStuckInIncompleteState
        });
        res.json({
            success: true,
            message: 'Verification email sent successfully. Please check your inbox.',
            recoveryMode: isStuckInIncompleteState,
        });
    }
    catch (error) {
        console.error('Send verification email error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});
/**
 * POST /api/auth/verify-email
 * Validate token, mark email as verified, and automatically log in user
 */
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = verifyEmailSchema.parse(req.body);
        // Find user with matching verification token
        const user = await db.query.users.findFirst({
            where: eq(users.emailVerificationToken, token),
        });
        if (!user) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }
        // Check if token expired
        const now = new Date();
        if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < now) {
            return res.status(400).json({
                error: 'Verification token has expired. Please request a new one.'
            });
        }
        // Update user: mark as verified and clear token and code
        const updateData = {
            emailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationToken: null,
            emailVerificationCode: null,
            emailVerificationTokenExpiry: null,
            updatedAt: new Date(),
        };
        // If setupStatus is 'email_pending', update to 'setup_pending'
        if (user.setupStatus === 'email_pending') {
            updateData.setupStatus = 'setup_pending';
        }
        await db.update(users)
            .set(updateData)
            .where(eq(users.id, user.id));
        // Get tenant info
        const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, user.tenantId),
        });
        if (!tenant) {
            return res.status(500).json({ error: 'Tenant not found' });
        }
        // Create session and automatically log in the user
        const { session, token: authToken } = await AuthService.createSession(user.id, user.tenantId, req.ip, req.get('User-Agent'));
        // Get user permissions
        const permissions = await AuthService.getUserPermissions(user.businessRole || user.consultantRole || 'business_owner');
        // Log verification success
        await AuthService.logAuditEvent(user.tenantId, user.id, 'EMAIL_VERIFIED', 'user', user.id, {
            email: user.email,
            previousSetupStatus: user.setupStatus,
            newSetupStatus: updateData.setupStatus || user.setupStatus,
            autoLoginCreated: true
        });
        console.log('✅ Email verified successfully and user logged in:', {
            email: user.email,
            userId: user.id,
            setupStatus: updateData.setupStatus || user.setupStatus
        });
        res.json({
            success: true,
            message: 'Email verified successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.businessRole || user.consultantRole,
                setupStatus: updateData.setupStatus || user.setupStatus,
                isActive: user.isActive,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                type: tenant.tenantType,
                licenseStatus: tenant.licenseStatus,
            },
            token: authToken,
            permissions,
            expiresAt: session.expiresAt,
        });
    }
    catch (error) {
        console.error('Verify email error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to verify email' });
    }
});
/**
 * POST /api/auth/verify-email-code
 * Validate 6-digit code, mark email as verified, and automatically log in user
 * Rate limited to prevent brute-force attacks on 6-digit codes
 */
router.post('/verify-email-code', rateLimitMiddleware.login, // Strict rate limiting for brute-force protection on auth codes
async (req, res) => {
    try {
        const { code } = verifyEmailCodeSchema.parse(req.body);
        // Find user with matching verification code
        const user = await db.query.users.findFirst({
            where: eq(users.emailVerificationCode, code),
        });
        if (!user) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        // Check if code expired
        const now = new Date();
        if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < now) {
            return res.status(400).json({
                error: 'Verification code has expired. Please request a new one.'
            });
        }
        // Update user: mark as verified and clear token and code
        const updateData = {
            emailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationToken: null,
            emailVerificationCode: null,
            emailVerificationTokenExpiry: null,
            updatedAt: new Date(),
        };
        // If setupStatus is 'email_pending', update to 'setup_pending'
        if (user.setupStatus === 'email_pending') {
            updateData.setupStatus = 'setup_pending';
        }
        await db.update(users)
            .set(updateData)
            .where(eq(users.id, user.id));
        // Get tenant info
        const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, user.tenantId),
        });
        if (!tenant) {
            return res.status(500).json({ error: 'Tenant not found' });
        }
        // Create session and automatically log in the user
        const { session, token: authToken } = await AuthService.createSession(user.id, user.tenantId, req.ip, req.get('User-Agent'));
        // Get user permissions
        const permissions = await AuthService.getUserPermissions(user.businessRole || user.consultantRole || 'business_owner');
        // Log verification success
        await AuthService.logAuditEvent(user.tenantId, user.id, 'EMAIL_VERIFIED', 'user', user.id, {
            email: user.email,
            previousSetupStatus: user.setupStatus,
            newSetupStatus: updateData.setupStatus || user.setupStatus,
            autoLoginCreated: true,
            verificationMethod: 'code'
        });
        console.log('✅ Email verified successfully via code and user logged in:', {
            email: user.email,
            userId: user.id,
            setupStatus: updateData.setupStatus || user.setupStatus
        });
        res.json({
            success: true,
            message: 'Email verified successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.businessRole || user.consultantRole,
                setupStatus: updateData.setupStatus || user.setupStatus,
                isActive: user.isActive,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                type: tenant.tenantType,
                licenseStatus: tenant.licenseStatus,
            },
            token: authToken,
            permissions,
            expiresAt: session.expiresAt,
        });
    }
    catch (error) {
        console.error('Verify email code error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to verify email code' });
    }
});
/**
 * Test email endpoint for verification
 */
router.post('/test-email', async (req, res) => {
    try {
        const { email, type = 'verification' } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Generate test verification data
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationToken = crypto.randomUUID();
        console.log(`📧 Test email generated for ${email}:`);
        console.log(`   Code: ${verificationCode}`);
        console.log(`   Token: ${verificationToken}`);
        console.log(`   Type: ${type}`);
        res.json({
            success: true,
            message: 'Test email generated successfully',
            testData: {
                email,
                code: verificationCode,
                token: verificationToken,
                type,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            }
        });
    }
    catch (error) {
        console.error('Test email generation error:', error);
        res.status(500).json({ error: 'Failed to generate test email' });
    }
});
/**
 * GET /api/auth/test-get-verification-token
 * Retrieves the actual verification token from database for E2E testing
 * DEVELOPMENT ONLY - Returns 404 in production
 */
router.get('/test-get-verification-token', async (req, res) => {
    // SECURITY: Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    try {
        const { email } = req.query;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email parameter is required' });
        }
        // SECURITY: Only allow for known test user
        const testUserEmails = ['jaikengamez@gmail.com'];
        if (!testUserEmails.includes(email.toLowerCase())) {
            console.warn('⚠️ Test endpoint blocked for non-test user:', email);
            return res.status(403).json({ error: 'Test endpoint only available for test users' });
        }
        // Find user in database
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('🧪 TEST ENDPOINT: Retrieved verification token for:', email);
        console.log('   Token:', user.emailVerificationToken || 'null');
        console.log('   Code:', user.emailVerificationCode || 'null');
        console.log('   Expiry:', user.emailVerificationTokenExpiry || 'null');
        res.json({
            success: true,
            message: 'Verification token retrieved (TEST MODE)',
            testData: {
                email: user.email,
                token: user.emailVerificationToken,
                code: user.emailVerificationCode,
                expiresAt: user.emailVerificationTokenExpiry,
                emailVerified: user.emailVerified,
                setupStatus: user.setupStatus
            }
        });
    }
    catch (error) {
        console.error('Test get verification token error:', error);
        res.status(500).json({ error: 'Failed to retrieve verification token' });
    }
});
/**
 * POST /api/auth/test-verify-email
 * Directly verifies a test user's email without requiring magic link
 * DEVELOPMENT ONLY - Returns 404 in production
 */
router.post('/test-verify-email', async (req, res) => {
    // SECURITY: Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // SECURITY: Only allow for known test users or E2E test emails
        const testUserEmails = ['jaikengamez@gmail.com'];
        const isE2ETestEmail = email.toLowerCase().endsWith('@test.com');
        const isKnownTestUser = testUserEmails.includes(email.toLowerCase());
        if (!isKnownTestUser && !isE2ETestEmail) {
            console.warn('⚠️ Test endpoint blocked for non-test user:', email);
            return res.status(403).json({ error: 'Test endpoint only available for test users' });
        }
        // Find user in database
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
            with: { tenant: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Update user: mark as verified and clear token and code
        const updateData = {
            emailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationToken: null,
            emailVerificationCode: null,
            emailVerificationTokenExpiry: null,
            updatedAt: new Date(),
        };
        // If setupStatus is 'email_pending', update to 'setup_pending'
        if (user.setupStatus === 'email_pending') {
            updateData.setupStatus = 'setup_pending';
        }
        await db.update(users)
            .set(updateData)
            .where(eq(users.id, user.id));
        // Generate auth token and session for auto-login
        const tenant = user.tenant;
        const { session, token: authToken } = await AuthService.createSession(user.id, user.tenantId, 'test-ip', 'E2E-Test-Agent');
        const permissions = await AuthService.getUserPermissions(user.businessRole || user.consultantRole);
        console.log('🧪 TEST ENDPOINT: Email verified and user logged in:', {
            email: user.email,
            userId: user.id,
            setupStatus: updateData.setupStatus || user.setupStatus,
            autoLogin: true
        });
        res.json({
            success: true,
            message: 'Email verified successfully (TEST MODE)',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.businessRole || user.consultantRole,
                setupStatus: updateData.setupStatus || user.setupStatus,
                isActive: user.isActive,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                type: tenant.tenantType,
                licenseStatus: tenant.licenseStatus,
            },
            token: authToken,
            permissions,
            expiresAt: session.expiresAt,
        });
    }
    catch (error) {
        console.error('Test verify email error:', error);
        res.status(500).json({ error: 'Failed to verify email (test mode)' });
    }
});
/**
 * GET /api/auth/test-get-verification-token
 * Test helper to retrieve verification token for E2E testing
 * DEVELOPMENT ONLY - Returns 404 in production
 */
router.post('/test-get-verification-token', async (req, res) => {
    // SECURITY: Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // SECURITY: Only allow for E2E test emails
        const isE2ETestEmail = email.toLowerCase().endsWith('@test.com');
        if (!isE2ETestEmail) {
            console.warn('⚠️ Test token endpoint blocked for non-test email:', email);
            return res.status(403).json({ error: 'Test endpoint only available for @test.com emails' });
        }
        // Find user in database
        const user = await db.query.users.findFirst({
            where: eq(users.email, email)
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('🧪 TEST HELPER: Retrieving verification token:', {
            email: user.email,
            userId: user.id,
            setupStatus: user.setupStatus,
            emailVerified: user.emailVerified,
            hasToken: !!user.emailVerificationToken,
            hasCode: !!user.emailVerificationCode
        });
        res.json({
            success: true,
            email: user.email,
            userId: user.id,
            setupStatus: user.setupStatus,
            emailVerified: user.emailVerified,
            verificationToken: user.emailVerificationToken,
            verificationCode: user.emailVerificationCode,
            tokenExpiry: user.emailVerificationTokenExpiry
        });
    }
    catch (error) {
        console.error('Test get verification token error:', error);
        res.status(500).json({ error: 'Failed to retrieve verification token' });
    }
});
/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', strictRateLimit.passwordChange, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Valid email address is required' });
        }
        // Find user by email
        const user = await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase()),
        });
        // Always return success to prevent email enumeration
        const successResponse = {
            success: true,
            message: 'If an account with that email exists, you will receive a password reset link.'
        };
        if (!user || !user.isActive) {
            // Still return success but don't send email
            return res.json(successResponse);
        }
        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        // Update user with reset token
        await db.update(users)
            .set({
            passwordResetToken: resetToken,
            passwordResetTokenExpiry: resetTokenExpiry,
            updatedAt: new Date()
        })
            .where(eq(users.id, user.id));
        // Send password reset email
        try {
            const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
            const emailSent = await emailService.sendPasswordResetEmail(user.email, resetToken, resetLink, user.firstName);
            if (!emailSent) {
                console.error('Failed to send password reset email to:', user.email);
            }
        }
        catch (emailError) {
            console.error('Error sending password reset email:', emailError);
            // Don't expose email sending errors to prevent information leakage
        }
        // Log audit event
        await AuthService.logAuditEvent(user.tenantId, user.id, 'PASSWORD_RESET_REQUESTED', 'user', user.id, { email: user.email });
        console.log('🔑 Password reset requested for:', user.email);
        res.json(successResponse);
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});
/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', strictRateLimit.passwordChange, async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;
        if (!token || !password || !confirmPassword) {
            return res.status(400).json({ error: 'Token, password, and password confirmation are required' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        // Find user with valid reset token
        const user = await db.query.users.findFirst({
            where: and(eq(users.passwordResetToken, token), sql `${users.passwordResetTokenExpiry} > NOW()`),
        });
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        // Hash new password
        const passwordHash = await AuthService.hashPassword(password);
        // Update user password and clear reset token
        await db.update(users)
            .set({
            passwordHash,
            passwordResetToken: null,
            passwordResetTokenExpiry: null,
            updatedAt: new Date()
        })
            .where(eq(users.id, user.id));
        // Revoke all existing sessions for security
        await db.update(userSessions)
            .set({ status: 'REVOKED' })
            .where(eq(userSessions.userId, user.id));
        // Log audit event
        await AuthService.logAuditEvent(user.tenantId, user.id, 'PASSWORD_RESET_COMPLETED', 'user', user.id, { email: user.email, sessionsRevoked: true });
        console.log('✅ Password reset completed for:', user.email);
        res.json({
            success: true,
            message: 'Password has been reset successfully. Please log in with your new password.'
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});
/**
 * POST /api/auth/admin/reset-stuck-user
 * Admin endpoint to manually reset a stuck user account
 * DEVELOPMENT ONLY - Returns 404 in production
 * TODO: In production, this should require admin authentication and permissions
 */
router.post('/admin/reset-stuck-user', async (req, res) => {
    // SECURITY: Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Find user by email
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('🔧 ADMIN RESET: Resetting stuck user account:', {
            email,
            userId: user.id,
            currentStatus: {
                emailVerified: user.emailVerified,
                setupStatus: user.setupStatus,
                hasPassword: !!user.passwordHash
            }
        });
        // SECURITY: Revoke all existing sessions for this user
        // This prevents stale tokens from being used after account reset
        await db.update(userSessions)
            .set({ status: 'REVOKED' })
            .where(eq(userSessions.userId, user.id));
        console.log('🔒 ADMIN RESET: Revoked all sessions for user:', {
            email,
            userId: user.id
        });
        // Generate new verification credentials
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        // Reset user to initial email_pending state
        await db.update(users)
            .set({
            emailVerified: false,
            emailVerifiedAt: null,
            setupStatus: 'email_pending',
            emailVerificationToken: verificationToken,
            emailVerificationCode: verificationCode,
            emailVerificationTokenExpiry: tokenExpiry,
            updatedAt: new Date()
        })
            .where(eq(users.id, user.id));
        // Log the admin reset action with actor identity
        await AuthService.logAuditEvent(user.tenantId, user.id, 'ADMIN_USER_RESET', 'user', user.id, {
            email,
            resetBy: 'development_admin',
            actorEmail: 'system',
            reason: 'stuck_registration_recovery',
            sessionsRevoked: true
        });
        console.log('✅ ADMIN RESET: User account reset successfully:', {
            email,
            userId: user.id,
            newVerificationCode: verificationCode,
            sessionsRevoked: true
        });
        res.json({
            success: true,
            message: 'User account reset successfully. All existing sessions have been revoked.',
            user: {
                id: user.id,
                email: user.email,
                setupStatus: 'email_pending',
                emailVerified: false
            },
            verificationCode, // Return code for testing purposes
            verificationToken,
            sessionsRevoked: true
        });
    }
    catch (error) {
        console.error('Admin reset stuck user error:', error);
        res.status(500).json({ error: 'Failed to reset user account' });
    }
});
// All routes require authentication except registration, login, and verification
router.use('/verify-email', (req, res, next) => next());
router.use('/verify-email-code', (req, res, next) => next());
router.use('/register-tenant', (req, res, next) => next());
router.use('/login', (req, res, next) => next());
router.use('/forgot-password', (req, res, next) => next());
router.use('/reset-password', (req, res, next) => next());
// Export the router
export default router;
