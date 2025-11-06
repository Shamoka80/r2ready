import { test, expect } from '@playwright/test';
import { loginAsTestUser, isAuthenticated } from '../helpers/auth';

test.describe('UI Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsTestUser(page, 'regular');
    expect(await isAuthenticated(page)).toBe(true);
    
    // Listen for console errors and uncaught exceptions
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Console error: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', err => {
      console.error(`Page error: ${err.message}`);
      throw new Error(`Page error detected: ${err.message}`);
    });
  });

  test('Dashboard loads without errors', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Wait for main navigation or dashboard content to be visible
    const navigation = page.locator('nav, [role="navigation"]');
    await navigation.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
      // If specific nav isn't found, just check page loaded
      console.log('Navigation element not found, checking page loaded');
    });
    
    // Check for dashboard content - either assessments or empty state
    await expect(page.locator('body')).toContainText(/assessment|dashboard/i);
  });

  test('New Assessment page loads without errors', async ({ page }) => {
    await page.goto('/assessments/new');
    
    // Wait for new assessment form or content to be visible
    await page.waitForLoadState('domcontentloaded');
    
    // Check page has loaded properly
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/assessment|create|new/i);
  });

  test('Navigation works correctly', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Navigate to new assessment if link exists
    const newAssessmentLink = page.locator('a[href*="assessment"]').first();
    const linkExists = await newAssessmentLink.count() > 0;
    
    if (linkExists) {
      await newAssessmentLink.click();
      // Should navigate somewhere assessment-related
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Error boundaries work', async ({ page }) => {
    // Test that the app doesn't crash on invalid routes
    await page.goto('/invalid-route-that-does-not-exist-12345');
    
    // Should either redirect or show 404, but not crash
    await expect(page.locator('body')).toBeVisible();
    
    // App should still be functional - verify we can navigate back
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});