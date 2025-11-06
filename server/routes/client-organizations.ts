import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { AuthService, AuthenticatedRequest } from '../services/authService';
import { db } from '../db.js';
import { clientOrganizations, clientFacilities } from '../../shared/schema.js';

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

// GET /api/client-organizations - List all client organizations for consultant
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const organizations = await db.query.clientOrganizations.findMany({
      where: eq(clientOrganizations.consultantTenantId, req.tenant!.id),
      orderBy: [clientOrganizations.legalName],
    });

    res.json(organizations);
  } catch (error) {
    console.error("Error fetching client organizations:", error);
    res.status(500).json({ error: "Failed to fetch client organizations" });
  }
});

// GET /api/client-organizations/stats - Get stats for all client organizations
router.get("/stats", async (req: AuthenticatedRequest, res) => {
  try {
    const { db: dbInstance } = await import('../db.js');
    const { assessments } = await import('../../shared/schema.js');
    const { sql } = await import('drizzle-orm');

    const organizations = await db.query.clientOrganizations.findMany({
      where: eq(clientOrganizations.consultantTenantId, req.tenant!.id),
      with: {
        clientFacilities: true,
      }
    });

    const statsMap: Record<string, any> = {};

    for (const org of organizations) {
      const assessmentCounts = await dbInstance
        .select({
          status: assessments.status,
          count: sql<number>`count(*)`
        })
        .from(assessments)
        .where(and(
          eq(assessments.tenantId, req.tenant!.id),
          eq(assessments.clientOrganizationId, org.id)
        ))
        .groupBy(assessments.status);

      const totalAssessments = assessmentCounts.reduce((sum, a) => sum + Number(a.count), 0);
      const activeAssessments = assessmentCounts
        .filter(a => a.status === 'IN_PROGRESS' || a.status === 'DRAFT')
        .reduce((sum, a) => sum + Number(a.count), 0);
      const completedAssessments = assessmentCounts
        .filter(a => a.status === 'COMPLETED')
        .reduce((sum, a) => sum + Number(a.count), 0);

      const completionRate = totalAssessments > 0 
        ? (completedAssessments / totalAssessments) * 100 
        : 0;

      statsMap[org.id] = {
        facilityCount: org.clientFacilities?.length || 0,
        assessmentCount: totalAssessments,
        activeAssessmentCount: activeAssessments,
        completionRate: Math.round(completionRate)
      };
    }

    res.json(statsMap);
  } catch (error) {
    console.error("Error fetching client organization stats:", error);
    res.status(500).json({ error: "Failed to fetch client organization stats" });
  }
});

// POST /api/client-organizations - Create new client organization
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const data = createClientOrgSchema.parse(req.body);

    const [organization] = await db.insert(clientOrganizations).values({
      tenantId: req.tenant!.id,
      consultantTenantId: req.tenant!.id,
      ...data,
    }).returning();

    // Log audit event
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'CLIENT_ORGANIZATION_CREATED',
      'client_organization',
      organization.id
    );

    res.status(201).json(organization);
  } catch (error) {
    console.error("Error creating client organization:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: "Failed to create client organization" });
  }
});

// GET /api/client-organizations/:id - Get specific client organization
router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const organization = await db.query.clientOrganizations.findFirst({
      where: and(
        eq(clientOrganizations.id, id),
        eq(clientOrganizations.consultantTenantId, req.tenant!.id)
      ),
      with: {
        clientFacilities: true,
      }
    });

    if (!organization) {
      return res.status(404).json({ error: "Client organization not found" });
    }

    res.json(organization);
  } catch (error) {
    console.error("Error fetching client organization:", error);
    res.status(500).json({ error: "Failed to fetch client organization" });
  }
});

// GET /api/client-organizations/:id/facilities - Get facilities for a specific client
router.get("/:id/facilities", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Verify the organization belongs to this consultant
    const organization = await db.query.clientOrganizations.findFirst({
      where: and(
        eq(clientOrganizations.id, id),
        eq(clientOrganizations.consultantTenantId, req.tenant!.id)
      ),
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
  } catch (error) {
    console.error("Error fetching client facilities:", error);
    res.status(500).json({ error: "Failed to fetch client facilities" });
  }
});

// PUT /api/client-organizations/:id - Update client organization
router.put("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateClientOrgSchema.parse(req.body);

    // Verify ownership
    const existingOrg = await db.query.clientOrganizations.findFirst({
      where: and(
        eq(clientOrganizations.id, id),
        eq(clientOrganizations.consultantTenantId, req.tenant!.id)
      ),
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
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'CLIENT_ORGANIZATION_UPDATED',
      'client_organization',
      id,
      { legalName: existingOrg.legalName },
      { legalName: updatedOrg.legalName }
    );

    res.json(updatedOrg);
  } catch (error) {
    console.error("Error updating client organization:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: "Failed to update client organization" });
  }
});

// DELETE /api/client-organizations/:id - Delete client organization (soft delete)
router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existingOrg = await db.query.clientOrganizations.findFirst({
      where: and(
        eq(clientOrganizations.id, id),
        eq(clientOrganizations.consultantTenantId, req.tenant!.id)
      ),
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
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'CLIENT_ORGANIZATION_ARCHIVED',
      'client_organization',
      id,
      { legalName: existingOrg.legalName }
    );

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting client organization:", error);
    res.status(500).json({ error: "Failed to delete client organization" });
  }
});

export default router;