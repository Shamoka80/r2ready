import { Router } from "express";
import { TemplateValidator } from '../services/templateValidator.js';
const router = Router();
// GET /api/templates/validate
router.get("/validate", async (req, res) => {
    try {
        const validator = new TemplateValidator();
        const integrity = await validator.verifyTemplateIntegrity();
        res.json({
            passed: integrity.passed,
            timestamp: new Date().toISOString(),
            results: integrity.results,
            summary: {
                total: integrity.results.length,
                valid: integrity.results.filter(r => r.isValid).length,
                errors: integrity.results.reduce((sum, r) => sum + r.errors.length, 0),
                warnings: integrity.results.reduce((sum, r) => sum + r.warnings.length, 0)
            }
        });
    }
    catch (error) {
        console.error('Template validation error:', error);
        res.status(500).json({ error: "Template validation failed" });
    }
});
// GET /api/templates/report
router.get("/report", async (req, res) => {
    try {
        const validator = new TemplateValidator();
        const report = validator.generateValidationReport();
        res.setHeader('Content-Type', 'text/plain');
        res.send(report);
    }
    catch (error) {
        console.error('Template report error:', error);
        res.status(500).json({ error: "Template report generation failed" });
    }
});
// POST /api/templates/:templateName/lock
router.post("/:templateName/lock", async (req, res) => {
    try {
        const { templateName } = req.params;
        const validator = new TemplateValidator();
        await validator.lockTemplateVersion(templateName);
        res.json({
            success: true,
            message: `Template ${templateName} locked successfully`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Template lock error:', error);
        res.status(400).json({ error: error.message });
    }
});
// GET /api/templates/status
router.get("/status", async (req, res) => {
    try {
        const validator = new TemplateValidator();
        const integrity = await validator.verifyTemplateIntegrity();
        const systemStatus = {
            operational: integrity.passed,
            timestamp: new Date().toISOString(),
            templateCount: integrity.results.length,
            validTemplates: integrity.results.filter(r => r.isValid).length,
            totalErrors: integrity.results.reduce((sum, r) => sum + r.errors.length, 0),
            totalWarnings: integrity.results.reduce((sum, r) => sum + r.warnings.length, 0),
            templates: integrity.results.map(r => ({
                name: r.templateName,
                status: r.isValid ? 'valid' : 'invalid',
                checksum: r.checksum.substring(0, 12) + '...',
                lastModified: r.lastModified,
                errorCount: r.errors.length,
                warningCount: r.warnings.length
            }))
        };
        res.json(systemStatus);
    }
    catch (error) {
        console.error('Template status error:', error);
        res.status(500).json({ error: "System status check failed" });
    }
});
export default router;
