import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Save, Send, CheckCircle } from "lucide-react";
import { apiPost, apiPut, apiGet } from "@/api";
import { debounce } from 'lodash';
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import ClientContextBanner from "@/components/ClientContextBanner";

interface IntakeFormData {
  id?: string;
  status?: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED';
  currentStep?: number;
  // Section 1: Legal Entity Information
  legalCompanyName?: string;
  dbaTradeNames?: string;
  businessEntityType?: string;
  taxIdEin?: string;
  yearEstablished?: string;
  primaryBusinessLicense?: string;

  // Headquarters Address
  hqStreet?: string;
  hqCity?: string;
  hqStateProvince?: string;
  hqCountry?: string;
  hqPostalCode?: string;

  // Primary Contact
  mainPhone?: string;
  email?: string;
  website?: string;

  // Section 2: Key Personnel
  primaryR2ContactName?: string;
  primaryR2ContactTitle?: string;
  primaryR2ContactEmail?: string;
  primaryR2ContactPhone?: string;

  topMgmtRepName?: string;
  topMgmtRepTitle?: string;
  topMgmtRepEmail?: string;
  topMgmtRepPhone?: string;

  dataProtectionRepName?: string;
  dataProtectionRepTitle?: string;

  // Section 3: Facility Structure & Locations
  totalFacilities?: string;
  certificationStructureType?: string;

  // Section 4: Workforce & Operations
  totalEmployees?: string;
  seasonalWorkforceVariations?: boolean;
  seasonalRangeFrom?: string;
  seasonalRangeTo?: string;
  operatingSchedule?: string;
  languagesSpokenByMgmt?: string;

  // Section 5: Current Certifications
  ehsmsType?: string;
  ehsmsYear?: string;
  qmsType?: string;
  qmsYear?: string;
  otherCertifications?: string;

  // Section 6: Processing Activities & Scope
  processingActivities?: string[];
  electronicsTypes?: string[];
  equipment?: string[];
  monthlyTonnage?: string;
  annualVolume?: string;
  focusMaterials?: string[];

  // Section 7: Downstream Vendor Information
  totalDownstreamVendors?: string;
  numR2CertifiedDsv?: string;
  numNonR2Dsv?: string;
  internationalShipments?: boolean;
  primaryCountries?: string;

  // Section 8: Applicable R2v3 Appendices
  applicableAppendices?: string[];

  // Section 9: Certification Objectives
  certificationType?: string;
  previousR2CertHistory?: string;
  targetTimeline?: string;
  businessDrivers?: string;

  // Section 10: Initial Compliance Status
  legalComplianceStatus?: string;
  recentViolations?: string;
  seriDeceptivePracticesCheck?: string;
  dataSecurityReadiness?: string;

  // Section 11: Preliminary Assessment
  estimatedAuditTimeCategory?: string;
  complexityFactors?: string[];
  integrationOpportunities?: string;

  // Section 12: Administrative Tracking
  fileClientId?: string;
  cbReference?: string;
  leadAuditor?: string;
  teamMember?: string;
  technicalSpecialist?: string;
  nextStepsRequired?: string[];
  specialConsiderations?: string;
}

const SECTIONS = [
  { id: 1, title: "Legal Entity Information", description: "Basic company information and registration details" },
  { id: 2, title: "Key Personnel", description: "Primary contacts and responsible parties" },
  { id: 3, title: "Facility Structure", description: "Locations and facility organization" },
  { id: 4, title: "Workforce & Operations", description: "Staffing and operational details" },
  { id: 5, title: "Current Certifications", description: "Existing management systems and certifications" },
  { id: 6, title: "Processing Activities", description: "Scope of operations and material types" },
  { id: 7, title: "Downstream Vendors", description: "Vendor relationships and supply chain" },
  { id: 8, title: "R2v3 Appendices", description: "Applicable standard appendices" },
  { id: 9, title: "Certification Objectives", description: "Goals and timeline for certification" },
  { id: 10, title: "Compliance Status", description: "Current legal and regulatory standing" },
  { id: 11, title: "Preliminary Assessment", description: "Complexity and integration factors" },
  { id: 12, title: "Administrative Details", description: "Internal tracking and next steps" },
];

