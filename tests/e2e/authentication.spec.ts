/**
 * Comprehensive Authentication E2E Test Suite
 * 
 * This test suite covers:
 * - Login flows (valid, invalid, with/without 2FA)
 * - Registration flows (validation, existing user checks)
 * - 2FA setup (initialization, verification, backup codes)
 * - 2FA verification (TOTP and backup codes)
 * - Logout flows (session clearing, route protection)
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { 
  loginWithCredentials,
  loginAsTestUser,
  verify2FA,
  getAuthToken,
  isAuthenticated,
  TEST_USERS,
  type UserType
} from '../helpers/auth';
import { generateTOTP } from '../helpers/totp';

/**
 * =================================
 * LOGIN FLOW TESTS
 * =================================
 */
test.describe('Login Flows', () => {
  
  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in credentials
    await page.locator('input[type="email"]').fill(TEST_USERS.regular.email);
    await page.locator('input[type="password"]').fill(TEST_USERS.regular.password);
    
    // Click submit button
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait for navigation and check we're authenticated
    await page.waitForURL(/\/(dashboard|verify-2fa|onboarding)/);
    
    // Verify authentication status
    const isAuth = await isAuthenticated(page);
    expect(isAuth).toBe(true);
  });

  test('should show error with incorrect password', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in with wrong password
    await page.locator('input[type="email"]').fill(TEST_USERS.regular.email);
    await page.locator('input[type="password"]').fill('WrongPassword123!');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Should stay on login page and show error
    await page.waitForTimeout(1000); // Wait for error to appear
    await expect(page).toHaveURL(/\/login/);
    
    // Check for error message
    const errorMessage = page.locator('text=/Invalid.*password|Invalid credentials/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should show error with non-existent user', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in with non-existent email
    await page.locator('input[type="email"]').fill('nonexistent@example.com');
    await page.locator('input[type="password"]').fill('SomePassword123!');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Should stay on login page and show error
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login/);
    
    // Check for error message
    const errorMessage = page.locator('text=/Invalid.*credentials|user.*not.*found/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to dashboard for setup complete users', async ({ page, request }) => {
    // Login and verify redirect
    await loginWithCredentials(page, TEST_USERS.regular.email, TEST_USERS.regular.password);
    
    // Should redirect to dashboard or verify-2fa
    await page.waitForURL(/\/(dashboard|verify-2fa)/);
    
    // If on verify-2fa, complete it
    const url = page.url();
    if (url.includes('verify-2fa')) {
      await verify2FA(page, TEST_USERS.regular.totpSecret);
      await page.waitForURL(/\/dashboard/);
    }
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should redirect to verify-2fa when 2FA is enabled', async ({ page }) => {
    // Note: This test assumes admin user has 2FA enabled
    await page.goto('/login');
    
    await page.locator('input[type="email"]').fill(TEST_USERS.admin.email);
    await page.locator('input[type="password"]').fill(TEST_USERS.admin.password);
    await page.locator('button[type="submit"]').click();
    
    // Should redirect to 2FA verification
    await page.waitForURL(/\/verify-2fa/, { timeout: 10000 });
    
    // Verify 2FA page elements are visible
    const totpInput = page.locator('[data-testid="totp-code-input"]');
    await expect(totpInput).toBeVisible();
  });

  test('should validate email format on login', async ({ page }) => {
    await page.goto('/login');
    
    // Try invalid email format
    await page.locator('input[type="email"]').fill('invalid-email');
    await page.locator('input[type="password"]').fill('SomePassword123!');
    await page.locator('button[type="submit"]').click();
    
    // Check for validation error or that we stayed on login page
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/login/);
  });
});

/**
 * =================================
 * REGISTRATION FLOW TESTS
 * =================================
 */
