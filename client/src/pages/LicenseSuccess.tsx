import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { CheckCircle, ArrowRight, CreditCard, Home, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { apiGet } from "@/api";
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

  // Fetch session data from Stripe
  const { 
    data: sessionData, 
    isLoading: sessionLoading, 
    error: sessionError 
  } = useQuery<SessionData>({
    queryKey: ['stripe-session', sessionId],
    queryFn: () => apiGet(`/api/stripe/session/${sessionId}`),
    enabled: !!sessionId,
  });

  // Fetch updated licenses to confirm creation
  const { 
    data: licenses = [], 
    isLoading: licensesLoading,
    refetch: refetchLicenses 
  } = useQuery<License[]>({
    queryKey: ['licenses'],
    queryFn: () => apiGet('/api/licenses'),
    enabled: !!sessionData && sessionData.payment_status === 'paid',
  });

  // Auto-redirect countdown after successful payment
  useEffect(() => {
    if (sessionData && sessionData.payment_status === 'paid' && !shouldRedirect) {
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
  }, [sessionData, shouldRedirect, setLocation]);

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

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-professional flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Invalid Session</h2>
            <p className="text-muted-foreground mb-6">No payment session found. Please try your purchase again.</p>
            <Link href="/licenses">
              <Button className="w-full">
                <ArrowRight className="h-4 w-4 mr-2" />
                Go to Licenses
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-professional flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jade mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Processing Payment</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionError || !sessionData) {
    return (
      <div className="min-h-screen bg-gradient-professional flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Payment Error</h2>
            <p className="text-muted-foreground mb-6">
              There was an error processing your payment. Please contact support if you've been charged.
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

  const isPaymentSuccessful = sessionData.payment_status === 'paid';
  const isMockPayment = sessionData.metadata?.mockPayment === 'true';

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
                    {isMockPayment && (
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
            {/* Payment Details */}
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

            {/* License Information */}
            {sessionData.metadata && (
              <div className="space-y-4" data-testid="section-license-information">
                <h3 className="text-lg font-semibold text-foreground">License Information</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
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
                </div>
              </div>
            )}

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