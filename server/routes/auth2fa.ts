import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { twoFactorAuthService } from '../services/twoFactorAuthService';
import { jwtService } from '../services/jwtService';
import { deviceService } from '../services/deviceService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';

const router = Router();

// Request validation schemas
const initializeSetupSchema = z.object({
  userEmail: z.string().email('Valid email is required'),
});

const completeSetupSchema = z.object({
  totpCode: z.string().min(6, 'TOTP code must be 6 digits').max(6, 'TOTP code must be 6 digits'),
});

const verifyCodeSchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 characters'),
});

const regenerateBackupCodesSchema = z.object({
  // No additional fields required - user must be authenticated
});

// Note: Using real authentication middleware imported from ../middleware/authMiddleware

/**
 * Initialize 2FA setup for the authenticated user
 * Returns TOTP secret, QR code URL, and backup codes
 */
router.post('/setup/initialize', rateLimitMiddleware.twoFactorSetup, authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userEmail } = initializeSetupSchema.parse(req.body);
    const { id: userId, sessionId, deviceId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;

    const result = await twoFactorAuthService.initializeSetup(
      userId,
      userEmail,
      sessionId,
      deviceId,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: '2FA setup initialized successfully',
      data: {
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes
      }
    });
  } catch (error) {
    console.error('2FA setup initialization error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initialize 2FA setup'
    });
  }
}) as any);

/**
 * Complete 2FA setup by verifying the first TOTP code
 */
router.post('/setup/complete', rateLimitMiddleware.twoFactorSetup, authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { totpCode } = completeSetupSchema.parse(req.body);
    const { id: userId, sessionId, deviceId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;

    const result = await twoFactorAuthService.completeSetup(
      userId,
      totpCode,
      sessionId,
      deviceId,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('2FA setup completion error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to complete 2FA setup'
    });
  }
}) as any);

/**
 * Verify a 2FA code (TOTP or backup code)
 */
router.post('/verify', rateLimitMiddleware.twoFactorVerify, authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = verifyCodeSchema.parse(req.body);
    const { id: userId, sessionId, deviceId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;

    const result = await twoFactorAuthService.verifyCode(
      userId,
      code,
      sessionId,
      deviceId,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: result.success,
      message: result.message,
      usedBackupCode: result.usedBackupCode || false
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to verify 2FA code'
    });
  }
}) as any);

/**
 * Get 2FA status for the authenticated user
 */
router.get('/status', authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: userId } = req.user;
    
    const status = await twoFactorAuthService.getStatus(userId);

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get 2FA status'
    });
  }
}) as any);

/**
 * Disable 2FA for the authenticated user
 */
router.post('/disable', rateLimitMiddleware.twoFactorDisable, authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: userId, sessionId, deviceId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;

    const result = await twoFactorAuthService.disable2FA(
      userId,
      sessionId,
      deviceId,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to disable 2FA'
    });
  }
}) as any);

/**
 * Regenerate backup codes for the authenticated user
 */
router.post('/backup-codes/regenerate', authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: userId, sessionId, deviceId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;

    const result = await twoFactorAuthService.regenerateBackupCodes(
      userId,
      sessionId,
      deviceId,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: result.success,
      message: result.message,
      backupCodes: result.backupCodes || []
    });
  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to regenerate backup codes'
    });
  }
}) as any);

/**
 * Device management endpoints
 */

/**
 * Get all devices for the authenticated user
 */
router.get('/devices', authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: userId } = req.user;
    
    const result = await deviceService.getUserDevices(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get devices'
    });
  }
}) as any);

/**
 * Register or update current device
 */
router.post('/devices/register', rateLimitMiddleware.deviceRegister, authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: userId, sessionId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;
    const { deviceName } = req.body;

    const result = await deviceService.registerDevice(
      userId,
      userAgent,
      ipAddress,
      deviceName,
      sessionId
    );

    res.status(200).json({
      success: true,
      message: result.isNewDevice ? 'New device registered' : 'Device updated',
      data: {
        deviceId: result.deviceId,
        isNewDevice: result.isNewDevice,
        device: result.device
      }
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register device'
    });
  }
}) as any);

/**
 * Trust a device
 */
router.post('/devices/:deviceId/trust', authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { id: userId, sessionId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;

    const result = await deviceService.trustDevice(
      deviceId,
      userId,
      sessionId,
      ipAddress,
      userAgent
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Trust device error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trust device'
    });
  }
}) as any);

/**
 * Revoke a device
 */
router.post('/devices/:deviceId/revoke', authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { reason } = req.body;
    const { id: userId, sessionId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;

    const result = await deviceService.revokeDevice(
      deviceId,
      userId,
      reason || 'User requested',
      userId, // revokedBy
      sessionId,
      ipAddress,
      userAgent
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Revoke device error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke device'
    });
  }
}) as any);

/**
 * JWT token management endpoints
 */

/**
 * Get active refresh tokens for the user
 */
router.get('/tokens', authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: userId } = req.user;
    
    const result = await jwtService.getUserActiveTokens(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active tokens'
    });
  }
}) as any);

/**
 * Revoke all refresh tokens (logout from all devices)
 */
router.post('/tokens/revoke-all', authenticateUser as any, (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: userId, sessionId } = req.user;
    const { ipAddress, userAgent } = req.clientInfo;
    const { excludeCurrent } = req.body;

    const result = await jwtService.revokeAllUserTokens(
      userId,
      'User requested logout from all devices',
      excludeCurrent ? sessionId : undefined,
      ipAddress,
      userAgent
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Revoke all tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke tokens'
    });
  }
}) as any);

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: '2FA service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;