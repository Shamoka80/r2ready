import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { AuthService } from '../services/authService.js';
import { db } from '../db.js';
import { clientFacilities, clientOrganizations } from '../../shared/schema.js';
const router = Router();
// Middleware - require authentication for all client facility routes
router.use(AuthService.authMiddleware);
// Validation schemas
const createClientFacilitySchema = z.object({
    name: z.string().min(1, "Facility name is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z.string().min(1, "ZIP code is required"),
    country: z.string().default("US"),
    operatingStatus: z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'MAINTENANCE']).default('ACTIVE'),
    clientOrganizationId: z.string().min(1, "Client organization ID is required"),
});
const updateClientFacilitySchema = createClientFacilitySchema.partial();
// GET /api/client-facilities - List all client facilities for consultant
router.get("/", async (req, res) => {
    try {
        const facilities = await db.query.clientFacilities.findMany({
            where: eq(clientFacilities.tenantId, req.tenant.id),
            with: {
                clientOrganization: {
                    columns: {
                        id: true,
                        name: true,
                    }
                }
            },
            orderBy: [clientFacilities.name],
        });
        res.json(facilities);
    }
    catch (error) {
        console.error("Error fetching client facilities:", error);
        res.status(500).json({ error: "Failed to fetch client facilities" });
    }
});
// POST /api/client-facilities - Create new client facility
router.post("/", async (req, res) => {
    try {
        const data = createClientFacilitySchema.parse(req.body);
        // Verify that the client organization belongs to this consultant
        const organization = await db.query.clientOrganizations.findFirst({
            where: and(eq(clientOrganizations.id, data.clientOrganizationId), eq(clientOrganizations.tenantId, req.tenant.id)),
        });
        if (!organization) {
            return res.status(404).json({ error: "Client organization not found or access denied" });
        }
        const [facility] = await db.insert(clientFacilities).values({
            tenantId: req.tenant.id,
            ...data,
        }).returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'CLIENT_FACILITY_CREATED', 'client_facility', facility.id);
        // Return facility with organization info
        const facilityWithOrg = await db.query.clientFacilities.findFirst({
            where: eq(clientFacilities.id, facility.id),
            with: {
                clientOrganization: {
                    columns: {
                        id: true,
                        name: true,
                    }
                }
            }
        });
        res.status(201).json(facilityWithOrg);
    }
    catch (error) {
        console.error("Error creating client facility:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create client facility" });
    }
});
// GET /api/client-facilities/:id - Get specific client facility
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const facility = await db.query.clientFacilities.findFirst({
            where: and(eq(clientFacilities.id, id), eq(clientFacilities.tenantId, req.tenant.id)),
            with: {
                clientOrganization: true,
            }
        });
        if (!facility) {
            return res.status(404).json({ error: "Client facility not found" });
        }
        res.json(facility);
    }
    catch (error) {
        console.error("Error fetching client facility:", error);
        res.status(500).json({ error: "Failed to fetch client facility" });
    }
});
// PUT /api/client-facilities/:id - Update client facility
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateClientFacilitySchema.parse(req.body);
        // Verify ownership
        const existingFacility = await db.query.clientFacilities.findFirst({
            where: and(eq(clientFacilities.id, id), eq(clientFacilities.tenantId, req.tenant.id)),
        });
        if (!existingFacility) {
            return res.status(404).json({ error: "Client facility not found" });
        }
        // If clientOrganizationId is being updated, verify the new organization belongs to this consultant
        if (data.clientOrganizationId && data.clientOrganizationId !== existingFacility.clientOrganizationId) {
            const organization = await db.query.clientOrganizations.findFirst({
                where: and(eq(clientOrganizations.id, data.clientOrganizationId), eq(clientOrganizations.tenantId, req.tenant.id)),
            });
            if (!organization) {
                return res.status(404).json({ error: "Client organization not found or access denied" });
            }
        }
        const [updatedFacility] = await db.update(clientFacilities)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where(eq(clientFacilities.id, id))
            .returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'CLIENT_FACILITY_UPDATED', 'client_facility', id, { name: existingFacility.name }, { name: updatedFacility.name });
        // Return facility with organization info
        const facilityWithOrg = await db.query.clientFacilities.findFirst({
            where: eq(clientFacilities.id, id),
            with: {
                clientOrganization: {
                    columns: {
                        id: true,
                        name: true,
                    }
                }
            }
        });
        res.json(facilityWithOrg);
    }
    catch (error) {
        console.error("Error updating client facility:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to update client facility" });
    }
});
// DELETE /api/client-facilities/:id - Delete client facility
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const existingFacility = await db.query.clientFacilities.findFirst({
            where: and(eq(clientFacilities.id, id), eq(clientFacilities.tenantId, req.tenant.id)),
        });
        if (!existingFacility) {
            return res.status(404).json({ error: "Client facility not found" });
        }
        // TODO: Check if there are associated assessments before deletion
        // For now, allow deletion but this should be enhanced later
        await db.delete(clientFacilities)
            .where(eq(clientFacilities.id, id));
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'CLIENT_FACILITY_DELETED', 'client_facility', id, { name: existingFacility.name });
        res.status(204).send();
    }
    catch (error) {
        console.error("Error deleting client facility:", error);
        res.status(500).json({ error: "Failed to delete client facility" });
    }
});
export default router;
