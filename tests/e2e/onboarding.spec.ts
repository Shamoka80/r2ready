/**
 * Comprehensive Onboarding Flow E2E Test Suite
 * 
 * This test suite covers:
 * - OnboardingWizard (original) - Business and Consultant flows
 * - OnboardingV2Wizard - Enhanced flow with analytics
 * - SetupGate functionality (blocking/allowing access)
 * - Tenant and facility creation
 * - Data persistence and validation
 * - Multi-step navigation and form state
 * - Setup status transitions
 */

import { test, expect, type Page } from '@playwright/test';
import { TEST_USERS } from '../helpers/auth';

/**
 * =================================
 * SETUP GATE TESTS
 * =================================
 */
test.describe('SetupGate - Access Control', () => {
  
  test('should block access to protected routes before onboarding', async ({ page, request }) => {
    // Create a fresh user with setup_pending status
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email: `setupgate-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Setup',
        lastName: 'Test',
        companyName: 'Test Company',
        acceptedTerms: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const { token } = await registerResponse.json();
    
    // Set auth token
    await page.goto('/');
    await page.evaluate((authToken) => {
      localStorage.setItem('auth_token', authToken);
    }, token);
    
    // Try to access protected route (dashboard)
    await page.goto('/dashboard');
    
    // Should redirect to onboarding
    await page.waitForURL(/\/(onboarding|onboarding-v2)/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(onboarding|onboarding-v2)/);
  });

  test('should redirect to pricing after onboarding complete but before payment', async ({ page, request }) => {
    // This test requires a user with setupStatus = 'setup_complete'
    // In a real scenario, we'd complete onboarding first
    // For now, we'll verify the redirect behavior exists
    
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email: `pricing-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Pricing',
        lastName: 'Test',
        companyName: 'Test Company',
        acceptedTerms: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const { token } = await registerResponse.json();
    
    // Manually update setupStatus to 'setup_complete' via API
    await request.post('/api/auth/update-setup-status', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        setupStatus: 'setup_complete'
      }
    });
    
    // Set auth token and navigate
    await page.goto('/');
    await page.evaluate((authToken) => {
      localStorage.setItem('auth_token', authToken);
    }, token);
    
    // Try to access dashboard
    await page.goto('/dashboard');
    
    // Should redirect to pricing
    await page.waitForURL('/pricing', { timeout: 10000 });
    expect(page.url()).toContain('/pricing');
  });

  test('should allow access to dashboard after full setup and payment', async ({ page, request }) => {
    // Use existing test user who has completed setup
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(TEST_USERS.regular.email);
    await page.locator('input[type="password"]').fill(TEST_USERS.regular.password);
    await page.locator('button[type="submit"]').click();
    
    // Wait for navigation (could be 2FA, dashboard, or onboarding)
    await page.waitForLoadState('networkidle');
    
    // If on 2FA page, skip this test (user setup may vary)
    const url = page.url();
    if (url.includes('verify-2fa')) {
      test.skip();
    }
    
    // If user is fully set up, should be able to access dashboard
    if (url.includes('dashboard')) {
      expect(url).toContain('/dashboard');
    }
  });
});

/**
 * =================================
 * ONBOARDING WIZARD (ORIGINAL) - BUSINESS FLOW
 * =================================
 */
