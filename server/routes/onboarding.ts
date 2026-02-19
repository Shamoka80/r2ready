import { Router } from "express";
import { db } from "../db";
import { organizationProfiles, facilityProfiles, scopeProfiles, users, tenants, clientOrganizations, clientFacilities } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { AuthService } from "../services/authService";
import { z } from "zod";

const router = Router();

// Middleware - require authentication for all onboarding routes
router.use(AuthService.authMiddleware);

// Validation schemas matching the frontend - streamlined for onboarding
const organizationProfileSchema = z.object({
  legalName: z.string().min(1, "Legal name is required"),
  dbaName: z.string().optional(),
  entityType: z.enum(["CORPORATION", "LLC", "PARTNERSHIP", "SOLE_PROPRIETORSHIP", "NON_PROFIT", "OTHER"]).optional(),
  taxId: z.string().optional(), // Optional for streamlined onboarding
  hqAddress: z.string().optional(), // Optional for quick setup - can be just city/state
  hqCity: z.string().min(1, "City is required"),
  hqState: z.string().min(1, "State is required"),
  hqZipCode: z.string().optional(), // Optional for quick setup
  hqCountry: z.string().default("US"),
  primaryContactName: z.string().min(1, "Primary contact name is required"),
  primaryContactEmail: z.string().email("Valid email is required"),
  primaryContactPhone: z.string().optional(),
  complianceContactName: z.string().optional(),
  complianceContactEmail: z.string().optional(),
  timeZone: z.string().default("America/New_York")
});

