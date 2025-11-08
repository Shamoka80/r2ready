import { Router } from "express";
import { z } from "zod";
import { db } from '../db.js';
import { intakeFacilities, intakeForms, insertIntakeFacilitySchema } from '../../shared/schema.js';
import { eq, and } from "drizzle-orm";
import { AuthService } from '../services/authService.js';
const router = Router();
router.use(AuthService.authMiddleware);
const updateIntakeFacilitySchema = z.object({
    nameIdentifier: z.string().optional(),
    address: z.string().optional(),
    squareFootage: z.string().optional(),
    zoning: z.string().optional(),
    employeesAtLocation: z.string().optional(),
    shifts: z.string().optional(),
    primaryFunction: z.string().optional(),
    processingActivities: z.array(z.string()).optional(),
    equipment: z.array(z.string()).optional(),
    electronicsTypes: z.array(z.string()).optional(),
});
router.get("/", async (req, res) => {
    try {
        const { intakeFormId } = req.query;
        if (!intakeFormId || typeof intakeFormId !== 'string') {
            return res.status(400).json({ error: "intakeFormId is required" });
        }
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, intakeFormId), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found" });
        }
        const facilities = await db.query.intakeFacilities.findMany({
            where: eq(intakeFacilities.intakeFormId, intakeFormId),
            orderBy: [intakeFacilities.facilityNumber],
        });
        return res.status(200).json(facilities);
    }
    catch (error) {
        console.error("Error fetching intake facilities:", error);
        return res.status(500).json({ error: "Failed to fetch facilities" });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const facility = await db.query.intakeFacilities.findFirst({
            where: eq(intakeFacilities.id, id),
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, facility.intakeFormId), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found or access denied" });
        }
        return res.status(200).json(facility);
    }
    catch (error) {
        console.error("Error fetching facility:", error);
        return res.status(500).json({ error: "Failed to fetch facility" });
    }
});
router.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = updateIntakeFacilitySchema.parse(req.body);
        const facility = await db.query.intakeFacilities.findFirst({
            where: eq(intakeFacilities.id, id),
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, facility.intakeFormId), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found or access denied" });
        }
        const [updatedFacility] = await db
            .update(intakeFacilities)
            .set(validatedData)
            .where(eq(intakeFacilities.id, id))
            .returning();
        return res.status(200).json(updatedFacility);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation failed", details: error.errors });
        }
        console.error("Error updating facility:", error);
        return res.status(500).json({ error: "Failed to update facility" });
    }
});
router.post("/", async (req, res) => {
    try {
        const validatedData = insertIntakeFacilitySchema.parse(req.body);
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, validatedData.intakeFormId), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found or access denied" });
        }
        const existingFacilities = await db.query.intakeFacilities.findMany({
            where: eq(intakeFacilities.intakeFormId, validatedData.intakeFormId),
        });
        const nextFacilityNumber = (existingFacilities.length + 1).toString();
        const [newFacility] = await db
            .insert(intakeFacilities)
            .values({
            ...validatedData,
            facilityNumber: nextFacilityNumber,
        })
            .returning();
        const newTotalFacilities = (existingFacilities.length + 1).toString();
        await db
            .update(intakeForms)
            .set({ totalFacilities: newTotalFacilities })
            .where(eq(intakeForms.id, validatedData.intakeFormId));
        return res.status(201).json(newFacility);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation failed", details: error.errors });
        }
        console.error("Error creating facility:", error);
        return res.status(500).json({ error: "Failed to create facility" });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const facility = await db.query.intakeFacilities.findFirst({
            where: eq(intakeFacilities.id, id),
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, facility.intakeFormId), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found or access denied" });
        }
        if (intakeForm.status === 'SUBMITTED') {
            return res.status(400).json({
                error: "Cannot delete facilities from submitted intake forms"
            });
        }
        await db.delete(intakeFacilities).where(eq(intakeFacilities.id, id));
        const remainingFacilities = await db.query.intakeFacilities.findMany({
            where: eq(intakeFacilities.intakeFormId, facility.intakeFormId),
            orderBy: [intakeFacilities.facilityNumber],
        });
        for (let i = 0; i < remainingFacilities.length; i++) {
            await db
                .update(intakeFacilities)
                .set({ facilityNumber: (i + 1).toString() })
                .where(eq(intakeFacilities.id, remainingFacilities[i].id));
        }
        const newTotalFacilities = remainingFacilities.length.toString();
        await db
            .update(intakeForms)
            .set({ totalFacilities: newTotalFacilities })
            .where(eq(intakeForms.id, facility.intakeFormId));
        return res.status(200).json({
            success: true,
            message: "Facility deleted successfully",
            remainingCount: remainingFacilities.length
        });
    }
    catch (error) {
        console.error("Error deleting facility:", error);
        return res.status(500).json({ error: "Failed to delete facility" });
    }
});
export default router;
