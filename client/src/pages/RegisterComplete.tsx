import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Award,
  CheckCircle,
  Loader2,
  AlertCircle
} from "lucide-react";

export default function RegisterComplete() {
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setErrors({ session: 'No payment session found. Please start the registration process again.' });
      setLoadingSession(false);
      return;
    }

    // Fetch session details to confirm payment
    fetch(`/api/stripe/session/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.payment_status === 'paid') {
          setSessionData(data);
        } else {
          setErrors({ session: 'Payment not confirmed. Please contact support.' });
        }
        setLoadingSession(false);
      })
      .catch(error => {
        console.error('Error fetching session:', error);
        setErrors({ session: 'Failed to verify payment. Please contact support.' });
        setLoadingSession(false);
      });
  }, [sessionId]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete registration');
      }

      const data = await response.json();
      
      // Store auth token
      localStorage.setItem('auth_token', data.token);
      
      // Redirect to onboarding
      setLocation("/onboarding");
    } catch (error) {
      console.error('Account setup error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Account setup failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying payment...</p>
        </div>
      </div>
    );
  }

  if (errors.session) {
    return (
      <div className="min-h-screen relative">
        <header className="nav-glass border-b border-glass-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 btn-primary-glass rounded-lg flex items-center justify-center">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-foreground">RuR2</span>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.session}</AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => setLocation("/register")}
            >
              Back to Registration
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <header className="nav-glass border-b border-glass-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 btn-primary-glass rounded-lg flex items-center justify-center">
                <Award className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">RuR2</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground mb-2">Payment Successful!</h1>
            <p className="text-lg text-muted-foreground">
              Your account has been created. Set your password to get started.
            </p>
            {sessionData?.customer_email && (
              <p className="text-sm text-muted-foreground mt-2">
                Account email: <span className="font-medium">{sessionData.customer_email}</span>
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Set Your Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={errors.password ? "border-red-500" : ""}
                    data-testid="input-password"
                  />
                  {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Must be at least 8 characters</p>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={errors.confirmPassword ? "border-red-500" : ""}
                    data-testid="input-confirm-password"
                  />
                  {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>
              </CardContent>
            </Card>

            {errors.submit && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.submit}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full btn-primary-glass" 
              disabled={isLoading}
              data-testid="button-complete-registration"
            >
              {isLoading ? "Setting up Account..." : "Complete Setup & Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
