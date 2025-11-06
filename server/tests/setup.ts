
import { beforeAll, afterAll } from '@jest/globals';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-characters-long-for-security-testing';
  process.env.JWT_ACTIVE_KID = 'test-global-setup';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  
  // Suppress console.log during tests unless specifically needed
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    if (process.env.JEST_VERBOSE === 'true') {
      originalLog(...args);
    }
  };
});

afterAll(async () => {
  // Clean up test environment
  delete process.env.JWT_SECRET;
  delete process.env.JWT_ACTIVE_KID;
  delete process.env.DATABASE_URL;
});

// Global test utilities
export const testUtils = {
  generateTestUser: () => ({
    id: 'test-user-' + Math.random().toString(36).substr(2, 9),
    email: 'test@example.com',
    tenantId: 'test-tenant-' + Math.random().toString(36).substr(2, 9),
    isActive: true
  }),
  
  generateTestSession: () => ({
    id: 'test-session-' + Math.random().toString(36).substr(2, 9),
    userId: 'test-user-' + Math.random().toString(36).substr(2, 9),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'ACTIVE' as const
  }),
  
  generateValidUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};
