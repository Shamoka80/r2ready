/**
 * Testing Helper Routes
 * 
 * SECURITY: These endpoints are ONLY available in development/test mode
 * They provide helper functions for E2E testing
 */

import express, { Response } from 'express';
import { db, sql } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Security check: only allow in non-production environments
const isTestingAllowed = process.env.NODE_ENV !== 'production';

/**
 * GET /api/testing/verification-token?email={email}
 * Returns email verification token for a user (testing only)
 */
router.get('/verification-token', async (req, res: Response) => {
  if (!isTestingAllowed) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      email: user.email,
      emailVerificationToken: user.emailVerificationToken,
      emailVerified: user.emailVerified
    });

  } catch (error) {
    console.error('Testing endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/testing/health
 * Simple health check for testing routes
 */
router.get('/health', (req, res: Response) => {
  if (!isTestingAllowed) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

/**
 * GET /api/testing/db-diagnostic
 * Database connection diagnostic (testing/development only)
 */
router.get('/db-diagnostic', async (req, res: Response) => {
  if (!isTestingAllowed) {
    return res.status(404).json({ error: 'Not found' });
  }

  const dbUrl = process.env.DATABASE_URL || '';
  let urlInfo = null;
  
  if (dbUrl.length > 0) {
    try {
      const parts = dbUrl.match(/postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (parts) {
        urlInfo = {
          protocol: parts[1] || 'postgres',
          username: parts[2],
          password: '***' + parts[3].slice(-4),
          host: parts[4],
          port: parts[5],
          database: parts[6].split('?')[0],
          isLocalhost: parts[4] === 'localhost' || parts[4] === '127.0.0.1',
          hasSSL: dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=prefer')
        };
      }
    } catch (e) {
      // Parse error - URL might be in different format
    }
  }

  // Test database connection
  let connectionTest = { success: false, error: null as string | null };
  try {
    await sql`SELECT 1 as test`;
    connectionTest = { success: true, error: null };
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const isConnectionError = 
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connect') ||
      errorMessage.includes('Error connecting to database');
    
    connectionTest = {
      success: false,
      error: isConnectionError 
        ? 'Connection refused - database server not accessible'
        : errorMessage
    };
  }

  res.json({
    databaseUrl: {
      isSet: !!process.env.DATABASE_URL,
      preview: dbUrl.length > 0 
        ? dbUrl.substring(0, Math.min(50, dbUrl.indexOf('@') > 0 ? dbUrl.indexOf('@') : 50)) + '...'
        : 'NOT SET',
      parsed: urlInfo
    },
    connectionTest,
    recommendations: connectionTest.success 
      ? ['Database connection is working correctly']
      : [
          urlInfo?.isLocalhost 
            ? 'PostgreSQL is not running locally - start the PostgreSQL service'
            : 'Verify the database server is running and accessible',
          'Check if DATABASE_URL in server/.env is correct',
          'Verify database credentials (username/password)',
          'Check network/firewall settings',
          'For cloud databases: verify endpoint is enabled and not suspended'
        ]
  });
});

export default router;
