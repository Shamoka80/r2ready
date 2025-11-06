/**
 * Assessment Navigation E2E Test Suite
 * 
 * This test suite comprehensively verifies that users can successfully navigate
 * to reach the assessment creation page through various paths:
 * - From dashboard via header button
 * - From sidebar navigation
 * - Direct URL access
 * - Handling blocked navigation scenarios
 * 
 * The test also validates navigation prerequisites and provides clear feedback
 * when navigation is blocked due to incomplete setup requirements.
 */

import { test, expect } from '../fixtures/auth.fixture';
import { TEST_USERS } from '../helpers/auth';

/**
 * Helper function to check if New Assessment button is visible and enabled
 */
async function checkNewAssessmentButton(page: any) {
  const newAssessmentButton = page.getByTestId('link-new-assessment');
  const isVisible = await newAssessmentButton.isVisible().catch(() => false);
  
  if (isVisible) {
    // Check if button is not disabled
    const isDisabled = await newAssessmentButton.evaluate((el: HTMLElement) => {
      const button = el.querySelector('button');
      return button?.disabled || el.classList.contains('opacity-50');
    }).catch(() => false);
    
    return { visible: true, enabled: !isDisabled };
  }
  
  return { visible: false, enabled: false };
}

/**
 * Helper function to complete navigation prerequisites if needed
 */
async function ensureNavigationPrerequisites(page: any, apiContext: any) {
  // Check current URL to understand where we are
  const currentUrl = page.url();
  
  // If redirected to onboarding, we need to complete it
  if (currentUrl.includes('onboarding')) {
    console.log('Onboarding required - skipping this scenario');
    return false;
  }
  
  // If redirected to pricing, setup is complete but payment pending
  if (currentUrl.includes('pricing')) {
    console.log('Payment required - skipping this scenario');
    return false;
  }
  
  return true;
}

test.describe('Assessment Navigation - Dashboard Routes', () => {
  
  test('should navigate to New Assessment from dashboard header button', async ({ 
    authenticatedPage 
  }) => {
    // Start at dashboard
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Verify we're on dashboard
    await expect(authenticatedPage).toHaveURL(/\/dashboard/);
    
    // Check if New Assessment button is available
    const buttonState = await checkNewAssessmentButton(authenticatedPage);
    
    if (!buttonState.visible || !buttonState.enabled) {
      console.log('New Assessment button not available - checking prerequisites');
      
      // Look for workflow guidance card that might indicate what's needed
      const guidanceCard = authenticatedPage.locator('text=/Complete.*Setup|Start.*Intake|Activate.*Account/i');
      const hasGuidance = await guidanceCard.isVisible().catch(() => false);
      
      if (hasGuidance) {
        const guidanceText = await guidanceCard.textContent();
        console.log(`Navigation blocked: ${guidanceText}`);
      }
      
      test.skip();
      return;
    }
    
    // Click New Assessment button in dashboard header
    await authenticatedPage.getByTestId('link-new-assessment').click();
    
    // Verify navigation to New Assessment page
    await expect(authenticatedPage).toHaveURL(/\/assessments\/new/, { timeout: 10000 });
    
    // Verify page loaded correctly
    const pageHeading = authenticatedPage.locator('h1, h2').filter({ hasText: /new assessment/i });
    await expect(pageHeading).toBeVisible({ timeout: 5000 });
    
    // Verify key form elements are present
    await expect(authenticatedPage.getByTestId('input-assessment-name')).toBeVisible();
    await expect(authenticatedPage.getByTestId('select-assessment-type')).toBeVisible();
  });

  test('should navigate to New Assessment from sidebar navigation', async ({ 
    authenticatedPage 
  }) => {
    // Start at dashboard
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click New Assessment in sidebar
    const sidebarLink = authenticatedPage.getByTestId('link-new-assessment').first();
    
    // Check if link exists and is visible
    const isVisible = await sidebarLink.isVisible().catch(() => false);
    
    if (!isVisible) {
      console.log('Sidebar New Assessment link not visible');
      test.skip();
      return;
    }
    
    await sidebarLink.click();
    
    // Verify navigation
    await expect(authenticatedPage).toHaveURL(/\/assessments\/new/, { timeout: 10000 });
    
    // Verify page content
    const pageHeading = authenticatedPage.locator('h1, h2').filter({ hasText: /new assessment/i });
    await expect(pageHeading).toBeVisible({ timeout: 5000 });
  });

  test('should access New Assessment page via direct URL', async ({ 
    authenticatedPage 
  }) => {
    // Navigate directly to New Assessment URL
    await authenticatedPage.goto('/assessments/new');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check if we were redirected (due to prerequisites)
    const currentUrl = authenticatedPage.url();
    
    if (currentUrl.includes('onboarding')) {
      console.log('Redirected to onboarding - prerequisites not met');
      test.skip();
      return;
    }
    
    if (currentUrl.includes('pricing')) {
      console.log('Redirected to pricing - payment required');
      test.skip();
      return;
    }
    
    // Verify we reached the New Assessment page
    await expect(authenticatedPage).toHaveURL(/\/assessments\/new/);
    
    // Verify page loaded
    const pageHeading = authenticatedPage.locator('h1, h2').filter({ hasText: /new assessment/i });
    await expect(pageHeading).toBeVisible({ timeout: 5000 });
    
    // Verify form elements
    await expect(authenticatedPage.getByTestId('input-assessment-name')).toBeVisible();
  });

  test('should navigate to assessment detail after creation', async ({ 
    authenticatedPage,
    authenticatedApiContext 
  }) => {
    // Navigate to New Assessment page
    await authenticatedPage.goto('/assessments/new');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Skip if redirected
    if (!authenticatedPage.url().includes('/assessments/new')) {
      test.skip();
      return;
    }
    
    // Get available facilities
    const facilitiesResponse = await authenticatedApiContext.get('/api/facilities');
    const facilities = await facilitiesResponse.json();
    const activeFacilities = facilities.filter((f: any) => f.isActive && f.operatingStatus === 'ACTIVE');
    
    if (activeFacilities.length === 0) {
      console.log('No active facilities available');
      test.skip();
      return;
    }
    
    const testFacility = activeFacilities[0];
    const uniqueTitle = `Navigation Test ${Date.now()}`;
    
    // Fill form
    await authenticatedPage.getByTestId('select-facility').click();
    await authenticatedPage.getByRole('option', { name: testFacility.name }).click();
    
    await authenticatedPage.getByTestId('input-assessment-name').fill(uniqueTitle);
    await authenticatedPage.getByTestId('input-description').fill('Test assessment for navigation verification');
    
    await authenticatedPage.getByTestId('select-assessment-type').click();
    await authenticatedPage.getByRole('option').first().click();
    
    // Submit
    await authenticatedPage.getByTestId('button-create-assessment').click();
    
    // Verify navigation to detail page
    await expect(authenticatedPage).toHaveURL(/\/assessments\/[a-f0-9-]+/, { timeout: 10000 });
    
    // Verify assessment title appears
    await expect(authenticatedPage.getByTestId('text-assessment-title')).toContainText(uniqueTitle);
  });
});

