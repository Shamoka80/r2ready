import { Router } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { db } from "../db";
import { licenses, licenseEvents } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { AuthService } from "../services/authService";
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
const router = Router();
// Helper function to get the correct base URL for redirects
const getBaseUrl = () => {
    // Production or explicit CLIENT_URL
    if (process.env.CLIENT_URL) {
        return process.env.CLIENT_URL;
    }
    // Replit development environment
    if (process.env.REPLIT_DOMAINS) {
        return `https://${process.env.REPLIT_DOMAINS}`;
    }
    // Local development fallback
    return 'http://localhost:5000';
};
// Get Stripe secret key (supports testing key for development)
const stripeSecretKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
// Enforce Stripe configuration
if (!stripeSecretKey) {
    console.warn('⚠️  STRIPE_SECRET_KEY or TESTING_STRIPE_SECRET_KEY not configured - payment routes will be disabled');
}
// Validate that we're using live keys in production
// Allow test keys in production ONLY when explicitly enabled via environment flag
if (process.env.NODE_ENV === 'production' && stripeSecretKey?.includes('sk_test_') && process.env.ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION !== 'true') {
    console.error('❌ Test Stripe keys detected in production environment');
    process.exit(1);
}
// Create Stripe instance only if key is available
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
    apiVersion: '2025-08-27.basil',
}) : null;
// Public endpoint: Get Stripe public key (publishable key)
// This is safe to expose as public keys are meant to be used client-side
router.get("/public-key", (req, res) => {
    try {
        const stripeSecretKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
        const stripePublishableKey = process.env.TESTING_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY;
        // If publishable key is explicitly set, use it
        if (stripePublishableKey) {
            console.log('✅ Using explicit publishable key:', stripePublishableKey.substring(0, 12) + '...');
            return res.json({ publicKey: stripePublishableKey });
        }
        // Otherwise, derive from secret key (sk_test_xxx -> pk_test_xxx or sk_live_xxx -> pk_live_xxx)
        if (stripeSecretKey) {
            // Extract the key part after sk_test_ or sk_live_
            let publicKey;
            if (stripeSecretKey.startsWith('sk_test_')) {
                publicKey = 'pk_test_' + stripeSecretKey.substring(8);
            }
            else if (stripeSecretKey.startsWith('sk_live_')) {
                publicKey = 'pk_live_' + stripeSecretKey.substring(8);
            }
            else {
                console.error('❌ Invalid Stripe secret key format:', stripeSecretKey.substring(0, 12) + '...');
                return res.status(500).json({
                    error: "Invalid Stripe secret key format",
                    message: "Secret key must start with sk_test_ or sk_live_"
                });
            }
            console.log('✅ Derived publishable key from secret key:', publicKey.substring(0, 12) + '...');
            console.log('✅ Secret key used for sessions:', stripeSecretKey.substring(0, 12) + '...');
            return res.json({ publicKey });
        }
        return res.status(503).json({
            error: "Stripe not configured",
            message: "Stripe keys not found in environment variables"
        });
    }
    catch (error) {
        console.error("Error getting Stripe public key:", error);
        res.status(500).json({ error: "Failed to get Stripe public key" });
    }
});
// All other routes require authentication
router.use(AuthService.authMiddleware);
// Production-safe license creation schema
const createLicenseSchema = z.object({
    tier: z.enum(['BUSINESS_SOLO', 'BUSINESS_TEAM', 'BUSINESS_ENTERPRISE', 'CONSULTANT_INDEPENDENT', 'CONSULTANT_AGENCY', 'CONSULTANT_ENTERPRISE']),
    facilityPacks: z.number().min(0).max(100),
    seatPacks: z.number().min(0).max(1000),
    supportTier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE']).default('BASIC'),
    billingEmail: z.string().email(),
});
// Create license purchase session (production-only)
router.post("/create-license", rateLimitMiddleware.general, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({
                error: "Payment processing unavailable",
                message: "Stripe configuration required"
            });
        }
        const data = createLicenseSchema.parse(req.body);
        // Calculate pricing based on tier
        const pricing = calculateLicensePricing(data);
        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${data.tier} License`,
                            description: `R2v3 Assessment Platform - ${data.tier}`,
                        },
                        unit_amount: pricing.total,
                    },
                    quantity: 1,
                }],
            mode: 'payment',
            success_url: `${getBaseUrl()}/licenses/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${getBaseUrl()}/pricing`,
            customer_email: data.billingEmail,
            metadata: {
                tenantId: req.tenant.id,
                userId: req.user.id,
                tier: data.tier,
                facilityPacks: data.facilityPacks.toString(),
                seatPacks: data.seatPacks.toString(),
                supportTier: data.supportTier,
            },
        });
        res.json({
            sessionId: session.id,
            url: session.url
        });
    }
    catch (error) {
        console.error("Error creating license:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create license purchase" });
    }
});
// Create checkout session endpoint (for Licenses page)
// This endpoint accepts licenseId and quantity for addon purchases
router.post("/create-checkout-session", rateLimitMiddleware.stripeCheckout, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({
                error: "Payment processing unavailable",
                message: "Stripe configuration required"
            });
        }
        const { licenseId, quantity = 1 } = req.body;
        if (!licenseId) {
            return res.status(400).json({ error: "licenseId is required" });
        }
        // License configurations for all tiers and addons
        // Prices match the licenseConfigs in server/routes/auth.ts
        const licenseConfigs = {
            // Business tiers
            'solo_business': { price: 39900, name: 'Solo Business' },
            'team_business': { price: 89900, name: 'Team Business' },
            'enterprise_business': { price: 179900, name: 'Enterprise Multi-Site' },
            // Consultant tiers
            'independent_consultant': { price: 59900, name: 'Independent Consultant' },
            'agency_consultant': { price: 119900, name: 'Agency Consultant' },
            'enterprise_consultant': { price: 249900, name: 'Enterprise Agency / CB' },
            // Support packages
            'lite_support_pack': { price: 50000, name: 'Lite Support Pack' },
            'full_guidance_pack': { price: 175000, name: 'Full Guidance Pack' },
            'premium_hourly': { price: 22500, name: 'Premium Hourly Consulting' },
            // Addons - map frontend IDs to backend IDs
            'facility_addon': { price: 40000, name: 'Extra Facility' },
            'solo_seat_addon': { price: 5000, name: 'Extra Seat (Solo)' },
            'team_seat_addon': { price: 4500, name: 'Extra Seat (Team)' },
            'client_addon': { price: 10000, name: 'Extra Client' },
            // Additional addon mappings
            'extra_facility': { price: 40000, name: 'Extra Facility' },
            'extra_seat_solo': { price: 5000, name: 'Extra Seat (Solo)' },
            'extra_seat_team': { price: 4500, name: 'Extra Seat (Team)' },
            'extra_client_independent': { price: 10000, name: 'Extra Client (Independent)' },
            'extra_client_agency': { price: 9000, name: 'Extra Client (Agency)' },
            'extra_client_enterprise': { price: 7500, name: 'Extra Client (Enterprise)' },
        };
        const config = licenseConfigs[licenseId];
        if (!config) {
            return res.status(400).json({ error: `Unknown license ID: ${licenseId}` });
        }
        // Map licenseId to Stripe tier format for activation endpoint
        const licenseIdToTierMap = {
            'solo_business': 'BUSINESS_SOLO',
            'team_business': 'BUSINESS_TEAM',
            'enterprise_business': 'BUSINESS_ENTERPRISE',
            'independent_consultant': 'CONSULTANT_INDEPENDENT',
            'agency_consultant': 'CONSULTANT_AGENCY',
            'enterprise_consultant': 'CONSULTANT_ENTERPRISE',
            // Support packages and addons don't have tiers, but we'll handle them differently
            'lite_support_pack': 'SUPPORT_LITE',
            'full_guidance_pack': 'SUPPORT_FULL',
            'premium_hourly': 'SUPPORT_PREMIUM',
        };
        const tier = licenseIdToTierMap[licenseId] || 'BUSINESS_SOLO';
        const isSupportPackage = licenseId.startsWith('lite_support') || licenseId.startsWith('full_guidance') || licenseId.startsWith('premium_hourly');
        const isAddon = licenseId.includes('_addon') || licenseId.includes('extra_');
        // Calculate total price (price * quantity)
        const totalPrice = config.price * quantity;
        // Log key information for debugging
        const currentSecretKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
        console.log('🔵 Creating Stripe checkout session:', {
            licenseId,
            tier,
            quantity,
            price: config.price,
            totalPrice,
            isSupportPackage,
            isAddon,
            secretKeyPrefix: currentSecretKey?.substring(0, 12) + '...',
            secretKeyMode: currentSecretKey?.includes('sk_test_') ? 'TEST' : currentSecretKey?.includes('sk_live_') ? 'LIVE' : 'UNKNOWN'
        });
        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: config.name,
                            description: config.description || `${config.name} - Quantity: ${quantity}`,
                        },
                        unit_amount: config.price,
                    },
                    quantity: quantity,
                }],
            mode: 'payment',
            success_url: `${getBaseUrl()}/licenses/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${getBaseUrl()}/licenses`,
            customer_email: req.user.email,
            metadata: {
                tenantId: req.tenant.id,
                userId: req.user.id,
                licenseId: licenseId,
                tier: tier, // Add tier for activation endpoint compatibility
                quantity: quantity.toString(),
                facilityPacks: '0',
                seatPacks: '0',
                supportTier: isSupportPackage ? (licenseId.includes('lite') ? 'LITE' : licenseId.includes('full') ? 'FULL' : 'PREMIUM') : 'BASIC',
                isAddon: isAddon.toString(),
                isSupportPackage: isSupportPackage.toString(),
            },
        });
        console.log('✅ Stripe checkout session created:', {
            sessionId: session.id,
            url: session.url?.substring(0, 50) + '...',
            mode: session.mode,
            paymentStatus: session.payment_status
        });
        res.json({
            sessionId: session.id,
            url: session.url
        });
    }
    catch (error) {
        console.error("❌ Error creating checkout session:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create checkout session" });
    }
});
// Get Stripe session details (for success page display)
router.get("/session/:sessionId", rateLimitMiddleware.general, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ error: "Payment verification unavailable" });
        }
        const { sessionId } = req.params;
        // Retrieve session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        // More lenient check: allow access if payment is successful and either tenant or user matches
        // This handles cases where user logged out and back in with different account context
        const sessionTenantId = session.metadata?.tenantId;
        const sessionUserId = session.metadata?.userId;
        const tenantMatches = sessionTenantId === req.tenant.id;
        const userMatches = sessionUserId === req.user.id;
        // Allow access if payment is successful and either tenant or user matches
        // OR if payment is successful and customer email matches (additional verification)
        const emailMatches = session.customer_email === req.user.email ||
            session.customer_details?.email === req.user.email;
        if (session.payment_status === 'paid' && (tenantMatches || userMatches || emailMatches)) {
            // Return session data in the format expected by frontend
            return res.json({
                id: session.id,
                payment_status: session.payment_status,
                customer_email: session.customer_email || session.customer_details?.email,
                amount_total: session.amount_total,
                metadata: session.metadata,
            });
        }
        // If payment not completed, still allow access if tenant/user matches (for pending payments)
        if (tenantMatches || userMatches) {
            return res.json({
                id: session.id,
                payment_status: session.payment_status,
                customer_email: session.customer_email || session.customer_details?.email,
                amount_total: session.amount_total,
                metadata: session.metadata,
            });
        }
        return res.status(403).json({ error: "Unauthorized access to session" });
    }
    catch (error) {
        console.error("Error fetching Stripe session:", error);
        res.status(500).json({ error: "Failed to retrieve session details" });
    }
});
// POST /api/stripe/session/:sessionId/activate - CRITICAL: License activation after payment
// This endpoint creates the license record in the database after Stripe payment succeeds
// Called by frontend LicenseSuccess page to activate the license synchronously
router.post("/session/:sessionId/activate", rateLimitMiddleware.general, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({
                error: "Payment processing unavailable",
                message: "Stripe not configured"
            });
        }
        const { sessionId } = req.params;
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        console.log('🔵 LICENSE-ACTIVATION: Starting activation', { sessionId, tenantId, userId });
        // Retrieve and validate Stripe session first (needed for security checks)
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        // Get session metadata for security checks
        const sessionTenantId = session.metadata?.tenantId;
        const sessionUserId = session.metadata?.userId;
        const tenantMatches = sessionTenantId === tenantId;
        const userMatches = sessionUserId === userId;
        // IDEMPOTENCY CHECK: If license already exists for this session, return it
        const existingLicense = await db.query.licenses.findFirst({
            where: eq(licenses.stripeSessionId, sessionId)
        });
        if (existingLicense) {
            console.log('✅ LICENSE-ACTIVATION: License already exists (idempotent)', {
                licenseId: existingLicense.id,
                sessionId
            });
            // Verify this existing license belongs to the requesting tenant OR user (security)
            if (existingLicense.tenantId !== tenantId && existingLicense.tenantId !== sessionTenantId) {
                // Also check if userId matches
                if (!userMatches) {
                    return res.status(403).json({
                        error: "Unauthorized access to session",
                        code: "SESSION_TENANT_MISMATCH"
                    });
                }
            }
            return res.json({
                success: true,
                alreadyActivated: true,
                license: {
                    id: existingLicense.id,
                    tier: existingLicense.tier,
                    status: existingLicense.status,
                    maxFacilities: existingLicense.maxFacilities,
                    maxSeats: existingLicense.maxSeats
                },
                nextRoute: '/onboarding'
            });
        }
        // SECURITY CHECK 1: Verify session belongs to tenant OR user OR email matches
        // Allow activation if:
        // 1. Payment is successful AND (tenant matches OR user matches OR email matches)
        // 2. This handles cases where user logged out and back in with different account context
        // 3. Email verification provides additional security layer
        const emailMatches = session.customer_email === req.user.email ||
            session.customer_details?.email === req.user.email;
        // If payment is successful, be more lenient - allow if email matches even if tenant/user don't
        const canActivate = session.payment_status === 'paid' &&
            (tenantMatches || userMatches || emailMatches);
        if (!canActivate) {
            console.error('❌ LICENSE-ACTIVATION: Authorization failed', {
                sessionTenant: sessionTenantId,
                requestTenant: tenantId,
                sessionUser: sessionUserId,
                requestUser: userId,
                sessionEmail: session.customer_email || session.customer_details?.email,
                requestEmail: req.user.email,
                paymentStatus: session.payment_status,
                tenantMatches,
                userMatches,
                emailMatches
            });
            return res.status(403).json({
                error: "Unauthorized access to session",
                code: "SESSION_TENANT_MISMATCH",
                message: "This session does not belong to your account. Please log in with the account that created this purchase."
            });
        }
        // Log which match was used (for debugging)
        if (tenantMatches && !userMatches && !emailMatches) {
            console.log('🔵 LICENSE-ACTIVATION: Tenant match (user/email mismatch)', {
                sessionTenant: sessionTenantId,
                requestTenant: tenantId,
                sessionUser: sessionUserId,
                requestUser: userId
            });
        }
        else if (userMatches && !tenantMatches && !emailMatches) {
            console.log('🔵 LICENSE-ACTIVATION: User match (tenant/email mismatch)', {
                sessionTenant: sessionTenantId,
                requestTenant: tenantId,
                sessionUser: sessionUserId,
                requestUser: userId
            });
        }
        else if (emailMatches && !tenantMatches && !userMatches) {
            console.log('🔵 LICENSE-ACTIVATION: Email match (tenant/user mismatch)', {
                sessionEmail: session.customer_email || session.customer_details?.email,
                requestEmail: req.user.email,
                sessionTenant: sessionTenantId,
                requestTenant: tenantId
            });
        }
        // SECURITY CHECK 2: Verify payment completed
        if (session.payment_status !== 'paid') {
            console.error('❌ LICENSE-ACTIVATION: Payment not completed', {
                paymentStatus: session.payment_status,
                sessionId
            });
            return res.status(400).json({
                error: "Payment not completed",
                code: "PAYMENT_INCOMPLETE",
                paymentStatus: session.payment_status
            });
        }
        // SECURITY CHECK 3: Verify non-zero amount (prevent $0 purchases)
        if (!session.amount_total || session.amount_total <= 0) {
            console.error('❌ LICENSE-ACTIVATION: Invalid amount', {
                amount: session.amount_total,
                sessionId
            });
            return res.status(400).json({
                error: "Invalid payment amount",
                code: "INVALID_AMOUNT"
            });
        }
        // Validate metadata
        const metadata = session.metadata;
        if (!metadata) {
            console.error('❌ LICENSE-ACTIVATION: Invalid metadata - missing metadata', { sessionId, metadata });
            return res.status(400).json({
                error: "Invalid session metadata",
                code: "INVALID_METADATA",
                message: "Session metadata is missing"
            });
        }
        // Handle both create-license and create-checkout-session metadata formats
        let tier;
        if (metadata.tier) {
            // Standard format from create-license endpoint
            tier = metadata.tier;
        }
        else if (metadata.licenseId) {
            // Format from create-checkout-session endpoint - map licenseId to tier
            const licenseIdToTierMap = {
                'solo_business': 'BUSINESS_SOLO',
                'team_business': 'BUSINESS_TEAM',
                'enterprise_business': 'BUSINESS_ENTERPRISE',
                'independent_consultant': 'CONSULTANT_INDEPENDENT',
                'agency_consultant': 'CONSULTANT_AGENCY',
                'enterprise_consultant': 'CONSULTANT_ENTERPRISE',
            };
            tier = licenseIdToTierMap[metadata.licenseId] || 'BUSINESS_SOLO';
            console.log('🔵 LICENSE-ACTIVATION: Mapped licenseId to tier', {
                licenseId: metadata.licenseId,
                tier
            });
        }
        else {
            console.error('❌ LICENSE-ACTIVATION: Invalid metadata - missing tier and licenseId', {
                sessionId,
                metadata
            });
            return res.status(400).json({
                error: "Invalid session metadata",
                code: "INVALID_METADATA",
                message: "Session metadata must contain either 'tier' or 'licenseId'"
            });
        }
        // Check if this is an addon or support package
        const isAddon = metadata.isAddon === 'true' || metadata.licenseId?.includes('_addon') || metadata.licenseId?.includes('extra_');
        const isSupportPackage = metadata.isSupportPackage === 'true' || tier.startsWith('SUPPORT_');
        // Validate tier - only base license tiers can create new licenses
        const validBaseTiers = [
            'BUSINESS_SOLO', 'BUSINESS_TEAM', 'BUSINESS_ENTERPRISE',
            'CONSULTANT_INDEPENDENT', 'CONSULTANT_AGENCY', 'CONSULTANT_ENTERPRISE'
        ];
        // Determine which tenantId and userId to use for license operations
        // ALWAYS use session's tenant/user IDs from metadata (the account that actually paid)
        // This ensures the license goes to the correct account even if user logged in with different account
        const licenseTenantId = sessionTenantId || tenantId; // Prefer session tenantId (the one that paid)
        const licenseUserId = sessionUserId || userId; // Prefer session userId (the one that paid)
        // If it's an addon or support package, we need to handle it differently
        if (isAddon) {
            // Addons should update existing licenses, not create new ones
            // For now, we'll create a minimal license record for tracking
            console.log('🔵 LICENSE-ACTIVATION: Processing addon purchase', { licenseId: metadata.licenseId, tier });
            // Find existing active license for this tenant (use licenseTenantId)
            const existingLicense = await db.query.licenses.findFirst({
                where: and(eq(licenses.tenantId, licenseTenantId), eq(licenses.isActive, true)),
                orderBy: desc(licenses.createdAt)
            });
            if (!existingLicense) {
                return res.status(400).json({
                    error: "No active license found",
                    code: "NO_BASE_LICENSE",
                    message: "You must have an active base license before purchasing addons"
                });
            }
            // Update existing license with addon capacity
            // For now, we'll just log the addon purchase
            await db.insert(licenseEvents).values({
                tenantId: existingLicense.tenantId,
                licenseId: existingLicense.id,
                eventType: 'ADDON_PURCHASED',
                eventDescription: `Addon purchased: ${metadata.licenseId} via Stripe session ${sessionId}`,
                eventData: { sessionId, licenseId: metadata.licenseId, amount: session.amount_total },
                amount: session.amount_total,
                currency: 'USD',
            });
            return res.json({
                success: true,
                alreadyActivated: false,
                license: {
                    id: existingLicense.id,
                    tier: existingLicense.tier,
                    status: existingLicense.status,
                    maxFacilities: existingLicense.maxFacilities,
                    maxSeats: existingLicense.maxSeats
                },
                nextRoute: '/licenses',
                message: "Addon purchase recorded. Please contact support to apply addon to your license."
            });
        }
        if (isSupportPackage) {
            // Support packages don't create licenses, they update support tier
            console.log('🔵 LICENSE-ACTIVATION: Processing support package purchase', { tier });
            // Find existing active license for this tenant (use licenseTenantId)
            const existingLicense = await db.query.licenses.findFirst({
                where: and(eq(licenses.tenantId, licenseTenantId), eq(licenses.isActive, true)),
                orderBy: desc(licenses.createdAt)
            });
            if (!existingLicense) {
                return res.status(400).json({
                    error: "No active license found",
                    code: "NO_BASE_LICENSE",
                    message: "You must have an active base license before purchasing support packages"
                });
            }
            // Update support tier
            const supportTier = tier === 'SUPPORT_LITE' ? 'lite' : tier === 'SUPPORT_FULL' ? 'full' : 'premium';
            await db.update(licenses)
                .set({ supportTier })
                .where(eq(licenses.id, existingLicense.id));
            await db.insert(licenseEvents).values({
                tenantId: existingLicense.tenantId,
                licenseId: existingLicense.id,
                eventType: 'SUPPORT_PURCHASED',
                eventDescription: `Support package purchased: ${tier} via Stripe session ${sessionId}`,
                eventData: { sessionId, tier, amount: session.amount_total },
                amount: session.amount_total,
                currency: 'USD',
            });
            return res.json({
                success: true,
                alreadyActivated: false,
                license: {
                    id: existingLicense.id,
                    tier: existingLicense.tier,
                    status: existingLicense.status,
                    maxFacilities: existingLicense.maxFacilities,
                    maxSeats: existingLicense.maxSeats
                },
                nextRoute: '/licenses'
            });
        }
        // Validate tier is a valid base license tier
        if (!validBaseTiers.includes(tier)) {
            console.error('❌ LICENSE-ACTIVATION: Invalid tier for base license', { tier, sessionId, metadata });
            return res.status(400).json({
                error: "Invalid license tier",
                code: "INVALID_TIER",
                tier,
                message: `Tier '${tier}' is not a valid base license tier`
            });
        }
        // Get baseline allocations for the tier
        const tierBaselines = getTierBaselines(tier);
        if (!tierBaselines) {
            console.error('❌ LICENSE-ACTIVATION: Failed to get tier baselines', { tier, sessionId });
            return res.status(500).json({
                error: "Failed to calculate license capacity",
                code: "TIER_BASELINE_ERROR",
                tier
            });
        }
        // Calculate total capacity (baseline + add-on packs)
        const facilityPacks = parseInt(metadata.facilityPacks || '0');
        const seatPacks = parseInt(metadata.seatPacks || '0');
        const maxFacilities = tierBaselines.facilities + facilityPacks;
        const maxSeats = tierBaselines.seats + seatPacks;
        // licenseTenantId and licenseUserId already defined earlier - reuse them
        console.log('🔵 LICENSE-ACTIVATION: Creating license', {
            tier,
            maxFacilities,
            maxSeats,
            amount: session.amount_total,
            licenseTenantId,
            licenseUserId,
            sessionTenantId,
            sessionUserId,
            requestTenantId: tenantId,
            requestUserId: userId,
            tenantMatches,
            userMatches,
            emailMatches
        });
        // Create license record with isActive=true and activatedAt timestamp
        // Use session's tenant/user IDs to ensure license goes to the account that paid
        const [license] = await db.insert(licenses).values({
            tenantId: licenseTenantId,
            licenseType: 'base',
            planName: `${tier} License`,
            accountType: tier.startsWith('BUSINESS') ? 'business' : 'consultant',
            tier,
            planId: tier.toLowerCase().replace('_', '-'),
            status: 'ACTIVE',
            isActive: true, // CRITICAL: Must set to true for license status checks
            activatedAt: new Date(), // Set activation timestamp
            purchasedBy: licenseUserId, // Use session's userId (the one that paid)
            stripeSessionId: sessionId,
            amountPaid: session.amount_total,
            currency: 'USD',
            maxFacilities,
            maxSeats,
            supportTier: (metadata.supportTier || 'basic').toLowerCase(),
        }).returning();
        // Log license event for audit trail
        await db.insert(licenseEvents).values({
            tenantId: license.tenantId,
            licenseId: license.id,
            eventType: 'PURCHASED',
            eventDescription: `License activated via Stripe session ${sessionId}`,
            eventData: { sessionId, amount: session.amount_total },
            amount: session.amount_total,
            currency: 'USD',
        });
        console.log('✅ LICENSE-ACTIVATION: License created successfully', {
            licenseId: license.id,
            tier: license.tier,
            tenantId
        });
        res.json({
            success: true,
            alreadyActivated: false,
            license: {
                id: license.id,
                tier: license.tier,
                status: license.status,
                maxFacilities: license.maxFacilities,
                maxSeats: license.maxSeats
            },
            nextRoute: '/onboarding'
        });
    }
    catch (error) {
        console.error('❌ LICENSE-ACTIVATION: Error activating license', error);
        // Log detailed error information for debugging
        if (error instanceof Error) {
            console.error('❌ LICENSE-ACTIVATION: Error details', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                sessionId: req.params.sessionId,
                tenantId: req.tenant?.id,
                userId: req.user?.id
            });
        }
        // Check for duplicate key errors (race condition)
        if (error instanceof Error && (error.message.includes('duplicate key') ||
            error.message.includes('unique constraint') ||
            error.message.includes('already exists'))) {
            console.log('⚠️ LICENSE-ACTIVATION: Duplicate detected, fetching existing');
            try {
                const existingLicense = await db.query.licenses.findFirst({
                    where: eq(licenses.stripeSessionId, req.params.sessionId)
                });
                if (existingLicense) {
                    return res.json({
                        success: true,
                        alreadyActivated: true,
                        license: {
                            id: existingLicense.id,
                            tier: existingLicense.tier,
                            status: existingLicense.status,
                            maxFacilities: existingLicense.maxFacilities,
                            maxSeats: existingLicense.maxSeats
                        },
                        nextRoute: '/onboarding'
                    });
                }
            }
            catch (fetchError) {
                console.error('❌ LICENSE-ACTIVATION: Error fetching existing license', fetchError);
            }
        }
        // Check for database connection errors (PostgreSQL specific)
        if (error instanceof Error && (error.message.includes('connection') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout'))) {
            return res.status(503).json({
                error: "Database connection error",
                code: "DATABASE_ERROR",
                message: "Unable to connect to database. Please try again later."
            });
        }
        // Check for schema/constraint errors
        if (error instanceof Error && (error.message.includes('column') ||
            error.message.includes('constraint') ||
            error.message.includes('null value'))) {
            return res.status(500).json({
                error: "Database schema error",
                code: "SCHEMA_ERROR",
                message: "License activation failed due to database schema issue. Please contact support."
            });
        }
        res.status(500).json({
            error: "Failed to activate license",
            code: "ACTIVATION_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
        });
    }
});
// Verify license purchase (production webhook handler)
router.get("/verify-license/:sessionId", rateLimitMiddleware.general, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ error: "Payment verification unavailable" });
        }
        const { sessionId } = req.params;
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid' && session.metadata?.tenantId === req.tenant.id) {
            const metadata = session.metadata;
            if (!metadata) {
                return res.status(400).json({ error: "Invalid session metadata" });
            }
            const tier = metadata.tier || 'BUSINESS_SOLO';
            // Get baseline allocations for the tier
            const tierBaselines = getTierBaselines(tier);
            // Calculate total capacity (baseline + add-on packs)
            const facilityPacks = parseInt(metadata.facilityPacks || '0');
            const seatPacks = parseInt(metadata.seatPacks || '0');
            const maxFacilities = tierBaselines.facilities + facilityPacks;
            const maxSeats = tierBaselines.seats + seatPacks;
            // Create license record with isActive=true and activatedAt
            const [license] = await db.insert(licenses).values({
                tenantId: req.tenant.id,
                licenseType: 'base',
                planName: `${tier} License`,
                accountType: tier.startsWith('BUSINESS') ? 'business' : 'consultant',
                tier,
                planId: tier.toLowerCase().replace('_', '-'),
                status: 'ACTIVE',
                isActive: true, // CRITICAL: Must set to true for license status checks
                activatedAt: new Date(), // Set activation timestamp
                purchasedBy: req.user.id,
                stripeSessionId: sessionId,
                amountPaid: session.amount_total || 0,
                currency: 'USD',
                maxFacilities,
                maxSeats,
                supportTier: (metadata.supportTier || 'basic').toLowerCase(),
            }).returning();
            // Log license event
            await db.insert(licenseEvents).values({
                tenantId: license.tenantId,
                licenseId: license.id,
                eventType: 'PURCHASED',
                eventDescription: `License purchased via Stripe session ${sessionId}`,
                eventData: { sessionId, amount: session.amount_total },
                amount: session.amount_total || 0,
                currency: 'USD',
            });
            res.json({
                success: true,
                license: {
                    id: license.id,
                    tier: license.tier,
                    status: license.status
                }
            });
        }
        else {
            res.status(400).json({ error: "Payment not completed or invalid session" });
        }
    }
    catch (error) {
        console.error("Error verifying license:", error);
        res.status(500).json({ error: "Failed to verify license" });
    }
});
// Development-only mock payment endpoint for testing
router.post("/mock-payment", rateLimitMiddleware.general, async (req, res) => {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: "Mock payments not available in production"
            });
        }
        const data = createLicenseSchema.parse(req.body);
        // Calculate pricing
        const pricing = calculateLicensePricing(data);
        // Get baseline allocations for the tier
        const tierBaselines = getTierBaselines(data.tier);
        // Calculate total capacity (baseline + add-on packs)
        const maxFacilities = tierBaselines.facilities + data.facilityPacks;
        const maxSeats = tierBaselines.seats + data.seatPacks;
        // Create license record directly (bypassing Stripe) with isActive=true and activatedAt
        const [license] = await db.insert(licenses).values({
            tenantId: req.tenant.id,
            licenseType: 'base',
            planName: `${data.tier} License`,
            accountType: data.tier.startsWith('BUSINESS') ? 'business' : 'consultant',
            tier: data.tier,
            planId: data.tier.toLowerCase().replace('_', '-'),
            status: 'ACTIVE',
            isActive: true, // CRITICAL: Must set to true for license status checks
            activatedAt: new Date(), // Set activation timestamp
            purchasedBy: req.user.id,
            stripeSessionId: `mock_${Date.now()}`,
            amountPaid: pricing.total,
            currency: 'USD',
            maxFacilities,
            maxSeats,
            supportTier: data.supportTier.toLowerCase(),
        }).returning();
        // Log license event
        await db.insert(licenseEvents).values({
            tenantId: license.tenantId,
            licenseId: license.id,
            eventType: 'PURCHASED',
            eventDescription: `Mock license purchased for testing`,
            eventData: {
                mockPayment: true,
                amount: pricing.total,
                email: data.billingEmail
            },
            amount: pricing.total,
            currency: 'USD',
        });
        res.json({
            success: true,
            license: {
                id: license.id,
                tier: license.tier,
                status: license.status
            },
            redirectUrl: '/licenses/success'
        });
    }
    catch (error) {
        console.error("Error creating mock payment:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        res.status(500).json({ error: "Failed to create mock payment" });
    }
});
function getTierBaselines(tier) {
    const baselines = {
        BUSINESS_SOLO: { facilities: 1, seats: 3 },
        BUSINESS_TEAM: { facilities: 2, seats: 10 },
        BUSINESS_ENTERPRISE: { facilities: 3, seats: 25 },
        CONSULTANT_INDEPENDENT: { facilities: 5, seats: 5 },
        CONSULTANT_AGENCY: { facilities: 10, seats: 15 },
        CONSULTANT_ENTERPRISE: { facilities: 25, seats: 50 },
    };
    return baselines[tier];
}
// Production-safe pricing calculator
function calculateLicensePricing(data) {
    const basePrices = {
        BUSINESS_SOLO: 49900, // $499
        BUSINESS_TEAM: 99900, // $999
        BUSINESS_ENTERPRISE: 249900, // $2499
        CONSULTANT_INDEPENDENT: 79900, // $799
        CONSULTANT_AGENCY: 199900, // $1999
        CONSULTANT_ENTERPRISE: 399900, // $3999
    };
    let total = basePrices[data.tier] || 0;
    // Add facility pack costs
    total += data.facilityPacks * 9900; // $99 per facility pack
    // Add seat pack costs
    total += data.seatPacks * 1900; // $19 per seat pack
    // Support tier adjustments
    if (data.supportTier === 'PREMIUM') {
        total += 9900; // $99
    }
    else if (data.supportTier === 'ENTERPRISE') {
        total += 29900; // $299
    }
    return { total };
}
export default router;