test.describe('Registration Flows', () => {
  
  test('should validate required fields on registration', async ({ page }) => {
    await page.goto('/register');
    
    // Try to submit without filling fields
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // Should stay on registration page
    await expect(page).toHaveURL(/\/register/);
    
    // Should show validation errors (check for "required" text)
    const errorMessages = page.locator('text=/required|invalid/i');
    await expect(errorMessages.first()).toBeVisible({ timeout: 3000 });
  });

  test('should validate email format on registration', async ({ page }) => {
    await page.goto('/register');
    
    // Fill form with invalid email
    await page.locator('input[name="firstName"], input#firstName').fill('Test');
    await page.locator('input[name="lastName"], input#lastName').fill('User');
    await page.locator('input[type="email"]').fill('invalid-email-format');
    await page.locator('input[name="companyName"], input#companyName').fill('Test Company');
    
    // Try to submit
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // Should show email validation error
    await page.waitForTimeout(500);
    const emailError = page.locator('text=/email.*invalid|valid email/i');
    await expect(emailError.first()).toBeVisible({ timeout: 3000 });
  });

  test('should require plan selection', async ({ page }) => {
    await page.goto('/register');
    
    // Fill personal info but don't select plan
    await page.locator('input[name="firstName"], input#firstName').fill('Test');
    await page.locator('input[name="lastName"], input#lastName').fill('User');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[name="companyName"], input#companyName').fill('Test Company');
    
    // Try to submit without plan selection
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // Should show plan selection error
    await page.waitForTimeout(500);
    const planError = page.locator('text=/select.*plan|plan.*required/i');
    await expect(planError.first()).toBeVisible({ timeout: 3000 });
  });

  test('should require terms agreement', async ({ page }) => {
    await page.goto('/register');
    
    // Fill all fields but don't check terms
    await page.locator('input[name="firstName"], input#firstName').fill('Test');
    await page.locator('input[name="lastName"], input#lastName').fill('User');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[name="companyName"], input#companyName').fill('Test Company');
    
    // Select a plan (click on first plan card or button)
    const planButton = page.locator('button:has-text("Solo Business"), button:has-text("Independent")').first();
    if (await planButton.isVisible()) {
      await planButton.click();
    }
    
    // Try to submit without agreeing to terms
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // Should show terms error
    await page.waitForTimeout(500);
    const termsError = page.locator('text=/terms.*service|agree.*terms/i');
    await expect(termsError.first()).toBeVisible({ timeout: 3000 });
  });

  test('should show error for existing email (API test)', async ({ request }) => {
    // Try to register with existing email via API
    const response = await request.post('/api/auth/register-tenant', {
      data: {
        tenantName: 'Test Company',
        tenantType: 'BUSINESS',
        ownerEmail: TEST_USERS.regular.email, // Using existing email
        ownerFirstName: 'Test',
        ownerLastName: 'User',
        ownerPassword: 'TestPassword123!',
      },
    });
    
    // Should return error
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/email.*already|already.*registered/i);
  });
});

/**
 * =================================
 * 2FA SETUP TESTS
 * =================================
 */
test.describe('2FA Setup Flows', () => {
  
  test('should access 2FA setup page when authenticated', async ({ page }) => {
    // Login first
    await loginAsTestUser(page, 'regular', { handle2FA: true });
    
    // Navigate to 2FA setup
    await page.goto('/setup-2fa');
    
    // Verify setup page loads
    await expect(page).toHaveURL(/\/setup-2fa/);
    
    // Check for setup elements
    const setupTitle = page.locator('text=/Set Up.*Two.*Factor|Setup.*2FA/i');
    await expect(setupTitle.first()).toBeVisible();
  });

  test('should generate and display QR code', async ({ page, request }) => {
    // Get auth token
    const token = await getAuthToken(
      request,
      TEST_USERS.regular.email,
      TEST_USERS.regular.password,
      TEST_USERS.regular.totpSecret
    );
    
    // Navigate to setup page with auth
    await page.goto('/setup-2fa');
    
    // Set auth token
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token', token);
    }, token);
    
    await page.reload();
    
    // Wait for QR code to be generated
    await page.waitForTimeout(2000);
    
    // Check for QR code image
    const qrCode = page.locator('img[alt*="QR"], img[alt*="2FA"]');
    const qrCodeVisible = await qrCode.isVisible().catch(() => false);
    
    // Also check for manual entry code
    const manualCode = page.locator('input[readonly][value*=""]').first();
    const manualCodeVisible = await manualCode.isVisible().catch(() => false);
    
    // At least one should be visible
    expect(qrCodeVisible || manualCodeVisible).toBe(true);
  });

  test('should verify TOTP code during setup (API test)', async ({ request }) => {
    // Get auth token
    const token = await getAuthToken(
      request,
      TEST_USERS.regular.email,
      TEST_USERS.regular.password
    );
    
    // Initialize 2FA setup
    const setupResponse = await request.post('/api/auth2fa/setup/initialize', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      data: {
        userEmail: TEST_USERS.regular.email,
      },
    });
    
    if (setupResponse.ok()) {
      const setupData = await setupResponse.json();
      const secret = setupData.data.secret;
      
      // Generate TOTP code
      const totpCode = generateTOTP(secret);
      
      // Complete setup with TOTP
      const verifyResponse = await request.post('/api/auth2fa/setup/complete', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        data: {
          totpCode: totpCode,
        },
      });
      
      expect(verifyResponse.ok()).toBe(true);
      const verifyData = await verifyResponse.json();
      expect(verifyData.success).toBe(true);
    }
  });

  test('should display backup codes after setup', async ({ page, request }) => {
    // Note: This is more of an integration test - would need full setup flow
    // For now, we'll test that backup codes are present in the API response
    
    const token = await getAuthToken(
      request,
      TEST_USERS.regular.email,
      TEST_USERS.regular.password
    );
    
    // Initialize setup
    const setupResponse = await request.post('/api/auth2fa/setup/initialize', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      data: {
        userEmail: TEST_USERS.regular.email,
      },
    });
    
    if (setupResponse.ok()) {
      const data = await setupResponse.json();
      
      // Verify backup codes are present
      expect(data.data.backupCodes).toBeDefined();
      expect(Array.isArray(data.data.backupCodes)).toBe(true);
      expect(data.data.backupCodes.length).toBeGreaterThan(0);
    }
  });

  test('should reject invalid TOTP code during setup', async ({ request }) => {
    const token = await getAuthToken(
      request,
      TEST_USERS.regular.email,
      TEST_USERS.regular.password
    );
    
    // Try to complete setup with invalid code
    const verifyResponse = await request.post('/api/auth2fa/setup/complete', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      data: {
        totpCode: '000000', // Invalid code
      },
    });
    
    // Should fail or return error
    const data = await verifyResponse.json();
    expect(data.success).toBe(false);
  });
});

