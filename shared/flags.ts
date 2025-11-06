// Feature Flag System
// Provides server-side and client-side feature flag management with per-tenant overrides

export type FeatureFlag = 
  | 'onboarding_v2'
  | 'license_perpetual' 
  | 'multi_facility'
  | 'exports_v2'
  | 'evidence_pipeline'
  | 'security_hardening'
  | 'training_center'
  | 'aws_s3_storage'
  | 'enable_email_verification';

export interface FeatureFlagConfig {
  name: FeatureFlag;
  description: string;
  defaultValue: boolean;
  scope: 'global' | 'per-tenant' | 'per-user';
  rolloutStrategy?: 'percentage' | 'whitelist' | 'gradual';
}

// Feature flag definitions matching CONTROL_PLANE.md
export const FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  onboarding_v2: {
    name: 'onboarding_v2',
    description: 'New role-based onboarding wizard',
    defaultValue: true,
    scope: 'per-tenant',
    rolloutStrategy: 'gradual'
  },
  license_perpetual: {
    name: 'license_perpetual',
    description: 'One-time purchase licensing model',
    defaultValue: false,
    scope: 'global',
    rolloutStrategy: 'percentage'
  },
  multi_facility: {
    name: 'multi_facility',
    description: 'Multiple facility management',
    defaultValue: false,
    scope: 'per-user',
    rolloutStrategy: 'whitelist'
  },
  exports_v2: {
    name: 'exports_v2',
    description: 'Versioned export templates with validation',
    defaultValue: false,
    scope: 'per-tenant',
    rolloutStrategy: 'gradual'
  },
  evidence_pipeline: {
    name: 'evidence_pipeline',
    description: 'Hardened evidence upload with AV scanning',
    defaultValue: false,
    scope: 'global',
    rolloutStrategy: 'percentage'
  },
  security_hardening: {
    name: 'security_hardening',
    description: '2FA enforcement and session management',
    defaultValue: false,
    scope: 'per-tenant',
    rolloutStrategy: 'whitelist'
  },
  training_center: {
    name: 'training_center',
    description: 'Enterprise training and certification system',
    defaultValue: false,
    scope: 'global',
    rolloutStrategy: 'whitelist'
  },
  aws_s3_storage: {
    name: 'aws_s3_storage',
    description: 'AWS S3 cloud storage integration',
    defaultValue: false,
    scope: 'global',
    rolloutStrategy: 'whitelist'
  },
  enable_email_verification: {
    name: 'enable_email_verification',
    description: 'Enable email verification before payment (new registration flow). When false: legacy payment-first flow (Register → Payment → Account creation). When true: new email-first flow (Register → Email verification → Payment → Account activation)',
    defaultValue: true,
    scope: 'global',
    rolloutStrategy: 'percentage'
  }
};

// Feature flag storage interface
export interface FeatureFlagStore {
  // Global flags
  getGlobalFlag(flag: FeatureFlag): Promise<boolean>;
  setGlobalFlag(flag: FeatureFlag, value: boolean): Promise<void>;

  // Tenant-specific overrides
  getTenantFlag(tenantId: string, flag: FeatureFlag): Promise<boolean | null>;
  setTenantFlag(tenantId: string, flag: FeatureFlag, value: boolean): Promise<void>;
  removeTenantFlag(tenantId: string, flag: FeatureFlag): Promise<void>;

  // User-specific overrides
  getUserFlag(userId: string, flag: FeatureFlag): Promise<boolean | null>;
  setUserFlag(userId: string, flag: FeatureFlag, value: boolean): Promise<void>;
  removeUserFlag(userId: string, flag: FeatureFlag): Promise<void>;

  // Bulk operations
  getAllFlags(): Promise<Record<FeatureFlag, boolean>>;
  getTenantFlags(tenantId: string): Promise<Record<FeatureFlag, boolean>>;
  getUserFlags(userId: string): Promise<Record<FeatureFlag, boolean>>;
}

// In-memory flag store for development
export class MemoryFlagStore implements FeatureFlagStore {
  private globalFlags = new Map<FeatureFlag, boolean>();
  private tenantFlags = new Map<string, Map<FeatureFlag, boolean>>();
  private userFlags = new Map<string, Map<FeatureFlag, boolean>>();

  async getGlobalFlag(flag: FeatureFlag): Promise<boolean> {
    return this.globalFlags.get(flag) ?? FEATURE_FLAGS[flag].defaultValue;
  }

  async setGlobalFlag(flag: FeatureFlag, value: boolean): Promise<void> {
    this.globalFlags.set(flag, value);
  }

  async getTenantFlag(tenantId: string, flag: FeatureFlag): Promise<boolean | null> {
    return this.tenantFlags.get(tenantId)?.get(flag) ?? null;
  }

