import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db.js';
import { userTwoFactorAuth, securityAuditLog } from '../../shared/schema.js';
/**
 * Two-Factor Authentication Service
 * Provides TOTP-based 2FA functionality with backup codes and security auditing
 */
export class TwoFactorAuthService {
    /**
     * Generate a new TOTP secret for a user
     * This creates a base32-encoded secret that can be used with authenticator apps
     */
    generateTOTPSecret() {
        // Generate 20 random bytes (160 bits) for the TOTP secret
        const buffer = crypto.randomBytes(20);
        // Convert to base32 encoding (required for TOTP)
        return this.base32Encode(buffer);
    }
    /**
     * Generate backup codes for 2FA recovery
     * Creates 10 random 12-character alphanumeric codes with full entropy
     */
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            // Generate 12-character alphanumeric code (full 96 bits of entropy)
            const code = crypto.randomBytes(6).toString('hex').toUpperCase();
            codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`);
        }
        return codes;
    }
    /**
     * Hash backup codes for secure storage
     */
    hashBackupCodes(codes) {
        return codes.map(code => crypto.createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex'));
    }
    /**
     * Verify a backup code against stored hashes
     */
    verifyBackupCode(code, hashedCodes) {
        const cleanCode = code.replace(/-/g, '').toUpperCase(); // Remove all dashes
        const hashedInput = crypto.createHash('sha256').update(cleanCode).digest('hex');
        return hashedCodes.includes(hashedInput);
    }
    /**
     * Base32 encoding for TOTP secrets
     * Required for compatibility with authenticator apps
     */
    base32Encode(buffer) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let result = '';
        let bits = 0;
        let value = 0;
        for (let i = 0; i < buffer.length; i++) {
            value = (value << 8) | buffer[i];
            bits += 8;
            while (bits >= 5) {
                result += alphabet[(value >>> (bits - 5)) & 31];
                bits -= 5;
            }
        }
        if (bits > 0) {
            result += alphabet[(value << (5 - bits)) & 31];
        }
        // Pad to multiple of 8 characters
        while (result.length % 8 !== 0) {
            result += '=';
        }
        return result;
    }
    /**
     * Generate TOTP code for a given secret and time window
     */
    generateTOTP(secret, timeWindow) {
        const time = Math.floor((timeWindow || Date.now()) / 1000 / 30); // 30-second window
        const timeBuffer = Buffer.alloc(8);
        timeBuffer.writeUInt32BE(Math.floor(time / 0x100000000), 0);
        timeBuffer.writeUInt32BE(time & 0xffffffff, 4);
        // Decode base32 secret
        const secretBuffer = this.base32Decode(secret);
        // Generate HMAC-SHA1 hash
        const hmac = crypto.createHmac('sha1', secretBuffer);
        hmac.update(timeBuffer);
        const hash = hmac.digest();
        // Dynamic truncation
        const offset = hash[hash.length - 1] & 0x0f;
        const code = ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff);
        // Return 6-digit code
        return (code % 1000000).toString().padStart(6, '0');
    }
    /**
     * Base32 decoding for TOTP verification
     */
    base32Decode(encoded) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        encoded = encoded.toUpperCase().replace(/=+$/, '');
        let bits = 0;
        let value = 0;
        let index = 0;
        const output = new Uint8Array(Math.ceil(encoded.length * 5 / 8));
        for (let i = 0; i < encoded.length; i++) {
            const charIndex = alphabet.indexOf(encoded[i]);
            if (charIndex === -1) {
                throw new Error('Invalid base32 character');
            }
            value = (value << 5) | charIndex;
            bits += 5;
            if (bits >= 8) {
                output[index++] = (value >>> (bits - 8)) & 255;
                bits -= 8;
            }
        }
        return Buffer.from(output.subarray(0, index));
    }
    /**
     * Verify TOTP code with time window tolerance
     */
    verifyTOTP(secret, token) {
        const currentTime = Date.now();
        // Check current window and adjacent windows (±30 seconds)
        for (let i = -1; i <= 1; i++) {
            const timeWindow = currentTime + (i * 30 * 1000);
            const expectedToken = this.generateTOTP(secret, timeWindow);
            if (token === expectedToken) {
                return true;
            }
        }
        return false;
    }
    /**
     * Create QR code URL for TOTP setup
     */
    generateQRCodeURL(secret, userEmail, issuer = 'R2v3 Certification') {
        const params = new URLSearchParams({
            secret,
            issuer,
            algorithm: 'SHA1',
            digits: '6',
            period: '30'
        });
        return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(userEmail)}?${params}`;
    }
    /**
     * Log security events for audit trail
     */
    async logSecurityEvent(eventType, userId, sessionId, deviceId, metadata, ipAddress, userAgent) {
        try {
            const auditEntry = {
                eventType,
                severity: 'info',
                userId,
                sessionId,
                deviceId,
                targetUserId: userId,
                targetResourceType: 'user',
                targetResourceId: userId,
                ipAddress: ipAddress || 'unknown',
                userAgent,
                description: `2FA operation: ${eventType}`,
                metadata: metadata || {},
                isSuccessful: true
            };
            await db.insert(securityAuditLog).values(auditEntry);
        }
        catch (error) {
            console.error('Failed to log security event:', error);
            // Don't throw - logging failures shouldn't break the main operation
        }
    }
    /**
     * Initialize 2FA setup for a user
     * Returns secret and backup codes for setup process
     */
    async initializeSetup(userId, userEmail, sessionId, deviceId, ipAddress, userAgent) {
        // Check if user already has 2FA enabled
        const existing = await db
            .select()
            .from(userTwoFactorAuth)
            .where(eq(userTwoFactorAuth.userId, userId))
            .limit(1);
        if (existing.length > 0 && existing[0].isEnabled) {
            throw new Error('2FA is already enabled for this user');
        }
        // Generate new setup data
        const secret = this.generateTOTPSecret();
        const backupCodes = this.generateBackupCodes();
        const hashedBackupCodes = this.hashBackupCodes(backupCodes);
        const qrCodeUrl = this.generateQRCodeURL(secret, userEmail);
        // Create or update 2FA record
        const newAuth = {
            userId,
            secret,
            backupCodes: hashedBackupCodes,
            isEnabled: false,
            usedBackupCodes: [],
            qrCodeUrl
        };
        if (existing.length > 0) {
            // Update existing record
            await db
                .update(userTwoFactorAuth)
                .set({
                ...newAuth,
                updatedAt: new Date()
            })
                .where(eq(userTwoFactorAuth.userId, userId));
        }
        else {
            // Create new record
            await db.insert(userTwoFactorAuth).values(newAuth);
        }
        // Log security event
        await this.logSecurityEvent('2fa_setup_initiated', userId, sessionId, deviceId, { userEmail }, ipAddress, userAgent);
        return {
            secret,
            qrCodeUrl,
            backupCodes
        };
    }
    /**
     * Complete 2FA setup by verifying the first TOTP code
     */
    async completeSetup(userId, totpCode, sessionId, deviceId, ipAddress, userAgent) {
        const auth = await db
            .select()
            .from(userTwoFactorAuth)
            .where(eq(userTwoFactorAuth.userId, userId))
            .limit(1);
        if (auth.length === 0) {
            throw new Error('2FA setup not found. Please initialize setup first.');
        }
        const authRecord = auth[0];
        if (authRecord.isEnabled) {
            return { success: false, message: '2FA is already enabled' };
        }
        // Verify TOTP code
        const isValid = this.verifyTOTP(authRecord.secret, totpCode);
        if (!isValid) {
            await this.logSecurityEvent('2fa_setup_failed', userId, sessionId, deviceId, { reason: 'invalid_totp_code' }, ipAddress, userAgent);
            return { success: false, message: 'Invalid TOTP code' };
        }
        // Enable 2FA
        await db
            .update(userTwoFactorAuth)
            .set({
            isEnabled: true,
            setupCompletedAt: new Date(),
            qrCodeUrl: null, // Clear temporary QR code
            updatedAt: new Date()
        })
            .where(eq(userTwoFactorAuth.userId, userId));
        // Log successful setup
        await this.logSecurityEvent('2fa_enabled', userId, sessionId, deviceId, {}, ipAddress, userAgent);
        return { success: true, message: '2FA enabled successfully' };
    }
    /**
     * Verify a TOTP code or backup code during login
     */
    async verifyCode(userId, code, sessionId, deviceId, ipAddress, userAgent) {
        const auth = await db
            .select()
            .from(userTwoFactorAuth)
            .where(and(eq(userTwoFactorAuth.userId, userId), eq(userTwoFactorAuth.isEnabled, true)))
            .limit(1);
        if (auth.length === 0) {
            return { success: false, message: '2FA not enabled for this user' };
        }
        const authRecord = auth[0];
        // First try TOTP verification
        const isTOTPValid = this.verifyTOTP(authRecord.secret, code);
        if (isTOTPValid) {
            // Update last used timestamp
            await db
                .update(userTwoFactorAuth)
                .set({
                lastUsedAt: new Date(),
                updatedAt: new Date()
            })
                .where(eq(userTwoFactorAuth.userId, userId));
            await this.logSecurityEvent('2fa_totp_verified', userId, sessionId, deviceId, {}, ipAddress, userAgent);
            return { success: true, message: '2FA code verified', usedBackupCode: false };
        }
        // Try backup code verification
        const isBackupValid = this.verifyBackupCode(code, authRecord.backupCodes);
        if (isBackupValid) {
            // Mark backup code as used
            const codeHash = crypto.createHash('sha256').update(code.replace('-', '').toUpperCase()).digest('hex');
            const updatedUsedCodes = [...authRecord.usedBackupCodes, codeHash];
            await db
                .update(userTwoFactorAuth)
                .set({
                usedBackupCodes: updatedUsedCodes,
                lastUsedAt: new Date(),
                updatedAt: new Date()
            })
                .where(eq(userTwoFactorAuth.userId, userId));
            await this.logSecurityEvent('2fa_backup_code_used', userId, sessionId, deviceId, { remainingBackupCodes: authRecord.backupCodes.length - updatedUsedCodes.length }, ipAddress, userAgent);
            return {
                success: true,
                message: 'Backup code verified successfully',
                usedBackupCode: true
            };
        }
        // Log failed verification
        await this.logSecurityEvent('2fa_verification_failed', userId, sessionId, deviceId, { reason: 'invalid_code' }, ipAddress, userAgent);
        return { success: false, message: 'Invalid 2FA code' };
    }
    /**
     * Disable 2FA for a user
     */
    async disable2FA(userId, sessionId, deviceId, ipAddress, userAgent) {
        const result = await db
            .delete(userTwoFactorAuth)
            .where(eq(userTwoFactorAuth.userId, userId))
            .returning();
        if (result.length === 0) {
            return { success: false, message: '2FA was not enabled for this user' };
        }
        await this.logSecurityEvent('2fa_disabled', userId, sessionId, deviceId, {}, ipAddress, userAgent);
        return { success: true, message: '2FA disabled successfully' };
    }
    /**
     * Get 2FA status for a user
     */
    async getStatus(userId) {
        const auth = await db
            .select()
            .from(userTwoFactorAuth)
            .where(eq(userTwoFactorAuth.userId, userId))
            .limit(1);
        if (auth.length === 0) {
            return { isEnabled: false };
        }
        const authRecord = auth[0];
        return {
            isEnabled: authRecord.isEnabled,
            setupCompletedAt: authRecord.setupCompletedAt || undefined,
            lastUsedAt: authRecord.lastUsedAt || undefined,
            remainingBackupCodes: authRecord.isEnabled
                ? authRecord.backupCodes.length - authRecord.usedBackupCodes.length
                : undefined
        };
    }
    /**
     * Regenerate backup codes for a user
     */
    async regenerateBackupCodes(userId, sessionId, deviceId, ipAddress, userAgent) {
        const auth = await db
            .select()
            .from(userTwoFactorAuth)
            .where(and(eq(userTwoFactorAuth.userId, userId), eq(userTwoFactorAuth.isEnabled, true)))
            .limit(1);
        if (auth.length === 0) {
            return { success: false, message: '2FA not enabled for this user' };
        }
        // Generate new backup codes
        const newBackupCodes = this.generateBackupCodes();
        const hashedBackupCodes = this.hashBackupCodes(newBackupCodes);
        await db
            .update(userTwoFactorAuth)
            .set({
            backupCodes: hashedBackupCodes,
            usedBackupCodes: [], // Reset used codes
            updatedAt: new Date()
        })
            .where(eq(userTwoFactorAuth.userId, userId));
        await this.logSecurityEvent('2fa_backup_codes_regenerated', userId, sessionId, deviceId, {}, ipAddress, userAgent);
        return {
            success: true,
            backupCodes: newBackupCodes,
            message: 'Backup codes regenerated successfully'
        };
    }
}
// Export singleton instance
export const twoFactorAuthService = new TwoFactorAuthService();
