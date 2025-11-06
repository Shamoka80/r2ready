import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  ArrowLeft, 
  AlertCircle
} from "lucide-react";

import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

export default function Register() {
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    phone: "",
    agreeToTerms: false
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const newErrors: { [key: string]: string } = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    if (!formData.companyName.trim()) newErrors.companyName = "Company name is required";
    if (!formData.agreeToTerms) newErrors.terms = "You must agree to the terms of service";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: formData.companyName,
          tenantType: "BUSINESS", // Default, will be updated after email verification
          ownerEmail: formData.email,
          ownerFirstName: formData.firstName,
          ownerLastName: formData.lastName,
          ownerPassword: formData.password,
          domain: undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      // Save only email to sessionStorage for email verification flow
      sessionStorage.setItem('registrationEmail', formData.email);

      // Redirect to email sent confirmation page
      setLocation('/register/email-sent');
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Registration failed. Please try again.' });
      setIsLoading(false);
    }
  };

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
                { label: "Pricing", href: "/pricing" }
              ]}
              showAuth={false}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">Create Your Account</h1>
            <p className="text-lg text-muted-foreground">Get started with professional R2v3 certification</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className={errors.firstName ? "border-red-500" : ""}
                      data-testid="input-first-name"
                    />
                    {errors.firstName && <p className="text-sm text-red-500 mt-1" data-testid="error-first-name">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className={errors.lastName ? "border-red-500" : ""}
                      data-testid="input-last-name"
                    />
                    {errors.lastName && <p className="text-sm text-red-500 mt-1" data-testid="error-last-name">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={errors.email ? "border-red-500" : ""}
                    data-testid="input-email"
                  />
                  {errors.email && <p className="text-sm text-red-500 mt-1" data-testid="error-email">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={errors.password ? "border-red-500" : ""}
                    placeholder="Minimum 8 characters"
                    data-testid="input-password"
                  />
                  {errors.password && <p className="text-sm text-red-500 mt-1" data-testid="error-password">{errors.password}</p>}
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={errors.confirmPassword ? "border-red-500" : ""}
                    placeholder="Re-enter your password"
                    data-testid="input-confirm-password"
                  />
                  {errors.confirmPassword && <p className="text-sm text-red-500 mt-1" data-testid="error-confirm-password">{errors.confirmPassword}</p>}
                </div>

                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className={errors.companyName ? "border-red-500" : ""}
                    data-testid="input-company-name"
                  />
                  {errors.companyName && <p className="text-sm text-red-500 mt-1" data-testid="error-company-name">{errors.companyName}</p>}
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Terms and Submit */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={formData.agreeToTerms}
                  onCheckedChange={(checked) => setFormData({ ...formData, agreeToTerms: checked as boolean })}
                  data-testid="checkbox-terms"
                />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the <Button variant="link" className="px-2 py-3 text-primary" style={{ minHeight: '44px' }}>Terms of Service</Button> and{" "}
                  <Button variant="link" className="px-2 py-3 text-primary" style={{ minHeight: '44px' }}>Privacy Policy</Button>
                </Label>
              </div>
              {errors.terms && <p className="text-sm text-red-500" data-testid="error-terms">{errors.terms}</p>}

              {errors.submit && (
                <Alert data-testid="alert-submit-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.submit}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full btn-primary-glass" 
                disabled={isLoading}
                data-testid="button-create-account"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                After creating your account, you'll receive an email to verify your address.
                Once verified, you can select your account type and pricing plan.
              </p>

              <div className="text-center">
                <span className="text-sm text-muted-foreground">Already have an account? </span>
                <Button 
                  variant="link" 
                  className="px-2 py-3 text-primary"
                  style={{ minHeight: '44px' }}
                  onClick={() => setLocation("/login")}
                >
                  Sign in
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}