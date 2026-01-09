import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  ArrowLeft, 
  Key,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Users,
  Mail
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

interface InvitationData {
  valid: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    tenantType: string;
  };
}

export default function AcceptInvitation() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: "" });

  // Extract token from URL on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      verifyInvitation(urlToken);
    } else {
      setError("Invalid or missing invitation token.");
      setIsVerifying(false);
    }
  }, []);

  const verifyInvitation = async (invitationToken: string) => {
    setIsVerifying(true);
    setError("");
    try {
      const response = await fetch(`/api/team/invitation/${invitationToken}`);
      const data = await response.json();

      if (response.ok && data.valid) {
        setInvitationData(data);
      } else {
        if (data.expired) {
          setError("This invitation link has expired. Please contact your administrator for a new invitation.");
        } else if (data.alreadyAccepted) {
          setError("This invitation has already been accepted. Please log in instead.");
        } else {
          setError(data.error || "Invalid invitation token.");
        }
      }
    } catch (err) {
      console.error("Verify invitation error:", err);
      setError("Failed to verify invitation. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const checkPasswordStrength = (pwd: string) => {
    let score = 0;
    let feedback = "";

    if (pwd.length >= 8) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score += 1;

    switch (score) {
      case 0:
      case 1:
        feedback = "Very weak";
        break;
      case 2:
        feedback = "Weak";
        break;
      case 3:
        feedback = "Fair";
        break;
      case 4:
        feedback = "Good";
        break;
      case 5:
        feedback = "Strong";
        break;
    }

    return { score, feedback };
  };

  useEffect(() => {
    if (password) {
      setPasswordStrength(checkPasswordStrength(password));
    } else {
      setPasswordStrength({ score: 0, feedback: "" });
    }
  }, [password]);

  const validateForm = () => {
    if (!token) {
      setError("Invitation token is missing");
      return false;
    }

    if (!password) {
      setError("Password is required");
      return false;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/team/accept-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Automatically log in the user
        if (data.authToken) {
          login(data.authToken, data.user, data.tenant, data.permissions);
        }
        setIsSuccess(true);
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          setLocation("/dashboard");
        }, 2000);
      } else {
        if (data.expired) {
          setError("This invitation link has expired. Please contact your administrator for a new invitation.");
        } else if (data.alreadyAccepted) {
          setError("This invitation has already been accepted. Please log in instead.");
        } else {
          setError(data.error || "Failed to accept invitation. Please try again.");
        }
      }
    } catch (err) {
      console.error("Accept invitation error:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrengthColor = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return "text-red-600";
      case 2:
        return "text-orange-600";
      case 3:
        return "text-yellow-600";
      case 4:
        return "text-blue-600";
      case 5:
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen relative">
        {/* Header */}
        <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <img 
                  src={rurLogo} 
                  alt="RuR2 Logo" 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-glass logo-glow object-contain"
                />
                <span className="text-lg md:text-xl font-display font-bold text-glow-blue">RuR2</span>
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
                <CardTitle className="text-xl sm:text-2xl font-bold text-glow-blue">Welcome to the Team!</CardTitle>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Your account has been activated successfully. Redirecting you to the dashboard...
                </p>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="text-center">
                  <Button 
                    className="w-full btn-primary-glass min-h-[48px] text-base font-medium"
                    onClick={() => setLocation("/dashboard")}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen relative">
        {/* Header */}
        <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src={rurLogo} 
                  alt="RuR2 Logo" 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-glass logo-glow object-contain"
                />
                <span className="text-lg md:text-xl font-display font-bold text-glow-blue">RuR2</span>
              </div>
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
              <CardContent className="px-4 sm:px-6 py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Verifying invitation...</p>
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
          {invitationData && (
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                You're Invited!
              </h1>
              <p className="text-muted-foreground mb-4">
                {invitationData.user.firstName} {invitationData.user.lastName}
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <Mail className="h-4 w-4" />
                <span>{invitationData.user.email}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Join <strong>{invitationData.tenant.name}</strong> as <strong>{invitationData.user.role}</strong>
              </p>
            </div>
          )}

          <Card>
            <CardHeader className="space-y-3 text-center px-4 sm:px-6">
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <Key className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-glow-blue">Set Your Password</CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground">
                Create a secure password to complete your account setup
              </p>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password" className="text-foreground text-sm sm:text-base">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={error ? "border-red-500 pr-10 input-glass min-h-[48px] text-base" : "pr-10 input-glass min-h-[48px] text-base"}
                      placeholder="Enter password"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {password && (
                    <p className={`text-sm mt-1 ${getPasswordStrengthColor(passwordStrength.score)}`}>
                      Password strength: {passwordStrength.feedback}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-foreground text-sm sm:text-base">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={error ? "border-red-500 pr-10 input-glass min-h-[48px] text-base" : "pr-10 input-glass min-h-[48px] text-base"}
                      placeholder="Confirm password"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full btn-primary-glass min-h-[48px] text-base font-medium" 
                  disabled={isLoading || !token}
                >
                  {isLoading ? "Accepting Invitation..." : "Accept Invitation & Set Password"}
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

