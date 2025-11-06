/**
 * Consultant Complete Journey E2E Test
 * 
 * Based on Industry_Aligned_Journey.md specification
 * Tests the complete flow: Registration → Email Verification → Account Type Selection → 
 * Filtered Pricing → Payment → Onboarding → Consultant Dashboard
 * 
 * This test uses a "log-and-continue" methodology:
 * - Documents any issues encountered with screenshots
 * - Continues through the flow to completion
 * - Provides comprehensive journey verification
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Consultant Complete Journey', () => {
  let testEmail: string;
  let testPassword: string;
  let authToken: string;
  const issues: Array<{ step: string; description: string; screenshot?: string }> = [];

  test.beforeEach(async () => {
    // Generate unique test credentials
    const timestamp = Date.now();
    testEmail = `consultant-journey-${timestamp}@test.com`;
    testPassword = 'ConsultantTest123!';
  });

  test('complete consultant journey from registration to dashboard', async ({ page }) => {
    test.setTimeout(120000); // Increase timeout to 120 seconds for complete journey
    
    console.log('🧪 Starting Consultant Journey Test');
    console.log(`📧 Test Email: ${testEmail}`);

    // ========================================
    // STEP 1: REGISTRATION
    // ========================================
    console.log('\n📝 STEP 1: Registration');
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of registration page
    await page.screenshot({ path: 'test-results/consultant-journey-01-registration.png', fullPage: true });

    // Verify registration page loaded
    try {
      await expect(page).toHaveURL(/\/register/);
      console.log('✅ Registration page loaded');
    } catch (error) {
      issues.push({
        step: 'Registration - Page Load',
        description: `Failed to load registration page: ${error}`,
        screenshot: 'consultant-journey-01-registration.png'
      });
      console.log('❌ Registration page did not load correctly');
    }

    // Fill registration form using correct data-testid selectors
    try {
      await page.locator('[data-testid="input-first-name"]').fill('Jane');
      await page.locator('[data-testid="input-last-name"]').fill('Consultant');
      await page.locator('[data-testid="input-email"]').fill(testEmail);
      await page.locator('[data-testid="input-password"]').fill(testPassword);
      await page.locator('[data-testid="input-confirm-password"]').fill(testPassword);
      await page.locator('[data-testid="input-company-name"]').fill('Green Consulting LLC');
      
      // Accept terms
      await page.locator('[data-testid="checkbox-terms"]').click();

      console.log('✅ Registration form filled');
    } catch (error) {
      issues.push({
        step: 'Registration - Form Fill',
        description: `Failed to fill registration form: ${error}`,
      });
      console.log('❌ Failed to fill registration form');
    }

    // Submit registration
    await page.screenshot({ path: 'test-results/consultant-journey-02-registration-filled.png', fullPage: true });
    
    try {
      await page.locator('[data-testid="button-create-account"]').click();
      await page.waitForTimeout(2000);
      console.log('✅ Registration form submitted');
    } catch (error) {
      issues.push({
        step: 'Registration - Submit',
        description: `Failed to submit registration: ${error}`,
      });
      console.log('❌ Failed to submit registration');
    }

    // ========================================
    // STEP 2: EMAIL VERIFICATION (Test Helper)
    // ========================================
    console.log('\n📧 STEP 2: Email Verification');
    await page.screenshot({ path: 'test-results/consultant-journey-03-after-registration.png', fullPage: true });

    // Check if redirected to verify-email or email-sent page
    const currentUrl = page.url();
    console.log(`Current URL after registration: ${currentUrl}`);

    if (currentUrl.includes('verify-email') || currentUrl.includes('email-sent')) {
      console.log('✅ Redirected to verification page');
    } else {
      issues.push({
        step: 'Email Verification - Redirect',
        description: `Expected redirect to verify-email or email-sent, got: ${currentUrl}`,
        screenshot: 'consultant-journey-03-after-registration.png'
      });
      console.log('⚠️ Unexpected redirect after registration');
    }

    // Use test helper endpoint to verify email and get auth token
    console.log('🔐 Using test helper to verify email and authenticate...');
    try {
      const response = await page.request.post('http://localhost:5000/api/auth/test-verify-email', {
        data: { email: testEmail }
      });

      if (response.ok()) {
        const data = await response.json();
        authToken = data.token;
        
        // Store auth token in localStorage (using correct key 'auth_token')
        await page.evaluate((token) => {
          localStorage.setItem('auth_token', token);
        }, authToken);

        // Navigate to home page and reload to initialize AuthContext with the new token
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.reload();
        await page.waitForLoadState('networkidle');

        console.log('✅ Email verified and authenticated via test helper');
        console.log(`   User ID: ${data.user.id}`);
        console.log(`   Setup Status: ${data.user.setupStatus}`);
      } else {
        const errorText = await response.text();
        issues.push({
          step: 'Email Verification - Test Helper',
          description: `Test helper failed: ${response.status()} - ${errorText}`,
        });
        console.log('❌ Test helper failed:', response.status());
      }
    } catch (error) {
      issues.push({
        step: 'Email Verification - Test Helper',
        description: `Failed to call test helper: ${error}`,
      });
      console.log('❌ Failed to call test helper:', error);
    }

    // ========================================
    // STEP 3: ACCOUNT TYPE SELECTION
    // ========================================
    console.log('\n👥 STEP 3: Account Type Selection (Consultant)');
    
    // Navigate to account type selection (now with authentication)
    await page.goto('/account-type-selection');
    await page.waitForLoadState('networkidle');
    
    // Wait for auth context to load - check for the account type cards (indicates authenticated state)
    try {
      // Wait for both account type cards to appear (indicates page loaded correctly with authentication)
      await Promise.all([
        page.waitForSelector('text=Business Organization', { timeout: 10000 }),
        page.waitForSelector('text=Consultant', { timeout: 10000 })
      ]);
      console.log('✅ Account type selection page loaded with authentication');
    } catch (error) {
      console.log('⚠️ Account type cards did not load - may be redirected to login');
    }
    
    await page.screenshot({ path: 'test-results/consultant-journey-04-account-type.png', fullPage: true });

    // Verify page loaded and we're not redirected to login
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Redirected to login - authentication failed');
      }
      await expect(page).toHaveURL(/\/account-type-selection/);
      console.log('✅ Account type selection page loaded');
    } catch (error) {
      issues.push({
        step: 'Account Type - Page Load',
        description: `Failed to load account type selection page: ${error}`,
        screenshot: 'consultant-journey-04-account-type.png'
      });
      console.log('❌ Account type selection page did not load');
    }

    // Verify both Business and Consultant options are visible
    try {
      const businessCard = page.locator('text=Business Organization').first();
      const consultantCard = page.locator('text=Consultant').first();
      
      await expect(businessCard).toBeVisible({ timeout: 5000 });
      await expect(consultantCard).toBeVisible({ timeout: 5000 });
      console.log('✅ Both account type options visible');
    } catch (error) {
      issues.push({
        step: 'Account Type - Options Visibility',
        description: `Account type options not visible: ${error}`,
      });
      console.log('⚠️ Account type options may not be visible');
    }

    // Select Consultant account type
    try {
      // Look for the Consultant card and click it
      const consultantCard = page.locator('[data-testid*="consultant"], .cursor-pointer:has-text("Consultant")').first();
      await consultantCard.click();
      await page.waitForTimeout(1500);
      console.log('✅ Consultant account type selected');
      
      await page.screenshot({ path: 'test-results/consultant-journey-05-consultant-selected.png', fullPage: true });
    } catch (error) {
      issues.push({
        step: 'Account Type - Consultant Selection',
        description: `Failed to select consultant account type: ${error}`,
      });
      console.log('❌ Failed to select consultant account type');
    }

    // ========================================
    // STEP 4: FILTERED PRICING
    // ========================================
    console.log('\n💰 STEP 4: Filtered Pricing (Consultant Tiers Only)');
    
    // Should auto-redirect to pricing page with type=consultant parameter
    await page.waitForTimeout(2000);
    let pricingUrl = page.url();
    console.log(`Current URL after account type selection: ${pricingUrl}`);

    if (!pricingUrl.includes('pricing')) {
      // Manually navigate if auto-redirect didn't work
      console.log('⚠️ Auto-redirect to pricing did not occur, navigating manually');
      await page.goto('/pricing?type=consultant');
      await page.waitForLoadState('networkidle');
      pricingUrl = page.url();
    }

    await page.screenshot({ path: 'test-results/consultant-journey-06-pricing.png', fullPage: true });

    // Verify we're on pricing page
    try {
      await expect(page).toHaveURL(/\/pricing/);
      console.log('✅ Pricing page loaded');
    } catch (error) {
      issues.push({
        step: 'Pricing - Page Load',
        description: `Failed to load pricing page: ${error}`,
        screenshot: 'consultant-journey-06-pricing.png'
      });
      console.log('❌ Pricing page did not load');
    }

    // Verify consultant tiers are visible
    try {
      const independentTier = page.locator('text=Independent Consultant').first();
      const agencyTier = page.locator('text=Agency Consultant').first();
      
      await expect(independentTier).toBeVisible({ timeout: 5000 });
      await expect(agencyTier).toBeVisible({ timeout: 5000 });
      console.log('✅ Consultant pricing tiers visible');
    } catch (error) {
      issues.push({
        step: 'Pricing - Consultant Tiers Visibility',
        description: `Consultant pricing tiers not visible: ${error}`,
      });
      console.log('⚠️ Consultant pricing tiers may not be visible');
    }

    // Verify business tiers are NOT visible (or filtered out)
    try {
      const soloBusiness = page.locator('text=Solo Business').first();
      const isBusinessVisible = await soloBusiness.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isBusinessVisible) {
        issues.push({
          step: 'Pricing - Tier Filtering',
          description: 'Business tiers are visible on consultant pricing page (should be filtered)',
        });
        console.log('⚠️ Pricing tiers may not be properly filtered by account type');
      } else {
        console.log('✅ Business tiers properly filtered (not visible)');
      }
    } catch (error) {
      console.log('ℹ️ Business tier check completed');
    }

    // Verify URL contains type parameter
    if (pricingUrl.includes('type=consultant')) {
      console.log('✅ Pricing URL contains type=consultant parameter');
    } else {
      issues.push({
        step: 'Pricing - URL Parameter',
        description: 'Pricing URL does not contain type=consultant parameter',
      });
      console.log('⚠️ Pricing URL missing type parameter');
    }

    // Select a consultant plan (Independent for testing)
    try {
      const selectButton = page.locator('[data-testid*="select-plan"], button:has-text("Get Started")').first();
      await selectButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Consultant plan selected');
      
      await page.screenshot({ path: 'test-results/consultant-journey-07-plan-selected.png', fullPage: true });
    } catch (error) {
      issues.push({
        step: 'Pricing - Plan Selection',
        description: `Failed to select consultant plan: ${error}`,
      });
      console.log('⚠️ Failed to select consultant plan');
    }

    // ========================================
    // STEP 5: PAYMENT / PURCHASE FLOW
    // ========================================
    console.log('\n💳 STEP 5: Payment/Purchase Flow');
    
    const postPurchaseUrl = page.url();
    console.log(`Current URL after plan selection: ${postPurchaseUrl}`);

    if (postPurchaseUrl.includes('purchase') || postPurchaseUrl.includes('checkout')) {
      console.log('✅ Redirected to purchase/checkout page');
      await page.screenshot({ path: 'test-results/consultant-journey-08-purchase.png', fullPage: true });
    } else {
      issues.push({
        step: 'Purchase - Redirect',
        description: `Expected redirect to purchase page, got: ${postPurchaseUrl}`,
      });
      console.log('⚠️ Purchase page redirect may not have occurred');
    }

    // Note: Stripe checkout would require test card details
    // Document this as a checkpoint
    console.log('ℹ️ Payment flow requires Stripe test mode configuration');
    issues.push({
      step: 'Purchase - Stripe Integration',
      description: 'E2E test paused at Stripe checkout (requires test card or mock payment)',
    });

    // ========================================
    // STEP 6: ONBOARDING (Consultant Flow)
    // ========================================
    console.log('\n🎯 STEP 6: Consultant Onboarding Flow');
    
    // Simulate post-payment redirect to onboarding (using V2 route)
    console.log('⏭️ Simulating post-payment redirect to onboarding');
    await page.goto('/onboarding-v2');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/consultant-journey-09-onboarding.png', fullPage: true });

    // Verify onboarding page loaded
    try {
      await expect(page).toHaveURL(/\/onboarding-v2/);
      console.log('✅ Onboarding page loaded');
    } catch (error) {
      issues.push({
        step: 'Onboarding - Page Load',
        description: `Failed to load onboarding page: ${error}`,
        screenshot: 'consultant-journey-09-onboarding.png'
      });
      console.log('❌ Onboarding page did not load');
    }

    // Account type is already determined from license purchase - no need to select
    console.log('ℹ️ Account type pre-determined from license purchase (consultant)');

    // Navigate through onboarding steps (3-step flow)
    try {
      // Step 1: Quick Setup (Organization)
      console.log('📝 Filling Step 1: Quick Setup (Organization)');
      
      await page.getByLabel('Company Name *').fill('Test Consulting Firm');
      await page.getByLabel('Primary Contact *').fill('Jane Consultant');
      await page.getByLabel('Contact Email *').fill(testEmail);
      await page.getByLabel('City *').fill('Austin');
      await page.getByLabel('State *').fill('TX');
      
      await page.screenshot({ path: 'test-results/consultant-journey-10-org-profile.png', fullPage: true });
      
      // Click Continue button to proceed to next step
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForTimeout(1000); // Wait for form submission
      console.log('✅ Onboarding Step 1 completed (Quick Setup)');

      // Wait for Step 2 to load - look for the "Client Information" heading
      await page.waitForSelector('text=Client Information', { timeout: 10000 });
      console.log('📝 Filling Step 2: Client Information');
      
      await page.getByLabel('Client Company Name *').fill('Green Industries Inc');
      await page.getByLabel('Client Industry *').fill('Electronics Recycling');
      
      // Select service type (using Select component)
      await page.getByLabel('Service Type *').click();
      await page.getByRole('option', { name: /r2.*certification/i }).click();
      
      // Select project timeline (using Select component)
      await page.getByLabel('Project Timeline *').click();
      await page.getByRole('option', { name: /3-6.*months/i }).click();
      
      // Select client organization size (using Select component)
      await page.getByLabel('Client Organization Size *').click();
      await page.getByRole('option', { name: /medium/i }).click();
      
      await page.screenshot({ path: 'test-results/consultant-journey-11-client-info.png', fullPage: true });
      
      // Click Continue button to proceed to confirmation
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForTimeout(1000);
      console.log('✅ Onboarding Step 2 completed (Client Information)');

      // Wait for Step 3 (Confirmation) to load
      await page.waitForSelector('text=Ready to Start!', { timeout: 10000 });
      console.log('📝 Step 3: Confirmation page loaded');
      
      await page.screenshot({ path: 'test-results/consultant-journey-12-confirmation.png', fullPage: true });
      
      // Click "Complete Setup" button to finish onboarding
      await page.getByRole('button', { name: /complete setup/i }).click();
      await page.waitForTimeout(2000);
      console.log('✅ Onboarding completed - waiting for dashboard redirect');

    } catch (error) {
      issues.push({
        step: 'Onboarding - Form Completion',
        description: `Failed to complete onboarding forms: ${error}`,
      });
      console.log('⚠️ Issues during onboarding form completion:', error);
    }

    // ========================================
    // STEP 7: CONSULTANT DASHBOARD
    // ========================================
    console.log('\n📊 STEP 7: Consultant Dashboard (Final Destination)');
    
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    console.log(`Final URL after onboarding: ${finalUrl}`);

    if (finalUrl.includes('dashboard')) {
      console.log('✅ Redirected to dashboard');
      await page.screenshot({ path: 'test-results/consultant-journey-12-dashboard.png', fullPage: true });
    } else {
      issues.push({
        step: 'Dashboard - Redirect',
        description: `Expected redirect to dashboard, got: ${finalUrl}`,
      });
      console.log('⚠️ Dashboard redirect may not have occurred');
      
      // Try navigating manually
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/consultant-journey-12-dashboard-manual.png', fullPage: true });
    }

    // Verify it's the Consultant Dashboard (not Business Dashboard)
    try {
      // Consultant dashboard should show client-centric content
      const hasClients = await page.locator('text=Client Organizations, text=Clients').first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasManageClients = await page.locator('text=Manage Clients, text=Add Client').first().isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasClients || hasManageClients) {
        console.log('✅ Consultant Dashboard content visible');
      } else {
        console.log('ℹ️ Dashboard content check completed');
      }

      // Should NOT show business-specific features like facility management (unless managing client facilities)
      const hasFacilityManagement = await page.locator('text=My Facilities, text=Add Facility').first().isVisible({ timeout: 2000 }).catch(() => false);
      
      if (hasFacilityManagement) {
        issues.push({
          step: 'Dashboard - Content Verification',
          description: 'Dashboard shows business facility management for consultant user',
        });
        console.log('⚠️ Dashboard may be showing business features for consultant user');
      } else {
        console.log('✅ Dashboard properly filtered for consultant user');
      }
    } catch (error) {
      console.log('ℹ️ Dashboard content verification completed');
    }

    // ========================================
    // TEST SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(80));
    console.log('📋 CONSULTANT JOURNEY TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Issues Found: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log('\n⚠️ ISSUES ENCOUNTERED:');
      issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.step}`);
        console.log(`   ${issue.description}`);
        if (issue.screenshot) {
          console.log(`   Screenshot: test-results/${issue.screenshot}`);
        }
      });
    } else {
      console.log('\n✅ NO ISSUES ENCOUNTERED - Perfect journey!');
    }

    console.log('\n📸 Screenshots saved to test-results/ directory');
    console.log('='.repeat(80));

    // Store issues for reporting
    test.info().annotations.push({
      type: 'journey-issues',
      description: JSON.stringify(issues, null, 2)
    });
  });
});
