import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db.js';
import { users, tenants, userSessions, rolePermissions, auditLog, facilityProfiles, assessments } from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';
class JWTManager {
    config;
    initialized = false;
    constructor() {
        this.config = this.loadConfiguration();
        this.validateConfiguration();
        this.initialized = true;
    }
    loadConfiguration() {
        const { JWT_SECRET, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_ALGORITHM = 'HS256', JWT_ACTIVE_KID = 'default', JWT_NEXT_KID, JWT_NEXT_SECRET, JWT_NEXT_PRIVATE_KEY } = process.env;
        // Determine algorithm based on available keys
        let algorithm = 'HS256';
        if (JWT_PRIVATE_KEY && JWT_PUBLIC_KEY) {
            // Check if it's Ed25519 key
            if (JWT_PRIVATE_KEY.includes('PRIVATE KEY') && JWT_PUBLIC_KEY.includes('PUBLIC KEY')) {
                algorithm = JWT_PRIVATE_KEY.includes('Ed25519') ? 'EdDSA' : 'RS256';
            }
        }
        else if (JWT_ALGORITHM) {
            algorithm = JWT_ALGORITHM;
        }
        return {
            algorithm,
            secret: JWT_SECRET,
            privateKey: JWT_PRIVATE_KEY,
            publicKey: JWT_PUBLIC_KEY,
            activeKid: JWT_ACTIVE_KID,
            nextKid: JWT_NEXT_KID,
            nextSecret: JWT_NEXT_SECRET,
            nextPrivateKey: JWT_NEXT_PRIVATE_KEY
        };
    }
    validateConfiguration() {
        const { algorithm, secret, privateKey, publicKey } = this.config;
        switch (algorithm) {
            case 'HS256':
                if (!secret) {
                    console.error('❌ JWT Configuration Error: JWT_SECRET is required for HS256 algorithm');
                    process.exit(1);
                }
                if (secret.length < 32) {
                    console.error('❌ JWT Configuration Error: JWT_SECRET must be at least 32 characters for security');
                    process.exit(1);
                }
                break;
            case 'RS256':
            case 'EdDSA':
                if (!privateKey || !publicKey) {
                    console.error(`❌ JWT Configuration Error: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required for ${algorithm} algorithm`);
                    process.exit(1);
                }
                break;
            default:
                console.error(`❌ JWT Configuration Error: Unsupported algorithm: ${algorithm}`);
                process.exit(1);
        }
        console.log(`✅ JWT initialized with ${algorithm} algorithm, kid: ${this.config.activeKid}`);
    }
    getHealthInfo() {
        return {
            algorithm: this.config.algorithm,
            kid: this.config.activeKid,
            keysLoaded: this.initialized,
            nextKidAvailable: !!this.config.nextKid
        };
    }
    generateToken(payload) {
        const { algorithm, secret, privateKey, activeKid } = this.config;
        const jwtPayload = {
            ...payload,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        };
        const options = {
            algorithm: algorithm,
            keyid: activeKid
        };
        switch (algorithm) {
            case 'HS256':
                return jwt.sign(jwtPayload, secret, options);
            case 'RS256':
            case 'EdDSA':
                return jwt.sign(jwtPayload, privateKey, options);
            default:
                throw new Error(`Unsupported algorithm: ${algorithm}`);
        }
    }
    verifyToken(token) {
        try {
            // Decode header to get kid
            const decoded = jwt.decode(token, { complete: true });
            const kid = decoded?.header?.kid || 'default';
            // Try active key first
            if (kid === this.config.activeKid) {
                return this.verifyWithActiveKey(token);
            }
            // Try next key if available and kid matches
            if (this.config.nextKid && kid === this.config.nextKid) {
                return this.verifyWithNextKey(token);
            }
            // Fallback: try both keys for rotation scenarios
            try {
                return this.verifyWithActiveKey(token);
            }
            catch {
                if (this.config.nextKid) {
                    return this.verifyWithNextKey(token);
                }
                throw new Error('Invalid signature');
            }
        }
        catch (error) {
            return null;
        }
    }
    verifyWithActiveKey(token) {
        const { algorithm, secret, publicKey } = this.config;
        switch (algorithm) {
            case 'HS256':
                return jwt.verify(token, secret, { algorithms: ['HS256'] });
            case 'RS256':
            case 'EdDSA':
                return jwt.verify(token, publicKey, { algorithms: [algorithm] });
            default:
                throw new Error(`Unsupported algorithm: ${algorithm}`);
        }
    }
    verifyWithNextKey(token) {
        const { algorithm, nextSecret, nextPrivateKey } = this.config;
        if (!this.config.nextKid) {
            throw new Error('No next key available');
        }
        switch (algorithm) {
            case 'HS256':
                if (!nextSecret)
                    throw new Error('Next secret not available');
                return jwt.verify(token, nextSecret, { algorithms: ['HS256'] });
            case 'RS256':
            case 'EdDSA':
                if (!nextPrivateKey)
                    throw new Error('Next private key not available');
                // For asymmetric keys, we need the corresponding public key
                // In production, you'd have JWT_NEXT_PUBLIC_KEY
                const nextPublicKey = process.env.JWT_NEXT_PUBLIC_KEY || this.config.publicKey;
                return jwt.verify(token, nextPublicKey, { algorithms: [algorithm] });
            default:
                throw new Error(`Unsupported algorithm: ${algorithm}`);
        }
    }
}
// Initialize JWT manager
const jwtManager = new JWTManager();
export class AuthService {
    /**
     * Get JWT health information
     */
    static getJWTHealth() {
        return jwtManager.getHealthInfo();
    }
    /**
     * Hash password using bcrypt
     */
    static async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }
    /**
     * Verify password against hash
     */
    static async verifyPassword(password, hash) {
        // Simply verify password against hash - security validation happens during registration
        return await bcrypt.compare(password, hash);
    }
    /**
     * Generate JWT token
     */
    static generateToken(payload) {
        return jwtManager.generateToken(payload);
    }
    /**
     * Verify JWT token
     */
    static verifyToken(token) {
        return jwtManager.verifyToken(token);
    }
    /**
     * Create session and return token
     */
    static async createSession(userId, tenantId, ipAddress, userAgent) {
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        // Generate token first so we can store it in the session
        const token = this.generateToken({
            userId,
            tenantId,
            sessionId,
        });
        const [session] = await db.insert(userSessions).values({
            id: sessionId,
            userId,
            tenantId,
            sessionToken: token,
            status: 'ACTIVE',
            ipAddress,
            userAgent,
            expiresAt,
            lastActivityAt: new Date(),
        }).returning();
        return { session, token };
    }
    /**
     * Get user by session token
     */
    static async getUserBySession(token) {
        try {
            const decoded = this.verifyToken(token);
            if (!decoded || !decoded.sessionId) {
                return null;
            }
            // Get session
            const session = await db.query.userSessions.findFirst({
                where: and(eq(userSessions.id, decoded.sessionId), eq(userSessions.status, 'ACTIVE')),
            });
            if (!session || session.expiresAt < new Date()) {
                return null;
            }
            // Get user and tenant
            const user = await db.query.users.findFirst({
                where: eq(users.id, session.userId),
            });
            const tenant = await db.query.tenants.findFirst({
                where: eq(tenants.id, session.tenantId),
            });
            if (!user || !tenant || !user.isActive) {
                return null;
            }
            // Get permissions
            const userRole = user.businessRole || user.consultantRole;
            const permissions = await this.getUserPermissions(userRole);
            return { user, tenant, session, permissions };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Authentication middleware
     */
    static authMiddleware = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'No valid authorization header' });
            }
            const token = authHeader.substring(7);
            const authContext = await AuthService.getUserBySession(token);
            if (!authContext) {
                return res.status(401).json({ error: 'Invalid session' });
            }
            req.user = authContext.user;
            req.tenant = authContext.tenant;
            req.session = authContext.session;
            req.permissions = authContext.permissions;
            next();
        }
        catch (error) {
            res.status(401).json({ error: 'Authentication failed' });
        }
    };
    /**
     * Authenticate user and create session
     */
    static async authenticate(email, password, ipAddress, userAgent) {
        try {
            // Find user with tenant
            const user = await db.query.users.findFirst({
                where: eq(users.email, email),
                with: {
                    tenant: true,
                },
            });
            if (!user || !user.isActive || !user.passwordHash) {
                return null;
            }
            // Check password
            const isValidPassword = await this.verifyPassword(password, user.passwordHash);
            if (!isValidPassword) {
                return null;
            }
            // Create session
            const { session, token } = await this.createSession(user.id, user.tenantId, ipAddress, userAgent);
            // Get permissions
            const userRole = user.businessRole || user.consultantRole;
            const permissions = await this.getUserPermissions(userRole);
            // Log audit event
            await this.logAuditEvent(user.tenantId, user.id, 'SESSION_CREATED', 'session', session.id, undefined, undefined, { ipAddress, userAgent });
            return {
                user,
                tenant: user.tenant,
                session,
                token,
                permissions,
            };
        }
        catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }
    /**
     * Logout user (revoke session)
     */
    static async logout(sessionId) {
        await db.update(userSessions)
            .set({ status: 'REVOKED' })
            .where(eq(userSessions.id, sessionId));
    }
    /**
     * Get user permissions by role
     */
    static async getUserPermissions(role) {
        if (!role)
            return [];
        // Superuser accounts have all permissions
        if (role === 'business_owner' || role === 'consultant_owner') {
            return ['*'];
        }
        try {
            const rolePerms = await db.query.rolePermissions.findMany({
                where: and(eq(rolePermissions.role, role), eq(rolePermissions.isActive, true)),
                with: {
                    permission: true,
                },
            });
            return rolePerms
                .filter((rp) => rp.permission?.isActive)
                .map((rp) => rp.permission?.name);
        }
        catch (error) {
            console.error('Error getting permissions:', error);
            return [];
        }
    }
    /**
     * Check if user has specific permission
     */
    static async hasPermission(userId, permission) {
        try {
            const user = await db.query.users.findFirst({
                where: eq(users.id, userId),
            });
            if (!user)
                return false;
            const userRole = user.businessRole || user.consultantRole;
            const permissions = await this.getUserPermissions(userRole);
            return permissions.includes('*') || permissions.includes(permission);
        }
        catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }
    /**
     * Create tenant with owner user
     */
    static async createTenant(name, tenantType, ownerEmail, ownerFirstName, ownerLastName, domain) {
        const tenantId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const tenantResult = await db.insert(tenants).values({
            id: tenantId,
            name,
            tenantType,
            domain,
            isActive: true,
            licenseStatus: 'inactive',
        }).returning();
        const tenant = tenantResult.rows ? tenantResult.rows[0] : tenantResult[0];
        const ownerRole = tenantType === 'BUSINESS' ? 'business_owner' : 'consultant_owner';
        const userResult = await db.insert(users).values({
            id: userId,
            tenantId,
            email: ownerEmail,
            firstName: ownerFirstName,
            lastName: ownerLastName,
            businessRole: tenantType === 'BUSINESS' ? ownerRole : null,
            consultantRole: tenantType === 'CONSULTANT' ? ownerRole : null,
            isActive: true,
            invitedAt: new Date(),
        }).returning();
        const user = Array.isArray(userResult) ? userResult[0] : userResult.rows[0];
        return { tenant, user };
    }
    /**
     * Invite user to tenant
     */
    static async inviteUser(tenantId, invitedBy, email, firstName, lastName, role, sendEmail = false) {
        // Check if user already exists in tenant
        const existingUser = await db.query.users.findFirst({
            where: and(eq(users.email, email), eq(users.tenantId, tenantId)),
        });
        if (existingUser) {
            throw new Error('User already exists in this tenant');
        }
        const userId = crypto.randomUUID();
        const isBusinessRole = ['business_owner', 'facility_manager', 'compliance_officer', 'team_member', 'viewer'].includes(role);
        const userResult = await db.insert(users).values({
            id: userId,
            tenantId,
            email,
            firstName,
            lastName,
            businessRole: isBusinessRole ? role : null,
            consultantRole: !isBusinessRole ? role : null,
            isActive: true,
            invitedBy,
            invitedAt: new Date(),
        }).returning();
        const user = Array.isArray(userResult) ? userResult[0] : userResult.rows[0];
        // Log audit event
        await this.logAuditEvent(tenantId, invitedBy, 'USER_INVITED', 'user', userId, undefined, { email, role });
        return user;
    }
    /**
     * Assign role to user
     */
    static async assignRole(userId, role, assignedBy) {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });
        if (!user) {
            throw new Error('User not found');
        }
        const oldRole = user.businessRole || user.consultantRole;
        const isBusinessRole = ['business_owner', 'facility_manager', 'compliance_officer', 'team_member', 'viewer'].includes(role);
        await db.update(users)
            .set({
            businessRole: isBusinessRole ? role : null,
            consultantRole: !isBusinessRole ? role : null,
        })
            .where(eq(users.id, userId));
        // Log audit event
        await this.logAuditEvent(user.tenantId, assignedBy, 'ROLE_ASSIGNED', 'user', userId, { role: oldRole }, { role });
    }
    /**
     * Validate tenant access
     */
    static async validateTenantAccess(userId, tenantId) {
        try {
            const user = await db.query.users.findFirst({
                where: and(eq(users.id, userId), eq(users.tenantId, tenantId), eq(users.isActive, true)),
            });
            return !!user;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Log audit event
     */
    static async logAuditEvent(tenantId, userId, action, resource, resourceId, oldValues, newValues, metadata, ipAddress, userAgent) {
        try {
            await db.insert(auditLog).values({
                id: crypto.randomUUID(),
                tenantId,
                userId,
                action,
                resource,
                resourceId,
                oldValues,
                newValues,
                metadata,
                ipAddress,
                userAgent,
                timestamp: new Date(),
            });
        }
        catch (error) {
            console.error('Error logging audit event:', error);
        }
    }
    /**
     * Checks facility access for a given assessment.
     * Returns true if the user has access or if there's no facility restriction.
     * Returns false if the user does not have access.
     */
    static async checkFacilityPermissionFromAssessment(assessmentId, userId, tenantId) {
        try {
            // Get assessment with facility info
            const assessment = await db.query.assessments.findFirst({
                where: and(eq(assessments.id, assessmentId), eq(assessments.tenantId, tenantId))
            });
            if (!assessment?.facilityId) {
                return true; // No facility restriction
            }
            // Get user role
            const user = await db.query.users.findFirst({
                where: eq(users.id, userId)
            });
            if (!user) {
                return false;
            }
            // Check if user has admin role (full access)
            if (user.businessRole && ['business_owner', 'account_admin'].includes(user.businessRole)) {
                return true;
            }
            // Fetch user's facility access details
            const facilityPermissions = await getUserFacilityPermissions(user.id, assessment.facilityId);
            // Check if the user has direct access to the facility
            if (!facilityPermissions.facilities.includes(assessment.facilityId)) {
                return false;
            }
            // Check for specific assessment permissions if applicable
            // For now, direct facility access implies assessment access
            return true;
        }
        catch (error) {
            console.error('Error checking facility permission from assessment:', error);
            return false;
        }
    }
}
export const checkFacilityAccess = async (userId, facilityId) => {
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            with: { tenant: true }
        });
        if (!user)
            return false;
        // Check if user has access to this facility
        const facility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, facilityId), eq(facilityProfiles.tenantId, user.tenantId))
        });
        return !!facility;
    }
    catch (error) {
        console.error('Error checking facility access:', error);
        return false;
    }
};
// Helper to check facility access via assessment ID
export const requireFacilityPermissionFromAssessment = (permission) => {
    return async (req, res, next) => {
        try {
            // Support both :id and :assessmentId parameter names
            const assessmentId = req.params.assessmentId || req.params.id;
            if (!assessmentId) {
                return res.status(400).json({ error: 'Assessment ID required' });
            }
            // Get assessment and its facility
            const assessment = await db.query.assessments.findFirst({
                where: eq(assessments.id, assessmentId)
            });
            if (!assessment) {
                return res.status(404).json({ error: 'Assessment not found' });
            }
            if (!assessment.facilityId) {
                return res.status(400).json({ error: 'Assessment has no associated facility' });
            }
            // For admin roles, allow access
            const userRole = req.user.businessRole;
            if (['business_owner', 'account_admin'].includes(userRole)) {
                return next();
            }
            // Check facility-specific permission
            const facilityPermissions = await getUserFacilityPermissions(req.user.id, assessment.facilityId);
            if (!facilityPermissions.facilities.includes(assessment.facilityId)) {
                return res.status(403).json({ error: 'Access denied: No facility access' });
            }
            // Add facility context to request
            req.facilityId = assessment.facilityId;
            req.facilityPermissions = facilityPermissions;
            next();
        }
        catch (error) {
            console.error('Error checking facility permission from assessment:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
};
// Enhanced facility access control with granular permissions
export const getUserFacilityPermissions = async (userId, facilityId) => {
    try {
        // If facilityId is provided, check specific facility permissions
        if (facilityId) {
            const facilityScope = await db.execute(sql `
        SELECT * FROM "UserFacilityScope" 
        WHERE "userId" = ${userId} AND "facilityId" = ${facilityId} AND "isActive" = true
      `);
            if (facilityScope.rows && facilityScope.rows.length > 0) {
                const scope = facilityScope.rows[0];
                return {
                    facilities: [facilityId],
                    facilityRoles: { [facilityId]: scope.facilityRole || 'viewer' },
                    facilityPermissions: { [facilityId]: scope.permissions || [] },
                    canManageUsers: { [facilityId]: scope.canManageUsers || false },
                    canManageAssessments: { [facilityId]: scope.canManageAssessments || true },
                    canViewReports: { [facilityId]: scope.canViewReports || true },
                    canEditFacility: { [facilityId]: scope.canEditFacility || false },
                };
            }
        }
        // Get all facility assignments for the user
        const facilityScopes = await db.execute(sql `
      SELECT ufs.*, fp."name" as "facilityName"
      FROM "UserFacilityScope" ufs
      JOIN "FacilityProfile" fp ON ufs."facilityId" = fp."id"
      WHERE ufs."userId" = ${userId} AND ufs."isActive" = true AND fp."isActive" = true
    `);
        // If user has specific facility assignments, return those
        if (facilityScopes.rows && facilityScopes.rows.length > 0) {
            const facilities = [];
            const facilityRoles = {};
            const facilityPermissions = {};
            const canManageUsers = {};
            const canManageAssessments = {};
            const canViewReports = {};
            const canEditFacility = {};
            facilityScopes.rows.forEach((scope) => {
                facilities.push(scope.facilityId);
                facilityRoles[scope.facilityId] = scope.facilityRole || 'viewer';
                facilityPermissions[scope.facilityId] = scope.permissions || [];
                canManageUsers[scope.facilityId] = scope.canManageUsers || false;
                canManageAssessments[scope.facilityId] = scope.canManageAssessments || true;
                canViewReports[scope.facilityId] = scope.canViewReports || true;
                canEditFacility[scope.facilityId] = scope.canEditFacility || false;
            });
            return {
                facilities,
                facilityRoles,
                facilityPermissions,
                canManageUsers,
                canManageAssessments,
                canViewReports,
                canEditFacility,
            };
        }
        // If no specific assignments, get all facilities for the user's tenant (legacy behavior)
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });
        if (!user) {
            return {
                facilities: [],
                facilityRoles: {},
                facilityPermissions: {},
                canManageUsers: {},
                canManageAssessments: {},
                canViewReports: {},
                canEditFacility: {},
            };
        }
        const tenantFacilities = await db.query.facilityProfiles.findMany({
            where: and(eq(facilityProfiles.tenantId, user.tenantId), eq(facilityProfiles.isActive, true)),
        });
        // Default permissions based on user role
        const userRole = user.businessRole || user.consultantRole;
        const isAdmin = userRole === 'business_owner' || userRole === 'consultant_owner';
        const isFacilityManager = userRole === 'facility_manager';
        const facilities = tenantFacilities.map(f => f.id);
        const facilityRoles = {};
        const facilityPermissions = {};
        const canManageUsers = {};
        const canManageAssessments = {};
        const canViewReports = {};
        const canEditFacility = {};
        facilities.forEach(facilityId => {
            facilityRoles[facilityId] = userRole || 'viewer';
            facilityPermissions[facilityId] = ['view'];
            canManageUsers[facilityId] = isAdmin || isFacilityManager;
            canManageAssessments[facilityId] = true;
            canViewReports[facilityId] = true;
            canEditFacility[facilityId] = isAdmin || isFacilityManager;
        });
        return {
            facilities,
            facilityRoles,
            facilityPermissions,
            canManageUsers,
            canManageAssessments,
            canViewReports,
            canEditFacility,
        };
    }
    catch (error) {
        console.error('Error getting facility permissions:', error);
        return {
            facilities: [],
            facilityRoles: {},
            facilityPermissions: {},
            canManageUsers: {},
            canManageAssessments: {},
            canViewReports: {},
            canEditFacility: {},
        };
    }
};
// Facility-specific permission checking middleware
export const requireFacilityPermission = (permission) => {
    return async (req, res, next) => {
        try {
            const facilityId = req.params.facilityId || req.body.facilityId || req.query.facilityId;
            if (!facilityId) {
                return res.status(400).json({ error: 'Facility ID is required' });
            }
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const facilityPermissions = await getUserFacilityPermissions(req.user.id, facilityId);
            if (!facilityPermissions.facilities.includes(facilityId)) {
                return res.status(403).json({ error: 'Access denied to this facility' });
            }
            let hasPermission = false;
            switch (permission) {
                case 'manage_users':
                    hasPermission = facilityPermissions.canManageUsers[facilityId] || false;
                    break;
                case 'manage_assessments':
                    hasPermission = facilityPermissions.canManageAssessments[facilityId] || false;
                    break;
                case 'view_reports':
                    hasPermission = facilityPermissions.canViewReports[facilityId] || false;
                    break;
                case 'edit_facility':
                    hasPermission = facilityPermissions.canEditFacility[facilityId] || false;
                    break;
            }
            if (!hasPermission) {
                return res.status(403).json({ error: `Permission denied: ${permission}` });
            }
            // Attach facility permissions to request for downstream use
            req.facilityPermissions = facilityPermissions;
            next();
        }
        catch (error) {
            console.error('Error checking facility permission:', error);
            res.status(500).json({ error: 'Permission check failed' });
        }
    };
};
