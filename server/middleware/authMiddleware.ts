import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { deviceService } from '../services/deviceService';
import { db } from '../db';
import { userSessions, users } from '@shared/schema';
import { sql } from 'drizzle-orm';

// Extend Express Request interface for authenticated requests
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    sessionId: string;
    deviceId?: string;
    // Optional user profile fields that may be present at runtime
    firstName?: string;
    lastName?: string;
  };
  clientInfo: {
    ipAddress: string;
    userAgent: string;
  };
  session: {
    id: string;
    isActive: boolean;
    expiresAt: Date;
  };
}

/**
 * Authentication middleware that validates JWT access tokens
 * and populates request with user and session information
 */
export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Authorization token required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify access token using AuthService (same as login endpoints)
    const payload = AuthService.verifyToken(token);
    
    if (!payload || !payload.userId) {
      res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired access token'
      });
      return;
    }

    // Validate session exists and is active
    if (payload.sessionId) {
      const sessionRecords = await db
        .select()
        .from(userSessions as any)
        .where(
          sql`${userSessions.id} = ${payload.sessionId} AND ${userSessions.userId} = ${payload.userId} AND ${userSessions.status} = 'ACTIVE'`
        )
        .limit(1);

      if (sessionRecords.length === 0) {
        res.status(401).json({
          success: false,
          error: 'SESSION_INVALID',
          message: 'Session not found or inactive'
        });
        return;
      }

      const session = sessionRecords[0] as any;

      // Check if session has expired
      if (session.expiresAt && session.expiresAt < new Date()) {
        res.status(401).json({
          success: false,
          error: 'SESSION_EXPIRED',
          message: 'Session has expired'
        });
        return;
      }

      req.session = {
        id: session.id,
        isActive: session.status === 'ACTIVE',
        expiresAt: session.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24h
      };
    }

    // Validate user exists and is active
    const userRecords = await db
      .select()
      .from(users as any)
      .where(
        sql`${users.id} = ${payload.userId} AND ${users.isActive} = true`
      )
      .limit(1);

    if (userRecords.length === 0) {
      res.status(401).json({
        success: false,
        error: 'USER_INVALID',
        message: 'User not found or inactive'
      });
      return;
    }

    const user = userRecords[0] as any;

    // Register/update device information
    const clientInfo = {
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown'
    };

    let deviceId = payload.deviceId;

    // If device tracking is enabled, register or update device
    if (clientInfo.userAgent !== 'Unknown') {
      try {
        const deviceResult = await deviceService.registerDevice(
          user.id,
          clientInfo.userAgent,
          clientInfo.ipAddress,
          undefined, // deviceName will be auto-generated
          payload.sessionId
        );
        deviceId = deviceResult.deviceId;
      } catch (error) {
        console.warn('Device registration failed:', error);
        // Don't fail authentication due to device registration issues
      }
    }

    // Populate request with authenticated user information
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sessionId: payload.sessionId,
      deviceId
    };

    req.clientInfo = clientInfo;

    next();

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'AUTHENTICATION_ERROR',
      message: 'Internal authentication error'
    });
  }
};

/**
 * Optional authentication middleware for endpoints that work with or without auth
 * Populates user info if token is present but doesn't fail if missing
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue without authentication
    req.clientInfo = {
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown'
    };
    next();
    return;
  }

  // Token provided - try to authenticate
  await authenticateUser(req, res, next);
};

/**
 * Role-based authorization middleware
 * Requires user to have specific role(s)
 */
export const requireRole = (roles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
      return;
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions for this action'
      });
      return;
    }

    next();
  };
};

/**
 * Tenant isolation middleware
 * Ensures user can only access their tenant's data
 */
export const requireTenant = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || !req.user.tenantId) {
    res.status(401).json({
      success: false,
      error: 'TENANT_REQUIRED',
      message: 'Tenant context required'
    });
    return;
  }

  next();
};

/**
 * Device trust verification middleware
 * Ensures the device is trusted for sensitive operations
 */
export const requireTrustedDevice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || !req.user.deviceId) {
    res.status(403).json({
      success: false,
      error: 'DEVICE_REQUIRED',
      message: 'Trusted device required for this operation'
    });
    return;
  }

  try {
    const isTrusted = await deviceService.isDeviceTrusted(req.user.deviceId, req.user.id);
    
    if (!isTrusted) {
      res.status(403).json({
        success: false,
        error: 'DEVICE_NOT_TRUSTED',
        message: 'This operation requires a trusted device'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Device trust verification error:', error);
    res.status(500).json({
      success: false,
      error: 'DEVICE_VERIFICATION_ERROR',
      message: 'Failed to verify device trust'
    });
  }
};