// Server-side feature flag helpers
import { flagService, FeatureFlag, FlagContext } from '../../shared/flags.js';

// Express middleware for feature flag context
export function flagsMiddleware(req: any, res: any, next: any) {
  // Extract context from request
  const context: FlagContext = {
    tenantId: req.user?.tenantId || req.session?.tenantId,
    userId: req.user?.id || req.session?.userId,
    userRole: req.user?.businessRole || req.user?.consultantRole,
    planType: req.user?.planName,
    metadata: {
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  };

  // Add flag service to request
  req.flags = {
    async isEnabled(flag: FeatureFlag): Promise<boolean> {
      return await flagService.isEnabled(flag, context);
    },

    async getFlags(): Promise<Record<FeatureFlag, boolean>> {
      return await flagService.getFlags(context);
    },

    context
  };

  next();
}

// Route guards for feature flags
export function requireFlag(flag: FeatureFlag) {
  return async (req: any, res: any, next: any) => {
    try {
      const enabled = await req.flags.isEnabled(flag);
      if (!enabled) {
        return res.status(403).json({
          error: 'Feature not available',
          code: 'FEATURE_DISABLED',
          flag
        });
      }
      next();
    } catch (error) {
      console.error('Error checking feature flag:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Conditional execution based on flags
export async function withFlag<T>(
  flag: FeatureFlag,
  context: FlagContext,
  ifEnabled: () => Promise<T> | T,
  ifDisabled?: () => Promise<T> | T
): Promise<T | null> {
  const enabled = await flagService.isEnabled(flag, context);

  if (enabled) {
    return await ifEnabled();
  } else if (ifDisabled) {
    return await ifDisabled();
  }

  return null;
}

// Admin API for flag management
export class FlagAdminAPI {
  // Get all flags and their current values
  static async getGlobalFlags(): Promise<Record<FeatureFlag, boolean>> {
    return await flagService.getFlags();
  }

  // Set global flag
  static async setGlobalFlag(flag: FeatureFlag, value: boolean): Promise<void> {
    if (value) {
      await flagService.enable(flag);
    } else {
      await flagService.disable(flag);
    }
  }

  // Get tenant flags
  static async getTenantFlags(tenantId: string): Promise<Record<FeatureFlag, boolean>> {
    return await flagService.getFlags({ tenantId });
  }

  // Set tenant flag override
  static async setTenantFlag(tenantId: string, flag: FeatureFlag, value: boolean): Promise<void> {
    if (value) {
      await flagService.enable(flag, { tenantId });
    } else {
      await flagService.disable(flag, { tenantId });
    }
  }

  // Bulk enable flags for internal tenants (dark launch)
  static async enableForInternalTenants(flags: FeatureFlag[], internalTenantIds: string[]): Promise<void> {
    for (const tenantId of internalTenantIds) {
      for (const flag of flags) {
        await flagService.enable(flag, { tenantId });
      }
    }
  }

  // Gradual rollout - enable for percentage of tenants
  static async enableForPercentage(flag: FeatureFlag, percentage: number, tenantIds: string[]): Promise<void> {
    const targetCount = Math.floor(tenantIds.length * (percentage / 100));
    const selectedTenants = tenantIds.slice(0, targetCount);

    for (const tenantId of selectedTenants) {
      await flagService.enable(flag, { tenantId });
    }
  }
}

// Development helpers
export const devFlags = {
  // Enable all flags for development
  async enableAll(): Promise<void> {
    const flags: FeatureFlag[] = [
      'onboarding_v2',
      'license_perpetual',
      'multi_facility',
      'exports_v2',
      'evidence_pipeline',
      'security_hardening',
      'training_center',
      'aws_s3_storage',
      'enable_email_verification'
    ];

    for (const flag of flags) {
      await flagService.enable(flag);
    }
    console.log('🚩 All feature flags enabled for development');
  },

  // Reset all flags to defaults
  async resetAll(): Promise<void> {
    const flags: FeatureFlag[] = [
      'onboarding_v2',
      'license_perpetual',
      'multi_facility',
      'exports_v2',
      'evidence_pipeline',
      'security_hardening',
      'training_center',
      'aws_s3_storage',
      'enable_email_verification'
    ];

    for (const flag of flags) {
      await flagService.disable(flag);
    }
    console.log('🚩 All feature flags reset to defaults');
  }
};