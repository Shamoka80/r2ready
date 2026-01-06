/**
 * Microsoft 365 SMTP Configuration
 *
 * Provides SMTP transporter for Microsoft 365 (Exchange Online) email service.
 * Supports both:
 * - Basic SMTP Authentication (username/password)
 * - OAuth2 Authentication (Azure App Credentials)
 *
 * Configuration via environment variables:
 * - MS365_SMTP_HOST: SMTP server host (default: smtp.office365.com)
 * - MS365_SMTP_PORT: SMTP port (default: 587)
 * - MS365_SMTP_USER: Email address for authentication
 * - MS365_SMTP_PASSWORD: Password for basic auth (if using basic auth)
 * - MS365_SMTP_FROM_EMAIL: From email address
 * - MS365_OAUTH_CLIENT_ID: Azure App Client ID (if using OAuth2)
 * - MS365_OAUTH_CLIENT_SECRET: Azure App Client Secret (if using OAuth2)
 * - MS365_OAUTH_TENANT_ID: Azure Tenant ID (if using OAuth2)
 * - MS365_OAUTH_REFRESH_TOKEN: OAuth2 refresh token (if using OAuth2)
 */
import nodemailer from 'nodemailer';
import { ConsistentLogService } from './consistentLogService';
class Microsoft365SmtpService {
    transporter = null;
    logger = ConsistentLogService.getInstance();
    config = null;
    /**
     * Initialize Microsoft 365 SMTP transporter
     */
    async initialize() {
        try {
            // Support both existing variable names and new MS365_ prefixed names
            // Priority: Use existing names if present, fallback to MS365_ prefixed names
            const host = process.env.SMTP_HOST || process.env.MS365_SMTP_HOST || 'smtp.office365.com';
            const port = parseInt(process.env.SMTP_PORT || process.env.MS365_SMTP_PORT || '587', 10);
            const user = process.env.SMTP_USER || process.env.MS365_SMTP_USER;
            const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.MICROSOFT_365_FROM_EMAIL || process.env.MS365_SMTP_FROM_EMAIL || user;
            const fromName = process.env.SMTP_FROM_NAME;
            if (!user) {
                this.logger.warn('Microsoft 365 SMTP not configured - SMTP_USER or MS365_SMTP_USER is missing');
                return null;
            }
            // Determine authentication method - prioritize Basic Auth if password is available
            // Check both naming conventions
            const hasBasicAuth = !!(process.env.SMTP_PASSWORD || process.env.MS365_SMTP_PASSWORD);
            const hasOAuth2Credentials = !!((process.env.MICROSOFT_365_CLIENT_ID || process.env.MS365_OAUTH_CLIENT_ID) &&
                (process.env.MICROSOFT_365_CLIENT_SECRET || process.env.MS365_OAUTH_CLIENT_SECRET) &&
                (process.env.MICROSOFT_365_TENANT_ID || process.env.MS365_OAUTH_TENANT_ID));
            const hasRefreshToken = !!(process.env.MS365_OAUTH_REFRESH_TOKEN);
            // Priority: Basic Auth if password is present (simpler and more reliable)
            // Only use OAuth2 if Basic Auth is NOT available AND OAuth2 credentials + refresh token are present
            const useBasicAuth = hasBasicAuth;
            const useOAuth2 = !hasBasicAuth && hasOAuth2Credentials && hasRefreshToken;
            if (!useOAuth2 && !useBasicAuth) {
                this.logger.warn('Microsoft 365 SMTP authentication not configured - need either SMTP_PASSWORD/MS365_SMTP_PASSWORD (basic auth) or OAuth2 credentials with refresh token');
                return null;
            }
            // Build configuration
            let config;
            // Get TLS configuration
            const tlsRejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true' ||
                process.env.SMTP_TLS_REJECT_UNAUTHORIZED === '1';
            const secure = process.env.SMTP_SECURE === 'true' ||
                process.env.SMTP_SECURE === '1' ||
                port === 465;
            if (useOAuth2) {
                // OAuth2 Configuration for Microsoft 365
                // Support both existing and new variable names
                const clientId = process.env.MICROSOFT_365_CLIENT_ID || process.env.MS365_OAUTH_CLIENT_ID;
                const clientSecret = process.env.MICROSOFT_365_CLIENT_SECRET || process.env.MS365_OAUTH_CLIENT_SECRET;
                const tenantId = process.env.MICROSOFT_365_TENANT_ID || process.env.MS365_OAUTH_TENANT_ID;
                const refreshToken = process.env.MS365_OAUTH_REFRESH_TOKEN;
                config = {
                    host,
                    port,
                    secure: secure,
                    auth: {
                        type: 'OAuth2',
                        user,
                        clientId,
                        clientSecret,
                        refreshToken,
                        accessUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
                    },
                    tls: {
                        ciphers: 'SSLv3',
                        rejectUnauthorized: tlsRejectUnauthorized,
                    },
                };
                this.logger.info('Microsoft 365 OAuth2 configured');
            }
            else {
                // Basic Authentication
                const password = process.env.SMTP_PASSWORD || process.env.MS365_SMTP_PASSWORD;
                config = {
                    host,
                    port,
                    secure: secure,
                    auth: {
                        user,
                        pass: password,
                    },
                    tls: {
                        ciphers: 'SSLv3',
                        rejectUnauthorized: tlsRejectUnauthorized,
                    },
                };
                this.logger.info('Microsoft 365 SMTP configured with basic authentication');
            }
            // Create transporter
            this.transporter = nodemailer.createTransport(config);
            // Verify connection
            try {
                await this.transporter.verify();
                this.logger.info(`Microsoft 365 SMTP connection verified successfully (${host}:${port})`);
                this.config = config;
                return this.transporter;
            }
            catch (verifyError) {
                this.logger.error('Microsoft 365 SMTP connection verification failed', verifyError);
                this.transporter = null;
                return null;
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize Microsoft 365 SMTP', error);
            this.transporter = null;
            return null;
        }
    }
    /**
     * Get the configured transporter
     */
    getTransporter() {
        return this.transporter;
    }
    /**
     * Get the from email address
     */
    getFromEmail() {
        return process.env.SMTP_FROM_EMAIL ||
            process.env.MICROSOFT_365_FROM_EMAIL ||
            process.env.MS365_SMTP_FROM_EMAIL ||
            process.env.SMTP_USER ||
            process.env.MS365_SMTP_USER ||
            'noreply@example.com';
    }
    /**
     * Get the from name (if configured)
     */
    getFromName() {
        return process.env.SMTP_FROM_NAME;
    }
    /**
     * Check if Microsoft 365 SMTP is configured
     * Supports both existing variable names and new MS365_ prefixed names
     */
    isConfigured() {
        const hasUser = !!(process.env.SMTP_USER || process.env.MS365_SMTP_USER);
        const hasBasicAuth = !!(process.env.SMTP_PASSWORD || process.env.MS365_SMTP_PASSWORD);
        const hasOAuth2 = !!((process.env.MICROSOFT_365_CLIENT_ID || process.env.MS365_OAUTH_CLIENT_ID) &&
            (process.env.MICROSOFT_365_CLIENT_SECRET || process.env.MS365_OAUTH_CLIENT_SECRET) &&
            (process.env.MICROSOFT_365_TENANT_ID || process.env.MS365_OAUTH_TENANT_ID));
        return hasUser && (hasBasicAuth || hasOAuth2);
    }
    /**
     * Refresh OAuth2 access token (if using OAuth2)
     * This is a placeholder - implement based on your Azure app configuration
     */
    async refreshAccessToken() {
        if (!this.config || this.config.auth.type !== 'OAuth2') {
            return null;
        }
        const tenantId = process.env.MICROSOFT_365_TENANT_ID || process.env.MS365_OAUTH_TENANT_ID;
        if (!tenantId) {
            return null;
        }
        // TODO: Implement OAuth2 token refresh using Azure Identity SDK or REST API
        // Example using Azure REST API:
        // const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        // Make POST request to refresh token
        this.logger.warn('OAuth2 token refresh not yet implemented - using existing token');
        return null;
    }
}
// Export singleton instance
const microsoft365SmtpService = new Microsoft365SmtpService();
export { microsoft365SmtpService, Microsoft365SmtpService };
export default microsoft365SmtpService;
