import { Router } from 'express';
import { eq, and, desc, gt, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { db } from '../db.js';
import { clientOrganizations, clientFacilities } from '../../shared/schema.js';
import { PaginationUtils, paginationParamsSchema } from '../utils/pagination.js';
const router = Router();
// Middleware - require authentication for all client organization routes
router.use(AuthService.authMiddleware);
// Validation schemas - match the database schema
const createClientOrgSchema = z.object({
    legalName: z.string().min(1, "Organization name is required"),
    dbaName: z.string().optional(),
    entityType: z.enum(["CORPORATION", "LLC", "PARTNERSHIP", "SOLE_PROPRIETORSHIP", "NON_PROFIT", "OTHER"]).optional(),
    taxId: z.string().optional(),
    hqAddress: z.string().min(1, "Address is required"),
    hqCity: z.string().min(1, "City is required"),
    hqState: z.string().min(1, "State is required"),
    hqZipCode: z.string().min(1, "ZIP code is required"),
    hqCountry: z.string().default("US"),
    primaryContactName: z.string().min(1, "Contact name is required"),
    primaryContactEmail: z.string().email("Valid email is required"),
    primaryContactPhone: z.string().optional(),
});
const updateClientOrgSchema = createClientOrgSchema.partial();
// GET /api/client-organizations - List all client organizations for consultant (with pagination)
router.get("/", async (req, res) => {
    try {
        // Parse and validate pagination parameters
        const paginationParams = paginationParamsSchema.safeParse(req.query);
        if (!paginationParams.success) {
            return res.status(400).json({
                error: "Invalid pagination parameters",
                details: paginationParams.error.errors
            });
        }
        const { limit, cursor, direction } = PaginationUtils.validateParams(paginationParams.data);
        // Build the base query condition
        const baseCondition = eq(clientOrganizations.consultantTenantId, req.tenant.id);
        // Build cursor condition if cursor is provided
        // Order: (legalName ASC, id ASC) - both ascending
        let cursorCondition;
        if (cursor) {
            const cursorLegalName = cursor.sortField || cursor.id; // Fallback for backward compat
            if (direction === 'forward') {
                // Forward ASC: (legalName > cursor.legalName) OR (legalName = cursor.legalName AND id > cursor.id)
                cursorCondition = or(gt(clientOrganizations.legalName, cursorLegalName), and(eq(clientOrganizations.legalName, cursorLegalName), gt(clientOrganizations.id, cursor.id)));
            }
            else {
                // Backward ASC: (legalName < cursor.legalName) OR (legalName = cursor.legalName AND id < cursor.id)
                cursorCondition = or(lt(clientOrganizations.legalName, cursorLegalName), and(eq(clientOrganizations.legalName, cursorLegalName), lt(clientOrganizations.id, cursor.id)));
            }
        }
        // Combine conditions
        const whereCondition = cursorCondition
            ? and(baseCondition, cursorCondition)
            : baseCondition;
        // Fetch limit + 1 to determine if there are more results
        // For backward navigation, invert ORDER BY, then reverse results
        let organizations = await db
            .select()
            .from(clientOrganizations)
            .where(whereCondition)
            .orderBy(direction === 'forward' ? clientOrganizations.legalName : desc(clientOrganizations.legalName), direction === 'forward' ? clientOrganizations.id : desc(clientOrganizations.id))
            .limit(limit + 1);
        // For backward navigation, reverse the results to maintain natural order
        if (direction === 'backward') {
            organizations = organizations.reverse();
        }
        // Build paginated response
        // For backward: sentinel is at START after reverse, skip it
        // For forward: sentinel is at END, take first limit items
        const hasMore = organizations.length > limit;
        const data = hasMore
            ? (direction === 'backward' ? organizations.slice(1) : organizations.slice(0, limit))
            : organizations;
        let nextCursor = null;
        let prevCursor = null;
        if (data.length > 0) {
            if (direction === 'forward' && hasMore) {
                const lastItem = data[data.length - 1];
                nextCursor = PaginationUtils.encodeCursor({
                    id: lastItem.id,
                    sortField: lastItem.legalName,
                    timestamp: lastItem.createdAt?.getTime(),
                });
            }
            // Only provide prevCursor if not on first page
            if (cursor) {
                const firstItem = data[0];
                prevCursor = PaginationUtils.encodeCursor({
                    id: firstItem.id,
                    sortField: firstItem.legalName,
                    timestamp: firstItem.createdAt?.getTime(),
                });
            }
        }
        res.json({
            data,
            pagination: {
                hasMore,
                nextCursor,
                prevCursor,
                totalReturned: data.length,
            },
        });
    }
    catch (error) {
        console.error("Error fetching client organizations:", error);
        res.status(500).json({ error: "Failed to fetch client organizations" });
    }
});
// GET /api/client-organizations/stats - Get stats for all client organizations
router.get("/stats", async (req, res) => {
    try {
        // Query the materialized view instead of N+1 queries
        // This provides a massive performance improvement for consultants with many client orgs
        const statsResults = await db.execute(sql `
      SELECT 
        client_organization_id,
        facility_count,
        assessment_count,
        active_count,
        completed_count
      FROM client_org_stats
      WHERE tenant_id = ${req.tenant.id}
    `);
        // Transform results into the expected format
        const statsMap = {};
        for (const row of statsResults.rows) {
            const totalAssessments = Number(row.assessment_count) || 0;
            const completedAssessments = Number(row.completed_count) || 0;
            const completionRate = totalAssessments > 0
                ? (completedAssessments / totalAssessments) * 100
                : 0;
            statsMap[row.client_organization_id] = {
                facilityCount: Number(row.facility_count) || 0,
                assessmentCount: totalAssessments,
                activeAssessmentCount: Number(row.active_count) || 0,
                completionRate: Math.round(completionRate)
            };
        }
        res.json(statsMap);
    }
    catch (error) {
        console.error("Error fetching client organization stats:", error);
        // If the materialized view doesn't exist, fall back to creating it
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.log('[ClientOrgs] Materialized view not found, attempting to initialize...');
            const { initializeViews } = await import('../services/materializedViews.js');
            try {
                await initializeViews();
                // Retry the query after initializing
                return res.status(503).json({
                    error: "Stats view is being initialized. Please try again in a moment.",
                    code: "VIEW_INITIALIZING"
                });
            }
            catch (initError) {
                console.error('[ClientOrgs] Failed to initialize materialized view:', initError);
            }
        }
        res.status(500).json({ error: "Failed to fetch client organization stats" });
    }
});
// POST /api/client-organizations - Create new client organization
router.post("/", async (req, res) => {
    try {
        const data = createClientOrgSchema.parse(req.body);
        const [organization] = await db.insert(clientOrganizations).values({
            tenantId: req.tenant.id,
            consultantTenantId: req.tenant.id,
            ...data,
        }).returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'CLIENT_ORGANIZATION_CREATED', 'client_organization', organization.id);
        res.status(201).json(organization);
    }
    catch (error) {
        console.error("Error creating client organization:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create client organization" });
    }
});
// GET /api/client-organizations/:id - Get specific client organization
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const organization = await db.query.clientOrganizations.findFirst({
            where: and(eq(clientOrganizations.id, id), eq(clientOrganizations.consultantTenantId, req.tenant.id)),
            with: {
                clientFacilities: true,
            }
        });
        if (!organization) {
            return res.status(404).json({ error: "Client organization not found" });
        }
        res.json(organization);
    }
    catch (error) {
        console.error("Error fetching client organization:", error);
        res.status(500).json({ error: "Failed to fetch client organization" });
    }
});
// GET /api/client-organizations/:id/facilities - Get facilities for a specific client
router.get("/:id/facilities", async (req, res) => {
    try {
        const { id } = req.params;
        // Verify the organization belongs to this consultant
        const organization = await db.query.clientOrganizations.findFirst({
            where: and(eq(clientOrganizations.id, id), eq(clientOrganizations.consultantTenantId, req.tenant.id)),
        });
        if (!organization) {
            return res.status(404).json({ error: "Client organization not found" });
        }
        // Get all facilities for this client organization
        const facilities = await db.query.clientFacilities.findMany({
            where: eq(clientFacilities.clientOrganizationId, id),
            orderBy: [clientFacilities.name],
        });
        res.json(facilities);
    }
    catch (error) {
        console.error("Error fetching client facilities:", error);
        res.status(500).json({ error: "Failed to fetch client facilities" });
    }
});
// PUT /api/client-organizations/:id - Update client organization
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateClientOrgSchema.parse(req.body);
        // Verify ownership
        const existingOrg = await db.query.clientOrganizations.findFirst({
            where: and(eq(clientOrganizations.id, id), eq(clientOrganizations.consultantTenantId, req.tenant.id)),
        });
        if (!existingOrg) {
            return res.status(404).json({ error: "Client organization not found" });
        }
        const [updatedOrg] = await db.update(clientOrganizations)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where(eq(clientOrganizations.id, id))
            .returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'CLIENT_ORGANIZATION_UPDATED', 'client_organization', id, { legalName: existingOrg.legalName }, { legalName: updatedOrg.legalName });
        res.json(updatedOrg);
    }
    catch (error) {
        console.error("Error updating client organization:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to update client organization" });
    }
});
// DELETE /api/client-organizations/:id - Delete client organization (soft delete)
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const existingOrg = await db.query.clientOrganizations.findFirst({
            where: and(eq(clientOrganizations.id, id), eq(clientOrganizations.consultantTenantId, req.tenant.id)),
            with: {
                clientFacilities: true,
            }
        });
        if (!existingOrg) {
            return res.status(404).json({ error: "Client organization not found" });
        }
        // Check if there are associated facilities
        if (existingOrg.clientFacilities.length > 0) {
            return res.status(400).json({
                error: "Cannot delete organization with associated facilities",
                facilityCount: existingOrg.clientFacilities.length
            });
        }
        // Soft delete: set isActive to false
        await db.update(clientOrganizations)
            .set({
            isActive: false,
            updatedAt: new Date()
        })
            .where(eq(clientOrganizations.id, id));
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'CLIENT_ORGANIZATION_ARCHIVED', 'client_organization', id, { legalName: existingOrg.legalName });
        res.status(204).send();
    }
    catch (error) {
        console.error("Error deleting client organization:", error);
        res.status(500).json({ error: "Failed to delete client organization" });
    }
});
export default router;
