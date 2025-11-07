import { Router } from 'express';
import { oauthService } from '../services/oauthService';
const router = Router();
/**
 * Get OAuth authorization URL for a provider
 * GET /api/oauth/authorize/:provider
 */
router.get('/authorize/:provider', async (req, res) => {
    try {
        const provider = req.params.provider;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!oauthService.isProviderConfigured(provider)) {
            return res.status(400).json({
                error: `Provider ${provider} is not configured. Please set up OAuth credentials.`
            });
        }
        const authUrl = oauthService.getAuthorizationUrl(provider, userId);
        res.json({ authorizationUrl: authUrl });
    }
    catch (error) {
        console.error('OAuth authorization error:', error);
        res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
});
/**
 * OAuth callback handlers for each provider
 */
// Google Drive callback
router.get('/callback/google', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        if (error) {
            return res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) {
            return res.redirect('/?oauth_error=missing_parameters');
        }
        const { userId, tokens } = await oauthService.exchangeCodeForTokens('google_drive', code, state);
        await oauthService.storeTokens(userId, 'google_drive', tokens);
        res.redirect('/?oauth_success=google_drive');
    }
    catch (error) {
        console.error('Google OAuth callback error:', error);
        res.redirect(`/?oauth_error=${encodeURIComponent(error.message)}`);
    }
});
// OneDrive callback
router.get('/callback/onedrive', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        if (error) {
            return res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) {
            return res.redirect('/?oauth_error=missing_parameters');
        }
        const { userId, tokens } = await oauthService.exchangeCodeForTokens('onedrive', code, state);
        await oauthService.storeTokens(userId, 'onedrive', tokens);
        res.redirect('/?oauth_success=onedrive');
    }
    catch (error) {
        console.error('OneDrive OAuth callback error:', error);
        res.redirect(`/?oauth_error=${encodeURIComponent(error.message)}`);
    }
});
// Dropbox callback
router.get('/callback/dropbox', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        if (error) {
            return res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) {
            return res.redirect('/?oauth_error=missing_parameters');
        }
        const { userId, tokens } = await oauthService.exchangeCodeForTokens('dropbox', code, state);
        await oauthService.storeTokens(userId, 'dropbox', tokens);
        res.redirect('/?oauth_success=dropbox');
    }
    catch (error) {
        console.error('Dropbox OAuth callback error:', error);
        res.redirect(`/?oauth_error=${encodeURIComponent(error.message)}`);
    }
});
// Azure Blob callback
router.get('/callback/azure', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        if (error) {
            return res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) {
            return res.redirect('/?oauth_error=missing_parameters');
        }
        const { userId, tokens } = await oauthService.exchangeCodeForTokens('azure_blob', code, state);
        await oauthService.storeTokens(userId, 'azure_blob', tokens);
        res.redirect('/?oauth_success=azure_blob');
    }
    catch (error) {
        console.error('Azure OAuth callback error:', error);
        res.redirect(`/?oauth_error=${encodeURIComponent(error.message)}`);
    }
});
/**
 * Get list of configured providers
 * GET /api/oauth/providers
 */
router.get('/providers', (req, res) => {
    const providers = oauthService.getConfiguredProviders();
    res.json({ providers });
});
export default router;
