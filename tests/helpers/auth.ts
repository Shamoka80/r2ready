import { Page, APIRequestContext, expect } from '@playwright/test';
import { generateTOTP } from './totp';

/**
 * Test user credentials from Test_Users.md
 */
export const TEST_USERS = {
  admin: {
    email: 'admin+e2e@rur2.com',
    password: 'RuR2@Admin2024!',
    totpSecret: 'JBSWY3DPEHPK3PXP',
    name: 'Jonnie Doublin',
    company: 'RuR2 Systems LLC',
  },
  regular: {
    email: 'tester+e2e@example.com',
    password: 'TestUser123!',
    totpSecret: 'KRUGS4ZANFZSA5TJ',
    name: 'Julia Robbin',
    company: 'Testing Company Inc',
  },
} as const;

export type UserType = keyof typeof TEST_USERS;

/**
 * Interface for login response
 */
interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
  };
  tenant?: {
    id: string;
    name: string;
    type: string;
  };
}

/**
 * Login with credentials using the UI
 * This function handles the login form interaction
 * 
 * @param page - Playwright page object
 * @param email - User email
 * @param password - User password
 * @param options - Additional options like timeout
 */
export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string,
  options: { timeout?: number; skipNavigation?: boolean } = {}
): Promise<void> {
  const { timeout = 30000, skipNavigation = false } = options;

  // Navigate to login page if not already there
  if (!skipNavigation) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
  }

  // Wait for the login form to be visible
  await page.waitForSelector('form', { state: 'visible', timeout });

  // Fill in the email field
  const emailInput = page.locator('input[type="email"], input#email, input[name="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout });
  await emailInput.fill(email);

  // Fill in the password field
  const passwordInput = page.locator('input[type="password"], input#password, input[name="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout });
  await passwordInput.fill(password);

  // Submit the form by clicking the submit button
  const submitButton = page.locator('button[type="submit"], button:has-text("Sign In")').first();
  await submitButton.waitFor({ state: 'visible', timeout });
  
  // Click submit and wait for navigation
  await submitButton.click();
  
  // Wait for navigation to complete (don't use networkidle as it's too strict for SPAs)
  await page.waitForLoadState('load', { timeout });
  
  // Additional wait for redirect or 2FA page
  await page.waitForTimeout(1000);
}

/**
 * Verify 2FA using TOTP code
 * This function handles the 2FA verification page
 * 
 * @param page - Playwright page object
 * @param totpSecret - Base32 TOTP secret
 * @param options - Additional options
 */
export async function verify2FA(
  page: Page,
  totpSecret: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;

  // Generate current TOTP code
  const totpCode = generateTOTP(totpSecret);

  // Wait for 2FA verification page to load
  await page.waitForSelector('[data-testid="totp-code-input"], input#totp-code', { 
    state: 'visible', 
    timeout 
  });

  // Enter TOTP code
  const totpInput = page.locator('[data-testid="totp-code-input"], input#totp-code').first();
  await totpInput.fill(totpCode);

  // Click verify button
  const verifyButton = page.locator('[data-testid="verify-button"], button:has-text("Verify")').first();
  await verifyButton.waitFor({ state: 'visible', timeout });
  
  // Click and wait for navigation
  await verifyButton.click();
  await page.waitForLoadState('load', { timeout });
  await page.waitForTimeout(1000);
}

/**
 * Setup 2FA using TOTP
 * This function handles the 2FA setup process
 * 
 * @param page - Playwright page object
 * @param totpSecret - The TOTP secret displayed during setup (from QR code URL)
 * @param options - Additional options
 */
export async function setup2FA(
  page: Page,
  totpSecret: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;

  // Wait for setup page to load
  await page.waitForSelector('[data-testid="setup-totp-code-input"], input#setup-totp-code', { 
    state: 'visible', 
    timeout 
  });

  // Generate TOTP code from the secret
  const totpCode = generateTOTP(totpSecret);

  // Enter TOTP code
  const totpInput = page.locator('[data-testid="setup-totp-code-input"], input#setup-totp-code').first();
  await totpInput.fill(totpCode);

  // Click complete setup button
  const completeButton = page.locator('[data-testid="complete-setup-button"], button:has-text("Complete")').first();
  await completeButton.waitFor({ state: 'visible', timeout });
  
  // Click and wait for navigation
  await completeButton.click();
  await page.waitForLoadState('load', { timeout });
  await page.waitForTimeout(1000);
}

/**
 * Login as a test user (admin or regular)
 * This is a convenience function that uses predefined test users
 * 
 * @param page - Playwright page object
 * @param userType - Type of user ('admin' or 'regular')
 * @param options - Additional options
 */
export async function loginAsTestUser(
  page: Page,
  userType: UserType,
  options: { 
    timeout?: number; 
    skipNavigation?: boolean;
    handle2FA?: boolean;
  } = {}
): Promise<void> {
  const { timeout = 30000, skipNavigation = false, handle2FA = true } = options;
  const user = TEST_USERS[userType];

  // Login with credentials
  await loginWithCredentials(page, user.email, user.password, { timeout, skipNavigation });

  // Check if 2FA is required
  if (handle2FA) {
    // Wait a bit to see if 2FA page appears
    try {
      await page.waitForSelector('[data-testid="totp-code-input"], input#totp-code', { 
        state: 'visible', 
        timeout: 3000 
      });
      // If 2FA input is found, verify it
      await verify2FA(page, user.totpSecret, { timeout });
    } catch (error) {
      // 2FA not required or already completed, continue
    }
  }

  // Wait for successful login (should be on dashboard or home)
  await page.waitForLoadState('load', { timeout });
  await page.waitForTimeout(500);
}

/**
 * Get authentication token via API
 * This is useful for API testing and setting up authenticated contexts
 * 
 * @param apiContext - Playwright API request context
 * @param email - User email
 * @param password - User password
 * @param totpSecret - Optional TOTP secret for 2FA
 * @returns Authentication token
 */
export async function getAuthToken(
  apiContext: APIRequestContext,
  email: string,
  password: string,
  totpSecret?: string
): Promise<string> {
  // Step 1: Login to get initial token
  const loginResponse = await apiContext.post('/api/auth/login', {
    data: {
      email,
      password,
    },
  });

  if (!loginResponse.ok()) {
    const error = await loginResponse.json();
    throw new Error(`Login failed: ${error.error || error.message || 'Unknown error'}`);
  }

  const loginData: LoginResponse = await loginResponse.json();
  const token = loginData.token;

  // Step 2: Check if 2FA is required
  if (totpSecret) {
    // Check 2FA status
    const statusResponse = await apiContext.get('/api/auth/2fa/status', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (statusResponse.ok()) {
      const statusData = await statusResponse.json();
      
      if (statusData.data?.enabled) {
        // 2FA is enabled, verify it
        const totpCode = generateTOTP(totpSecret);
        
        const verifyResponse = await apiContext.post('/api/auth/2fa/verify', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          data: {
            code: totpCode,
          },
        });

        if (!verifyResponse.ok()) {
          const error = await verifyResponse.json();
          throw new Error(`2FA verification failed: ${error.message || 'Unknown error'}`);
        }
        
        // Token remains the same after 2FA verification
        // The token is already authorized after successful verification
      }
    }
  }

  return token;
}

/**
 * Get authentication token for a test user
 * Convenience function that uses predefined test users
 * 
 * @param apiContext - Playwright API request context
 * @param userType - Type of user ('admin' or 'regular')
 * @returns Authentication token
 */
export async function getTestUserAuthToken(
  apiContext: APIRequestContext,
  userType: UserType
): Promise<string> {
  const user = TEST_USERS[userType];
  return getAuthToken(apiContext, user.email, user.password, user.totpSecret);
}

/**
 * Check if user is authenticated by checking for auth token in localStorage
 * 
 * @param page - Playwright page object
 * @returns True if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  return token !== null;
}

/**
 * Logout current user
 * 
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Try to find and click logout button
  const logoutButton = page.locator('[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign Out")').first();
  
  try {
    await logoutButton.waitFor({ state: 'visible', timeout: 3000 });
    await logoutButton.click();
    await page.waitForLoadState('networkidle');
  } catch {
    // If logout button not found, clear storage directly
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
    });
    await page.goto('/login');
  }
}

/**
 * Wait for authentication to complete
 * Useful when waiting for redirects after login
 * 
 * @param page - Playwright page object
 * @param options - Timeout option
 */
export async function waitForAuth(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;
  
  await page.waitForFunction(
    () => {
      const token = localStorage.getItem('auth_token');
      return token !== null && token !== '';
    },
    { timeout }
  );
}
