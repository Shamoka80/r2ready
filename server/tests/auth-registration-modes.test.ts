import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';
import cors from 'cors';
import { registerRoutes } from '../routes';
import { db } from '../db';
import { users, auditLog, securityAuditLog } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';

/**
 * Dual-Mode Registration Integration Tests
 * 
 * Tests the registration endpoint's dual-mode behavior based on the 
 * enable_email_verification feature flag:
 * - Email-first flow (flag ON): Requires email verification before payment
 * - Legacy payment-first flow (flag OFF): Immediate account creation with payment
 * 
 * NOTE: Rate limits are 5 registrations per 5 minutes, so tests are designed to be minimal
 */

describe('Dual-Mode Registration Tests', () => {
  let app: Express;
  let emailFirstTestEmail: string;
  let legacyTestEmail: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    
    app = express();
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: false, limit: '10mb' }));
    
    await registerRoutes(app);
    
    console.log('Waiting for rate limit window to clear...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  afterAll(async () => {
    try {
      const emailsToCleanup = [emailFirstTestEmail, legacyTestEmail].filter(Boolean);
      
      if (emailsToCleanup.length > 0) {
        for (const email of emailsToCleanup) {
          const user = await db.query.users.findFirst({
            where: eq(users.email, email)
          });
          
          if (user) {
            await db.delete(auditLog).where(eq(auditLog.userId, user.id));
            await db.delete(securityAuditLog).where(
              or(
                eq(securityAuditLog.userId, user.id),
                eq(securityAuditLog.targetUserId, user.id)
              )
            );
            await db.delete(users).where(eq(users.id, user.id));
          }
        }
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  test('Email-First Flow: should register without session when flag is ON', async () => {
    const flagResponse = await request(app)
      .post('/api/flags/admin/flags')
      .send({
        flag: 'enable_email_verification',
        value: true
      });
    
    expect(flagResponse.status).toBe(200);

    await new Promise(resolve => setTimeout(resolve, 1000));

    emailFirstTestEmail = `email-first-${Date.now()}@test.com`;

    const registerResponse = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        tenantName: 'Email-First Test Tenant',
        tenantType: 'BUSINESS',
        ownerEmail: emailFirstTestEmail,
        ownerFirstName: 'EmailFirst',
        ownerLastName: 'Test',
        ownerPassword: 'SecurePassword123!'
      });

    expect(registerResponse.status).toBe(201);
    const responseData = registerResponse.body;

    expect(responseData.success).toBe(true);
    expect(responseData.requiresEmailVerification).toBe(true);
    expect(responseData.email).toBe(emailFirstTestEmail);
    expect(responseData.userId).toBeTruthy();
    expect(responseData.message).toContain('verify your account');

    expect(responseData.token).toBeUndefined();
    expect(responseData.user).toBeUndefined();
    expect(responseData.tenant).toBeUndefined();
    expect(responseData.permissions).toBeUndefined();

    const user = await db.query.users.findFirst({
      where: eq(users.email, emailFirstTestEmail)
    });

    expect(user).toBeTruthy();
    expect(user.setupStatus).toBe('email_pending');
    expect(user.emailVerified).toBe(false);
    expect(user.emailVerificationToken).toBeTruthy();
    expect(user.emailVerificationTokenExpiry).toBeTruthy();
    expect(user.passwordHash).toBeTruthy();
    expect(user.firstName).toBe('EmailFirst');
    expect(user.lastName).toBe('Test');
  });

  test('Legacy Flow: should register with immediate session when flag is OFF', async () => {
    await new Promise(resolve => setTimeout(resolve, 6000));

    const flagResponse = await request(app)
      .post('/api/flags/admin/flags')
      .send({
        flag: 'enable_email_verification',
        value: false
      });
    
    expect(flagResponse.status).toBe(200);

    await new Promise(resolve => setTimeout(resolve, 1000));

    legacyTestEmail = `legacy-${Date.now()}@test.com`;
    const testPassword = 'SecurePassword123!';

    const registerResponse = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        tenantName: 'Legacy Test Tenant',
        tenantType: 'BUSINESS',
        ownerEmail: legacyTestEmail,
        ownerFirstName: 'Legacy',
        ownerLastName: 'Test',
        ownerPassword: testPassword
      });

    expect(registerResponse.status).toBe(201);
    const responseData = registerResponse.body;

    expect(responseData.success).toBe(true);
    expect(responseData.token).toBeTruthy();
    expect(responseData.user).toBeTruthy();
    expect(responseData.tenant).toBeTruthy();
    expect(responseData.permissions).toBeInstanceOf(Array);
    expect(responseData.expiresAt).toBeTruthy();

    expect(responseData.requiresEmailVerification).toBeUndefined();

    expect(responseData.user.id).toBeTruthy();
    expect(responseData.user.email).toBe(legacyTestEmail);
    expect(responseData.user.firstName).toBe('Legacy');
    expect(responseData.user.lastName).toBe('Test');
    expect(responseData.user.role).toBeTruthy();

    expect(responseData.tenant.id).toBeTruthy();
    expect(responseData.tenant.name).toBe('Legacy Test Tenant');
    expect(responseData.tenant.type).toBe('BUSINESS');

    const tokenParts = responseData.token.split('.');
    expect(tokenParts.length).toBe(3);

    const user = await db.query.users.findFirst({
      where: eq(users.email, legacyTestEmail)
    });

    expect(user).toBeTruthy();
    expect(user.emailVerified).toBe(true);
    expect(user.setupStatus).not.toBe('email_pending');
    expect(user.emailVerificationToken === null || user.emailVerificationToken === undefined).toBe(true);
    expect(user.legacyVerified).toBe(false);
    expect(user.passwordHash).toBeTruthy();
    expect(user.firstName).toBe('Legacy');
    expect(user.lastName).toBe('Test');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: legacyTestEmail,
        password: testPassword
      });

    expect(loginResponse.status).toBe(200);
    const loginData = loginResponse.body;
    expect(loginData.success).toBe(true);
    expect(loginData.token).toBeTruthy();
    expect(loginData.user.email).toBe(legacyTestEmail);
  });

  test('Feature Flag Toggle: should switch between flows correctly', async () => {
    await new Promise(resolve => setTimeout(resolve, 8000));

    await request(app)
      .post('/api/flags/admin/flags')
      .send({ flag: 'enable_email_verification', value: true });

    await new Promise(resolve => setTimeout(resolve, 500));

    const toggleEmailEmail = `toggle-email-${Date.now()}@test.com`;
    const emailFirstResponse = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        tenantName: 'Toggle Email Test',
        tenantType: 'BUSINESS',
        ownerEmail: toggleEmailEmail,
        ownerFirstName: 'Toggle',
        ownerLastName: 'Email',
        ownerPassword: 'SecurePassword123!'
      });

    expect(emailFirstResponse.status).toBe(201);
    const emailFirstData = emailFirstResponse.body;
    expect(emailFirstData.requiresEmailVerification).toBe(true);
    expect(emailFirstData.token).toBeUndefined();

    const toggleEmailUser = await db.query.users.findFirst({
      where: eq(users.email, toggleEmailEmail)
    });
    if (toggleEmailUser) {
      await db.delete(auditLog).where(eq(auditLog.userId, toggleEmailUser.id));
      await db.delete(securityAuditLog).where(
        or(
          eq(securityAuditLog.userId, toggleEmailUser.id),
          eq(securityAuditLog.targetUserId, toggleEmailUser.id)
        )
      );
      await db.delete(users).where(eq(users.id, toggleEmailUser.id));
    }

    await new Promise(resolve => setTimeout(resolve, 6000));

    await request(app)
      .post('/api/flags/admin/flags')
      .send({ flag: 'enable_email_verification', value: false });

    await new Promise(resolve => setTimeout(resolve, 500));

    const toggleLegacyEmail = `toggle-legacy-${Date.now()}@test.com`;
    const legacyResponse = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        tenantName: 'Toggle Legacy Test',
        tenantType: 'BUSINESS',
        ownerEmail: toggleLegacyEmail,
        ownerFirstName: 'Toggle',
        ownerLastName: 'Legacy',
        ownerPassword: 'SecurePassword123!'
      });

    expect(legacyResponse.status).toBe(201);
    const legacyData = legacyResponse.body;
    expect(legacyData.requiresEmailVerification).toBeUndefined();
    expect(legacyData.token).toBeTruthy();

    const toggleLegacyUser = await db.query.users.findFirst({
      where: eq(users.email, toggleLegacyEmail)
    });
    if (toggleLegacyUser) {
      await db.delete(auditLog).where(eq(auditLog.userId, toggleLegacyUser.id));
      await db.delete(securityAuditLog).where(
        or(
          eq(securityAuditLog.userId, toggleLegacyUser.id),
          eq(securityAuditLog.targetUserId, toggleLegacyUser.id)
        )
      );
      await db.delete(users).where(eq(users.id, toggleLegacyUser.id));
    }
  });
});
