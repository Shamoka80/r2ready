import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { TemplateProcessor, type TemplateData, type CriticalGap, type CoreRequirement } from './templateProcessor.js';
import { TemplateValidator, TemplateFallbackRenderer } from './templateValidator.js';

export interface GoldenFileTestResult {
  templateName: string;
  testName: string;
  passed: boolean;
  details: {
    expectedChecksum?: string;
    actualChecksum?: string;
    expectedSize?: number;
    actualSize?: number;
    contentDiff?: string;
    error?: string;
  };
  warnings: string[];
}

export interface TemplateTestSuite {
  name: string;
  templates: string[];
  testData: Partial<TemplateData>;
  expectedOutputs: {
    [templateName: string]: {
      checksum: string;
      sizeRange: { min: number; max: number };
      contentChecks: string[];
    };
  };
}

export class TemplateGoldenFileTester {
  private templateValidator: TemplateValidator;
  private templateProcessor: TemplateProcessor;
  private fallbackRenderer: TemplateFallbackRenderer;
  private testSuitesPath: string;
  private goldenFilesPath: string;

  constructor(
    templateValidator: TemplateValidator,
    templateProcessor: TemplateProcessor,
    testSuitesPath?: string
  ) {
    this.templateValidator = templateValidator;
    this.templateProcessor = templateProcessor;
    this.fallbackRenderer = new TemplateFallbackRenderer(templateValidator);
    this.testSuitesPath = testSuitesPath || path.join(process.cwd(), 'tests', 'template-suites');
    this.goldenFilesPath = path.join(process.cwd(), 'tests', 'golden-files');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.testSuitesPath, { recursive: true });
    await fs.mkdir(this.goldenFilesPath, { recursive: true });
    
