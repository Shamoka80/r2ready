import { Router } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { db } from '../db.js';
import { licenses, licenseEvents } from '../../shared/schema.js';
import { eq } from "drizzle-orm";
import { AuthService } from '../services/authService.js';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
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
if (process.env.NODE_ENV === 'production' && stripeSecretKey?.includes('sk_test_')) {
    console.error('❌ Test Stripe keys detected in production environment');
    process.exit(1);
}
// Create Stripe instance only if key is available
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
    apiVersion: '2025-08-27.basil',
}) : null;
// All routes require authentication
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
// Get Stripe session details (for success page display)
router.get("/session/:sessionId", rateLimitMiddleware.general, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ error: "Payment verification unavailable" });
        }
        const { sessionId } = req.params;
        // Retrieve session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        // Verify this session belongs to the authenticated user's tenant
        if (session.metadata?.tenantId !== req.tenant.id) {
            return res.status(403).json({ error: "Unauthorized access to session" });
        }
        // Return session data in the format expected by frontend
        res.json({
            id: session.id,
            payment_status: session.payment_status,
            customer_email: session.customer_email || session.customer_details?.email,
            amount_total: session.amount_total,
            metadata: session.metadata,
        });
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
        // IDEMPOTENCY CHECK: If license already exists for this session, return it
        const existingLicense = await db.query.licenses.findFirst({
            where: eq(licenses.stripeSessionId, sessionId)
        });
        if (existingLicense) {
            console.log('✅ LICENSE-ACTIVATION: License already exists (idempotent)', {
                licenseId: existingLicense.id,
                sessionId
            });
            // Verify this existing license belongs to the requesting tenant (security)
            if (existingLicense.tenantId !== tenantId) {
                return res.status(403).json({
                    error: "Unauthorized access to session",
                    code: "SESSION_TENANT_MISMATCH"
                });
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
        // Retrieve and validate Stripe session
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        // SECURITY CHECK 1: Verify session belongs to tenant
        if (session.metadata?.tenantId !== tenantId) {
            console.error('❌ LICENSE-ACTIVATION: Tenant mismatch', {
                sessionTenant: session.metadata?.tenantId,
                requestTenant: tenantId
            });
            return res.status(403).json({
                error: "Unauthorized access to session",
                code: "SESSION_TENANT_MISMATCH"
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
        if (!metadata || !metadata.tier) {
            console.error('❌ LICENSE-ACTIVATION: Invalid metadata', { sessionId });
            return res.status(400).json({
                error: "Invalid session metadata",
                code: "INVALID_METADATA"
            });
        }
        const tier = metadata.tier;
        // Get baseline allocations for the tier
        const tierBaselines = getTierBaselines(tier);
        // Calculate total capacity (baseline + add-on packs)
        const facilityPacks = parseInt(metadata.facilityPacks || '0');
        const seatPacks = parseInt(metadata.seatPacks || '0');
        const maxFacilities = tierBaselines.facilities + facilityPacks;
        const maxSeats = tierBaselines.seats + seatPacks;
        console.log('🔵 LICENSE-ACTIVATION: Creating license', {
            tier,
            maxFacilities,
            maxSeats,
            amount: session.amount_total
        });
        // Create license record with isActive=true and activatedAt timestamp
        const [license] = await db.insert(licenses).values({
            tenantId,
            licenseType: 'base',
            planName: `${tier} License`,
            accountType: tier.startsWith('BUSINESS') ? 'business' : 'consultant',
            tier,
            planId: tier.toLowerCase().replace('_', '-'),
            status: 'ACTIVE',
            isActive: true, // CRITICAL: Must set to true for license status checks
            activatedAt: new Date(), // Set activation timestamp
            purchasedBy: userId,
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
        // Check for duplicate key errors (race condition)
        if (error instanceof Error && error.message.includes('duplicate key')) {
            console.log('⚠️ LICENSE-ACTIVATION: Duplicate detected, fetching existing');
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
        res.status(500).json({
            error: "Failed to activate license",
            code: "ACTIVATION_ERROR",
            message: error instanceof Error ? error.message : "Unknown error"
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