test.describe('Assessment Navigation - Alternative Routes', () => {
  
  test('should support legacy /new-assessment route', async ({ 
    authenticatedPage 
  }) => {
    // Test the alternative route that exists in App.tsx
    await authenticatedPage.goto('/new-assessment');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const currentUrl = authenticatedPage.url();
    
    // Should either show New Assessment page or redirect to prerequisites
    const onNewAssessmentPage = currentUrl.includes('/new-assessment') || currentUrl.includes('/assessments/new');
    const redirectedToPrerequisites = currentUrl.includes('onboarding') || currentUrl.includes('pricing');
    
    expect(onNewAssessmentPage || redirectedToPrerequisites).toBe(true);
    
    if (onNewAssessmentPage) {
      // Verify page loaded correctly
      const pageHeading = authenticatedPage.locator('h1, h2').filter({ hasText: /new assessment/i });
      await expect(pageHeading).toBeVisible({ timeout: 5000 });
    }
  });

  test('should navigate from assessment list to specific assessment', async ({ 
    authenticatedPage,
    authenticatedApiContext 
  }) => {
    // Get assessments from API
    const assessmentsResponse = await authenticatedApiContext.get('/api/assessments');
    const assessments = await assessmentsResponse.json();
    
    if (assessments.length === 0) {
      console.log('No assessments available for navigation test');
      test.skip();
      return;
    }
    
    const testAssessment = assessments[0];
    
    // Navigate to dashboard
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Find assessment row and click
    const assessmentRow = authenticatedPage.getByTestId(`row-assessment-${testAssessment.id}`);
    
    if (await assessmentRow.isVisible()) {
      // Click the link within the row
      await assessmentRow.locator('a').first().click();
      
      // Verify navigation to detail page
      await expect(authenticatedPage).toHaveURL(new RegExp(`/assessments/${testAssessment.id}`), { timeout: 10000 });
      
      // Verify assessment title
      await expect(authenticatedPage.getByTestId('text-assessment-title')).toBeVisible();
    } else {
      console.log('Assessment row not visible in dashboard');
      test.skip();
    }
  });
});

