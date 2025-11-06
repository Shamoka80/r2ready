import { Router, Request, Response } from "express";
import { db } from "../db";
import { licenses, users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { AuthService } from "../services/authService";

const router = Router();

// Middleware - require authentication for all license routes
router.use(AuthService.authMiddleware);

// GET /api/licenses/status - Get current license status for user's tenant
router.get('/status', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId;
    const userRole = req.user.businessRole || req.user.consultantRole;

    console.log('🔵 LICENSE-CHECK: Checking license status', { 
      tenantId, 
      userId: req.user.id,
      userRole 
    });

    // Admin bypass: system admin accounts always have valid licenses
    if (tenantId === 'system-admin') {
      console.log('🟢 LICENSE-CHECK: Admin bypass active');
      return res.json({
        hasLicense: true,
        status: 'active',
        isAdminBypass: true,
        message: 'System administrator - license bypass active'
      });
    }

    // Get active license for tenant
    const license = await db.query.licenses.findFirst({
      where: and(
        eq(licenses.tenantId, tenantId),
        eq(licenses.isActive, true)
      )
    });

    if (!license) {
      console.log('❌ LICENSE-CHECK: No active license found', { tenantId });
      return res.json({
        hasLicense: false,
        status: 'no_license',
        message: 'No active license found'
      });
    }

    console.log('🟢 LICENSE-CHECK: License found', { 
      licenseId: license.id,
      planId: license.planId,
      isActive: license.isActive,
      tenantId: license.tenantId 
    });

    // For perpetual licenses, check if license is still valid (no expiration for most)
    const isExpired = license.expiresAt && new Date() > new Date(license.expiresAt);

    res.json({
      hasLicense: true,
      status: isExpired ? 'expired' : 'active',
      license: {
        id: license.id,
        planId: license.planId,
        planName: license.planName,
        accountType: license.accountType,
        maxFacilities: license.maxFacilities,
        maxSeats: license.maxSeats,
        features: license.features,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt, // Usually null for perpetual licenses
        isActive: license.isActive,
        licenseType: 'perpetual'
      }
    });
  } catch (error) {
    console.error('Error fetching license status:', error);
    res.status(500).json({ error: 'Failed to fetch license status' });
  }
});

// GET /api/licenses/features - Get available features for current license
router.get('/features', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId;

    const license = await db.query.licenses.findFirst({
      where: and(
        eq(licenses.tenantId, tenantId),
        eq(licenses.isActive, true)
      )
    });

    if (!license) {
      return res.json({
        features: [],
        limits: {
          maxFacilities: 0,
          maxSeats: 0
        },
        licenseType: 'none'
      });
    }

    const isExpired = license.expiresAt && new Date() > new Date(license.expiresAt);

    res.json({
      features: isExpired ? [] : license.features || [],
      limits: {
        maxFacilities: license.maxFacilities,
        maxSeats: license.maxSeats
      },
      status: isExpired ? 'expired' : 'active',
      licenseType: 'perpetual'
    });
  } catch (error) {
    console.error('Error fetching license features:', error);
    res.status(500).json({ error: 'Failed to fetch license features' });
  }
});

// Middleware function to validate license for protected routes
export const requireValidLicense = async (req: any, res: any, next: any) => {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.businessRole || req.user?.consultantRole;

    if (!tenantId) {
      return res.status(401).json({ error: 'User tenant not found' });
    }

    // Admin bypass: system admin accounts skip license validation
    if (tenantId === 'system-admin') {
      req.license = { 
        isAdminBypass: true, 
        planName: 'System Administrator',
        maxFacilities: 999,
        maxSeats: 999,
        licenseType: 'admin'
      };
      return next();
    }

    const license = await db.query.licenses.findFirst({
      where: and(
        eq(licenses.tenantId, tenantId),
        eq(licenses.isActive, true)
      )
    });

    if (!license) {
      return res.status(403).json({ 
        error: 'No valid license found',
        code: 'LICENSE_REQUIRED' 
      });
    }

    // Check if license is expired (rare for perpetual licenses)
    const isExpired = license.expiresAt && new Date() > new Date(license.expiresAt);
    if (isExpired) {
      return res.status(403).json({ 
        error: 'License expired',
        code: 'LICENSE_EXPIRED' 
      });
    }

    // Attach license info to request for downstream use
    req.license = {
      ...license,
      licenseType: 'perpetual'
    };
    next();
  } catch (error) {
    console.error('Error validating license:', error);
    res.status(500).json({ error: 'License validation failed' });
  }
};

export default router;