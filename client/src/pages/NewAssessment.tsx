import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, apiGet, Assessment } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertTriangle, CheckCircle, ArrowRight, Factory, AlertCircle, Star } from "lucide-react";

interface IntakeForm {
  id: string;
  title: string;
  status: string;
  completionPercentage: number;
  legalCompanyName?: string;
  createdAt: string;
}

interface Facility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  isPrimary: boolean;
  isActive: boolean;
  operatingStatus: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'SUSPENDED';
}

interface ClientOrganization {
  id: string;
  legalName: string;
  dbaName?: string;
  hqCity: string;
  hqState: string;
  primaryContactName: string;
}

interface ClientFacility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  operatingStatus: string;
  clientOrganizationId: string;
}

function NewAssessment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    stdCode: '',
    priority: 'Medium',
    intakeFormId: '',
    facilityId: '',
    clientOrganizationId: '',
    clientFacilityId: ''
  });
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [clientOrganizations, setClientOrganizations] = useState<ClientOrganization[]>([]);
  const [clientFacilities, setClientFacilities] = useState<ClientFacility[]>([]);
  const [loadingIntake, setLoadingIntake] = useState(true);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [loadingClientOrgs, setLoadingClientOrgs] = useState(false);
  const [loadingClientFacilities, setLoadingClientFacilities] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Get authenticated user from auth context
  const { user } = useAuth();
  
  // Determine if user is a consultant
  const isConsultant = user?.tenant?.type === 'CONSULTANT';

  // Load available standards
  // const { data: standards = [], isLoading: standardsLoading } = useQuery({
  //   queryKey: ['standards'],
  //   queryFn: () => apiGet<any[]>('/api/assessments/standards'),
  // });

  // Temporarily hardcode standards due to API route conflicts
  const standards = [
    { code: 'R2V3_1', title: 'R2v3 Responsible Sourcing', version: '1.0', description: 'R2v3 Pre-certification Assessment' }
  ];
  const standardsLoading = false;

  useEffect(() => {
    loadIntakeForms();
    if (isConsultant) {
      loadClientOrganizations();
    } else {
      loadFacilities();
    }
  }, [isConsultant]);

  const loadIntakeForms = async () => {
    setLoadingIntake(true);
    setValidationErrors({}); // Clear previous errors
    try {
      console.log('Loading intake forms...');
      const response = await apiGet<any>('/intake-forms');

      // Handle different response formats and ensure we have an array
      let forms = [];
      if (response?.data && Array.isArray(response.data)) {
        forms = response.data;
      } else if (response?.forms && Array.isArray(response.forms)) {
        forms = response.forms;
      } else if (Array.isArray(response)) {
        forms = response;
      } else {
        console.warn('Unexpected intake forms response format:', response);
        forms = [];
      }

      console.log('Loaded forms:', forms);

      // Ensure forms is an array before filtering
      const submittedForms = Array.isArray(forms)
        ? forms.filter((form: IntakeForm) =>
            form.status === 'SUBMITTED' || form.status === 'APPROVED'
          )
        : [];

      console.log('Submitted forms:', submittedForms.length);
      setIntakeForms(submittedForms);

      // Auto-select the most recent submitted form and pre-fill title
      if (submittedForms.length > 0) {
        const latest = submittedForms.sort((a, b) => {
          const aDate = new Date(a.createdAt).getTime();
          const bDate = new Date(b.createdAt).getTime();
          return bDate - aDate;
        })[0];

        if (latest) {
          console.log('Auto-selecting latest intake form:', latest.id);
          setFormData(prev => ({
            ...prev,
            intakeFormId: latest.id,
            title: `${latest.legalCompanyName || 'Company'} R2v3 Assessment`,
            stdCode: 'R2V3_1'
          }));
        }
      }
    } catch (error) {
      console.error('Error loading intake forms:', error);
      toast({
        title: "Loading Error",
        description: "Failed to load intake forms. Please refresh the page.",
        variant: "destructive"
      });
      setIntakeForms([]);
    } finally {
      setLoadingIntake(false);
    }
  };

  const loadFacilities = async () => {
    setLoadingFacilities(true);
    setValidationErrors({}); // Clear previous errors
    try {
      const response = await apiGet<any>('/facilities');

      // Handle different response formats and ensure we have an array
      let facilitiesData = [];
      if (response?.data && Array.isArray(response.data)) {
        facilitiesData = response.data;
      } else if (response?.facilities && Array.isArray(response.facilities)) {
        facilitiesData = response.facilities;
      } else if (Array.isArray(response)) {
        facilitiesData = response;
      } else {
        console.warn('Unexpected facilities response format:', response);
        facilitiesData = [];
      }

      // Enhanced facility validation with operational status checks
      const operationalFacilities = facilitiesData.filter((facility: Facility) =>
        facility.isActive && facility.operatingStatus === 'ACTIVE'
      );

      const hasOperationalFacilities = operationalFacilities.length > 0;
      if (!hasOperationalFacilities && facilitiesData.length > 0) {
        setValidationErrors(prev => ({ ...prev, facilities: 'No operational facilities available for assessments.' }));
      } else if (facilitiesData.length === 0) {
        setValidationErrors(prev => ({ ...prev, facilities: 'No facilities have been set up yet.' }));
      }

      setFacilities(facilitiesData); // Keep all facilities to display inactive ones

      // Auto-select primary facility if operational
      const primaryFacility = operationalFacilities.find((f: Facility) => f.isPrimary);
      if (primaryFacility) {
        setFormData(prev => ({
          ...prev,
          facilityId: primaryFacility.id
        }));
      } else if (operationalFacilities.length === 1) {
        // Auto-select if only one operational facility
        setFormData(prev => ({
          ...prev,
          facilityId: operationalFacilities[0]?.id || ''
        }));
      } else if (operationalFacilities.length > 0) {
        // If there are operational facilities but no primary, select the first operational one
        setFormData(prev => ({
          ...prev,
          facilityId: operationalFacilities[0]?.id || ''
        }));
      }

      // Show warning if no operational facilities
      if (operationalFacilities.length === 0 && facilitiesData.length > 0) {
        toast({
          title: 'No Operational Facilities',
          description: 'No operational facilities are available for assessments. Please check facility statuses or contact your administrator.',
          variant: 'destructive',
        });
      } else if (facilitiesData.length === 0) {
        toast({
          title: 'No Facilities Found',
          description: 'No facilities have been set up yet. Please add facilities before creating an assessment.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error loading facilities:', error);
      const errorMessage = error?.message || 'Failed to load facilities';

      if (error?.code === 'INSUFFICIENT_FACILITY_PERMISSIONS') {
        toast({
          title: 'Limited Facility Access',
          description: 'You only have access to specific facilities. Contact your administrator for broader access.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Loading Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setValidationErrors(prev => ({ ...prev, facilities: errorMessage }));
      }
      setFacilities([]);
    } finally {
      setLoadingFacilities(false);
    }
  };

  const loadClientOrganizations = async () => {
    setLoadingClientOrgs(true);
    setValidationErrors({});
    try {
      const response = await apiGet<ClientOrganization[]>('/client-organizations');
      const orgs = Array.isArray(response) ? response : [];
      setClientOrganizations(orgs);

      if (orgs.length === 0) {
        toast({
          title: 'No Client Organizations',
          description: 'You need to add at least one client organization before creating an assessment.',
          variant: 'destructive',
        });
        setValidationErrors(prev => ({ ...prev, clientOrg: 'No client organizations available.' }));
      } else if (orgs.length === 1) {
        // Auto-select if only one client organization
        setFormData(prev => ({
          ...prev,
          clientOrganizationId: orgs[0].id
        }));
        // Also load facilities for this organization
        loadClientFacilitiesForOrg(orgs[0].id);
      }
    } catch (error) {
      console.error('Error loading client organizations:', error);
      toast({
        title: 'Loading Error',
        description: 'Failed to load client organizations. Please refresh the page.',
        variant: 'destructive',
      });
      setClientOrganizations([]);
    } finally {
      setLoadingClientOrgs(false);
    }
  };

  const loadClientFacilitiesForOrg = async (orgId: string) => {
    if (!orgId) {
      setClientFacilities([]);
      return;
    }

    setLoadingClientFacilities(true);
    try {
      const response = await apiGet<ClientFacility[]>(`/client-organizations/${orgId}/facilities`);
      const facilities = Array.isArray(response) ? response : [];
      setClientFacilities(facilities);

      const operationalFacilities = facilities.filter(f => f.operatingStatus === 'ACTIVE');
      
      if (operationalFacilities.length === 0 && facilities.length > 0) {
        toast({
          title: 'No Operational Facilities',
          description: 'This client has no operational facilities available for assessments.',
          variant: 'destructive',
        });
      } else if (operationalFacilities.length === 1) {
        // Auto-select if only one operational facility
        setFormData(prev => ({
          ...prev,
          clientFacilityId: operationalFacilities[0].id
        }));
      }
    } catch (error) {
      console.error('Error loading client facilities:', error);
      toast({
        title: 'Loading Error',
        description: 'Failed to load client facilities.',
        variant: 'destructive',
      });
      setClientFacilities([]);
    } finally {
      setLoadingClientFacilities(false);
    }
  };


  const createMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('🚀 Creating assessment with data:', data);
      return api.createAssessment(data);
    },
    onSuccess: (response) => {
      console.log('✅ Assessment creation response:', response);

      // Handle different response formats - check both locations
      const assessment = response.assessment || response.data || response;
      const assessmentId = assessment?.id;

      if (!assessmentId) {
        console.error('❌ No assessment ID in response:', response);
        toast({
          title: 'Assessment Created',
          description: 'Assessment was created successfully. Redirecting to dashboard.',
        });
        navigate('/dashboard');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['intake-forms'] });

      toast({
        title: 'Assessment Created',
        description: 'Your assessment has been created successfully.',
      });

      console.log('🎯 Navigating to assessment:', assessmentId);
      // Use setTimeout to ensure navigation happens after state updates
      setTimeout(() => {
        navigate(`/assessments/${assessmentId}`);
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ Error creating assessment:', error);
      const errorData = error.response?.data;

      if (errorData?.code === 'FACILITY_NOT_OPERATIONAL') {
        toast({
          title: 'Facility Not Operational',
          description: 'The selected facility is not operational. Please select an active facility or contact your administrator.',
          variant: 'destructive',
        });
      } else if (errorData?.code === 'INSUFFICIENT_FACILITY_PERMISSIONS') {
        toast({
          title: 'Permission Error',
          description: 'You do not have permission to create assessments for this facility.',
          variant: 'destructive',
        });
      } else if (errorData?.code === 'INTAKE_FORM_NOT_FOUND') {
        toast({
          title: 'Intake Form Error',
          description: 'The selected intake form could not be found. Please refresh and try again.',
          variant: 'destructive',
        });
        // Refresh intake forms
        loadIntakeForms();
      } else {
        toast({
          title: 'Creation Error',
          description: errorData?.error || errorData?.message || 'Failed to create assessment',
          variant: 'destructive',
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build errors object synchronously
    const errors: { [key: string]: string } = {};

    if (!formData.title.trim()) {
      errors.title = 'Assessment name is required';
    }
    if (!formData.stdCode) {
      errors.stdCode = 'Assessment standard is required';
    }

    // Dual-path validation: Business vs Consultant
    if (isConsultant) {
      // Consultant path: Validate client organization and optionally client facility
      if (!formData.clientOrganizationId) {
        errors.clientOrg = 'Please select a client organization for this assessment.';
      }

      // Validate client facility if provided
      if (formData.clientFacilityId) {
        const selectedClientFacility = clientFacilities.find(f => f.id === formData.clientFacilityId);
        if (selectedClientFacility && selectedClientFacility.operatingStatus !== 'ACTIVE') {
          errors.clientFacility = `This facility is currently ${selectedClientFacility.operatingStatus}. Only operational facilities can have new assessments.`;
        }
      }
    } else {
      // Business path: Enhanced facility validation
      if (!formData.facilityId) {
        errors.facilities = 'Please select a facility for this assessment. All assessments must be associated with a specific facility.';
      }

      // Comprehensive facility validation
      const selectedFacility = facilities.find(f => f.id === formData.facilityId);

      if (!selectedFacility && formData.facilityId) {
        errors.facilities = 'The selected facility could not be found. Please refresh and try again.';
        setValidationErrors(errors);
        loadFacilities(); // Refresh facility list
        return;
      }

      if (selectedFacility && !selectedFacility.isActive) {
        errors.facilities = 'The selected facility is no longer active. Please select an active facility.';
        setValidationErrors(errors);
        return;
      }

      if (selectedFacility && selectedFacility.operatingStatus !== 'ACTIVE') {
        errors.facilities = `This facility is currently ${selectedFacility.operatingStatus}. Only operational facilities can have new assessments.`;
        setValidationErrors(errors);
        return;
      }
    }

    if (!formData.intakeFormId) {
      errors.intakeFormId = 'Please select a completed intake form';
    }

    // If any validation errors exist, set them and do not proceed
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Clear errors and submit with appropriate fields based on user type
    setValidationErrors({});
    const submissionData: any = {
      title: formData.title,
      description: formData.description,
      stdCode: formData.stdCode,
      intakeFormId: formData.intakeFormId,
    };

    // Add the appropriate fields based on user type
    if (isConsultant) {
      submissionData.clientOrganizationId = formData.clientOrganizationId;
      if (formData.clientFacilityId) {
        submissionData.clientFacilityId = formData.clientFacilityId;
      }
    } else {
      submissionData.facilityId = formData.facilityId;
    }

    createMutation.mutate(submissionData);
  };

  if (loadingIntake) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show guidance if no completed intake forms
  if (intakeForms.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center space-x-4 mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Create New Assessment</h1>
              <p className="text-muted-foreground">Set up a new R2v3 compliance assessment</p>
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-amber-800 mb-1">Intake Form Required</h4>
                  <p className="text-sm text-amber-700">
                    You must complete an intake form before creating an assessment. The intake form determines which questions are relevant to your organization and ensures a targeted, efficient assessment process.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => navigate('/intake-form')}
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Start Intake Form
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="self-start sm:self-auto min-h-[44px]">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="text-sm sm:text-base">Back to Dashboard</span>
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-glow-blue">New Assessment</h1>
      </div>

      {/* Smart Assessment Notice */}
      <Alert className="mb-6 border-jade/20 bg-jade/5">
        <CheckCircle className="h-4 w-4 text-jade" />
        <AlertDescription>
          <div>
            <h4 className="font-semibold text-jade mb-1">Smart Assessment Ready</h4>
            <p className="text-sm text-muted-foreground">
              Your assessment will be intelligently filtered based on your completed intake form, showing only relevant questions for your organization.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {validationErrors.facilities && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {validationErrors.facilities}
                {validationErrors.facilities.includes('No operational facilities') && (
                  <div className="mt-2">
                    <p className="text-sm">Please ensure at least one facility has:</p>
                    <ul className="text-sm list-disc ml-4 mt-1">
                      <li>Active status</li>
                      <li>Operating status set to 'ACTIVE'</li>
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

      <Card className="floating-card w-full max-w-2xl mx-auto">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-glow-blue text-xl sm:text-2xl">Create Assessment</CardTitle>
          <p className="text-muted-foreground text-sm sm:text-base">
            Start a new R2v3 compliance assessment for your facility.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Conditional Rendering: Business vs Consultant */}
            {isConsultant ? (
              <>
                {/* Consultant Path: Client Organization Selection */}
                <div className="space-y-2">
                  <Label htmlFor="clientOrg">Client Organization *</Label>
                  {clientOrganizations.length === 0 ? (
                    <div className="text-center py-8 border border-dashed rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">No Client Organizations</h3>
                      <p className="text-muted-foreground text-sm">
                        You need to add at least one client organization before creating an assessment.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={formData.clientOrganizationId}
                      onValueChange={(value) => {
                        setFormData(prev => ({
                          ...prev,
                          clientOrganizationId: value,
                          clientFacilityId: '' // Reset facility when org changes
                        }));
                        setValidationErrors(prev => ({ ...prev, clientOrg: '' }));
                        loadClientFacilitiesForOrg(value);
                      }}
                      disabled={loadingClientOrgs}
                    >
                      <SelectTrigger data-testid="select-client-organization">
                        <SelectValue placeholder={loadingClientOrgs ? "Loading..." : "Select client organization"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clientOrganizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.legalName} - {org.hqCity}, {org.hqState}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {validationErrors.clientOrg && (
                    <Alert variant="destructive" className="p-2">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <AlertDescription className="text-xs">{validationErrors.clientOrg}</AlertDescription>
                    </Alert>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Select the client organization for this assessment.
                  </p>
                </div>

                {/* Consultant Path: Client Facility Selection (optional) */}
                {formData.clientOrganizationId && (
                  <div className="space-y-2">
                    <Label htmlFor="clientFacility">Client Facility (Optional)</Label>
                    {loadingClientFacilities ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">Loading facilities...</p>
                      </div>
                    ) : clientFacilities.length === 0 ? (
                      <div className="text-center py-4 border border-dashed rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          No facilities available for this organization.
                        </p>
                      </div>
                    ) : (
                      <Select
                        value={formData.clientFacilityId}
                        onValueChange={(value) => {
                          setFormData(prev => ({ ...prev, clientFacilityId: value }));
                          setValidationErrors(prev => ({ ...prev, clientFacility: '' }));
                        }}
                        disabled={loadingClientFacilities}
                      >
                        <SelectTrigger data-testid="select-client-facility">
                          <SelectValue placeholder="Select client facility (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientFacilities
                            .filter(f => f.operatingStatus === 'ACTIVE')
                            .map((facility) => (
                              <SelectItem key={facility.id} value={facility.id}>
                                {facility.name} - {facility.city}, {facility.state}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                    {validationErrors.clientFacility && (
                      <Alert variant="destructive" className="p-2">
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        <AlertDescription className="text-xs">{validationErrors.clientFacility}</AlertDescription>
                      </Alert>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Optionally select a specific facility for this assessment. If not selected, the assessment will apply to the entire organization.
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* Business Path: Facility Selection */
              <div className="space-y-2">
                <Label htmlFor="facility">Target Facility *</Label>
              {facilities.length === 0 ? (
                <div className="text-center py-8">
                  <Factory className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Facilities Available</h3>
                  <p className="text-muted-foreground">
                    You need to set up at least one facility before creating an assessment.
                  </p>
                </div>
              ) : (
                <>
                  {/* Enhanced facility validation - show operational facilities */}
                  {facilities.filter(f => f.operatingStatus === 'ACTIVE').length === 0 ? (
                    <div className="text-center py-8 border border-destructive/20 rounded-lg bg-destructive/5">
                      <Factory className="h-12 w-12 mx-auto mb-4 text-destructive" />
                      <h3 className="text-lg font-semibold mb-2 text-destructive">No Operational Facilities Available</h3>
                      <p className="text-muted-foreground">
                        All facilities are currently inactive or under maintenance. Please activate at least one facility to create assessments.
                      </p>
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground">Available facilities:</p>
                        {facilities.map((facility) => (
                          <div key={facility.id} className="text-sm mt-2 flex items-center justify-center gap-2">
                            <span>{facility.name}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              facility.operatingStatus === 'ACTIVE'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {facility.operatingStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Select
                      value={formData.facilityId}
                      onValueChange={(value) => {
                        const selectedFacility = facilities.find(f => f.id === value);
                        setFormData(prev => ({
                          ...prev,
                          facilityId: value,
                          title: selectedFacility ? `${selectedFacility.name} - R2v3 Assessment` : prev.title
                        }));
                        setValidationErrors(prev => ({ ...prev, facilities: '' })); // Clear facility error on selection
                      }}
                      disabled={loadingFacilities}
                    >
                      <SelectTrigger data-testid="select-facility">
                        <SelectValue placeholder={loadingFacilities ? "Loading facilities..." : "Select an operational facility"} />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities
                          .filter(facility => facility.operatingStatus === 'ACTIVE')
                          .map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span>{facility.name} - {facility.city}, {facility.state}</span>
                                {facility.isPrimary && (
                                  <span className="text-xs bg-blue-500/20 text-blue-400 px-1 rounded">Primary</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Show inactive facilities as disabled options */}
                  {facilities.filter(f => f.operatingStatus !== 'ACTIVE').length > 0 && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>Inactive facilities:</p>
                      <div className="mt-1 space-y-1">
                        {facilities
                          .filter(facility => facility.operatingStatus !== 'ACTIVE')
                          .map((facility) => (
                            <div key={facility.id} className="flex items-center gap-2 text-xs opacity-60">
                              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                              <span>{facility.name}</span>
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                                {facility.operatingStatus}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Select the facility this assessment will evaluate for R2v3 compliance. Only active and operational facilities can be selected.
              </p>
            </div>
            )}

            {/* Intake Form Selection */}
            <div className="space-y-2">
              <Label htmlFor="intakeForm">Based on Intake Form *</Label>
              <Select
                value={formData.intakeFormId}
                onValueChange={(value) => {
                  const selectedForm = intakeForms.find(f => f.id === value);
                  setFormData(prev => ({
                    ...prev,
                    intakeFormId: value,
                    title: selectedForm ? `${selectedForm.legalCompanyName || 'Company'} R2v3 Assessment` : prev.title
                  }));
                  setValidationErrors(prev => ({ ...prev, intakeFormId: '' })); // Clear error on selection
                }}
                disabled={standardsLoading}
              >
                <SelectTrigger data-testid="select-intake-form">
                  <SelectValue placeholder="Select completed intake form" />
                </SelectTrigger>
                <SelectContent>
                  {intakeForms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.legalCompanyName || form.title} - {new Date(form.createdAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Assessment questions will be filtered based on the selected intake form responses.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Assessment Name *</Label>
              <Input
                id="title"
                data-testid="input-assessment-name"
                value={formData.title}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, title: e.target.value }));
                  setValidationErrors(prev => ({ ...prev, title: '' })); // Clear error on input
                }}
                placeholder="Enter assessment name"
                required
              />
              {validationErrors.title && <Alert variant="destructive" className="p-2"><AlertCircle className="h-3 w-3 text-destructive" /><AlertDescription className="text-xs">{validationErrors.title}</AlertDescription></Alert>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                data-testid="input-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the purpose and scope of this assessment"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="standard">Assessment Type *</Label>
              <Select
                value={formData.stdCode}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, stdCode: value }));
                  setValidationErrors(prev => ({ ...prev, stdCode: '' })); // Clear error on selection
                }}
                disabled={standardsLoading}
              >
                <SelectTrigger data-testid="select-assessment-type">
                  <SelectValue placeholder={standardsLoading ? "Loading standards..." : "Select assessment type"} />
                </SelectTrigger>
                <SelectContent>
                  {standards.map((standard: any) => (
                    <SelectItem key={standard.code} value={standard.code}>
                      {standard.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.stdCode && <Alert variant="destructive" className="p-2"><AlertCircle className="h-3 w-3 text-destructive" /><AlertDescription className="text-xs">{validationErrors.stdCode}</AlertDescription></Alert>}
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                data-testid="button-create-assessment"
                disabled={createMutation.isPending || standardsLoading || !formData.intakeFormId || Object.keys(validationErrors).some(key => validationErrors[key])}
                className="flex-1"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Assessment'}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="button-cancel"
                onClick={() => navigate('/dashboard')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default NewAssessment;