import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';
import { useFeatureFlag } from '@/lib/flags';

interface SetupGateProps {
  children: ReactNode;
}

/**
 * SetupGate - Industry-standard blocking gates for R2v3 certification platform
 * Enforces strict sequential flow: Email → Account Type → Payment → Onboarding → Assessment
 * 
 * Gate Sequence (per Industry_Aligned_Journey.md):
 * 1. Email verification (blocks everything until verified)
 * 2. Account type selection (Business vs Consultant)
 * 3. Pricing/Payment (license purchase required)
 * 4. Onboarding wizard (setup complete)
 * 5. Assessment activation (final gate to dashboard)
 */
function SetupGate({ children }: SetupGateProps) {
  const { user, isLoading } = useAuth();
  const [hasLicense, setHasLicense] = useState<boolean | null>(null);
  const [tenantType, setTenantType] = useState<string | null>(null);
  const isOnboardingV2Enabled = useFeatureFlag('onboarding_v2');

  useEffect(() => {
    const checkSystemStatus = async () => {
      if (!user) return;

      try {
        // Check license status
        const licenseResponse = await fetch('/api/licenses/status', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (licenseResponse.ok) {
          const licenseData = await licenseResponse.json();
          setHasLicense(licenseData.hasLicense && licenseData.status === 'active');
        } else {
          setHasLicense(false);
        }

        // Check tenant type (account type)
        const meResponse = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (meResponse.ok) {
          const meData = await meResponse.json();
          setTenantType(meData.tenant?.type || null);
        }
      } catch (error) {
        console.error('System status check failed:', error);
        setHasLicense(false);
        setTenantType(null);
      }
    };

    checkSystemStatus();
  }, [user]);

  if (isLoading || hasLicense === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900/20 to-green-900/20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verifying your setup status...</p>
        </div>
      </div>
    );
  }

  // No user authenticated - allow access to public routes
  if (!user) {
    return <>{children}</>;
  }

  console.log('SetupGate: User status check', {
    email: user.email,
    setupStatus: user.setupStatus,
    hasLicense,
    tenantType
  });

  // GATE 1: Email Verification (HIGHEST PRIORITY)
  // Block everything until email is verified - industry standard security requirement
  if (user.setupStatus === 'email_pending' || !user.emailVerified) {
    console.log('SetupGate: Email verification required, blocking access');
    return <Redirect to="/verify-email" />;
  }

  // GATE 2: Payment/License Requirement (Account type determined by plan selection)
  // Industry standard: No access without valid license
  if (!hasLicense) {
    console.log('SetupGate: Valid license required, redirecting to pricing');
    return <Redirect to="/pricing" />;
  }

  // GATE 4: Onboarding Completion
  // Setup wizard must be completed before dashboard access
  if (user.setupStatus === 'not_started' || user.setupStatus === 'setup_incomplete') {
    console.log('SetupGate: Onboarding incomplete, redirecting to setup wizard');
    const onboardingRoute = isOnboardingV2Enabled ? "/onboarding-v2" : "/onboarding";
    return <Redirect to={onboardingRoute} />;
  }

  // GATE 5: Assessment Activation
  // Final check - user must have assessment_active status for dashboard access
  if (user.setupStatus !== 'assessment_active') {
    console.log('SetupGate: Assessment not activated, completing activation');
    // For users who have completed setup but need assessment activation
    if (user.setupStatus === 'setup_complete') {
      // Auto-activate assessment if setup is complete and license is valid
      fetch('/api/auth/update-setup-status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ setupStatus: 'assessment_active' })
      }).catch(console.error);
      
      // Allow brief time for activation to complete, then allow access
      // The auth context will update and re-render with new status
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900/20 to-green-900/20">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Activating your assessment...</p>
          </div>
        </div>
      );
    }
    
    // If setup not complete and assessment not active, user needs to complete onboarding first
    console.log('SetupGate: Setup not complete, redirecting to onboarding');
    const onboardingRoute = isOnboardingV2Enabled ? "/onboarding-v2" : "/onboarding";
    return <Redirect to={onboardingRoute} />;
  }

  // All gates passed - allow access to protected routes
  console.log('SetupGate: All industry-standard gates passed, allowing dashboard access');
  return <>{children}</>;
}

export default SetupGate;