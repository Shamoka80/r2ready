import { Router } from "express";
import { TemplateValidator, TemplateFallbackRenderer } from "../services/templateValidator.js";
import { templateTester } from "../services/templateTester.js";
import type { AuthenticatedRequest } from "../services/authService.js";

const router = Router();

// Initialize services
const templateValidator = new TemplateValidator();
const fallbackRenderer = new TemplateFallbackRenderer(templateValidator);

// Comprehensive template validation with version checking
router.get('/validate-all', async (req: AuthenticatedRequest, res) => {
  try {
    // Run template validation
    const validationResults = await templateValidator.validateAllTemplates();
    
    // Run golden file tests
    await templateTester.initialize();
    const goldenFileResults = await templateTester.runAllTests();
    
    // Generate test report
    const testReport = await templateTester.generateTestReport(goldenFileResults);
    
    // Combine results
    const overallValid = validationResults.every(r => r.isValid);
    const allTestsPassed = goldenFileResults.every(r => r.passed);
    
    res.json({
      success: true,
      overallValid: overallValid && allTestsPassed,
      summary: {
        templatesValidated: validationResults.length,
        validTemplates: validationResults.filter(r => r.isValid).length,
        goldenFileTests: goldenFileResults.length,
        passedTests: goldenFileResults.filter(r => r.passed).length
      },
      validationResults,
      goldenFileResults,
      testReport,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Template validation error:', error);
    res.status(500).json({ 
      error: 'Template validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Validate specific template version
router.get('/validate/:templateName/:version', async (req: AuthenticatedRequest, res) => {
  try {
    const { templateName, version } = req.params;
    
    const validation = await templateValidator.validateTemplateVersion(templateName, version);
    const availableVersions = templateValidator.getAvailableVersions(templateName);
    const latestVersion = templateValidator.getLatestVersion(templateName);
    
    res.json({
      success: true,
      templateName,
      requestedVersion: version,
      validation,
      availableVersions,
      latestVersion,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Template version validation error:', error);
    res.status(500).json({ 
      error: 'Template version validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Select best template with fallback logic
router.post('/select-template', async (req: AuthenticatedRequest, res) => {
  try {
    const { templateName, requiredVersion } = req.body;
    
    if (!templateName || !requiredVersion) {
      return res.status(400).json({ 
        error: 'Missing required fields: templateName and requiredVersion' 
      });
    }
    
    const selection = await fallbackRenderer.selectBestTemplate(templateName, requiredVersion);
    
    res.json({
      success: true,
      templateName,
      requestedVersion: requiredVersion,
      selection,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Template selection error:', error);
    res.status(500).json({ 
      error: 'Template selection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check with enhanced template system status
router.get('/health', async (req, res) => {
  try {
    const validationResults = await templateValidator.validateAllTemplates();
    const allValid = validationResults.every(r => r.isValid);
    
    res.json({ 
      status: allValid ? 'healthy' : 'degraded',
      service: 'template-validation-v2',
      features: {
        versionValidation: true,
        checksumVerification: true,
        metadataExtraction: true,
        fallbackRendering: true,
        goldenFileTesting: true,
        templateRegistry: true
      },
      templateStatus: {
        totalTemplates: validationResults.length,
        validTemplates: validationResults.filter(r => r.isValid).length,
        issues: validationResults.filter(r => !r.isValid).map(r => ({
          template: r.templateName,
          error: r.errors[0]
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;