    // Create default test suite if none exists
    const defaultSuitePath = path.join(this.testSuitesPath, 'default-suite.json');
    try {
      await fs.access(defaultSuitePath);
    } catch {
      await this.createDefaultTestSuite();
    }
  }

  private async createDefaultTestSuite(): Promise<void> {
    const defaultTestData: Partial<TemplateData> = {
      companyName: "Acme Electronics Recycling LLC",
      dbaName: "Acme E-Waste Solutions",
      contactName: "John Smith",
      contactEmail: "john.smith@acme-ewaste.com",
      contactPhone: "(555) 123-4567",
      contactTitle: "Compliance Manager",
      entityType: "LLC",
      taxId: "12-3456789",
      executiveName: "Jane Doe",
      executiveTitle: "Chief Executive Officer",
      
      facilityName: "Acme Main Processing Facility",
      facilityAddress: "1234 Industrial Blvd",
      facilityCity: "Austin",
      facilityState: "TX",
      facilityZipCode: "78750",
      headcount: 45,
      floorArea: 25000,
      processingActivities: ["DISASSEMBLY", "SHREDDING", "RECOVERY"],
      annualVolume: 2500000,
      
      assessmentId: "test-assessment-001",
      assessmentDate: '2024-01-15',
      assessmentPeriod: '2024-Q1',
      standardVersion: "3.0",
      standardCode: "R2v3",
      version: "3.0",
      
      overallScore: 85.5,
      readinessLevel: "READY_WITH_MINOR_GAPS",
      readinessExplanation: "Organization demonstrates strong compliance readiness",
      auditRecommendation: "Proceed to certification audit",
      certReadyStatus: "READY",
      
      criticalCount: 1,
      majorCount: 3,
      minorCount: 5,
      totalGaps: 9,
      completedCount: 108,
      inProgressCount: 10,
      notStartedCount: 2,
      
      immediateActions: 2,
      shortTermActions: 5,
      longTermActions: 3,
      totalTimeline: "6 months",
      docInvestment: "$25,000",
      systemInvestment: "$50,000",
      trainingInvestment: "$15,000",
      consultingInvestment: "$30,000",
      totalInvestment: "$120,000",
      
      totalBudget: "$150,000",
      actualSpend: "$120,000",
      remainingBudget: "$30,000",
      budgetVariance: "20%",
      projectedROI: "250%",
      paybackMonths: 18,
      year1ROI: "50%",
      year2ROI: "100%",
      year3ROI: "100%",
      riskCost: "$500,000",
      
      crScores: {},
      crStatuses: {},
      
      businessContextDescription: "Test business context",
      businessDriverExplanation: "Test business driver",
      currentPositionAnalysis: "Test current position",
      postCertPosition: "Test post-cert position",
      newMarketOpportunities: [],
      competitiveAdvantages: [],
      keyStrengths: [],
      
      highRisks: [],
      
      majorGaps: [],
      minorGaps: [],
      
      criticalGaps: [
        {
          gapId: "GAP-001",
          coreReq: "CR-1",
          subsection: "1.1",
          exactRequirementText: "Management system documentation must be maintained",
          currentStatus: "PARTIAL",
          gapDescription: "Documentation exists but is not properly version controlled",
          evidenceRequirements: [
            {
              evidenceType: "DOCUMENT",
              evidenceDescription: "Version-controlled management system documentation"
            }
          ],
          blockingStatus: false,
          riskLevel: "MEDIUM",
          personnelReq: "Training coordinator required",
          documentationReq: "Update document control procedures",
          systemChanges: "Implement document management system",
          trainingReq: "Staff training on new procedures",
          implementationTimeline: "90 days",
          implementationCost: "$15,000",
          correctiveActions: [
            {
              actionDescription: "Implement document version control system",
              responsibleParty: "Compliance Manager",
              targetDate: "2024-04-15",
              successCriteria: "All documents properly version controlled"
            }
          ]
        }
      ],
      
      coreRequirements: [
        {
          crNumber: 1,
          crName: "Management System",
          questionsAssessed: 15,
          complianceScore: 80,
          performanceStatus: "GOOD",
          keyStrengths: ["Strong leadership commitment", "Clear policies"],
          primaryGaps: ["Document control", "Training records"],
          implementationPriority: "HIGH",
          subRequirements: [
            {
              subsection: "1.1",
              subsectionName: "Management System Documentation",
              subsectionStatus: "PARTIAL",
              evidenceRequired: "Management system manual",
              gapDescription: "Documentation not version controlled"
            }
          ]
        }
      ],
      
      phase1Actions: [
        {
          actionDescription: "Implement document management system",
          r2Requirement: "CR-1.1",
          responsibleParty: "Compliance Manager",
          targetDate: "2024-04-15",
          resourcesRequired: "$15,000, 40 hours",
          successCriteria: "All documents version controlled",
          dependencies: ["Software procurement", "Staff training"]
        }
      ],
      
      phase2Projects: [],
      phase3Initiatives: [],
      
      recommendations: [
        "Implement centralized document management system",
        "Establish regular compliance audits",
        "Enhance staff training program"
      ],
      
      nextSteps: [
        "Finalize document control procedures",
        "Train staff on new systems",
        "Schedule follow-up assessment"
      ],
      
      executiveSummary: "Overall compliance assessment shows strong foundation with opportunities for improvement in documentation and training areas."
    };

    const defaultSuite: TemplateTestSuite = {
      name: "Default Template Test Suite",
      templates: ["pdf_temp_export.pdf", "excel_temp_export.xlsx"],
      testData: defaultTestData,
      expectedOutputs: {
        "pdf_temp_export.pdf": {
          checksum: "", // Will be generated on first run
          sizeRange: { min: 50000, max: 500000 }, // 50KB - 500KB
          contentChecks: [
            "Acme Electronics Recycling LLC",
            "R2v3",
            "CR-1",
            "Management System"
          ]
        },
        "excel_temp_export.xlsx": {
          checksum: "",
          sizeRange: { min: 20000, max: 200000 }, // 20KB - 200KB
          contentChecks: [
            "Acme Electronics Recycling LLC",
            "85.5", // Compliance score
            "GAP-001"
          ]
        }
      }
    };

    const suitePath = path.join(this.testSuitesPath, 'default-suite.json');
    await fs.writeFile(suitePath, JSON.stringify(defaultSuite, null, 2));
    console.log('✅ Created default template test suite');
  }

  async runAllTests(): Promise<GoldenFileTestResult[]> {
    const results: GoldenFileTestResult[] = [];
    
    try {
      const suiteFiles = await fs.readdir(this.testSuitesPath);
      
      for (const suiteFile of suiteFiles) {
        if (suiteFile.endsWith('.json')) {
          const suitePath = path.join(this.testSuitesPath, suiteFile);
          const suiteResults = await this.runTestSuite(suitePath);
          results.push(...suiteResults);
        }
      }
    } catch (error) {
      console.error('Error running template tests:', error);
      results.push({
        templateName: 'ALL',
        testName: 'Test Suite Execution',
        passed: false,
        details: { error: String(error) },
        warnings: []
      });
    }
    
    return results;
  }

  async runTestSuite(suitePath: string): Promise<GoldenFileTestResult[]> {
    const results: GoldenFileTestResult[] = [];
    
    try {
      const suiteContent = await fs.readFile(suitePath, 'utf8');
      const suite: TemplateTestSuite = JSON.parse(suiteContent);
      
      console.log(`\n🧪 Running test suite: ${suite.name}`);
      
      for (const templateName of suite.templates) {
        const testResult = await this.testTemplate(templateName, suite);
        results.push(testResult);
      }
      
    } catch (error) {
      console.error(`Error running test suite ${suitePath}:`, error);
      results.push({
        templateName: path.basename(suitePath),
        testName: 'Suite Parsing',
        passed: false,
        details: { error: String(error) },
        warnings: []
      });
    }
    
    return results;
  }

  private async testTemplate(templateName: string, suite: TemplateTestSuite): Promise<GoldenFileTestResult> {
    const warnings: string[] = [];
    
    try {
      console.log(`  📄 Testing template: ${templateName}`);
      
      // Generate output using template processor
      const outputBuffer = await this.generateTemplateOutput(templateName, suite.testData);
      
      if (!outputBuffer) {
        return {
          templateName,
          testName: 'Generation',
          passed: false,
          details: { error: 'Failed to generate template output' },
          warnings
        };
      }
      
      // Calculate checksum
      const actualChecksum = crypto.createHash('sha256').update(outputBuffer).digest('hex');
      const actualSize = outputBuffer.length;
      
      const expectedOutput = suite.expectedOutputs[templateName];
      if (!expectedOutput) {
        warnings.push(`No expected output defined for ${templateName}`);
        return {
          templateName,
          testName: 'Configuration',
          passed: false,
          details: { error: 'No expected output configuration found' },
          warnings
        };
      }
      
      // Check size range
      const sizeInRange = actualSize >= expectedOutput.sizeRange.min && 
                         actualSize <= expectedOutput.sizeRange.max;
      if (!sizeInRange) {
        warnings.push(`Size ${actualSize} outside expected range ${expectedOutput.sizeRange.min}-${expectedOutput.sizeRange.max}`);
      }
      
      // Check checksum (if we have a golden file)
      let checksumMatch = true;
      if (expectedOutput.checksum) {
        checksumMatch = actualChecksum === expectedOutput.checksum;
        if (!checksumMatch) {
          warnings.push(`Checksum mismatch: expected ${expectedOutput.checksum}, got ${actualChecksum}`);
        }
      } else {
        // First run - save as golden file
        await this.saveGoldenFile(templateName, outputBuffer, actualChecksum);
        warnings.push('First run - saved as golden file');
      }
      
      // Content checks
      const contentChecks = await this.performContentChecks(outputBuffer, expectedOutput.contentChecks);
      if (contentChecks.length > 0) {
        warnings.push(...contentChecks);
      }
      
      const passed = sizeInRange && checksumMatch && contentChecks.length === 0;
      
      return {
        templateName,
        testName: 'Golden File Test',
        passed,
        details: {
          expectedChecksum: expectedOutput.checksum,
          actualChecksum,
          expectedSize: expectedOutput.sizeRange.min,
          actualSize,
          contentDiff: contentChecks.join('; ')
        },
        warnings
      };
      
    } catch (error) {
      return {
        templateName,
        testName: 'Execution',
        passed: false,
        details: { error: String(error) },
        warnings
      };
    }
  }

  private async generateTemplateOutput(templateName: string, testData: Partial<TemplateData>): Promise<Buffer | null> {
    try {
      // For golden file testing, we need to create a test assessment and tenant
      // In practice, this would use real IDs from the database
      const testAssessmentId = "test-assessment-001";
      const testTenantId = "test-tenant-001";
      
      // Determine template type and generate accordingly
      if (templateName.includes('pdf')) {
        return await this.templateProcessor.generatePDFTechnicalReport(testAssessmentId, testTenantId);
      } else if (templateName.includes('excel')) {
        return await this.templateProcessor.generateExcelDashboard(testAssessmentId, testTenantId);
      } else if (templateName.includes('word')) {
        return await this.templateProcessor.generateWordReport(testAssessmentId, testTenantId);
      } else {
        console.warn(`Unknown template type for ${templateName}`);
        return null;
      }
    } catch (error) {
      console.error(`Error generating template ${templateName}:`, error);
      return null;
    }
  }

  private async performContentChecks(outputBuffer: Buffer, contentChecks: string[]): Promise<string[]> {
    const failures: string[] = [];
    
    try {
      // For binary formats, we can only do basic checks
      const outputString = outputBuffer.toString('utf8', 0, Math.min(10000, outputBuffer.length));
      
      for (const expectedContent of contentChecks) {
        if (!outputString.includes(expectedContent)) {
          failures.push(`Missing expected content: "${expectedContent}"`);
        }
      }
    } catch (error) {
      failures.push(`Content check error: ${error}`);
    }
    
    return failures;
  }

  private async saveGoldenFile(templateName: string, outputBuffer: Buffer, checksum: string): Promise<void> {
    const goldenFileName = `${templateName}.golden`;
    const goldenFilePath = path.join(this.goldenFilesPath, goldenFileName);
    
    await fs.writeFile(goldenFilePath, outputBuffer);
    
    // Also save metadata
    const metadataPath = path.join(this.goldenFilesPath, `${templateName}.meta.json`);
    const metadata = {
      templateName,
      checksum,
      size: outputBuffer.length,
      createdAt: new Date().toISOString(),
      version: "1.0.0"
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`💾 Saved golden file: ${goldenFileName}`);
  }

  async generateTestReport(results: GoldenFileTestResult[]): Promise<string> {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    let report = `\n📊 Template Golden File Test Report\n`;
    report += `${'='.repeat(50)}\n`;
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${passedTests} ✅\n`;
    report += `Failed: ${failedTests} ❌\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;
    
    // Group by template
    const byTemplate = new Map<string, GoldenFileTestResult[]>();
    for (const result of results) {
      if (!byTemplate.has(result.templateName)) {
        byTemplate.set(result.templateName, []);
      }
      byTemplate.get(result.templateName)!.push(result);
    }
    
    for (const [templateName, templateResults] of byTemplate.entries()) {
      report += `📄 ${templateName}\n`;
      for (const result of templateResults) {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        report += `  ${status} ${result.testName}\n`;
        
        if (!result.passed) {
          report += `    Error: ${result.details.error || 'Test failed'}\n`;
        }
        
        if (result.warnings.length > 0) {
          report += `    Warnings: ${result.warnings.join(', ')}\n`;
        }
        
        if (result.details.actualSize) {
          report += `    Size: ${result.details.actualSize} bytes\n`;
        }
      }
      report += '\n';
    }
    
    return report;
  }
}

// Export singleton instance
export const templateTester = new TemplateGoldenFileTester(
  new TemplateValidator(),
  new TemplateProcessor()
);