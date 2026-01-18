import { useState } from "react";
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
  Mail,
  CheckCircle,
  AlertCircle
} from "lucide-react";

import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

interface ResendEmailResponse {
  success: boolean;
  message: string;
}

export default function RegisterEmailSent() {
  const [, setLocation] = useLocation();
  const [resendEmail, setResendEmail] = useState(() => {
    return sessionStorage.getItem('registrationEmail') || '';
  });
  const [resendSuccess, setResendSuccess] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
    onSuccess: () => {
      setResendSuccess(true);
      setErrors({});
    },
    onError: (error: Error) => {
      console.error('Resend error:', error);
      setErrors({ resend: error.message || 'Failed to send verification email' });
      setResendSuccess(false);
    }
  });

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

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back Button + Logo */}
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLocation("/")} 
                className="p-2"
                data-testid="button-back"
              >
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
        <div className="max-w-2xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <Mail className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4" data-testid="text-page-title">
              Check Your Email
            </h1>
            <p className="text-lg text-muted-foreground" data-testid="text-page-subtitle">
              We've sent a verification link to your email address
            </p>
          </div>

          {/* Main Card */}
          <Card>
            <CardHeader className="space-y-3 text-center px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl font-bold">
                Email Verification Sent
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Click the link in your email to verify your account and continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-4 sm:px-6">
              {/* Instructions */}
              <div className="space-y-4">
                <Alert className="bg-blue-950/80 dark:bg-blue-950/80 border-blue-800" data-testid="alert-instructions">
                  <CheckCircle className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-100">
                    <strong>Next steps:</strong>
                    <ol className="list-decimal ml-5 mt-2 space-y-1">
                      <li>Check your inbox for an email from RuR2</li>
                      <li>Click the verification link in the email</li>
                      <li>Complete your account setup</li>
                      <li>Select your plan and complete payment</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <p className="text-sm text-muted-foreground text-center" data-testid="text-email-hint">
                  Didn't receive the email? Check your spam folder or request a new one below.
                </p>
              </div>

              {/* Resend Email Section */}
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Resend Verification Email</h3>
                
                <form onSubmit={handleResendSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="resendEmail">Email Address</Label>
                    <Input
                      id="resendEmail"
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="Enter your email"
                      className={errors.email ? "border-red-500" : ""}
                      data-testid="input-resend-email"
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500 mt-1" data-testid="error-resend-email">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {resendSuccess && (
                    <Alert className="bg-green-950/80 dark:bg-green-950/80 border-green-800" data-testid="alert-resend-success">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-100">
                        Verification email sent successfully! Please check your inbox.
                      </AlertDescription>
                    </Alert>
                  )}

                  {errors.resend && (
                    <Alert variant="destructive" data-testid="alert-resend-error">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.resend}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={resendMutation.isPending}
                    data-testid="button-resend-email"
                  >
                    {resendMutation.isPending ? "Sending..." : "Resend Verification Email"}
                  </Button>
                </form>
              </div>

              {/* Additional Actions */}
              <div className="border-t pt-6 space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  Already verified your email?
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setLocation("/login")}
                  data-testid="button-goto-login"
                >
                  Go to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
