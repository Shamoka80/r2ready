import { useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { AuthContext } from "@/contexts/AuthContext";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Setup2FA() {
  const authContext = useContext(AuthContext);
  const [, setLocation] = useLocation();

  if (!authContext) {
    throw new Error("Setup2FA must be used within an AuthProvider");
  }

  const { user, isLoading } = authContext;

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Set Up Two-Factor Authentication
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Secure your account with two-factor authentication. This is required for consultant accounts.
            </p>
          </CardHeader>
          <CardContent>
            <TwoFactorSetup 
              onComplete={() => {
                // Redirect to dashboard after successful setup
                setLocation("/dashboard");
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}