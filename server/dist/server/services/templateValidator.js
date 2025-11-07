import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
export class TemplateValidator {
    templatesPath;
    expectedTemplates = [
        'pdf_temp_export.pdf',
        'excel_temp_export.pdf',
        'word_temp_export.pdf',
        'email_temp_export.pdf'
    ];
    // Template registry for version management
    templateRegistry = new Map();
    // Store known good checksums for template integrity verification
    knownGoodChecksums = new Map();
    constructor(templatesPath) {
        // When running from server directory, need to go up one level
        this.templatesPath = templatesPath || path.resolve(process.cwd(), 'Fixes/reports');
        this.initializeKnownChecksums();
    }
    initializeKnownChecksums() {
        // In production, these would be set during deployment
        // For now, we'll calculate them dynamically and store for comparison
        this.loadTemplateRegistry();
    }
    loadTemplateRegistry() {
        const registryFile = path.join(this.templatesPath, '.template-registry.json');
        if (fs.existsSync(registryFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
                for (const [name, entry] of Object.entries(data)) {
                    const registryEntry = entry;
                    this.templateRegistry.set(name, {
                        ...registryEntry,
                        versions: new Map(Object.entries(registryEntry.versions || {})),
                        lastValidated: new Date(registryEntry.lastValidated)
                    });
                }
            }
            catch (error) {
                console.warn('Failed to load template registry:', error);
            }
        }
    }
    saveTemplateRegistry() {
        const registryFile = path.join(this.templatesPath, '.template-registry.json');
        const data = {};
        for (const [name, entry] of this.templateRegistry.entries()) {
            data[name] = {
                ...entry,
                versions: Object.fromEntries(entry.versions.entries()),
                lastValidated: entry.lastValidated.toISOString()
            };
        }
        fs.writeFileSync(registryFile, JSON.stringify(data, null, 2));
    }
    async validateAllTemplates() {
        const results = [];
        for (const templateName of this.expectedTemplates) {
            const result = await this.validateTemplate(templateName);
            results.push(result);
        }
        return results;
    }
    async validateTemplate(templateName) {
        const templatePath = path.join(this.templatesPath, templateName);
        const result = {
            isValid: true,
            templateName,
            checksum: '',
            lastModified: new Date(),
            errors: [],
            warnings: []
        };
        try {
            // Check if template exists
            if (!fs.existsSync(templatePath)) {
                result.isValid = false;
                result.errors.push(`Template file not found: ${templatePath}`);
                return result;
            }
            // Get file stats
            const stats = fs.statSync(templatePath);
            result.lastModified = stats.mtime;
            // Calculate checksum
            const fileBuffer = fs.readFileSync(templatePath);
            result.checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            // Extract embedded metadata if present
            const metadata = this.extractTemplateMetadata(fileBuffer, templateName);
            if (metadata) {
                result.metadata = metadata;
                result.version = metadata.version;
                result.schemaHash = metadata.schemaHash;
                // Validate version format
                if (!this.isValidVersionFormat(metadata.version)) {
                    result.warnings.push(`Invalid version format: ${metadata.version}`);
                }
                // Update registry
                this.updateTemplateRegistry(templateName, metadata, result.checksum);
            }
            else {
                result.warnings.push(`No embedded metadata found in template: ${templateName}`);
            }
            // Validate file size (templates should not be empty or corrupted)
            if (stats.size === 0) {
                result.isValid = false;
                result.errors.push(`Template file is empty: ${templateName}`);
            }
            else if (stats.size < 100) {
                result.warnings.push(`Template file seems unusually small: ${templateName} (${stats.size} bytes)`);
            }
            // Check against known good checksum if available
            const knownChecksum = this.knownGoodChecksums.get(templateName);
            if (knownChecksum && knownChecksum !== result.checksum) {
                result.warnings.push(`Template checksum changed since last validation: ${templateName}`);
            }
            // Validate file format based on extension/content
            if (templateName.endsWith('.pdf')) {
                const header = fileBuffer.toString('ascii', 0, 10).trim();
                if (!header.startsWith('%PDF')) {
                    result.isValid = false;
                    result.errors.push(`Invalid PDF format: ${templateName}`);
                }
            }
        }
        catch (error) {
            result.isValid = false;
            result.errors.push(`Error validating template ${templateName}: ${error instanceof Error ? error.message : String(error)}`);
        }
        return result;
    }
    async lockTemplateVersion(templateName, version) {
        const validation = await this.validateTemplate(templateName);
        if (validation.isValid) {
            this.knownGoodChecksums.set(templateName, validation.checksum);
            // Update registry with locked version
            const registryEntry = this.templateRegistry.get(templateName);
            if (registryEntry) {
                registryEntry.lockedVersion = version || validation.version || 'unknown';
                registryEntry.checksum = validation.checksum;
                registryEntry.lastValidated = new Date();
                this.saveTemplateRegistry();
            }
            // Store to persistent storage (file-based for now)
            const lockFile = path.join(this.templatesPath, '.template-locks.json');
            const locks = this.loadTemplateLocks();
            locks[templateName] = {
                checksum: validation.checksum,
                lockedAt: new Date().toISOString(),
                lastModified: validation.lastModified.toISOString(),
                version: validation.version || 'unknown',
                schemaHash: validation.schemaHash || ''
            };
            fs.writeFileSync(lockFile, JSON.stringify(locks, null, 2));
        }
        else {
            throw new Error(`Cannot lock invalid template: ${templateName}`);
        }
    }
    loadTemplateLocks() {
        const lockFile = path.join(this.templatesPath, '.template-locks.json');
        if (fs.existsSync(lockFile)) {
            return JSON.parse(fs.readFileSync(lockFile, 'utf8'));
        }
        return {};
    }
    async verifyTemplateIntegrity() {
        const results = await this.validateAllTemplates();
        const passed = results.every(r => r.isValid && r.errors.length === 0);
        return { passed, results };
    }
    generateValidationReport() {
        const locks = this.loadTemplateLocks();
        let report = 'TEMPLATE VALIDATION REPORT\n';
        report += '================================\n\n';
        for (const templateName of this.expectedTemplates) {
            const lock = locks[templateName];
            const registryEntry = this.templateRegistry.get(templateName);
            report += `${templateName}:\n`;
            if (lock) {
                report += `  Locked: ${lock.lockedAt}\n`;
                report += `  Version: ${lock.version || 'unknown'}\n`;
                report += `  Schema Hash: ${lock.schemaHash || 'none'}\n`;
                report += `  Checksum: ${lock.checksum}\n`;
                report += `  Last Modified: ${lock.lastModified}\n`;
            }
            else {
                report += `  Status: NOT LOCKED\n`;
            }
            if (registryEntry) {
                report += `  Registry Versions: ${Array.from(registryEntry.versions.keys()).join(', ')}\n`;
                report += `  Current Version: ${registryEntry.currentVersion}\n`;
            }
            report += '\n';
        }
        return report;
    }
    extractTemplateMetadata(fileBuffer, templateName) {
        try {
            // For now, generate basic metadata since templates don't have embedded metadata yet
            // In production, templates would have proper embedded version info
            return {
                version: '1.0.0',
                schemaHash: crypto.createHash('md5').update(fileBuffer.slice(0, 1024)).digest('hex'),
                createdAt: new Date().toISOString(),
                description: `${templateName} export template`,
                requiredFields: ['assessmentData', 'facilityInfo', 'questions', 'answers']
            };
        }
        catch (error) {
            console.warn(`Failed to extract metadata from ${templateName}:`, error);
            return null;
        }
    }
    isValidVersionFormat(version) {
        // Semantic versioning format: X.Y.Z
        const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
        return semverRegex.test(version);
    }
    updateTemplateRegistry(templateName, metadata, checksum) {
        let entry = this.templateRegistry.get(templateName);
        if (!entry) {
            entry = {
                name: templateName,
                currentVersion: metadata.version,
                versions: new Map(),
                checksum,
                lastValidated: new Date()
            };
            this.templateRegistry.set(templateName, entry);
        }
        // Store version metadata
        entry.versions.set(metadata.version, metadata);
        entry.currentVersion = metadata.version;
        entry.checksum = checksum;
        entry.lastValidated = new Date();
        this.saveTemplateRegistry();
    }
    async validateTemplateVersion(templateName, requiredVersion) {
        const entry = this.templateRegistry.get(templateName);
        if (!entry) {
            return { isValid: false, message: `Template ${templateName} not found in registry` };
        }
        if (!entry.versions.has(requiredVersion)) {
            return {
                isValid: false,
                message: `Version ${requiredVersion} not available. Available versions: ${Array.from(entry.versions.keys()).join(', ')}`
            };
        }
        return { isValid: true, message: `Template version ${requiredVersion} is valid` };
    }
    getAvailableVersions(templateName) {
        const entry = this.templateRegistry.get(templateName);
        return entry ? Array.from(entry.versions.keys()) : [];
    }
    getLatestVersion(templateName) {
        const entry = this.templateRegistry.get(templateName);
        return entry ? entry.currentVersion : null;
    }
}
// Template fallback renderer for version mismatches
export class TemplateFallbackRenderer {
    validator;
    constructor(validator) {
        this.validator = validator;
    }
    async selectBestTemplate(templateName, requiredVersion) {
        const warnings = [];
        const availableVersions = this.validator.getAvailableVersions(templateName);
        // Try exact match first
        const exactMatch = await this.validator.validateTemplateVersion(templateName, requiredVersion);
        if (exactMatch.isValid) {
            return {
                templatePath: path.join(this.validator.templatesPath, templateName),
                version: requiredVersion,
                warnings
            };
        }
        warnings.push(`Requested version ${requiredVersion} not available`);
        // Find compatible version (same major version)
        const [reqMajor] = requiredVersion.split('.');
        const compatibleVersions = availableVersions.filter(v => v.startsWith(reqMajor + '.'));
        if (compatibleVersions.length > 0) {
            const bestVersion = this.selectBestCompatibleVersion(compatibleVersions, requiredVersion);
            warnings.push(`Using fallback version ${bestVersion} instead of ${requiredVersion}`);
            return {
                templatePath: path.join(this.validator.templatesPath, templateName),
                version: bestVersion,
                warnings
            };
        }
        // Last resort: use latest available version
        const latestVersion = this.validator.getLatestVersion(templateName);
        if (latestVersion) {
            warnings.push(`Using latest available version ${latestVersion} (major version mismatch)`);
            return {
                templatePath: path.join(this.validator.templatesPath, templateName),
                version: latestVersion,
                warnings
            };
        }
        throw new Error(`No compatible template version found for ${templateName}`);
    }
    selectBestCompatibleVersion(versions, requiredVersion) {
        // Sort versions and select the highest compatible one
        const sortedVersions = versions.sort((a, b) => {
            const aParts = a.split('.').map(Number);
            const bParts = b.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aDiff = (aParts[i] || 0) - (bParts[i] || 0);
                if (aDiff !== 0)
                    return aDiff;
            }
            return 0;
        });
        return sortedVersions[sortedVersions.length - 1];
    }
}