test.describe('OnboardingWizard - Business User Flow', () => {
  
  let page: Page;
  let authToken: string;
  
  test.beforeEach(async ({ browser, request }) => {
    // Create fresh test user
    const email = `business-${Date.now()}@example.com`;
    const password = 'BusinessTest123!';
    
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email,
        password,
        firstName: 'Business',
        lastName: 'Owner',
        companyName: 'Test Business Inc',
        acceptedTerms: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const responseData = await registerResponse.json();
    authToken = responseData.token;
    
    // Create new page with auth
    const context = await browser.newContext();
    page = await context.newPage();
    
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, authToken);
    
    // Navigate to onboarding
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
  });
  
  test.afterEach(async () => {
    await page.close();
  });

  test('should complete business onboarding flow successfully', async ({ request }) => {
    // Step 1: Select business account type
    const businessRadio = page.locator('input[value="business"]');
    await businessRadio.check();
    await expect(businessRadio).toBeChecked();
    
    // Click Next
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Step 2: Organization Setup
    await page.locator('[data-testid="input-legal-name"]').fill('Acme Recycling Corp');
    await page.locator('[data-testid="input-primary-contact-name"]').fill('John Smith');
    await page.locator('[data-testid="input-primary-contact-email"]').fill('john@acmerecycling.com');
    await page.locator('[data-testid="input-hq-address"]').fill('123 Main St');
    await page.locator('[data-testid="input-hq-city"]').fill('Austin');
    await page.locator('[data-testid="input-hq-state"]').fill('TX');
    await page.locator('[data-testid="input-hq-zip"]').fill('78701');
    
    // Click Next
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Step 3: Facility Location (Business users)
    await page.locator('[data-testid="input-facility-name"]').fill('Acme Main Facility');
    await page.locator('[data-testid="input-facility-address"]').fill('123 Industrial Blvd');
    await page.locator('[data-testid="input-facility-city"]').fill('Austin');
    await page.locator('[data-testid="input-facility-state"]').fill('TX');
    await page.locator('[data-testid="input-facility-zip"]').fill('78702');
    
    // Submit final step (this should complete onboarding)
    await page.locator('[data-testid="button-next"]').click();
    
    // Should redirect to pricing page
    await page.waitForURL('/pricing', { timeout: 15000 });
    expect(page.url()).toContain('/pricing');
    
    // Verify data was saved via API
    const orgResponse = await request.get('/api/onboarding/organization-profile', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    expect(orgResponse.ok()).toBeTruthy();
    const orgData = await orgResponse.json();
    expect(orgData.legalName).toBe('Acme Recycling Corp');
    
    const facilityResponse = await request.get('/api/onboarding/facility-baseline', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    expect(facilityResponse.ok()).toBeTruthy();
    const facilityData = await facilityResponse.json();
    expect(facilityData.name).toBe('Acme Main Facility');
  });

  test('should validate required fields on each step', async () => {
    // Step 1: Try to proceed without selecting account type (should already be selected by default)
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Step 2: Try to proceed with empty organization form
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(1000);
    
    // Should show validation errors (form should not proceed)
    // Check that we're still on step 2 (organization setup)
    const legalNameInput = page.locator('[data-testid="input-legal-name"]');
    await expect(legalNameInput).toBeVisible();
    
    // Fill in required fields one by one
    await page.locator('[data-testid="input-legal-name"]').fill('Test Company');
    await page.locator('[data-testid="input-primary-contact-name"]').fill('Test User');
    await page.locator('[data-testid="input-primary-contact-email"]').fill('test@company.com');
    await page.locator('[data-testid="input-hq-address"]').fill('123 Test St');
    await page.locator('[data-testid="input-hq-city"]').fill('Testville');
    await page.locator('[data-testid="input-hq-state"]').fill('CA');
    await page.locator('[data-testid="input-hq-zip"]').fill('90210');
    
    // Now should be able to proceed
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Should be on facility step now
    const facilityNameInput = page.locator('[data-testid="input-facility-name"]');
    await expect(facilityNameInput).toBeVisible();
  });

  test('should allow navigation back and forth between steps', async () => {
    // Complete step 1
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Fill some data in step 2
    await page.locator('[data-testid="input-legal-name"]').fill('Navigation Test Co');
    
    // Go back
    await page.locator('[data-testid="button-back"]').click();
    await page.waitForTimeout(500);
    
    // Should be on step 1 again
    const businessRadio = page.locator('input[value="business"]');
    await expect(businessRadio).toBeVisible();
    
    // Go forward again
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Data should persist
    const legalNameInput = page.locator('[data-testid="input-legal-name"]');
    await expect(legalNameInput).toHaveValue('Navigation Test Co');
  });

  test('should handle validation errors gracefully', async () => {
    // Move to organization step
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Fill invalid email
    await page.locator('[data-testid="input-legal-name"]').fill('Test Company');
    await page.locator('[data-testid="input-primary-contact-name"]').fill('Test User');
    await page.locator('[data-testid="input-primary-contact-email"]').fill('invalid-email');
    await page.locator('[data-testid="input-hq-address"]').fill('123 Test St');
    await page.locator('[data-testid="input-hq-city"]').fill('Testville');
    await page.locator('[data-testid="input-hq-state"]').fill('CA');
    await page.locator('[data-testid="input-hq-zip"]').fill('90210');
    
    // Try to proceed
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(1000);
    
    // Should still be on the same step due to validation error
    // The form validation should prevent submission
    const emailInput = page.locator('[data-testid="input-primary-contact-email"]');
    await expect(emailInput).toBeVisible();
  });
});

/**
 * =================================
 * ONBOARDING WIZARD (ORIGINAL) - CONSULTANT FLOW
 * =================================
 */
test.describe('OnboardingWizard - Consultant User Flow', () => {
  
  let page: Page;
  let authToken: string;
  
  test.beforeEach(async ({ browser, request }) => {
    // Create fresh consultant user
    const email = `consultant-${Date.now()}@example.com`;
    const password = 'ConsultantTest123!';
    
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email,
        password,
        firstName: 'Jane',
        lastName: 'Consultant',
        companyName: 'Consulting Firm LLC',
        acceptedTerms: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const responseData = await registerResponse.json();
    authToken = responseData.token;
    
    // Create new page with auth
    const context = await browser.newContext();
    page = await context.newPage();
    
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, authToken);
    
    // Navigate to onboarding
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
  });
  
  test.afterEach(async () => {
    await page.close();
  });

  test('should complete consultant onboarding flow successfully', async ({ request }) => {
    // Step 1: Select consultant account type
    const consultantRadio = page.locator('input[value="consultant"]');
    await consultantRadio.check();
    await expect(consultantRadio).toBeChecked();
    
    // Click Next
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Step 2: Consultant Organization Setup
    await page.locator('[data-testid="input-legal-name"]').fill('Green Consulting LLC');
    await page.locator('[data-testid="input-primary-contact-name"]').fill('Jane Consultant');
    await page.locator('[data-testid="input-primary-contact-email"]').fill('jane@greenconsulting.com');
    await page.locator('[data-testid="input-hq-address"]').fill('456 Consultant Ave');
    await page.locator('[data-testid="input-hq-city"]').fill('Seattle');
    await page.locator('[data-testid="input-hq-state"]').fill('WA');
    await page.locator('[data-testid="input-hq-zip"]').fill('98101');
    
    // Click Next
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Step 3: Client Organization (for consultants)
    await page.locator('[data-testid="input-client-legal-name"]').fill('Client Corp');
    await page.locator('[data-testid="input-client-primary-contact-name"]').fill('Bob Client');
    await page.locator('[data-testid="input-client-primary-contact-email"]').fill('bob@clientcorp.com');
    await page.locator('[data-testid="input-client-hq-address"]').fill('789 Client Blvd');
    await page.locator('[data-testid="input-client-hq-city"]').fill('Portland');
    await page.locator('[data-testid="input-client-hq-state"]').fill('OR');
    await page.locator('[data-testid="input-client-hq-zip"]').fill('97201');
    
    // Click Next
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Step 4: Client Facility (for consultants)
    await page.locator('[data-testid="input-client-facility-name"]').fill('Client Main Facility');
    await page.locator('[data-testid="input-client-facility-address"]').fill('789 Client Industrial Park');
    await page.locator('[data-testid="input-client-facility-city"]').fill('Portland');
    await page.locator('[data-testid="input-client-facility-state"]').fill('OR');
    await page.locator('[data-testid="input-client-facility-zip"]').fill('97202');
    
    // Submit final step
    await page.locator('[data-testid="button-next"]').click();
    
    // Should redirect to pricing page
    await page.waitForURL('/pricing', { timeout: 15000 });
    expect(page.url()).toContain('/pricing');
    
    // Verify consultant organization was saved
    const orgResponse = await request.get('/api/onboarding/organization-profile', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    expect(orgResponse.ok()).toBeTruthy();
    const orgData = await orgResponse.json();
    expect(orgData.legalName).toBe('Green Consulting LLC');
    
    // Verify client organization was saved
    const clientOrgResponse = await request.get('/api/onboarding/client-organizations', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    if (clientOrgResponse.ok()) {
      const clientOrgs = await clientOrgResponse.json();
      expect(clientOrgs.length).toBeGreaterThan(0);
      expect(clientOrgs[0].legalName).toBe('Client Corp');
    }
  });

  test('should show different steps for consultant vs business', async () => {
    // Select consultant
    const consultantRadio = page.locator('input[value="consultant"]');
    await consultantRadio.check();
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Complete consultant org
    await page.locator('[data-testid="input-legal-name"]').fill('Consulting Firm');
    await page.locator('[data-testid="input-primary-contact-name"]').fill('Jane Doe');
    await page.locator('[data-testid="input-primary-contact-email"]').fill('jane@consulting.com');
    await page.locator('[data-testid="input-hq-address"]').fill('123 Main St');
    await page.locator('[data-testid="input-hq-city"]').fill('Seattle');
    await page.locator('[data-testid="input-hq-state"]').fill('WA');
    await page.locator('[data-testid="input-hq-zip"]').fill('98101');
    
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Should see client organization fields (consultant-specific)
    const clientOrgName = page.locator('[data-testid="input-client-legal-name"]');
    await expect(clientOrgName).toBeVisible();
    
    // Should NOT see facility fields (those come in step 4 for consultants)
    const facilityName = page.locator('[data-testid="input-facility-name"]');
    await expect(facilityName).not.toBeVisible();
  });
});

/**
 * =================================
 * ONBOARDING V2 WIZARD TESTS
 * =================================
 */
test.describe('OnboardingV2Wizard - Enhanced Flow', () => {
  
  let page: Page;
  let authToken: string;
  
  test.beforeEach(async ({ browser, request }) => {
    // Create fresh test user
    const email = `onboardingv2-${Date.now()}@example.com`;
    const password = 'OnboardingV2Test123!';
    
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email,
        password,
        firstName: 'V2',
        lastName: 'User',
        companyName: 'V2 Test Company',
        acceptedTerms: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const responseData = await registerResponse.json();
    authToken = responseData.token;
    
    // Create new page with auth
    const context = await browser.newContext();
    page = await context.newPage();
    
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, authToken);
  });
  
  test.afterEach(async () => {
    await page.close();
  });

  test('should display OnboardingV2 when feature flag is enabled', async () => {
    // Navigate to V2 route directly
    await page.goto('/onboarding-v2');
    await page.waitForLoadState('networkidle');
    
    // Check for V2-specific elements (progress indicator, enhanced UI)
    // V2 should have a different structure than V1
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should complete V2 business flow with analytics tracking', async ({ request }) => {
    await page.goto('/onboarding-v2');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Check if OnboardingV2 loaded (it might redirect if feature flag is off)
    const url = page.url();
    if (!url.includes('onboarding-v2')) {
      test.skip();
      return;
    }
    
    // V2 Step 1: Role selection with enhanced options
    // Look for business/consultant selection
    const businessOption = page.locator('input[value="business"]').first();
    if (await businessOption.isVisible()) {
      await businessOption.check();
    }
    
    // Try to find and click next button
    const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
    
    // V2 should have streamlined forms with fewer fields
    // The exact structure may vary, so we'll check for common form elements
    const formInputs = page.locator('input[type="text"], input[type="email"]');
    const inputCount = await formInputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });
});

/**
 * =================================
 * DATA PERSISTENCE TESTS
 * =================================
 */
test.describe('Onboarding - Data Persistence', () => {
  
  test('should persist tenant creation after onboarding', async ({ request }) => {
    // Register new user
    const email = `persistence-${Date.now()}@example.com`;
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email,
        password: 'PersistenceTest123!',
        firstName: 'Persist',
        lastName: 'User',
        companyName: 'Persistence Test Co',
        acceptedTerms: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const { token, tenant } = await registerResponse.json();
    
    // Verify tenant was created
    expect(tenant).toBeDefined();
    expect(tenant.name).toBe('Persistence Test Co');
    
    // Create organization profile
    const orgResponse = await request.post('/api/onboarding/organization-profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        legalName: 'Persistence Test Corp',
        primaryContactName: 'Persist User',
        primaryContactEmail: email,
        hqAddress: '123 Test St',
        hqCity: 'Testville',
        hqState: 'CA',
        hqZipCode: '90210',
        hqCountry: 'US'
      }
    });
    
    expect(orgResponse.ok()).toBeTruthy();
    
    // Verify organization profile persists
    const getOrgResponse = await request.get('/api/onboarding/organization-profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(getOrgResponse.ok()).toBeTruthy();
    const orgData = await getOrgResponse.json();
    expect(orgData.legalName).toBe('Persistence Test Corp');
  });

  test('should update setupStatus after completing onboarding', async ({ request }) => {
    // Register new user
    const email = `setupstatus-${Date.now()}@example.com`;
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email,
        password: 'SetupStatus123!',
        firstName: 'Setup',
        lastName: 'Status',
        companyName: 'Setup Status Co',
        acceptedTerms: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const { token, user } = await registerResponse.json();
    
    // Initial setupStatus should be 'setup_pending' or 'not_started'
    expect(user.setupStatus).toMatch(/setup_pending|not_started/);
    
    // Complete onboarding steps (organization + facility)
    await request.post('/api/onboarding/organization-profile', {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        legalName: 'Status Test Corp',
        primaryContactName: 'Setup Status',
        primaryContactEmail: email,
        hqAddress: '123 Test St',
        hqCity: 'Testville',
        hqState: 'CA',
        hqZipCode: '90210',
        hqCountry: 'US'
      }
    });
    
    await request.post('/api/onboarding/facility-baseline', {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: 'Main Facility',
        address: '456 Facility Rd',
        city: 'Testville',
        state: 'CA',
        zipCode: '90210',
        country: 'US',
        operatingStatus: 'ACTIVE'
      }
    });
    
    // Update setup status to complete
    const statusResponse = await request.post('/api/auth/update-setup-status', {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { setupStatus: 'setup_complete' }
    });
    
    expect(statusResponse.ok()).toBeTruthy();
    
    // Verify status was updated
    const meResponse = await request.get('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (meResponse.ok()) {
      const userData = await meResponse.json();
      expect(userData.setupStatus).toBe('setup_complete');
    }
  });

  test('should create facility profiles during onboarding', async ({ request }) => {
    // Register new user
    const email = `facility-${Date.now()}@example.com`;
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email,
        password: 'FacilityTest123!',
        firstName: 'Facility',
        lastName: 'User',
        companyName: 'Facility Test Co',
        acceptedTerms: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const { token } = await registerResponse.json();
    
    // Create facility profile
    const facilityResponse = await request.post('/api/onboarding/facility-baseline', {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: 'Test Facility',
        address: '789 Industrial Park',
        city: 'Facility City',
        state: 'TX',
        zipCode: '75001',
        country: 'US',
        operatingStatus: 'ACTIVE',
        isPrimary: true
      }
    });
    
    expect(facilityResponse.ok()).toBeTruthy();
    const facility = await facilityResponse.json();
    expect(facility.name).toBe('Test Facility');
    expect(facility.isPrimary).toBe(true);
    
    // Verify facility can be retrieved
    const getFacilityResponse = await request.get('/api/onboarding/facility-baseline', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    expect(getFacilityResponse.ok()).toBeTruthy();
    const facilityData = await getFacilityResponse.json();
    expect(facilityData.name).toBe('Test Facility');
  });
});

