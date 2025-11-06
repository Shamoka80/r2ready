
import { test, expect } from '@playwright/test';

test.describe('Intake Form Completion Flow', () => {
  test('should complete intake form and successfully navigate to dashboard with assessment creation capability', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-login"]');
    
    // Wait for redirect and verify login
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Navigate to intake form
    await page.goto('/intake-form');
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the intake form
    await expect(page.locator('h2:has-text("R2v3 Intake Form")')).toBeVisible();
    
    // Fill required fields in Section 1 (Legal Entity Information)
    await page.fill('#legalCompanyName', 'Test Company LLC');
    await page.selectOption('select[value=""]', 'CORPORATION');
    await page.fill('#hqStreet', '123 Test Street');
    await page.fill('#hqCity', 'Test City');
    await page.fill('#hqStateProvince', 'Test State');
    await page.fill('#hqCountry', 'United States');
    
    // Navigate through sections filling required fields
    for (let section = 2; section <= 12; section++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
      
      // Fill section-specific required fields
      switch (section) {
        case 2: // Key Personnel
          await page.fill('#primaryR2ContactName', 'John Doe');
          break;
          
        case 3: // Facility Structure
          await page.fill('#totalFacilities', '1');
          await page.selectOption('select', 'SINGLE');
          break;
          
        case 4: // Workforce & Operations
          await page.fill('#totalEmployees', '10');
          await page.fill('#operatingSchedule', 'Monday-Friday 9AM-5PM');
          break;
          
        case 6: // Processing Activities - Critical for filtering
          // Select required processing activities
          await page.check('[data-testid="checkbox-activity-collection"]');
          await page.check('[data-testid="checkbox-equipment-computers"]');
          await page.check('input[id*="electronics-Computers"]');
          break;
          
        case 7: // Downstream Vendors
          await page.fill('[data-testid="input-totalDownstreamVendors"]', '0');
          break;
          
        case 9: // Certification Objectives
          await page.selectOption('[data-testid="select-certificationType"]', 'INITIAL');
          break;
      }
      
      // Wait for auto-save if there are changes
      if ([1, 2, 3, 4, 6, 7, 9].includes(section)) {
        await page.waitForTimeout(1000);
      }
    }
    
    // Verify we're on the final section (12)
    await expect(page.locator('text=Section 12 of 12')).toBeVisible();
    
    // Verify the Complete Intake button is now enabled
    const completeButton = page.locator('[data-testid="button-complete-intake"]');
    await expect(completeButton).toBeVisible();
    await expect(completeButton).toBeEnabled();
    
    // Submit the intake form
    await completeButton.click();
    
    // Wait for submission to complete and navigation
    await page.waitForTimeout(3000);
    
    // Verify successful navigation - should go to either:
    // 1. Assessment creation page directly, or 
    // 2. Dashboard with ability to create assessments
    const currentUrl = page.url();
    
    if (currentUrl.includes('/assessments/')) {
      // Direct navigation to assessment - verify assessment detail page
      await expect(page.locator('h1, h2')).toContainText(['Assessment', 'Company']);
      console.log('✅ Successfully navigated to assessment detail page');
    } else if (currentUrl.includes('/dashboard')) {
      // Dashboard navigation - verify assessment creation is now available
      await expect(page.locator('text=Create New Assessment, text=New Assessment')).toBeVisible();
      
      // Verify no more intake form requirements
      const intakeWarning = page.locator('text=Complete Intake Form, text=Start Intake');
      await expect(intakeWarning).not.toBeVisible();
      
      console.log('✅ Successfully navigated to dashboard with assessment creation enabled');
    } else {
      throw new Error(`Unexpected navigation to: ${currentUrl}`);
    }
    
    // Verify success toast/notification
    const successMessage = page.locator('text=Intake submitted, text=Assessment created, text=successfully');
    await expect(successMessage.first()).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Intake form completion flow working correctly');
  });
  
  test('should handle intake completion errors gracefully', async ({ page }) => {
    // Test error handling for incomplete forms
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-login"]');
    await page.waitForURL('**/dashboard');
    
    await page.goto('/intake-form');
    await page.waitForLoadState('networkidle');
    
    // Navigate to final section without filling required fields
    for (let i = 0; i < 11; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(300);
    }
    
    // Verify button is disabled for incomplete form
    const completeButton = page.locator('[data-testid="button-complete-intake"]');
    await expect(completeButton).toBeDisabled();
    
    console.log('✅ Properly prevents submission of incomplete intake forms');
  });
});
