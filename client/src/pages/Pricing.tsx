import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  Check, 
  X, 
  Users, 
  Building, 
  Crown,
  ArrowLeft,
  Award,
  Star,
  Zap,
  Menu,
  Loader2
} from "lucide-react";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  
  // Extract account type from URL query parameter (industry standard flow)
  const urlParams = new URLSearchParams(window.location.search);
  const accountTypeParam = urlParams.get('type'); // 'business' or 'consultant'
  const showBusinessPlans = !accountTypeParam || accountTypeParam === 'business';
  const showConsultantPlans = !accountTypeParam || accountTypeParam === 'consultant';

  // Mutation to create Stripe checkout session
  const createCheckoutSessionMutation = useMutation({
    mutationFn: async ({ tier, accountType, planId }: { tier: string; accountType: string; planId: string }) => {
      const res = await apiRequest("POST", "/api/stripe/create-license", {
        tier,
        facilityPacks: 0,
        seatPacks: 0,
        supportTier: 'BASIC',
        billingEmail: user?.email || '',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }
      return { data: await res.json(), planId, accountType };
    },
    onSuccess: ({ data, planId, accountType }) => {
      console.log('✅ Stripe checkout session created for plan:', planId);
      if (processingPlanId === planId && data.url) {
        // Redirect to Stripe-hosted checkout
        window.location.href = data.url;
      } else {
        console.log('⚠️ Stale mutation or missing URL');
      }
    },
    onError: (error: Error, variables) => {
      console.error('❌ Checkout session failed for plan:', variables.planId);
      if (processingPlanId === variables.planId) {
        console.log('❌ Clearing state for failed plan:', variables.planId);
        setSelectedPlan(null);
        setProcessingPlanId(null);
        toast({
          title: "Payment Error",
          description: error.message || "Failed to create checkout session. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Mutation to update account type
  const updateAccountTypeMutation = useMutation({
    mutationFn: async ({ accountType, tier, planId }: { accountType: string; tier: string; planId: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/account-type", {
        accountType: accountType.toUpperCase(),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update account type');
      }
      return { data: await res.json(), tier, accountType, planId };
    },
    onSuccess: ({ tier, accountType, planId }) => {
      console.log('✅ Account type updated, creating checkout session for:', planId);
      if (processingPlanId === planId) {
        // After setting account type, create Stripe checkout session
        createCheckoutSessionMutation.mutate({ tier, accountType, planId });
      }
    },
    onError: (error: Error, variables) => {
      console.error('❌ Account type update failed for plan:', variables.planId);
      if (processingPlanId === variables.planId) {
        setSelectedPlan(null);
        setProcessingPlanId(null);
        toast({
          title: "Error",
          description: error.message || "Failed to set account type. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Map plan IDs to Stripe tier names
  const planToTierMap: Record<string, string> = {
    'solo': 'BUSINESS_SOLO',
    'team': 'BUSINESS_TEAM',
    'enterprise': 'BUSINESS_ENTERPRISE',
    'independent': 'CONSULTANT_INDEPENDENT',
    'agency': 'CONSULTANT_AGENCY',
    'enterprise-consultant': 'CONSULTANT_ENTERPRISE'
  };

  // Handler for plan selection - Creates Stripe checkout session
  const handlePlanSelect = (planId: string, planCategory: 'business' | 'consultant') => {
    console.log('📋 Plan selected:', { 
      planId, 
      planCategory, 
      authenticated: !!user, 
      emailVerified: user?.emailVerified,
      authLoading,
      tenantType: user?.tenant?.type,
      currentlyProcessing: processingPlanId
    });

    // Wait for auth to finish loading before making authentication decisions
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }

    // Allow users to change plan selection - only block if THIS specific plan is processing
    if (processingPlanId === planId) {
      console.log('⏳ This plan is already being processed');
      return;
    }

    // If user is authenticated and email verified
    if (user && user.emailVerified) {
      setSelectedPlan(planId);
      setProcessingPlanId(planId);
      
      const tier = planToTierMap[planId];
      if (!tier) {
        toast({
          title: "Error",
          description: "Invalid plan selected. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Check if user already has a tenant type set (from account type selection page)
      if (user.tenant?.type) {
        console.log('✅ Tenant type already set, creating checkout session:', user.tenant.type);
        // User already selected account type, go straight to Stripe checkout
        createCheckoutSessionMutation.mutate({ tier, accountType: planCategory, planId });
      } else {
        console.log('⚠️ No tenant type set, updating account type first');
        // Set account type first, then create checkout session
        updateAccountTypeMutation.mutate({ accountType: planCategory, tier, planId });
      }
    } else {
      // If not authenticated, go to registration with plan in URL
      console.log('👤 User not authenticated, redirecting to registration');
      setLocation(`/register?plan=${planId}`);
    }
  };

  const businessTiers = [
    {
      name: "Solo Business",
      price: "$399",
      description: "Perfect for single-facility recyclers starting their R2v3 journey",
      icon: <Users className="h-6 w-6" />,
      features: [
        "1 facility",
        "1-3 seats",
        "Self-Assessment Module",
        "REC Mapping & Dashboard", 
        "Scope Statement Generator",
        "Export to PDF, Excel, Word",
        "Audit Prep Toolkit",
        "Mock Audit Simulator",
        "Corrective Action Tracker",
        "Training Center"
      ],
      addOns: [
        "Extra seats: $50 each"
      ],
      popular: false,
      cta: "Get Started"
    },
    {
      name: "Team Business",
      price: "$899",
      description: "Ideal for regional recyclers with multiple locations and teams",
      icon: <Building className="h-6 w-6" />,
      features: [
        "2 facilities",
        "Up to 10 seats",
        "All Solo Business features",
        "Business Admin Panel",
        "Role-based access control",
        "Team collaboration tools",
        "Activity logs & audit trails"
      ],
      addOns: [
        "Extra facilities: $400 each (adds +5 seats)",
        "Extra seats: $45 each"
      ],
      popular: true,
      cta: "Most Popular"
    },
    {
      name: "Enterprise Multi-Site",
      price: "$1,799",
      description: "Complete solution for large enterprises with multiple facilities",
      icon: <Crown className="h-6 w-6" />,
      features: [
        "3+ facilities (expandable)",
        "Up to 25 seats (expandable)",
        "All Team Business features",
        "Internal oversight tools",
        "Cross-facility reporting",
        "Enterprise-grade analytics",
        "Priority support"
      ],
      addOns: [
        "Extra facilities: $400 each (adds +5 seats)",
        "Bulk facility discounts available"
      ],
      popular: false,
      cta: "Contact Sales"
    }
  ];

  const consultantTiers = [
    {
      name: "Independent Consultant",
      price: "$599",
      description: "For individual consultants managing multiple client businesses",
      features: [
        "Manage up to 5 client businesses",
        "All toolkit features",
        "Client collaboration tools",
        "Dedicated consultant dashboard"
      ],
      addOns: ["Extra businesses: $100 each"]
    },
    {
      name: "Agency Consultant", 
      price: "$1,199",
      description: "For consulting agencies with multiple consultants and clients",
      features: [
        "Manage up to 15 businesses",
        "Dedicated collaboration tools",
        "Multi-consultant workflows",
        "Advanced client management"
      ],
      addOns: ["Extra businesses: $90 each"]
    },
    {
      name: "Enterprise Agency / CB",
      price: "$2,499", 
      description: "For large agencies and certification bodies",
      features: [
        "Manage up to 50 businesses",
        "White-label branding",
        "Premium dashboards",
        "Custom reporting",
        "API access"
      ],
      addOns: ["Extra businesses: $75 each"]
    }
  ];

  const supportPackages = [
    {
      name: "Lite Support Pack",
      price: "$500",
      description: "Basic guidance for self-assessment completion",
      features: [
        "Email support for self-assessment review",
        "3-hour consultant Q&A block",
        "Basic documentation review"
      ]
    },
    {
      name: "Full Guidance Pack",
      price: "$1,750", 
      description: "Comprehensive consulting support for certification success",
      features: [
        "Up to 12 hours dedicated consultant time",
        "Live video sessions",
        "Mock audit walkthrough",
        "Complete documentation review",
        "Certification readiness assessment"
      ]
    },
    {
      name: "Premium Hourly",
      price: "$225/hr",
      description: "On-demand expert consulting for specialized needs",
      features: [
        "Rush or specialty consulting",
        "Appendix B data sanitization guidance",
        "Downstream vendor mapping support",
        "Custom compliance strategies"
      ]
    }
  ];

  const discounts = [
    {
      title: "Volume Discounts",
      description: "Automatic savings for larger implementations",
      tiers: [
        "10% off at 10+ seats/facilities/businesses",
        "15% off at 20+", 
        "20% off at 50+"
      ]
    }
  ];

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading pricing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-xs sm:text-sm px-2 sm:px-3 min-h-[44px]">
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Back</span>
              <span className="xs:hidden">←</span>
            </Button>

            {/* Logo - Centered on Mobile, Left on Desktop */}
            <div className="absolute left-1/2 transform -translate-x-1/2 md:static md:transform-none md:translate-x-0 md:ml-6 flex items-center space-x-2 sm:space-x-3">
              <img 
                src={rurLogo} 
                alt="RuR2 Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-glass logo-glow object-contain"
              />
              <span className="text-sm sm:text-lg md:text-xl lg:text-2xl font-display font-bold text-glow-blue whitespace-nowrap">RuR2</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <Button variant="ghost" className="min-h-[44px]" onClick={() => setLocation("/about")}>About</Button>
              <Button variant="ghost" className="min-h-[44px]" onClick={() => setLocation("/help")}>Help</Button>
              <Button className="btn-primary-glass min-h-[44px]" onClick={() => setLocation("/register")}>Get Started</Button>
            </div>

            {/* Mobile Hamburger Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-2">
                    <Menu className="h-6 w-6 text-foreground" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 glass-morphism border-glass-border">
                  <div className="flex flex-col space-y-4 mt-8">
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary min-h-[44px]" 
                      onClick={() => setLocation("/")}
                    >
                      Home
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary min-h-[44px]" 
                      onClick={() => setLocation("/about")}
                    >
                      About
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary min-h-[44px]" 
                      onClick={() => setLocation("/help")}
                    >
                      Help
                    </Button>
                    <div className="border-t border-glass-border pt-4 space-y-4">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start min-h-[44px]" 
                        onClick={() => setLocation("/login")}
                      >
                        Login
                      </Button>
                      <Button 
                        className="w-full btn-primary-glass min-h-[44px]" 
                        onClick={() => setLocation("/register")}
                      >
                        Get Started
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-8 sm:py-12 md:py-16" data-testid="section-pricing-hero">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <Badge className="mb-4 sm:mb-6 bg-primary/10 text-primary hover:bg-primary/20 text-xs sm:text-sm px-4 py-1.5" data-testid="badge-perpetual-license">
            Perpetual Licensing • Own It Forever • No Recurring Fees
          </Badge>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4" data-testid="heading-pricing-title">
            {accountTypeParam === 'business' && 'Business Licensing Plans'}
            {accountTypeParam === 'consultant' && 'Consultant & Certification Body Plans'}
            {!accountTypeParam && 'Own Your R2v3 Certification Tools Forever'}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
            {accountTypeParam === 'business' && 'Professional certification tools for recycling facilities and businesses. One-time purchase, lifetime ownership.'}
            {accountTypeParam === 'consultant' && 'Comprehensive multi-client management solutions for consultants and certification bodies. One-time purchase, lifetime access.'}
            {!accountTypeParam && 'One-time purchase, lifetime ownership. No monthly fees, no recurring charges. Buy once and use forever with free updates as R2v3 standards evolve.'}
          </p>
        </div>
      </section>

      {/* Business Pricing */}
      {showBusinessPlans && (
      <section className="py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-3">For Recycling Businesses</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Professional R2v3 certification tools for your facility</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-14">
            {businessTiers.map((tier, index) => {
              const planMap = {
                "Solo Business": "solo",
                "Team Business": "team", 
                "Enterprise Multi-Site": "enterprise"
              };
              const planId = planMap[tier.name as keyof typeof planMap];

              return (
                <Card 
                  key={index} 
                  className={`relative ${tier.popular ? 'border-primary shadow-xl scale-105' : ''}`}
                  data-testid={`card-plan-${planId}`}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="btn-primary-glass text-white px-4 py-1" data-testid="badge-most-popular">
                        <Star className="h-3 w-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-3 pt-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <div className="text-primary">
                        {tier.icon}
                      </div>
                    </div>
                    <CardTitle className="text-lg sm:text-xl text-foreground" data-testid={`text-plan-name-${planId}`}>{tier.name}</CardTitle>
                    <div className="text-2xl sm:text-3xl font-bold text-foreground mb-2" data-testid={`text-plan-price-${planId}`}>{tier.price}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-snug" data-testid={`text-plan-description-${planId}`}>{tier.description}</p>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <ul className="space-y-2 mb-4" data-testid={`list-plan-features-${planId}`}>
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center text-xs sm:text-sm" data-testid={`feature-${planId}-${idx}`}>
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mr-2 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="border-t pt-3 mb-4">
                      <h4 className="font-medium text-foreground mb-1.5 text-xs sm:text-sm">Add-Ons Available:</h4>
                      <ul className="space-y-0.5">
                        {tier.addOns.map((addon, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground">• {addon}</li>
                        ))}
                      </ul>
                    </div>

                    <Button 
                      className={`w-full min-h-[44px] ${tier.popular ? 'btn-primary-glass' : ''}`}
                      variant={tier.popular ? 'default' : 'outline'}
                      data-testid={`button-select-plan-${planId}`}
                      onClick={() => handlePlanSelect(planId, 'business')}
                      disabled={processingPlanId === planId}
                    >
                      {processingPlanId === planId ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        tier.cta
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* Consultant Pricing */}
      {showConsultantPlans && (
      <section className="py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-3">For Consultants & Certification Bodies</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Manage multiple client businesses with professional tools</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-14">
            {consultantTiers.map((tier, index) => {
              const planMap = {
                "Independent Consultant": "independent",
                "Agency Consultant": "agency",
                "Enterprise Agency / CB": "enterprise-consultant"
              };
              const planId = planMap[tier.name as keyof typeof planMap];

              return (
                <Card key={index} data-testid={`card-plan-${planId}`}>
                  <CardHeader className="text-center pb-3 pt-4">
                    <CardTitle className="text-base sm:text-lg text-foreground" data-testid={`text-plan-name-${planId}`}>{tier.name}</CardTitle>
                    <div className="text-2xl sm:text-3xl font-bold text-foreground mb-2" data-testid={`text-plan-price-${planId}`}>{tier.price}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-snug" data-testid={`text-plan-description-${planId}`}>{tier.description}</p>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <ul className="space-y-2 mb-4" data-testid={`list-plan-features-${planId}`}>
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center text-xs sm:text-sm">
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mr-2 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="border-t pt-3 mb-4">
                      <h4 className="font-medium text-foreground mb-1.5 text-xs sm:text-sm">Add-Ons:</h4>
                      <ul className="space-y-0.5">
                        {tier.addOns.map((addon, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground">• {addon}</li>
                        ))}
                      </ul>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full min-h-[44px]"
                      data-testid={`button-select-plan-${planId}`}
                      onClick={() => handlePlanSelect(planId, 'consultant')}
                      disabled={processingPlanId === planId}
                    >
                      {processingPlanId === planId ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        "Get Started"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* Support & Services */}
      <section className="py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-3">Support & Professional Services</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Expert guidance to ensure your certification success</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-14">
            {supportPackages.map((pkg, index) => (
              <Card key={index}>
                <CardHeader className="text-center pb-3 pt-4">
                  <CardTitle className="text-base sm:text-lg text-foreground">{pkg.name}</CardTitle>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{pkg.price}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-snug">{pkg.description}</p>
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="space-y-2 mb-4">
                    {pkg.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-xs sm:text-sm">
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mr-2 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button variant="outline" className="w-full min-h-[44px]">
                    Contact Sales
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Volume Discounts */}
      <section className="py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-3">Volume Discounts</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Automatic savings for larger implementations</p>
          </div>

          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-5 sm:p-6 md:p-8 text-center">
              <Zap className="h-10 w-10 sm:h-12 sm:w-12 text-primary mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground mb-3 sm:mb-4">Automatic Volume Pricing</h3>
              <div className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>10+ seats/facilities/businesses</span>
                  <Badge variant="outline" className="text-xs">10% OFF</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>20+ seats/facilities/businesses</span>
                  <Badge variant="outline" className="text-xs">15% OFF</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>50+ seats/facilities/businesses</span>
                  <Badge variant="outline" className="text-xs">20% OFF</Badge>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">
                Discounts automatically applied at checkout
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-3">Feature Comparison</h2>
            <p className="text-sm sm:text-base text-muted-foreground">See what's included in each business tier</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full glass-morphism rounded-lg text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-glass-border">
                  <th className="text-left p-2 sm:p-3 md:p-4 font-semibold text-foreground">Feature</th>
                  <th className="text-center p-2 sm:p-3 md:p-4 font-semibold text-foreground">Solo</th>
                  <th className="text-center p-2 sm:p-3 md:p-4 font-semibold text-foreground">Team</th>
                  <th className="text-center p-2 sm:p-3 md:p-4 font-semibold text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Facilities", solo: "1", team: "2", enterprise: "3+ (expandable)" },
                  { feature: "Seats (users)", solo: "1-3", team: "Up to 10", enterprise: "Up to 25 (expandable)" },
                  { feature: "Self-Assessment Module", solo: true, team: true, enterprise: true },
                  { feature: "REC Mapping Dashboard", solo: true, team: true, enterprise: true },
                  { feature: "Scope Statement Generator", solo: true, team: true, enterprise: true },
                  { feature: "Export to PDF, Excel, Word", solo: true, team: true, enterprise: true },
                  { feature: "Audit Prep Toolkit", solo: true, team: true, enterprise: true },
                  { feature: "Mock Audit Simulator", solo: true, team: true, enterprise: true },
                  { feature: "Corrective Action Tracker", solo: true, team: true, enterprise: true },
                  { feature: "Training Center", solo: true, team: true, enterprise: true },
                  { feature: "Business Admin Panel", solo: false, team: true, enterprise: true },
                  { feature: "Internal Oversight Tools", solo: false, team: false, enterprise: true }
                ].map((row, index) => (
                  <tr key={index} className="border-b border-glass-border last:border-b-0">
                    <td className="p-2 sm:p-3 md:p-4 text-foreground">{row.feature}</td>
                    <td className="p-2 sm:p-3 md:p-4 text-center text-muted-foreground">
                      {typeof row.solo === 'boolean' ? (
                        row.solo ? <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" /> : <X className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50 mx-auto" />
                      ) : row.solo}
                    </td>
                    <td className="p-2 sm:p-3 md:p-4 text-center text-muted-foreground">
                      {typeof row.team === 'boolean' ? (
                        row.team ? <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" /> : <X className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50 mx-auto" />
                      ) : row.team}
                    </td>
                    <td className="p-2 sm:p-3 md:p-4 text-center text-muted-foreground">
                      {typeof row.enterprise === 'boolean' ? (
                        row.enterprise ? <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" /> : <X className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50 mx-auto" />
                      ) : row.enterprise}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 sm:py-12 md:py-16 glass-morphism">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-3 sm:mb-4">
            Ready to Start Your R2v3 Certification?
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-white/90 mb-6 sm:mb-8 max-w-2xl mx-auto">
            One-time payment, lifetime access. Get started today and accelerate your certification process.
          </p>
          <Button 
              size="lg" 
              variant="secondary"
              className="glass-morphism text-primary hover:bg-primary/10 px-6 py-2.5 sm:px-8 sm:py-3 min-h-[44px]"
              onClick={() => setLocation("/register")}
            >
              Get Started
            </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-muted-foreground py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src={rurLogo} alt="RuR2 Logo" className="h-8 w-auto rounded-glass logo-glow" />
            <span className="text-base sm:text-lg md:text-xl font-bold text-white">RuR2</span>
          </div>
          <p className="text-muted-foreground">
            Professional R2v3 certification platform • Perpetual licensing • No recurring billing
          </p>
        </div>
      </footer>
    </div>
  );
}