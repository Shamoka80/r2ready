import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FeatureFlags {
  multiTenantWorkflows: boolean;
  enhancedRBAC: boolean;
  advancedAnalytics: boolean;
  intakeToAssessmentFlow: boolean;
  facilityMultiSelect: boolean;
  consultantDashboard: boolean;
  auditTrail: boolean;
  dataBackup: boolean;
}

interface FeatureFlagContextType {
  flags: FeatureFlags;
  isEnabled: (flag: keyof FeatureFlags) => boolean;
  refreshFlags: () => Promise<void>;
}

const defaultFlags: FeatureFlags = {
  multiTenantWorkflows: false,
  enhancedRBAC: false,
  advancedAnalytics: false,
  intakeToAssessmentFlow: true,
  facilityMultiSelect: false,
  consultantDashboard: false,
  auditTrail: true,
  dataBackup: false,
};

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);

  const refreshFlags = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('/api/feature-flags', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFlags(data.flags);
      }
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      // Fallback to default flags on error
      setFlags(defaultFlags);
    }
  };

  const isEnabled = (flag: keyof FeatureFlags): boolean => {
    return flags[flag] || false;
  };

  useEffect(() => {
    refreshFlags();
  }, []);

  const value: FeatureFlagContextType = {
    flags,
    isEnabled,
    refreshFlags,
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export const useFeatureFlags = (): FeatureFlagContextType => {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};