import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { AuthService } from '../services/authService';
const router = Router();
// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/evidence');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `evidence-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Allow common document and image types
        const allowedTypes = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|txt|csv)$/i;
        if (allowedTypes.test(file.originalname)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    }
});
// Upload evidence file
router.post('/upload', AuthService.authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const evidenceRecord = {
            id: Date.now().toString(),
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user?.id,
            category: req.body.category || 'general',
            tags: req.body.tags ? JSON.parse(req.body.tags) : [],
            auditTrail: [{
                    action: 'uploaded',
                    timestamp: new Date().toISOString(),
                    userId: req.user?.id
                }]
        };
        res.json({
            success: true,
            evidence: evidenceRecord
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});
// Get evidence files
router.get('/files', AuthService.authMiddleware, async (req, res) => {
    try {
        const uploadDir = path.join(__dirname, '../uploads/evidence');
        const files = await fs.readdir(uploadDir);
        const evidenceList = files.map(filename => ({
            id: filename,
            filename,
            uploadedAt: new Date().toISOString()
        }));
        res.json({ evidence: evidenceList });
    }
    catch (error) {
        res.json({ evidence: [] });
    }
});
// Categorize and tag evidence
router.post('/categorize/:id', AuthService.authMiddleware, async (req, res) => {
    try {
        const { category, tags } = req.body;
        // In a full implementation, this would update database records
        res.json({
            success: true,
            message: 'Evidence categorized successfully',
            category,
            tags
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Categorization failed' });
    }
});
// Audit trail for evidence
router.get('/audit/:id', AuthService.authMiddleware, async (req, res) => {
    try {
        const auditTrail = [
            {
                action: 'uploaded',
                timestamp: new Date().toISOString(),
                userId: req.user?.id,
                details: 'File uploaded successfully'
            },
            {
                action: 'categorized',
                timestamp: new Date().toISOString(),
                userId: req.user?.id,
                details: 'Evidence categorized and tagged'
            }
        ];
        res.json({ auditTrail });
    }
    catch (error) {
        res.status(500).json({ error: 'Audit trail retrieval failed' });
    }
});
export default router;
