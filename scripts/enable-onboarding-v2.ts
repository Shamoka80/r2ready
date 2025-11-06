#!/usr/bin/env tsx
// Enable onboarding_v2 feature flag for internal demo tenants

import { flagService } from '../shared/flags.js';

async function enableOnboardingV2() {
  console.log('🚩 Enabling Onboarding V2 for internal tenants...');

  try {
    // Enable globally for all new users
    await flagService.enable('onboarding_v2');
    console.log('✅ Enabled onboarding_v2 globally');

    // Enable for specific demo tenants
    const demoTenantIds = [
      'demo-business-corp',
      'demo-consultant-llc'
    ];

    for (const tenantId of demoTenantIds) {
      await flagService.enable('onboarding_v2', { tenantId });
      console.log(`✅ Enabled onboarding_v2 for tenant: ${tenantId}`);
    }

    // Verify flags are enabled
    const globalFlags = await flagService.getFlags();
    console.log('\n📊 Current Feature Flags:');
    console.log('- onboarding_v2:', globalFlags.onboarding_v2 ? '🟢 ENABLED' : '🔴 DISABLED');
    console.log('- license_perpetual:', globalFlags.license_perpetual ? '🟢 ENABLED' : '🔴 DISABLED');
    console.log('- multi_facility:', globalFlags.multi_facility ? '🟢 ENABLED' : '🔴 DISABLED');
    console.log('- exports_v2:', globalFlags.exports_v2 ? '🟢 ENABLED' : '🔴 DISABLED');
    console.log('- evidence_pipeline:', globalFlags.evidence_pipeline ? '🟢 ENABLED' : '🔴 DISABLED');
    console.log('- security_hardening:', globalFlags.security_hardening ? '🟢 ENABLED' : '🔴 DISABLED');

    console.log('\n🎉 Onboarding V2 Phase 1 Rollout Complete!');
    console.log('🔗 New users will now see the improved onboarding experience');
    
  } catch (error) {
    console.error('❌ Error enabling onboarding v2:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  enableOnboardingV2();
}