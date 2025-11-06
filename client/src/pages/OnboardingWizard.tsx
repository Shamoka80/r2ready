import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Building,
  MapPin,
  Settings,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  Loader2
} from "lucide-react";

// Step 1: Organization Setup Schema (Minimal for access control)
const organizationSetupSchema = z.object({
  legalName: z.string().min(1, "Company name is required"),
  primaryContactName: z.string().min(1, "Primary contact name is required"),
  primaryContactEmail: z.string().email("Valid email is required"),
  hqAddress: z.string().min(1, "Address is required"),
  hqCity: z.string().min(1, "City is required"),
  hqState: z.string().min(1, "State is required"),
  hqZipCode: z.string().min(1, "ZIP code is required"),
  hqCountry: z.string().default("US")
});

// Step 3a: Facility Location Schema (For business users - their own facility)
const facilityLocationSchema = z.object({
  name: z.string().min(1, "Facility name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  country: z.string().default("US"),
  operatingStatus: z.string().default("ACTIVE"),
  isPrimary: z.boolean().default(true),
  facilitiesPlanned: z.number().min(1).max(50).default(1),
  multiSiteOperations: z.boolean().default(false)
});

// Step 3b: Client Organization Schema (For consultants - their client's company)
const clientOrganizationSchema = z.object({
  legalName: z.string().min(1, "Client company name is required"),
  primaryContactName: z.string().min(1, "Client contact name is required"),
  primaryContactEmail: z.string().email("Valid client contact email is required"),
  hqAddress: z.string().min(1, "Client address is required"),
  hqCity: z.string().min(1, "Client city is required"),
  hqState: z.string().min(1, "Client state is required"),
  hqZipCode: z.string().min(1, "Client ZIP code is required"),
  hqCountry: z.string().default("US")
});

// Step 4: Client Facility Schema (For consultants - their client's facility)
const clientFacilitySchema = z.object({
  name: z.string().min(1, "Client facility name is required"),
  address: z.string().min(1, "Client facility address is required"),
  city: z.string().min(1, "Client facility city is required"),
  state: z.string().min(1, "Client facility state is required"),
  zipCode: z.string().min(1, "Client facility ZIP code is required"),
  country: z.string().default("US"),
  operatingStatus: z.string().default("ACTIVE"),
  isPrimary: z.boolean().default(true),
  facilitiesPlanned: z.number().min(1).max(50).default(1),
  multiSiteOperations: z.boolean().default(false)
});

type OrganizationSetupData = z.infer<typeof organizationSetupSchema>;
type FacilityLocationData = z.infer<typeof facilityLocationSchema>;
type ClientOrganizationData = z.infer<typeof clientOrganizationSchema>;
type ClientFacilityData = z.infer<typeof clientFacilitySchema>;

export default function OnboardingWizard() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingMockPayment, setProcessingMockPayment] = useState(false);
  const hasProcessedMockPayment = useRef(false);
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  // Derive account type from tenant type (already determined during purchase phase)
  const accountType = user?.tenant?.type === 'CONSULTANT' ? 'consultant' : 'business';

  const orgForm = useForm<OrganizationSetupData>({
    resolver: zodResolver(organizationSetupSchema),
    defaultValues: {
      hqCountry: "US"
    }
  });

  const facilityForm = useForm<FacilityLocationData>({
    resolver: zodResolver(facilityLocationSchema),
    defaultValues: {
      country: "US",
      operatingStatus: "ACTIVE"
    }
  });

  const clientOrgForm = useForm<ClientOrganizationData>({
    resolver: zodResolver(clientOrganizationSchema),
    defaultValues: {
      hqCountry: "US"
    }
  });

  const clientFacilityForm = useForm<ClientFacilityData>({
    resolver: zodResolver(clientFacilitySchema),
    defaultValues: {
      country: "US",
      operatingStatus: "ACTIVE"
    }
  });

  const [orgData, setOrgData] = useState<Partial<OrganizationSetupData>>({});
  const [facilityData, setFacilityData] = useState<Partial<FacilityLocationData>>({});
  const [clientOrgData, setClientOrgData] = useState<Partial<ClientOrganizationData>>({});
  const [clientFacilityData, setClientFacilityData] = useState<Partial<ClientFacilityData>>({});

  // Multi-facility support
  const [facilities, setFacilities] = useState([{
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    isPrimary: true
  }]);

  const addFacility = () => {
    setFacilities([...facilities, {
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      isPrimary: false
    }]);
  };

  const removeFacility = (index: number) => {
    if (facilities.length > 1) {
      setFacilities(facilities.filter((_, i) => i !== index));
    }
  };

  // Dynamic steps based on account type (from tenant type, not user selection)
  const getSteps = () => {
    const baseSteps = [
      {
        title: "Organization Setup",
        description: "Basic company and contact information", 
        icon: <Building className="h-8 w-8" />
      }
    ];

    if (accountType === 'consultant') {
      return [
        ...baseSteps,
        {
          title: "Client Organization",
          description: "Create your first client organization",
          icon: <Building className="h-8 w-8" />
        },
        {
          title: "Client Facility",
          description: "Set up client facility details",
          icon: <MapPin className="h-8 w-8" />
        }
      ];
    } else {
      return [
        ...baseSteps,
        {
          title: "Facility Location",
          description: "Primary facility location details",
          icon: <MapPin className="h-8 w-8" />
        }
      ];
    }
  };

  const steps = getSteps();

  // Basic auth check only
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.log('OnboardingWizard: No auth token, redirecting to login');
      setLocation('/login');
      return;
    }
  }, [setLocation]);

  // Handle mock payment completion
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const isMock = urlParams.get('mock') === 'true';

    // One-shot guard: only process once per component lifecycle
    if (sessionId && isMock && !processingMockPayment && !hasProcessedMockPayment.current) {
      console.log('🧪 Mock payment detected, triggering webhook:', sessionId);
      hasProcessedMockPayment.current = true;
      setProcessingMockPayment(true);

      // Trigger mock webhook to create license
      fetch('/api/stripe/mock-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          mockSuccess: true
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Mock webhook failed');
          }
          return response.json();
        })
        .then((data) => {
          console.log('✅ Mock webhook processed successfully:', data);
          toast({
            title: "Payment Processed",
            description: "Mock payment completed successfully. You can now proceed with onboarding.",
          });
          
          // Refresh user data to get updated license status
          refreshUser();
          
          // Clear URL parameters
          window.history.replaceState({}, '', '/onboarding');
          
          setProcessingMockPayment(false);
        })
        .catch((error) => {
          console.error('❌ Mock webhook error:', error);
          toast({
            title: "Payment Processing Error",
            description: error.message || "Failed to process mock payment. Please try again.",
            variant: "destructive",
          });
          
          // Clear URL parameters to prevent infinite retry loop
          window.history.replaceState({}, '', '/onboarding');
          
          setProcessingMockPayment(false);
        });
    }
  }, [processingMockPayment, refreshUser, toast]);

  const handleNext = async () => {
    let isValid = false;

    // Validate current step
    if (currentStep === 1) {
      isValid = await orgForm.trigger();
      if (isValid) {
        setOrgData(orgForm.getValues());
      }
    } else if (currentStep === 2) {
      // Step 2 handling depends on account type
      if (accountType === 'consultant') {
        // For consultants: Step 2 is client organization setup
        isValid = await clientOrgForm.trigger();
        if (isValid) {
          setClientOrgData(clientOrgForm.getValues());
        }
      } else {
        // For businesses: Step 2 is facility location setup (complete flow)
        isValid = await facilityForm.trigger();
        if (isValid) {
          const currentFacilityData = facilityForm.getValues();
          setFacilityData(currentFacilityData);
          // Complete setup after step 2 for business users
          await handleComplete(currentFacilityData);
          return;
        }
      }
    } else if (currentStep === 3) {
      // Step 3 only exists for consultants: Client facility setup
      if (accountType === 'consultant') {
        isValid = await clientFacilityForm.trigger();
        if (isValid) {
          const currentClientFacilityData = clientFacilityForm.getValues();
          setClientFacilityData(currentClientFacilityData);
          // Complete setup after step 3 for consultant users
          await handleCompleteConsultant(currentClientFacilityData);
          return;
        }
      }
    }

    if (isValid && currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isTestAccount = (email: string): boolean => {
    const testPatterns = [
      /@example\.com$/i,
      /@test\.com$/i,
      /\+e2e@/i,
      /\+test@/i,
      /^test.*@/i,
      /^demo.*@/i
    ];
    return testPatterns.some(pattern => pattern.test(email));
  };

  // Helper function to check license with retry logic
  const checkLicenseWithRetry = async (maxRetries = 3, delayMs = 1000): Promise<boolean> => {
    console.log('🔵 FRONTEND: Starting license check with retry logic', { maxRetries, delayMs });
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔵 FRONTEND: License check attempt ${attempt}/${maxRetries}`);
        
        const licenseResponse = await fetch('/api/licenses/status', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (licenseResponse.ok) {
          const licenseData = await licenseResponse.json();
          
          // Validate payload structure
          if (typeof licenseData === 'object' && 
              licenseData !== null && 
              'hasLicense' in licenseData && 
              'status' in licenseData) {
            
            const hasLicense = licenseData.hasLicense === true && licenseData.status === 'active';
            console.log(`🟢 FRONTEND: License check attempt ${attempt} result:`, { 
              hasLicense: licenseData.hasLicense, 
              status: licenseData.status,
              willRetry: !hasLicense && attempt < maxRetries
            });
            
            // If we found a license, return true immediately
            if (hasLicense) {
              console.log('✅ FRONTEND: Active license found!');
              return true;
            }
            
            // If no license and we have retries left, wait and try again
            if (attempt < maxRetries) {
              console.log(`⏳ FRONTEND: No license found, waiting ${delayMs}ms before retry ${attempt + 1}...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue;
            }
            
            // No license and no retries left
            console.log('❌ FRONTEND: No license found after all retries');
            return false;
            
          } else {
            console.error('❌ FRONTEND: Invalid license payload:', licenseData);
            throw new Error('Invalid license status response');
          }
        } else {
          console.error(`❌ FRONTEND: License check failed with status ${licenseResponse.status}`);
          throw new Error(`License verification failed: ${licenseResponse.status}`);
        }
      } catch (error) {
        console.error(`❌ FRONTEND: License check attempt ${attempt} failed:`, error);
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Otherwise, wait and retry
        console.log(`⏳ FRONTEND: Waiting ${delayMs}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return false;
  };

  const handleComplete = async (currentFacilityData?: Partial<FacilityLocationData>) => {
    setIsLoading(true);
    try {
      // Save organization setup
      const orgResponse = await fetch('/api/onboarding/organization-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(orgData)
      });
      if (!orgResponse.ok) throw new Error('Failed to save organization data');

      // Save facility location - use passed data or fallback to state
      const facilityDataToSave = currentFacilityData || facilityData;
      const facilityResponse = await fetch('/api/onboarding/facility-baseline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(facilityDataToSave)
      });
      if (!facilityResponse.ok) throw new Error('Failed to save facility data');

      // Check if this is a test account
      if (user && isTestAccount(user.email)) {
        console.log('🧪 Test account detected, auto-provisioning license');

        // Auto-provision test license
        const licenseResponse = await fetch('/api/auth/auto-provision-test-license', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!licenseResponse.ok) {
          throw new Error('Failed to auto-provision test license');
        }

        toast({
          title: "Test Account Activated!",
          description: "Your test account has been set up with full access. Please complete the intake form to continue."
        });

        // Refresh user status to pick up the license and updated setup status
        await refreshUser();

        // Redirect to intake form for mandatory completion
        setLocation('/intake-form');
      } else {
        // Check if user has an active license (from payment) with retry logic
        let hasActiveLicense = false;
        try {
          hasActiveLicense = await checkLicenseWithRetry(3, 1000);
        } catch (licenseError) {
          console.error('❌ FRONTEND: License check failed after retries:', licenseError);
          toast({
            title: "License Verification Error",
            description: "Unable to verify your license status. Please try again or contact support.",
            variant: "destructive"
          });
          throw licenseError;
        }

        if (hasActiveLicense) {
          // User has paid - activate assessment and go to intake form
          await fetch('/api/auth/update-setup-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ setupStatus: 'assessment_active' })
          });
          
          toast({ 
            title: "Setup Complete!", 
            description: "Please complete the intake form to finalize your setup." 
          });
          await refreshUser();
          setLocation('/intake-form');
        } else {
          // No license - complete setup and send to pricing
          await fetch('/api/auth/update-setup-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ setupStatus: 'setup_complete' })
          });
          
          toast({ 
            title: "Setup Complete!", 
            description: "Please complete your payment to activate your account." 
          });
          await refreshUser();
          setLocation('/pricing');
        }
      }
    } catch (error) {
      console.error('Setup completion failed:', error);
      toast({
        title: "Setup Failed",
        description: "There was an error completing your setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteConsultant = async (currentClientFacilityData?: Partial<ClientFacilityData>) => {
    setIsLoading(true);
    try {
      // Save consultant's organization setup (their business)
      const orgResponse = await fetch('/api/onboarding/organization-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(orgData)
      });
      if (!orgResponse.ok) throw new Error('Failed to save organization data');

      // Save client organization
      const clientOrgResponse = await fetch('/api/onboarding/client-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(clientOrgData)
      });
      if (!clientOrgResponse.ok) throw new Error('Failed to save client organization data');

      // Get the created client organization ID
      const createdClientOrg = await clientOrgResponse.json();
      const createdClientOrgId = createdClientOrg.id;

      // Save client facility with the client organization ID
      const clientFacilityDataToSave = {
        ...(currentClientFacilityData || clientFacilityData),
        clientOrganizationId: createdClientOrgId
      };
      const clientFacilityResponse = await fetch('/api/onboarding/client-facility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(clientFacilityDataToSave)
      });
      if (!clientFacilityResponse.ok) throw new Error('Failed to save client facility data');

      // Check if this is a test account
      if (user && isTestAccount(user.email)) {
        console.log('🧪 Test consultant account detected, auto-provisioning license');

        // Auto-provision test license
        const licenseResponse = await fetch('/api/auth/auto-provision-test-license', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!licenseResponse.ok) {
          throw new Error('Failed to auto-provision test license');
        }

        toast({
          title: "Test Account Activated!",
          description: "Your test consultant account has been set up with full access. You can now proceed with client management."
        });

        // Refresh user status to pick up the license and updated setup status
        await refreshUser();

        // Redirect directly to dashboard for test accounts
        setLocation('/dashboard');
      } else {
        // Check if user has an active license (from payment) with retry logic
        let hasActiveLicense = false;
        try {
          hasActiveLicense = await checkLicenseWithRetry(3, 1000);
        } catch (licenseError) {
          console.error('❌ FRONTEND: License check failed after retries:', licenseError);
          toast({
            title: "License Verification Error",
            description: "Unable to verify your license status. Please try again or contact support.",
            variant: "destructive"
          });
          throw licenseError;
        }

        if (hasActiveLicense) {
          // User has paid - activate assessment and go to intake form
          await fetch('/api/auth/update-setup-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ setupStatus: 'assessment_active' })
          });
          
          toast({ 
            title: "Setup Complete!", 
            description: "Please complete the intake form to finalize your setup." 
          });
          await refreshUser();
          setLocation('/intake-form');
        } else {
          // No license - complete setup and send to pricing
          await fetch('/api/auth/update-setup-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ setupStatus: 'setup_complete' })
          });
          
          toast({ 
            title: "Setup Complete!", 
            description: "Please complete your payment to activate your account." 
          });
          await refreshUser();
          setLocation('/pricing');
        }
      }
    } catch (error) {
      console.error('Consultant setup completion failed:', error);
      toast({
        title: "Setup Failed",
        description: "There was an error completing your setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const autosave = async (data: any, endpoint: string) => {
    try {
      await fetch(`/api/onboarding/${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      // Silent fail for autosave
      console.warn('Autosave failed:', error);
    }
  };


  // Show loading state while processing mock payment
  if (processingMockPayment) {
    return (
      <div className="min-h-screen relative">
        {/* Header */}
        <header className="nav-glass border-b border-glass-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 btn-primary-glass rounded-lg flex items-center justify-center">
                  <Building className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-foreground">RuR2 Setup</span>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card className="max-w-2xl mx-auto">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                  <h2 className="text-2xl font-bold text-foreground">Processing Mock Payment</h2>
                  <p className="text-muted-foreground">
                    Creating your license and setting up your account...
                  </p>
                  <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
                    🧪 Test Mode: This is a mock payment for development/testing purposes
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 btn-primary-glass rounded-lg flex items-center justify-center">
                <Building className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">RuR2 Setup</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Organization Setup</span>
              <span>Step {currentStep} of {steps.length}</span>
            </div>
            <Progress value={(currentStep / steps.length) * 100} className="h-2" />
          </div>

          {/* Current Step Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="text-primary">
                {steps[currentStep - 1]?.icon}
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {steps[currentStep - 1]?.title}
            </h1>
            <p className="text-lg text-muted-foreground">
              {steps[currentStep - 1]?.description}
            </p>
          </div>

          {/* Step 1: Organization Profile */}
          {currentStep === 1 && (
            <Card className="max-w-3xl mx-auto">
              <CardHeader>
                <CardTitle>Organization Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Form {...orgForm}>
                  <form className="space-y-6">
                    <FormField
                      control={orgForm.control}
                      name="legalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter your company name" 
                              data-testid="input-legal-name"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Headquarters Address</h3>
                      <FormField
                        control={orgForm.control}
                        name="hqAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="123 Business St" 
                                data-testid="input-hq-address"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={orgForm.control}
                          name="hqCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="City" 
                                  data-testid="input-hq-city"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={orgForm.control}
                          name="hqState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="State" 
                                  data-testid="input-hq-state"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={orgForm.control}
                          name="hqZipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP Code *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="12345" 
                                  data-testid="input-hq-zip"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Primary Contact</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={orgForm.control}
                          name="primaryContactName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Name *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="John Smith" 
                                  data-testid="input-primary-contact-name"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={orgForm.control}
                          name="primaryContactEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Email *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email"
                                  placeholder="john@company.com" 
                                  data-testid="input-primary-contact-email"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Branch based on account type */}
          {currentStep === 2 && accountType === 'business' && (
            <Card className="max-w-3xl mx-auto">
              <CardHeader>
                <CardTitle>Primary Facility Information</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set up your primary facility. Additional facilities can be added after onboarding.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Form {...facilityForm}>
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={facilityForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Facility Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Primary Facility" 
                                data-testid="input-facility-name"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={facilityForm.control}
                        name="operatingStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Operating Status *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-operating-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                                <SelectItem value="SEASONAL">Seasonal</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Multi-Facility Planning */}
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-semibold">Multi-Facility Planning</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={facilityForm.control}
                          name="facilitiesPlanned"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Facilities Planned</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="1"
                                  max="50"
                                  placeholder="1" 
                                  data-testid="input-facilities-planned"
                                  {...field} 
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 1;
                                    field.onChange(value);
                                    facilityForm.setValue('multiSiteOperations', value > 1);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-muted-foreground">
                                Include all locations you plan to certify (1-50)
                              </p>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={facilityForm.control}
                          name="multiSiteOperations"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-multi-site"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  Multi-site operations
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">
                                  Check if you operate multiple facilities
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Facility Address</h3>
                      <FormField
                        control={facilityForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="123 Facility Dr" 
                                data-testid="input-facility-address"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={facilityForm.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="City" 
                                  data-testid="input-facility-city"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={facilityForm.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="State" 
                                  data-testid="input-facility-state"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={facilityForm.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP Code *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="12345" 
                                  data-testid="input-facility-zip"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={facilityForm.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="United States" 
                                  data-testid="input-facility-country"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Client Organization Setup (for consultants) */}
          {currentStep === 2 && accountType === 'consultant' && (
            <Card className="max-w-3xl mx-auto">
              <CardHeader>
                <CardTitle>Client Organization Information</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter your first client's company details. You can add more clients later.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Form {...clientOrgForm}>
                  <form className="space-y-6">
                    <FormField
                      control={clientOrgForm.control}
                      name="legalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Company Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter client company name" 
                              data-testid="input-client-legal-name"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Client Headquarters Address</h3>
                      <FormField
                        control={clientOrgForm.control}
                        name="hqAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="123 Client Business St" 
                                data-testid="input-client-hq-address"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={clientOrgForm.control}
                          name="hqCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="City" 
                                  data-testid="input-client-hq-city"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={clientOrgForm.control}
                          name="hqState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="State" 
                                  data-testid="input-client-hq-state"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={clientOrgForm.control}
                          name="hqZipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP Code *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="12345" 
                                  data-testid="input-client-hq-zip"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Client Primary Contact</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={clientOrgForm.control}
                          name="primaryContactName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Name *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="John Smith" 
                                  data-testid="input-client-primary-contact-name"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={clientOrgForm.control}
                          name="primaryContactEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Email *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email"
                                  placeholder="john@clientcompany.com" 
                                  data-testid="input-client-primary-contact-email"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Client Facility Setup (for consultants) */}
          {currentStep === 3 && accountType === 'consultant' && (
            <Card className="max-w-3xl mx-auto">
              <CardHeader>
                <CardTitle>Client Facility Information</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set up your client's primary facility. Additional facilities can be added later.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Form {...clientFacilityForm}>
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={clientFacilityForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client Facility Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Client Primary Facility" 
                                data-testid="input-client-facility-name"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={clientFacilityForm.control}
                        name="operatingStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Operating Status *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-client-operating-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                                <SelectItem value="SEASONAL">Seasonal</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Multi-Facility Planning */}
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-semibold">Client Multi-Facility Planning</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={clientFacilityForm.control}
                          name="facilitiesPlanned"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Client Facilities Planned</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="1"
                                  max="50"
                                  placeholder="1" 
                                  data-testid="input-client-facilities-planned"
                                  {...field} 
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 1;
                                    field.onChange(value);
                                    clientFacilityForm.setValue('multiSiteOperations', value > 1);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-muted-foreground">
                                Include all client locations they plan to certify (1-50)
                              </p>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={clientFacilityForm.control}
                          name="multiSiteOperations"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-client-multi-site"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  Client multi-site operations
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">
                                  Check if client operates multiple facilities
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Client Facility Address</h3>
                      <FormField
                        control={clientFacilityForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="123 Client Facility St" 
                                data-testid="input-client-facility-address"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                          control={clientFacilityForm.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="City" 
                                  data-testid="input-client-facility-city"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={clientFacilityForm.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="State" 
                                  data-testid="input-client-facility-state"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={clientFacilityForm.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP Code *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="12345" 
                                  data-testid="input-client-facility-zip"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={clientFacilityForm.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="United States" 
                                  data-testid="input-client-facility-country"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center space-x-2">
              {isSaving && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </div>
              )}

              <Button
                onClick={handleNext}
                disabled={isLoading || isSaving}
                className="btn-primary-glass"
                data-testid="button-next"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {currentStep === steps.length ? "Complete Setup" : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}