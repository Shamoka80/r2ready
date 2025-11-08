import express from 'express';
import multer from 'multer';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { cloudStorageService } from '../services/cloudStorageIntegrationService.js';
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});
// Get cloud storage provider status
router.get('/providers', authenticateUser, async (req, res) => {
    try {
        const providers = await cloudStorageService.getProviderStatus();
        res.json({ success: true, providers });
    }
    catch (error) {
        console.error('Provider status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get provider status'
        });
    }
});
// Upload file to specific cloud provider
router.post('/upload/:provider', authenticateUser, upload.single('file'), async (req, res) => {
    try {
        const { provider } = req.params;
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }
        let result;
        switch (provider) {
            case 'google_drive':
                result = await cloudStorageService.uploadToGoogleDrive(file.buffer, file.originalname, file.mimetype);
                break;
            case 'onedrive':
                result = await cloudStorageService.uploadToOneDrive(file.buffer, file.originalname);
                break;
            case 'dropbox':
                result = await cloudStorageService.uploadToDropbox(file.buffer, file.originalname);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported provider'
                });
        }
        res.json({
            success: true,
            upload: result
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error instanceof Error ? error.message : "Operation failed" : 'Upload failed'
        });
    }
});
// Download file from cloud storage
router.get('/download/:provider/:fileId', authenticateUser, async (req, res) => {
    try {
        const { provider, fileId } = req.params;
        const { encryptionKey } = req.query;
        const fileBuffer = await cloudStorageService.downloadFile(provider, fileId, encryptionKey);
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileId}"`
        });
        res.send(fileBuffer);
    }
    catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error instanceof Error ? error.message : "Operation failed" : 'Download failed'
        });
    }
});
// Check quota for specific provider
router.get('/quota/:provider', authenticateUser, async (req, res) => {
    try {
        const { provider } = req.params;
        const quota = await cloudStorageService.checkQuota(provider);
        res.json({
            success: true,
            quota: {
                ...quota,
                usagePercentage: Math.round((quota.used / quota.limit) * 100)
            }
        });
    }
    catch (error) {
        console.error('Quota check error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Operation failed"
        });
    }
});
// Bulk upload to multiple providers
router.post('/upload/bulk', authenticateUser, upload.array('files', 10), async (req, res) => {
    try {
        const files = req.files;
        const { providers } = req.body;
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files provided'
            });
        }
        const targetProviders = JSON.parse(providers || '["google_drive"]');
        const results = [];
        for (const file of files) {
            for (const provider of targetProviders) {
                try {
                    let result;
                    switch (provider) {
                        case 'google_drive':
                            result = await cloudStorageService.uploadToGoogleDrive(file.buffer, file.originalname, file.mimetype);
                            break;
                        case 'onedrive':
                            result = await cloudStorageService.uploadToOneDrive(file.buffer, file.originalname);
                            break;
                        case 'dropbox':
                            result = await cloudStorageService.uploadToDropbox(file.buffer, file.originalname);
                            break;
                    }
                    if (result) {
                        results.push({
                            file: file.originalname,
                            provider,
                            success: true,
                            result
                        });
                    }
                }
                catch (error) {
                    results.push({
                        file: file.originalname,
                        provider,
                        success: false,
                        error: error instanceof Error ? error.message : "Operation failed"
                    });
                }
            }
        }
        res.json({
            success: true,
            uploads: results
        });
    }
    catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Operation failed"
        });
    }
});
export default router;
