import { Router } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { db } from "../db";
import { licenses, licenseEvents } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { AuthService } from "../services/authService";
import type { AuthenticatedRequest } from "../services/authService";
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';

const router = Router();

// Helper function to get the correct base URL for redirects
const getBaseUrl = (): string => {
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
router.post("/create-license", 
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
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
          tenantId: req.tenant!.id,
          userId: req.user!.id,
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
    } catch (error) {
      console.error("Error creating license:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      res.status(500).json({ error: "Failed to create license purchase" });
    }
  }
);

// Verify license purchase (production webhook handler)
router.get("/verify-license/:sessionId", 
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Payment verification unavailable" });
      }

      const { sessionId } = req.params;

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid' && session.metadata?.tenantId === req.tenant!.id) {
        const metadata = session.metadata;
        if (!metadata) {
          return res.status(400).json({ error: "Invalid session metadata" });
        }

        const tier = metadata.tier || 'BUSINESS_SOLO';
        
        // Get baseline allocations for the tier
        const tierBaselines = getTierBaselines(tier as ValidTier);
        
        // Calculate total capacity (baseline + add-on packs)
        const facilityPacks = parseInt(metadata.facilityPacks || '0');
        const seatPacks = parseInt(metadata.seatPacks || '0');
        const maxFacilities = tierBaselines.facilities + facilityPacks;
        const maxSeats = tierBaselines.seats + seatPacks;
        
        // Create license record
        const [license] = await db.insert(licenses).values({
          tenantId: req.tenant!.id,
          licenseType: 'base',
          planName: `${tier} License`,
          accountType: tier.startsWith('BUSINESS') ? 'business' : 'consultant',
          tier,
          planId: tier.toLowerCase().replace('_', '-'),
          status: 'ACTIVE',
          purchasedBy: req.user!.id,
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
      } else {
        res.status(400).json({ error: "Payment not completed or invalid session" });
      }
    } catch (error) {
      console.error("Error verifying license:", error);
      res.status(500).json({ error: "Failed to verify license" });
    }
  }
);

// Development-only mock payment endpoint for testing
router.post("/mock-payment",
  rateLimitMiddleware.general,
  async (req: AuthenticatedRequest, res) => {
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

      // Create license record directly (bypassing Stripe)
      const [license] = await db.insert(licenses).values({
        tenantId: req.tenant!.id,
        licenseType: 'base',
        planName: `${data.tier} License`,
        accountType: data.tier.startsWith('BUSINESS') ? 'business' : 'consultant',
        tier: data.tier,
        planId: data.tier.toLowerCase().replace('_', '-'),
        status: 'ACTIVE',
        purchasedBy: req.user!.id,
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
    } catch (error) {
      console.error("Error creating mock payment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      res.status(500).json({ error: "Failed to create mock payment" });
    }
  }
);

// Tier baseline allocations (facilities and seats included in base price)
type ValidTier = 'BUSINESS_SOLO' | 'BUSINESS_TEAM' | 'BUSINESS_ENTERPRISE' | 'CONSULTANT_INDEPENDENT' | 'CONSULTANT_AGENCY' | 'CONSULTANT_ENTERPRISE';

function getTierBaselines(tier: ValidTier): { facilities: number; seats: number } {
  const baselines: Record<ValidTier, { facilities: number; seats: number }> = {
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
function calculateLicensePricing(data: { tier: ValidTier; facilityPacks: number; seatPacks: number; supportTier: string }) {
  const basePrices: Record<ValidTier, number> = {
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
  } else if (data.supportTier === 'ENTERPRISE') {
    total += 29900; // $299
  }

  return { total };
}

export default router;