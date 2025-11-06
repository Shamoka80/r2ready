import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  ArrowLeft, 
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2
} from "lucide-react";

import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

interface VerifyEmailResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string | null;
    setupStatus: string;
    isActive: boolean;
  };
  tenant: {
    id: string;
    name: string;
    type: string;
    licenseStatus: string;
  };
  token: string;
  permissions: string[];
  expiresAt: string;
}

interface ResendEmailResponse {
  success: boolean;
  message: string;
}

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [resendEmail, setResendEmail] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Extract token from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Verify email mutation
  const verifyMutation = useMutation<VerifyEmailResponse, Error, string>({
    mutationFn: async (verificationToken: string) => {
      const response = await apiRequest('POST', '/api/auth/verify-email', { token: verificationToken });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify email');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      // Store auth token in localStorage (must match AuthContext key)
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('✅ Auth token stored after email verification');
      }
    },
    onError: (error: Error) => {
      console.error('Verification error:', error);
    }
  });


  // Resend verification email mutation
  const resendMutation = useMutation<ResendEmailResponse, Error, string>({
    mutationFn: async (email: string) => {
      const response = await apiRequest('POST', '/api/auth/send-verification-email', { email });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send verification email');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setResendSuccess(true);
      setErrors({});
      // Show recovery mode indicator if applicable
      if ((data as any).recoveryMode) {
        console.log('🔄 Account recovery mode activated - verification email resent');
      }
    },
    onError: (error: Error) => {
      console.error('Resend error:', error);
      
      // Provide helpful error messages
      let errorMessage = error.message || 'Failed to send verification email';
      
      // Handle specific error cases
      if (errorMessage.includes('Email already verified and setup complete')) {
        errorMessage = 'This email has already been verified. Try logging in instead.';
      } else if (errorMessage.includes('User not found')) {
        errorMessage = 'No account found with this email address. Please register first.';
      }
      
      setErrors({ resend: errorMessage });
      setResendSuccess(false);
    }
  });

  // Auto-verify on mount if token exists
  useEffect(() => {
    if (token && !verifyMutation.isPending && !verifyMutation.isSuccess && !verifyMutation.isError) {
      console.log('🔄 Auto-verifying with token from URL:', token);
      verifyMutation.mutate(token);
    }
  }, [token]);

  const handleResendSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const newErrors: { [key: string]: string } = {};
    if (!resendEmail.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(resendEmail)) {
      newErrors.email = "Email is invalid";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setResendSuccess(false);
    resendMutation.mutate(resendEmail);
  };

  const handleContinue = () => {
    // Ensure token is properly stored before navigation
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken && (successData?.token)) {
      localStorage.setItem('auth_token', successData.token);
    }

    // Industry Standard: Redirect to account type selection after email verification
    // Force a full page reload to ensure AuthContext re-initializes with the new token
    window.location.href = '/account-type-selection';
  };

  // Determine which state to show
  const isLoading = verifyMutation.isPending;
  const isSuccess = verifyMutation.isSuccess;
  const isError = verifyMutation.isError;
  const successData = verifyMutation.data;

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back Button + Logo */}
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="p-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
              <div className="flex items-center space-x-3">
                <img 
                  src={rurLogo} 
                  alt="RuR2 Logo" 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-glass logo-glow object-contain"
                />
                <span className="text-lg md:text-xl font-display font-bold text-glow-blue">RuR2</span>
              </div>
            </div>

            {/* Mobile Navigation */}
            <MobileNavigation
              navigationItems={[
                { label: "Home", href: "/" },
                { label: "About", href: "/about" },
                { label: "Help", href: "/help" },
              ]}
              showAuth={false}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="space-y-3 text-center px-4 sm:px-6">
              <div className="flex justify-center mb-4 sm:mb-6">
                {isLoading && (
                  <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin text-primary" />
                )}
                {isSuccess && (
                  <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500" />
                )}
                {(isError || !token) && !isLoading && !isSuccess && (
                  <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground" />
                )}
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold">
                {isLoading && "Verifying Email..."}
                {isSuccess && "Email Verified!"}
                {isError && "Verification Link Invalid"}
                {!token && !isLoading && !isSuccess && "Check Your Email"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              {/* Loading State */}
              {isLoading && (
                <div className="text-center">
                  <p className="text-muted-foreground" data-testid="text-verification-status">
                    Please wait while we verify your email address...
                  </p>
                </div>
              )}

              {/* Success State */}
              {isSuccess && successData && (
                <div className="space-y-4">
                  <Alert data-testid="alert-success" className="border-green-500 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-600 dark:text-green-400" data-testid="text-verification-status">
                      Email verified successfully!
                    </AlertDescription>
                  </Alert>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Welcome, <strong data-testid="text-user-firstname">{successData.user.firstName}</strong>!
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-user-email">
                      {successData.user.email}
                    </p>
                  </div>

                  <Button 
                    onClick={handleContinue}
                    className="w-full btn-primary-glass min-h-[48px] text-base font-medium"
                    data-testid="button-continue"
                  >
                    Continue Setup
                  </Button>
                </div>
              )}

              {/* Error State - Invalid/Expired Link */}
              {isError && !isLoading && !isSuccess && (
                <div className="space-y-4">
                  <Alert data-testid="alert-error" className="border-destructive bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive" data-testid="text-verification-status">
                      {verifyMutation.error?.message || "Invalid or expired verification link"}
                    </AlertDescription>
                  </Alert>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Please request a new verification email
                    </p>
                  </div>

                  {/* Resend Success Message */}
                  {resendSuccess && (
                    <Alert data-testid="alert-resend-success" className="border-green-500 bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-green-600 dark:text-green-400">
                        Verification email sent! Check your inbox.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Resend Form */}
                  <form onSubmit={handleResendSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="resend-email" className="text-foreground text-sm sm:text-base">
                        Email Address
                      </Label>
                      <Input
                        id="resend-email"
                        type="email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className={errors.email ? "border-red-500 input-glass min-h-[48px] text-base" : "input-glass min-h-[48px] text-base"}
                        placeholder="Enter your email"
                        data-testid="input-resend-email"
                      />
                      {errors.email && <p className="text-sm text-red-500 mt-1" data-testid="text-email-error">{errors.email}</p>}
                    </div>

                    {errors.resend && (
                      <Alert data-testid="alert-resend-error">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errors.resend}</AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full btn-primary-glass min-h-[48px] text-base font-medium"
                      disabled={resendMutation.isPending}
                      data-testid="button-resend"
                    >
                      {resendMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend Verification Email"
                      )}
                    </Button>
                  </form>
                </div>
              )}

              {/* Waiting State - No Token in URL */}
              {!token && !isLoading && !isSuccess && !isError && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4" data-testid="text-verification-status">
                      We've sent a verification link to your email address. Please click the link to verify your account.
                    </p>
                  </div>

                  {/* Resend Success Message */}
                  {resendSuccess && (
                    <Alert data-testid="alert-resend-success" className="border-green-500 bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-green-600 dark:text-green-400">
                        Verification email sent! Check your inbox.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Didn't receive the email?
                    </p>
                  </div>

                  {/* Resend Form */}
                  <form onSubmit={handleResendSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="resend-email-waiting" className="text-foreground text-sm sm:text-base">
                        Email Address
                      </Label>
                      <Input
                        id="resend-email-waiting"
                        type="email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className={errors.email ? "border-red-500 input-glass min-h-[48px] text-base" : "input-glass min-h-[48px] text-base"}
                        placeholder="Enter your email"
                        data-testid="input-resend-email"
                      />
                      {errors.email && <p className="text-sm text-red-500 mt-1" data-testid="text-email-error">{errors.email}</p>}
                    </div>

                    {errors.resend && (
                      <Alert data-testid="alert-resend-error">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errors.resend}</AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full btn-secondary-glass min-h-[48px] text-base font-medium"
                      disabled={resendMutation.isPending}
                      data-testid="button-resend"
                    >
                      {resendMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend Verification Email"
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}