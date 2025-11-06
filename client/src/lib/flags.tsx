// Client-side feature flag hooks and utilities
import { useQuery } from '@tanstack/react-query';
import { FeatureFlag } from '../../../shared/flags';

// Hook to check if a feature is enabled
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const { data: flags } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => fetch('/api/flags').then(res => res.json() as Promise<Record<FeatureFlag, boolean>>),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return (flags as Record<FeatureFlag, boolean> | undefined)?.[flag] ?? false;
}

// Hook to check if a feature is enabled with loading state
export function useFeatureFlagWithLoading(flag: FeatureFlag): { enabled: boolean; loading: boolean } {
  const { data: flags, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => fetch('/api/flags').then(res => res.json() as Promise<Record<FeatureFlag, boolean>>),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    enabled: flags?.[flag] ?? false,
    loading: isLoading
  };
}

// Hook to get all feature flags
export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const { data: flags } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => fetch('/api/flags').then(res => res.json() as Promise<Record<FeatureFlag, boolean>>),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return (flags as Record<FeatureFlag, boolean>) ?? {
    onboarding_v2: false,
    license_perpetual: false,
    multi_facility: false,
    exports_v2: false,
    evidence_pipeline: false,
    security_hardening: false,
    training_center: false,
    aws_s3_storage: false,
    enable_email_verification: false
  } as Record<FeatureFlag, boolean>;
}

// Component wrapper for feature-gated content
interface FeatureGateProps {
  flag: FeatureFlag;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);
  
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

// Higher-order component for feature-gated pages
export function withFeatureFlag<P extends object>(
  Component: React.ComponentType<P>,
  flag: FeatureFlag,
  fallback?: React.ComponentType<P>
) {
  return function FeatureFlaggedComponent(props: P) {
    const isEnabled = useFeatureFlag(flag);
    
    if (!isEnabled) {
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent {...props} />;
      }
      return (
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Feature Not Available</h2>
          <p className="text-foreground">
            This feature is currently not enabled for your account.
          </p>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
}

// Conditional rendering hook
export function useConditionalRender(flag: FeatureFlag) {
  const isEnabled = useFeatureFlag(flag);
  
  return {
    isEnabled,
    renderIf: (content: React.ReactNode) => isEnabled ? content : null,
    renderUnless: (content: React.ReactNode) => !isEnabled ? content : null
  };
}

// Debug component for development
export function FeatureFlagDebugger() {
  const flags = useFeatureFlags();
  
  if (import.meta.env.MODE !== 'development') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded-lg text-xs max-w-xs z-50">
      <h4 className="font-semibold mb-2">🚩 Feature Flags</h4>
      <div className="space-y-1">
        {Object.entries(flags).map(([flag, enabled]) => (
          <div key={flag} className="flex justify-between">
            <span className="truncate mr-2">{flag}</span>
            <span className={enabled ? 'text-green-400' : 'text-red-400'}>
              {enabled ? 'ON' : 'OFF'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Admin utilities for flag management
export const flagAdmin = {
  async toggleGlobalFlag(flag: FeatureFlag, value: boolean): Promise<void> {
    await fetch('/api/admin/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag, value })
    });
  },

  async toggleTenantFlag(tenantId: string, flag: FeatureFlag, value: boolean): Promise<void> {
    await fetch(`/api/admin/tenants/${tenantId}/flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag, value })
    });
  },

  async getGlobalFlags(): Promise<Record<FeatureFlag, boolean>> {
    const response = await fetch('/api/admin/flags');
    return response.json();
  },

  async getTenantFlags(tenantId: string): Promise<Record<FeatureFlag, boolean>> {
    const response = await fetch(`/api/admin/tenants/${tenantId}/flags`);
    return response.json();
  }
};