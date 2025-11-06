import { describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';
import cors from 'cors';
import { registerRoutes } from '../routes';

/**
 * Rate Limit Bypass Verification Test
 * 
 * This test verifies that rate limiting is bypassed when NODE_ENV=test,
 * allowing integration tests to run without 429 errors.
 */

describe('Rate Limit Bypass for Test Environment', () => {
  let app: Express;

  beforeAll(async () => {
    // Set NODE_ENV to 'test' to enable bypass
    process.env.NODE_ENV = 'test';
    
    app = express();
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: false, limit: '10mb' }));
    
    await registerRoutes(app);
  });

  test('should allow multiple rapid registrations without rate limiting', async () => {
    // Attempt 6 registrations in rapid succession
    // Without bypass, this would trigger the 5 registrations/5 minutes limit
    const registrationPromises = [];
    
    for (let i = 0; i < 6; i++) {
      const promise = request(app)
        .post('/api/auth/register-tenant')
        .send({
          tenantName: `Test Tenant ${Date.now()}-${i}`,
          tenantType: 'BUSINESS',
          ownerEmail: `test-${Date.now()}-${i}@example.com`,
          ownerFirstName: 'Test',
          ownerLastName: 'User',
          ownerPassword: 'SecurePassword123!'
        });
      
      registrationPromises.push(promise);
    }

    // Execute all requests simultaneously
    const results = await Promise.all(registrationPromises);

    // All requests should succeed (201) or fail for non-rate-limit reasons
    // None should return 429 (rate limit exceeded)
    const rateLimitErrors = results.filter(res => res.status === 429);
    
    expect(rateLimitErrors.length).toBe(0);
    
    // Log the status codes for debugging
    console.log('Status codes:', results.map(r => r.status));
    
    // At least some requests should succeed (not all will due to duplicate emails, but none should be rate limited)
    const successOrConflict = results.filter(res => res.status === 201 || res.status === 400);
    expect(successOrConflict.length).toBeGreaterThan(0);
  });

  test('should bypass rate limiting on login endpoint as well', async () => {
    // Attempt 6 logins in rapid succession
    const loginPromises = [];
    
    for (let i = 0; i < 6; i++) {
      const promise = request(app)
        .post('/api/auth/login')
        .send({
          email: `nonexistent-${Date.now()}-${i}@example.com`,
          password: 'WrongPassword123!'
        });
      
      loginPromises.push(promise);
    }

    const results = await Promise.all(loginPromises);

    // None should return 429 (rate limit exceeded)
    const rateLimitErrors = results.filter(res => res.status === 429);
    expect(rateLimitErrors.length).toBe(0);
    
    // All should return 401 (invalid credentials) instead
    const authErrors = results.filter(res => res.status === 401);
    expect(authErrors.length).toBe(6);
  });
});
