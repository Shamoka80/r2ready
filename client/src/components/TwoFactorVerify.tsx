import { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthContext } from "@/contexts/AuthContext";
import { 
  Shield, 
  Smartphone, 
  Key,
  AlertCircle,
  RefreshCw,
  ArrowLeft
} from "lucide-react";

interface TwoFactorVerifyProps {
  userEmail: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
  onUseBackupCode?: () => void;
}

export default function TwoFactorVerify({ userEmail, onSuccess, onCancel, onUseBackupCode }: TwoFactorVerifyProps) {
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error("TwoFactorVerify must be used within an AuthProvider");
  }

  const { verifyTwoFactor } = authContext;

  const handleVerify = async () => {
    if (!code.trim()) {
      setError(mode === 'totp' ? 'Please enter the 6-digit code' : 'Please enter a backup code');
      return;
    }

    if (mode === 'totp' && code.length !== 6) {
      setError('Code must be 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await verifyTwoFactor(code);
      // If verification successful, AuthContext handles token management
      onSuccess(''); // Success callback doesn't need token since AuthContext manages it
    } catch (err) {
      setAttempts(prev => prev + 1);
      setError(err instanceof Error ? err.message : 'Verification failed');
      setCode(''); // Clear the code on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    if (mode === 'totp') {
      // Only allow digits for TOTP
      const digits = value.replace(/\D/g, '').slice(0, 6);
      setCode(digits);
    } else {
      // Allow alphanumeric for backup codes
      const alphanumeric = value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
      setCode(alphanumeric);
    }
    setError(''); // Clear error when user types
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <p className="text-sm text-foreground mt-2">
          Enter the verification code to complete sign in
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Mode Toggle */}
        <div className="flex space-x-2 p-1 bg-muted rounded-lg">
          <Button
            variant={mode === 'totp' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('totp')}
            className="flex-1"
            data-testid="totp-mode-button"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            Authenticator
          </Button>
          <Button
            variant={mode === 'backup' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('backup')}
            className="flex-1"
            data-testid="backup-mode-button"
          >
            <Key className="h-4 w-4 mr-2" />
            Backup Code
          </Button>
        </div>

        {/* Input Section */}
        <div className="space-y-3">
          {mode === 'totp' ? (
            <>
              <Label htmlFor="totp-code">6-digit code from your authenticator app</Label>
              <Input
                id="totp-code"
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="000000"
                className="text-center text-lg font-mono tracking-wider"
                maxLength={6}
                data-testid="totp-code-input"
                autoFocus
              />
              <p className="text-xs text-foreground text-center">
                Open your authenticator app and enter the current 6-digit code
              </p>
            </>
          ) : (
            <>
              <Label htmlFor="backup-code">Backup recovery code</Label>
              <Input
                id="backup-code"
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                className="text-center font-mono"
                data-testid="backup-code-input"
                autoFocus
              />
              <p className="text-xs text-foreground text-center">
                Enter one of your saved backup codes (this will be consumed)
              </p>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Too Many Attempts Warning */}
        {attempts >= 3 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Multiple failed attempts detected. Please ensure you're using the correct code or try a backup code.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={handleVerify}
            disabled={isLoading || !code.trim() || (mode === 'totp' && code.length !== 6)}
            className="w-full bg-blue-600 hover:bg-blue-700"
            data-testid="verify-button"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Sign In'
            )}
          </Button>

          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="flex-1"
              data-testid="cancel-button"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
            
            {mode === 'totp' && onUseBackupCode && (
              <Button 
                variant="link" 
                onClick={() => setMode('backup')}
                className="flex-1 text-sm"
                data-testid="use-backup-code-button"
              >
                Lost your device?
              </Button>
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-foreground bg-muted/50 p-3 rounded border">
          <p className="font-medium mb-1">Having trouble?</p>
          <ul className="space-y-1">
            <li>• Make sure your device's time is correct</li>
            <li>• Try refreshing your authenticator app</li>
            <li>• Use a backup code if your device is unavailable</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}