import { useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { AuthContext } from "@/contexts/AuthContext";
import TwoFactorVerify from "@/components/TwoFactorVerify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Verify2FA() {
  const authContext = useContext(AuthContext);
  const [, setLocation] = useLocation();

  if (!authContext) {
    throw new Error("Verify2FA must be used within an AuthProvider");
  }

  const { twoFactorRequired, isLoading, pendingUserEmail } = authContext;

  useEffect(() => {
    if (!isLoading && !twoFactorRequired) {
      // If 2FA is not required, redirect to dashboard
      setLocation("/dashboard");
    }
  }, [isLoading, twoFactorRequired, setLocation]);

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

  if (!twoFactorRequired) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Two-Factor Authentication
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Enter the verification code from your authenticator app to complete sign in.
            </p>
          </CardHeader>
          <CardContent>
            <TwoFactorVerify 
              userEmail={pendingUserEmail || ""}
              onSuccess={() => {
                // Redirect to dashboard after successful verification
                setLocation("/dashboard");
              }}
              onCancel={() => {
                // Return to login page
                setLocation("/login");
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}