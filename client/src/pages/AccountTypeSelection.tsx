import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Building2, Users, ArrowRight, CheckCircle, Star, Shield, Target, ArrowLeft, Loader2 } from "lucide-react";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

export default function AccountTypeSelection() {
  const [, setLocation] = useLocation();
  const { user, isLoading, refreshUser } = useAuth();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<'BUSINESS' | 'CONSULTANT' | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('🔒 Not authenticated, redirecting to login');
      toast({
        title: "Authentication Required",
        description: "Please log in to select your account type.",
        variant: "destructive",
      });
      setLocation('/login');
    }
  }, [user, isLoading, setLocation, toast]);

  const updateAccountTypeMutation = useMutation({
    mutationFn: async (accountType: 'BUSINESS' | 'CONSULTANT') => {
      const res = await apiRequest("PATCH", "/api/auth/account-type", {
        accountType,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update account type');
      }
      return await res.json();
    },
    onSuccess: async (data) => {
      await refreshUser();
      toast({
        title: "Account Path Selected",
        description: `Welcome to your ${selectedType?.toLowerCase()} journey! Redirecting to pricing...`,
      });
      // Industry standard: redirect to filtered pricing based on account type
      const accountTypeParam = selectedType === 'BUSINESS' ? 'business' : 'consultant';
      setTimeout(() => setLocation(`/pricing?type=${accountTypeParam}`), 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Selection Failed",
        description: error.message || "Failed to set account type. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAccountTypeSelect = (accountType: 'BUSINESS' | 'CONSULTANT') => {
    setSelectedType(accountType);
    updateAccountTypeMutation.mutate(accountType);
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900/20 via-background to-green-900/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900/20 via-background to-green-900/20">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/")}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center space-x-3">
              <img 
                src={rurLogo} 
                alt="RuR2 Logo" 
                className="w-8 h-8 rounded-glass logo-glow object-contain"
              />
              <span className="text-lg font-display font-bold text-glow-blue">RuR2</span>
            </div>

            <div className="w-16" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/20">
              <Shield className="h-3 w-3 mr-1" />
              R2v3 Certification Platform
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Choose Your Certification Path
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-3xl mx-auto">
              Select your account type to unlock a customized R2v3 certification experience 
              designed for your specific role in the electronics recycling industry.
            </p>
          </div>

          {/* Account Type Cards */}
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Business Account */}
            <Card 
              className={`cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] relative group border-2 ${
                selectedType === 'BUSINESS' ? 'border-blue-500 bg-blue-500/5' : 'border-muted hover:border-blue-500/50'
              }`}
              onClick={() => !updateAccountTypeMutation.isPending && handleAccountTypeSelect('BUSINESS')}
            >
              <div className="absolute top-6 right-6">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                  <Star className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              </div>

              <CardHeader className="text-center pb-6 pt-8">
                <div className="w-20 h-20 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-500/30 transition-all duration-300">
                  <Building2 className="h-10 w-10 text-blue-600" />
                </div>
                <CardTitle className="text-2xl text-foreground mb-2">Business Organization</CardTitle>
                <p className="text-muted-foreground text-lg">
                  For recycling facilities and businesses seeking R2v3 certification
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Direct Certification Path</p>
                      <p className="text-sm text-muted-foreground">Streamlined process for your organization's R2v3 certification</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Multi-Facility Management</p>
                      <p className="text-sm text-muted-foreground">Manage multiple locations with centralized oversight</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Team Collaboration</p>
                      <p className="text-sm text-muted-foreground">Role-based access and workflow management</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Compliance Tracking</p>
                      <p className="text-sm text-muted-foreground">Real-time monitoring and audit preparation</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-foreground mb-3">Ideal for:</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      Electronics recycling facilities
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      IT asset disposition companies
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      Multi-site operations
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      Internal compliance teams
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full h-12 text-base font-semibold group-hover:bg-blue-600 transition-all duration-300" 
                  disabled={updateAccountTypeMutation.isPending}
                  size="lg"
                >
                  {updateAccountTypeMutation.isPending && selectedType === 'BUSINESS' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Setting up your business account...
                    </>
                  ) : (
                    <>
                      Choose Business Path
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Consultant Account */}
            <Card 
              className={`cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] group border-2 ${
                selectedType === 'CONSULTANT' ? 'border-green-500 bg-green-500/5' : 'border-muted hover:border-green-500/50'
              }`}
              onClick={() => !updateAccountTypeMutation.isPending && handleAccountTypeSelect('CONSULTANT')}
            >
              <CardHeader className="text-center pb-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-green-500/30 transition-all duration-300">
                  <Users className="h-10 w-10 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-foreground mb-2">Consulting & Certification</CardTitle>
                <p className="text-muted-foreground text-lg">
                  For consultants, auditors, and certification bodies serving multiple clients
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Multi-Client Management</p>
                      <p className="text-sm text-muted-foreground">Manage multiple client businesses and projects</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Client Collaboration Portal</p>
                      <p className="text-sm text-muted-foreground">Secure workspace for client engagement</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Professional Reporting</p>
                      <p className="text-sm text-muted-foreground">Branded reports and client dashboards</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">White-Label Options</p>
                      <p className="text-sm text-muted-foreground">Customize the platform with your branding</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-foreground mb-3">Ideal for:</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      R2 consultants and auditors
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      Certification bodies (CBs)
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      Multi-client service providers
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      Consulting agencies
                    </div>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full h-12 text-base font-semibold group-hover:bg-green-600 group-hover:text-white group-hover:border-green-600 transition-all duration-300" 
                  disabled={updateAccountTypeMutation.isPending}
                  size="lg"
                >
                  {updateAccountTypeMutation.isPending && selectedType === 'CONSULTANT' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                      Setting up your consultant account...
                    </>
                  ) : (
                    <>
                      Choose Consultant Path
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Benefits Section */}
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold text-foreground">Why Choose RuR2?</h3>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="font-medium">Industry Certified</h4>
                <p className="text-sm text-muted-foreground">Built by R2 experts for R2 compliance</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="font-medium">Proven Results</h4>
                <p className="text-sm text-muted-foreground">Streamlined path to certification</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-medium">Expert Support</h4>
                <p className="text-sm text-muted-foreground">Dedicated R2 consulting available</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 space-y-2">
            <p className="text-sm text-muted-foreground">
              Need help choosing? <a href="/help" className="text-primary hover:underline font-medium">Contact our R2 experts</a>
            </p>
            <p className="text-xs text-muted-foreground">
              You can change your account type later in settings if needed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}