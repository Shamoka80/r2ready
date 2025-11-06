
import { Router } from 'express';
import multer from 'multer';
import { AuthService, type AuthenticatedRequest } from '../services/authService';
import { cloudStorageService, type CloudStorageConfig } from '../services/cloudStorageService';
import { ConsistentLogService } from '../services/consistentLogService';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { requireFlag } from '../lib/flags';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

const logger = ConsistentLogService.getInstance();

/**
 * POST /api/cloud-storage/configure
 * Configure cloud storage for tenant
 */
router.post('/configure', AuthService.authMiddleware, requireFlag('aws_s3_storage'), rateLimitMiddleware.general, async (req: AuthenticatedRequest, res) => {
  try {
    const config: CloudStorageConfig = req.body;
    
    // Only admin users can configure storage
    if (req.user.role !== 'admin') {
      await logger.warn('Unauthorized storage configuration attempt', {
        service: 'cloud-storage',
        operation: 'configure',
        userId: req.user.id,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await cloudStorageService.configureStorage(req.user.tenantId, config);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      success: true, 
      message: 'Cloud storage configured successfully',
      provider: config.provider
    });
  } catch (error) {
    await logger.error('Storage configuration failed', {
      service: 'cloud-storage',
      operation: 'configure',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      error: error instanceof Error ? error.message : String(error),
      severity: 'high'
    });
    
    res.status(500).json({ error: 'Configuration failed' });
  }
});

/**
 * POST /api/cloud-storage/upload
 * Upload file to configured storage
 */
router.post('/upload', AuthService.authMiddleware, rateLimitMiddleware.general, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const options = {
      fileName: req.body.fileName || req.file.originalname,
      mimeType: req.file.mimetype,
      folderPath: req.body.folderPath,
      encrypt: req.body.encrypt === 'true',
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    };

    const result = await cloudStorageService.uploadFile(
      req.user.tenantId,
      req.file.buffer,
      options
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      file: result.file
    });
  } catch (error) {
    await logger.error('File upload failed', {
      service: 'cloud-storage',
      operation: 'upload',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      error: error instanceof Error ? error.message : String(error),
      severity: 'medium'
    });
    
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /api/cloud-storage/download/:fileId
 * Download file from storage
 */
router.get('/download/:fileId', AuthService.authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { fileId } = req.params;
    
    const result = await cloudStorageService.downloadFile(req.user.tenantId, fileId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    if (!result.buffer || !result.file) {
      return res.status(500).json({ error: 'Download failed' });
    }

    res.set({
      'Content-Type': result.file.mimeType,
      'Content-Length': result.buffer.length.toString(),
      'Content-Disposition': `attachment; filename="${result.file.name}"`
    });

    res.send(result.buffer);
  } catch (error) {
    await logger.error('File download failed', {
      service: 'cloud-storage',
      operation: 'download',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      error: error instanceof Error ? error.message : String(error),
      severity: 'medium'
    });
    
    res.status(500).json({ error: 'Download failed' });
  }
});

/**
 * GET /api/cloud-storage/files
 * List files in storage
 */
router.get('/files', AuthService.authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const options = {
      folderPath: req.query.folderPath as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      pageToken: req.query.pageToken as string
    };

    const result = await cloudStorageService.listFiles(req.user.tenantId, options);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      files: result.files || [],
      nextPageToken: result.nextPageToken
    });
  } catch (error) {
    await logger.error('File listing failed', {
      service: 'cloud-storage',
      operation: 'list',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      error: error instanceof Error ? error.message : String(error),
      severity: 'low'
    });
    
    res.status(500).json({ error: 'Listing failed' });
  }
});

/**
 * DELETE /api/cloud-storage/:fileId
 * Delete file from storage
 */
router.delete('/:fileId', AuthService.authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { fileId } = req.params;
    
    const result = await cloudStorageService.deleteFile(req.user.tenantId, fileId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      success: true, 
      message: 'File deleted successfully' 
    });
  } catch (error) {
    await logger.error('File deletion failed', {
      service: 'cloud-storage',
      operation: 'delete',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      error: error instanceof Error ? error.message : String(error),
      severity: 'medium'
    });
    
    res.status(500).json({ error: 'Deletion failed' });
  }
});

/**
 * GET /api/cloud-storage/quota
 * Get storage quota information
 */
router.get('/quota', AuthService.authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await cloudStorageService.getStorageQuota(req.user.tenantId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      quota: result.quota
    });
  } catch (error) {
    await logger.error('Quota check failed', {
      service: 'cloud-storage',
      operation: 'quota',
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      error: error instanceof Error ? error.message : String(error),
      severity: 'low'
    });
    
    res.status(500).json({ error: 'Quota check failed' });
  }
});

/**
 * GET /api/cloud-storage/health
 * Storage service health check
 */
router.get('/health', async (req, res) => {
  try {
    const health = await cloudStorageService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'critical',
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

export default router;
