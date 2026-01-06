import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { facilityProfiles, users, assessments } from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { AuthService } from "../services/authService";
import { LicenseService } from "../services/licenseService";
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
// Validation schemas
const createFacilitySchema = z.object({
    name: z.string().min(1, "Facility name is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z.string().min(1, "ZIP code is required"),
    country: z.string().default("US"),
    timeZone: z.string().default("America/New_York"),
    operatingStatus: z.string().default("ACTIVE"),
    hoursOfOperation: z.string().optional(),
    headcount: z.coerce.number().optional(),
    floorArea: z.coerce.number().optional(),
    processingActivities: z.array(z.string()).default([]),
    estimatedAnnualVolume: z.coerce.number().optional(),
    dataBearingHandling: z.boolean().default(false),
    focusMaterialsPresence: z.boolean().default(false),
    repairRefurbCapability: z.boolean().default(false),
    isPrimary: z.boolean().default(false)
});
const updateFacilitySchema = createFacilitySchema.partial();
// GET /api/facilities - List all facilities for tenant
router.get("/", async (req, res) => {
    try {
        const facilities = await db.query.facilityProfiles.findMany({
            where: and(eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true)),
            orderBy: [desc(facilityProfiles.isPrimary), facilityProfiles.name]
        });
        // Get assessment counts for each facility
        const facilitiesWithCounts = await Promise.all(facilities.map(async (facility) => {
            const assessmentCount = await db
                .select({ count: sql `count(*)` })
                .from(assessments)
                .where(and(eq(assessments.tenantId, req.tenant.id), eq(assessments.facilityId, facility.id)));
            return {
                ...facility,
                assessmentCount: assessmentCount[0]?.count || 0
            };
        }));
        res.json({ facilities: facilitiesWithCounts });
    }
    catch (error) {
        console.error("Error fetching facilities:", error);
        res.status(500).json({ error: "Failed to fetch facilities" });
    }
});
// GET /api/facilities/:id - Get single facility details
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const facility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, id), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true))
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        // Get related assessments
        const relatedAssessments = await db.query.assessments.findMany({
            where: and(eq(assessments.tenantId, req.tenant.id), eq(assessments.facilityId, facility.id)),
            orderBy: [desc(assessments.updatedAt)],
            limit: 10
        });
        res.json({
            ...facility,
            relatedAssessments
        });
    }
    catch (error) {
        console.error("Error fetching facility:", error);
        res.status(500).json({ error: "Failed to fetch facility" });
    }
});
// POST /api/facilities - Create new facility
router.post("/", async (req, res) => {
    try {
        const validatedData = createFacilitySchema.parse(req.body);
        // Validate license entitlements before creation
        const canAdd = await LicenseService.canAddFacility(req.tenant.id);
        if (!canAdd.allowed) {
            return res.status(403).json({
                error: canAdd.reason || 'Cannot add more facilities',
                code: 'FACILITY_LIMIT_EXCEEDED'
            });
        }
        // Check existing facilities for this tenant
        const existingFacilities = await db.query.facilityProfiles.findMany({
            where: and(eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true))
        });
        // Primary facility logic: enforce exactly one primary when facilities exist
        let isPrimary = validatedData.isPrimary;
        // If this is the first facility, it must be primary
        if (existingFacilities.length === 0) {
            isPrimary = true;
        }
        // If setting as primary, update ALL existing facilities to false first
        if (isPrimary) {
            await db.update(facilityProfiles)
                .set({ isPrimary: false, updatedAt: new Date() })
                .where(and(eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true)));
        }
        // If not setting as primary but no other primary exists, this must be primary
        if (!isPrimary && existingFacilities.length > 0) {
            const hasPrimary = existingFacilities.some(f => f.isPrimary);
            if (!hasPrimary) {
                isPrimary = true;
            }
        }
        // Create new facility
        const [newFacility] = await db.insert(facilityProfiles)
            .values({
            tenantId: req.tenant.id,
            ...validatedData,
            isPrimary
        })
            .returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_CREATED', 'facility', newFacility.id, undefined, { name: newFacility.name, isPrimary });
        res.status(201).json(newFacility);
    }
    catch (error) {
        console.error("Error creating facility:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create facility" });
    }
});
// PUT /api/facilities/:id - Update facility
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = updateFacilitySchema.parse(req.body);
        // Verify facility ownership
        const existingFacility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, id), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true))
        });
        if (!existingFacility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        // Handle primary facility changes - ensure only one primary exists
        if (validatedData.isPrimary && !existingFacility.isPrimary) {
            // Find and update existing primary facility
            const currentPrimary = await db.query.facilityProfiles.findFirst({
                where: and(eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isPrimary, true), eq(facilityProfiles.isActive, true))
            });
            if (currentPrimary && currentPrimary.id !== id) {
                await db.update(facilityProfiles)
                    .set({ isPrimary: false, updatedAt: new Date() })
                    .where(eq(facilityProfiles.id, currentPrimary.id));
            }
        }
        const [updatedFacility] = await db.update(facilityProfiles)
            .set({
            ...validatedData,
            updatedAt: new Date()
        })
            .where(eq(facilityProfiles.id, id))
            .returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_UPDATED', 'facility', id, { name: existingFacility.name }, { name: updatedFacility.name });
        res.json(updatedFacility);
    }
    catch (error) {
        console.error("Error updating facility:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to update facility" });
    }
});
// DELETE /api/facilities/:id - Soft delete facility
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // Verify facility ownership
        const existingFacility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, id), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true))
        });
        if (!existingFacility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        // Check if this is the primary facility
        if (existingFacility.isPrimary) {
            const otherActiveFacilities = await db.query.facilityProfiles.findMany({
                where: and(eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true), sql `${facilityProfiles.id} != ${id}`)
            });
            if (otherActiveFacilities.length === 0) {
                return res.status(400).json({
                    error: "Cannot delete the only facility. At least one facility must remain active."
                });
            }
            // Promote another facility to primary (ensures exactly one primary when facilities exist)
            await db.update(facilityProfiles)
                .set({ isPrimary: true, updatedAt: new Date() })
                .where(eq(facilityProfiles.id, otherActiveFacilities[0].id));
        }
        // Soft delete the facility
        await db.update(facilityProfiles)
            .set({
            isActive: false,
            updatedAt: new Date()
        })
            .where(eq(facilityProfiles.id, id));
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_DELETED', 'facility', id, { name: existingFacility.name, isActive: true }, { name: existingFacility.name, isActive: false });
        res.json({ message: "Facility deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting facility:", error);
        res.status(500).json({ error: "Failed to delete facility" });
    }
});
// POST /api/facilities/:id/assign-user - Assign user to facility by ID
router.post("/:id/assign-user", async (req, res) => {
    try {
        const { id: facilityId } = req.params;
        const { userId, role, permissions } = req.body;
        // Verify facility ownership and user exists
        const facility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, facilityId), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true))
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        const targetUser = await db.query.users.findFirst({
            where: and(eq(users.id, userId), eq(users.tenantId, req.tenant.id), eq(users.isActive, true))
        });
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }
        // Check if assignment already exists
        const existingAssignmentResult = await db.execute(sql `
      SELECT * FROM "UserFacilityScope" 
      WHERE "userId" = ${userId} AND "facilityId" = ${facilityId} AND "isActive" = true
    `);
        const existingAssignment = existingAssignmentResult.rows || existingAssignmentResult;
        if (existingAssignment.length > 0) {
            return res.status(400).json({ error: "User already assigned to this facility" });
        }
        // Create facility assignment
        const assignmentResult = await db.execute(sql `
      INSERT INTO "UserFacilityScope" ("userId", "facilityId", "role", "permissions", "assignedBy")
      VALUES (${userId}, ${facilityId}, ${role || 'facility_user'}, ${JSON.stringify(permissions || [])}, ${req.user.id})
      RETURNING *
    `);
        const assignment = assignmentResult.rows || assignmentResult;
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_USER_ASSIGNED', 'facility', facilityId, undefined, { userId, role, facilityName: facility.name });
        res.status(201).json({
            message: "User assigned successfully",
            assignment: assignment[0]
        });
    }
    catch (error) {
        console.error("Error assigning user to facility:", error);
        res.status(500).json({ error: "Failed to assign user" });
    }
});
// POST /api/facilities/:id/assign-user-by-email - Assign user to facility by email
router.post("/:id/assign-user-by-email", async (req, res) => {
    try {
        const { id: facilityId } = req.params;
        const { email, role, permissions } = req.body;
        // Verify facility ownership
        const facility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, facilityId), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true))
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        // Find user by email
        const targetUser = await db.query.users.findFirst({
            where: and(eq(users.email, email.toLowerCase()), eq(users.tenantId, req.tenant.id), eq(users.isActive, true))
        });
        if (!targetUser) {
            return res.status(404).json({ error: "User not found with that email address" });
        }
        // Check if assignment already exists
        const existingAssignmentResult2 = await db.execute(sql `
      SELECT * FROM "UserFacilityScope" 
      WHERE "userId" = ${targetUser.id} AND "facilityId" = ${facilityId} AND "isActive" = true
    `);
        const existingAssignment = existingAssignmentResult2.rows || existingAssignmentResult2;
        if (existingAssignment.length > 0) {
            return res.status(400).json({ error: "User already assigned to this facility" });
        }
        // Create facility assignment
        const assignmentResult2 = await db.execute(sql `
      INSERT INTO "UserFacilityScope" ("userId", "facilityId", "role", "permissions", "assignedBy")
      VALUES (${targetUser.id}, ${facilityId}, ${role || 'team_member'}, ${JSON.stringify(permissions || [])}, ${req.user.id})
      RETURNING *
    `);
        const assignment = assignmentResult2.rows || assignmentResult2;
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_USER_ASSIGNED', 'facility', facilityId, undefined, {
            userId: targetUser.id,
            userEmail: email,
            role,
            facilityName: facility.name
        });
        res.status(201).json({
            message: "User assigned successfully",
            assignment: assignment[0],
            user: {
                id: targetUser.id,
                firstName: targetUser.firstName,
                lastName: targetUser.lastName,
                email: targetUser.email
            }
        });
    }
    catch (error) {
        console.error("Error assigning user to facility by email:", error);
        res.status(500).json({ error: "Failed to assign user" });
    }
});
// GET /api/facilities/:id/users - Get users assigned to facility
router.get("/:id/users", async (req, res) => {
    try {
        const { id: facilityId } = req.params;
        // Verify facility access
        const facility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, facilityId), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true))
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        // Get assigned users
        const assignedUsers = await db.execute(sql `
      SELECT 
        ufs.*,
        u."firstName",
        u."lastName", 
        u."email",
        u."businessRole",
        u."consultantRole"
      FROM "UserFacilityScope" ufs
      JOIN "User" u ON ufs."userId" = u."id"
      WHERE ufs."facilityId" = ${facilityId} 
        AND ufs."isActive" = true 
        AND u."isActive" = true
      ORDER BY ufs."assignedAt" DESC
    `);
        res.json({
            facility: {
                id: facility.id,
                name: facility.name
            },
            assignedUsers
        });
    }
    catch (error) {
        console.error("Error fetching facility users:", error);
        res.status(500).json({ error: "Failed to fetch facility users" });
    }
});
// DELETE /api/facilities/:id/users/:userId - Remove user from facility
router.delete("/:id/users/:userId", async (req, res) => {
    try {
        const { id: facilityId, userId } = req.params;
        // Verify facility ownership
        const facility = await db.query.facilityProfiles.findFirst({
            where: and(eq(facilityProfiles.id, facilityId), eq(facilityProfiles.tenantId, req.tenant.id), eq(facilityProfiles.isActive, true))
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        // Remove assignment
        await db.execute(sql `
      UPDATE "UserFacilityScope" 
      SET "isActive" = false, "updatedAt" = now()
      WHERE "userId" = ${userId} AND "facilityId" = ${facilityId}
    `);
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'FACILITY_USER_REMOVED', 'facility', facilityId, { userId }, { facilityName: facility.name });
        res.json({ message: "User removed from facility successfully" });
    }
    catch (error) {
        console.error("Error removing user from facility:", error);
        res.status(500).json({ error: "Failed to remove user" });
    }
});
// GET /api/facilities/entitlements - Get license entitlements for facilities
router.get("/entitlements", async (req, res) => {
    try {
        const entitlements = await LicenseService.getLicenseEntitlements(req.tenant.id);
        const canAdd = await LicenseService.canAddFacility(req.tenant.id);
        res.json({
            ...entitlements,
            canAddFacility: canAdd.allowed,
            currentFacilities: canAdd.currentCount,
            facilityLimitReason: canAdd.reason
        });
    }
    catch (error) {
        console.error("Error fetching facility entitlements:", error);
        res.status(500).json({ error: "Failed to fetch facility entitlements" });
    }
});
// GET /api/user/facility-scope - Get user's facility-scoped permissions
router.get("/user/facility-scope", async (req, res) => {
    try {
        // Check if user has facility-specific assignments
        const userFacilityAssignmentsResult = await db.execute(sql `
      SELECT DISTINCT ufs."facilityId", fp."name" as "facilityName"
      FROM "UserFacilityScope" ufs
      JOIN "FacilityProfile" fp ON ufs."facilityId" = fp."id"
      WHERE ufs."userId" = ${req.user.id} 
        AND ufs."isActive" = true
        AND fp."isActive" = true
        AND fp."tenantId" = ${req.tenant.id}
    `);
        const userFacilityAssignments = userFacilityAssignmentsResult.rows || userFacilityAssignmentsResult;
        // If no specific assignments, user has access to all facilities (organization-wide role)
        const assignedFacilities = userFacilityAssignments.length > 0
            ? userFacilityAssignments.map((assignment) => assignment.facilityId)
            : null; // null means access to all facilities
        res.json({
            assignedFacilities,
            hasRestrictedAccess: assignedFacilities !== null,
            facilityAssignments: userFacilityAssignments
        });
    }
    catch (error) {
        console.error("Error fetching user facility scope:", error);
        res.status(500).json({ error: "Failed to fetch user facility scope" });
    }
});
export default router;
