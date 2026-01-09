import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, Header } from 'docx';
import { db } from '../db';
import { assessments, answers, questions, clauses, facilityProfiles, intakeForms } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import AdvancedScoringService from './advancedScoringService';
import { templateProcessor } from './templateProcessor';

// Placeholder for TemplateProcessor and DocumentGenerationOptions, assuming they exist elsewhere
// In a real scenario, these would be imported from their respective files.
class TemplateProcessor {
  async generateExecutiveSummaryPDF(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Executive Summary PDF for', assessmentId, tenantId); return Buffer.from(''); }
  async generateGapAnalysisPDF(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Gap Analysis PDF for', assessmentId, tenantId); return Buffer.from(''); }
  async generateComplianceReportPDF(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Compliance Report PDF for', assessmentId, tenantId); return Buffer.from(''); }
  async generatePDFTechnicalReport(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Technical Report PDF for', assessmentId, tenantId); return Buffer.from(''); }
  async generateAnalyticsDashboard(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Analytics Dashboard for', assessmentId, tenantId); return Buffer.from(''); }
  async generateGapTrackingSheet(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Gap Tracking Sheet for', assessmentId, tenantId); return Buffer.from(''); }
  async generateExcelDashboard(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Excel Dashboard for', assessmentId, tenantId); return Buffer.from(''); }
  async generateActionPlanDocument(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Action Plan Document for', assessmentId, tenantId); return Buffer.from(''); }
  async generateComplianceManual(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Compliance Manual for', assessmentId, tenantId); return Buffer.from(''); }
  async generateWordReport(assessmentId: string, tenantId: string): Promise<Buffer> { console.log('Generating Word Report for', assessmentId, tenantId); return Buffer.from(''); }
  async generateProgressUpdateEmail(assessmentId: string, tenantId: string): Promise<string> { console.log('Generating Progress Update Email for', assessmentId, tenantId); return ''; }
  async generateCompletionNoticeEmail(assessmentId: string, tenantId: string): Promise<string> { console.log('Generating Completion Notice Email for', assessmentId, tenantId); return ''; }
  async generateEmailSummary(assessmentId: string, tenantId: string): Promise<string> { console.log('Generating Email Summary for', assessmentId, tenantId); return ''; }

  // Placeholder methods for template processing and generation
  private async populateTemplateWithRealData(templateContent: string, assessmentData: AssessmentExportData, format: string): Promise<string> {
    console.log(`Populating template for ${format} with data for assessment ${assessmentData.assessment.id}`);
    // In a real implementation, this would parse templateContent and inject assessmentData
    return templateContent;
  }

  private async generatePDFFromTemplate(populatedTemplate: string, assessmentData: AssessmentExportData): Promise<Buffer> {
    console.log(`Generating PDF from populated template for assessment ${assessmentData.assessment.id}`);
    // Use pdfkit or another library to generate PDF from populatedTemplate
    return Buffer.from(`PDF content for ${assessmentData.assessment.title}`);
  }

  private async generateExcelFromTemplate(populatedTemplate: string, assessmentData: AssessmentExportData): Promise<Buffer> {
    console.log(`Generating Excel from populated template for assessment ${assessmentData.assessment.id}`);
    // Use ExcelJS to generate Excel from populatedTemplate
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    worksheet.addRow([populatedTemplate]); // Simplified for example
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async generateWordFromTemplate(populatedTemplate: string, assessmentData: AssessmentExportData): Promise<Buffer> {
    console.log(`Generating Word from populated template for assessment ${assessmentData.assessment.id}`);
    // Use docx library to generate Word document from populatedTemplate
    const doc = new Document({
      sections: [{
        properties: {},
        children: [new Paragraph(populatedTemplate)]
      }]
    });
    return Packer.toBuffer(doc);
  }

  private getMimeType(format: string): string {
    switch (format) {
      case 'pdf': return 'application/pdf';
      case 'excel': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'word': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default: return 'application/octet-stream';
    }
  }
}

interface DocumentGenerationOptions {
  assessmentId: string;
  tenantId: string;
  templateType?: string;
  includeEvidence?: boolean;
  brandingOptions?: BrandingOptions;
  customFields?: { [key: string]: string };
}

interface BrandingOptions {
  companyName?: string;
  logo?: Buffer;
  primaryColor?: string;
  secondaryColor?: string;
  consultantInfo?: {
    name: string;
    title: string;
    company: string;
    contact: string;
  };
}

interface AssessmentExportData {
  assessment: any;
  facility: any;
  intakeForm: any;
  answers: any[];
  complianceMetrics: any;
  gapAnalysis: any;
  readinessAssessment: any;
}

interface ExportOptions {
  assessmentId: string;
  tenantId: string;
  includeEvidence?: boolean;
  brandingOptions?: BrandingOptions;
}

class ExportService {
  // Production-ready export endpoints with proper error handling
  static async generatePDF(assessmentId: string, tenantId: string, templateType: string = 'technical-report'): Promise<Buffer> {
    try {
      // Use the real templateProcessor instance, not the stub TemplateProcessor class
      switch (templateType) {
        case 'executive-summary':
          return templateProcessor.generateExecutiveSummaryPDF(assessmentId, tenantId);
        case 'gap-analysis':
          return templateProcessor.generateGapAnalysisPDF(assessmentId, tenantId);
        case 'compliance-report':
          return templateProcessor.generateComplianceReportPDF(assessmentId, tenantId);
        default:
          return templateProcessor.generatePDFTechnicalReport(assessmentId, tenantId);
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async generateExcel(assessmentId: string, tenantId: string, templateType: string = 'dashboard'): Promise<Buffer> {
    try {
      // Use the real templateProcessor instance, not the stub TemplateProcessor class
      switch (templateType) {
        case 'analytics':
          return templateProcessor.generateAnalyticsDashboard(assessmentId, tenantId);
        case 'gap-tracker':
          return templateProcessor.generateGapTrackingSheet(assessmentId, tenantId);
        default:
          return templateProcessor.generateExcelDashboard(assessmentId, tenantId);
      }
    } catch (error) {
      console.error('Excel generation failed:', error);
      throw new Error(`Excel generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async generateWord(assessmentId: string, tenantId: string, templateType: string = 'executive-summary'): Promise<Buffer> {
    try {
<<<<<<< HEAD
      // Use the real templateProcessor instance, not the stub TemplateProcessor class
      switch (templateType) {
        case 'action-plan':
          return templateProcessor.generateActionPlanDocument(assessmentId, tenantId);
        case 'compliance-manual':
          return templateProcessor.generateComplianceManual(assessmentId, tenantId);
        default:
          return templateProcessor.generateWordReport(assessmentId, tenantId);
      }
=======
      // All template types use generateWordReport for now
      // Future: implement specific methods for action-plan and compliance-manual if needed
      return templateProcessor.generateWordReport(assessmentId, tenantId);
>>>>>>> dc36b2c4f0de47999ce88ca4fdda70d44c53e049
    } catch (error) {
      console.error('Word generation failed:', error);
      throw new Error(`Word generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async generateEmail(assessmentId: string, tenantId: string, templateType: string = 'consultation'): Promise<string> {
    try {
<<<<<<< HEAD
      // Use the real templateProcessor instance, not the stub TemplateProcessor class
      switch (templateType) {
        case 'progress-update':
          return templateProcessor.generateProgressUpdateEmail(assessmentId, tenantId);
        case 'completion-notice':
          return templateProcessor.generateCompletionNoticeEmail(assessmentId, tenantId);
=======
      // Use templateProcessor for email generation
      switch (templateType) {
        case 'consultation':
          return templateProcessor.generateEmailConsultation(assessmentId, tenantId);
>>>>>>> dc36b2c4f0de47999ce88ca4fdda70d44c53e049
        default:
          return templateProcessor.generateEmailSummary(assessmentId, tenantId);
      }
    } catch (error) {
      console.error('Email generation failed:', error);
      throw new Error(`Email generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced PDF generation with comprehensive compliance reporting
  async generateEnhancedComplianceReport(options: DocumentGenerationOptions): Promise<Buffer> {
    const data = await this.getAssessmentData(options.assessmentId);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        this.buildPDFContent(doc, data, options);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Old Excel generation - kept for now, but ideally would be integrated with TemplateProcessor
  async generateExcelOld(options: ExportOptions): Promise<Buffer> {
    const data = await this.getAssessmentData(options.assessmentId);
    const workbook = new ExcelJS.Workbook();

    // Metadata
    workbook.creator = 'R2Ready Assessment Platform';
    workbook.created = new Date();
    workbook.title = `${data.assessment.title} - Management Dashboard`;

    // Executive Summary Sheet
    const summarySheet = workbook.addWorksheet('Executive Summary');
    await this.buildExcelSummary(summarySheet, data, options);

    // Detailed Results Sheet
    const resultsSheet = workbook.addWorksheet('Detailed Results');
    await this.buildExcelResults(resultsSheet, data);

    // Gap Analysis Sheet
    const gapSheet = workbook.addWorksheet('Gap Analysis');
    await this.buildExcelGapAnalysis(gapSheet, data);

    // Action Items Sheet
    const actionsSheet = workbook.addWorksheet('Action Items');
    await this.buildExcelActionItems(actionsSheet, data);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Old Word generation - kept for now, but ideally would be integrated with TemplateProcessor
  async generateWordOld(options: ExportOptions): Promise<Buffer> {
    const data = await this.getAssessmentData(options.assessmentId);

    const doc = new Document({
      sections: [{
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `R2v3 Assessment - ${data.assessment.title}`,
                    size: 20,
                    color: "2563eb"
                  })
                ]
              })
            ]
          })
        },
        children: await this.buildWordContent(data, options)
      }]
    });

    return await Packer.toBuffer(doc);
  }

  // Old Email Template generation - kept for now, but ideally would be integrated with TemplateProcessor
  async generateEmailTemplate(options: ExportOptions): Promise<string> {
    const data = await this.getAssessmentData(options.assessmentId);

    // Note: processTemplate method not found in templateProcessor
    // Return a simple template for now
    const template = `
      <h1>R2v3 Assessment Report</h1>
      <p>Assessment: ${data.assessment.title}</p>
      <p>Compliance Score: ${data.complianceMetrics.overallCompliance}%</p>
      <p>Readiness Level: ${data.readinessAssessment.readinessLevel}</p>
      <p>Critical Gaps: ${data.gapAnalysis.criticalGaps.length}</p>
    `;

    return template;
  }

  // Private helper methods
  private async getAssessmentData(assessmentId: string): Promise<AssessmentExportData> {
    // Get assessment with related data
    const assessment = await db.query.assessments.findFirst({
      where: eq(assessments.id, assessmentId),
      with: {
        standard: true,
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        },
        intakeForm: true
      }
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get facility info
    let facility = null;
    if (assessment.facilityId) {
      facility = await db.query.facilityProfiles.findFirst({
        where: eq(facilityProfiles.id, assessment.facilityId)
      });
    }

    // Get answers with question details
    const answersData = await db
      .select({
        questionId: answers.questionId,
        questionText: questions.text,
        value: answers.value,
        notes: answers.notes,
        score: answers.score,
        category: questions.category_code,
        categoryName: questions.categoryName,
        required: questions.required,
        clauseRef: clauses.ref,
        clauseTitle: clauses.title
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .leftJoin(clauses, eq(questions.clauseId, clauses.id))
      .where(eq(answers.assessmentId, assessmentId))
      .orderBy(clauses.order, questions.order);

    // Get advanced analytics
    const [complianceMetrics, gapAnalysis, readinessAssessment] = await Promise.all([
      AdvancedScoringService.getComplianceMetrics(assessmentId),
      AdvancedScoringService.generateGapAnalysis(assessmentId),
      AdvancedScoringService.assessReadiness(assessmentId)
    ]);

    return {
      assessment,
      facility,
      intakeForm: assessment.intakeForm,
      answers: answersData,
      complianceMetrics,
      gapAnalysis,
      readinessAssessment
    };
  }

  private buildPDFContent(doc: PDFKit.PDFDocument, data: AssessmentExportData, options: ExportOptions) {
    // Title Page
    this.addPDFTitlePage(doc, data, options);

    doc.addPage();

    // Executive Summary
    this.addPDFExecutiveSummary(doc, data);

    doc.addPage();

    // Assessment Results
    this.addPDFAssessmentResults(doc, data);

    doc.addPage();

    // Gap Analysis
    this.addPDFGapAnalysis(doc, data);

    doc.addPage();

    // Recommendations
    this.addPDFRecommendations(doc, data);

    if (options.includeEvidence) {
      doc.addPage();
      this.addPDFEvidenceSection(doc, data);
    }
  }

  private addPDFTitlePage(doc: PDFKit.PDFDocument, data: AssessmentExportData, options: ExportOptions) {
    // Header with branding
    if (options.brandingOptions?.logo) {
      doc.image(options.brandingOptions.logo, 50, 50, { width: 100 });
    }

    const primaryColor = options.brandingOptions?.primaryColor || '#2563eb';

    // Title
    doc.fontSize(24)
       .fillColor(primaryColor)
       .text('R2v3 Pre-Certification Assessment Report', 50, 150, { align: 'center' });

    // Assessment info
    doc.fontSize(16)
       .fillColor('#374151')
       .text(data.assessment.title, 50, 200, { align: 'center' });

    if (data.facility) {
      doc.fontSize(14)
         .text(`${data.facility.name} - ${data.facility.city}, ${data.facility.state}`, 50, 230, { align: 'center' });
    }

    // Date and version
    doc.fontSize(12)
       .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 280, { align: 'center' })
       .text(`Assessment ID: ${data.assessment.id}`, 50, 300, { align: 'center' });

    // Overall score badge
    const overallScore = data.complianceMetrics.overallCompliance;
    const scoreColor = overallScore >= 90 ? '#22c55e' : overallScore >= 70 ? '#f59e0b' : '#ef4444';

    doc.circle(300, 400, 60)
       .fillColor(scoreColor)
       .fill();

    doc.fontSize(24)
       .fillColor('white')
       .text(`${overallScore}%`, 300, 390, { width: 0, align: 'center' });

    doc.fontSize(12)
       .fillColor('#374151')
       .text('Overall Compliance', 300, 480, { width: 0, align: 'center' });

    // Consultant info if provided
    if (options.brandingOptions?.consultantInfo) {
      const consultant = options.brandingOptions.consultantInfo;
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text(`Prepared by: ${consultant.name}, ${consultant.title}`, 50, 700)
         .text(`${consultant.company}`, 50, 715)
         .text(`Contact: ${consultant.contact}`, 50, 730);
    }
  }

  private addPDFExecutiveSummary(doc: PDFKit.PDFDocument, data: AssessmentExportData) {
    doc.fontSize(18)
       .fillColor('#2563eb')
       .text('Executive Summary', 50, 50);

    let yPosition = 80;

    // Key findings
    doc.fontSize(12)
       .fillColor('#374151')
       .text('Key Findings:', 50, yPosition);

    yPosition += 25;

    const findings = [
      `Overall compliance score: ${data.complianceMetrics.overallCompliance}%`,
      `Core requirements compliance: ${data.complianceMetrics.coreRequirementCompliance}%`,
      `Critical gaps identified: ${data.gapAnalysis.criticalGaps.length}`,
      `Assessment readiness: ${data.readinessAssessment.readinessLevel}`,
      `Certification probability: ${Math.round(data.readinessAssessment.certificationProbability * 100)}%`
    ];

    findings.forEach(finding => {
      doc.text(`• ${finding}`, 70, yPosition);
      yPosition += 20;
    });

    yPosition += 10;

    // Recommendations summary
    doc.fontSize(12)
       .fillColor('#374151')
       .text('Key Recommendations:', 50, yPosition);

    yPosition += 25;

    data.readinessAssessment.recommendations.slice(0, 3).forEach((rec: string) => {
      doc.text(`• ${rec}`, 70, yPosition);
      yPosition += 20;
    });
  }

  private addPDFAssessmentResults(doc: PDFKit.PDFDocument, data: AssessmentExportData) {
    doc.fontSize(18)
       .fillColor('#2563eb')
       .text('Assessment Results', 50, 50);

    let yPosition = 80;

    // Category breakdown
    doc.fontSize(14)
       .fillColor('#374151')
       .text('Compliance by Category:', 50, yPosition);

    yPosition += 30;

    Object.entries(data.complianceMetrics.categoryBreakdown).forEach(([category, score]) => {
      const scoreValue = typeof score === 'number' ? score : Number(score) || 0;
      const scoreColor = scoreValue >= 90 ? '#22c55e' : scoreValue >= 70 ? '#f59e0b' : '#ef4444';

      doc.fontSize(11)
         .fillColor('#374151')
         .text(category, 50, yPosition);

      // Progress bar
      doc.rect(200, yPosition, 200, 12)
         .fillColor('#e5e7eb')
         .fill();

      doc.rect(200, yPosition, (scoreValue / 100) * 200, 12)
         .fillColor(scoreColor)
         .fill();

      doc.fillColor('#374151')
         .text(`${scoreValue}%`, 420, yPosition);

      yPosition += 25;
    });
  }

  private addPDFGapAnalysis(doc: PDFKit.PDFDocument, data: AssessmentExportData) {
    doc.fontSize(18)
       .fillColor('#2563eb')
       .text('Gap Analysis', 50, 50);

    let yPosition = 80;

    // Critical gaps
    if (data.gapAnalysis.criticalGaps.length > 0) {
      doc.fontSize(14)
         .fillColor('#dc2626')
         .text(`Critical Gaps (${data.gapAnalysis.criticalGaps.length})`, 50, yPosition);

      yPosition += 25;

      data.gapAnalysis.criticalGaps.slice(0, 5).forEach((gap: any) => {
        doc.fontSize(10)
           .fillColor('#374151')
           .text(`• ${gap.category}: ${gap.recommendation}`, 70, yPosition, {
             width: 450,
             lineGap: 5
           });
        yPosition += 30;
      });
    }

    // Major gaps
    if (data.gapAnalysis.majorGaps.length > 0) {
      yPosition += 20;

      doc.fontSize(14)
         .fillColor('#f59e0b')
         .text(`Major Gaps (${data.gapAnalysis.majorGaps.length})`, 50, yPosition);

      yPosition += 25;

      data.gapAnalysis.majorGaps.slice(0, 3).forEach((gap: any) => {
        doc.fontSize(10)
           .fillColor('#374151')
           .text(`• ${gap.category}: ${gap.recommendation}`, 70, yPosition, {
             width: 450,
             lineGap: 5
           });
        yPosition += 30;
      });
    }
  }

  private addPDFRecommendations(doc: PDFKit.PDFDocument, data: AssessmentExportData) {
    doc.fontSize(18)
       .fillColor('#2563eb')
       .text('Recommendations & Next Steps', 50, 50);

    let yPosition = 80;

    // Priority actions
    doc.fontSize(14)
       .fillColor('#374151')
       .text('Priority Actions:', 50, yPosition);

    yPosition += 25;

    data.gapAnalysis.prioritizedActions.slice(0, 5).forEach((action: any) => {
      const priorityColor = action.priority === 'HIGH' ? '#dc2626' : action.priority === 'MEDIUM' ? '#f59e0b' : '#22c55e';

      doc.fontSize(11)
         .fillColor(priorityColor)
         .text(`[${action.priority}]`, 50, yPosition);

      doc.fillColor('#374151')
         .text(action.title, 120, yPosition);

      yPosition += 15;

      doc.fontSize(9)
         .text(action.description, 120, yPosition, { width: 400 });

      yPosition += 25;
    });
  }

  private addPDFEvidenceSection(doc: PDFKit.PDFDocument, data: AssessmentExportData) {
    doc.fontSize(18)
       .fillColor('#2563eb')
       .text('Evidence Documentation', 50, 50);

    doc.fontSize(12)
       .fillColor('#374151')
       .text('Evidence requirements and documentation status for each assessment area.', 50, 80);

    // This would include evidence details - simplified for now
    doc.text('Evidence documentation section would be populated with actual evidence data.', 50, 120);
  }

  private async buildExcelSummary(worksheet: ExcelJS.Worksheet, data: AssessmentExportData, options: ExportOptions) {
    // Header
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `R2v3 Assessment Summary - ${data.assessment.title}`;
    titleCell.font = { size: 16, bold: true, color: { argb: '2563eb' } };
    titleCell.alignment = { horizontal: 'center' };

    // Key metrics
    worksheet.getCell('A3').value = 'Overall Compliance';
    worksheet.getCell('B3').value = `${data.complianceMetrics.overallCompliance}%`;
    worksheet.getCell('B3').font = { bold: true, size: 14 };

    worksheet.getCell('A4').value = 'Core Requirements';
    worksheet.getCell('B4').value = `${data.complianceMetrics.coreRequirementCompliance}%`;

    worksheet.getCell('A5').value = 'Critical Gaps';
    worksheet.getCell('B5').value = data.gapAnalysis.criticalGaps.length;
    worksheet.getCell('B5').font = { color: { argb: 'dc2626' } };

    worksheet.getCell('A6').value = 'Readiness Level';
    worksheet.getCell('B6').value = data.readinessAssessment.readinessLevel;

    // Category breakdown chart data
    let row = 8;
    worksheet.getCell(`A${row}`).value = 'Category';
    worksheet.getCell(`B${row}`).value = 'Score';
    worksheet.getCell(`C${row}`).value = 'Status';

    worksheet.getRow(row).font = { bold: true };
    row++;

    Object.entries(data.complianceMetrics.categoryBreakdown).forEach(([category, score]) => {
      const scoreValue = typeof score === 'number' ? score : Number(score) || 0;
      worksheet.getCell(`A${row}`).value = category;
      worksheet.getCell(`B${row}`).value = scoreValue;
      worksheet.getCell(`C${row}`).value = scoreValue >= 90 ? 'Excellent' : scoreValue >= 70 ? 'Good' : 'Needs Work';
      row++;
    });
  }

  private async buildExcelResults(worksheet: ExcelJS.Worksheet, data: AssessmentExportData) {
    // Headers
    const headers = ['Question ID', 'Category', 'Question Text', 'Answer', 'Score', 'Notes'];
    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };

    // Data rows
    data.answers.forEach(answer => {
      worksheet.addRow([
        answer.questionId,
        answer.categoryName || answer.category,
        answer.questionText,
        answer.value,
        answer.score || 0,
        answer.notes || ''
      ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 20;
    });
  }

  private async buildExcelGapAnalysis(worksheet: ExcelJS.Worksheet, data: AssessmentExportData) {
    // Headers
    worksheet.addRow(['Severity', 'Category', 'Current Score', 'Target Score', 'Recommendation']);
    worksheet.getRow(1).font = { bold: true };

    // Critical gaps
    data.gapAnalysis.criticalGaps.forEach((gap: any) => {
      const row = worksheet.addRow(['CRITICAL', gap.category, gap.currentScore, gap.targetScore, gap.recommendation]);
      row.getCell(1).font = { color: { argb: 'dc2626' }, bold: true };
    });

    // Major gaps
    data.gapAnalysis.majorGaps.forEach((gap: any) => {
      const row = worksheet.addRow(['MAJOR', gap.category, gap.currentScore, gap.targetScore, gap.recommendation]);
      row.getCell(1).font = { color: { argb: 'f59e0b' }, bold: true };
    });

    // Minor gaps
    data.gapAnalysis.minorGaps.forEach((gap: any) => {
      const row = worksheet.addRow(['MINOR', gap.category, gap.currentScore, gap.targetScore, gap.recommendation]);
      row.getCell(1).font = { color: { argb: '22c55e' }, bold: true };
    });
  }

  private async buildExcelActionItems(worksheet: ExcelJS.Worksheet, data: AssessmentExportData) {
    // Headers
    worksheet.addRow(['Priority', 'Title', 'Description', 'Estimated Effort', 'Expected Impact', 'Category']);
    worksheet.getRow(1).font = { bold: true };

    // Action items
    data.gapAnalysis.prioritizedActions.forEach((action: any) => {
      const row = worksheet.addRow([
        action.priority,
        action.title,
        action.description,
        action.estimatedEffort,
        action.expectedImpact,
        action.category
      ]);

      if (action.priority === 'HIGH') {
        row.getCell(1).font = { color: { argb: 'dc2626' }, bold: true };
      }
    });
  }

  private async buildWordContent(data: AssessmentExportData, options: ExportOptions): Promise<Paragraph[]> {
    const content: Paragraph[] = [];

    // Title
    content.push(
      new Paragraph({
        text: 'R2v3 Pre-Certification Assessment Report',
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 }
      })
    );

    // Assessment details
    content.push(
      new Paragraph({
        text: data.assessment.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      })
    );

    if (data.facility) {
      content.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Facility: ', bold: true }),
            new TextRun({ text: `${data.facility.name} - ${data.facility.city}, ${data.facility.state}` })
          ],
          spacing: { after: 200 }
        })
      );
    }

    // Executive summary
    content.push(
      new Paragraph({
        text: 'Executive Summary',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );

    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Overall Compliance Score: ', bold: true }),
          new TextRun({ text: `${data.complianceMetrics.overallCompliance}%` })
        ],
        spacing: { after: 100 }
      })
    );

    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Assessment Readiness: ', bold: true }),
          new TextRun({ text: data.readinessAssessment.readinessLevel })
        ],
        spacing: { after: 100 }
      })
    );

    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Critical Gaps: ', bold: true }),
          new TextRun({ text: data.gapAnalysis.criticalGaps.length.toString() })
        ],
        spacing: { after: 200 }
      })
    );

    // Recommendations
    content.push(
      new Paragraph({
        text: 'Key Recommendations',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );

    data.readinessAssessment.recommendations.forEach((rec: string) => {
      content.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ' }),
            new TextRun({ text: rec })
          ],
          spacing: { after: 100 }
        })
      );
    });

    return content;
  }
}

export { ExportService };
export default ExportService;