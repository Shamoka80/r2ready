import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';
import { loginAsTestUser, getTestUserAuthToken, type UserType, TEST_USERS } from '../helpers/auth';

/**
 * Extended test fixtures with authentication support
 */
type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
  regularUserPage: Page;
  authenticatedApiContext: APIRequestContext;
  adminApiContext: APIRequestContext;
  regularUserApiContext: APIRequestContext;
};

/**
 * Custom Playwright test with authentication fixtures
 * 
 * Usage:
 * 
 * import { test, expect } from './fixtures/auth.fixture';
 * 
 * test('should access protected page', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/dashboard');
 *   // User is already logged in
 * });
 * 
 * test('admin can access admin panel', async ({ adminPage }) => {
 *   await adminPage.goto('/admin');
 *   // Logged in as admin user
 * });
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Authenticated page fixture
   * Provides a page with a logged-in user (defaults to regular user)
   * The user type can be customized using test.use()
   */
  authenticatedPage: async ({ page, context }, use, testInfo) => {
    // Get user type from test metadata or default to regular
    const userType: UserType = (testInfo.project.use as any)?.defaultUserType || 'regular';
    
    // Login the user
    await loginAsTestUser(page, userType, { timeout: 30000 });
    
    // Provide the authenticated page to the test
    await use(page);
    
    // Cleanup: logout after test
    await page.evaluate(() => localStorage.removeItem('auth_token'));
  },

  /**
   * Admin page fixture
   * Provides a page with an authenticated admin user
   */
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Login as admin
      await loginAsTestUser(page, 'admin', { timeout: 30000 });
      
      // Provide the authenticated admin page to the test
      await use(page);
    } finally {
      // Cleanup
      await page.evaluate(() => localStorage.removeItem('auth_token'));
      await page.close();
      await context.close();
    }
  },

  /**
   * Regular user page fixture
   * Provides a page with an authenticated regular user
   */
  regularUserPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Login as regular user
      await loginAsTestUser(page, 'regular', { timeout: 30000 });
      
      // Provide the authenticated regular user page to the test
      await use(page);
    } finally {
      // Cleanup
      await page.evaluate(() => localStorage.removeItem('auth_token'));
      await page.close();
      await context.close();
    }
  },

  /**
   * Authenticated API context fixture
   * Provides an API context with authentication headers (defaults to regular user)
   */
  authenticatedApiContext: async ({ playwright }, use, testInfo) => {
    // Get user type from test metadata or default to regular
    const userType: UserType = (testInfo.project.use as any)?.defaultUserType || 'regular';
    
    // Create API context
    const apiContext = await playwright.request.newContext({
      baseURL: 'http://0.0.0.0:5000',
    });
    
    try {
      // Get auth token
      const token = await getTestUserAuthToken(apiContext, userType);
      
      // Create new context with auth headers
      const authenticatedContext = await playwright.request.newContext({
        baseURL: 'http://0.0.0.0:5000',
        extraHTTPHeaders: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      // Provide authenticated API context to the test
      await use(authenticatedContext);
      
      // Cleanup
      await authenticatedContext.dispose();
    } finally {
      await apiContext.dispose();
    }
  },

  /**
   * Admin API context fixture
   * Provides an API context with admin authentication headers
   */
  adminApiContext: async ({ playwright }, use) => {
    // Create API context
    const apiContext = await playwright.request.newContext({
      baseURL: 'http://0.0.0.0:5000',
    });
    
    try {
      // Get admin auth token
      const token = await getTestUserAuthToken(apiContext, 'admin');
      
      // Create new context with auth headers
      const authenticatedContext = await playwright.request.newContext({
        baseURL: 'http://0.0.0.0:5000',
        extraHTTPHeaders: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      // Provide authenticated API context to the test
      await use(authenticatedContext);
      
      // Cleanup
      await authenticatedContext.dispose();
    } finally {
      await apiContext.dispose();
    }
  },

  /**
   * Regular user API context fixture
   * Provides an API context with regular user authentication headers
   */
  regularUserApiContext: async ({ playwright }, use) => {
    // Create API context
    const apiContext = await playwright.request.newContext({
      baseURL: 'http://0.0.0.0:5000',
    });
    
    try {
      // Get regular user auth token
      const token = await getTestUserAuthToken(apiContext, 'regular');
      
      // Create new context with auth headers
      const authenticatedContext = await playwright.request.newContext({
        baseURL: 'http://0.0.0.0:5000',
        extraHTTPHeaders: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      // Provide authenticated API context to the test
      await use(authenticatedContext);
      
      // Cleanup
      await authenticatedContext.dispose();
    } finally {
      await apiContext.dispose();
    }
  },
});

// Re-export expect for convenience
export { expect };

/**
 * Helper function to create a test with a specific user type as default
 * 
 * Usage:
 * const adminTest = createAuthTest('admin');
 * adminTest('admin can do X', async ({ authenticatedPage }) => {
 *   // authenticatedPage is logged in as admin
 * });
 */
export function createAuthTest(userType: UserType) {
  return base.extend<AuthFixtures>({
    authenticatedPage: async ({ page }, use) => {
      await loginAsTestUser(page, userType, { timeout: 30000 });
      await use(page);
      await page.evaluate(() => localStorage.removeItem('auth_token'));
    },
    
    authenticatedApiContext: async ({ playwright }, use) => {
      const apiContext = await playwright.request.newContext({
        baseURL: 'http://0.0.0.0:5000',
      });
      
      try {
        const token = await getTestUserAuthToken(apiContext, userType);
        const authenticatedContext = await playwright.request.newContext({
          baseURL: 'http://0.0.0.0:5000',
          extraHTTPHeaders: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        await use(authenticatedContext);
        await authenticatedContext.dispose();
      } finally {
        await apiContext.dispose();
      }
    },

    // Other fixtures inherit from main test
    adminPage: async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAsTestUser(page, 'admin', { timeout: 30000 });
        await use(page);
      } finally {
        await page.evaluate(() => localStorage.removeItem('auth_token'));
        await page.close();
        await context.close();
      }
    },

    regularUserPage: async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAsTestUser(page, 'regular', { timeout: 30000 });
        await use(page);
      } finally {
        await page.evaluate(() => localStorage.removeItem('auth_token'));
        await page.close();
        await context.close();
      }
    },

    adminApiContext: async ({ playwright }, use) => {
      const apiContext = await playwright.request.newContext({
        baseURL: 'http://0.0.0.0:5000',
      });
      try {
        const token = await getTestUserAuthToken(apiContext, 'admin');
        const authenticatedContext = await playwright.request.newContext({
          baseURL: 'http://0.0.0.0:5000',
          extraHTTPHeaders: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        await use(authenticatedContext);
        await authenticatedContext.dispose();
      } finally {
        await apiContext.dispose();
      }
    },

    regularUserApiContext: async ({ playwright }, use) => {
      const apiContext = await playwright.request.newContext({
        baseURL: 'http://0.0.0.0:5000',
      });
      try {
        const token = await getTestUserAuthToken(apiContext, 'regular');
        const authenticatedContext = await playwright.request.newContext({
          baseURL: 'http://0.0.0.0:5000',
          extraHTTPHeaders: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        await use(authenticatedContext);
        await authenticatedContext.dispose();
      } finally {
        await apiContext.dispose();
      }
    },
  });
}