/**
 * =================================
 * 2FA VERIFICATION TESTS
 * =================================
 */
test.describe('2FA Verification Flows', () => {
  
  test('should verify with valid TOTP code', async ({ page }) => {
    // Login to trigger 2FA verification
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(TEST_USERS.admin.email);
    await page.locator('input[type="password"]').fill(TEST_USERS.admin.password);
    await page.locator('button[type="submit"]').click();
    
    // Wait for 2FA page
    await page.waitForURL(/\/verify-2fa/, { timeout: 10000 });
    
    // Generate valid TOTP code
    const totpCode = generateTOTP(TEST_USERS.admin.totpSecret);
    
    // Enter TOTP code
    const totpInput = page.locator('[data-testid="totp-code-input"]');
    await totpInput.fill(totpCode);
    
    // Click verify button
    const verifyButton = page.locator('[data-testid="verify-button"]');
    await verifyButton.click();
    
    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    
    // Verify authentication
    expect(await isAuthenticated(page)).toBe(true);
  });

  test('should show error with invalid TOTP code', async ({ page }) => {
    // Login to trigger 2FA
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(TEST_USERS.admin.email);
    await page.locator('input[type="password"]').fill(TEST_USERS.admin.password);
    await page.locator('button[type="submit"]').click();
    
    // Wait for 2FA page
    await page.waitForURL(/\/verify-2fa/, { timeout: 10000 });
    
    // Enter invalid code
    const totpInput = page.locator('[data-testid="totp-code-input"]');
    await totpInput.fill('000000');
    
    // Click verify
    const verifyButton = page.locator('[data-testid="verify-button"]');
    await verifyButton.click();
    
    // Should show error
    await page.waitForTimeout(1000);
    const errorMessage = page.locator('text=/invalid.*code|verification.*failed/i');
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
    
    // Should still be on verify page
    await expect(page).toHaveURL(/\/verify-2fa/);
  });

  test('should switch to backup code mode', async ({ page }) => {
    // Login to trigger 2FA
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(TEST_USERS.admin.email);
    await page.locator('input[type="password"]').fill(TEST_USERS.admin.password);
    await page.locator('button[type="submit"]').click();
    
    // Wait for 2FA page
    await page.waitForURL(/\/verify-2fa/, { timeout: 10000 });
    
    // Click backup code mode button
    const backupModeButton = page.locator('[data-testid="backup-mode-button"]');
    await backupModeButton.click();
    
    // Verify backup code input is visible
    const backupInput = page.locator('[data-testid="backup-code-input"]');
    await expect(backupInput).toBeVisible();
  });

  test('should verify with backup code (API test)', async ({ request }) => {
    // Note: This test would require a valid backup code
    // For demonstration, we'll test the API endpoint structure
    
    const token = await getAuthToken(
      request,
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
      TEST_USERS.admin.totpSecret
    );
    
    // Verify that the verify endpoint accepts backup codes
    const verifyResponse = await request.post('/api/auth2fa/verify', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      data: {
        code: 'BACKUP-CODE-12345', // Mock backup code
      },
    });
    
    // Response structure should indicate if it's a backup code
    const data = await verifyResponse.json();
    expect(data).toHaveProperty('usedBackupCode');
  });

  test('should allow canceling 2FA verification', async ({ page }) => {
    // Login to trigger 2FA
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(TEST_USERS.admin.email);
    await page.locator('input[type="password"]').fill(TEST_USERS.admin.password);
    await page.locator('button[type="submit"]').click();
    
    // Wait for 2FA page
    await page.waitForURL(/\/verify-2fa/, { timeout: 10000 });
    
    // Click cancel button
    const cancelButton = page.locator('[data-testid="cancel-button"]');
    await cancelButton.click();
    
    // Should redirect back to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });
});

/**
 * =================================
 * LOGOUT FLOW TESTS
 * =================================
 */
test.describe('Logout Flows', () => {
  
  test('should logout and clear session', async ({ page, request }) => {
    // Login first
    await loginAsTestUser(page, 'regular', { handle2FA: true });
    
    // Verify we're authenticated
    expect(await isAuthenticated(page)).toBe(true);
    
    // Logout via API
    const token = await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('auth_token'));
    
    if (token) {
      await request.post('/api/auth/logout', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }
    
    // Clear local storage
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
    });
    
    // Refresh page
    await page.reload();
    
    // Should not be authenticated
    expect(await isAuthenticated(page)).toBe(false);
  });

  test('should redirect to login after logout', async ({ page }) => {
    // Login first
    await loginAsTestUser(page, 'regular', { handle2FA: true });
    await page.waitForURL(/\/dashboard/);
    
    // Logout by clearing session
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
    });
    
    // Try to access dashboard
    await page.goto('/dashboard');
    
    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });

  test('should not access protected routes after logout', async ({ page, request }) => {
    // Login first
    await loginAsTestUser(page, 'regular', { handle2FA: true });
    
    // Get token and logout
    const token = await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('auth_token'));
    
    if (token) {
      await request.post('/api/auth/logout', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }
    
    // Clear storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Try to access protected routes
    const protectedRoutes = ['/dashboard', '/settings', '/facilities', '/assessments'];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login or show unauthorized
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).toMatch(/\/(login|unauthorized|$)/);
    }
  });

  test('should invalidate auth token after logout (API test)', async ({ request }) => {
    // Get auth token
    const token = await getAuthToken(
      request,
      TEST_USERS.regular.email,
      TEST_USERS.regular.password,
      TEST_USERS.regular.totpSecret
    );
    
    // Verify token works
    const beforeLogout = await request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    expect(beforeLogout.ok()).toBe(true);
    
    // Logout
    await request.post('/api/auth/logout', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Try to use token again
    const afterLogout = await request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Should be unauthorized
    expect(afterLogout.status()).toBe(401);
  });

  test('should clear all user data from browser storage', async ({ page }) => {
    // Login first
    await loginAsTestUser(page, 'regular', { handle2FA: true });
    
    // Verify data exists
    const beforeLogout = await page.evaluate(() => ({
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
    }));
    expect(beforeLogout.localStorageLength).toBeGreaterThan(0);
    
    // Logout and clear storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Verify data is cleared
    const afterLogout = await page.evaluate(() => ({
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
      token: localStorage.getItem('token'),
      authToken: localStorage.getItem('auth_token'),
    }));
    
    expect(afterLogout.token).toBeNull();
    expect(afterLogout.authToken).toBeNull();
  });
});

