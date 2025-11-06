import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db.js';
import { tenants } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { AuthService, type AuthenticatedRequest } from '../services/authService.js';

const router = Router();

// Validation schemas
const updateBrandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  brandColorPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
  brandColorSecondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
});

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'server', 'uploads', 'logos');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: AuthenticatedRequest, file, cb) => {
    const tenantId = req.tenant?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${tenantId}-${timestamp}-${safeName}${ext}`);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files (PNG, JPG, SVG)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only PNG, JPG, and SVG are supported.`));
    }
  }
});

// GET /api/tenants/branding - Get current tenant's branding settings
router.get('/branding', AuthService.authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is a consultant
    if (req.tenant?.tenantType !== 'CONSULTANT') {
      return res.status(403).json({ error: 'Only consultants can access branding settings' });
    }

    // Fetch tenant branding data
    const [tenant] = await db
      .select({
        logoUrl: tenants.logoUrl,
        brandColorPrimary: tenants.brandColorPrimary,
        brandColorSecondary: tenants.brandColorSecondary,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      logoUrl: tenant.logoUrl || null,
      brandColorPrimary: tenant.brandColorPrimary || null,
      brandColorSecondary: tenant.brandColorSecondary || null,
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding settings' });
  }
});

// PATCH /api/tenants/branding - Update tenant's branding settings
router.patch('/branding', AuthService.authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is a consultant
    if (req.tenant?.tenantType !== 'CONSULTANT') {
      return res.status(403).json({ error: 'Only consultants can update branding settings' });
    }

    // Validate request body
    const validation = updateBrandingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validation.error.errors 
      });
    }

    const { logoUrl, brandColorPrimary, brandColorSecondary } = validation.data;

    // Build update object with only provided fields
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (brandColorPrimary !== undefined) updateData.brandColorPrimary = brandColorPrimary;
    if (brandColorSecondary !== undefined) updateData.brandColorSecondary = brandColorSecondary;

    // Update tenant branding
    const [updatedTenant] = await db
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, tenantId))
      .returning({
        logoUrl: tenants.logoUrl,
        brandColorPrimary: tenants.brandColorPrimary,
        brandColorSecondary: tenants.brandColorSecondary,
      });

    if (!updatedTenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      success: true,
      branding: {
        logoUrl: updatedTenant.logoUrl || null,
        brandColorPrimary: updatedTenant.brandColorPrimary || null,
        brandColorSecondary: updatedTenant.brandColorSecondary || null,
      }
    });
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

// POST /api/tenants/upload-logo - Upload tenant logo
router.post('/upload-logo', AuthService.authMiddleware, (req: AuthenticatedRequest, res) => {
  // Check if user is a consultant before handling upload
  if (req.tenant?.tenantType !== 'CONSULTANT') {
    return res.status(403).json({ error: 'Only consultants can upload logos' });
  }

  uploadLogo.single('logo')(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 2MB limit' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Generate the URL path for the uploaded logo
      const logoUrl = `/uploads/logos/${file.filename}`;

      res.json({
        success: true,
        logoUrl
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ error: 'Failed to upload logo' });
    }
  });
});

export default router;
