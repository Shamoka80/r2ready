import { rateLimitService } from '../services/rateLimitService';
import { bruteForceAlertService } from '../services/bruteForceAlertService';
import { isTestEmail } from './testUserGuard';
import { isDevelopment } from '../config/environment';
/**
 * Rate limiting middleware factory
 * Creates middleware for specific resources and actions
 */
export const createRateLimit = (resource, action, options) => {
    const { identifierType = 'ip', skipSuccessfulRequests = false, skipFailedRequests = false } = options || {};
    return async (req, res, next) => {
        try {
            // Bypass rate limiting in test environment
            if (process.env.NODE_ENV === 'test') {
                next();
                return;
            }
            // Bypass rate limiting for test users in development environment
            // This allows E2E tests to run sequentially without hitting rate limits
            // while maintaining production security
            if (isDevelopment()) {
                const email = req.body?.email;
                if (email && isTestEmail(email)) {
                    console.log(`[RATE LIMIT] Bypassing rate limit for test user in development: ${email}`);
                    next();
                    return;
                }
            }
            // Get client info
            const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Unknown';
            // Determine identifier based on type
            let identifierValue;
            let userId;
            switch (identifierType) {
                case 'user':
                    if ('user' in req && req.user) {
                        identifierValue = req.user.id;
                        userId = req.user.id;
                    }
                    else {
                        // Fall back to IP if no authenticated user
                        identifierValue = ipAddress;
                    }
                    break;
                case 'session':
                    if ('user' in req && req.user && req.user.sessionId) {
                        identifierValue = req.user.sessionId;
                        userId = req.user.id;
                    }
                    else {
                        // Fall back to IP if no session
                        identifierValue = ipAddress;
                    }
                    break;
                case 'ip':
                default:
                    identifierValue = ipAddress;
                    if ('user' in req && req.user) {
                        userId = req.user.id;
                    }
                    break;
            }
            // Check rate limit
            const rateLimitResult = await rateLimitService.checkRateLimit(identifierType, identifierValue, resource, action, ipAddress, userAgent, userId);
            // Add rate limit headers
            res.set({
                'X-RateLimit-Limit': rateLimitResult.maxAllowed.toString(),
                'X-RateLimit-Remaining': Math.max(0, rateLimitResult.maxAllowed - rateLimitResult.currentCount).toString(),
                'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetAt.getTime() / 1000).toString()
            });
            if (!rateLimitResult.allowed) {
                // Trigger brute-force detection and alerts
                await bruteForceAlertService.handleRateLimitViolation({
                    resource,
                    action,
                    identifierType,
                    identifierValue,
                    ipAddress,
                    userAgent,
                    userId,
                    currentCount: rateLimitResult.currentCount,
                    maxAllowed: rateLimitResult.maxAllowed
                });
                // Set retry-after header if available
                if (rateLimitResult.retryAfter) {
                    res.set('Retry-After', rateLimitResult.retryAfter.toString());
                }
                res.status(429).json({
                    success: false,
                    error: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.',
                    details: {
                        maxAllowed: rateLimitResult.maxAllowed,
                        currentCount: rateLimitResult.currentCount,
                        resetAt: rateLimitResult.resetAt,
                        retryAfter: rateLimitResult.retryAfter
                    }
                });
                return;
            }
            // Store rate limit info for potential cleanup on response
            req.rateLimitInfo = {
                resource,
                action,
                identifierType,
                identifierValue,
                allowed: true
            };
            next();
        }
        catch (error) {
            console.error('Rate limit middleware error:', error);
            // On error, apply conservative rate limiting
            res.status(429).json({
                success: false,
                error: 'RATE_LIMIT_ERROR',
                message: 'Rate limiting service unavailable. Please try again later.'
            });
            return;
        }
    };
};
/**
 * Pre-configured rate limit middleware for common use cases
 */
export const rateLimitMiddleware = {
    // Authentication rate limits
    login: createRateLimit('auth', 'login', { identifierType: 'ip' }),
    register: createRateLimit('auth', 'register', { identifierType: 'ip' }), // More lenient for registration
    passwordReset: createRateLimit('auth', 'password_reset', { identifierType: 'ip' }),
    tokenRefresh: createRateLimit('auth', 'token_refresh', { identifierType: 'ip' }),
    // 2FA rate limits
    twoFactorVerify: createRateLimit('auth', '2fa_verify', { identifierType: 'user' }),
    twoFactorSetup: createRateLimit('2fa', 'setup', { identifierType: 'user' }),
    twoFactorDisable: createRateLimit('2fa', 'disable', { identifierType: 'user' }),
    // Export rate limits
    pdfExport: createRateLimit('exports', 'pdf', { identifierType: 'user' }),
    excelExport: createRateLimit('exports', 'excel', { identifierType: 'user' }),
    // Upload rate limits
    evidenceUpload: createRateLimit('uploads', 'evidence', { identifierType: 'user' }),
    // Device management rate limits
    deviceRegister: createRateLimit('device', 'register', { identifierType: 'ip' }),
    // General API rate limit
    general: createRateLimit('api', 'general', { identifierType: 'ip' }),
    // Stripe checkout rate limit (more lenient for payment flows)
    stripeCheckout: createRateLimit('stripe', 'checkout', { identifierType: 'ip' }),
};
/**
 * Enhanced rate limiting for critical authentication endpoints
 */
export const strictRateLimit = {
    // Very strict limits for critical operations
    adminActions: createRateLimit('admin', 'critical', { identifierType: 'user' }),
    passwordChange: createRateLimit('auth', 'password_change', { identifierType: 'user' }),
    accountDelete: createRateLimit('auth', 'account_delete', { identifierType: 'user' }),
};
/**
 * Response cleanup middleware to handle successful/failed request tracking
 */
export const rateLimitCleanup = (req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        const rateLimitInfo = req.rateLimitInfo;
        if (rateLimitInfo) {
            const isSuccessful = res.statusCode >= 200 && res.statusCode < 400;
            const isFailed = res.statusCode >= 400;
            // Future enhancement: Could implement different cleanup strategies
            // based on success/failure status if needed
        }
        return originalSend.call(this, body);
    };
    next();
};