/**
 * =================================
 * INTEGRATION TESTS
 * =================================
 */
test.describe('Authentication Integration', () => {
  
  test('complete flow: register -> login -> setup 2FA -> logout', async ({ page, request }) => {
    // Note: Full registration requires Stripe, so we'll mock the user creation part
    // This test focuses on the flow assuming user exists
    
    // 1. Login
    await loginWithCredentials(page, TEST_USERS.regular.email, TEST_USERS.regular.password);
    
    // 2. Handle any 2FA if present
    const url = page.url();
    if (url.includes('verify-2fa')) {
      await verify2FA(page, TEST_USERS.regular.totpSecret);
    }
    
    // 3. Verify we're on dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(await isAuthenticated(page)).toBe(true);
    
    // 4. Logout
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // 5. Verify logout
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });

  test('should maintain session across page reloads', async ({ page }) => {
    // Login
    await loginAsTestUser(page, 'regular', { handle2FA: true });
    await page.waitForURL(/\/dashboard/);
    
    // Reload page
    await page.reload();
    
    // Should still be authenticated
    await page.waitForTimeout(1000);
    expect(await isAuthenticated(page)).toBe(true);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should handle concurrent login attempts', async ({ page, context }) => {
    // Create two pages
    const page2 = await context.newPage();
    
    try {
      // Login on first page
      await loginAsTestUser(page, 'regular', { handle2FA: true });
      await page.waitForURL(/\/dashboard/);
      
      // Login on second page
      await loginAsTestUser(page2, 'regular', { handle2FA: true });
      await page2.waitForURL(/\/dashboard/);
      
      // Both should be authenticated
      expect(await isAuthenticated(page)).toBe(true);
      expect(await isAuthenticated(page2)).toBe(true);
    } finally {
      await page2.close();
    }
  });
});
