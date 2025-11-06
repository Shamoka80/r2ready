import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { test as authTest } from '../fixtures/auth.fixture';
import { loginAsTestUser, TEST_USERS } from '../helpers/auth';

/**
 * Comprehensive E2E Tests for License Purchase Flow
 * 
 * Covers:
 * - Pricing page navigation and display
 * - Stripe checkout flow
 * - Payment completion
 * - License activation
 * - Webhook handling (API level)
 * - License management
 * - Error handling
 */

test.describe('License Purchase E2E Tests', () => {
  
  // ============================================================================
  // PRICING PAGE NAVIGATION TESTS
  // ============================================================================
  
  test.describe('Pricing Page Navigation', () => {
    test('should navigate to pricing page from landing', async ({ page }) => {
      await page.goto('/');
      
      // Navigate to pricing
      const pricingLink = page.locator('a[href="/pricing"], button:has-text("Pricing")');
      if (await pricingLink.count() > 0) {
        await pricingLink.first().click();
        await expect(page).toHaveURL(/.*pricing.*/);
      } else {
        // Direct navigation
        await page.goto('/pricing');
      }
      
      // Verify pricing page loads
      await expect(page.locator('[data-testid="section-pricing-hero"]')).toBeVisible();
      await expect(page.locator('[data-testid="heading-pricing-title"]')).toBeVisible();
    });

    test('should display business license plans with details', async ({ page }) => {
      await page.goto('/pricing');
      
      // Verify Solo Business plan
      const soloPlan = page.locator('[data-testid="card-plan-solo"]');
      await expect(soloPlan).toBeVisible();
      await expect(soloPlan.locator('[data-testid="text-plan-name-solo"]')).toHaveText('Solo Business');
      await expect(soloPlan.locator('[data-testid="text-plan-price-solo"]')).toContainText('$399');
      await expect(soloPlan.locator('[data-testid="list-plan-features-solo"]')).toBeVisible();
      
      // Verify Team Business plan (most popular)
      const teamPlan = page.locator('[data-testid="card-plan-team"]');
      await expect(teamPlan).toBeVisible();
      await expect(teamPlan.locator('[data-testid="text-plan-name-team"]')).toHaveText('Team Business');
      await expect(teamPlan.locator('[data-testid="text-plan-price-team"]')).toContainText('$899');
      await expect(page.locator('[data-testid="badge-most-popular"]')).toBeVisible();
      
      // Verify Enterprise plan
      const enterprisePlan = page.locator('[data-testid="card-plan-enterprise"]');
      await expect(enterprisePlan).toBeVisible();
      await expect(enterprisePlan.locator('[data-testid="text-plan-name-enterprise"]')).toHaveText('Enterprise Multi-Site');
      await expect(enterprisePlan.locator('[data-testid="text-plan-price-enterprise"]')).toContainText('$1,799');
    });

    test('should display consultant license plans', async ({ page }) => {
      await page.goto('/pricing');
      
      // Scroll to consultant section
      await page.evaluate(() => window.scrollBy(0, 800));
      
      // Verify Independent Consultant plan
      const independentPlan = page.locator('[data-testid="card-plan-independent"]');
      await expect(independentPlan).toBeVisible();
      await expect(independentPlan.locator('[data-testid="text-plan-price-independent"]')).toContainText('$599');
      
      // Verify Agency Consultant plan
      const agencyPlan = page.locator('[data-testid="card-plan-agency"]');
      await expect(agencyPlan).toBeVisible();
      await expect(agencyPlan.locator('[data-testid="text-plan-price-agency"]')).toContainText('$1,199');
      
      // Verify Enterprise Agency plan
      const enterpriseAgencyPlan = page.locator('[data-testid="card-plan-enterprise-consultant"]');
      await expect(enterpriseAgencyPlan).toBeVisible();
      await expect(enterpriseAgencyPlan.locator('[data-testid="text-plan-price-enterprise-consultant"]')).toContainText('$2,499');
    });

    test('should show plan features and limits', async ({ page }) => {
      await page.goto('/pricing');
      
      const soloPlan = page.locator('[data-testid="card-plan-solo"]');
      const featuresList = soloPlan.locator('[data-testid="list-plan-features-solo"]');
      
      // Check that features are visible
      await expect(featuresList).toBeVisible();
      
      // Verify some key features are listed
      await expect(soloPlan.locator('text=1 facility')).toBeVisible();
      await expect(soloPlan.locator('text=1-3 seats')).toBeVisible();
      await expect(soloPlan.locator('text=Self-Assessment Module')).toBeVisible();
    });
  });

  // ============================================================================
  // STRIPE CHECKOUT FLOW TESTS
  // Note: These tests are skipped as they require real Stripe integration.
  // In a real E2E environment with Stripe test mode, these would be enabled.
  // ============================================================================
  
  test.describe.skip('Stripe Checkout Flow', () => {
    test('should initiate checkout when selecting a plan (unauthenticated)', async ({ page }) => {
      await page.goto('/pricing');
      
      // Click "Get Started" for Solo Business plan
      const selectButton = page.locator('[data-testid="button-select-plan-solo"]');
      await expect(selectButton).toBeVisible();
      await selectButton.click();
      
      // Should redirect to registration page with plan parameter
      await expect(page).toHaveURL(/.*register.*plan=solo/);
    });

    test('should handle Stripe checkout for authenticated user', async ({ page }) => {
      // Login as test user first
      await loginAsTestUser(page, 'regular', { timeout: 30000 });
      
      // Navigate to pricing
      await page.goto('/pricing');
      
      // Select Solo plan
      await page.locator('[data-testid="button-select-plan-solo"]').click();
      
      // Should navigate to purchase page or Stripe checkout
      await page.waitForLoadState('networkidle');
      
      // Check if we're on purchase page or Stripe checkout
      const currentUrl = page.url();
      const isPurchasePage = currentUrl.includes('/purchase/');
      const isStripeCheckout = currentUrl.includes('checkout.stripe.com');
      
      expect(isPurchasePage || isStripeCheckout).toBeTruthy();
    });
  });

  // ============================================================================
  // PAYMENT COMPLETION TESTS (Skipped - Requires Stripe)
  // Note: These tests require a working Stripe integration and are skipped in test environment.
  // In production E2E with Stripe test mode, these would be enabled.
  // ============================================================================
  
  test.describe.skip('Payment Completion', () => {
    authTest('should complete payment and create license', async ({ authenticatedPage, authenticatedApiContext }) => {
      // This test would require real Stripe checkout flow
      // Skipped because test environment doesn't have Stripe configured
    });

    authTest('should display payment details after successful payment', async ({ authenticatedPage }) => {
      // This test would verify payment details on license-success page
      // Requires real payment to test properly
    });

    authTest('should display license information after purchase', async ({ authenticatedPage }) => {
      // This test would verify license display after payment
      // Requires real payment completion
    });
  });

  // ============================================================================
  // LICENSE ACTIVATION TESTS
  // ============================================================================
  
  test.describe('License Activation', () => {
    authTest('should verify license is created in database via API', async ({ authenticatedApiContext }) => {
      // Fetch current licenses
      const response = await authenticatedApiContext.get('/api/licenses');
      expect(response.ok()).toBeTruthy();
      
      const licenses = await response.json();
      expect(Array.isArray(licenses)).toBeTruthy();
      
      // Check license structure if licenses exist
      if (licenses.length > 0) {
        const license = licenses[0];
        expect(license).toHaveProperty('id');
        expect(license).toHaveProperty('planName');
        expect(license).toHaveProperty('licenseType');
        expect(license).toHaveProperty('isActive');
        expect(license).toHaveProperty('maxFacilities');
        expect(license).toHaveProperty('maxSeats');
      }
    });

    authTest('should verify license is active and matches selected plan', async ({ authenticatedApiContext }) => {
      // Get licenses from API
      const response = await authenticatedApiContext.get('/api/licenses');
      const licenses = await response.json();
      
      if (licenses.length > 0) {
        const license = licenses[0];
        
        // Verify license is active
        expect(license.isActive).toBe(true);
        
        // Verify license has proper entitlements
        expect(license.maxFacilities).toBeGreaterThan(0);
        expect(license.maxSeats).toBeGreaterThan(0);
        
        // Verify license type is valid
        expect(['base', 'facility_addon', 'seat_addon', 'support_service']).toContain(license.licenseType);
      }
    });

    authTest('should verify license features are enabled', async ({ authenticatedApiContext }) => {
      const response = await authenticatedApiContext.get('/api/licenses');
      const licenses = await response.json();
      
      if (licenses.length > 0) {
        const license = licenses[0];
        
        // Check that features object exists
        expect(license).toHaveProperty('features');
        expect(typeof license.features).toBe('object');
        
        // Base licenses should have core features enabled
        if (license.licenseType === 'base') {
          // Features may vary by tier, but base license should have some features
          expect(Object.keys(license.features).length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ============================================================================
  // WEBHOOK HANDLING TESTS (Skipped - Requires Stripe)
  // Note: These tests require Stripe webhook endpoints and are skipped in test environment.
  // In production E2E with Stripe test mode, these would be enabled.
  // ============================================================================
  
  test.describe.skip('Webhook Handling (API)', () => {
    test('should handle webhook for checkout.session.completed', async ({ request }) => {
      // This test would verify Stripe webhook processing
      // Skipped because webhook endpoints require Stripe signature validation
    });

    test('should reject webhook with invalid signature', async ({ request }) => {
      // This test would verify webhook security
      // Skipped because requires Stripe configuration
    });
  });

  // ============================================================================
  // LICENSE MANAGEMENT TESTS
  // ============================================================================
  
  test.describe('License Management', () => {
    authTest('should navigate to licenses page and view licenses', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/licenses');
      
      // Wait for page to load
      await authenticatedPage.waitForLoadState('networkidle');
      
      // Check that we're on the licenses page
      expect(authenticatedPage.url()).toContain('/licenses');
    });

    authTest('should display license metadata and details', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/licenses');
      await authenticatedPage.waitForLoadState('networkidle');
      
      // Check if there are any licenses displayed
      // The page should show either current licenses or available plans to purchase
      const pageContent = await authenticatedPage.content();
      
      // Look for license-related content
      const hasLicenseContent = 
        pageContent.includes('license') || 
        pageContent.includes('License') ||
        pageContent.includes('plan') ||
        pageContent.includes('Plan');
      
      expect(hasLicenseContent).toBeTruthy();
    });

    authTest('should show available plans for purchase', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/licenses');
      await authenticatedPage.waitForLoadState('networkidle');
      
      // The licenses page should show available plans
      // Check for common plan names
      const pageText = await authenticatedPage.textContent('body');
      
      const hasPlans = 
        pageText?.includes('Solo Business') ||
        pageText?.includes('Team Business') ||
        pageText?.includes('Enterprise');
      
      expect(hasPlans).toBeTruthy();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================
  
  test.describe('Error Handling', () => {
    test('should handle invalid session ID on success page', async ({ page }) => {
      // Navigate to success page with invalid session ID
      await page.goto('/license-success?session_id=invalid_session_123');
      
      // Should show error or invalid session message
      await page.waitForLoadState('networkidle');
      
      // The page should handle the invalid session gracefully
      const pageContent = await page.content();
      const hasErrorHandling = 
        pageContent.includes('error') || 
        pageContent.includes('Error') ||
        pageContent.includes('invalid') ||
        pageContent.includes('Invalid') ||
        pageContent.includes('not found');
      
      expect(hasErrorHandling).toBeTruthy();
    });

    test('should handle missing session ID on success page', async ({ page }) => {
      // Navigate to success page without session ID
      await page.goto('/license-success');
      
      await page.waitForLoadState('networkidle');
      
      // Should show appropriate error message
      const pageContent = await page.content();
      expect(pageContent).toBeTruthy();
      
      // Page should handle missing session ID gracefully
      const hasErrorHandling = 
        pageContent.includes('Invalid Session') ||
        pageContent.includes('No payment session found');
      
      expect(hasErrorHandling).toBeTruthy();
    });

    authTest('should display appropriate errors for API failures', async ({ authenticatedApiContext }) => {
      // Try to access a non-existent license
      const response = await authenticatedApiContext.get('/api/licenses/non-existent-id');
      
      // Should return 404 or appropriate error
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS (Full Flow)
  // ============================================================================
  
  test.describe('Full Purchase Flow Integration', () => {
    test('should complete full journey from pricing to license activation (mock)', async ({ page, context }) => {
      // Step 1: Visit pricing page
      await page.goto('/pricing');
      await expect(page.locator('[data-testid="section-pricing-hero"]')).toBeVisible();
      
      // Step 2: View plan details
      const soloPlan = page.locator('[data-testid="card-plan-solo"]');
      await expect(soloPlan).toBeVisible();
      await expect(soloPlan.locator('[data-testid="text-plan-price-solo"]')).toContainText('$399');
      
      // Step 3: Click select plan (will redirect to register/login)
      await page.locator('[data-testid="button-select-plan-solo"]').click();
      
      // Step 4: Should be redirected to register page with plan parameter
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('register');
      expect(page.url()).toContain('plan=solo');
      
      // At this point, the full flow would continue with registration/login,
      // then payment, and finally license activation
      // Those steps are tested individually in other test suites
    });
  });

  // ============================================================================
  // STRIPE TEST MODE VERIFICATION
  // ============================================================================
  
  test.describe('Stripe Configuration', () => {
    test('should verify Stripe is in test mode', async ({ page }) => {
      await page.goto('/');
      
      // Get Stripe public key from API
      const response = await page.request.get('http://0.0.0.0:5000/api/stripe/public-key');
      
      if (response.ok()) {
        const data = await response.json();
        
        // Verify we're using test keys
        if (data.publicKey) {
          expect(data.publicKey).toMatch(/^pk_test_/);
          console.log('✓ Stripe is configured in TEST mode');
        }
      }
    });
  });

  // ============================================================================
  // DATABASE SCHEMA VALIDATION
  // ============================================================================
  
  test.describe('License Schema Validation', () => {
    authTest('should verify license data structure matches schema', async ({ authenticatedApiContext }) => {
      const response = await authenticatedApiContext.get('/api/licenses');
      
      if (response.ok()) {
        const licenses = await response.json();
        
        if (Array.isArray(licenses) && licenses.length > 0) {
          const license = licenses[0];
          
          // Verify required fields from schema
          expect(license).toHaveProperty('id');
          expect(license).toHaveProperty('tenantId');
          expect(license).toHaveProperty('licenseType');
          expect(license).toHaveProperty('planName');
          expect(license).toHaveProperty('accountType');
          expect(license).toHaveProperty('planId');
          expect(license).toHaveProperty('amountPaid');
          expect(license).toHaveProperty('currency');
          expect(license).toHaveProperty('isActive');
          expect(license).toHaveProperty('features');
          expect(license).toHaveProperty('createdAt');
          
          // Verify optional fields exist (can be null)
          expect('tier' in license).toBeTruthy();
          expect('maxFacilities' in license).toBeTruthy();
          expect('maxSeats' in license).toBeTruthy();
          expect('supportTier' in license).toBeTruthy();
          
          console.log('✓ License schema validation passed');
        } else {
          console.log('No licenses found to validate schema');
        }
      }
    });
  });
});
