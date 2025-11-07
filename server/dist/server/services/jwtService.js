import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, and, lt, gt } from 'drizzle-orm';
import { db } from '../db';
import { refreshTokens, securityAuditLog } from '@shared/schema';
/**
 * JWT and Session Management Service
 * Handles short-lived access tokens, refresh tokens, and secure session management
 */
export class JWTService {
    // Token configuration
    accessTokenSecret = this.getRequiredSecret('JWT_ACCESS_SECRET');
    refreshTokenSecret = this.getRequiredSecret('JWT_REFRESH_SECRET');
    accessTokenExpiry = '15m'; // Short-lived access tokens
    refreshTokenExpiry = '7d'; // Refresh tokens last 1 week
    /**
     * Get required secret from environment variables with validation
     */
    getRequiredSecret(envVarName) {
        const secret = process.env[envVarName];
        if (!secret) {
            // For development only - generate a secure random secret
            if (process.env.NODE_ENV !== 'production') {
                console.warn(`⚠️  ${envVarName} not set - generating secure random secret for development`);
                return crypto.randomBytes(32).toString('hex');
            }
            throw new Error(`${envVarName} environment variable is required for JWT security`);
        }
        if (secret.length < 32) {
            throw new Error(`${envVarName} must be at least 32 characters long for security`);
        }
        return secret;
    }
    /**
     * Generate a cryptographically secure random token
     */
    generateSecureToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    /**
     * Hash a token for secure storage
     */
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    /**
     * Generate a unique JWT ID (jti)
     */
    generateJTI() {
        return crypto.randomUUID();
    }
    /**
     * Calculate expiration timestamp
     */
    calculateExpiration(duration) {
        const now = new Date();
        const match = duration.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error('Invalid duration format');
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': return new Date(now.getTime() + value * 1000);
            case 'm': return new Date(now.getTime() + value * 60 * 1000);
            case 'h': return new Date(now.getTime() + value * 60 * 60 * 1000);
            case 'd': return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
            default: throw new Error('Invalid duration unit');
        }
    }
    /**
     * Log security events for audit trail
     */
    async logSecurityEvent(eventType, userId, sessionId, deviceId, metadata, ipAddress, userAgent, severity = 'info') {
        try {
            const auditEntry = {
                eventType,
                severity,
                userId,
                sessionId,
                deviceId,
                targetUserId: userId,
                targetResourceType: 'session',
                targetResourceId: sessionId || 'unknown',
                ipAddress: ipAddress || 'unknown',
                userAgent,
                description: `Session operation: ${eventType}`,
                metadata: metadata || {},
                isSuccessful: true
            };
            await db.insert(securityAuditLog).values(auditEntry);
        }
        catch (error) {
            console.error('Failed to log security event:', error);
        }
    }
    /**
     * Create access token with user payload
     */
    createAccessToken(payload) {
        const jti = this.generateJTI();
        const tokenPayload = {
            ...payload,
            jti,
            type: 'access',
            iat: Math.floor(Date.now() / 1000),
        };
        return jwt.sign(tokenPayload, this.accessTokenSecret, {
            expiresIn: this.accessTokenExpiry,
            issuer: 'r2v3-certification',
            audience: 'r2v3-users'
        });
    }
    /**
     * Create refresh token and store in database
     */
    async createRefreshToken(userId, sessionId, deviceId, ipAddress, userAgent) {
        const token = this.generateSecureToken();
        const tokenHash = this.hashToken(token);
        const jti = this.generateJTI();
        const expiresAt = this.calculateExpiration(this.refreshTokenExpiry);
        // Create JWT refresh token
        const jwtPayload = {
            userId,
            sessionId,
            deviceId,
            jti,
            type: 'refresh',
            iat: Math.floor(Date.now() / 1000)
        };
        const jwtToken = jwt.sign(jwtPayload, this.refreshTokenSecret, {
            expiresIn: this.refreshTokenExpiry,
            issuer: 'r2v3-certification',
            audience: 'r2v3-users'
        });
        // Store refresh token in database
        const refreshTokenData = {
            userId,
            sessionId,
            deviceId,
            tokenHash,
            jti,
            ipAddress: ipAddress || 'unknown',
            userAgent: userAgent || 'unknown',
            expiresAt,
            useCount: 0
        };
        await db.insert(refreshTokens).values(refreshTokenData);
        await this.logSecurityEvent('refresh_token_created', userId, sessionId, deviceId, { jti, expiresAt }, ipAddress, userAgent);
        return jwtToken;
    }
    /**
     * Verify and decode access token
     */
    verifyAccessToken(token) {
        try {
            const payload = jwt.verify(token, this.accessTokenSecret, {
                issuer: 'r2v3-certification',
                audience: 'r2v3-users'
            });
            if (typeof payload === 'object' && payload.type === 'access') {
                return { valid: true, payload };
            }
            return { valid: false, error: 'Invalid token type' };
        }
        catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Token verification failed'
            };
        }
    }
    /**
     * Verify refresh token and check database validity
     */
    async verifyRefreshToken(token) {
        try {
            // Verify JWT structure and signature
            const payload = jwt.verify(token, this.refreshTokenSecret, {
                issuer: 'r2v3-certification',
                audience: 'r2v3-users'
            });
            if (typeof payload !== 'object' || payload.type !== 'refresh') {
                return { valid: false, error: 'Invalid token type' };
            }
            // Type assertion for payload
            const typedPayload = payload;
            // Check database record
            const tokenRecords = await db
                .select()
                .from(refreshTokens)
                .where(and(eq(refreshTokens.jti, typedPayload.jti), eq(refreshTokens.userId, typedPayload.userId), eq(refreshTokens.isRevoked, false), gt(refreshTokens.expiresAt, new Date())))
                .limit(1);
            if (tokenRecords.length === 0) {
                return { valid: false, error: 'Token not found or expired' };
            }
            const tokenRecord = tokenRecords[0];
            return {
                valid: true,
                payload,
                tokenRecord
            };
        }
        catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Token verification failed'
            };
        }
    }
    /**
     * Refresh access token using valid refresh token
     */
    async refreshAccessToken(refreshToken, ipAddress, userAgent) {
        const verification = await this.verifyRefreshToken(refreshToken);
        if (!verification.valid || !verification.payload || !verification.tokenRecord) {
            await this.logSecurityEvent('token_refresh_failed', verification.payload?.userId || 'unknown', verification.payload?.sessionId, verification.payload?.deviceId, { reason: verification.error }, ipAddress, userAgent, 'warning');
            return { success: false, error: verification.error };
        }
        const { payload, tokenRecord } = verification;
        try {
            // Update refresh token usage
            await db
                .update(refreshTokens)
                .set({
                lastUsedAt: new Date(),
                useCount: tokenRecord.useCount + 1,
                ipAddress: ipAddress || tokenRecord.ipAddress,
                userAgent: userAgent || tokenRecord.userAgent
            })
                .where(eq(refreshTokens.id, tokenRecord.id));
            // Create new access token
            const accessToken = this.createAccessToken({
                userId: payload.userId,
                email: payload.email || 'unknown',
                role: payload.role || 'user',
                tenantId: payload.tenantId || undefined,
                sessionId: payload.sessionId || undefined,
                deviceId: payload.deviceId || undefined
            });
            // Optionally rotate refresh token for high-security scenarios
            let newRefreshToken;
            // Rotate refresh token if it's been used multiple times
            if (tokenRecord.useCount >= 3) {
                // Revoke old token
                await this.revokeRefreshToken(tokenRecord.id, 'automatic_rotation', payload.userId, payload.sessionId, payload.deviceId, ipAddress, userAgent);
                // Create new refresh token
                newRefreshToken = await this.createRefreshToken(payload.userId, payload.sessionId, payload.deviceId, ipAddress, userAgent);
            }
            await this.logSecurityEvent('token_refreshed', payload.userId, payload.sessionId, payload.deviceId, {
                jti: payload.jti,
                useCount: tokenRecord.useCount + 1,
                rotated: !!newRefreshToken
            }, ipAddress, userAgent);
            return {
                success: true,
                accessToken,
                newRefreshToken
            };
        }
        catch (error) {
            await this.logSecurityEvent('token_refresh_error', payload.userId, payload.sessionId, payload.deviceId, { error: error instanceof Error ? error.message : 'Unknown error' }, ipAddress, userAgent, 'critical');
            return {
                success: false,
                error: 'Failed to refresh token'
            };
        }
    }
    /**
     * Revoke a specific refresh token
     */
    async revokeRefreshToken(tokenId, reason, userId, sessionId, deviceId, ipAddress, userAgent) {
        try {
            const result = await db
                .update(refreshTokens)
                .set({
                isRevoked: true,
                revokedAt: new Date(),
                revokeReason: reason
            })
                .where(eq(refreshTokens.id, tokenId))
                .returning();
            if (result.length === 0) {
                return { success: false, message: 'Token not found' };
            }
            await this.logSecurityEvent('refresh_token_revoked', userId || result[0].userId, sessionId || result[0].sessionId || undefined, deviceId || result[0].deviceId || undefined, { reason, tokenId }, ipAddress, userAgent);
            return { success: true, message: 'Token revoked successfully' };
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to revoke token'
            };
        }
    }
    /**
     * Revoke all refresh tokens for a user
     */
    async revokeAllUserTokens(userId, reason, excludeSessionId, ipAddress, userAgent) {
        try {
            const whereClause = excludeSessionId
                ? and(eq(refreshTokens.userId, userId), eq(refreshTokens.isRevoked, false))
                : and(eq(refreshTokens.userId, userId), eq(refreshTokens.isRevoked, false));
            const result = await db
                .update(refreshTokens)
                .set({
                isRevoked: true,
                revokedAt: new Date(),
                revokeReason: reason
            })
                .where(whereClause)
                .returning();
            await this.logSecurityEvent('all_tokens_revoked', userId, undefined, undefined, { reason, revokedCount: result.length, excludeSessionId }, ipAddress, userAgent);
            return {
                success: true,
                revokedCount: result.length,
                message: `Revoked ${result.length} tokens`
            };
        }
        catch (error) {
            return {
                success: false,
                revokedCount: 0,
                message: 'Failed to revoke tokens'
            };
        }
    }
    /**
     * Clean up expired refresh tokens
     */
    async cleanupExpiredTokens() {
        try {
            const result = await db
                .delete(refreshTokens)
                .where(lt(refreshTokens.expiresAt, new Date()))
                .returning();
            console.log(`Cleaned up ${result.length} expired refresh tokens`);
            return { deletedCount: result.length };
        }
        catch (error) {
            console.error('Failed to cleanup expired tokens:', error);
            return { deletedCount: 0 };
        }
    }
    /**
     * Get all active refresh tokens for a user
     */
    async getUserActiveTokens(userId) {
        const tokensResult = await db
            .select({
            id: refreshTokens.id,
            deviceId: refreshTokens.deviceId,
            ipAddress: refreshTokens.ipAddress,
            userAgent: refreshTokens.userAgent,
            lastUsedAt: refreshTokens.lastUsedAt,
            expiresAt: refreshTokens.expiresAt,
            useCount: refreshTokens.useCount
        })
            .from(refreshTokens)
            .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.isRevoked, false), gt(refreshTokens.expiresAt, new Date())))
            .orderBy(refreshTokens.lastUsedAt);
        // Convert null deviceId to undefined for type compatibility
        const tokens = tokensResult.map(token => ({
            ...token,
            deviceId: token.deviceId || undefined
        }));
        return { tokens };
    }
}
// Export singleton instance
export const jwtService = new JWTService();
