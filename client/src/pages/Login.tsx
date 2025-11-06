import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  ArrowLeft, 
  Award,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";

import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
      
      // Check if user has a saved location to return to, otherwise go to dashboard
      const lastLocation = localStorage.getItem('lastLocation');
      if (lastLocation && lastLocation !== '/' && lastLocation !== '/login') {
        localStorage.removeItem('lastLocation'); // Clean up after use
        setLocation(lastLocation);
      } else {
        setLocation("/dashboard");
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Invalid email or password. Please try again.' });
    } finally {
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
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="min-h-[44px] min-w-[44px] p-2">
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
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">Welcome Back</h1>
            <p className="text-lg text-muted-foreground">Sign in to your RuR2 account</p>
          </div>

          <Card>
            <CardHeader className="space-y-3 text-center px-4 sm:px-6">
              <div className="flex justify-center mb-4 sm:mb-6">
                <img src={rurLogo} alt="RuR2 Logo" className="w-12 h-12 sm:w-16 sm:h-16 rounded-glass logo-glow" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-glow-blue">Welcome Back</CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground">
                Sign in to your RuR2 account
              </p>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-foreground text-sm sm:text-base">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={errors.email ? "border-red-500 input-glass min-h-[48px] text-base" : "input-glass min-h-[48px] text-base"}
                    placeholder="Enter your email"
                  />
                  {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="password" className="text-foreground text-sm sm:text-base">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={errors.password ? "border-red-500 pr-10 input-glass min-h-[48px] text-base" : "pr-10 input-glass min-h-[48px] text-base"}
                      placeholder="Enter your password"
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
                  {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={formData.rememberMe}
                      onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <Label htmlFor="rememberMe" className="text-sm text-muted-foreground">
                      Remember me
                    </Label>
                  </div>
                  <Button 
                    variant="link" 
                    className="px-2 py-3 text-primary text-sm"
                    style={{ minHeight: '44px' }}
                    onClick={() => setLocation("/forgot-password")}
                  >
                    Forgot password?
                  </Button>
                </div>

                {errors.submit && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.submit}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full btn-primary-glass min-h-[48px] text-base font-medium" 
                  disabled={isLoading}
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>

                <div className="space-y-3">
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Don't have an account? </span>
                    <Button 
                      variant="link" 
                      className="px-2 py-3 text-primary"
                      style={{ minHeight: '44px' }}
                      onClick={() => setLocation("/register")}
                    >
                      Create one
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}