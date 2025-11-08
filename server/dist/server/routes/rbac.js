import { Router } from "express";
import { z } from "zod";
import { db } from '../db.js';
import { users, facilityProfiles } from '../../shared/schema.js';
import { eq, and, sql } from "drizzle-orm";
import { AuthService, requireFacilityPermission, getUserFacilityPermissions } from '../services/authService.js';
import { requireFlag } from '../lib/flags.js';
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
// All routes require multi_facility feature flag
router.use(requireFlag('multi_facility'));
// Validation schemas
const assignUserToFacilitySchema = z.object({
    userId: z.string().uuid(),
    facilityRole: z.string().optional(),
    permissions: z.array(z.string()).default([]),
    canManageUsers: z.boolean().default(false),
    canManageAssessments: z.boolean().default(true),
    canViewReports: z.boolean().default(true),
    canEditFacility: z.boolean().default(false),
});
const updateUserFacilityPermissionsSchema = z.object({
    facilityRole: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    canManageUsers: z.boolean().optional(),
    canManageAssessments: z.boolean().optional(),
    canViewReports: z.boolean().optional(),
    canEditFacility: z.boolean().optional(),
});
// GET /api/rbac/facilities/:facilityId/users - Get users assigned to a facility
router.get('/facilities/:facilityId/users', requireFacilityPermission('manage_users'), async (req, res) => {
    try {
        const { facilityId } = req.params;
        // Get facility details
        const facility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, facilityId), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true)),
        });
        if (!facility) {
            return res.status(404).json({ error: 'Facility not found' });
        }
        // Get users assigned to this facility
        const facilityUsers = await db.execute(sql `
      SELECT 
        ufs.*,
        u."firstName",
        u."lastName", 
        u."email",
        u."businessRole",
        u."consultantRole",
        u."isActive" as "userActive"
      FROM "UserFacilityScope" ufs
      JOIN "User" u ON ufs."userId" = u."id"
      WHERE ufs."facilityId" = ${facilityId} 
        AND ufs."isActive" = true 
        AND u."tenantId" = ${req.tenant.id}
      ORDER BY ufs."assignedAt" DESC
    `);
        res.json({
            facility: {
                id: facility.id,
                name: facility.name,
            },
            users: facilityUsers.rows || [],
        });
    }
    catch (error) {
        console.error('Error fetching facility users:', error);
        res.status(500).json({ error: 'Failed to fetch facility users' });
    }
});
// POST /api/rbac/facilities/:facilityId/assign-user - Assign user to facility with specific permissions
router.post('/facilities/:facilityId/assign-user', requireFacilityPermission('manage_users'), async (req, res) => {
    try {
        const { facilityId } = req.params;
        const data = assignUserToFacilitySchema.parse(req.body);
        // Verify facility exists and user has access
        const facility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, facilityId), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true)),
        });
        if (!facility) {
            return res.status(404).json({ error: 'Facility not found' });
        }
        // Verify target user exists in same tenant
        const targetUser = await db.query.users.findFirst({
            where: and(eq(users.id, data.userId), eq(users.tenantId, req.tenant.id), eq(users.isActive, true)),
        });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Check if assignment already exists
        const existingAssignment = await db.execute(sql `
      SELECT * FROM "UserFacilityScope" 
      WHERE "userId" = ${data.userId} AND "facilityId" = ${facilityId} AND "isActive" = true
    `);
        if (existingAssignment.rows && existingAssignment.rows.length > 0) {
            return res.status(400).json({ error: 'User already assigned to this facility' });
        }
        // Create facility assignment
        const assignment = await db.execute(sql `
      INSERT INTO "UserFacilityScope" (
        "userId", "facilityId", "facilityRole", "permissions", 
        "canManageUsers", "canManageAssessments", "canViewReports", "canEditFacility",
        "assignedBy"
      )
      VALUES (
        ${data.userId}, ${facilityId}, ${data.facilityRole || 'viewer'}, 
        ${JSON.stringify(data.permissions)}, 
        ${data.canManageUsers}, ${data.canManageAssessments}, 
        ${data.canViewReports}, ${data.canEditFacility},
        ${req.user.id}
      )
      RETURNING *
    `);
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_USER_ASSIGNED', 'facility', facilityId, undefined, {
            userId: data.userId,
            facilityRole: data.facilityRole,
            permissions: data.permissions,
            facilityName: facility.name,
            targetUserEmail: targetUser.email
        });
        res.status(201).json({
            message: 'User assigned successfully',
            assignment: assignment.rows?.[0] || null,
        });
    }
    catch (error) {
        console.error('Error assigning user to facility:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to assign user' });
    }
});
// PUT /api/rbac/facilities/:facilityId/users/:userId - Update user's facility permissions
router.put('/facilities/:facilityId/users/:userId', requireFacilityPermission('manage_users'), async (req, res) => {
    try {
        const { facilityId, userId } = req.params;
        const data = updateUserFacilityPermissionsSchema.parse(req.body);
        // Verify assignment exists
        const existingAssignment = await db.execute(sql `
      SELECT * FROM "UserFacilityScope" 
      WHERE "userId" = ${userId} AND "facilityId" = ${facilityId} AND "isActive" = true
    `);
        if (!existingAssignment.rows || existingAssignment.rows.length === 0) {
            return res.status(404).json({ error: 'User assignment not found' });
        }
        const currentAssignment = existingAssignment.rows[0];
        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        if (data.facilityRole !== undefined) {
            updateFields.push(`"facilityRole" = $${paramIndex++}`);
            updateValues.push(data.facilityRole);
        }
        if (data.permissions !== undefined) {
            updateFields.push(`"permissions" = $${paramIndex++}`);
            updateValues.push(JSON.stringify(data.permissions));
        }
        if (data.canManageUsers !== undefined) {
            updateFields.push(`"canManageUsers" = $${paramIndex++}`);
            updateValues.push(data.canManageUsers);
        }
        if (data.canManageAssessments !== undefined) {
            updateFields.push(`"canManageAssessments" = $${paramIndex++}`);
            updateValues.push(data.canManageAssessments);
        }
        if (data.canViewReports !== undefined) {
            updateFields.push(`"canViewReports" = $${paramIndex++}`);
            updateValues.push(data.canViewReports);
        }
        if (data.canEditFacility !== undefined) {
            updateFields.push(`"canEditFacility" = $${paramIndex++}`);
            updateValues.push(data.canEditFacility);
        }
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No update fields provided' });
        }
        // Add updatedAt
        updateFields.push(`"updatedAt" = $${paramIndex++}`);
        updateValues.push(new Date().toISOString());
        // Add WHERE clause parameters
        updateValues.push(userId, facilityId);
        const updateQuery = `
      UPDATE "UserFacilityScope" 
      SET ${updateFields.join(', ')}
      WHERE "userId" = $${paramIndex++} AND "facilityId" = $${paramIndex++} AND "isActive" = true
      RETURNING *
    `;
        const updatedAssignment = await db.execute(sql.raw(updateQuery));
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_USER_PERMISSIONS_UPDATED', 'facility', facilityId, {
            facilityRole: currentAssignment.facilityRole,
            permissions: currentAssignment.permissions,
            canManageUsers: currentAssignment.canManageUsers,
            canManageAssessments: currentAssignment.canManageAssessments,
            canViewReports: currentAssignment.canViewReports,
            canEditFacility: currentAssignment.canEditFacility,
        }, data);
        res.json({
            message: 'User permissions updated successfully',
            assignment: updatedAssignment.rows?.[0] || null,
        });
    }
    catch (error) {
        console.error('Error updating user facility permissions:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to update user permissions' });
    }
});
// DELETE /api/rbac/facilities/:facilityId/users/:userId - Remove user from facility
router.delete('/facilities/:facilityId/users/:userId', requireFacilityPermission('manage_users'), async (req, res) => {
    try {
        const { facilityId, userId } = req.params;
        // Verify assignment exists
        const existingAssignment = await db.execute(sql `
      SELECT ufs.*, u."email", fp."name" as "facilityName"
      FROM "UserFacilityScope" ufs
      JOIN "User" u ON ufs."userId" = u."id"
      JOIN "FacilityProfile" fp ON ufs."facilityId" = fp."id"
      WHERE ufs."userId" = ${userId} AND ufs."facilityId" = ${facilityId} AND ufs."isActive" = true
    `);
        if (!existingAssignment.rows || existingAssignment.rows.length === 0) {
            return res.status(404).json({ error: 'User assignment not found' });
        }
        const assignment = existingAssignment.rows[0];
        // Soft delete the assignment
        await db.execute(sql `
      UPDATE "UserFacilityScope"
      SET "isActive" = false, "updatedAt" = ${new Date().toISOString()}
      WHERE "userId" = ${userId} AND "facilityId" = ${facilityId} AND "isActive" = true
    `);
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_USER_REMOVED', 'facility', facilityId, {
            userId,
            facilityRole: assignment.facilityRole,
            userEmail: assignment.email,
            facilityName: assignment.facilityName,
        }, undefined);
        res.json({ message: 'User removed from facility successfully' });
    }
    catch (error) {
        console.error('Error removing user from facility:', error);
        res.status(500).json({ error: 'Failed to remove user from facility' });
    }
});
// GET /api/rbac/users/:userId/facilities - Get facilities assigned to a user
router.get('/users/:userId/facilities', async (req, res) => {
    try {
        const { userId } = req.params;
        // Verify user exists in same tenant
        const user = await db.query.users.findFirst({
            where: and(eq(users.id, userId), eq(users.tenantId, req.tenant.id)),
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Get facility permissions for this user
        const facilityPermissions = await getUserFacilityPermissions(userId);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.businessRole || user.consultantRole,
            },
            facilityPermissions,
        });
    }
    catch (error) {
        console.error('Error fetching user facilities:', error);
        res.status(500).json({ error: 'Failed to fetch user facilities' });
    }
});
// GET /api/rbac/my-facilities - Get current user's facility permissions
router.get('/my-facilities', async (req, res) => {
    try {
        const facilityPermissions = await getUserFacilityPermissions(req.user.id);
        res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                role: req.user.businessRole || req.user.consultantRole,
            },
            facilityPermissions,
        });
    }
    catch (error) {
        console.error('Error fetching current user facilities:', error);
        res.status(500).json({ error: 'Failed to fetch facility permissions' });
    }
});
export default router;
