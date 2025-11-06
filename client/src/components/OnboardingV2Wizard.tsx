import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlagWithLoading } from "@/lib/flags";
import { apiRequest } from "@/lib/queryClient";
import {
  Building2,
  MapPin,
  Users,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  Target,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';


// Enhanced schemas for Onboarding V2
const roleSelectionSchema = z.object({
  accountType: z.enum(["business", "consultant"]),
  companySize: z.enum(["startup", "small", "medium", "large", "enterprise"]).optional(),
  industry: z.string().optional(),
  primaryGoal: z.enum(["compliance", "certification", "audit_prep", "risk_mgmt", "other"]).optional()
});

const quickOrgSchema = z.object({
  legalName: z.string().min(1, "Company name is required"),
  primaryContactName: z.string().min(1, "Contact name is required"),
  primaryContactEmail: z.string().email("Valid email is required"),
  location: z.object({
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().default("US")
  })
});

const facilityQuickSetupSchema = z.object({
  name: z.string().min(1, "Facility name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  operationType: z.enum(["manufacturing", "warehouse", "office", "mixed", "other"]),
  employeeCount: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]),
  hasMultipleSites: z.boolean().default(false),
  futureExpansion: z.boolean().default(false)
});

const consultantClientSchema = z.object({
  clientCompanyName: z.string().min(1, "Client company name is required"),
  clientIndustry: z.string().min(1, "Client industry is required"),
  serviceType: z.enum(["r2_certification", "compliance_audit", "gap_analysis", "ongoing_consulting", "other"]),
  projectTimeline: z.enum(["immediate", "1-3_months", "3-6_months", "6-12_months", "ongoing"]),
  clientSize: z.enum(["startup", "small", "medium", "large", "enterprise"]),
  specialRequirements: z.string().optional()
});

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  icon: any;
  required: boolean;
  roleSpecific?: "business" | "consultant";
};

const ONBOARDING_STEPS: OnboardingStep[] = [

  {
    id: "organization",
    title: "Quick Setup",
    description: "Essential company information",
    icon: Building2,
    required: true
  },
  {
    id: "facility",
    title: "Primary Facility",
    description: "Your main operating location",
    icon: MapPin,
    required: true,
    roleSpecific: "business"
  },
  {
    id: "client",
    title: "Client Information", 
    description: "Details about your client engagement",
    icon: Users,
    required: true,
    roleSpecific: "consultant"
  },
  {
    id: "confirmation",
    title: "Ready to Start",
    description: "Review and complete your setup",
    icon: CheckCircle,
    required: true
  }
];

interface OnboardingAnalytics {
  stepStartTime: number;
  totalTime: number;
  stepTimes: Record<string, number>;
  completionRate: number;
  abandonedAtStep?: string;
}