const facilityBaselineSchema = z.object({
  name: z.string().min(1, "Facility name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  country: z.string().default("US"),
  headcount: z.coerce.number().optional(),
  floorArea: z.coerce.number().optional(),
  operatingStatus: z.string().default("ACTIVE"),
  hoursOfOperation: z.string().optional(),
  processingActivities: z.array(z.string()).default([]),
  dataBearingHandling: z.boolean().default(false),
  focusMaterialsPresence: z.boolean().default(false),
  repairRefurbCapability: z.boolean().default(false),
  hazardousWasteStorage: z.boolean().default(false),
  isPrimary: z.boolean().default(true),
  facilitiesPlanned: z.coerce.number().min(1).max(50).default(1),
  multiSiteOperations: z.boolean().default(false)
});

const scopeApplicabilitySchema = z.object({
  equipmentCategories: z.array(z.string()).default([]),
  dataPresent: z.boolean().default(false),
  focusMaterials: z.boolean().default(false),
  internalProcesses: z.boolean().default(true),
  contractedProcesses: z.boolean().default(false),
  exportMarkets: z.boolean().default(false),
  priorCertifications: z.array(z.string()).default([]),
  // Core Requirements (CR1-CR10)
  applicableCR1: z.boolean().default(false),
  applicableCR2: z.boolean().default(false),
  applicableCR3: z.boolean().default(false),
  applicableCR4: z.boolean().default(false),
  applicableCR5: z.boolean().default(false),
  applicableCR6: z.boolean().default(false),
  applicableCR7: z.boolean().default(false),
  applicableCR8: z.boolean().default(false),
  applicableCR9: z.boolean().default(false),
  applicableCR10: z.boolean().default(false),
  // Appendices (A-G)
  applicableAppA: z.boolean().default(false),
  applicableAppB: z.boolean().default(false),
  applicableAppC: z.boolean().default(false),
  applicableAppD: z.boolean().default(false),
  applicableAppE: z.boolean().default(false),
  applicableAppF: z.boolean().default(false),
  applicableAppG: z.boolean().default(false)
});

// Client organization schema for consultants
// Matches the frontend form fields - only basic organization info is collected during onboarding
// Address and contact fields are optional since consultants may not have full client details yet
const clientOrganizationSchema = z.object({
  legalName: z.string().min(1, "Client company name is required"),
  dbaName: z.string().optional(), // Optional DBA name
  primaryContactName: z.string().optional(), // Optional - can use consultant's info as default
  primaryContactEmail: z.string().email("Valid client contact email is required").optional().nullable(), // Optional but must be valid email if provided
  primaryContactPhone: z.string().optional(), // Optional phone number
  hqAddress: z.string().optional(), // Optional - consultant may not have full address yet
  hqCity: z.string().optional(), // Optional
  hqState: z.string().optional(), // Optional
  hqZipCode: z.string().optional(), // Optional
  hqCountry: z.string().default("US"),
  // Optional fields that can be added later - not required during onboarding
  entityType: z.enum(["CORPORATION", "LLC", "PARTNERSHIP", "SOLE_PROPRIETORSHIP", "NON_PROFIT", "OTHER"]).optional(),
  taxId: z.string().optional(),
  industry: z.string().optional(), // Made optional to match frontend form
  serviceType: z.enum(["r2_certification", "compliance_audit", "gap_analysis", "ongoing_consulting", "other"]).optional(),
  projectTimeline: z.enum(["immediate", "1-3_months", "3-6_months", "6-12_months", "ongoing"]).optional(),
  organizationSize: z.enum(["startup", "small", "medium", "large", "enterprise"]).optional(),
  specialRequirements: z.string().optional()
});

// Client facility schema for consultants
const clientFacilitySchema = z.object({
  name: z.string().min(1, "Client facility name is required"),
  address: z.string().min(1, "Client facility address is required"),
  city: z.string().min(1, "Client facility city is required"),
  state: z.string().min(1, "Client facility state is required"),
  zipCode: z.string().min(1, "Client facility ZIP code is required"),
  country: z.string().default("US"),
  operatingStatus: z.string().default("ACTIVE"),
  isPrimary: z.coerce.boolean().default(true),
  facilitiesPlanned: z.coerce.number().min(1).max(50).default(1),
  multiSiteOperations: z.coerce.boolean().default(false),
  clientOrganizationId: z.string().min(1, "Client organization ID is required")
});

// POST /api/onboarding/organization - Create organization (simplified endpoint name)
router.post('/organization', async (req: any, res, next) => {
  // Alias for organization-profile for simpler onboarding flow
  req.url = '/organization-profile';
  return next();
});

// POST /api/onboarding/facility - Create facility (simplified endpoint name)  
router.post('/facility', async (req: any, res, next) => {
  // Alias for facility-baseline for simpler onboarding flow
  req.url = '/facility-baseline';
  return next();
});

// POST /api/onboarding/organization-profile - Create organization profile
router.post('/organization-profile', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const validatedData = organizationProfileSchema.parse(req.body);

    // Check if organization profile already exists
    const existingProfile = await db.query.organizationProfiles.findFirst({
      where: eq(organizationProfiles.tenantId, tenantId)
    });

    if (existingProfile) {
      // Update existing profile
      const [updatedProfile] = await db.update(organizationProfiles)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(organizationProfiles.tenantId, tenantId))
        .returning();
      
      res.json(updatedProfile);
    } else {
      // Create new profile with defaults for optional quick setup fields
      const [newProfile] = await db.insert(organizationProfiles)
        .values({
          tenantId,
          ...validatedData,
          // Provide defaults for database NOT NULL constraints if not in quick setup
          hqAddress: validatedData.hqAddress || `${validatedData.hqCity}, ${validatedData.hqState}`,
          hqZipCode: validatedData.hqZipCode || '00000' // Placeholder for quick setup, can be updated later
        })
        .returning();
      
      res.status(201).json(newProfile);
    }
  } catch (error) {
    console.error('Error saving organization profile:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to save organization profile' });
  }
});

