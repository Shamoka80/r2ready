import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { intakeForms, intakeAnswers, intakeFacilities, intakeQuestions, assessments, standardVersions, answers } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { AuthService } from "../services/authService";
import { IntakeProcessor } from "./intakeLogic.js";
const router = Router();
// All routes require authentication
router.use(AuthService.authMiddleware);
// Validation schemas
const createIntakeFormSchema = z.object({
    title: z.string().optional(),
    legalCompanyName: z.string().optional(),
    // Pre-population fields from onboarding data
    businessEntityType: z.enum(["CORPORATION", "LLC", "PARTNERSHIP", "OTHER"]).optional(),
    taxIdEin: z.string().optional(),
    // Address information
    hqStreet: z.string().optional(),
    hqCity: z.string().optional(),
    hqStateProvince: z.string().optional(),
    hqCountry: z.string().optional(),
    hqPostalCode: z.string().optional(),
    // Contact information
    email: z.string().nullish(),
    mainPhone: z.string().nullish(),
    primaryR2ContactName: z.string().nullish(),
    primaryR2ContactEmail: z.string().nullish(),
    primaryR2ContactPhone: z.string().nullish(),
    // Operational information
    totalFacilities: z.string().optional(),
    operatingSchedule: z.string().optional(),
    totalEmployees: z.string().optional(),
});
const updateIntakeFormSchema = z.object({
    // Section 1: Legal Entity Information
    title: z.string().nullish(),
    legalCompanyName: z.string().nullish(),
    dbaTradeNames: z.string().nullish(),
    businessEntityType: z.enum(["CORPORATION", "LLC", "PARTNERSHIP", "OTHER"]).nullish(),
    taxIdEin: z.string().nullish(),
    yearEstablished: z.string().nullish(),
    primaryBusinessLicense: z.string().nullish(),
    // Headquarters Address
    hqStreet: z.string().nullish(),
    hqCity: z.string().nullish(),
    hqStateProvince: z.string().nullish(),
    hqCountry: z.string().nullish(),
    hqPostalCode: z.string().nullish(),
    // Primary Contact
    mainPhone: z.string().nullish(),
    email: z.string().nullish(),
    website: z.string().nullish(),
    // Section 2: Key Personnel
    primaryR2ContactName: z.string().nullish(),
    primaryR2ContactTitle: z.string().nullish(),
    primaryR2ContactEmail: z.string().nullish(),
    primaryR2ContactPhone: z.string().nullish(),
    topMgmtRepName: z.string().nullish(),
    topMgmtRepTitle: z.string().nullish(),
    topMgmtRepEmail: z.string().nullish(),
    topMgmtRepPhone: z.string().nullish(),
    dataProtectionRepName: z.string().nullish(),
    dataProtectionRepTitle: z.string().nullish(),
    // Section 3: Facility Structure
    totalFacilities: z.string().nullish(),
    certificationStructureType: z.enum(["SINGLE", "CAMPUS", "SHARED", "COMMON_PARENT", "GROUP", "UNSURE"]).nullish(),
    // Section 4: Workforce & Operations
    totalEmployees: z.string().nullish(),
    seasonalWorkforceVariations: z.boolean().nullish(),
    seasonalRangeFrom: z.string().nullish(),
    seasonalRangeTo: z.string().nullish(),
    operatingSchedule: z.string().nullish(),
    languagesSpokenByMgmt: z.string().nullish(),
    // Section 5: Current Certifications
    ehsmsType: z.string().nullish(),
    ehsmsYear: z.string().nullish(),
    qmsType: z.string().nullish(),
    qmsYear: z.string().nullish(),
    otherCertifications: z.string().nullish(),
    // Section 6: Processing Activities & Scope
    processingActivities: z.array(z.string()).nullish(),
    electronicsTypes: z.array(z.string()).nullish(),
    equipment: z.array(z.string()).nullish(),
    monthlyTonnage: z.string().nullish(),
    annualVolume: z.string().nullish(),
    focusMaterials: z.array(z.string()).nullish(),
    // Section 7: Downstream Vendor Information
    totalDownstreamVendors: z.string().nullish(),
    numR2CertifiedDsv: z.string().nullish(),
    numNonR2Dsv: z.string().nullish(),
    internationalShipments: z.boolean().nullish(),
    primaryCountries: z.string().nullish(),
    // Section 8: Applicable R2v3 Appendices
    applicableAppendices: z.array(z.string()).nullish(),
    // Section 9: Certification Objectives
    certificationType: z.enum(["INITIAL", "RECERTIFICATION", "TRANSFER", "SCOPE_EXTENSION", "OTHER"]).nullish(),
    previousR2CertHistory: z.string().nullish(),
    targetTimeline: z.string().nullish(),
    businessDrivers: z.string().nullish(),
    // Section 10: Initial Compliance Status
    legalComplianceStatus: z.string().nullish(),
    recentViolations: z.string().nullish(),
    seriDeceptivePracticesCheck: z.string().nullish(),
    dataSecurityReadiness: z.string().nullish(),
    // Section 11: Preliminary Assessment
    estimatedAuditTimeCategory: z.string().nullish(),
    complexityFactors: z.array(z.string()).nullish(),
    integrationOpportunities: z.string().nullish(),
    // Section 12: Administrative Tracking
    fileClientId: z.string().nullish(),
    cbReference: z.string().nullish(),
    leadAuditor: z.string().nullish(),
    teamMember: z.string().nullish(),
    technicalSpecialist: z.string().nullish(),
    nextStepsRequired: z.array(z.string()).nullish(),
    specialConsiderations: z.string().nullish(),
    // Meta fields
    currentStep: z.number().nullish(),
    isComplete: z.boolean().nullish(),
    updatedAt: z.string().nullish(),
});
const saveAnswerSchema = z.object({
    intakeQuestionId: z.string(),
    value: z.any(),
    notes: z.string().optional(),
});
const addFacilitySchema = z.object({
    facilityNumber: z.string(),
    nameIdentifier: z.string().optional(),
    address: z.string().optional(),
    squareFootage: z.string().optional(),
    primaryFunction: z.string().optional(),
});
// POST /api/intake-forms - Create new intake form
router.post("/", async (req, res) => {
    try {
        const data = createIntakeFormSchema.parse(req.body);
        const [intakeForm] = await db.insert(intakeForms).values({
            tenantId: req.tenant.id,
            userId: req.user.id,
            title: data.title || `${req.tenant.name} R2v3 Intake`,
            status: "DRAFT",
            // Legal entity information (pre-populated from onboarding)
            legalCompanyName: data.legalCompanyName,
            businessEntityType: data.businessEntityType,
            taxIdEin: data.taxIdEin,
            // Address information (pre-populated from onboarding)
            hqStreet: data.hqStreet,
            hqCity: data.hqCity,
            hqStateProvince: data.hqStateProvince,
            hqCountry: data.hqCountry,
            hqPostalCode: data.hqPostalCode,
            // Contact information (pre-populated from onboarding)
            email: data.email,
            mainPhone: data.mainPhone,
            primaryR2ContactName: data.primaryR2ContactName,
            primaryR2ContactEmail: data.primaryR2ContactEmail,
            primaryR2ContactPhone: data.primaryR2ContactPhone,
            // Operational information (pre-populated from onboarding)
            totalFacilities: data.totalFacilities,
            operatingSchedule: data.operatingSchedule,
            totalEmployees: data.totalEmployees,
        }).returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'INTAKE_FORM_CREATED', 'intake_form', intakeForm.id);
        res.status(201).json(intakeForm);
    }
    catch (error) {
        console.error("Error creating intake form:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create intake form" });
    }
});
// GET /api/intake-forms - Get all intake forms for tenant
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const forms = await db.query.intakeForms.findMany({
            where: eq(intakeForms.tenantId, req.tenant.id),
            orderBy: [desc(intakeForms.updatedAt)],
            limit,
            offset,
            with: {
                user: {
                    columns: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                }
            }
        });
        const total = await db.query.intakeForms.findMany({
            where: eq(intakeForms.tenantId, req.tenant.id),
        });
        res.json({
            forms,
            pagination: {
                page,
                limit,
                total: total.length,
                pages: Math.ceil(total.length / limit),
            }
        });
    }
    catch (error) {
        console.error("Error fetching intake forms:", error);
        res.status(500).json({ error: "Failed to fetch intake forms" });
    }
});
// GET /api/intake-forms/:id - Get specific intake form with answers
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, req.tenant.id)),
            with: {
                facilities: true,
                intakeAnswers: {
                    with: {
                        intakeQuestion: true,
                    }
                }
            }
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found" });
        }
        // Calculate completion percentage
        const allIntakeQuestions = await db.query.intakeQuestions.findMany({
            where: eq(intakeQuestions.isActive, true),
            orderBy: [intakeQuestions.phase, intakeQuestions.order],
        });
        const answeredQuestions = intakeForm.intakeAnswers.length;
        const requiredQuestions = allIntakeQuestions.filter(q => q.required).length;
        const completionPercentage = Math.round((answeredQuestions / allIntakeQuestions.length) * 100);
        // Update completion percentage if it's changed
        if (completionPercentage !== intakeForm.completionPercentage) {
            await db.update(intakeForms)
                .set({
                completionPercentage,
                updatedAt: new Date()
            })
                .where(eq(intakeForms.id, id));
        }
        res.json({
            ...intakeForm,
            completionPercentage,
            requiredQuestionsAnswered: intakeForm.intakeAnswers.filter(a => allIntakeQuestions.find(q => q.id === a.intakeQuestionId)?.required).length,
            totalRequiredQuestions: requiredQuestions,
        });
    }
    catch (error) {
        console.error("Error fetching intake form:", error);
        res.status(500).json({ error: "Failed to fetch intake form" });
    }
});
// PUT /api/intake-forms/:id - Update intake form
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateIntakeFormSchema.parse(req.body);
        // Verify ownership
        const existingForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!existingForm) {
            return res.status(404).json({ error: "Intake form not found" });
        }
        const [updatedForm] = await db.update(intakeForms)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where(eq(intakeForms.id, id))
            .returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'INTAKE_FORM_UPDATED', 'intake_form', id, { title: existingForm.title }, { title: updatedForm.title });
        res.json(updatedForm);
    }
    catch (error) {
        console.error("Error updating intake form:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to update intake form" });
    }
});
// POST /api/intake-forms/:id/answers - Save intake answer
router.post("/:id/answers", async (req, res) => {
    try {
        const { id } = req.params;
        const data = saveAnswerSchema.parse(req.body);
        // Verify intake form ownership
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found" });
        }
        // Check if answer already exists
        const existingAnswer = await db.query.intakeAnswers.findFirst({
            where: and(eq(intakeAnswers.intakeFormId, id), eq(intakeAnswers.intakeQuestionId, data.intakeQuestionId)),
        });
        let answer;
        if (existingAnswer) {
            // Update existing answer
            [answer] = await db.update(intakeAnswers)
                .set({
                value: data.value,
                notes: data.notes,
                updatedAt: new Date(),
            })
                .where(eq(intakeAnswers.id, existingAnswer.id))
                .returning();
        }
        else {
            // Create new answer
            [answer] = await db.insert(intakeAnswers).values({
                intakeFormId: id,
                userId: req.user.id,
                intakeQuestionId: data.intakeQuestionId,
                value: data.value,
                notes: data.notes,
            }).returning();
        }
        // Update form's last activity
        await db.update(intakeForms)
            .set({ updatedAt: new Date() })
            .where(eq(intakeForms.id, id));
        res.json(answer);
    }
    catch (error) {
        console.error("Error saving intake answer:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to save answer" });
    }
});
// GET /api/intake-forms/:id/answers - Get all answers for intake form
router.get("/:id/answers", async (req, res) => {
    try {
        const { id } = req.params;
        // Verify intake form ownership
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found" });
        }
        const answers = await db.query.intakeAnswers.findMany({
            where: eq(intakeAnswers.intakeFormId, id),
            with: {
                intakeQuestion: true,
            },
        });
        res.json(answers);
    }
    catch (error) {
        console.error("Error fetching intake answers:", error);
        res.status(500).json({ error: "Failed to fetch answers" });
    }
});
// POST /api/intake-forms/:id/facilities - Add facility to intake form
router.post("/:id/facilities", async (req, res) => {
    try {
        const { id } = req.params;
        const data = addFacilitySchema.parse(req.body);
        // Verify intake form ownership
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found" });
        }
        const [facility] = await db.insert(intakeFacilities).values({
            intakeFormId: id,
            ...data,
        }).returning();
        res.status(201).json(facility);
    }
    catch (error) {
        console.error("Error adding facility:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to add facility" });
    }
});
// POST /api/intake-forms/:id/submit - Submit intake form and auto-create assessment with smart REC mapping
router.post("/:id/submit", async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📝 Intake submission started for form ID: ${id}`);
        // Verify intake form ownership
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            console.error(`❌ Intake form not found: ${id}`);
            return res.status(404).json({ error: "Intake form not found" });
        }
        if (intakeForm.status === "SUBMITTED") {
            console.warn(`⚠️ Intake form already submitted: ${id}`);
            return res.status(400).json({ error: "Intake form already submitted" });
        }
        console.log(`✅ Intake form found: ${intakeForm.legalCompanyName}, status: ${intakeForm.status}`);
        // Validate intake form completeness using smart logic
        console.log(`🔍 Validating intake form completeness...`);
        const validation = IntakeProcessor.validateIntakeCompleteness(intakeForm);
        if (!validation.isComplete) {
            console.error(`❌ Validation failed. Missing fields: ${validation.missingFields.join(', ')}`);
            return res.status(400).json({
                error: "Cannot submit incomplete intake form",
                missingFields: validation.missingFields,
                warnings: validation.warnings,
                details: `Please complete the following required fields: ${validation.missingFields.join(', ')}`
            });
        }
        console.log(`✅ Intake form validation passed`);
        // Auto-create facility records if they don't exist (idempotent, facility-first REC mapping)
        console.log(`🏭 Checking for existing facilities...`);
        const existingFacilities = await db.query.intakeFacilities.findMany({
            where: eq(intakeFacilities.intakeFormId, id),
        });
        console.log(`📊 Found ${existingFacilities.length} existing facility record(s)`);
        if (existingFacilities.length === 0) {
            console.log('🏭 Auto-creating facility records from intake data...');
            // Parse facility count, default to 1 if not specified
            const facilityCount = parseInt(intakeForm.totalFacilities || '1', 10);
            if (facilityCount > 0 && facilityCount <= 100) { // Reasonable upper limit
                const facilityRecords = [];
                for (let i = 1; i <= facilityCount; i++) {
                    facilityRecords.push({
                        intakeFormId: id,
                        facilityNumber: `${i}`,
                        nameIdentifier: facilityCount === 1
                            ? `${intakeForm.legalCompanyName || 'Primary'} Facility`
                            : `${intakeForm.legalCompanyName || 'Facility'} ${i}`,
                        // Inherit organization-level data as defaults
                        processingActivities: intakeForm.processingActivities || [],
                        equipment: intakeForm.equipment || [],
                        electronicsTypes: intakeForm.electronicsTypes || [],
                    });
                }
                await db.insert(intakeFacilities).values(facilityRecords);
                console.log(`✅ Created ${facilityCount} facility record(s) with inherited processing data`);
            }
            else {
                console.warn(`⚠️ Invalid facility count: ${facilityCount}, defaulting to 1 facility`);
                await db.insert(intakeFacilities).values({
                    intakeFormId: id,
                    facilityNumber: '1',
                    nameIdentifier: `${intakeForm.legalCompanyName || 'Primary'} Facility`,
                    processingActivities: intakeForm.processingActivities || [],
                    equipment: intakeForm.equipment || [],
                    electronicsTypes: intakeForm.electronicsTypes || [],
                });
            }
        }
        else {
            console.log(`ℹ️ Using existing ${existingFacilities.length} facility record(s)`);
        }
        // Validate that at least one facility exists before proceeding
        const facilitiesForAssessment = await db.query.intakeFacilities.findMany({
            where: eq(intakeFacilities.intakeFormId, id),
        });
        if (facilitiesForAssessment.length === 0) {
            return res.status(400).json({
                error: "Cannot create assessment without facility data",
                details: "At least one facility must be defined for REC mapping and question filtering"
            });
        }
        // Update form status to SUBMITTED
        const [submittedForm] = await db.update(intakeForms)
            .set({
            status: "SUBMITTED",
            submittedAt: new Date(),
            submittedBy: req.user.id,
            updatedAt: new Date(),
        })
            .where(eq(intakeForms.id, id))
            .returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'INTAKE_FORM_SUBMITTED', 'intake_form', id);
        // Generate intelligent assessment scope using REC mapping
        console.log('🔍 Generating assessment scope using REC mapping for intake:', id);
        const assessmentScope = await IntakeProcessor.generateAssessmentScope(id);
        // Get default R2v3 standard
        const standard = await db.query.standardVersions.findFirst({
            where: eq(standardVersions.code, "R2V3_1"),
        });
        if (!standard) {
            console.warn('⚠️ R2v3 standard not found, cannot create assessment');
            return res.json({
                ...submittedForm,
                message: "Intake form submitted successfully",
                warning: "Assessment creation skipped - R2v3 standard not configured"
            });
        }
        // Check if assessment already exists
        const existingAssessment = await db.query.assessments.findFirst({
            where: eq(assessments.intakeFormId, id),
        });
        if (existingAssessment) {
            console.log('ℹ️ Assessment already exists for intake:', id);
            return res.json({
                ...submittedForm,
                assessment: existingAssessment,
                message: "Intake form submitted successfully",
                info: "Assessment already created for this intake"
            });
        }
        // Create assessment with intelligent scope
        const companyName = intakeForm.legalCompanyName || req.tenant.name;
        const facilityCount = intakeForm.totalFacilities ? ` (${intakeForm.totalFacilities} facilities)` : '';
        const assessmentTitle = `${companyName}${facilityCount} - R2v3 Pre-Certification Assessment`;
        const [assessment] = await db.insert(assessments).values({
            tenantId: req.tenant.id,
            createdBy: req.user.id,
            stdId: standard.id,
            intakeFormId: id,
            title: assessmentTitle,
            description: assessmentScope.scopeStatement,
            status: "DRAFT",
        }).returning();
        console.log('✅ Assessment created:', assessment.id);
        // Filter and add questions using smart REC mapping
        console.log('🔍 Filtering questions using REC mapping...');
        const questionFilterResult = await IntakeProcessor.filterQuestionsForAssessment(id, assessment.id);
        // Build filteringInfo object with all REC mapping metadata
        const filteringInfo = {
            applicableRecCodes: questionFilterResult.applicableRecCodes || [],
            scopeStatement: questionFilterResult.scopeStatement || assessmentScope.scopeStatement,
            totalAvailableQuestions: questionFilterResult.totalQuestions,
            filteredQuestionsCount: questionFilterResult.relevantQuestions,
            filteringRatio: questionFilterResult.filteringRatio,
            requiredAppendices: assessmentScope.requiredAppendices || [],
            complexityFactors: assessmentScope.complexityFactors || {},
            estimatedAuditDays: assessmentScope.estimatedAuditDays,
            criticalRequirements: assessmentScope.criticalRequirements || []
        };
        // Update assessment with filteringInfo
        await db.update(assessments)
            .set({ filteringInfo })
            .where(eq(assessments.id, assessment.id));
        console.log('✅ Saved filteringInfo to assessment:', assessment.id);
        // Insert filtered questions as assessment answers (with empty values initially)
        if (questionFilterResult.filteredQuestions.length > 0) {
            const answerValues = questionFilterResult.filteredQuestions.map(question => ({
                assessmentId: assessment.id,
                questionId: question.id,
                answeredBy: req.user.id,
                value: {},
                notes: null,
            }));
            await db.insert(answers).values(answerValues);
            console.log(`✅ Added ${questionFilterResult.filteredQuestions.length} filtered questions to assessment`);
            console.log(`📊 REC Mapping Stats:
        - Total Questions Available: ${questionFilterResult.totalQuestions}
        - Filtered Questions Added: ${questionFilterResult.relevantQuestions}
        - Filtering Ratio: ${(questionFilterResult.filteringRatio * 100).toFixed(1)}%
        - Applicable REC Codes: ${questionFilterResult.applicableRecCodes.join(', ')}`);
        }
        // Log assessment creation
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'ASSESSMENT_CREATED', 'assessment', assessment.id, undefined, { intakeFormId: id, title: assessment.title });
        res.json({
            ...submittedForm,
            assessment: {
                ...assessment,
                questionCount: questionFilterResult.filteredQuestions.length,
                applicableRecCodes: questionFilterResult.applicableRecCodes,
                scopeStatement: questionFilterResult.scopeStatement
            },
            message: "Intake form submitted successfully and assessment created with smart REC mapping",
            recMappingStats: {
                totalQuestions: questionFilterResult.totalQuestions,
                filteredQuestions: questionFilterResult.relevantQuestions,
                filteringRatio: questionFilterResult.filteringRatio,
                applicableRecCodes: questionFilterResult.applicableRecCodes
            }
        });
    }
    catch (error) {
        console.error("❌ Error submitting intake form:", error);
        res.status(500).json({ error: "Failed to submit intake form" });
    }
});
// POST /api/intake-forms/:id/create-assessment - Create assessment from intake form
router.post("/:id/create-assessment", async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;
        // Verify intake form ownership
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found" });
        }
        if (intakeForm.status !== "SUBMITTED" && intakeForm.status !== "APPROVED") {
            return res.status(400).json({ error: "Intake form must be submitted before creating assessment" });
        }
        // Check if assessment already exists for this intake
        const existingAssessment = await db.query.assessments.findFirst({
            where: eq(assessments.intakeFormId, id),
        });
        if (existingAssessment) {
            return res.status(400).json({
                error: "Assessment already exists for this intake form",
                assessmentId: existingAssessment.id
            });
        }
        // Get default R2v3 standard
        const standard = await db.query.standardVersions.findFirst({
            where: eq(standardVersions.code, "R2V3_1"),
        });
        if (!standard) {
            return res.status(500).json({ error: "R2v3 standard not found. Please contact support." });
        }
        // Generate intelligent title and description from comprehensive intake data
        let assessmentTitle = title;
        let assessmentDescription = description;
        if (!title) {
            // Auto-generate comprehensive title from intake data
            const companyName = intakeForm.legalCompanyName || req.tenant.name;
            const facilityCount = intakeForm.totalFacilities ? ` (${intakeForm.totalFacilities} facilities)` : '';
            assessmentTitle = `${companyName}${facilityCount} - R2v3 Pre-Certification Assessment`;
        }
        if (!description) {
            // Auto-generate detailed description from rich intake data
            const companyInfo = intakeForm.legalCompanyName || req.tenant.name;
            const locationInfo = intakeForm.hqCity && intakeForm.hqStateProvince ?
                ` based in ${intakeForm.hqCity}, ${intakeForm.hqStateProvince}` : '';
            const facilityInfo = intakeForm.totalFacilities ?
                ` operating ${intakeForm.totalFacilities} facilities` : '';
            const employeeInfo = intakeForm.totalEmployees ?
                ` with ${intakeForm.totalEmployees} employees` : '';
            const scheduleInfo = intakeForm.operatingSchedule ?
                ` (${intakeForm.operatingSchedule} schedule)` : '';
            const contactInfo = intakeForm.primaryR2ContactName ?
                ` Primary R2 contact: ${intakeForm.primaryR2ContactName}.` : '';
            const submissionDate = intakeForm.submittedAt ?
                ` Intake completed on ${intakeForm.submittedAt.toLocaleDateString()}.` : '';
            assessmentDescription = `R2v3 pre-certification assessment for ${companyInfo}${locationInfo}${facilityInfo}${employeeInfo}${scheduleInfo}.${contactInfo}${submissionDate} Assessment covers responsible recycling practices, data security protocols, and environmental compliance standards based on comprehensive intake evaluation.`;
        }
        // Create assessment
        const [assessment] = await db.insert(assessments).values({
            tenantId: req.tenant.id,
            createdBy: req.user.id,
            stdId: standard.id,
            intakeFormId: id,
            title: assessmentTitle,
            description: assessmentDescription,
            status: "DRAFT",
        }).returning();
        // Log audit event
        await AuthService.logAuditEvent(req.tenant.id, req.user.id, 'ASSESSMENT_CREATED', 'assessment', assessment.id, undefined, { intakeFormId: id, title: assessment.title });
        res.status(201).json({
            assessment,
            message: "Assessment created successfully from intake form"
        });
    }
    catch (error) {
        console.error("Error creating assessment from intake:", error);
        res.status(500).json({ error: "Failed to create assessment" });
    }
});
// GET /api/intake-forms/:id/validation - Validate intake form completeness
router.get("/:id/validation", async (req, res) => {
    try {
        const { id } = req.params;
        // Verify intake form ownership
        const intakeForm = await db.query.intakeForms.findFirst({
            where: and(eq(intakeForms.id, id), eq(intakeForms.tenantId, req.tenant.id)),
        });
        if (!intakeForm) {
            return res.status(404).json({ error: "Intake form not found" });
        }
        // Get all questions and answers
        const allQuestions = await db.query.intakeQuestions.findMany({
            where: eq(intakeQuestions.isActive, true),
        });
        const answers = await db.query.intakeAnswers.findMany({
            where: eq(intakeAnswers.intakeFormId, id),
        });
        const answeredQuestionIds = answers.map(a => a.intakeQuestionId);
        const requiredQuestions = allQuestions.filter(q => q.required);
        const missingRequired = requiredQuestions.filter(q => !answeredQuestionIds.includes(q.id));
        const validation = {
            isValid: missingRequired.length === 0,
            completionPercentage: Math.round((answers.length / allQuestions.length) * 100),
            requiredCompletionPercentage: Math.round(((requiredQuestions.length - missingRequired.length) / requiredQuestions.length) * 100),
            totalQuestions: allQuestions.length,
            answeredQuestions: answers.length,
            requiredQuestions: requiredQuestions.length,
            missingRequired: missingRequired.length,
            missingRequiredQuestions: missingRequired.map(q => ({
                id: q.id,
                text: q.text,
                section: q.section,
                phase: q.phase,
            })),
            canSubmit: missingRequired.length === 0,
            canCreateAssessment: intakeForm.status === "SUBMITTED" || intakeForm.status === "APPROVED",
        };
        res.json(validation);
    }
    catch (error) {
        console.error("Error validating intake form:", error);
        res.status(500).json({ error: "Failed to validate intake form" });
    }
});
export default router;
