import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { evidenceObjects } from '../../shared/schema.js';
export class EvidenceService {
    config;
    uploadPath;
    quarantinePath;
    constructor(config) {
        this.config = {
            maxFileSize: 100 * 1024 * 1024, // 100MB (reduced from 1GB)
            allowedMimeTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'text/plain',
                'text/csv'
            ],
            maxFilesPerUpload: 5, // Reduced from 10
            checksumAlgorithm: 'sha256',
            quarantineInfected: true,
            enableContentValidation: true,
            ...config
        };
        this.uploadPath = path.join(process.cwd(), 'uploads', 'evidence');
        this.quarantinePath = path.join(process.cwd(), 'uploads', 'quarantine');
    }
    async initialize() {
        // Ensure upload directories exist
        await fs.mkdir(this.uploadPath, { recursive: true });
        await fs.mkdir(this.quarantinePath, { recursive: true });
    }
    validateMimeType(file) {
        if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
            return {
                isValid: false,
                warning: `File type ${file.mimetype} is not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`
            };
        }
        // Additional content-based validation for common file types
        if (this.config.enableContentValidation) {
            return this.validateFileContent(file);
        }
        return { isValid: true };
    }
    async validateFileSize(file) {
        if (file.size > this.config.maxFileSize) {
            return {
                isValid: false,
                warning: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.config.maxFileSize / 1024 / 1024)}MB)`
            };
        }
        // Check for zero-byte files
        if (file.size === 0) {
            return {
                isValid: false,
                warning: 'Empty files are not allowed'
            };
        }
        return { isValid: true };
    }
    async validateFileName(file) {
        const fileName = file.originalname;
        // Check filename length
        if (fileName.length > 255) {
            return {
                isValid: false,
                warning: 'Filename too long (maximum 255 characters)'
            };
        }
        // Check for dangerous characters
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
        if (dangerousChars.test(fileName)) {
            return {
                isValid: false,
                warning: 'Filename contains invalid characters'
            };
        }
        // Check for suspicious extensions
        const suspiciousExtensions = /\.(exe|bat|cmd|scr|pif|com|vbs|js|jar|app|deb|rpm|dmg|pkg)$/i;
        if (suspiciousExtensions.test(fileName)) {
            return {
                isValid: false,
                warning: 'Executable file types are not allowed'
            };
        }
        // Check for multiple extensions (potential bypass attempt)
        const extensionCount = (fileName.match(/\./g) || []).length;
        if (extensionCount > 2) {
            return {
                isValid: false,
                warning: 'Files with multiple extensions are not allowed'
            };
        }
        return { isValid: true };
    }
    async performDeepContentScan(filePath) {
        const warnings = [];
        const threats = [];
        try {
            const buffer = await fs.readFile(filePath);
            // Check for embedded executables
            const executablePatterns = [
                { pattern: Buffer.from([0x4D, 0x5A]), name: 'PE Executable' },
                { pattern: Buffer.from([0x7F, 0x45, 0x4C, 0x46]), name: 'ELF Executable' },
                { pattern: Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), name: 'Mach-O Executable' },
                { pattern: Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), name: 'Mach-O Executable (64-bit)' }
            ];
            for (const { pattern, name } of executablePatterns) {
                if (buffer.indexOf(pattern) !== -1) {
                    threats.push(`Embedded ${name} detected`);
                }
            }
            // Check for script content in documents
            const scriptPatterns = [
                /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
                /javascript:/gi,
                /vbscript:/gi,
                /on\w+\s*=/gi,
                /eval\s*\(/gi,
                /document\.write/gi
            ];
            const content = buffer.toString('utf8', 0, Math.min(8192, buffer.length));
            for (const pattern of scriptPatterns) {
                if (pattern.test(content)) {
                    warnings.push('Potentially malicious script content detected');
                    break;
                }
            }
            // Check for suspicious URLs
            const urlPattern = /https?:\/\/[^\s<>"']+/gi;
            const urls = content.match(urlPattern) || [];
            for (const url of urls) {
                if (this.isSuspiciousUrl(url)) {
                    warnings.push(`Suspicious URL detected: ${url.substring(0, 50)}...`);
                }
            }
            // Check for macro content in Office documents
            if (buffer.indexOf(Buffer.from('macro', 'ascii')) !== -1 ||
                buffer.indexOf(Buffer.from('VBA', 'ascii')) !== -1) {
                warnings.push('Document may contain macros');
            }
            return {
                isValid: threats.length === 0,
                warnings,
                threats
            };
        }
        catch (error) {
            return {
                isValid: false,
                warnings: ['Failed to scan file content'],
                threats: ['Content scan error']
            };
        }
    }
    isSuspiciousUrl(url) {
        const suspiciousDomains = [
            'bit.ly', 'tinyurl.com', 'goo.gl', 't.co',
            'localhost', '127.0.0.1', '0.0.0.0',
            '.onion', '.tk', '.ml'
        ];
        const lowerUrl = url.toLowerCase();
        return suspiciousDomains.some(domain => lowerUrl.includes(domain));
    }
    validateFileContent(file) {
        // Basic content validation - check file headers match MIME type
        try {
            const buffer = require('fs').readFileSync(file.path);
            switch (file.mimetype) {
                case 'application/pdf':
                    if (!buffer.toString('ascii', 0, 4).includes('%PDF')) {
                        return { isValid: false, warning: 'File header does not match PDF format' };
                    }
                    break;
                case 'image/jpeg':
                case 'image/jpg':
                    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
                        return { isValid: false, warning: 'File header does not match JPEG format' };
                    }
                    break;
                case 'image/png':
                    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
                    if (!buffer.slice(0, 8).equals(pngSignature)) {
                        return { isValid: false, warning: 'File header does not match PNG format' };
                    }
                    break;
            }
            return { isValid: true };
        }
        catch (error) {
            return { isValid: false, warning: 'Failed to validate file content' };
        }
    }
    async calculateChecksum(filePath) {
        const fileBuffer = await fs.readFile(filePath);
        return crypto.createHash(this.config.checksumAlgorithm).update(fileBuffer).digest('hex');
    }
    async generateImmutableStorageUri(facilityId, assessmentId, questionId, filename) {
        // Generate immutable path using hash of key components + timestamp
        const timestamp = Date.now();
        const pathComponents = [facilityId, assessmentId, questionId, filename, timestamp].join('/');
        const pathHash = crypto.createHash('sha256').update(pathComponents).digest('hex');
        // Create immutable URI with hash prefix for integrity
        return `evidence/${facilityId}/${assessmentId}/${questionId}/${pathHash.substring(0, 8)}/${filename}`;
    }
    async moveToImmutableStorage(sourcePath, storageUri) {
        const destinationPath = path.join(this.uploadPath, storageUri);
        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destinationPath), { recursive: true });
        // Move file to immutable location
        await fs.rename(sourcePath, destinationPath);
        return destinationPath;
    }
    async processEvidenceUpload(file, facilityId, assessmentId, questionId, uploadedBy) {
        const warnings = [];
        // Validate filename security
        const fileNameValidation = await this.validateFileName(file);
        if (!fileNameValidation.isValid) {
            throw new Error(fileNameValidation.warning || 'Invalid filename');
        }
        if (fileNameValidation.warning) {
            warnings.push(fileNameValidation.warning);
        }
        // Validate file size
        const fileSizeValidation = await this.validateFileSize(file);
        if (!fileSizeValidation.isValid) {
            throw new Error(fileSizeValidation.warning || 'Invalid file size');
        }
        if (fileSizeValidation.warning) {
            warnings.push(fileSizeValidation.warning);
        }
        // Validate file type
        const mimeValidation = this.validateMimeType(file);
        if (!mimeValidation.isValid) {
            throw new Error(mimeValidation.warning || 'Invalid file type');
        }
        if (mimeValidation.warning) {
            warnings.push(mimeValidation.warning);
        }
        // Perform deep content scan
        const contentScan = await this.performDeepContentScan(file.path);
        if (!contentScan.isValid) {
            throw new Error(`Security threat detected: ${contentScan.threats.join(', ')}`);
        }
        warnings.push(...contentScan.warnings);
        // Calculate checksum
        const checksum = await this.calculateChecksum(file.path);
        // Generate immutable storage URI
        const storageUri = await this.generateImmutableStorageUri(facilityId, assessmentId, questionId, file.filename);
        // Move to immutable storage
        const finalPath = await this.moveToImmutableStorage(file.path, storageUri);
        // Create evidence object record
        const evidenceId = crypto.randomUUID();
        const uploadedAt = new Date();
        await db.insert(evidenceObjects).values({
            id: evidenceId,
            facilityId,
            assessmentId,
            questionId,
            originalName: file.originalname,
            mime: file.mimetype,
            size: file.size,
            checksum,
            storageUri,
            createdBy: uploadedBy,
            scanStatus: 'pending',
            scanResults: {
                warnings,
                uploadPath: finalPath,
                contentValidated: this.config.enableContentValidation
            }
        });
        // Queue for antivirus scanning
        await this.queueAntivirusScan(evidenceId, finalPath);
        return {
            id: evidenceId,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            checksum,
            storageUri,
            mimeType: file.mimetype,
            uploadedAt,
            scanStatus: 'pending',
            warnings
        };
    }
    async queueAntivirusScan(evidenceId, filePath) {
        // In production, this would integrate with actual antivirus service
        // For now, we'll simulate the scanning process
        console.log(`Queuing antivirus scan for evidence ${evidenceId} at ${filePath}`);
        // Simulate background scan (in production, this would be a proper background job)
        setTimeout(async () => {
            try {
                const scanResult = await this.simulateAntivirusScan(filePath);
                await this.updateScanStatus(evidenceId, scanResult.status, scanResult.details);
            }
            catch (error) {
                console.error(`Antivirus scan failed for evidence ${evidenceId}:`, error);
                await this.updateScanStatus(evidenceId, 'error', { error: String(error) });
            }
        }, 5000); // 5 second delay to simulate scan time
    }
    async simulateAntivirusScan(filePath) {
        // Simulate antivirus scanning
        // In production, integrate with ClamAV, Windows Defender, or cloud AV service
        try {
            const stats = await fs.stat(filePath);
            // Basic heuristics for demonstration
            if (stats.size === 0) {
                return { status: 'error', details: { reason: 'Empty file' } };
            }
            // Read file header for basic malware patterns (very simplified)
            const buffer = await fs.readFile(filePath, { flag: 'r' });
            const header = buffer.toString('hex', 0, Math.min(1024, buffer.length));
            // Look for known malicious patterns (this is just for demo)
            const suspiciousPatterns = [
                '4d5a', // PE executable header
                '7f454c46' // ELF header
            ];
            for (const pattern of suspiciousPatterns) {
                if (header.includes(pattern)) {
                    return {
                        status: 'infected',
                        details: {
                            reason: 'Suspicious file header detected',
                            pattern: pattern
                        }
                    };
                }
            }
            return {
                status: 'clean',
                details: {
                    scannedAt: new Date().toISOString(),
                    scanDuration: '5s',
                    engine: 'demo-scanner-v1.0'
                }
            };
        }
        catch (error) {
            return { status: 'error', details: { error: String(error) } };
        }
    }
    async updateScanStatus(evidenceId, status, details) {
        // Get existing scanResults to preserve categorization data
        const [existingEvidence] = await db.select({ scanResults: evidenceObjects.scanResults })
            .from(evidenceObjects)
            .where(eq(evidenceObjects.id, evidenceId));
        const existingScanResults = existingEvidence?.scanResults || {};
        await db.update(evidenceObjects)
            .set({
            scanStatus: status,
            scanResults: {
                ...existingScanResults, // Preserve evidenceType, tags, warnings, etc.
                antivirusResults: details, // Add AV results as nested object
                lastScannedAt: new Date().toISOString(),
                scanStatus: status
            }
        })
            .where(eq(evidenceObjects.id, evidenceId));
        // If infected and quarantine is enabled, move to quarantine
        if (status === 'infected' && this.config.quarantineInfected) {
            await this.quarantineFile(evidenceId);
        }
    }
    async quarantineFile(evidenceId) {
        try {
            const [evidence] = await db.select()
                .from(evidenceObjects)
                .where(eq(evidenceObjects.id, evidenceId));
            if (evidence && evidence.storageUri) {
                const originalPath = path.join(this.uploadPath, evidence.storageUri);
                const quarantinePath = path.join(this.quarantinePath, `${evidenceId}_${evidence.originalName}`);
                await fs.rename(originalPath, quarantinePath);
                // Update storage URI to reflect quarantine location
                await db.update(evidenceObjects)
                    .set({
                    storageUri: `quarantine/${evidenceId}_${evidence.originalName}`,
                    scanResults: {
                        ...(evidence.scanResults || {}),
                        quarantinedAt: new Date().toISOString(),
                        originalStorageUri: evidence.storageUri
                    }
                })
                    .where(eq(evidenceObjects.id, evidenceId));
                console.log(`File quarantined: ${evidenceId}`);
            }
        }
        catch (error) {
            console.error(`Failed to quarantine file ${evidenceId}:`, error);
        }
    }
    async getEvidenceAuditLog(evidenceId) {
        const [evidence] = await db.select()
            .from(evidenceObjects)
            .where(eq(evidenceObjects.id, evidenceId));
        if (!evidence) {
            throw new Error('Evidence not found');
        }
        return {
            id: evidence.id,
            originalName: evidence.originalName,
            createdAt: evidence.createdAt,
            createdBy: evidence.createdBy,
            checksum: evidence.checksum,
            size: evidence.size,
            mimeType: evidence.mime,
            scanStatus: evidence.scanStatus,
            scanResults: evidence.scanResults,
            storageUri: evidence.storageUri,
            auditTrail: [
                {
                    action: 'uploaded',
                    timestamp: evidence.createdAt,
                    userId: evidence.createdBy,
                    details: {
                        originalName: evidence.originalName,
                        size: evidence.size,
                        checksum: evidence.checksum
                    }
                },
                ...(evidence.scanResults && typeof evidence.scanResults === 'object' && evidence.scanResults.scannedAt ? [{
                        action: 'scanned',
                        timestamp: evidence.scanResults.scannedAt,
                        details: evidence.scanResults
                    }] : [])
            ]
        };
    }
}
// Export a default instance
export const evidenceService = new EvidenceService();