// POST /api/onboarding/facility-baseline - Create facility baseline
router.post('/facility-baseline', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const validatedData = facilityBaselineSchema.parse(req.body);

    // Check if facility profile already exists (assuming one facility per tenant for now)
    const existingFacility = await db.query.facilityProfiles.findFirst({
      where: eq(facilityProfiles.tenantId, tenantId)
    });

    if (existingFacility) {
      // Update existing facility
      const [updatedFacility] = await db.update(facilityProfiles)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(facilityProfiles.tenantId, tenantId))
        .returning();
      
      // Update tenant with multi-facility information
      await db.update(tenants)
        .set({
          settings: sql`COALESCE(settings, '{}')::jsonb || ${JSON.stringify({
            facilitiesPlanned: validatedData.facilitiesPlanned,
            multiSiteOperations: validatedData.multiSiteOperations,
            primaryFacilityId: updatedFacility.id
          })}::jsonb`,
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId));

      // Update user setup status to assessment_active after facility setup completion
      await db.update(users)
        .set({
          setupStatus: 'assessment_active',
          setupCompletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, req.user.id));

      console.log('User setup status updated to assessment_active for user:', req.user.id);
      
      res.json(updatedFacility);
    } else {
      // Create new facility
      const [newFacility] = await db.insert(facilityProfiles)
        .values({
          tenantId,
          ...validatedData
        })
        .returning();
      
      // Update tenant with multi-facility information
      await db.update(tenants)
        .set({
          settings: sql`COALESCE(settings, '{}')::jsonb || ${JSON.stringify({
            facilitiesPlanned: validatedData.facilitiesPlanned,
            multiSiteOperations: validatedData.multiSiteOperations,
            primaryFacilityId: newFacility.id
          })}::jsonb`,
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId));

      // Update user setup status to assessment_active after facility setup completion
      await db.update(users)
        .set({
          setupStatus: 'assessment_active',
          setupCompletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, req.user.id));

      console.log('User setup status updated to assessment_active for user:', req.user.id);
      
      res.status(201).json(newFacility);
    }
  } catch (error) {
    console.error('Error saving facility baseline:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to save facility baseline' });
  }
});

// POST /api/onboarding/client-organization - Create client organization for consultants
router.post('/client-organization', async (req: any, res) => {
  try {
    const consultantTenantId = req.user.tenantId;
    
    // Log the incoming request body for debugging
    console.log('Client organization request body:', JSON.stringify(req.body, null, 2));
    
    const validatedData = clientOrganizationSchema.parse(req.body);

    // Provide default values for required database fields that are optional in the schema
    // This allows consultants to create client orgs without full address/contact details
    const insertData = {
      tenantId: consultantTenantId,
      consultantTenantId,
      legalName: validatedData.legalName,
      hqAddress: validatedData.hqAddress || 'Address to be provided',
      hqCity: validatedData.hqCity || 'City to be provided',
      hqState: validatedData.hqState || 'State to be provided',
      hqZipCode: validatedData.hqZipCode || '00000',
      hqCountry: validatedData.hqCountry || 'US',
      primaryContactName: validatedData.primaryContactName || 'Contact name to be provided',
      primaryContactEmail: validatedData.primaryContactEmail || req.user.email || 'contact@example.com',
      ...(validatedData.dbaName && { dbaName: validatedData.dbaName }),
      ...(validatedData.entityType && { entityType: validatedData.entityType }),
      ...(validatedData.taxId && { taxId: validatedData.taxId }),
      ...(validatedData.primaryContactPhone && { primaryContactPhone: validatedData.primaryContactPhone }),
      // Store optional onboarding fields in a way that doesn't violate schema
      // These can be stored as JSON or in a separate table, but for now we'll use available fields
    };

    // Create new client organization
    const [newClientOrg] = await db.insert(clientOrganizations)
      .values(insertData)
      .returning();
    
    console.log('Created client organization for consultant tenant:', consultantTenantId);
    console.log('Inserted data:', JSON.stringify(insertData, null, 2));
    res.status(201).json(newClientOrg);
  } catch (error) {
    console.error('Error saving client organization:', error);
    if (error instanceof z.ZodError) {
      // Enhanced error logging
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors,
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
    }
    res.status(500).json({ error: 'Failed to save client organization' });
  }
});