export default function OnboardingV2Wizard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { enabled: isV2Enabled, loading: flagsLoading } = useFeatureFlagWithLoading('onboarding_v2');

  const [currentStep, setCurrentStep] = useState(0);
  const [accountType, setAccountType] = useState<"business" | "consultant" | null>(
    user?.tenant?.type ? (user.tenant.type.toLowerCase() as "business" | "consultant") : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analytics, setAnalytics] = useState<OnboardingAnalytics>({
    stepStartTime: Date.now(),
    totalTime: 0,
    stepTimes: {},
    completionRate: 0
  });

  // Determine account type from license (industry standard approach)
  const determinedAccountType = useMemo(() => {
    // Check tenant type first (from license), then default to business
    if (user?.tenant?.type) {
      return user.tenant.type.toLowerCase() as "business" | "consultant";
    }
    // Default to business if no account type is set
    return 'business';
  }, [user]);

  // Sync accountType state when determinedAccountType changes (handles async user load)
  useEffect(() => {
    setAccountType(determinedAccountType);
  }, [determinedAccountType]);

  // Enhanced step management with analytics
  const trackStepProgress = (stepId: string, action: 'start' | 'complete' | 'abandon') => {
    const now = Date.now();
    const stepTime = now - analytics.stepStartTime;

    setAnalytics(prev => ({
      ...prev,
      stepTimes: { ...prev.stepTimes, [stepId]: stepTime },
      stepStartTime: now,
      ...(action === 'abandon' && { abandonedAtStep: stepId })
    }));

    // Send analytics to backend with authentication
    apiRequest('POST', '/api/analytics/onboarding', {
      userId: user?.id,
      stepId,
      action,
      timeSpent: stepTime,
      accountType: determinedAccountType, // Use the determined account type
      timestamp: now
    }).catch(console.error);
  };

  const getVisibleSteps = () => {
    return ONBOARDING_STEPS.filter(step => 
      !step.roleSpecific || step.roleSpecific === determinedAccountType // Use the determined account type
    );
  };

  const currentStepData = getVisibleSteps()[currentStep];

  // Form configurations for each step
  const roleForm = useForm({
    resolver: zodResolver(roleSelectionSchema),
    defaultValues: { accountType: "business" as const }
  });

  const orgForm = useForm({
    resolver: zodResolver(quickOrgSchema),
    defaultValues: {
      legalName: "",
      primaryContactName: user?.firstName + " " + user?.lastName || "",
      primaryContactEmail: user?.email || "",
      location: { city: "", state: "", country: "US" }
    }
  });

  const facilityForm = useForm({
    resolver: zodResolver(facilityQuickSetupSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      operationType: "office" as const,
      employeeCount: "1-10" as const,
      hasMultipleSites: false,
      futureExpansion: false
    }
  });

  const consultantForm = useForm({
    resolver: zodResolver(consultantClientSchema),
    defaultValues: {
      clientCompanyName: "",
      clientIndustry: "",
      serviceType: "r2_certification" as const,
      projectTimeline: "3-6_months" as const,
      clientSize: "medium" as const,
      specialRequirements: ""
    }
  });

  // Show loading state while flags are loading
  if (flagsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900/40 via-background to-green-900/40 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-foreground">Loading your personalized experience...</p>
        </div>
      </div>
    );
  }

  // Redirect to old onboarding if flag is disabled (after flags are loaded)
  if (!isV2Enabled) {
    navigate('/onboarding');
    return null;
  }

  const progress = ((currentStep + 1) / getVisibleSteps().length) * 100;

  const goToNextStep = () => {
    if (currentStepData) {
      trackStepProgress(currentStepData.id, 'complete');
    }

    if (currentStep < getVisibleSteps().length - 1) {
      setCurrentStep(prev => prev + 1);
      const nextStep = getVisibleSteps()[currentStep + 1];
      if (nextStep) {
        trackStepProgress(nextStep.id, 'start');
      }
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Account type already determined by license purchase, no selection needed

  const handleOrganizationSetup = async (data: z.infer<typeof quickOrgSchema>) => {
    try {
      setIsSubmitting(true);

      await apiRequest('POST', '/api/onboarding/organization', {
        ...data,
        hqAddress: `${data.location.city}, ${data.location.state}`,
        hqCity: data.location.city,
        hqState: data.location.state,
        hqCountry: data.location.country,
        entityType: determinedAccountType === 'business' ? 'CORPORATION' : 'LLC', // Use determinedAccountType
        accountType: determinedAccountType // Use determinedAccountType
      });

      toast({
        title: "Organization Created",
        description: "Your company profile has been set up successfully.",
      });

      goToNextStep();
    } catch (error) {
      toast({
        title: "Setup Error",
        description: "Failed to save organization details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFacilitySetup = async (data: z.infer<typeof facilityQuickSetupSchema>) => {
    try {
      setIsSubmitting(true);

      await apiRequest('POST', '/api/onboarding/facility', {
        ...data,
        country: "US",
        operatingStatus: "ACTIVE",
        isPrimary: true,
        facilitiesPlanned: data.hasMultipleSites ? 5 : 1,
        multiSiteOperations: data.hasMultipleSites
      });

      toast({
        title: "Facility Added",
        description: "Your primary facility has been configured.",
      });

      goToNextStep();
    } catch (error) {
      toast({
        title: "Setup Error", 
        description: "Failed to save facility details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConsultantSetup = async (data: z.infer<typeof consultantClientSchema>) => {
    try {
      setIsSubmitting(true);

      await apiRequest('POST', '/api/onboarding/client-organization', {
        legalName: data.clientCompanyName,
        industry: data.clientIndustry,
        serviceType: data.serviceType,
        projectTimeline: data.projectTimeline,
        organizationSize: data.clientSize,
        specialRequirements: data.specialRequirements
      });

      toast({
        title: "Client Setup Complete",
        description: "Your client engagement has been configured.",
      });

      goToNextStep();
    } catch (error) {
      toast({
        title: "Setup Error",
        description: "Failed to save client details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      setIsSubmitting(true);

      const totalTime = Date.now() - analytics.stepStartTime + analytics.totalTime;

      // Complete onboarding and set status to assessment_active
      await apiRequest('POST', '/api/onboarding/complete', {
        accountType: determinedAccountType,
        analytics: { ...analytics, totalTime, completionRate: 100 }
      });

      // Update user setup status to assessment_active
      await apiRequest('POST', '/api/auth/update-setup-status', {
        setupStatus: 'assessment_active'
      });

      toast({
        title: "🎉 Setup Complete!",
        description: "Your R2v3 certification journey begins now. Welcome to your dashboard!",
      });

      // Redirect based on account type as per specification
      const dashboardRoute = determinedAccountType === 'consultant' ? '/consultant-dashboard' : '/dashboard'; // Use determinedAccountType
      setTimeout(() => navigate(dashboardRoute), 2000);

    } catch (error) {
      console.error('Onboarding completion error:', error);
      toast({
        title: "Completion Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    if (!currentStepData) return null;

    switch (currentStepData.id) {
      case "organization":
        return (
          <Form {...orgForm}>
            <form onSubmit={orgForm.handleSubmit(handleOrganizationSetup)} className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Quick Company Setup</h2>
                <p className="text-foreground">Just the essentials to get you started quickly.</p>
              </div>

              <div className="grid gap-4">
                <FormField
                  control={orgForm.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input 
                          data-testid="input-company-name"
                          placeholder="Acme Corporation" 
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={orgForm.control}
                    name="primaryContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Contact *</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-contact-name"
                            placeholder="John Smith" 
                            autoComplete="off"
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
                            placeholder="john@acme.com" 
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={orgForm.control}
                    name="location.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="San Francisco" 
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={orgForm.control}
                    name="location.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="CA" 
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={orgForm.control}
                    name="location.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="US">United States</SelectItem>
                            <SelectItem value="CA">Canada</SelectItem>
                            <SelectItem value="MX">Mexico</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={goToPreviousStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </div>
            </form>
          </Form>
        );

      case "facility":
        return (
          <Form {...facilityForm}>
            <form onSubmit={facilityForm.handleSubmit(handleFacilitySetup)} className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Primary Facility</h2>
                <p className="text-foreground">Tell us about your main operating location.</p>
              </div>

              <div className="grid gap-4">
                <FormField
                  control={facilityForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facility Name *</FormLabel>
                      <FormControl>
                        <Input 
                          data-testid="input-facility-name"
                          placeholder="Headquarters" 
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={facilityForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Input 
                          data-testid="input-facility-address"
                          placeholder="123 Main Street" 
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={facilityForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-facility-city"
                            placeholder="San Francisco" 
                            autoComplete="off"
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
                            data-testid="input-facility-state"
                            placeholder="CA" 
                            autoComplete="off"
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
                            data-testid="input-facility-zipcode"
                            placeholder="94105" 
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={facilityForm.control}
                    name="operationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operation Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manufacturing">Manufacturing</SelectItem>
                            <SelectItem value="warehouse">Warehouse/Distribution</SelectItem>
                            <SelectItem value="office">Office/Administrative</SelectItem>
                            <SelectItem value="mixed">Mixed Operations</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={facilityForm.control}
                    name="employeeCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee Count *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-200">51-200 employees</SelectItem>
                            <SelectItem value="201-1000">201-1000 employees</SelectItem>
                            <SelectItem value="1000+">1000+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={facilityForm.control}
                    name="hasMultipleSites"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>We have multiple facilities/sites</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={facilityForm.control}
                    name="futureExpansion"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>We plan to expand to new locations</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={goToPreviousStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </div>
            </form>
          </Form>
        );

      case "client":
        return (
          <Form {...consultantForm}>
            <form onSubmit={consultantForm.handleSubmit(handleConsultantSetup)} className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Client Information</h2>
                <p className="text-foreground">Tell us about your primary client engagement.</p>
              </div>

              <div className="grid gap-4">
                <FormField
                  control={consultantForm.control}
                  name="clientCompanyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Company Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Client Corp Inc." 
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={consultantForm.control}
                    name="clientIndustry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Industry *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Technology, Manufacturing, etc." 
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={consultantForm.control}
                    name="clientSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Organization Size *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="startup">Startup (1-20)</SelectItem>
                            <SelectItem value="small">Small (21-100)</SelectItem>
                            <SelectItem value="medium">Medium (101-500)</SelectItem>
                            <SelectItem value="large">Large (501-5000)</SelectItem>
                            <SelectItem value="enterprise">Enterprise (5000+)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={consultantForm.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="r2_certification">R2 Certification</SelectItem>
                            <SelectItem value="compliance_audit">Compliance Audit</SelectItem>
                            <SelectItem value="gap_analysis">Gap Analysis</SelectItem>
                            <SelectItem value="ongoing_consulting">Ongoing Consulting</SelectItem>
                            <SelectItem value="other">Other Services</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={consultantForm.control}
                    name="projectTimeline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Timeline *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select timeline" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="immediate">Immediate (Starting now)</SelectItem>
                            <SelectItem value="1-3_months">1-3 months</SelectItem>
                            <SelectItem value="3-6_months">3-6 months</SelectItem>
                            <SelectItem value="6-12_months">6-12 months</SelectItem>
                            <SelectItem value="ongoing">Ongoing relationship</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={consultantForm.control}
                  name="specialRequirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Requirements (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any specific compliance standards, security requirements, or other considerations..."
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={goToPreviousStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </div>
            </form>
          </Form>
        );

      case "confirmation":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Ready to Start!</h2>
              <p className="text-foreground">
                Great! We've got everything we need to set up your {determinedAccountType} account. 
                You'll be redirected to your dashboard where you can start your R2 journey.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  What's Next?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Access Your Dashboard</p>
                    <p className="text-sm text-foreground">View your personalized compliance overview</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">{determinedAccountType === 'business' ? 'Complete Assessment Setup' : 'Setup Client Projects'}</p>
                    <p className="text-sm text-foreground">Configure your {determinedAccountType === 'business' ? 'compliance' : 'consulting'} workflow</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Start Your R2 Journey</p>
                    <p className="text-sm text-foreground">Begin working towards certification</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={goToPreviousStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={completeOnboarding} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Setup
                <CheckCircle className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Initialize step tracking
  useEffect(() => {
    if (currentStepData) {
      trackStepProgress(currentStepData.id, 'start');
    }
  }, [currentStepData?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900/40 via-background to-green-900/40">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome to RUR2 {determinedAccountType === 'consultant' ? '- Consultant Portal' : ''}
            </h1>
            <p className="text-foreground">
              {determinedAccountType === 'consultant' 
                ? "Let's set up your consultant account and client management capabilities"
                : "Let's get your account set up for R2v3 compliance assessment"
              }
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {getVisibleSteps().map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors
                      ${isActive ? 'bg-blue-600 text-white' : 
                        isCompleted ? 'bg-green-600 text-white' : 'bg-muted/30 text-foreground'}
                    `}>
                      {isCompleted ? <CheckCircle className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-foreground'}`}>
                        {step.title}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-foreground mt-2">
              <span>Step {currentStep + 1} of {getVisibleSteps().length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
          </div>

          {/* Main Content */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-8">
              {renderStepContent()}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-8 text-sm text-foreground">
            <p>Need help? <a href="/help" className="text-blue-600 hover:underline">Contact our support team</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}