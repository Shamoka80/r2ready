import { useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { AuthContext } from "@/contexts/AuthContext";
import DeviceManagement from "@/components/DeviceManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Smartphone, Key } from "lucide-react";

export default function AccountSecurity() {
  const authContext = useContext(AuthContext);
  const [, setLocation] = useLocation();

  if (!authContext) {
    throw new Error("AccountSecurity must be used within an AuthProvider");
  }

  const { user, isLoading, twoFactorStatus, getTwoFactorStatus } = authContext;

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  // Fetch 2FA status when component mounts
  useEffect(() => {
    if (user && getTwoFactorStatus) {
      getTwoFactorStatus().catch(console.error);
    }
  }, [user, getTwoFactorStatus]);

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
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Account Security
        </h1>
        <p className="text-muted-foreground">
          Manage your security settings, two-factor authentication, and trusted devices.
        </p>
      </div>

      {/* Two-Factor Authentication Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {twoFactorStatus?.enabled ? "Enabled" : "Disabled"}
              </p>
              <p className="text-sm text-muted-foreground">
                {twoFactorStatus?.enabled 
                  ? `You have ${twoFactorStatus.backupCodesCount || 0} backup codes remaining.`
                  : "Secure your account with two-factor authentication."
                }
              </p>
            </div>
            <div className="flex gap-2">
              {!twoFactorStatus?.enabled && (
                <button
                  onClick={() => setLocation("/setup-2fa")}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  data-testid="button-setup-2fa"
                >
                  Enable 2FA
                </button>
              )}
              {twoFactorStatus?.enabled && (
                <button
                  onClick={() => setLocation("/setup-2fa")}
                  className="px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors"
                  data-testid="button-manage-2fa"
                >
                  Manage 2FA
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Device Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Trusted Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeviceManagement />
        </CardContent>
      </Card>
    </div>
  );
}