import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { intakeForms, assessments, facilityProfiles } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AuthService } from '../services/authService';
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
// GET /api/intake-forms/status - Check if user has completed intake form
router.get('/status', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        console.log('Checking intake form status for tenant:', tenantId);
        // Check if user has any intake forms
        const allForms = await db.query.intakeForms.findMany({
            where: eq(intakeForms.tenantId, tenantId),
            orderBy: desc(intakeForms.updatedAt),
            limit: 5
        });
        // Find the most recent submitted form
        const submittedForm = allForms.find(form => form.status === 'SUBMITTED' || form.status === 'APPROVED');
        // Find the most recent draft form
        const draftForm = allForms.find(form => form.status === 'DRAFT' || form.status === 'IN_PROGRESS');
        const response = {
            success: true,
            hasIntakeForm: !!submittedForm,
            hasActiveDraft: !!draftForm,
            status: submittedForm?.status || draftForm?.status || null,
            currentFormId: submittedForm?.id || draftForm?.id || null,
            completionPercentage: submittedForm?.completionPercentage || draftForm?.completionPercentage || 0,
            totalForms: allForms.length,
            forms: allForms.map(form => ({
                id: form.id,
                status: form.status,
                title: form.title || form.legalCompanyName,
                completionPercentage: form.completionPercentage || 0,
                updatedAt: form.updatedAt
            }))
        };
        console.log('Intake form status response:', {
            hasIntakeForm: response.hasIntakeForm,
            hasActiveDraft: response.hasActiveDraft,
            totalForms: response.totalForms
        });
        res.json(response);
    }
    catch (error) {
        console.error('Error checking intake form status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check intake form status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Validation schemas
const createIntakeFormSchema = z.object({
    facilityId: z.string().uuid(),
    formData: z.record(z.any()),
    submittedBy: z.string().uuid().optional()
});
const updateIntakeFormSchema = z.object({
    formData: z.record(z.any()).optional(),
    status: z.enum(['DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional()
});
// GET /api/intake-forms - Get intake forms for user's facilities
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant.id;
        console.log(`Getting intake forms for tenant: ${tenantId}`);
        // Get intake forms for the tenant
        const forms = await db
            .select({
            id: intakeForms.id,
            title: intakeForms.title,
            legalCompanyName: intakeForms.legalCompanyName,
            status: intakeForms.status,
            submittedAt: intakeForms.submittedAt,
            createdAt: intakeForms.createdAt,
            completionPercentage: intakeForms.completionPercentage
        })
            .from(intakeForms)
            .where(eq(intakeForms.tenantId, tenantId))
            .orderBy(desc(intakeForms.createdAt))
            .limit(100);
        console.log(`Found ${forms.length} intake forms`);
        // Return in both formats for compatibility
        res.json({
            success: true,
            data: forms,
            forms: forms // For backward compatibility
        });
    }
    catch (error) {
        console.error('Error fetching intake forms:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch intake forms',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// POST /api/intake-forms - Create new intake form
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant.id;
        console.log('Creating new intake form for user:', userId, 'tenant:', tenantId);
        // Create intake form with minimal required data
        const [newForm] = await db.insert(intakeForms).values({
            tenantId: tenantId,
            userId: userId,
            status: 'DRAFT',
            title: `Intake Form - ${new Date().toLocaleDateString()}`,
            totalDownstreamVendors: '0', // Default value for validation
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();
        console.log('New intake form created:', newForm.id);
        res.status(201).json({
            success: true,
            data: newForm
        });
    }
    catch (error) {
        console.error('Error creating intake form:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to create intake form'
        });
    }
});
// GET /api/intake-forms/:id - Get specific intake form
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        const form = await db
            .select({
            id: intakeForms.id,
            facilityId: intakeForms.facilityId,
            formData: intakeForms.formData,
            status: intakeForms.status,
            submittedBy: intakeForms.submittedBy,
            submittedAt: intakeForms.submittedAt,
            createdAt: intakeForms.createdAt,
            updatedAt: intakeForms.updatedAt,
            facilityName: facilityProfiles.name
        })
            .from(intakeForms)
            .leftJoin(facilityProfiles, eq(intakeForms.facilityId, facilityProfiles.id))
            .where(and(eq(intakeForms.id, id), eq(facilityProfiles.tenantId, tenantId)))
            .limit(1);
        if (form.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Intake form not found'
            });
        }
        res.json({
            success: true,
            data: form[0]
        });
    }
    catch (error) {
        console.error('Error fetching intake form:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch intake form'
        });
    }
});
// PUT /api/intake-forms/:id - Update intake form
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        console.log('Updating intake form:', id, 'for tenant:', tenantId);
        // Verify form exists and user has access - check direct tenant ownership
        const existingForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, tenantId))
        });
        if (!existingForm) {
            return res.status(404).json({
                success: false,
                error: 'Intake form not found'
            });
        }
        // Build update data from request body
        const updateData = {
            updatedAt: new Date()
        };
        // Map all intake form fields from request body
        const fieldsToUpdate = [
            'legalCompanyName', 'businessEntityType', 'totalFacilities', 'certificationStructureType',
            'processingActivities', 'electronicsTypes', 'equipment', 'totalEmployees', 'operatingSchedule',
            'totalDownstreamVendors', 'internationalShipments', 'primaryCountries', 'applicableAppendices',
            'certificationType', 'hqStreet', 'hqCity', 'hqStateProvince', 'hqCountry', 'hqPostalCode',
            'email', 'mainPhone', 'primaryR2ContactName', 'primaryR2ContactEmail', 'primaryR2ContactPhone',
            'currentStep', 'isComplete', 'completionPercentage'
        ];
        fieldsToUpdate.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        // Update status if provided
        if (req.body.status) {
            updateData.status = req.body.status;
        }
        const [updatedForm] = await db
            .update(intakeForms)
            .set(updateData)
            .where(eq(intakeForms.id, id))
            .returning();
        console.log('Intake form updated successfully:', id);
        res.json({
            success: true,
            data: updatedForm
        });
    }
    catch (error) {
        console.error('Error updating intake form:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update intake form',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// POST /api/intake-forms/:id/submit - Submit intake form
router.post('/:id/submit', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        console.log(`Submitting intake form ${id} for tenant ${tenantId}`);
        // Verify form exists and user has access - check direct tenant ownership first
        const existingForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, tenantId))
        });
        if (!existingForm) {
            console.error(`Intake form ${id} not found for tenant ${tenantId}`);
            return res.status(404).json({
                success: false,
                error: 'Intake form not found'
            });
        }
        if (existingForm.status === 'SUBMITTED') {
            // Check if there's already an assessment for this intake form
            const existingAssessment = await db.query.assessments.findFirst({
                where: eq(assessments.intakeFormId, id)
            });
            console.log(`Intake form ${id} already submitted`);
            return res.json({
                success: true,
                message: 'Intake form already submitted',
                data: {
                    ...existingForm,
                    assessmentId: existingAssessment?.id
                }
            });
        }
        // Update form status to SUBMITTED
        const [submittedForm] = await db
            .update(intakeForms)
            .set({
            status: 'SUBMITTED',
            submittedAt: new Date(),
            submittedBy: req.user.id,
            updatedAt: new Date()
        })
            .where(eq(intakeForms.id, id))
            .returning();
        console.log(`Intake form ${id} submitted successfully`);
        // Check if an assessment was created during submission process
        const createdAssessment = await db.query.assessments.findFirst({
            where: eq(assessments.intakeFormId, id)
        });
        res.json({
            success: true,
            message: 'Intake form submitted successfully',
            data: {
                ...submittedForm,
                assessmentId: createdAssessment?.id
            }
        });
    }
    catch (error) {
        console.error('Error submitting intake form:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit intake form',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// DELETE /api/intake-forms/:id - Delete intake form
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant.id;
        // Verify form exists and user has access
        const existingForm = await db
            .select({ id: intakeForms.id })
            .from(intakeForms)
            .leftJoin(facilityProfiles, eq(intakeForms.facilityId, facilityProfiles.id))
            .where(and(eq(intakeForms.id, id), eq(facilityProfiles.tenantId, tenantId)))
            .limit(1);
        if (existingForm.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Intake form not found'
            });
        }
        await db.delete(intakeForms).where(eq(intakeForms.id, id));
        res.json({
            success: true,
            message: 'Intake form deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting intake form:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete intake form'
        });
    }
});
export default router;