// POST /api/onboarding/client-facility - Create client facility for consultants
router.post('/client-facility', async (req: any, res) => {
  try {
    // Log the incoming request body for debugging
    console.log('Client facility request body:', JSON.stringify(req.body, null, 2));
    
    const validatedData = clientFacilitySchema.parse(req.body);

    // Verify the client organization exists and belongs to this consultant
    const clientOrg = await db.query.clientOrganizations.findFirst({
      where: and(
        eq(clientOrganizations.id, validatedData.clientOrganizationId),
        eq(clientOrganizations.consultantTenantId, req.user.tenantId)
      )
    });

    if (!clientOrg) {
      console.error('Client organization not found:', {
        clientOrganizationId: validatedData.clientOrganizationId,
        consultantTenantId: req.user.tenantId
      });
      return res.status(400).json({ error: 'Client organization not found or does not belong to this consultant' });
    }

    // Create new client facility
    const [newClientFacility] = await db.insert(clientFacilities)
      .values({
        tenantId: req.user.tenantId,
        ...validatedData
      })
      .returning();

    // Update user setup status to assessment_active after client facility setup completion
    await db.update(users)
      .set({
        setupStatus: 'assessment_active',
        setupCompletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, req.user.id));

    console.log('Created client facility for client organization:', clientOrg.id);
    console.log('User setup status updated to assessment_active for consultant user:', req.user.id);
    
    res.status(201).json(newClientFacility);
  } catch (error) {
    console.error('Error saving client facility:', error);
    if (error instanceof z.ZodError) {
      // Enhanced error logging
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors,
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
    }
    res.status(500).json({ error: 'Failed to save client facility' });
  }
});

// POST /api/onboarding/scope-applicability - Create scope & applicability profile
router.post('/scope-applicability', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const validatedData = scopeApplicabilitySchema.parse(req.body);

    // Get the facility for this tenant to create the scope profile
    const facility = await db.query.facilityProfiles.findFirst({
      where: eq(facilityProfiles.tenantId, tenantId)
    });

    if (!facility) {
      return res.status(400).json({ error: 'Facility profile must be created before scope profile' });
    }

    // Check if scope profile already exists
    const existingScope = await db.query.scopeProfiles.findFirst({
      where: eq(scopeProfiles.facilityId, facility.id)
    });

    if (existingScope) {
      // Update existing scope profile
      const [updatedScope] = await db.update(scopeProfiles)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(scopeProfiles.facilityId, facility.id))
        .returning();
      
      res.json(updatedScope);
    } else {
      // Create new scope profile
      const [newScope] = await db.insert(scopeProfiles)
        .values({
          facilityId: facility.id,
          ...validatedData
        })
        .returning();
      
      res.status(201).json(newScope);
    }

    // After saving scope profile, update user setup status to assessment_active
    await db.update(users)
      .set({
        setupStatus: 'assessment_active',
        updatedAt: new Date()
      })
      .where(eq(users.id, req.user.id));

    console.log('User setup status updated to assessment_active for user:', req.user.id);

  } catch (error) {
    console.error('Error saving scope applicability:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to save scope applicability' });
  }
});

// GET /api/onboarding/status - Get current setup status and data
router.get('/status', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Get organization profile
    const orgProfile = await db.query.organizationProfiles.findFirst({
      where: eq(organizationProfiles.tenantId, tenantId)
    });

    // Get facility profile  
    const facility = await db.query.facilityProfiles.findFirst({
      where: eq(facilityProfiles.tenantId, tenantId)
    });

    // Get scope profile
    let scopeProfile = null;
    if (facility) {
      scopeProfile = await db.query.scopeProfiles.findFirst({
        where: eq(scopeProfiles.facilityId, facility.id)
      });
    }

    // Determine setup completeness
    const setupStatus = {
      organizationComplete: !!orgProfile,
      facilityComplete: !!facility,
      scopeComplete: !!scopeProfile,
      overallComplete: !!(orgProfile && facility && scopeProfile),
      currentStep: !orgProfile ? 1 : !facility ? 2 : !scopeProfile ? 3 : 4
    };

    res.json({
      setupStatus,
      userSetupStatus: req.user.setupStatus,
      organizationProfile: orgProfile,
      facilityProfile: facility,
      scopeProfile: scopeProfile
    });
  } catch (error) {
    console.error('Error fetching setup status:', error);
    res.status(500).json({ error: 'Failed to fetch setup status' });
  }
});

