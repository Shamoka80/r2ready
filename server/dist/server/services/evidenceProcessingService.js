import path from 'path';
import fs from 'fs/promises';
export class EvidenceProcessingService {
    uploadDir = path.join(__dirname, '../uploads/evidence');
    async validateFile(file) {
        const errors = [];
        // File size validation (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
            errors.push('File size exceeds 50MB limit');
        }
        // File type validation
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.txt', '.csv'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            errors.push(`File type ${fileExtension} not allowed`);
        }
        // Filename validation
        if (file.originalname.length > 255) {
            errors.push('Filename too long');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    async categorizeEvidence(filename, content) {
        const extension = path.extname(filename).toLowerCase();
        // Basic categorization based on file type
        switch (extension) {
            case '.pdf':
                return 'policy-document';
            case '.doc':
            case '.docx':
                return 'procedure-document';
            case '.xls':
            case '.xlsx':
                return 'data-record';
            case '.jpg':
            case '.jpeg':
            case '.png':
                return 'photo-evidence';
            case '.txt':
            case '.csv':
                return 'data-export';
            default:
                return 'general';
        }
    }
    async generateTags(filename, category) {
        const tags = [];
        const lowerFilename = filename.toLowerCase();
        // Auto-generate tags based on filename and category
        if (lowerFilename.includes('policy'))
            tags.push('policy');
        if (lowerFilename.includes('procedure'))
            tags.push('procedure');
        if (lowerFilename.includes('training'))
            tags.push('training');
        if (lowerFilename.includes('audit'))
            tags.push('audit');
        if (lowerFilename.includes('certificate'))
            tags.push('certificate');
        if (lowerFilename.includes('record'))
            tags.push('record');
        // Add category as tag
        tags.push(category);
        return [...new Set(tags)]; // Remove duplicates
    }
    async createAuditEntry(action, userId, details) {
        return {
            action,
            timestamp: new Date().toISOString(),
            userId,
            details
        };
    }
    async ensureUploadDirectory() {
        await fs.mkdir(this.uploadDir, { recursive: true });
    }
}
export const evidenceProcessingService = new EvidenceProcessingService();
