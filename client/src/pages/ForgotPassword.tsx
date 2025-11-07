
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  ArrowLeft, 
  Mail,
  AlertCircle,
  CheckCircle
} from "lucide-react";

import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        setError(data.error || "Failed to send reset email. Please try again.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen relative">
        {/* Header */}
        <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Back Button + Logo */}
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} className="min-h-[44px] min-w-[44px] p-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back to Login</span>
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
                  { label: "Pricing", href: "/pricing" }
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
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-glow-blue">Check Your Email</CardTitle>
                <p className="text-sm sm:text-base text-muted-foreground">
                  If an account with that email exists, you'll receive a password reset link shortly.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Email sent to: {email}</span>
                  </div>
                  
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      The reset link will expire in 15 minutes. Check your spam folder if you don't see the email.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setIsSubmitted(false)}
                    >
                      Send to Different Email
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => setLocation("/login")}
                    >
                      Back to Login
                    </Button>
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
      <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back Button + Logo */}
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} className="min-h-[44px] min-w-[44px] p-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to Login</span>
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
                { label: "Pricing", href: "/pricing" }
              ]}
              showAuth={false}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">Forgot Password</h1>
            <p className="text-lg text-muted-foreground">
              Enter your email and we'll send you a link to reset your password
            </p>
          </div>

          <Card>
            <CardHeader className="space-y-3 text-center px-4 sm:px-6">
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <Mail className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-glow-blue">Reset Password</CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground">
                We'll email you a secure link to reset your password
              </p>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-foreground text-sm sm:text-base">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={error ? "border-red-500 input-glass min-h-[48px] text-base" : "input-glass min-h-[48px] text-base"}
                    placeholder="Enter your email address"
                    disabled={isLoading}
                  />
                  {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
                </div>

                <Button 
                  type="submit" 
                  className="w-full btn-primary-glass min-h-[48px] text-base font-medium" 
                  disabled={isLoading}
                >
                  {isLoading ? "Sending Reset Link..." : "Send Reset Link"}
                </Button>

                <div className="text-center">
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="px-2 py-3 text-sm"
                    onClick={() => setLocation("/login")}
                  >
                    Back to Login
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