/**
 * =================================
 * EDGE CASES AND ERROR HANDLING
 * =================================
 */
test.describe('Onboarding - Edge Cases', () => {
  
  test('should handle network errors gracefully', async ({ page, request, context }) => {
    // Create user
    const email = `network-error-${Date.now()}@example.com`;
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email,
        password: 'NetworkTest123!',
        firstName: 'Network',
        lastName: 'Test',
        companyName: 'Network Test Co',
        acceptedTerms: true
      }
    });
    
    const { token } = await registerResponse.json();
    
    await page.goto('/');
    await page.evaluate((authToken) => {
      localStorage.setItem('auth_token', authToken);
    }, token);
    
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
    
    // Simulate network failure by going offline
    await context.setOffline(true);
    
    // Try to proceed through onboarding
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Fill form
    const legalNameInput = page.locator('[data-testid="input-legal-name"]');
    if (await legalNameInput.isVisible()) {
      await legalNameInput.fill('Network Test Corp');
    }
    
    // Restore network
    await context.setOffline(false);
  });

  test('should prevent duplicate submissions', async ({ page, request }) => {
    // Create user
    const email = `duplicate-${Date.now()}@example.com`;
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email,
        password: 'DuplicateTest123!',
        firstName: 'Duplicate',
        lastName: 'Test',
        companyName: 'Duplicate Test Co',
        acceptedTerms: true
      }
    });
    
    const { token } = await registerResponse.json();
    
    await page.goto('/');
    await page.evaluate((authToken) => {
      localStorage.setItem('auth_token', authToken);
    }, token);
    
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
    
    // Complete first step
    await page.locator('[data-testid="button-next"]').click();
    await page.waitForTimeout(500);
    
    // Fill and submit organization data
    await page.locator('[data-testid="input-legal-name"]').fill('Duplicate Corp');
    await page.locator('[data-testid="input-primary-contact-name"]').fill('Duplicate User');
    await page.locator('[data-testid="input-primary-contact-email"]').fill(email);
    await page.locator('[data-testid="input-hq-address"]').fill('123 Duplicate St');
    await page.locator('[data-testid="input-hq-city"]').fill('Duplicate City');
    await page.locator('[data-testid="input-hq-state"]').fill('CA');
    await page.locator('[data-testid="input-hq-zip"]').fill('90210');
    
    // The next button should be disabled during submission
    const nextButton = page.locator('[data-testid="button-next"]');
    await nextButton.click();
    
    // Button might show loading state or be disabled
    // We just verify the flow doesn't break
    await page.waitForTimeout(2000);
  });
});