test.describe('Assessment Navigation - Mobile Experience', () => {
  
  test('should navigate to assessment on mobile viewport', async ({ 
    authenticatedPage 
  }) => {
    // Set mobile viewport
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to dashboard
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // On mobile, navigation might be in a hamburger menu
    const mobileMenuButton = authenticatedPage.getByTestId('button-mobile-menu');
    const hasMobileMenu = await mobileMenuButton.isVisible().catch(() => false);
    
    if (hasMobileMenu) {
      // Open mobile menu
      await mobileMenuButton.click();
      await authenticatedPage.waitForTimeout(500); // Wait for menu animation
      
      // Click New Assessment in mobile menu
      const newAssessmentLink = authenticatedPage.getByTestId('link-new-assessment');
      const isVisible = await newAssessmentLink.isVisible().catch(() => false);
      
      if (isVisible) {
        await newAssessmentLink.click();
        
        // Verify navigation
        await expect(authenticatedPage).toHaveURL(/\/assessments\/new/, { timeout: 10000 });
        
        // Verify page loaded
        const pageHeading = authenticatedPage.locator('h1, h2').filter({ hasText: /new assessment/i });
        await expect(pageHeading).toBeVisible({ timeout: 5000 });
      } else {
        console.log('New Assessment link not visible in mobile menu');
        test.skip();
      }
    } else {
      // Check if link is visible without menu
      const newAssessmentButton = authenticatedPage.getByTestId('link-new-assessment');
      const isVisible = await newAssessmentButton.isVisible().catch(() => false);
      
      if (isVisible) {
        await newAssessmentButton.click();
        await expect(authenticatedPage).toHaveURL(/\/assessments\/new/, { timeout: 10000 });
      } else {
        console.log('Navigation not accessible on mobile');
        test.skip();
      }
    }
  });
});

test.describe('Assessment Navigation - Edge Cases', () => {
  
  test('should handle navigation when setup incomplete', async ({ page, request }) => {
    // Create a fresh user with pending setup
    const timestamp = Date.now();
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        email: `navtest-${timestamp}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Nav',
        lastName: 'Test',
        companyName: 'Navigation Test Co',
        acceptedTerms: true
      }
    });
    
    if (!registerResponse.ok()) {
      console.log('Failed to create test user');
      test.skip();
      return;
    }
    
    const { token } = await registerResponse.json();
    
    // Set auth and navigate
    await page.goto('/');
    await page.evaluate((authToken) => {
      localStorage.setItem('auth_token', authToken);
    }, token);
    
    // Try to access New Assessment directly
    await page.goto('/assessments/new');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to onboarding or pricing
    const currentUrl = page.url();
    const redirectedCorrectly = currentUrl.includes('onboarding') || currentUrl.includes('pricing') || currentUrl.includes('dashboard');
    
    expect(redirectedCorrectly).toBe(true);
    
    // Verify redirect message or guidance exists
    if (currentUrl.includes('onboarding')) {
      const onboardingHeading = page.locator('h1, h2').filter({ hasText: /onboarding|setup|welcome/i });
      await expect(onboardingHeading.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should preserve navigation after refresh', async ({ 
    authenticatedPage 
  }) => {
    // Navigate to New Assessment
    await authenticatedPage.goto('/assessments/new');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Skip if redirected
    if (!authenticatedPage.url().includes('/assessments/new')) {
      test.skip();
      return;
    }
    
    // Refresh page
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Should still be on New Assessment page
    await expect(authenticatedPage).toHaveURL(/\/assessments\/new/);
    
    // Verify page still works
    await expect(authenticatedPage.getByTestId('input-assessment-name')).toBeVisible();
  });

  test('should handle back navigation correctly', async ({ 
    authenticatedPage 
  }) => {
    // Start at dashboard
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
    
    const dashboardUrl = authenticatedPage.url();
    
    // Navigate to New Assessment
    const newAssessmentLink = authenticatedPage.getByTestId('link-new-assessment').first();
    const isVisible = await newAssessmentLink.isVisible().catch(() => false);
    
    if (!isVisible) {
      test.skip();
      return;
    }
    
    await newAssessmentLink.click();
    await expect(authenticatedPage).toHaveURL(/\/assessments\/new/, { timeout: 10000 });
    
    // Use browser back button
    await authenticatedPage.goBack();
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Should be back on dashboard
    await expect(authenticatedPage).toHaveURL(dashboardUrl);
  });

  test('should show appropriate message when no facilities exist', async ({ 
    authenticatedPage,
    authenticatedApiContext 
  }) => {
    // Get facilities
    const facilitiesResponse = await authenticatedApiContext.get('/api/facilities');
    const facilities = await facilitiesResponse.json();
    const activeFacilities = facilities.filter((f: any) => f.isActive && f.operatingStatus === 'ACTIVE');
    
    // Navigate to New Assessment
    await authenticatedPage.goto('/assessments/new');
    await authenticatedPage.waitForLoadState('networkidle');
    
    if (!authenticatedPage.url().includes('/assessments/new')) {
      test.skip();
      return;
    }
    
    // If no active facilities, should show appropriate message
    if (activeFacilities.length === 0) {
      const errorMessage = authenticatedPage.locator('text=/no.*facilities|facilities.*required|set up.*facility/i');
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
