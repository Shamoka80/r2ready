// Production security middleware - strict authentication required
export const productionSecurityGuard = (req, res, next) => {
    // Strict production authentication - no bypasses or exceptions
    if (!req.user || !req.tenant) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
        });
    }
    // Enforce completed setup
    if (req.user.setupStatus !== 'COMPLETED') {
        return res.status(403).json({
            error: 'User setup not completed',
            code: 'SETUP_INCOMPLETE',
            redirectTo: '/onboarding'
        });
    }
    // Enforce active tenant status
    if (!req.tenant.isActive) {
        return res.status(403).json({
            error: 'Account suspended',
            code: 'ACCOUNT_SUSPENDED'
        });
    }
    // Block any test users in production
    if (process.env.NODE_ENV === 'production' && req.user.email?.includes('test')) {
        return res.status(403).json({
            error: 'Test accounts not permitted in production',
            code: 'TEST_USER_BLOCKED'
        });
    }
    next();
};
// Email validation enforcement (no dev bypasses)
export const emailValidationGuard = (req, res, next) => {
    if (!req.user?.emailVerified) {
        return res.status(403).json({
            error: 'Email verification required',
            code: 'EMAIL_NOT_VERIFIED',
            redirectTo: '/verify-email'
        });
    }
    next();
};
// Two-factor authentication enforcement for sensitive operations
export const twoFactorGuard = (req, res, next) => {
    const sensitiveEndpoints = [
        '/licenses',
        '/team-management',
        '/rbac',
        '/settings/security'
    ];
    const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint => req.path.startsWith(endpoint));
    if (isSensitiveEndpoint && !req.user?.twoFactorEnabled) {
        return res.status(403).json({
            error: '2FA required for this operation',
            code: 'TWO_FACTOR_REQUIRED',
            redirectTo: '/settings/security'
        });
    }
    next();
};
// License validation for premium features
export const licenseGuard = (requiredTier) => {
    return (req, res, next) => {
        // Implementation would check user's active license
        // For now, we'll implement basic validation
        if (!req.tenant?.licenseStatus || req.tenant.licenseStatus !== 'ACTIVE') {
            return res.status(402).json({
                error: 'Active license required',
                code: 'LICENSE_REQUIRED',
                redirectTo: '/pricing'
            });
        }
        next();
    };
};
// Helper function to check if email is a test email
export function isTestEmail(email) {
    return email?.includes('test') || email?.includes('@example.com') || email?.includes('+test@');
}
// Middleware to block test user login in production
export function blockTestUserLogin(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        const email = req.body.email;
        if (email && isTestEmail(email)) {
            return res.status(403).json({
                error: 'Test accounts not permitted in production',
                code: 'TEST_USER_BLOCKED'
            });
        }
    }
    next();
}
// Middleware to block test user registration
export function blockTestUserRegistration(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        const email = req.body.email;
        if (email && isTestEmail(email)) {
            return res.status(403).json({
                error: 'Test accounts not permitted in production',
                code: 'TEST_USER_BLOCKED'
            });
        }
    }
    next();
}
export default {
    productionSecurityGuard,
    emailValidationGuard,
    twoFactorGuard,
    licenseGuard,
    blockTestUserLogin,
    blockTestUserRegistration,
    isTestEmail
};
