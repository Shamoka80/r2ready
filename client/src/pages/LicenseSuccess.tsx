import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { CheckCircle, ArrowRight, CreditCard, Home, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { apiGet } from "@/api";
import { apiRequest, queryClient } from "@/lib/queryClient";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

interface SessionData {
  id: string;
  payment_status: string;
  customer_email: string;
  amount_total: number;
  metadata: {
    licenseId: string;
    licenseType: string;
    accountType: string;
    userId: string;
    maxFacilities?: string;
    maxSeats?: string;
    supportTier?: string;
    mockPayment?: string;
  };
}

interface License {
  id: string;
  planName: string;
  licenseType: string;
  maxFacilities: number | null;
  maxSeats: number | null;
  supportTier: string | null;
  amountPaid: number;
  currency: string;
  createdAt: string;
}

interface ActivationResponse {
  success: boolean;
  alreadyActivated: boolean;
  license: {
    id: string;
    tier: string;
    status: string;
    maxFacilities: number;
    maxSeats: number;
  };
  nextRoute: string;
}

export default function LicenseSuccess() {
  const [location, setLocation] = useLocation(); // Added setLocation for the header button
  const [sessionId, setSessionId] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);
  const [shouldRedirect, setShouldRedirect] = useState<boolean>(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdParam = urlParams.get('session_id');
    if (sessionIdParam) {
      setSessionId(sessionIdParam);
    }
  }, [location]);

  // CRITICAL: License activation mutation - creates license in database after payment
  const activateLicenseMutation = useMutation<ActivationResponse, Error, string>({
    mutationFn: async (sessionId: string) => {
      console.log('🔵 FRONTEND: Triggering license activation for session:', sessionId);
      const response = await fetch(`/api/stripe/session/${sessionId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
      });
      
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = 'License activation failed';
        let errorCode = 'ACTIVATION_ERROR';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorCode = errorData.code || errorCode;
          console.error('❌ FRONTEND: Activation error details', errorData);
        } catch (parseError) {
          console.error('❌ FRONTEND: Failed to parse error response', parseError);
        }
        
        const error = new Error(errorMessage) as Error & { code?: string };
        error.code = errorCode;
        throw error;
      }
      
      return response.json();
    },
    onSuccess: (data: ActivationResponse) => {
      console.log('✅ FRONTEND: License activation successful', data);
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['license-status'] });
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['stripe-session', sessionId] });
      
      // Redirect to onboarding after successful activation
      if (data.nextRoute) {
        console.log('🔵 FRONTEND: Redirecting to:', data.nextRoute);
        setTimeout(() => {
          setLocation(data.nextRoute);
        }, 2000); // Give user 2 seconds to see success message
      }
    },
    onError: (error: Error) => {
      console.error('❌ FRONTEND: License activation failed', error);
      console.error('❌ FRONTEND: Error code:', (error as any).code);
      console.error('❌ FRONTEND: Error message:', error.message);
    },
  });

  // Trigger activation when sessionId is available and not already activating
  useEffect(() => {
    if (sessionId && !activateLicenseMutation.isPending && !activateLicenseMutation.isSuccess) {
      console.log('🔵 FRONTEND: Starting license activation flow for session:', sessionId);
      activateLicenseMutation.mutate(sessionId);
    }
  }, [sessionId]);

  // Fetch session data from Stripe (optional - only for real Stripe payments)
  const { 
    data: sessionData, 
    isLoading: sessionLoading, 
    error: sessionError 
  } = useQuery<SessionData>({
    queryKey: ['stripe-session', sessionId],
    queryFn: () => apiGet(`/api/stripe/session/${sessionId}`),
    enabled: !!sessionId,
  });

  // Fetch license status directly (for mock payments or as fallback when Stripe session fails)
  const {
    data: licenseStatus,
    isLoading: licenseStatusLoading
  } = useQuery<{ hasLicense: boolean; status: string; license?: any }>({
    queryKey: ['license-status'],
    queryFn: () => apiGet('/api/licenses/status'),
    enabled: !sessionId || !!sessionError, // Fetch when: no session_id OR Stripe session failed
  });

  // Fetch updated licenses to confirm creation
  const { 
    data: licenses = [], 
    isLoading: licensesLoading,
    refetch: refetchLicenses 
  } = useQuery<License[]>({
    queryKey: ['licenses'],
    queryFn: () => apiGet('/api/licenses'),
    enabled: (!!sessionData && sessionData.payment_status === 'paid') || (!!licenseStatus && licenseStatus.hasLicense),
  });

  // Auto-redirect countdown after successful payment
  useEffect(() => {
    const isStripePaymentSuccess = sessionData && sessionData.payment_status === 'paid';
    const isMockPaymentSuccess = licenseStatus && licenseStatus.hasLicense && licenseStatus.status === 'active';
    
    if ((isStripePaymentSuccess || isMockPaymentSuccess) && !shouldRedirect) {
      setShouldRedirect(true);
      
      const countdownInterval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Redirect to onboarding if user hasn't completed setup, otherwise to dashboard
            const urlParams = new URLSearchParams(window.location.search);
            const redirectTo = urlParams.get('redirect') || '/onboarding';
            console.log('✅ Auto-redirecting to:', redirectTo);
            setLocation(redirectTo);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [sessionData, licenseStatus, shouldRedirect, setLocation]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Loading state - show while activating license or fetching data
  if ((sessionId && (sessionLoading || activateLicenseMutation.isPending)) || (!sessionId && licenseStatusLoading)) {
    return (
      <div className="min-h-screen bg-gradient-professional flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jade mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {activateLicenseMutation.isPending ? 'Activating License' : 'Processing Payment'}
            </h2>
            <p className="text-muted-foreground">
              {activateLicenseMutation.isPending 
                ? 'Please wait while we activate your license...' 
                : 'Please wait while we confirm your payment...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error handling - show if activation failed OR if both Stripe session AND license status failed
  const hasActivationError = activateLicenseMutation.isError;
  const hasStripeSessionError = sessionId && (sessionError || !sessionData);
  const hasLicenseStatusError = !licenseStatus || !licenseStatus.hasLicense;
  const shouldShowError = hasActivationError || (hasStripeSessionError && hasLicenseStatusError && !licenseStatusLoading);
  
  if (shouldShowError) {
    return (
      <div className="min-h-screen bg-gradient-professional flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {hasActivationError ? 'License Activation Error' : 'Payment Error'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {hasActivationError 
                ? 'There was an error activating your license. Please contact support - your payment was successful but license activation failed.'
                : 'There was an error processing your payment. Please contact support if you\'ve been charged.'}
            </p>
            <div className="space-y-3">
              <Link href="/licenses">
                <Button className="w-full">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go to Licenses
                </Button>
              </Link>
              <Link href="/help">
                <Button variant="outline" className="w-full">
                  Contact Support
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine payment success and type
  const isStripePayment = !!sessionId && !!sessionData;
  const isMockPayment = (!sessionId && !!licenseStatus) || (sessionError && !!licenseStatus); // Mock payment OR Stripe fallback
  const isPaymentSuccessful = isStripePayment 
    ? sessionData.payment_status === 'paid' 
    : (licenseStatus?.hasLicense && licenseStatus?.status === 'active');
  const isMockPaymentFlag = isStripePayment 
    ? sessionData.metadata?.mockPayment === 'true'
    : true; // Show mock badge for both mock payments and fallback cases

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Home Button + Logo */}
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="p-2">
                <Home className="h-4 w-4" />
                <span className="sr-only">Home</span>
              </Button>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img 
                    src={rurLogo} 
                    alt="RuR2 Logo" 
                    className="w-8 h-8 md:w-10 md:h-10 rounded-glass shadow-glass object-contain"
                  />
                  <div className="absolute inset-0 rounded-glass bg-gradient-to-br from-primary/20 to-secondary/20 mix-blend-overlay" />
                </div>
                <span className="text-lg md:text-xl font-display font-bold text-glow-blue">RuR2</span>
              </div>
            </div>

            {/* Mobile Navigation */}
            <MobileNavigation
              navigationItems={[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Help", href: "/help" }
              ]}
              showAuth={false}
            />
          </div>
        </div>
      </header>

      <div className="bg-gradient-professional flex items-center justify-center p-4 min-h-screen">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            {isPaymentSuccessful ? (
              <div className="space-y-4" data-testid="section-payment-successful">
                <div className="mx-auto w-16 h-16 bg-jade/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-jade" data-testid="icon-success" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-foreground" data-testid="heading-payment-successful">Payment Successful!</CardTitle>
                  <p className="text-muted-foreground mt-2" data-testid="text-success-message">
                    Your license has been activated and is ready to use.
                    {isMockPaymentFlag && (
                      <span className="block text-sm text-amber-600 mt-1" data-testid="text-mock-payment">
                        (Test Payment - Development Mode)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" data-testid="section-payment-pending">
                <div className="mx-auto w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-foreground" data-testid="heading-payment-pending">Payment Pending</CardTitle>
                  <p className="text-muted-foreground mt-2" data-testid="text-pending-message">
                    Your payment is still being processed. Please check back in a few minutes.
                  </p>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Payment Details - Show for Stripe payments */}
            {isStripePayment && (
              <div className="space-y-4" data-testid="section-payment-details">
                <h3 className="text-lg font-semibold text-foreground">Payment Details</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session ID:</span>
                    <span className="font-mono text-sm" data-testid="text-session-id">{sessionData.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-semibold" data-testid="text-amount-paid">{formatPrice(sessionData.amount_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer Email:</span>
                    <span data-testid="text-customer-email">{sessionData.customer_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={isPaymentSuccessful ? "default" : "secondary"} data-testid="badge-payment-status">
                      {sessionData.payment_status}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* License Information */}
            {(isStripePayment && sessionData.metadata) || (isMockPayment && licenseStatus?.license) ? (
              <div className="space-y-4" data-testid="section-license-information">
                <h3 className="text-lg font-semibold text-foreground">License Information</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  {isStripePayment && sessionData.metadata && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">License Type:</span>
                        <Badge variant="outline" className="capitalize" data-testid="badge-license-type">
                          {sessionData.metadata.licenseType}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Type:</span>
                        <span className="capitalize" data-testid="text-account-type">{sessionData.metadata.accountType}</span>
                      </div>
                      {sessionData.metadata.maxFacilities && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Facilities:</span>
                          <span data-testid="text-max-facilities">{sessionData.metadata.maxFacilities}</span>
                        </div>
                      )}
                      {sessionData.metadata.maxSeats && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Seats:</span>
                          <span data-testid="text-max-seats">{sessionData.metadata.maxSeats}</span>
                        </div>
                      )}
                      {sessionData.metadata.supportTier && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Support Tier:</span>
                          <span className="capitalize" data-testid="text-support-tier">{sessionData.metadata.supportTier}</span>
                        </div>
                      )}
                    </>
                  )}
                  {isMockPayment && licenseStatus?.license && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">License Type:</span>
                        <Badge variant="outline" className="capitalize" data-testid="badge-license-type">
                          {licenseStatus.license.tier}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Facilities:</span>
                        <span data-testid="text-max-facilities">{licenseStatus.license.maxFacilities}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seats:</span>
                        <span data-testid="text-max-seats">{licenseStatus.license.maxSeats}</span>
                      </div>
                      {licenseStatus.license.supportTier && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Support Tier:</span>
                          <span className="capitalize" data-testid="text-support-tier">{licenseStatus.license.supportTier}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="default" data-testid="badge-payment-status">
                          {licenseStatus.status}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link href="/licenses" className="flex-1">
                <Button className="w-full" data-testid="button-view-all-licenses">
                  <CreditCard className="h-4 w-4 mr-2" />
                  View All Licenses
                </Button>
              </Link>
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-go-to-dashboard">
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
              </Link>
            </div>

            {/* Additional Information */}
            {isPaymentSuccessful && (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your license is now active. You can manage your licenses, view usage, and purchase additional add-ons from the Licenses page.
                  </AlertDescription>
                </Alert>
                
                {/* Auto-redirect countdown */}
                {shouldRedirect && redirectCountdown > 0 && (
                  <Alert className="bg-primary/10 border-primary">
                    <ArrowRight className="h-4 w-4" />
                    <AlertDescription data-testid="text-redirect-countdown">
                      Redirecting to onboarding in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}