// PUT routes for autosave functionality
router.put('/organization-profile', async (req: any, res) => {
  // Same logic as POST but for partial updates during autosave
  try {
    const tenantId = req.user.tenantId;
    // Only validate provided fields for autosave
    const validatedData = organizationProfileSchema.partial().parse(req.body);

    const existingProfile = await db.query.organizationProfiles.findFirst({
      where: eq(organizationProfiles.tenantId, tenantId)
    });

    if (existingProfile) {
      const [updatedProfile] = await db.update(organizationProfiles)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(organizationProfiles.tenantId, tenantId))
        .returning();
      
      res.json({ success: true, profile: updatedProfile });
    } else {
      res.json({ success: false, message: 'Profile not found for autosave' });
    }
  } catch (error) {
    // Silent fail for autosave
    res.json({ success: false, message: 'Autosave failed' });
  }
});

router.put('/facility-baseline', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const validatedData = facilityBaselineSchema.partial().parse(req.body);

    const existingFacility = await db.query.facilityProfiles.findFirst({
      where: eq(facilityProfiles.tenantId, tenantId)
    });

    if (existingFacility) {
      const [updatedFacility] = await db.update(facilityProfiles)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(facilityProfiles.tenantId, tenantId))
        .returning();
      
      res.json({ success: true, facility: updatedFacility });
    } else {
      res.json({ success: false, message: 'Facility not found for autosave' });
    }
  } catch (error) {
    res.json({ success: false, message: 'Autosave failed' });
  }
});

router.put('/scope-applicability', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const validatedData = scopeApplicabilitySchema.partial().parse(req.body);

    const facility = await db.query.facilityProfiles.findFirst({
      where: eq(facilityProfiles.tenantId, tenantId)
    });

    if (!facility) {
      return res.json({ success: false, message: 'Facility required for scope autosave' });
    }

    const existingScope = await db.query.scopeProfiles.findFirst({
      where: eq(scopeProfiles.facilityId, facility.id)
    });

    if (existingScope) {
      const [updatedScope] = await db.update(scopeProfiles)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(scopeProfiles.facilityId, facility.id))
        .returning();
      
      res.json({ success: true, scope: updatedScope });
    } else {
      res.json({ success: false, message: 'Scope profile not found for autosave' });
    }
  } catch (error) {
    res.json({ success: false, message: 'Autosave failed' });
  }
});

// POST /api/onboarding/complete - Complete onboarding process
router.post('/complete', async (req: any, res) => {
  try {
    const { accountType, analytics } = req.body;
    const userId = req.user.id;

    // Update user setup status to assessment_active (industry standard final status)
    await db.update(users)
      .set({
        setupStatus: 'assessment_active',
        setupCompletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Log completion analytics if provided
    if (analytics) {
      console.log('✅ Onboarding completion analytics:', {
        userId,
        accountType,
        totalTime: analytics.totalTime,
        completionRate: analytics.completionRate,
        finalStatus: 'assessment_active'
      });
    }

    // Log audit event for compliance tracking
    await AuthService.logAuditEvent(
      req.user.tenantId,
      userId,
      'ONBOARDING_COMPLETED',
      'user',
      userId,
      { previousStatus: 'setup_incomplete' },
      { 
        newStatus: 'assessment_active',
        accountType,
        completionTime: new Date(),
        analytics
      }
    );

    console.log(`✅ User ${userId} onboarding completed - status set to assessment_active`);

    res.json({
      success: true,
      message: 'Onboarding completed successfully - assessment access activated',
      setupStatus: 'assessment_active',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error completing onboarding:', error);
    res.status(500).json({ 
      error: 'Failed to complete onboarding',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;