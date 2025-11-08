import { Router } from "express";
import { z } from "zod";
import { db } from '../db.js';
import { permissions, rolePermissions } from '../../shared/schema.js';
import { eq, sql } from "drizzle-orm";
import { AuthService } from '../services/authService.js';
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
// Validation schemas
const createRoleSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
});
const assignPermissionSchema = z.object({
    permissionId: z.string().uuid(),
    facilityId: z.string().uuid().optional(),
});
// GET /api/rbac/roles - List all unique roles
router.get('/roles', async (req, res) => {
    try {
        // Get all unique roles from rolePermissions table
        const rolesResult = await db.execute(sql `
      SELECT DISTINCT role, COUNT(*) as permission_count
      FROM "RolePermission"
      WHERE "isActive" = true
      GROUP BY role
      ORDER BY role
    `);
        const roles = rolesResult.rows.map((row) => ({
            id: row.role,
            name: row.role,
            permissionCount: parseInt(row.permission_count),
        }));
        res.json({ roles });
    }
    catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});
// GET /api/rbac/permissions - List all permissions
router.get('/permissions', async (req, res) => {
    try {
        const allPermissions = await db.select().from(permissions).where(eq(permissions.isActive, true));
        res.json({ permissions: allPermissions });
    }
    catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});
// POST /api/rbac/roles - Create new role
router.post('/roles', async (req, res) => {
    try {
        const data = createRoleSchema.parse(req.body);
        // Check if role already exists
        const existingRole = await db.execute(sql `
      SELECT 1 FROM "RolePermission" 
      WHERE role = ${data.name} AND "isActive" = true 
      LIMIT 1
    `);
        if (existingRole.rows && existingRole.rows.length > 0) {
            return res.status(400).json({ error: 'Role already exists' });
        }
        // Role created implicitly when first permission is assigned
        // For now, just return success with the role name
        res.status(201).json({
            role: {
                id: data.name,
                name: data.name,
                description: data.description,
                permissionCount: 0,
            }
        });
    }
    catch (error) {
        console.error('Error creating role:', error);
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: 'Invalid role data', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to create role' });
    }
});
// DELETE /api/rbac/roles/:roleId - Delete role (soft delete all permissions)
router.delete('/roles/:roleId', async (req, res) => {
    try {
        const { roleId } = req.params;
        // Soft delete all role permissions
        await db.execute(sql `
      UPDATE "RolePermission" 
      SET "isActive" = false 
      WHERE role = ${roleId}
    `);
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'ROLE_DELETED', 'role', roleId, undefined, { roleName: roleId });
        res.json({ success: true, message: 'Role deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: 'Failed to delete role' });
    }
});
// GET /api/rbac/roles/:roleId/permissions - Get permissions for a specific role
router.get('/roles/:roleId/permissions', async (req, res) => {
    try {
        const { roleId } = req.params;
        const rolePerms = await db.execute(sql `
      SELECT 
        rp.id,
        rp.role,
        rp."permissionId",
        rp."facilityId",
        p.name as "permissionName",
        p.resource,
        p.action,
        p.description
      FROM "RolePermission" rp
      JOIN "Permission" p ON rp."permissionId" = p.id
      WHERE rp.role = ${roleId} AND rp."isActive" = true AND p."isActive" = true
      ORDER BY p.resource, p.action
    `);
        res.json({ permissions: rolePerms.rows || [] });
    }
    catch (error) {
        console.error('Error fetching role permissions:', error);
        res.status(500).json({ error: 'Failed to fetch role permissions' });
    }
});
// POST /api/rbac/roles/:roleId/permissions - Assign permission to role
router.post('/roles/:roleId/permissions', async (req, res) => {
    try {
        const { roleId } = req.params;
        const data = assignPermissionSchema.parse(req.body);
        // Verify permission exists
        const permission = await db.query.permissions.findFirst({
            where: eq(permissions.id, data.permissionId),
        });
        if (!permission) {
            return res.status(404).json({ error: 'Permission not found' });
        }
        // Check if already assigned
        const existingAssignment = await db.execute(sql `
      SELECT 1 FROM "RolePermission" 
      WHERE role = ${roleId} 
        AND "permissionId" = ${data.permissionId} 
        AND "isActive" = true
        ${data.facilityId ? sql `AND "facilityId" = ${data.facilityId}` : sql `AND "facilityId" IS NULL`}
      LIMIT 1
    `);
        if (existingAssignment.rows && existingAssignment.rows.length > 0) {
            return res.status(400).json({ error: 'Permission already assigned to this role' });
        }
        // Assign permission to role
        const [rolePermission] = await db.insert(rolePermissions).values({
            role: roleId,
            permissionId: data.permissionId,
            facilityId: data.facilityId,
        }).returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'ROLE_PERMISSION_ASSIGNED', 'role_permission', rolePermission.id, undefined, {
            role: roleId,
            permissionId: data.permissionId,
            permissionName: permission.name,
            facilityId: data.facilityId
        });
        res.status(201).json({ rolePermission });
    }
    catch (error) {
        console.error('Error assigning permission to role:', error);
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: 'Invalid permission assignment', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to assign permission to role' });
    }
});
// DELETE /api/rbac/roles/:roleId/permissions/:permissionId - Remove permission from role
router.delete('/roles/:roleId/permissions/:permissionId', async (req, res) => {
    try {
        const { roleId, permissionId } = req.params;
        // Soft delete the role permission
        const result = await db.execute(sql `
      UPDATE "RolePermission" 
      SET "isActive" = false 
      WHERE role = ${roleId} AND "permissionId" = ${permissionId}
      RETURNING id
    `);
        if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({ error: 'Role permission assignment not found' });
        }
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'ROLE_PERMISSION_REMOVED', 'role_permission', result.rows[0].id, undefined, { role: roleId, permissionId });
        res.json({ success: true, message: 'Permission removed from role' });
    }
    catch (error) {
        console.error('Error removing permission from role:', error);
        res.status(500).json({ error: 'Failed to remove permission from role' });
    }
});
export default router;