export default function IntakeForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentSection, setCurrentSection] = useState(1);
  const [formData, setFormData] = useState<IntakeFormData>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [hasManualAppendixOverride, setHasManualAppendixOverride] = useState(false);
  const [overrideFlagInitialized, setOverrideFlagInitialized] = useState(false);

  // Persist manual override flag to localStorage - initialize as soon as formId is available
  const formId = formData.id;
  useEffect(() => {
    if (formId && !overrideFlagInitialized) {
      const storageKey = `intake-appendix-override-${formId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored === 'true') {
        setHasManualAppendixOverride(true);
      }
      setOverrideFlagInitialized(true);
    }
  }, [formId, overrideFlagInitialized]);

  const setManualOverride = (value: boolean) => {
    setHasManualAppendixOverride(value);
    if (formId) {
      const storageKey = `intake-appendix-override-${formId}`;
      if (value) {
        localStorage.setItem(storageKey, 'true');
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  };

  // Use refs to track changes without causing re-renders
  const lastSavedDataRef = useRef<string>('');
  const autoSaveTimerRef = useRef<number | null>(null);
  const formDataRef = useRef(formData);
  const hasUnsavedChangesRef = useRef(false);

  // Update ref when formData changes
  useEffect(() => {
    const currentDataString = JSON.stringify(formData);
    const hasChanges = currentDataString !== lastSavedDataRef.current;

    formDataRef.current = formData;
    hasUnsavedChangesRef.current = hasChanges;

    if (!formData.id || !hasChanges) return; // Don't set timer if no form ID or no changes

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer - 10 seconds after user stops typing
    autoSaveTimerRef.current = setTimeout(() => {
      if (hasUnsavedChangesRef.current) {
        console.log('Auto-saving after 10 seconds of inactivity...');
        saveProgressImmediate();
      }
    }, 10000); // 10 seconds auto-save

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData]); // Depend on entire formData to reset timer on any change

  // Validation logic to enable submit button - MUST MATCH backend validateIntakeCompleteness
  useEffect(() => {
    const validateForm = () => {
      const DEBUG_MODE = import.meta.env.DEV || localStorage.getItem('debug_intake') === 'true';
      
      // Skip validation while form is initializing
      if (isLoading) {
        if (DEBUG_MODE) console.log('[IntakeForm Validation] Skipping validation - form is still loading');
        setIsValid(false);
        return;
      }

      // Form must exist
      if (!formData.id) {
        if (DEBUG_MODE) console.log('[IntakeForm Validation] No form ID - validation failed');
        setIsValid(false);
        return;
      }

      // Debug: Log all required field values
      if (DEBUG_MODE) {
        console.log('[IntakeForm Validation] Checking required fields:', {
          legalCompanyName: formData.legalCompanyName,
          businessEntityType: formData.businessEntityType,
          certificationType: formData.certificationType,
          totalFacilities: formData.totalFacilities,
          certificationStructureType: formData.certificationStructureType,
          processingActivities: formData.processingActivities,
          equipment: formData.equipment,
          electronicsTypes: formData.electronicsTypes,
          totalEmployees: formData.totalEmployees,
          operatingSchedule: formData.operatingSchedule,
          totalDownstreamVendors: formData.totalDownstreamVendors,
          internationalShipments: formData.internationalShipments,
          primaryCountries: formData.primaryCountries
        });
      }

      // CORE REQUIRED FIELDS - Match backend validation exactly
      const coreFieldsValid = !!(
        formData.legalCompanyName &&
        formData.businessEntityType &&
        formData.certificationType &&
        formData.totalFacilities &&
        formData.certificationStructureType &&
        formData.processingActivities && Array.isArray(formData.processingActivities) && formData.processingActivities.length > 0 &&
        formData.equipment && Array.isArray(formData.equipment) && formData.equipment.length > 0 &&
        formData.electronicsTypes && Array.isArray(formData.electronicsTypes) && formData.electronicsTypes.length > 0 &&
        formData.totalEmployees &&
        formData.operatingSchedule
      );

      // SUPPLY CHAIN FIELDS - must have a value (including "0")
      const supplyChainValid = !!(formData.totalDownstreamVendors !== undefined && formData.totalDownstreamVendors !== null && formData.totalDownstreamVendors !== '');

      // CONDITIONAL REQUIRED FIELDS
      let conditionalFieldsValid = true;

      // International shipments: require destination countries (trim whitespace)
      const primaryCountriesTrimmed = formData.primaryCountries?.trim();
      if (formData.internationalShipments && !primaryCountriesTrimmed) {
        conditionalFieldsValid = false;
      }

      // Enable submit if all validations pass
      const isFormValid = coreFieldsValid && supplyChainValid && conditionalFieldsValid;

      if (DEBUG_MODE) {
        console.log('[IntakeForm Validation] Results:', {
          coreFieldsValid,
          supplyChainValid,
          conditionalFieldsValid,
          isFormValid,
          internationalShipmentsValue: formData.internationalShipments,
          primaryCountriesValue: formData.primaryCountries,
          primaryCountriesTrimmed: primaryCountriesTrimmed
        });
      }

      setIsValid(isFormValid);
    };

    validateForm();
  }, [formData, isLoading]);

  // Auto-calculate applicable appendices based on user selections (only if not manually overridden)
  useEffect(() => {
    // Wait until override flag is initialized from localStorage
    if (!overrideFlagInitialized && formId) {
      return;
    }

    // Skip auto-calculation if user has manually modified appendices in this session
    if (hasManualAppendixOverride) {
      return;
    }

    const calculateApplicableAppendices = () => {
      const appendices: string[] = [];

      // APP-A: Downstream Recycling Chain
      if (parseInt(formData.totalDownstreamVendors || '0') > 0 || formData.internationalShipments === true) {
        appendices.push('Appendix A: Downstream Recycling Chain');
      }

      // APP-B: Data Sanitization (LOGICAL sanitization per R2v3 standard)
      // Physical destruction falls under Core 7, does NOT trigger Appendix B
      if (formData.processingActivities?.includes('Data Sanitization (Logical)')) {
        appendices.push('Appendix B: Data Sanitization');
      }

      // APP-C: Test & Repair
      if (formData.processingActivities?.includes('Testing') ||
          formData.processingActivities?.includes('Repair') ||
          formData.processingActivities?.includes('Refurbishment')) {
        appendices.push('Appendix C: Test and Repair');
      }

      // APP-D: Specialty Electronics Reuse
      if (formData.processingActivities?.includes('Specialty Electronics') ||
          formData.processingActivities?.includes('Medical Equipment') ||
          formData.processingActivities?.includes('Industrial Equipment')) {
        appendices.push('Appendix D: Specialty Electronics Reuse');
      }

      // APP-E: Materials Recovery
      if (formData.processingActivities?.includes('Materials Recovery') ||
          formData.processingActivities?.includes('Recycling')) {
        appendices.push('Appendix E: Materials Recovery');
      }

      // APP-F: Brokering
      if (formData.processingActivities?.includes('Brokering') ||
          formData.processingActivities?.includes('Trading')) {
        appendices.push('Appendix F: Brokering');
      }

      // APP-G: Photovoltaic (PV) Modules
      if (formData.processingActivities?.includes('Solar Panels/PV Modules')) {
        appendices.push('Appendix G: Photovoltaic (PV) Modules');
      }

      return appendices;
    };

    const autoCalculatedAppendices = calculateApplicableAppendices();
    const currentAppendices = formData.applicableAppendices || [];

    // Auto-update if different from current value
    const appendicesChanged = JSON.stringify([...autoCalculatedAppendices].sort()) !== JSON.stringify([...currentAppendices].sort());
    if (appendicesChanged) {
      updateFormData({ applicableAppendices: autoCalculatedAppendices });
    }
  }, [formData.processingActivities, formData.totalDownstreamVendors, formData.internationalShipments, hasManualAppendixOverride, overrideFlagInitialized, formId]);

  // Initialize form
  useEffect(() => {
    initializeForm();
  }, []);

  const initializeForm = async () => {
    const DEBUG_MODE = import.meta.env.DEV || localStorage.getItem('debug_intake') === 'true';
    
    if (DEBUG_MODE) console.log('[IntakeForm Init] Starting initialization...');
    setIsLoading(true); // Prevent validation from running during initialization
    
    const authToken = localStorage.getItem('auth_token');
    if (DEBUG_MODE) console.log('[IntakeForm Init] Auth token present:', !!authToken);
    
    try {
      // FIRST: Check if user already has an existing DRAFT or IN_PROGRESS intake form
      const existingFormsResponse = await fetch('/api/intake-forms', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (DEBUG_MODE) console.log('[IntakeForm Init] Existing forms response status:', existingFormsResponse.status);

      if (existingFormsResponse.ok) {
        const existingForms = await existingFormsResponse.json();
        if (DEBUG_MODE) console.log('[IntakeForm Init] Found existing forms:', existingForms.length);

        // Find the most recent DRAFT or IN_PROGRESS form
        const activeForm = existingForms.find((form: IntakeFormData) =>
          form.status === 'DRAFT' || form.status === 'IN_PROGRESS'
        );

        if (activeForm) {
          if (DEBUG_MODE) console.log('[IntakeForm Init] Found existing active intake form:', activeForm.id);
          setFormData(activeForm);

          // Restore current section if saved
          if (activeForm.currentStep) {
            setCurrentSection(activeForm.currentStep);
          }
          return; // Exit early - use existing form
        }
      } else if (existingFormsResponse.status === 401) {
        console.error('[IntakeForm Init] Authentication failed - 401 Unauthorized');
        throw new Error('Authentication failed. Please log in again.');
      }

      // If no existing form, create a new one with pre-populated data from onboarding
      const onboardingResponse = await fetch('/api/onboarding/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      let initialData: Partial<IntakeFormData> = {};

      if (onboardingResponse.ok) {
        const onboardingData = await onboardingResponse.json();

        // Map organization profile data to intake form fields
        if (onboardingData.organizationProfile) {
          const org = onboardingData.organizationProfile;
          initialData = {
            // Legal entity information - inherit from onboarding
            legalCompanyName: org.legalName,
            businessEntityType: org.entityType || undefined,
            taxIdEin: org.taxId || undefined,

            // Headquarters address - inherit from onboarding
            hqStreet: org.hqAddress,
            hqCity: org.hqCity,
            hqStateProvince: org.hqState,
            hqCountry: org.hqCountry,
            hqPostalCode: org.hqZipCode,

            // Contact information - inherit from onboarding
            email: org.primaryContactEmail,
            mainPhone: org.primaryContactPhone,
            primaryR2ContactName: org.primaryContactName,
            primaryR2ContactEmail: org.primaryContactEmail,
            primaryR2ContactPhone: org.primaryContactPhone,
          };
        }

        // Map facility profile data for reference
        if (onboardingData.facilityProfile) {
          const facility = onboardingData.facilityProfile;
          // Facility data can be used to pre-populate facility structure section
          initialData.totalFacilities = "1"; // Default since they have at least one facility
          initialData.operatingSchedule = facility.hoursOfOperation || undefined;
          initialData.totalEmployees = facility.headcount?.toString() || undefined;
        }

        console.log('Pre-populated intake form with onboarding data:', initialData);
      }

      // Create new intake form with pre-populated data
      // Ensure required fields have default values to prevent validation errors
      if (DEBUG_MODE) console.log('[IntakeForm Init] Creating new intake form with data:', initialData);
      
      try {
        const response = await fetch('/api/intake-forms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            totalDownstreamVendors: '0', // Default to 0 for validation
            ...initialData
          })
        });

        if (DEBUG_MODE) console.log('[IntakeForm Init] Create form response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[IntakeForm Init] Failed to create form:', errorData);
          throw new Error(errorData.error || 'Failed to create intake form');
        }

        const result = await response.json();
        if (DEBUG_MODE) console.log('[IntakeForm Init] New form created, response:', result);
        
        if (result.success && result.data) {
          if (DEBUG_MODE) console.log('[IntakeForm Init] Setting formData with ID:', result.data.id);
          setFormData(result.data);
        } else if (result.id) {
          // Alternate response format - direct object with id
          if (DEBUG_MODE) console.log('[IntakeForm Init] Setting formData with ID (alternate format):', result.id);
          setFormData(result);
        } else {
          console.error('[IntakeForm Init] Invalid response format:', result);
          throw new Error('Invalid response format - no ID found');
        }
      } catch (createError) {
        console.error('[IntakeForm Init] Failed to create intake form:', createError);
        throw createError;
      }
    } catch (error) {
      console.error('[IntakeForm Init] Error initializing intake form:', error);

      // Fallback: create form without pre-population if onboarding fetch fails
      try {
        if (DEBUG_MODE) console.log('[IntakeForm Init] Attempting fallback form creation...');
        const newForm = await apiPost<IntakeFormData>('/intake-forms', {
          userId: 'demo-user',
          totalDownstreamVendors: '0' // Default to 0 for validation
        });
        if (DEBUG_MODE) console.log('[IntakeForm Init] Fallback form created with ID:', newForm.id);
        setFormData(newForm);
      } catch (fallbackError) {
        console.error('[IntakeForm Init] Fallback form creation failed:', fallbackError);
        
        // Last resort: Show error to user
        toast({
          title: "Error",
          description: "Failed to initialize intake form. Please try logging out and back in.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgressImmediate = async () => {
    if (!formId || isSaving) return; // Prevent concurrent saves

    // Use current ref values for comparison
    const currentDataString = JSON.stringify(formDataRef.current);
    if (currentDataString === lastSavedDataRef.current) {
      console.log('No changes detected, skipping save');
      hasUnsavedChangesRef.current = false;
      return; // No changes to save
    }

    console.log('Saving progress for form:', formId);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/intake-forms/${formId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          ...formDataRef.current,
          currentStep: currentSection,
          isComplete: false,
          updatedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save progress');
      }

      const result = await response.json();
      console.log('Progress saved successfully');
      setLastSaved(new Date());
      lastSavedDataRef.current = currentDataString; // Update last saved state using ref
      hasUnsavedChangesRef.current = false; // Mark as saved
    } catch (error) {
      console.error('Error saving progress:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Manual save function for immediate saves (like navigation or submit)
  const saveProgress = saveProgressImmediate;

  // Updated handleSubmit to redirect directly to created assessment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.id || !isValid) {
      toast({
        title: "Validation Error",
        description: "Please complete all required fields before submitting.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSaving(true);

      // Submit the intake form
      const response = await fetch(`/api/intake-forms/${formData.id}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit intake form');
      }

      const result = await response.json();
      console.log('Intake form submitted successfully:', result);

      toast({
        title: "Intake Complete!",
        description: "Your assessment questions are now ready based on your responses.",
      });

      // Navigate directly to the assessment if one was created
      if (result.data?.assessmentId) {
        setTimeout(() => {
          setLocation(`/assessments/${result.data.assessmentId}`);
        }, 1500);
      } else {
        // Fallback to dashboard if no assessment was created
        setTimeout(() => {
          setLocation('/dashboard');
        }, 1500);
      }

    } catch (error) {
      console.error('Error submitting intake form:', error);
      toast({
        title: "Submission Error",
        description: error instanceof Error ? error.message : "Failed to submit intake form",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };


  const updateFormData = (updates: Partial<IntakeFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const calculateProgress = () => {
    return Math.round((currentSection / SECTIONS.length) * 100);
  };

  const renderSection = () => {
    switch (currentSection) {
      case 1:
        return renderLegalEntitySection();
      case 2:
        return renderKeyPersonnelSection();
      case 3:
        return renderFacilityStructureSection();
      case 4:
        return renderWorkforceSection();
      case 5:
        return renderCertificationsSection();
      case 6:
        return renderProcessingActivitiesSection();
      case 7:
        return renderDownstreamVendorsSection();
      case 8:
        return renderAppendicesSection();
      case 9:
        return renderCertificationObjectivesSection();
      case 10:
        return renderComplianceStatusSection();
      case 11:
        return renderPreliminaryAssessmentSection();
      case 12:
        return renderAdministrativeSection();
      default:
        return null;
    }
  };

  const renderLegalEntitySection = () => (
    <div className="space-y-6">
      {/* Pre-population Notice */}
      {formData.legalCompanyName && (
        <div className="bg-jade/10 border border-jade/20 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 text-jade-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Pre-populated from Onboarding</span>
          </div>
          <p className="text-sm text-jade-600 mt-1">
            Basic company and contact information has been automatically filled from your setup wizard to save time.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="legalCompanyName">Legal Company Name *</Label>
          <Input
            id="legalCompanyName"
            value={formData.legalCompanyName || ''}
            onChange={(e) => updateFormData({ legalCompanyName: e.target.value })}
            placeholder="Enter legal company name"
            className={formData.legalCompanyName ? "border-jade/30 bg-jade/5" : ""}
            required
          />
          {formData.legalCompanyName && (
            <p className="text-xs text-jade-600 mt-1">✓ Pre-populated from onboarding</p>
          )}
        </div>
        <div>
          <Label htmlFor="dbaTradeNames">DBA/Trade Names</Label>
          <Input
            id="dbaTradeNames"
            value={formData.dbaTradeNames || ''}
            onChange={(e) => updateFormData({ dbaTradeNames: e.target.value })}
            placeholder="Enter any DBA or trade names"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="businessEntityType">Business Entity Type *</Label>
          <Select
            value={formData.businessEntityType || ''}
            onValueChange={(value) => updateFormData({ businessEntityType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select entity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CORPORATION">Corporation</SelectItem>
              <SelectItem value="LLC">LLC</SelectItem>
              <SelectItem value="PARTNERSHIP">Partnership</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="taxIdEin">Tax ID/EIN</Label>
          <Input
            id="taxIdEin"
            value={formData.taxIdEin || ''}
            onChange={(e) => updateFormData({ taxIdEin: e.target.value })}
            placeholder="XX-XXXXXXX"
          />
        </div>
        <div>
          <Label htmlFor="yearEstablished">Year Established</Label>
          <Input
            id="yearEstablished"
            value={formData.yearEstablished || ''}
            onChange={(e) => updateFormData({ yearEstablished: e.target.value })}
            placeholder="YYYY"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="primaryBusinessLicense">Primary Business License</Label>
        <Input
          id="primaryBusinessLicense"
          value={formData.primaryBusinessLicense || ''}
          onChange={(e) => updateFormData({ primaryBusinessLicense: e.target.value })}
          placeholder="Enter primary business license information"
        />
      </div>

      <div className="border-t pt-6">
        <h4 className="text-lg font-semibold mb-4">Headquarters Address</h4>
        <div className="space-y-4">
          <div>
            <Label htmlFor="hqStreet">Street Address *</Label>
            <Input
              id="hqStreet"
              value={formData.hqStreet || ''}
              onChange={(e) => updateFormData({ hqStreet: e.target.value })}
              placeholder="Enter street address"
              className={formData.hqStreet ? "border-jade/30 bg-jade/5" : ""}
              required
            />
            {formData.hqStreet && (
              <p className="text-xs text-jade-600 mt-1">✓ Pre-populated from onboarding</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="hqCity">City *</Label>
              <Input
                id="hqCity"
                value={formData.hqCity || ''}
                onChange={(e) => updateFormData({ hqCity: e.target.value })}
                placeholder="City"
                required
              />
            </div>
            <div>
              <Label htmlFor="hqStateProvince">State/Province *</Label>
              <Input
                id="hqStateProvince"
                value={formData.hqStateProvince || ''}
                onChange={(e) => updateFormData({ hqStateProvince: e.target.value })}
                placeholder="State/Province"
                required
              />
            </div>
            <div>
              <Label htmlFor="hqCountry">Country *</Label>
              <Input
                id="hqCountry"
                value={formData.hqCountry || ''}
                onChange={(e) => updateFormData({ hqCountry: e.target.value })}
                placeholder="Country"
                required
              />
            </div>
            <div>
              <Label htmlFor="hqPostalCode">Postal Code</Label>
              <Input
                id="hqPostalCode"
                value={formData.hqPostalCode || ''}
                onChange={(e) => updateFormData({ hqPostalCode: e.target.value })}
                placeholder="Postal Code"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h4 className="text-lg font-semibold mb-4">Primary Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="mainPhone">Main Phone</Label>
            <Input
              id="mainPhone"
              value={formData.mainPhone || ''}
              onChange={(e) => updateFormData({ mainPhone: e.target.value })}
              placeholder="(XXX) XXX-XXXX"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => updateFormData({ email: e.target.value })}
              placeholder="company@example.com"
              className={formData.email ? "border-jade/30 bg-jade/5" : ""}
            />
            {formData.email && (
              <p className="text-xs text-jade-600 mt-1">✓ Pre-populated from onboarding</p>
            )}
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website || ''}
              onChange={(e) => updateFormData({ website: e.target.value })}
              placeholder="https://www.company.com"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderKeyPersonnelSection = () => (
    <div className="space-y-6">
      <div className="border-b pb-6">
        <h4 className="text-lg font-semibold mb-4">Primary R2 Contact</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primaryR2ContactName">Name *</Label>
            <Input
              id="primaryR2ContactName"
              value={formData.primaryR2ContactName || ''}
              onChange={(e) => updateFormData({ primaryR2ContactName: e.target.value })}
              placeholder="Enter full name"
              required
            />
          </div>
          <div>
            <Label htmlFor="primaryR2ContactTitle">Title</Label>
            <Input
              id="primaryR2ContactTitle"
              value={formData.primaryR2ContactTitle || ''}
              onChange={(e) => updateFormData({ primaryR2ContactTitle: e.target.value })}
              placeholder="Job title"
            />
          </div>
          <div>
            <Label htmlFor="primaryR2ContactEmail">Email</Label>
            <Input
              id="primaryR2ContactEmail"
              type="email"
              value={formData.primaryR2ContactEmail || ''}
              onChange={(e) => updateFormData({ primaryR2ContactEmail: e.target.value })}
              placeholder="email@company.com"
            />
          </div>
          <div>
            <Label htmlFor="primaryR2ContactPhone">Phone</Label>
            <Input
              id="primaryR2ContactPhone"
              value={formData.primaryR2ContactPhone || ''}
              onChange={(e) => updateFormData({ primaryR2ContactPhone: e.target.value })}
              placeholder="(XXX) XXX-XXXX"
            />
          </div>
        </div>
      </div>

      <div className="border-b pb-6">
        <h4 className="text-lg font-semibold mb-4">Top Management Representative</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="topMgmtRepName">Name</Label>
            <Input
              id="topMgmtRepName"
              value={formData.topMgmtRepName || ''}
              onChange={(e) => updateFormData({ topMgmtRepName: e.target.value })}
              placeholder="Enter full name"
            />
          </div>
          <div>
            <Label htmlFor="topMgmtRepTitle">Title</Label>
            <Input
              id="topMgmtRepTitle"
              value={formData.topMgmtRepTitle || ''}
              onChange={(e) => updateFormData({ topMgmtRepTitle: e.target.value })}
              placeholder="Job title"
            />
          </div>
          <div>
            <Label htmlFor="topMgmtRepEmail">Email</Label>
            <Input
              id="topMgmtRepEmail"
              type="email"
              value={formData.topMgmtRepEmail || ''}
              onChange={(e) => updateFormData({ topMgmtRepEmail: e.target.value })}
              placeholder="email@company.com"
            />
          </div>
          <div>
            <Label htmlFor="topMgmtRepPhone">Phone</Label>
            <Input
              id="topMgmtRepPhone"
              value={formData.topMgmtRepPhone || ''}
              onChange={(e) => updateFormData({ topMgmtRepPhone: e.target.value })}
              placeholder="(XXX) XXX-XXXX"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Data Protection Representative</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dataProtectionRepName">Name</Label>
            <Input
              id="dataProtectionRepName"
              value={formData.dataProtectionRepName || ''}
              onChange={(e) => updateFormData({ dataProtectionRepName: e.target.value })}
              placeholder="Enter full name"
            />
          </div>
          <div>
            <Label htmlFor="dataProtectionRepTitle">Title</Label>
            <Input
              id="dataProtectionRepTitle"
              value={formData.dataProtectionRepTitle || ''}
              onChange={(e) => updateFormData({ dataProtectionRepTitle: e.target.value })}
              placeholder="Job title"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFacilityStructureSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="totalFacilities">Total Number of Facilities *</Label>
          <Input
            id="totalFacilities"
            value={formData.totalFacilities || ''}
            onChange={(e) => updateFormData({ totalFacilities: e.target.value })}
            placeholder="Enter number"
          />
        </div>
        <div>
          <Label htmlFor="certificationStructureType">Certification Structure Type *</Label>
          <Select
            value={formData.certificationStructureType || ''}
            onValueChange={(value) => updateFormData({ certificationStructureType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select structure type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SINGLE">Single Facility</SelectItem>
              <SelectItem value="CAMPUS">Campus (Multiple buildings, same location)</SelectItem>
              <SelectItem value="SHARED">Shared Facility</SelectItem>
              <SelectItem value="COMMON_PARENT">Common Parent Organization</SelectItem>
              <SelectItem value="GROUP">Group Certification</SelectItem>
              <SelectItem value="UNSURE">Unsure</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderWorkforceSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="totalEmployees">Total Number of Employees *</Label>
          <Input
            id="totalEmployees"
            value={formData.totalEmployees || ''}
            onChange={(e) => updateFormData({ totalEmployees: e.target.value })}
            placeholder="Enter number"
          />
        </div>
        <div>
          <Label htmlFor="operatingSchedule">Operating Schedule *</Label>
          <Input
            id="operatingSchedule"
            value={formData.operatingSchedule || ''}
            onChange={(e) => updateFormData({ operatingSchedule: e.target.value })}
            placeholder="e.g., Monday-Friday 8AM-5PM"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="seasonalWorkforceVariations"
          checked={formData.seasonalWorkforceVariations || false}
          onCheckedChange={(checked) => updateFormData({ seasonalWorkforceVariations: checked as boolean })}
        />
        <Label htmlFor="seasonalWorkforceVariations">Seasonal workforce variations</Label>
      </div>

      {formData.seasonalWorkforceVariations && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="seasonalRangeFrom">Seasonal Range From</Label>
            <Input
              id="seasonalRangeFrom"
              value={formData.seasonalRangeFrom || ''}
              onChange={(e) => updateFormData({ seasonalRangeFrom: e.target.value })}
              placeholder="e.g., 50 employees"
            />
          </div>
          <div>
            <Label htmlFor="seasonalRangeTo">Seasonal Range To</Label>
            <Input
              id="seasonalRangeTo"
              value={formData.seasonalRangeTo || ''}
              onChange={(e) => updateFormData({ seasonalRangeTo: e.target.value })}
              placeholder="e.g., 150 employees"
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="languagesSpokenByMgmt">Languages Spoken by Management</Label>
        <Input
          id="languagesSpokenByMgmt"
          value={formData.languagesSpokenByMgmt || ''}
          onChange={(e) => updateFormData({ languagesSpokenByMgmt: e.target.value })}
          placeholder="e.g., English, Spanish, Mandarin"
        />
      </div>
    </div>
  );

  const renderCertificationsSection = () => (
    <div className="space-y-6">
      <div className="border-b pb-6">
        <h4 className="text-lg font-semibold mb-4">Environmental Health & Safety Management System</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ehsmsType">EHS Management System Type</Label>
            <Input
              id="ehsmsType"
              value={formData.ehsmsType || ''}
              onChange={(e) => updateFormData({ ehsmsType: e.target.value })}
              placeholder="e.g., ISO 14001, OHSAS 18001"
            />
          </div>
          <div>
            <Label htmlFor="ehsmsYear">Certification Year</Label>
            <Input
              id="ehsmsYear"
              value={formData.ehsmsYear || ''}
              onChange={(e) => updateFormData({ ehsmsYear: e.target.value })}
              placeholder="YYYY"
            />
          </div>
        </div>
      </div>

      <div className="border-b pb-6">
        <h4 className="text-lg font-semibold mb-4">Quality Management System</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="qmsType">QMS Type</Label>
            <Input
              id="qmsType"
              value={formData.qmsType || ''}
              onChange={(e) => updateFormData({ qmsType: e.target.value })}
              placeholder="e.g., ISO 9001"
            />
          </div>
          <div>
            <Label htmlFor="qmsYear">Certification Year</Label>
            <Input
              id="qmsYear"
              value={formData.qmsYear || ''}
              onChange={(e) => updateFormData({ qmsYear: e.target.value })}
              placeholder="YYYY"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="otherCertifications">Other Relevant Certifications</Label>
        <Textarea
          id="otherCertifications"
          value={formData.otherCertifications || ''}
          onChange={(e) => updateFormData({ otherCertifications: e.target.value })}
          placeholder="List any other relevant certifications"
          rows={3}
        />
      </div>
    </div>
  );

  const renderProcessingActivitiesSection = () => {
    // R2v3 Standard Processing Activities - Organized by Appendix Applicability
    const processingActivities = {
      core: ['Collection', 'Resale', 'Disposal'],
      appendixC: ['Testing', 'Repair', 'Refurbishment'],
      appendixB: ['Data Sanitization (Logical)', 'Data Destruction (Physical)'],
      appendixD: ['Specialty Electronics', 'Medical Equipment', 'Industrial Equipment'],
      appendixE: ['Materials Recovery', 'Recycling'],
      appendixF: ['Brokering', 'Trading'],
      appendixG: ['Solar Panels/PV Modules']
    };

    const allActivities = [
      ...processingActivities.core,
      ...processingActivities.appendixC,
      ...processingActivities.appendixB,
      ...processingActivities.appendixD,
      ...processingActivities.appendixE,
      ...processingActivities.appendixF,
      ...processingActivities.appendixG
    ];

    return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Processing Activities (Select all that apply) *</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Select all activities your facility performs. This determines which R2v3 Appendices apply to your certification.
        </p>

        <div className="space-y-4">
          {/* Core Activities */}
          <div>
            <p className="text-sm font-medium mb-2">Core Activities</p>
            <div className="grid grid-cols-2 gap-2">
              {processingActivities.core.map((activity) => (
                <div key={activity} className="flex items-center space-x-2">
                  <Checkbox
                    id={activity}
                    checked={formData.processingActivities?.includes(activity) || false}
                    onCheckedChange={(checked) => {
                      const activities = formData.processingActivities || [];
                      if (checked) {
                        updateFormData({ processingActivities: [...activities, activity] });
                      } else {
                        updateFormData({ processingActivities: activities.filter(a => a !== activity) });
                      }
                    }}
                    data-testid={`checkbox-activity-${activity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  />
                  <Label htmlFor={activity} className="text-sm">{activity}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Test & Repair (Appendix C) */}
          <div>
            <p className="text-sm font-medium mb-2">Test & Repair (Appendix C)</p>
            <div className="grid grid-cols-2 gap-2">
              {processingActivities.appendixC.map((activity) => (
                <div key={activity} className="flex items-center space-x-2">
                  <Checkbox
                    id={activity}
                    checked={formData.processingActivities?.includes(activity) || false}
                    onCheckedChange={(checked) => {
                      const activities = formData.processingActivities || [];
                      if (checked) {
                        updateFormData({ processingActivities: [...activities, activity] });
                      } else {
                        updateFormData({ processingActivities: activities.filter(a => a !== activity) });
                      }
                    }}
                    data-testid={`checkbox-activity-${activity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  />
                  <Label htmlFor={activity} className="text-sm">{activity}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Data Activities (Appendix B) */}
          <div>
            <p className="text-sm font-medium mb-2">Data Management (Appendix B for Logical Sanitization Only)</p>
            <div className="grid grid-cols-2 gap-2">
              {processingActivities.appendixB.map((activity) => (
                <div key={activity} className="flex items-center space-x-2">
                  <Checkbox
                    id={activity}
                    checked={formData.processingActivities?.includes(activity) || false}
                    onCheckedChange={(checked) => {
                      const activities = formData.processingActivities || [];
                      if (checked) {
                        updateFormData({ processingActivities: [...activities, activity] });
                      } else {
                        updateFormData({ processingActivities: activities.filter(a => a !== activity) });
                      }
                    }}
                    data-testid={`checkbox-activity-${activity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  />
                  <Label htmlFor={activity} className="text-sm">{activity}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Specialty Electronics (Appendix D) */}
          <div>
            <p className="text-sm font-medium mb-2">Specialty Electronics Reuse (Appendix D)</p>
            <div className="grid grid-cols-2 gap-2">
              {processingActivities.appendixD.map((activity) => (
                <div key={activity} className="flex items-center space-x-2">
                  <Checkbox
                    id={activity}
                    checked={formData.processingActivities?.includes(activity) || false}
                    onCheckedChange={(checked) => {
                      const activities = formData.processingActivities || [];
                      if (checked) {
                        updateFormData({ processingActivities: [...activities, activity] });
                      } else {
                        updateFormData({ processingActivities: activities.filter(a => a !== activity) });
                      }
                    }}
                    data-testid={`checkbox-activity-${activity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  />
                  <Label htmlFor={activity} className="text-sm">{activity}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Materials Recovery (Appendix E) */}
          <div>
            <p className="text-sm font-medium mb-2">Materials Recovery (Appendix E)</p>
            <div className="grid grid-cols-2 gap-2">
              {processingActivities.appendixE.map((activity) => (
                <div key={activity} className="flex items-center space-x-2">
                  <Checkbox
                    id={activity}
                    checked={formData.processingActivities?.includes(activity) || false}
                    onCheckedChange={(checked) => {
                      const activities = formData.processingActivities || [];
                      if (checked) {
                        updateFormData({ processingActivities: [...activities, activity] });
                      } else {
                        updateFormData({ processingActivities: activities.filter(a => a !== activity) });
                      }
                    }}
                    data-testid={`checkbox-activity-${activity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  />
                  <Label htmlFor={activity} className="text-sm">{activity}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Brokering (Appendix F) */}
          <div>
            <p className="text-sm font-medium mb-2">Brokering (Appendix F)</p>
            <div className="grid grid-cols-2 gap-2">
              {processingActivities.appendixF.map((activity) => (
                <div key={activity} className="flex items-center space-x-2">
                  <Checkbox
                    id={activity}
                    checked={formData.processingActivities?.includes(activity) || false}
                    onCheckedChange={(checked) => {
                      const activities = formData.processingActivities || [];
                      if (checked) {
                        updateFormData({ processingActivities: [...activities, activity] });
                      } else {
                        updateFormData({ processingActivities: activities.filter(a => a !== activity) });
                      }
                    }}
                    data-testid={`checkbox-activity-${activity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  />
                  <Label htmlFor={activity} className="text-sm">{activity}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Solar/PV (Appendix G) */}
          <div>
            <p className="text-sm font-medium mb-2">Photovoltaic Modules (Appendix G)</p>
            <div className="grid grid-cols-2 gap-2">
              {processingActivities.appendixG.map((activity) => (
                <div key={activity} className="flex items-center space-x-2">
                  <Checkbox
                    id={activity}
                    checked={formData.processingActivities?.includes(activity) || false}
                    onCheckedChange={(checked) => {
                      const activities = formData.processingActivities || [];
                      if (checked) {
                        updateFormData({ processingActivities: [...activities, activity] });
                      } else {
                        updateFormData({ processingActivities: activities.filter(a => a !== activity) });
                      }
                    }}
                    data-testid={`checkbox-activity-${activity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  />
                  <Label htmlFor={activity} className="text-sm">{activity}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label>Electronics Types (Select all that apply) *</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {['Computers', 'Mobile Devices', 'Servers', 'Networking Equipment', 'Consumer Electronics', 'Industrial Electronics'].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`electronics-${type}`}
                checked={formData.electronicsTypes?.includes(type) || false}
                onCheckedChange={(checked) => {
                  const types = formData.electronicsTypes || [];
                  if (checked) {
                    updateFormData({ electronicsTypes: [...types, type] });
                  } else {
                    updateFormData({ electronicsTypes: types.filter(t => t !== type) });
                  }
                }}
              />
              <Label htmlFor={`electronics-${type}`}>{type}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Equipment Processed (Select all that apply) *</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {['COMPUTERS', 'MOBILE_DEVICES', 'SERVERS', 'NETWORKING', 'PERIPHERALS', 'OTHER'].map((equipment) => (
            <div key={equipment} className="flex items-center space-x-2">
              <Checkbox
                id={`equipment-${equipment}`}
                checked={formData.equipment?.includes(equipment) || false}
                onCheckedChange={(checked) => {
                  const equipmentList = formData.equipment || [];
                  if (checked) {
                    updateFormData({ equipment: [...equipmentList, equipment] });
                  } else {
                    updateFormData({ equipment: equipmentList.filter(e => e !== equipment) });
                  }
                }}
                data-testid={`checkbox-equipment-${equipment.toLowerCase()}`}
              />
              <Label htmlFor={`equipment-${equipment}`}>{equipment.replace(/_/g, ' ')}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="monthlyTonnage">Monthly Tonnage Processed</Label>
          <Input
            id="monthlyTonnage"
            value={formData.monthlyTonnage || ''}
            onChange={(e) => updateFormData({ monthlyTonnage: e.target.value })}
            placeholder="Enter tonnage"
          />
        </div>
        <div>
          <Label htmlFor="annualVolume">Annual Volume</Label>
          <Input
            id="annualVolume"
            value={formData.annualVolume || ''}
            onChange={(e) => updateFormData({ annualVolume: e.target.value })}
            placeholder="Enter annual volume"
          />
        </div>
      </div>
    </div>
  );
};

  const renderDownstreamVendorsSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="totalDownstreamVendors">Total Downstream Vendors *</Label>
          <Input
            id="totalDownstreamVendors"
            type="number"
            value={formData.totalDownstreamVendors || '0'}
            onChange={(e) => updateFormData({ totalDownstreamVendors: e.target.value })}
            placeholder="0"
            data-testid="input-totalDownstreamVendors"
          />
        </div>
        <div>
          <Label htmlFor="numR2CertifiedDsv">R2 Certified Vendors</Label>
          <Input
            id="numR2CertifiedDsv"
            value={formData.numR2CertifiedDsv || ''}
            onChange={(e) => updateFormData({ numR2CertifiedDsv: e.target.value })}
            placeholder="Enter number"
          />
        </div>
        <div>
          <Label htmlFor="numNonR2Dsv">Non-R2 Certified Vendors</Label>
          <Input
            id="numNonR2Dsv"
            value={formData.numNonR2Dsv || ''}
            onChange={(e) => updateFormData({ numNonR2Dsv: e.target.value })}
            placeholder="Enter number"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="internationalShipments"
          checked={formData.internationalShipments || false}
          onCheckedChange={(checked) => updateFormData({ internationalShipments: checked as boolean })}
        />
        <Label htmlFor="internationalShipments">International shipments</Label>
      </div>

      {formData.internationalShipments && (
        <div>
          <Label htmlFor="primaryCountries">Primary Countries for International Shipments</Label>
          <Input
            id="primaryCountries"
            value={formData.primaryCountries || ''}
            onChange={(e) => updateFormData({ primaryCountries: e.target.value })}
            placeholder="List primary countries"
          />
        </div>
      )}
    </div>
  );

  const renderAppendicesSection = () => (
    <div className="space-y-6">
      {/* Auto-population Notice */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">Auto-Selected Based on Your Activities</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              These R2v3 Appendices have been automatically selected based on your processing activities, downstream vendors, and other selections.
              You can modify these selections if needed.
            </p>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-base font-semibold">Applicable R2v3 Appendices</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Review the auto-selected appendices and adjust if necessary
        </p>
        <div className="grid grid-cols-1 gap-2 mt-2">
          {[
            'Appendix A: Downstream Recycling Chain',
            'Appendix B: Data Sanitization',
            'Appendix C: Test and Repair',
            'Appendix D: Specialty Electronics Reuse',
            'Appendix E: Materials Recovery',
            'Appendix F: Brokering',
            'Appendix G: Photovoltaic (PV) Modules'
          ].map((appendix) => (
            <div key={appendix} className="flex items-center space-x-2">
              <Checkbox
                id={appendix}
                checked={formData.applicableAppendices?.includes(appendix) || false}
                onCheckedChange={(checked) => {
                  // Mark that user has manually overridden auto-calculation (persisted to localStorage)
                  setManualOverride(true);

                  const appendices = formData.applicableAppendices || [];
                  if (checked) {
                    updateFormData({ applicableAppendices: [...appendices, appendix] });
                  } else {
                    updateFormData({ applicableAppendices: appendices.filter(a => a !== appendix) });
                  }
                }}
                data-testid={`checkbox-appendix-${appendix.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              />
              <Label htmlFor={appendix} className="text-sm">{appendix}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCertificationObjectivesSection = () => (
    <div className="space-y-6">
      <div>
        <Label htmlFor="certificationType">Certification Type *</Label>
        <Select
          value={formData.certificationType || ''}
          onValueChange={(value) => updateFormData({ certificationType: value })}
        >
          <SelectTrigger data-testid="select-certificationType">
            <SelectValue placeholder="Select certification type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INITIAL">Initial Certification</SelectItem>
            <SelectItem value="RECERTIFICATION">Recertification</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
            <SelectItem value="SCOPE_EXTENSION">Scope Extension</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="targetTimeline">Target Timeline</Label>
        <Input
          id="targetTimeline"
          value={formData.targetTimeline || ''}
          onChange={(e) => updateFormData({ targetTimeline: e.target.value })}
          placeholder="e.g., 6 months, Q2 2024"
        />
      </div>

      <div>
        <Label htmlFor="businessDrivers">Business Drivers for R2 Certification</Label>
        <Textarea
          id="businessDrivers"
          value={formData.businessDrivers || ''}
          onChange={(e) => updateFormData({ businessDrivers: e.target.value })}
          placeholder="Describe the business reasons for pursuing R2 certification"
          rows={3}
        />
      </div>
    </div>
  );

  const renderComplianceStatusSection = () => (
    <div className="space-y-6">
      <div>
        <Label htmlFor="legalComplianceStatus">Current Legal Compliance Status</Label>
        <Textarea
          id="legalComplianceStatus"
          value={formData.legalComplianceStatus || ''}
          onChange={(e) => updateFormData({ legalComplianceStatus: e.target.value })}
          placeholder="Describe current compliance status"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="dataSecurityReadiness">Data Security Readiness</Label>
        <Textarea
          id="dataSecurityReadiness"
          value={formData.dataSecurityReadiness || ''}
          onChange={(e) => updateFormData({ dataSecurityReadiness: e.target.value })}
          placeholder="Describe current data security measures and readiness"
          rows={3}
        />
      </div>
    </div>
  );

  const renderPreliminaryAssessmentSection = () => (
    <div className="space-y-6">
      <div>
        <Label htmlFor="estimatedAuditTimeCategory">Estimated Audit Time Category</Label>
        <Select
          value={formData.estimatedAuditTimeCategory || ''}
          onValueChange={(value) => updateFormData({ estimatedAuditTimeCategory: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select audit time category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1-2_days">1-2 Days</SelectItem>
            <SelectItem value="3-4_days">3-4 Days</SelectItem>
            <SelectItem value="5+_days">5+ Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="integrationOpportunities">Integration Opportunities</Label>
        <Textarea
          id="integrationOpportunities"
          value={formData.integrationOpportunities || ''}
          onChange={(e) => updateFormData({ integrationOpportunities: e.target.value })}
          placeholder="Describe opportunities for integration with existing systems"
          rows={3}
        />
      </div>
    </div>
  );

  const renderAdministrativeSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fileClientId">File/Client ID</Label>
          <Input
            id="fileClientId"
            value={formData.fileClientId || ''}
            onChange={(e) => updateFormData({ fileClientId: e.target.value })}
            placeholder="Internal file or client ID"
          />
        </div>
        <div>
          <Label htmlFor="cbReference">CB Reference</Label>
          <Input
            id="cbReference"
            value={formData.cbReference || ''}
            onChange={(e) => updateFormData({ cbReference: e.target.value })}
            placeholder="Certification body reference"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="specialConsiderations">Special Considerations</Label>
        <Textarea
          id="specialConsiderations"
          value={formData.specialConsiderations || ''}
          onChange={(e) => updateFormData({ specialConsiderations: e.target.value })}
          placeholder="Any special considerations or notes"
          rows={3}
        />
      </div>
    </div>
  );

  const renderSubmitButton = () => {
    return (
      <Button
        type="submit"
        disabled={isSaving || !isValid}
        className="bg-jade text-white hover:bg-jade/90"
      >
        {isSaving ? 'Processing...' : 'Complete Intake & Start Assessment'}
      </Button>
    );
  };


  return (
    <div>
      <ClientContextBanner />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground" data-testid="text-intake-title">R2v3 Intake Form</h2>
          <p className="text-muted-foreground mt-2">Complete this comprehensive intake to begin your R2v3 certification journey</p>

        {/* Setup Guidance Alert */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4" data-testid="alert-setup-guidance">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Final Step: Complete Your Setup</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                You're almost done! This intake form is the final required step in your onboarding process.
                Once completed, you'll have full access to your R2v3 certification dashboard and can begin creating assessments.
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                <li>The form auto-saves your progress every 10 seconds</li>
                <li>You can navigate between sections using the Previous/Next buttons</li>
                <li>Complete all required fields marked with an asterisk (*)</li>
                <li>Click "Complete Intake & Start Assessment" when you reach the final section</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span data-testid="text-section-progress">Section {currentSection} of {SECTIONS.length}</span>
            <span data-testid="text-percentage-complete">{calculateProgress()}% Complete</span>
          </div>
          <Progress value={calculateProgress()} className="h-2" data-testid="progress-intake-form" />
        </div>

        {/* Auto-save indicator */}
        <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
          <span>{SECTIONS[currentSection - 1]?.description}</span>
          <div className="flex items-center space-x-2">
            {isSaving && (
              <div className="flex items-center space-x-1">
                <Save className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {lastSaved && !isSaving && (
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{SECTIONS[currentSection - 1]?.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {renderSection()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => {
            setCurrentSection(Math.max(1, currentSection - 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={currentSection === 1}
          data-testid="button-previous-section"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="flex space-x-2">
          {currentSection < SECTIONS.length ? (
            <Button
              onClick={() => {
                setCurrentSection(Math.min(SECTIONS.length, currentSection + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="bg-jade text-white hover:bg-jade/90"
              data-testid="button-next-section"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            renderSubmitButton()
          )}
        </div>
      </div>
      </div>
    </div>
  );
}