  async setTenantFlag(tenantId: string, flag: FeatureFlag, value: boolean): Promise<void> {
    if (!this.tenantFlags.has(tenantId)) {
      this.tenantFlags.set(tenantId, new Map());
    }
    this.tenantFlags.get(tenantId)!.set(flag, value);
  }

  async removeTenantFlag(tenantId: string, flag: FeatureFlag): Promise<void> {
    this.tenantFlags.get(tenantId)?.delete(flag);
  }

  async getUserFlag(userId: string, flag: FeatureFlag): Promise<boolean | null> {
    return this.userFlags.get(userId)?.get(flag) ?? null;
  }

  async setUserFlag(userId: string, flag: FeatureFlag, value: boolean): Promise<void> {
    if (!this.userFlags.has(userId)) {
      this.userFlags.set(userId, new Map());
    }
    this.userFlags.get(userId)!.set(flag, value);
  }

  async removeUserFlag(userId: string, flag: FeatureFlag): Promise<void> {
    this.userFlags.get(userId)?.delete(flag);
  }

  async getAllFlags(): Promise<Record<FeatureFlag, boolean>> {
    const result = {} as Record<FeatureFlag, boolean>;
    for (const flag of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
      result[flag] = await this.getGlobalFlag(flag);
    }
    return result;
  }

  async getTenantFlags(tenantId: string): Promise<Record<FeatureFlag, boolean>> {
    const result = {} as Record<FeatureFlag, boolean>;
    for (const flag of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
      const tenantOverride = await this.getTenantFlag(tenantId, flag);
      result[flag] = tenantOverride ?? await this.getGlobalFlag(flag);
    }
    return result;
  }

  async getUserFlags(userId: string): Promise<Record<FeatureFlag, boolean>> {
    const result = {} as Record<FeatureFlag, boolean>;
    for (const flag of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
      const userOverride = await this.getUserFlag(userId, flag);
      result[flag] = userOverride ?? await this.getGlobalFlag(flag);
    }
    return result;
  }
}

// Feature flag evaluation context
export interface FlagContext {
  tenantId?: string;
  userId?: string;
  userRole?: string;
  planType?: string;
  metadata?: Record<string, any>;
}

// Main feature flag service
export class FeatureFlagService {
  constructor(private store: FeatureFlagStore) {}

  // Evaluate a flag with context (handles scope and rollout strategy)
  async isEnabled(flag: FeatureFlag, context: FlagContext = {}): Promise<boolean> {
    const config = FEATURE_FLAGS[flag];

    // Check user-specific override first (highest priority)
    if (context.userId && config.scope === 'per-user') {
      const userOverride = await this.store.getUserFlag(context.userId, flag);
      if (userOverride !== null) return userOverride;
    }

    // Check tenant-specific override
    if (context.tenantId && config.scope === 'per-tenant') {
      const tenantOverride = await this.store.getTenantFlag(context.tenantId, flag);
      if (tenantOverride !== null) return tenantOverride;
    }

    // Fall back to global flag
    return await this.store.getGlobalFlag(flag);
  }

  // Enable a flag for a specific scope
  async enable(flag: FeatureFlag, context: FlagContext = {}): Promise<void> {
    const config = FEATURE_FLAGS[flag];

    if (context.userId && config.scope === 'per-user') {
      await this.store.setUserFlag(context.userId, flag, true);
    } else if (context.tenantId && config.scope === 'per-tenant') {
      await this.store.setTenantFlag(context.tenantId, flag, true);
    } else {
      await this.store.setGlobalFlag(flag, true);
    }
  }

  // Disable a flag for a specific scope
  async disable(flag: FeatureFlag, context: FlagContext = {}): Promise<void> {
    const config = FEATURE_FLAGS[flag];

    if (context.userId && config.scope === 'per-user') {
      await this.store.setUserFlag(context.userId, flag, false);
    } else if (context.tenantId && config.scope === 'per-tenant') {
      await this.store.setTenantFlag(context.tenantId, flag, false);
    } else {
      await this.store.setGlobalFlag(flag, false);
    }
  }

  // Get all flags for a context
  async getFlags(context: FlagContext = {}): Promise<Record<FeatureFlag, boolean>> {
    const result = {} as Record<FeatureFlag, boolean>;

    for (const flag of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
      result[flag] = await this.isEnabled(flag, context);
    }

    return result;
  }

  // Bulk enable/disable flags
  async setFlags(flags: Partial<Record<FeatureFlag, boolean>>, context: FlagContext = {}): Promise<void> {
    for (const [flag, value] of Object.entries(flags)) {
      if (value !== undefined) {
        if (value) {
          await this.enable(flag as FeatureFlag, context);
        } else {
          await this.disable(flag as FeatureFlag, context);
        }
      }
    }
  }
}

// Global instance for server-side use
export const flagStore = new MemoryFlagStore();
export const flagService = new FeatureFlagService(flagStore);