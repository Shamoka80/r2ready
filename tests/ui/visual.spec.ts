import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Disable animations to ensure consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  });

  test('Dashboard visual regression', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Wait for content to load
    await expect(page.getByTestId('link-dashboard')).toBeVisible();
    
    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Assessment Detail visual regression', async ({ page }) => {
    await page.goto('/assessments/test-id');
    
    // Wait for assessment content to load
    await expect(page.getByTestId('text-assessment-title')).toBeVisible();
    
    // Take screenshot of the overview tab
    await expect(page).toHaveScreenshot('assessment-detail-overview.png', {
      fullPage: true,
      threshold: 0.2,
    });
    
    // Switch to questions tab and screenshot
    await page.getByTestId('tab-questions').click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    
    await expect(page).toHaveScreenshot('assessment-detail-questions.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Mobile responsive visual regression', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto('/dashboard');
    await expect(page.getByTestId('link-dashboard')).toBeVisible();
    
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});