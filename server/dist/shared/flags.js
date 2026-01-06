// Feature Flag System
// Provides server-side and client-side feature flag management with per-tenant overrides
// Feature flag definitions matching CONTROL_PLANE.md
export const FEATURE_FLAGS = {
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
    },
    // Phase 5: R2v3 Algorithm Enhancement Feature Flags
    use_config_weights: {
        name: 'use_config_weights',
        description: 'Enable database-driven scoring configuration with externalized category weights and thresholds instead of hardcoded values',
        defaultValue: false,
        scope: 'global',
        rolloutStrategy: 'gradual'
    },
    enforce_must_pass: {
        name: 'enforce_must_pass',
        description: 'Enable critical gate enforcement requiring all 8 must-pass R2v3 requirements (EHSMS, legal plan, focus materials, DSV, data security, closure plan, financial assurance, SERI license) before assessment completion',
        defaultValue: false,
        scope: 'global',
        rolloutStrategy: 'gradual'
    },
    separate_maturity: {
        name: 'separate_maturity',
        description: 'Calculate and store separate operational maturity scores (BCP, CI, Stakeholder) alongside readiness scoring',
        defaultValue: false,
        scope: 'global',
        rolloutStrategy: 'gradual'
    },
    exclude_na_from_denominator: {
        name: 'exclude_na_from_denominator',
        description: 'Exclude N/A responses from scoring denominator calculation (count only answered questions)',
        defaultValue: false,
        scope: 'global',
        rolloutStrategy: 'gradual'
    }
};
// In-memory flag store for development
export class MemoryFlagStore {
    globalFlags = new Map();
    tenantFlags = new Map();
    userFlags = new Map();
    async getGlobalFlag(flag) {
        return this.globalFlags.get(flag) ?? FEATURE_FLAGS[flag].defaultValue;
    }
    async setGlobalFlag(flag, value) {
        this.globalFlags.set(flag, value);
    }
    async getTenantFlag(tenantId, flag) {
        return this.tenantFlags.get(tenantId)?.get(flag) ?? null;
    }
    async setTenantFlag(tenantId, flag, value) {
        if (!this.tenantFlags.has(tenantId)) {
            this.tenantFlags.set(tenantId, new Map());
        }
        this.tenantFlags.get(tenantId).set(flag, value);
    }
    async removeTenantFlag(tenantId, flag) {
        this.tenantFlags.get(tenantId)?.delete(flag);
    }
    async getUserFlag(userId, flag) {
        return this.userFlags.get(userId)?.get(flag) ?? null;
    }
    async setUserFlag(userId, flag, value) {
        if (!this.userFlags.has(userId)) {
            this.userFlags.set(userId, new Map());
        }
        this.userFlags.get(userId).set(flag, value);
    }
    async removeUserFlag(userId, flag) {
        this.userFlags.get(userId)?.delete(flag);
    }
    async getAllFlags() {
        const result = {};
        for (const flag of Object.keys(FEATURE_FLAGS)) {
            result[flag] = await this.getGlobalFlag(flag);
        }
        return result;
    }
    async getTenantFlags(tenantId) {
        const result = {};
        for (const flag of Object.keys(FEATURE_FLAGS)) {
            const tenantOverride = await this.getTenantFlag(tenantId, flag);
            result[flag] = tenantOverride ?? await this.getGlobalFlag(flag);
        }
        return result;
    }
    async getUserFlags(userId) {
        const result = {};
        for (const flag of Object.keys(FEATURE_FLAGS)) {
            const userOverride = await this.getUserFlag(userId, flag);
            result[flag] = userOverride ?? await this.getGlobalFlag(flag);
        }
        return result;
    }
}
// Main feature flag service
export class FeatureFlagService {
    store;
    constructor(store) {
        this.store = store;
    }
    // Evaluate a flag with context (handles scope and rollout strategy)
    async isEnabled(flag, context = {}) {
        const config = FEATURE_FLAGS[flag];
        // Check user-specific override first (highest priority)
        if (context.userId && config.scope === 'per-user') {
            const userOverride = await this.store.getUserFlag(context.userId, flag);
            if (userOverride !== null)
                return userOverride;
        }
        // Check tenant-specific override
        if (context.tenantId && config.scope === 'per-tenant') {
            const tenantOverride = await this.store.getTenantFlag(context.tenantId, flag);
            if (tenantOverride !== null)
                return tenantOverride;
        }
        // Fall back to global flag
        return await this.store.getGlobalFlag(flag);
    }
    // Enable a flag for a specific scope
    async enable(flag, context = {}) {
        const config = FEATURE_FLAGS[flag];
        if (context.userId && config.scope === 'per-user') {
            await this.store.setUserFlag(context.userId, flag, true);
        }
        else if (context.tenantId && config.scope === 'per-tenant') {
            await this.store.setTenantFlag(context.tenantId, flag, true);
        }
        else {
            await this.store.setGlobalFlag(flag, true);
        }
    }
    // Disable a flag for a specific scope
    async disable(flag, context = {}) {
        const config = FEATURE_FLAGS[flag];
        if (context.userId && config.scope === 'per-user') {
            await this.store.setUserFlag(context.userId, flag, false);
        }
        else if (context.tenantId && config.scope === 'per-tenant') {
            await this.store.setTenantFlag(context.tenantId, flag, false);
        }
        else {
            await this.store.setGlobalFlag(flag, false);
        }
    }
    // Get all flags for a context
    async getFlags(context = {}) {
        const result = {};
        for (const flag of Object.keys(FEATURE_FLAGS)) {
            result[flag] = await this.isEnabled(flag, context);
        }
        return result;
    }
    // Bulk enable/disable flags
    async setFlags(flags, context = {}) {
        for (const [flag, value] of Object.entries(flags)) {
            if (value !== undefined) {
                if (value) {
                    await this.enable(flag, context);
                }
                else {
                    await this.disable(flag, context);
                }
            }
        }
    }
}
// Global instance for server-side use
export const flagStore = new MemoryFlagStore();
export const flagService = new FeatureFlagService(flagStore);
