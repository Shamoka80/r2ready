import { Router } from 'express';
import { z } from 'zod';
import { jwtService } from '../services/jwtService.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
const router = Router();
// Request validation schemas
const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required')
});
/**
 * Refresh access token using refresh token
 */
router.post('/refresh', rateLimitMiddleware.tokenRefresh, async (req, res) => {
    try {
        const { refreshToken } = refreshTokenSchema.parse(req.body);
        const clientInfo = {
            ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Unknown'
        };
        const result = await jwtService.refreshAccessToken(refreshToken, clientInfo.ipAddress, clientInfo.userAgent);
        if (!result.success) {
            res.status(401).json({
                success: false,
                error: 'REFRESH_FAILED',
                message: result.error || 'Failed to refresh token'
            });
            return;
        }
        const response = {
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: result.accessToken
            }
        };
        // Include new refresh token if it was rotated
        if (result.newRefreshToken) {
            response.data.refreshToken = result.newRefreshToken;
            response.tokenRotated = true;
        }
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Token refresh error:', error);
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Invalid input data',
                details: error.errors
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: 'REFRESH_ERROR',
            message: 'Token refresh failed'
        });
    }
});
/**
 * Get all active refresh tokens for the authenticated user
 */
router.get('/tokens', authenticateUser, (async (req, res) => {
    try {
        const { user } = req;
        const result = await jwtService.getUserActiveTokens(user.id);
        res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Get tokens error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get active tokens'
        });
    }
}));
/**
 * Revoke a specific refresh token
 */
router.post('/tokens/:tokenId/revoke', authenticateUser, (async (req, res) => {
    try {
        const { tokenId } = req.params;
        const { reason } = req.body;
        const { user, clientInfo } = req;
        const result = await jwtService.revokeRefreshToken(tokenId, reason || 'User requested', user.id, user.sessionId, user.deviceId, clientInfo.ipAddress, clientInfo.userAgent);
        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.message
            });
        }
        else {
            res.status(404).json({
                success: false,
                error: 'TOKEN_NOT_FOUND',
                message: result.message
            });
        }
    }
    catch (error) {
        console.error('Revoke token error:', error);
        res.status(500).json({
            success: false,
            error: 'REVOKE_ERROR',
            message: 'Failed to revoke token'
        });
    }
}));
/**
 * Revoke all refresh tokens (logout from all devices)
 */
router.post('/tokens/revoke-all', authenticateUser, (async (req, res) => {
    try {
        const { user, clientInfo } = req;
        const { excludeCurrent } = req.body;
        const result = await jwtService.revokeAllUserTokens(user.id, 'User requested logout from all devices', excludeCurrent ? user.sessionId : undefined, clientInfo.ipAddress, clientInfo.userAgent);
        res.status(200).json(result);
    }
    catch (error) {
        console.error('Revoke all tokens error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke tokens'
        });
    }
}));
/**
 * Clean up expired tokens (admin endpoint)
 */
router.post('/tokens/cleanup', authenticateUser, (async (req, res) => {
    try {
        // Only allow admins to trigger cleanup
        if (req.user.role !== 'business_owner' && req.user.role !== 'consultant_owner') {
            res.status(403).json({
                success: false,
                error: 'INSUFFICIENT_PERMISSIONS',
                message: 'Admin access required'
            });
            return;
        }
        const result = await jwtService.cleanupExpiredTokens();
        res.status(200).json({
            success: true,
            message: `Cleaned up ${result.deletedCount} expired tokens`
        });
    }
    catch (error) {
        console.error('Token cleanup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup expired tokens'
        });
    }
}));
/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'JWT service is healthy',
        timestamp: new Date().toISOString()
    });
});
export default router;
