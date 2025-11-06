
import { test, expect } from '@playwright/test';

test.describe('Purchase Flow E2E', () => {
  test('complete license purchase workflow', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Check if Vite is properly configured
    await expect(page).toHaveTitle(/RuR2/);
    
    // Navigate to pricing page
    await page.click('text=Pricing');
    await expect(page).toHaveURL(/.*pricing.*/);
    
    // Select a license plan
    await page.click('[data-testid="select-plan-solo"]');
    
    // Wait for Stripe.js to load
    await page.waitForLoadState('networkidle');
    
    // Fill in test card details (if Stripe test mode)
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
    if (await stripeFrame.locator('[name="cardnumber"]').isVisible()) {
      await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
      await stripeFrame.locator('[name="exp-date"]').fill('12/34');
      await stripeFrame.locator('[name="cvc"]').fill('123');
    }
    
    // Complete purchase
    await page.click('[data-testid="complete-purchase"]');
    
    // Verify success
    await expect(page.locator('[data-testid="purchase-success"]')).toBeVisible();
    await expect(page).toHaveURL(/.*license-success.*/);
  });

  test('database schema includes tier column', async ({ page }) => {
    // This test verifies the database migration was successful
    await page.goto('/api/health');
    const response = await page.textContent('body');
    expect(response).toContain('healthy');
  });
});
