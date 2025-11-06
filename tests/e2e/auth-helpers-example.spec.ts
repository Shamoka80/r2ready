/**
 * Example test file demonstrating usage of auth helpers and fixtures
 * This file shows different ways to use the authentication utilities
 */

import { test as baseTest, expect } from '@playwright/test';
import { test, createAuthTest } from '../fixtures/auth.fixture';
import { 
  loginAsTestUser, 
  loginWithCredentials, 
  getAuthToken,
  getTestUserAuthToken,
  isAuthenticated,
  TEST_USERS 
} from '../helpers/auth';
import { generateTOTP } from '../helpers/totp';

/**
 * Example 1: Using helper functions directly with base Playwright test
 */
baseTest.describe('Auth Helpers - Manual Login', () => {
  baseTest('should login admin user manually', async ({ page }) => {
    // Login as admin using helper function
    await loginAsTestUser(page, 'admin');
    
    // Verify we're authenticated
    expect(await isAuthenticated(page)).toBe(true);
    
    // Verify we're on the dashboard or home page
    await expect(page).toHaveURL(/\/(dashboard|home)/);
  });

  baseTest('should login regular user manually', async ({ page }) => {
    // Login as regular user using helper function
    await loginAsTestUser(page, 'regular');
    
    // Verify we're authenticated
    expect(await isAuthenticated(page)).toBe(true);
    
    // Verify we're on the dashboard or home page
    await expect(page).toHaveURL(/\/(dashboard|home)/);
  });

  baseTest('should login with custom credentials', async ({ page }) => {
    // Login with specific credentials
    await loginWithCredentials(
      page, 
      TEST_USERS.admin.email, 
      TEST_USERS.admin.password
    );
    
    // Verify authentication
    expect(await isAuthenticated(page)).toBe(true);
  });
});

/**
 * Example 2: Using authenticated page fixture
 * The page is already logged in when the test starts
 */
test.describe('Auth Fixtures - Authenticated Page', () => {
  test('should have authenticated user by default', async ({ authenticatedPage }) => {
    // Page is already logged in as regular user (default)
    expect(await isAuthenticated(authenticatedPage)).toBe(true);
    
    // Navigate to protected route
    await authenticatedPage.goto('/dashboard');
    await expect(authenticatedPage).toHaveURL(/\/dashboard/);
  });

  test('admin can access dashboard', async ({ adminPage }) => {
    // adminPage is already logged in as admin
    expect(await isAuthenticated(adminPage)).toBe(true);
    
    await adminPage.goto('/dashboard');
    await expect(adminPage).toHaveURL(/\/dashboard/);
  });

  test('regular user can access dashboard', async ({ regularUserPage }) => {
    // regularUserPage is already logged in as regular user
    expect(await isAuthenticated(regularUserPage)).toBe(true);
    
    await regularUserPage.goto('/dashboard');
    await expect(regularUserPage).toHaveURL(/\/dashboard/);
  });
});

/**
 * Example 3: Using authenticated API context fixture
 * For API testing with authentication
 */
test.describe('Auth Fixtures - Authenticated API', () => {
  test('should make authenticated API request', async ({ authenticatedApiContext }) => {
    // API context already has auth headers
    const response = await authenticatedApiContext.get('/api/auth/me');
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.user).toBeDefined();
  });

  test('admin can access admin API', async ({ adminApiContext }) => {
    // adminApiContext has admin auth headers
    const response = await adminApiContext.get('/api/auth/me');
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.user.email).toBe(TEST_USERS.admin.email);
  });

  test('regular user can access user API', async ({ regularUserApiContext }) => {
    // regularUserApiContext has regular user auth headers
    const response = await regularUserApiContext.get('/api/auth/me');
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.user.email).toBe(TEST_USERS.regular.email);
  });
});

/**
 * Example 4: Using getAuthToken helper for API setup
 */
baseTest.describe('Auth Helpers - API Token', () => {
  baseTest('should get auth token programmatically', async ({ request }) => {
    // Get auth token using helper
    const token = await getTestUserAuthToken(request, 'admin');
    
    expect(token).toBeTruthy();
    
    // Use token in API request
    const response = await request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.user.email).toBe(TEST_USERS.admin.email);
  });
});

/**
 * Example 5: Using TOTP helper
 */
baseTest.describe('TOTP Helpers', () => {
  baseTest('should generate valid TOTP code', async () => {
    // Generate TOTP code
    const totpCode = generateTOTP(TEST_USERS.admin.totpSecret);
    
    // Verify format
    expect(totpCode).toMatch(/^\d{6}$/);
    expect(totpCode.length).toBe(6);
  });

  baseTest('should generate consistent TOTP within time window', async () => {
    // Generate multiple codes within same time window
    const code1 = generateTOTP(TEST_USERS.admin.totpSecret);
    const code2 = generateTOTP(TEST_USERS.admin.totpSecret);
    
    // Should be same within 30-second window
    expect(code1).toBe(code2);
  });
});

/**
 * Example 6: Custom test with specific user type
 */
const adminTest = createAuthTest('admin');

adminTest.describe('Custom Admin Tests', () => {
  adminTest('authenticatedPage defaults to admin', async ({ authenticatedPage }) => {
    // authenticatedPage is logged in as admin by default
    expect(await isAuthenticated(authenticatedPage)).toBe(true);
    
    await authenticatedPage.goto('/dashboard');
    await expect(authenticatedPage).toHaveURL(/\/dashboard/);
  });

  adminTest('authenticatedApiContext has admin token', async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get('/api/auth/me');
    const data = await response.json();
    expect(data.user.email).toBe(TEST_USERS.admin.email);
  });
});
