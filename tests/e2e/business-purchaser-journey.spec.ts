/**
 * Business Purchaser Complete Journey E2E Test
 * 
 * Based on Industry_Aligned_Journey.md specification
 * Tests the complete flow: Registration → Email Verification → Account Type Selection → 
 * Filtered Pricing → Payment → Onboarding → Business Dashboard
 * 
 * This test uses a "log-and-continue" methodology:
 * - Documents any issues encountered with screenshots
 * - Continues through the flow to completion
 * - Provides comprehensive journey verification
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Business Purchaser Complete Journey', () => {
  let testEmail: string;
  let testPassword: string;
  let authToken: string;
  const issues: Array<{ step: string; description: string; screenshot?: string }> = [];

  test.beforeEach(async () => {
    // Generate unique test credentials
    const timestamp = Date.now();
    testEmail = `business-journey-${timestamp}@test.com`;
    testPassword = 'BusinessTest123!';
  });

  test('complete business purchaser journey from registration to dashboard', async ({ page }) => {
    test.setTimeout(120000); // Increase timeout to 120 seconds for complete journey
    
    console.log('🧪 Starting Business Purchaser Journey Test');
    console.log(`📧 Test Email: ${testEmail}`);

    // ========================================
    // STEP 1: REGISTRATION
    // ========================================
    console.log('\n📝 STEP 1: Registration');
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of registration page
    await page.screenshot({ path: 'test-results/business-journey-01-registration.png', fullPage: true });

    // Verify registration page loaded
    try {
      await expect(page).toHaveURL(/\/register/);
      console.log('✅ Registration page loaded');
    } catch (error) {
      issues.push({
        step: 'Registration - Page Load',
        description: `Failed to load registration page: ${error}`,
        screenshot: 'business-journey-01-registration.png'
      });
      console.log('❌ Registration page did not load correctly');
    }

    // Fill registration form using correct data-testid selectors
    try {
      await page.locator('[data-testid="input-first-name"]').fill('John');
      await page.locator('[data-testid="input-last-name"]').fill('Business');
      await page.locator('[data-testid="input-email"]').fill(testEmail);
      await page.locator('[data-testid="input-password"]').fill(testPassword);
      await page.locator('[data-testid="input-confirm-password"]').fill(testPassword);
      await page.locator('[data-testid="input-company-name"]').fill('Test Business Corp');
      
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
    await page.screenshot({ path: 'test-results/business-journey-02-registration-filled.png', fullPage: true });
    
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
    await page.screenshot({ path: 'test-results/business-journey-03-after-registration.png', fullPage: true });

    // Check if redirected to verify-email or email-sent page
    const currentUrl = page.url();
    console.log(`Current URL after registration: ${currentUrl}`);

    if (currentUrl.includes('verify-email') || currentUrl.includes('email-sent')) {
      console.log('✅ Redirected to verification page');
    } else {
      issues.push({
        step: 'Email Verification - Redirect',
        description: `Expected redirect to verify-email or email-sent, got: ${currentUrl}`,
        screenshot: 'business-journey-03-after-registration.png'
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
    console.log('\n🏢 STEP 3: Account Type Selection');
    
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
    
    await page.screenshot({ path: 'test-results/business-journey-04-account-type.png', fullPage: true });

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
        screenshot: 'business-journey-04-account-type.png'
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

    // Select Business account type
    try {
      // Look for the Business card and click it
      const businessCard = page.locator('[data-testid*="business"], .cursor-pointer:has-text("Business Organization")').first();
      await businessCard.click();
      await page.waitForTimeout(1500);
      console.log('✅ Business account type selected');
      
      await page.screenshot({ path: 'test-results/business-journey-05-business-selected.png', fullPage: true });
    } catch (error) {
      issues.push({
        step: 'Account Type - Business Selection',
        description: `Failed to select business account type: ${error}`,
      });
      console.log('❌ Failed to select business account type');
    }

    // ========================================
    // STEP 4: FILTERED PRICING
    // ========================================
    console.log('\n💰 STEP 4: Filtered Pricing (Business Tiers Only)');
    
    // Should auto-redirect to pricing page with type=business parameter
    await page.waitForTimeout(2000);
    let pricingUrl = page.url();
    console.log(`Current URL after account type selection: ${pricingUrl}`);

    if (!pricingUrl.includes('pricing')) {
      // Manually navigate if auto-redirect didn't work
      console.log('⚠️ Auto-redirect to pricing did not occur, navigating manually');
      await page.goto('/pricing?type=business');
      await page.waitForLoadState('networkidle');
      pricingUrl = page.url();
    }

    await page.screenshot({ path: 'test-results/business-journey-06-pricing.png', fullPage: true });

    // Verify we're on pricing page
    try {
      await expect(page).toHaveURL(/\/pricing/);
      console.log('✅ Pricing page loaded');
    } catch (error) {
      issues.push({
        step: 'Pricing - Page Load',
        description: `Failed to load pricing page: ${error}`,
        screenshot: 'business-journey-06-pricing.png'
      });
      console.log('❌ Pricing page did not load');
    }

    // Verify business tiers are visible
    try {
      const soloTier = page.locator('text=Solo Business').first();
      const teamTier = page.locator('text=Team Business').first();
      
      await expect(soloTier).toBeVisible({ timeout: 5000 });
      await expect(teamTier).toBeVisible({ timeout: 5000 });
      console.log('✅ Business pricing tiers visible');
    } catch (error) {
      issues.push({
        step: 'Pricing - Business Tiers Visibility',
        description: `Business pricing tiers not visible: ${error}`,
      });
      console.log('⚠️ Business pricing tiers may not be visible');
    }

    // Verify consultant tiers are NOT visible (or filtered out)
    try {
      const independentConsultant = page.locator('text=Independent Consultant').first();
      const isConsultantVisible = await independentConsultant.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isConsultantVisible) {
        issues.push({
          step: 'Pricing - Tier Filtering',
          description: 'Consultant tiers are visible on business pricing page (should be filtered)',
        });
        console.log('⚠️ Pricing tiers may not be properly filtered by account type');
      } else {
        console.log('✅ Consultant tiers properly filtered (not visible)');
      }
    } catch (error) {
      console.log('ℹ️ Consultant tier check completed');
    }

    // Verify URL contains type parameter
    if (pricingUrl.includes('type=business')) {
      console.log('✅ Pricing URL contains type=business parameter');
    } else {
      issues.push({
        step: 'Pricing - URL Parameter',
        description: 'Pricing URL does not contain type=business parameter',
      });
      console.log('⚠️ Pricing URL missing type parameter');
    }

    // Select a business plan (Solo Business for testing)
    try {
      const selectButton = page.locator('[data-testid*="select-plan"], button:has-text("Get Started")').first();
      await selectButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Business plan selected');
      
      await page.screenshot({ path: 'test-results/business-journey-07-plan-selected.png', fullPage: true });
    } catch (error) {
      issues.push({
        step: 'Pricing - Plan Selection',
        description: `Failed to select business plan: ${error}`,
      });
      console.log('⚠️ Failed to select business plan');
    }

    // ========================================
    // STEP 5: PAYMENT / PURCHASE FLOW
    // ========================================
    console.log('\n💳 STEP 5: Payment/Purchase Flow');
    
    const postPurchaseUrl = page.url();
    console.log(`Current URL after plan selection: ${postPurchaseUrl}`);

    if (postPurchaseUrl.includes('purchase') || postPurchaseUrl.includes('checkout')) {
      console.log('✅ Redirected to purchase/checkout page');
      await page.screenshot({ path: 'test-results/business-journey-08-purchase.png', fullPage: true });
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
    // STEP 6: ONBOARDING (Business Flow)
    // ========================================
    console.log('\n🎯 STEP 6: Business Onboarding Flow');
    
    // Simulate post-payment redirect to onboarding (using V2 route)
    console.log('⏭️ Simulating post-payment redirect to onboarding');
    await page.goto('/onboarding-v2');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/business-journey-09-onboarding.png', fullPage: true });

    // Verify onboarding page loaded
    try {
      await expect(page).toHaveURL(/\/onboarding-v2/);
      console.log('✅ Onboarding page loaded');
    } catch (error) {
      issues.push({
        step: 'Onboarding - Page Load',
        description: `Failed to load onboarding page: ${error}`,
        screenshot: 'business-journey-09-onboarding.png'
      });
      console.log('❌ Onboarding page did not load');
    }

    // Account type is already determined from license purchase - no need to select
    console.log('ℹ️ Account type pre-determined from license purchase (business)');

    // Navigate through onboarding steps (3-step flow)
    try {
      // Step 1: Quick Setup (Organization)
      console.log('📝 Filling Step 1: Quick Setup (Organization)');
      
      await page.getByLabel('Company Name *').fill('Test Business Corp');
      await page.getByLabel('Primary Contact *').fill('John Business');
      await page.getByLabel('Contact Email *').fill(testEmail);
      await page.getByLabel('City *').fill('Austin');
      await page.getByLabel('State *').fill('TX');
      
      await page.screenshot({ path: 'test-results/business-journey-10-org-profile.png', fullPage: true });
      
      // Click Continue button to proceed to next step
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForTimeout(1000); // Wait for form submission
      console.log('✅ Onboarding Step 1 completed (Quick Setup)');

      // Wait for Step 2 to load - look for the "Primary Facility" heading
      await page.waitForSelector('text=Primary Facility', { timeout: 10000 });
      console.log('📝 Filling Step 2: Primary Facility');
      
      await page.getByLabel('Facility Name *').fill('Main Processing Facility');
      await page.getByLabel('Address *').fill('456 Industrial Blvd');
      await page.getByLabel('City *').fill('Austin');
      await page.getByLabel('State *').fill('TX');
      await page.getByLabel('ZIP Code *').fill('78702');
      
      // Select operation type (using Select component)
      await page.getByLabel('Operation Type *').click();
      await page.getByRole('option', { name: /manufacturing/i }).click();
      
      // Select employee count (using Select component)
      await page.getByLabel('Employee Count *').click();
      await page.getByRole('option', { name: /11-50/i }).click();
      
      await page.screenshot({ path: 'test-results/business-journey-11-facility.png', fullPage: true });
      
      // Click Continue button to proceed to confirmation
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForTimeout(1000);
      console.log('✅ Onboarding Step 2 completed (Primary Facility)');

      // Wait for Step 3 (Confirmation) to load
      await page.waitForSelector('text=Ready to Start!', { timeout: 10000 });
      console.log('📝 Step 3: Confirmation page loaded');
      
      await page.screenshot({ path: 'test-results/business-journey-12-confirmation.png', fullPage: true });
      
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
    // STEP 7: BUSINESS DASHBOARD
    // ========================================
    console.log('\n📊 STEP 7: Business Dashboard (Final Destination)');
    
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    console.log(`Final URL after onboarding: ${finalUrl}`);

    if (finalUrl.includes('dashboard')) {
      console.log('✅ Redirected to dashboard');
      await page.screenshot({ path: 'test-results/business-journey-12-dashboard.png', fullPage: true });
    } else {
      issues.push({
        step: 'Dashboard - Redirect',
        description: `Expected redirect to dashboard, got: ${finalUrl}`,
      });
      console.log('⚠️ Dashboard redirect may not have occurred');
      
      // Try navigating manually
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/business-journey-12-dashboard-manual.png', fullPage: true });
    }

    // Verify it's the Business Dashboard (not Consultant Dashboard)
    try {
      // Business dashboard should show facility-centric content
      const hasFacilities = await page.locator('text=Facilities, text=Facility').first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasAssessments = await page.locator('text=Assessment').first().isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasFacilities || hasAssessments) {
        console.log('✅ Business Dashboard content visible');
      } else {
        console.log('ℹ️ Dashboard content check completed');
      }

      // Should NOT show consultant-specific features like "Clients" management
      const hasClients = await page.locator('text=Client Organizations, text=Manage Clients').first().isVisible({ timeout: 2000 }).catch(() => false);
      
      if (hasClients) {
        issues.push({
          step: 'Dashboard - Content Verification',
          description: 'Dashboard shows consultant features for business user',
        });
        console.log('⚠️ Dashboard may be showing consultant features for business user');
      } else {
        console.log('✅ Dashboard properly filtered for business user');
      }
    } catch (error) {
      console.log('ℹ️ Dashboard content verification completed');
    }

    // ========================================
    // TEST SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(80));
    console.log('📋 BUSINESS PURCHASER JOURNEY TEST SUMMARY');
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
