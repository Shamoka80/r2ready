import crypto from 'crypto';
import { db } from '../db';
import { userCloudStorageConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
export class OAuthService {
    configs = new Map();
    constructor() {
        this.initializeConfigs();
    }
    initializeConfigs() {
        const baseRedirectUri = process.env.REPLIT_DOMAINS
            ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/api/oauth/callback`
            : 'http://localhost:5000/api/oauth/callback';
        // Google Drive OAuth
        if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
            this.configs.set('google_drive', {
                clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
                clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
                redirectUri: `${baseRedirectUri}/google`,
                scopes: [
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/userinfo.profile'
                ],
                authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token'
            });
        }
        // OneDrive (Microsoft) OAuth
        if (process.env.MICROSOFT_OAUTH_CLIENT_ID && process.env.MICROSOFT_OAUTH_CLIENT_SECRET) {
            this.configs.set('onedrive', {
                clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
                clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
                redirectUri: `${baseRedirectUri}/onedrive`,
                scopes: [
                    'Files.ReadWrite',
                    'Files.ReadWrite.All',
                    'User.Read',
                    'offline_access'
                ],
                authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
                tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
            });
        }
        // Dropbox OAuth
        if (process.env.DROPBOX_OAUTH_CLIENT_ID && process.env.DROPBOX_OAUTH_CLIENT_SECRET) {
            this.configs.set('dropbox', {
                clientId: process.env.DROPBOX_OAUTH_CLIENT_ID,
                clientSecret: process.env.DROPBOX_OAUTH_CLIENT_SECRET,
                redirectUri: `${baseRedirectUri}/dropbox`,
                scopes: ['files.content.write', 'files.content.read', 'account_info.read'],
                authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
                tokenUrl: 'https://api.dropboxapi.com/oauth2/token'
            });
        }
        // Azure Blob Storage OAuth (same as OneDrive, but different scopes)
        if (process.env.AZURE_OAUTH_CLIENT_ID && process.env.AZURE_OAUTH_CLIENT_SECRET) {
            this.configs.set('azure_blob', {
                clientId: process.env.AZURE_OAUTH_CLIENT_ID,
                clientSecret: process.env.AZURE_OAUTH_CLIENT_SECRET,
                redirectUri: `${baseRedirectUri}/azure`,
                scopes: [
                    'https://storage.azure.com/user_impersonation',
                    'User.Read',
                    'offline_access'
                ],
                authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
                tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
            });
        }
    }
    /**
     * Generate OAuth authorization URL for a provider
     */
    getAuthorizationUrl(provider, userId) {
        const config = this.configs.get(provider);
        if (!config) {
            throw new Error(`OAuth not configured for provider: ${provider}`);
        }
        const state = this.generateState(userId, provider);
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: config.scopes.join(' '),
            state,
            access_type: 'offline', // For Google to get refresh token
            prompt: 'consent' // Force consent to ensure refresh token
        });
        return `${config.authorizationUrl}?${params.toString()}`;
    }
    /**
     * Exchange authorization code for access tokens
     */
    async exchangeCodeForTokens(provider, code, state) {
        const config = this.configs.get(provider);
        if (!config) {
            throw new Error(`OAuth not configured for provider: ${provider}`);
        }
        const { userId } = this.verifyState(state, provider);
        const params = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code'
        });
        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }
        const data = await response.json();
        // Get user info
        const userInfo = await this.getUserInfo(provider, data.access_token);
        const tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
            providerUserId: userInfo.id,
            providerEmail: userInfo.email
        };
        return { userId, tokens };
    }
    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(provider, refreshToken) {
        const config = this.configs.get(provider);
        if (!config) {
            throw new Error(`OAuth not configured for provider: ${provider}`);
        }
        const params = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        });
        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token refresh failed: ${error}`);
        }
        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
            expiresIn: data.expires_in
        };
    }
    /**
     * Get user information from provider
     */
    async getUserInfo(provider, accessToken) {
        let url;
        const headers = {
            'Authorization': `Bearer ${accessToken}`
        };
        switch (provider) {
            case 'google_drive':
                url = 'https://www.googleapis.com/oauth2/v2/userinfo';
                break;
            case 'onedrive':
            case 'azure_blob':
                url = 'https://graph.microsoft.com/v1.0/me';
                break;
            case 'dropbox':
                url = 'https://api.dropboxapi.com/2/users/get_current_account';
                headers['Content-Type'] = 'application/json';
                break;
            default:
                throw new Error(`User info not supported for provider: ${provider}`);
        }
        const response = await fetch(url, {
            method: provider === 'dropbox' ? 'POST' : 'GET',
            headers,
            body: provider === 'dropbox' ? 'null' : undefined
        });
        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.statusText}`);
        }
        const data = await response.json();
        // Map provider-specific response to common format
        switch (provider) {
            case 'google_drive':
                return { id: data.id, email: data.email };
            case 'onedrive':
            case 'azure_blob':
                return { id: data.id, email: data.mail || data.userPrincipalName };
            case 'dropbox':
                return { id: data.account_id, email: data.email };
            default:
                throw new Error(`User info mapping not supported for provider: ${provider}`);
        }
    }
    /**
     * Store OAuth tokens in database
     */
    async storeTokens(userId, provider, tokens, isDefault = false) {
        const expiresAt = tokens.expiresIn
            ? new Date(Date.now() + tokens.expiresIn * 1000)
            : null;
        // Check if connection already exists
        const existing = await db
            .select()
            .from(userCloudStorageConnections)
            .where(and(eq(userCloudStorageConnections.userId, userId), eq(userCloudStorageConnections.provider, provider)))
            .limit(1);
        if (existing.length > 0) {
            // Update existing connection
            await db
                .update(userCloudStorageConnections)
                .set({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken || existing[0].refreshToken,
                tokenExpiresAt: expiresAt,
                providerUserId: tokens.providerUserId || existing[0].providerUserId,
                providerEmail: tokens.providerEmail || existing[0].providerEmail,
                isActive: true,
                lastSuccessfulConnection: new Date(),
                failureCount: 0,
                lastErrorMessage: null,
                updatedAt: new Date()
            })
                .where(eq(userCloudStorageConnections.id, existing[0].id));
        }
        else {
            // If this is the first connection, make it default
            const shouldBeDefault = isDefault || (await this.getUserConnectionCount(userId)) === 0;
            // Insert new connection
            await db.insert(userCloudStorageConnections).values({
                userId,
                provider,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                tokenExpiresAt: expiresAt,
                providerUserId: tokens.providerUserId,
                providerEmail: tokens.providerEmail,
                isDefault: shouldBeDefault,
                isActive: true,
                lastSuccessfulConnection: new Date()
            });
        }
    }
    /**
     * Get number of active connections for a user
     */
    async getUserConnectionCount(userId) {
        const connections = await db
            .select()
            .from(userCloudStorageConnections)
            .where(eq(userCloudStorageConnections.userId, userId));
        return connections.length;
    }
    /**
     * Generate cryptographically secure state parameter
     */
    generateState(userId, provider) {
        const nonce = crypto.randomBytes(16).toString('hex');
        const payload = JSON.stringify({ userId, provider, nonce, timestamp: Date.now() });
        return Buffer.from(payload).toString('base64url');
    }
    /**
     * Verify and decode state parameter
     */
    verifyState(state, expectedProvider) {
        try {
            const payload = JSON.parse(Buffer.from(state, 'base64url').toString());
            // Verify timestamp (state valid for 10 minutes)
            const age = Date.now() - payload.timestamp;
            if (age > 10 * 60 * 1000) {
                throw new Error('OAuth state expired');
            }
            if (payload.provider !== expectedProvider) {
                throw new Error('OAuth state provider mismatch');
            }
            return { userId: payload.userId, provider: payload.provider };
        }
        catch (error) {
            throw new Error('Invalid OAuth state parameter');
        }
    }
    /**
     * Check if provider is configured
     */
    isProviderConfigured(provider) {
        return this.configs.has(provider);
    }
    /**
     * Get list of configured providers
     */
    getConfiguredProviders() {
        return Array.from(this.configs.keys());
    }
}
export const oauthService = new OAuthService();
