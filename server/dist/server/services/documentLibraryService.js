import { writeFile, readFile, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import ObservabilityService from './observabilityService';
/**
 * Professional Document Library Service
 * Manages downloadable templates, policies, and procedures for R2v3 compliance
 */
export class DocumentLibraryService {
    static TEMPLATES_DIR = path.join(process.cwd(), 'server', 'templates', 'documents');
    static CUSTOMIZED_DIR = path.join(process.cwd(), 'server', 'templates', 'customized');
    /**
     * Professional R2v3 Compliance document templates library
     */
    static templates = [
        // Group 1: Governance & Management System Documents
        {
            id: 'ehsms-manual',
            name: 'Environmental, Health & Safety Management System (EHSMS) Manual',
            category: 'policies',
            type: 'docx',
            description: 'Comprehensive EHSMS manual template aligned with R2v3 Core Requirement 3, ISO 14001/45001',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/ehsms-manual',
            requiredFields: ['organizationName', 'facilityLocation', 'ehsManager', 'operationsLead'],
            autoUpdateEnabled: true
        },
        {
            id: 'legal-compliance-register',
            name: 'Legal Compliance Register',
            category: 'procedures',
            type: 'xlsx',
            description: 'Tracks applicable environmental, health, safety, and data security laws per R2v3 Core Requirement 4',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/legal-compliance-register',
            requiredFields: ['complianceOfficer', 'jurisdiction', 'regulatoryRequirements'],
            autoUpdateEnabled: true
        },
        {
            id: 'data-sanitization-plan',
            name: 'Data Sanitization Plan',
            category: 'procedures',
            type: 'docx',
            description: 'Comprehensive data sanitization plan aligned with R2v3 Core Requirement 7, Appendix B, NIST 800-88',
            industrySpecific: ['electronics', 'it-services'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/data-sanitization-plan',
            requiredFields: ['dataProtectionRep', 'sanitizationMethods', 'verificationProcess'],
            autoUpdateEnabled: true
        },
        // Group 2: Focus Materials & Environmental Control
        {
            id: 'focus-materials-management-plan',
            name: 'Focus Materials Management Plan (FMMP)',
            category: 'procedures',
            type: 'docx',
            description: 'Procedures for safe handling of Focus Materials per R2v3 Core Requirement 8, Appendix E, G',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/focus-materials-management-plan',
            requiredFields: ['ehsOfficer', 'focusMaterials', 'downstreamVendors'],
            autoUpdateEnabled: true
        },
        {
            id: 'internal-audit-checklist',
            name: 'Internal Audit Checklist',
            category: 'checklists',
            type: 'xlsx',
            description: 'Comprehensive internal audit checklist for R2v3 Core Requirements 1-10, Appendices A-G',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/internal-audit-checklist',
            requiredFields: ['auditScope', 'auditorName', 'auditDate'],
            autoUpdateEnabled: true
        },
        {
            id: 'training-matrix',
            name: 'Training and Competency Matrix',
            category: 'training',
            type: 'xlsx',
            description: 'Staff competency tracking per R2v3 Core Requirement 3.7, 10, Appendix B',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/training-matrix',
            requiredFields: ['trainingCoordinator', 'employees', 'trainingCourses'],
            autoUpdateEnabled: true
        },
        // Group 3: Operational Control & Risk Management
        {
            id: 'facility-closure-plan',
            name: 'Facility Closure and Financial Assurance Plan',
            category: 'procedures',
            type: 'docx',
            description: 'Facility closure plan per R2v3 Core Requirement 9.3, Appendix E',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/facility-closure-plan',
            requiredFields: ['facilityManager', 'ehsOfficer', 'financeManager', 'financialAssurance'],
            autoUpdateEnabled: true
        },
        {
            id: 'downstream-vendor-qualification',
            name: 'Downstream Vendor Qualification Form',
            category: 'forms',
            type: 'xlsx',
            description: 'Vendor qualification per R2v3 Appendix A, Core Requirements 5, 8',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/downstream-vendor-qualification',
            requiredFields: ['vendorName', 'certifications', 'materialsHandled'],
            autoUpdateEnabled: true
        },
        {
            id: 'incident-response-log',
            name: 'Incident Response and Corrective Action Log',
            category: 'forms',
            type: 'xlsx',
            description: 'Incident tracking per R2v3 Core Requirement 3.4, 7.6, Appendix B',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/incident-response-log',
            requiredFields: ['incidentDate', 'incidentType', 'responsibleParty'],
            autoUpdateEnabled: true
        },
        // Group 4: Audit & Certification Management
        {
            id: 'corrective-action-request',
            name: 'Corrective Action Request (CAR)',
            category: 'forms',
            type: 'docx',
            description: 'Comprehensive CAR template for R2v3 non-conformance management per Core Requirement 3',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/corrective-action-request',
            requiredFields: ['carNumber', 'department', 'nonconformanceDescription', 'rootCause', 'correctiveActions'],
            autoUpdateEnabled: true
        },
        {
            id: 'nonconformance-report',
            name: 'Nonconformance Report (NCR) and Corrective Action Record',
            category: 'forms',
            type: 'docx',
            description: 'NCR template per R2v3 Core Requirement 3, ISO 9001:2015, ISO 14001:2015',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/nonconformance-report',
            requiredFields: ['ncrNumber', 'department', 'nonconformanceDescription'],
            autoUpdateEnabled: true
        },
        {
            id: 'brokering-policy',
            name: 'Brokering and Non-Physical Handling Policy',
            category: 'policies',
            type: 'docx',
            description: 'Brokering policy per R2v3 Appendix F, Core Requirements 4, 5, 10',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/brokering-policy',
            requiredFields: ['organizationName', 'brokeringActivities', 'downstreamPartners'],
            autoUpdateEnabled: true
        },
        {
            id: 'certification-audit-records-plan',
            name: 'Certification and Audit Records Management Plan',
            category: 'procedures',
            type: 'docx',
            description: 'Records management per R2v3 Core Requirements 1-10, SERI Code of Practices',
            industrySpecific: ['electronics', 'recycling'],
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            downloadUrl: '/api/documents/download/certification-audit-records-plan',
            requiredFields: ['complianceOfficer', 'qualityManager', 'certificationBody'],
            autoUpdateEnabled: true
        },
        // Legacy templates (keeping for backward compatibility)
        {
            id: 'environmental-policy',
            name: 'Environmental Management Policy',
            category: 'policies',
            type: 'docx',
            description: 'Basic environmental policy template',
            industrySpecific: ['electronics', 'general'],
            lastUpdated: new Date().toISOString(),
            version: '2.1',
            downloadUrl: '/api/documents/download/environmental-policy',
            requiredFields: ['organizationName', 'facilityLocation', 'certificationScope'],
            autoUpdateEnabled: true
        },
        {
            id: 'data-security-policy',
            name: 'Data Security & Sanitization Policy',
            category: 'policies',
            type: 'docx',
            description: 'Data protection and sanitization policy for R2v3 compliance',
            industrySpecific: ['electronics', 'it-services'],
            lastUpdated: new Date().toISOString(),
            version: '1.8',
            downloadUrl: '/api/documents/download/data-security-policy',
            requiredFields: ['organizationName', 'dataTypes', 'sanitizationMethods'],
            autoUpdateEnabled: true
        },
        {
            id: 'health-safety-policy',
            name: 'Occupational Health & Safety Policy',
            category: 'policies',
            type: 'docx',
            description: 'Workplace health and safety policy framework',
            industrySpecific: ['general'],
            lastUpdated: new Date().toISOString(),
            version: '2.0',
            downloadUrl: '/api/documents/download/health-safety-policy',
            requiredFields: ['organizationName', 'facilitySize', 'hazardTypes'],
            autoUpdateEnabled: true
        },
        // Procedures
        {
            id: 'incoming-material-procedure',
            name: 'Incoming Material Handling Procedure',
            category: 'procedures',
            type: 'docx',
            description: 'Step-by-step procedure for incoming electronic equipment processing',
            industrySpecific: ['electronics'],
            lastUpdated: new Date().toISOString(),
            version: '1.5',
            downloadUrl: '/api/documents/download/incoming-material-procedure',
            requiredFields: ['facilityName', 'processingSteps', 'qualityControls'],
            autoUpdateEnabled: true
        },
        {
            id: 'data-sanitization-procedure',
            name: 'Data Sanitization Standard Operating Procedure',
            category: 'procedures',
            type: 'docx',
            description: 'Detailed data sanitization procedure with verification steps',
            industrySpecific: ['electronics', 'it-services'],
            lastUpdated: new Date().toISOString(),
            version: '2.2',
            downloadUrl: '/api/documents/download/data-sanitization-procedure',
            requiredFields: ['sanitizationTools', 'verificationMethods', 'recordKeeping'],
            autoUpdateEnabled: true
        },
        {
            id: 'material-tracking-procedure',
            name: 'Material Tracking & Chain of Custody',
            category: 'procedures',
            type: 'docx',
            description: 'Chain of custody and material tracking procedures',
            lastUpdated: new Date().toISOString(),
            version: '1.7',
            downloadUrl: '/api/documents/download/material-tracking-procedure',
            requiredFields: ['trackingSystem', 'custodyProtocols', 'documentationRequirements'],
            autoUpdateEnabled: true
        },
        // Forms
        {
            id: 'incoming-material-log',
            name: 'Incoming Material Log Template',
            category: 'forms',
            type: 'xlsx',
            description: 'Excel template for tracking incoming electronic materials',
            industrySpecific: ['electronics'],
            lastUpdated: new Date().toISOString(),
            version: '1.3',
            downloadUrl: '/api/documents/download/incoming-material-log',
            requiredFields: ['facilityInfo', 'materialTypes', 'trackingFields'],
            autoUpdateEnabled: true
        },
        {
            id: 'data-sanitization-certificate',
            name: 'Data Sanitization Certificate Template',
            category: 'forms',
            type: 'docx',
            description: 'Certificate template for data sanitization completion',
            lastUpdated: new Date().toISOString(),
            version: '1.1',
            downloadUrl: '/api/documents/download/data-sanitization-certificate',
            requiredFields: ['organizationName', 'certificationDetails', 'sanitizationMethod'],
            autoUpdateEnabled: true
        },
        {
            id: 'audit-checklist',
            name: 'Internal Audit Checklist',
            category: 'forms',
            type: 'xlsx',
            description: 'Comprehensive internal audit checklist for R2v3 compliance',
            lastUpdated: new Date().toISOString(),
            version: '2.0',
            downloadUrl: '/api/documents/download/audit-checklist',
            requiredFields: ['auditScope', 'checklistItems', 'complianceRequirements'],
            autoUpdateEnabled: true
        },
        // Checklists
        {
            id: 'r2v3-compliance-checklist',
            name: 'R2v3 Master Compliance Checklist',
            category: 'checklists',
            type: 'xlsx',
            description: 'Complete R2v3 compliance checklist with all requirements',
            lastUpdated: new Date().toISOString(),
            version: '3.1',
            downloadUrl: '/api/documents/download/r2v3-compliance-checklist',
            autoUpdateEnabled: true
        },
        {
            id: 'facility-readiness-checklist',
            name: 'Facility Readiness Assessment Checklist',
            category: 'checklists',
            type: 'xlsx',
            description: 'Pre-audit facility readiness assessment checklist',
            lastUpdated: new Date().toISOString(),
            version: '1.4',
            downloadUrl: '/api/documents/download/facility-readiness-checklist',
            autoUpdateEnabled: true
        },
        // Training Materials
        {
            id: 'r2v3-training-manual',
            name: 'R2v3 Staff Training Manual',
            category: 'training',
            type: 'pdf',
            description: 'Comprehensive training manual for R2v3 compliance requirements',
            lastUpdated: new Date().toISOString(),
            version: '2.1',
            downloadUrl: '/api/documents/download/r2v3-training-manual',
            autoUpdateEnabled: true
        },
        {
            id: 'data-security-training',
            name: 'Data Security Training Presentation',
            category: 'training',
            type: 'pdf',
            description: 'Training presentation on data security and sanitization',
            lastUpdated: new Date().toISOString(),
            version: '1.6',
            downloadUrl: '/api/documents/download/data-security-training',
            autoUpdateEnabled: true
        }
    ];
    /**
     * Initialize document library directories
     */
    static async initializeLibrary() {
        try {
            if (!existsSync(this.TEMPLATES_DIR)) {
                await mkdir(this.TEMPLATES_DIR, { recursive: true });
            }
            if (!existsSync(this.CUSTOMIZED_DIR)) {
                await mkdir(this.CUSTOMIZED_DIR, { recursive: true });
            }
            // Generate template files if they don't exist
            await this.generateTemplateFiles();
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'document-library',
                operation: 'initializeLibrary',
                severity: 'high',
                metadata: {}
            });
            throw error;
        }
    }
    /**
     * Get available document templates
     */
    static async getDocumentTemplates(filters) {
        let filteredTemplates = [...this.templates];
        if (filters?.category) {
            filteredTemplates = filteredTemplates.filter(t => t.category === filters.category);
        }
        if (filters?.industrySpecific) {
            filteredTemplates = filteredTemplates.filter(t => !t.industrySpecific || t.industrySpecific.includes(filters.industrySpecific));
        }
        if (filters?.type) {
            filteredTemplates = filteredTemplates.filter(t => t.type === filters.type);
        }
        return filteredTemplates;
    }
    /**
     * Get document template by ID
     */
    static async getDocumentTemplate(templateId) {
        return this.templates.find(t => t.id === templateId) || null;
    }
    /**
     * Generate customized document from template
     */
    static async generateCustomizedDocument(templateId, customizations, userId) {
        try {
            const template = await this.getDocumentTemplate(templateId);
            if (!template) {
                return { success: false, error: 'Template not found' };
            }
            // Generate customized document
            const customizedDocument = await this.processDocumentTemplate(template, customizations);
            // Save customized document
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `${template.id}_customized_${timestamp}.${template.type}`;
            const filePath = path.join(this.CUSTOMIZED_DIR, fileName);
            await writeFile(filePath, customizedDocument);
            await ObservabilityService.log('INFO', 'Customized document generated', {
                service: 'document-library',
                operation: 'generateCustomizedDocument',
                userId,
                metadata: { templateId, fileName }
            });
            return {
                success: true,
                filePath,
                fileName
            };
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'document-library',
                operation: 'generateCustomizedDocument',
                severity: 'medium',
                metadata: { templateId, userId }
            });
            return { success: false, error: 'Document generation failed' };
        }
    }
    /**
     * Process document template with customizations
     */
    static async processDocumentTemplate(template, customizations) {
        // Get base template content
        const baseTemplate = await this.getBaseTemplate(template);
        // Apply customizations based on template type
        switch (template.type) {
            case 'docx':
                return await this.processWordTemplate(baseTemplate, customizations);
            case 'xlsx':
                return await this.processExcelTemplate(baseTemplate, customizations);
            case 'pdf':
                return await this.processPDFTemplate(baseTemplate, customizations);
            default:
                throw new Error(`Unsupported template type: ${template.type}`);
        }
    }
    /**
     * Get base template content
     */
    static async getBaseTemplate(template) {
        const templatePath = path.join(this.TEMPLATES_DIR, `${template.id}.${template.type}`);
        try {
            await access(templatePath);
            return await readFile(templatePath);
        }
        catch {
            // Generate template if it doesn't exist
            return await this.generateBaseTemplate(template);
        }
    }
    /**
     * Generate base template files
     */
    static async generateTemplateFiles() {
        for (const template of this.templates) {
            const templatePath = path.join(this.TEMPLATES_DIR, `${template.id}.${template.type}`);
            if (!existsSync(templatePath)) {
                const content = await this.generateBaseTemplate(template);
                await writeFile(templatePath, content);
            }
        }
    }
    /**
     * Generate base template content
     */
    static async generateBaseTemplate(template) {
        // Generate template content based on type and template ID
        const content = this.createTemplateContent(template);
        return Buffer.from(content, 'utf8');
    }
    /**
     * Create template content
     */
    static createTemplateContent(template) {
        switch (template.id) {
            // Group 1: Governance & Management System Documents
            case 'ehsms-manual':
                return this.generateEHSMSManualTemplate();
            case 'legal-compliance-register':
                return this.generateLegalComplianceRegisterTemplate();
            case 'data-sanitization-plan':
                return this.generateDataSanitizationPlanTemplate();
            // Group 2: Focus Materials & Environmental Control
            case 'focus-materials-management-plan':
                return this.generateFocusMaterialsManagementPlanTemplate();
            case 'internal-audit-checklist':
                return this.generateInternalAuditChecklistTemplate();
            case 'training-matrix':
                return this.generateTrainingMatrixTemplate();
            // Group 3: Operational Control & Risk Management
            case 'facility-closure-plan':
                return this.generateFacilityClosurePlanTemplate();
            case 'downstream-vendor-qualification':
                return this.generateDownstreamVendorQualificationTemplate();
            case 'incident-response-log':
                return this.generateIncidentResponseLogTemplate();
            // Group 4: Audit & Certification Management
            case 'corrective-action-request':
                return this.generateCorrectiveActionRequestTemplate();
            case 'nonconformance-report':
                return this.generateNonconformanceReportTemplate();
            case 'brokering-policy':
                return this.generateBrokeringPolicyTemplate();
            case 'certification-audit-records-plan':
                return this.generateCertificationAuditRecordsPlanTemplate();
            // Legacy templates
            case 'environmental-policy':
                return this.generateEnvironmentalPolicyTemplate();
            case 'data-security-policy':
                return this.generateDataSecurityPolicyTemplate();
            case 'health-safety-policy':
                return this.generateHealthSafetyPolicyTemplate();
            case 'incoming-material-procedure':
                return this.generateIncomingMaterialProcedureTemplate();
            case 'data-sanitization-procedure':
                return this.generateDataSanitizationProcedureTemplate();
            case 'material-tracking-procedure':
                return this.generateMaterialTrackingProcedureTemplate();
            default:
                return this.generateGenericTemplate(template);
        }
    }
    /**
     * Template content generators
     */
    static generateEnvironmentalPolicyTemplate() {
        return `
ENVIRONMENTAL MANAGEMENT POLICY
{{organizationName}}

1. POLICY STATEMENT
{{organizationName}} is committed to environmental stewardship and sustainable electronics recycling practices in accordance with R2v3 standards.

2. SCOPE
This policy applies to all {{facilityLocation}} operations involving {{certificationScope}}.

3. ENVIRONMENTAL COMMITMENTS
- Minimize environmental impact of all operations
- Comply with applicable environmental regulations
- Implement pollution prevention measures
- Promote resource conservation and waste minimization
- Ensure proper management of hazardous materials

4. RESPONSIBILITIES
[Management responsibilities and organizational structure]

5. IMPLEMENTATION
[Implementation procedures and monitoring]

6. REVIEW AND IMPROVEMENT
This policy is reviewed annually and updated as necessary.

Document Version: 2.1
Effective Date: {{currentDate}}
Next Review Date: {{nextReviewDate}}
    `.trim();
    }
    static generateDataSecurityPolicyTemplate() {
        return `
DATA SECURITY AND SANITIZATION POLICY
{{organizationName}}

1. PURPOSE
This policy establishes requirements for data security and sanitization to protect customer information and comply with R2v3 standards.

2. SCOPE
Applies to all {{dataTypes}} processed at {{facilityLocation}}.

3. DATA SECURITY REQUIREMENTS
- Secure data handling procedures
- Access controls and authorization
- Physical security measures
- Data breach response procedures

4. SANITIZATION REQUIREMENTS
- Approved sanitization methods: {{sanitizationMethods}}
- Verification procedures
- Certificate of data destruction
- Record keeping requirements

5. COMPLIANCE MONITORING
[Monitoring and audit procedures]

Document Version: 1.8
Effective Date: {{currentDate}}
    `.trim();
    }
    static generateHealthSafetyPolicyTemplate() {
        return `
OCCUPATIONAL HEALTH AND SAFETY POLICY
{{organizationName}}

1. COMMITMENT
{{organizationName}} is committed to providing a safe and healthy workplace for all employees at our {{facilitySize}} facility.

2. SCOPE
This policy covers all {{hazardTypes}} and workplace safety considerations.

3. SAFETY REQUIREMENTS
- Hazard identification and risk assessment
- Personal protective equipment requirements
- Emergency response procedures
- Incident reporting and investigation
- Training and competency requirements

4. IMPLEMENTATION
[Safety management system implementation]

Document Version: 2.0
Effective Date: {{currentDate}}
    `.trim();
    }
    static generateIncomingMaterialProcedureTemplate() {
        return `
INCOMING MATERIAL HANDLING PROCEDURE
{{facilityName}}

1. PURPOSE
Establish standardized procedures for receiving and processing incoming electronic materials.

2. PROCESSING STEPS
{{processingSteps}}

3. QUALITY CONTROLS
{{qualityControls}}

4. DOCUMENTATION REQUIREMENTS
- Material intake forms
- Chain of custody records
- Quality inspection checklists

5. ROLES AND RESPONSIBILITIES
[Staff responsibilities and authorization levels]

Document Version: 1.5
Effective Date: {{currentDate}}
    `.trim();
    }
    static generateDataSanitizationProcedureTemplate() {
        return `
DATA SANITIZATION STANDARD OPERATING PROCEDURE
{{facilityName}}

1. OVERVIEW
This procedure ensures complete and verifiable data sanitization in accordance with R2v3 requirements.

2. SANITIZATION TOOLS
{{sanitizationTools}}

3. VERIFICATION METHODS
{{verificationMethods}}

4. RECORD KEEPING
{{recordKeeping}}

5. QUALITY ASSURANCE
- Pre-sanitization testing
- Post-sanitization verification
- Certificate generation
- Archive procedures

Document Version: 2.2
Effective Date: {{currentDate}}
    `.trim();
    }
    static generateMaterialTrackingProcedureTemplate() {
        return `
MATERIAL TRACKING AND CHAIN OF CUSTODY PROCEDURE
{{facilityName}}

1. TRACKING SYSTEM
{{trackingSystem}}

2. CUSTODY PROTOCOLS
{{custodyProtocols}}

3. DOCUMENTATION REQUIREMENTS
{{documentationRequirements}}

4. AUDIT TRAIL
- Material receipt documentation
- Processing records
- Disposition tracking
- Customer reporting

Document Version: 1.7
Effective Date: {{currentDate}}
    `.trim();
    }
    /**
     * R2v3 Compliance Template Generators
     */
    // Group 1: Governance & Management System Documents
    static generateEHSMSManualTemplate() {
        return `
# ENVIRONMENTAL, HEALTH & SAFETY MANAGEMENT SYSTEM MANUAL

**Document ID:** EHSMS-001  
**Facility:** {{organizationName}}  
**Revision:** 1.0  
**Date:** {{currentDate}}  
**Standard Reference:** R2v3 Core Requirement 3; ISO 14001/45001

---

## 1. PURPOSE

This manual defines how {{organizationName}} manages environmental, health, and safety aspects while ensuring full integration with R2v3 requirements.

---

## 2. SCOPE

**Facility Location(s):** {{facilityLocation}}

**Covered Activities:**
- [ ] Collection and Transportation
- [ ] Sorting and Categorization
- [ ] Testing and Repair
- [ ] Data Sanitization
- [ ] Dismantling and Processing
- [ ] Materials Recovery
- [ ] Brokering
- [ ] Downstream Vendor Management

**Applicable Appendices:**
- [ ] Appendix A: Downstream Recycling Chain
- [ ] Appendix B: Data Sanitization
- [ ] Appendix C: Test and Repair
- [ ] Appendix D: Specialty Electronics
- [ ] Appendix E: Materials Recovery
- [ ] Appendix F: Brokering
- [ ] Appendix G: Solar Panels

---

## 3. POLICY STATEMENT

{{organizationName}} commits to:
- Compliance with all legal, regulatory, and R2v3 requirements
- Prevention of pollution, injury, and occupational illness
- Protection of data security and customer confidentiality
- Responsible management of focus materials
- Continuous improvement of EHS performance
- Worker involvement and consultation

**Signed:** _________________ **Date:** {{currentDate}}  
**Name/Title:** {{ehsManager}}

---

## 4. ORGANIZATIONAL ROLES AND RESPONSIBILITIES

| Role | Name | Responsibilities |
|------|------|------------------|
| EHS Manager | {{ehsManager}} | Maintain EHSMS documentation, conduct audits, manage compliance |
| Compliance Officer | {{complianceOfficer}} | Legal register, permits, regulatory reporting |
| Operations Manager | {{operationsLead}} | Implement safety procedures, oversee processing |
| Data Protection Rep | {{dataProtectionRep}} | Data security oversight, sanitization verification |
| Quality Manager | {{qualityManager}} | Internal audits, corrective actions, training coordination |
| All Employees | All Staff | Follow EHS procedures, report hazards and incidents |

---

## 5. RISK ASSESSMENT AND CONTROL

**Hazard Identification Process:**
- Annual comprehensive risk assessments
- Job hazard analyses for new processes
- Incident investigation and analysis
- Worker participation in hazard identification

**Risk Controls (Hierarchy):**
1. Elimination
2. Substitution
3. Engineering controls
4. Administrative controls
5. Personal protective equipment (PPE)

**Risk Assessment Records:** Maintained by {{ehsManager}} for minimum 3 years

---

## 6. LEGAL AND REGULATORY COMPLIANCE

**Legal Compliance Register:** Document ID LCR-001  
**Responsible:** {{complianceOfficer}}  
**Review Frequency:** Quarterly

**Key Regulations:**
- [ ] EPA/State hazardous waste regulations
- [ ] DOT transportation requirements
- [ ] OSHA workplace safety standards
- [ ] Data privacy laws (GDPR, CCPA, HIPAA as applicable)
- [ ] Export/import controls
- [ ] State electronics recycling laws

**Permits and Licenses:**
- [List required permits]
- Renewal tracking maintained in Legal Compliance Register

---

## 7. TRAINING AND COMPETENCY

**Training Requirements:**
- New employee orientation: EHS, R2v3 overview, data security
- Role-specific technical training
- Annual refresher training
- Specialized training for focus materials handling

**Training Matrix:** Document ID TRN-001  
**Records Retention:** Minimum 3 years  
**Responsible:** {{qualityManager}}

---

## 8. OPERATIONAL CONTROLS

### 8.1 Standard Operating Procedures (SOPs)
All operations documented in SOPs including:
- Receiving and inspection
- Sorting and categorization
- Data sanitization
- Testing and repair
- Focus materials handling
- Storage and inventory management
- Shipping and transportation

### 8.2 Focus Materials Management
**Focus Materials Management Plan:** Document ID FMMP-001

**Controlled Materials:**
- Mercury-containing devices
- Batteries (all chemistries)
- CRT and flat panel displays
- PCB-containing components
- Circuit boards
- Refrigerants
- Solar panels (if applicable)

**Storage Requirements:**
- Segregated by material type
- Clearly labeled
- Weather-protected
- Secondary containment where required
- Secured against unauthorized access

### 8.3 Data Security
**Data Sanitization Plan:** Document ID DSP-001

**Controls:**
- Restricted access to data processing areas
- Sanitization methods per NIST 800-88
- Verification sampling and documentation
- Chain of custody procedures
- Incident response protocols

---

## 9. EMERGENCY PREPAREDNESS AND RESPONSE

**Emergency Response Plan:** Document ID ERP-001

**Covered Scenarios:**
- Fire
- Chemical spill
- Injury/medical emergency
- Data breach
- Natural disaster

**Emergency Equipment:**
- Fire extinguishers (inspected monthly)
- Spill containment kits
- First aid stations
- Emergency eyewash/shower (where required)
- Emergency exits clearly marked

**Drills:** Conducted annually, documented in training records

---

## 10. INCIDENT REPORTING AND INVESTIGATION

**Incident Response Log:** Document ID IRL-001

**Reporting Requirements:**
- All incidents reported within 24 hours to {{ehsManager}}
- Root cause analysis completed within 5 business days
- Corrective actions documented in CAR system
- Regulatory notifications as required

**Incident Categories:**
- Environmental (spills, releases)
- Occupational health and safety (injuries, near misses)
- Data security (breaches, unauthorized access)
- Regulatory non-compliance

---

## 11. PERFORMANCE MONITORING

**Key Performance Indicators:**
- Recordable injury rate
- Environmental incidents
- Data security incidents
- Legal compliance rate
- Training completion rate
- Audit findings closure rate

**Monitoring Frequency:** Monthly reporting to management

---

## 12. INTERNAL AUDITS

**Audit Schedule:** Annual comprehensive audit, plus process-specific audits

**Internal Audit Checklist:** Document ID IAC-001  
**Audit Reports:** Retained minimum 3 years

**Audit Process:**
1. Planning and scope definition
2. Document review
3. Interviews and observations
4. Findings classification (conformity, minor NC, major NC)
5. Corrective action requests issued
6. Follow-up verification

---

## 13. MANAGEMENT REVIEW

**Frequency:** Annually minimum, or when significant changes occur

**Review Inputs:**
- Audit results
- Incident trends
- Performance metrics
- Legal compliance status
- Changes to R2v3 standard
- Customer feedback
- Resource needs

**Review Outputs:**
- Action items for improvement
- Resource allocation decisions
- Policy or objective updates

**Management Review Records:** Document ID MGR-001

---

## 14. CONTINUOUS IMPROVEMENT

**Corrective Action Process:**
- Non-conformances identified through audits, incidents, or operations
- Root cause analysis required for all major findings
- Corrective actions implemented and verified
- Effectiveness review conducted

**Corrective Action Log:** Document ID CAR-001

---

## 15. DOCUMENT CONTROL

**Document Revision History:**

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | {{currentDate}} | Initial issue | {{ehsManager}} |
|  |  |  |  |

**Related Documents:**
- Legal Compliance Register (LCR-001)
- Focus Materials Management Plan (FMMP-001)
- Data Sanitization Plan (DSP-001)
- Training Matrix (TRN-001)
- Internal Audit Checklist (IAC-001)
- Corrective Action Log (CAR-001)

**Review Schedule:** Annually or upon significant operational changes

---

**Document Owner:** {{ehsManager}}  
**Next Review Date:** {{nextReviewDate}}
    `.trim();
    }
    static generateLegalComplianceRegisterTemplate() {
        return `
LEGAL COMPLIANCE REGISTER
{{organizationName}}

Standard Reference: R2v3 Core Requirement 4

1. PURPOSE
To identify, maintain, and demonstrate compliance with all applicable environmental, health, safety, and data security laws affecting {{organizationName}} operations.

2. STRUCTURE
| Regulation / Requirement | Applicable Jurisdiction | Description | Responsible Department | Frequency of Review | Compliance Status | Evidence Reference |
|---------------------------|-------------------------|-------------|------------------------|---------------------|-------------------|-------------------|
| EPA Hazardous Waste Permit | {{jurisdiction}} | Regulates storage of hazardous e-waste | {{complianceOfficer}} | Annual | ✅ Compliant | Permit No. {{permitNumber}} |
| State Data Protection Law | {{jurisdiction}} | Governs handling of customer data | IT Security | Annual | ⚠ Partial | Policy DS-01 |
| OSHA Safety Standards | Federal | Workplace safety requirements | EHS | Quarterly | ✅ Compliant | Safety Manual v2.0 |

3. REVIEW PROCEDURE
- {{complianceOfficer}} updates register quarterly
- Legal changes reviewed annually or as required
- Any non-compliance triggers a Corrective Action Report

4. RECORDS RETENTION
Maintain all permits, licenses, and proof of submission for minimum 3 years.

Document ID: LCR-001
Version: 1.0
Effective Date: {{currentDate}}
    `.trim();
    }
    static generateDataSanitizationPlanTemplate() {
        return `
DATA SANITIZATION PLAN
{{organizationName}}

Standard Reference: R2v3 Core Requirement 7; Appendix B; NIST 800-88

1. PURPOSE
To ensure all data-bearing devices are securely sanitized or destroyed before reuse or recycling at {{organizationName}}.

2. SCOPE
Applies to all incoming, stored, and processed data-bearing equipment including hard drives, SSDs, mobile devices, and network equipment.

3. RESPONSIBILITIES
| Role | Responsibility |
|------|----------------|
| {{dataProtectionRep}} | Oversee data sanitization process and verification |
| Technicians | Execute approved sanitization methods |
| Quality Assurance | Validate and record completion logs |

4. SANITIZATION METHODS
| Device Type | Method | Verification Process | Reference Standard |
|-------------|--------|---------------------|-------------------|
| HDD | {{sanitizationMethods}} | 5% sampling verified via recovery software | NIST 800-88 |
| SSD | Physical shredding | 100% verification by visual inspection | NSA EPL listed shredder |
| Mobile Devices | Factory reset + overwrite | {{verificationProcess}} | NIST 800-88 |

5. DATA SECURITY CONTROLS
- Restricted access to data processing area
- CCTV recording (minimum 60 days retention)
- Dual-authorization for device release post-sanitization

6. DOCUMENTATION AND RECORDS
| Record Type | Retention | Responsible Person |
|-------------|-----------|-------------------|
| Sanitization Logs | 3 years | {{dataProtectionRep}} |
| Verification Reports | 3 years | QA |
| Incident Reports | 5 years | Compliance Officer |

7. INCIDENT RESPONSE
Any suspected data breach must be reported within 24 hours to {{dataProtectionRep}}.

Document ID: DSP-001
Version: 1.0
Effective Date: {{currentDate}}
    `.trim();
    }
    // Group 2: Focus Materials & Environmental Control
    static generateFocusMaterialsManagementPlanTemplate() {
        return `
# FOCUS MATERIALS MANAGEMENT PLAN

**Document ID:** FMMP-001  
**Facility:** {{organizationName}}  
**Revision:** 1.0  
**Date:** {{currentDate}}  
**Standard Reference:** R2v3 Core Requirement 8; Appendix E; Appendix G

---

## PURPOSE

To define procedures for safe handling, storage, and downstream management of Focus Materials (FMs) ensuring environmental protection and regulatory compliance.

---

## SCOPE

All operations involving Focus Materials:
- Mercury-containing devices
- Batteries (all chemistries)
- CRT glass
- Flat panel displays (LCD, LED)
- PCB-containing components
- Circuit boards
- Refrigerants
- Solar photovoltaic modules (if applicable)

---

## RESPONSIBILITIES

| Role | Responsibility |
|------|----------------|
| EHS Officer | {{ehsOfficer}} - FM program oversight, compliance, training |
| FM Handlers | {{fmHandlers}} - Daily handling, storage, documentation |
| Compliance Officer | {{complianceOfficer}} - Downstream vendor management, audits |
| Operations Manager | {{operationsLead}} - Resource allocation, facility improvements |

---

## FOCUS MATERIALS IDENTIFICATION

### Mercury-Containing Devices

**Sources:**
- Thermostats
- Switches and relays
- Fluorescent lamps and backlights
- Tilt switches

**Identification:** Visual inspection, product labels, component knowledge

**Estimated Volume:** {{mercuryVolume}} units/month

**Handling Requirements:**
- PPE: Nitrile gloves, safety glasses
- No crushing or breaking
- Double-bag if broken
- Label: "Mercury - Universal Waste"

**Storage:**
- Covered containers
- Separated from other materials
- Spill kit nearby
- Maximum storage: 1 year

**Downstream Vendor:** {{mercuryVendor}}, R2 Cert: {{mercuryVendorCert}}

---

### Batteries

**Types Handled:**

| Battery Type | Sources | Volume | Special Handling |
|--------------|---------|--------|------------------|
| Lithium-ion | Laptops, tablets, power tools | {{lithiumVolume}} kg/month | Fire risk - separate damaged batteries |
| Nickel-Cadmium | Power tools, emergency lighting | {{nicadVolume}} kg/month | Hazardous waste classification |
| Nickel-Metal Hydride | Older electronics | {{nimhVolume}} kg/month | Standard precautions |
| Lead-Acid | UPS systems, vehicles | {{leadAcidVolume}} units/month | Acid spill containment |
| Alkaline | Consumer electronics | {{alkalineVolume}} kg/month | Non-hazardous in many states |

**Handling Requirements:**
- PPE: Chemical-resistant gloves, safety glasses, apron (for lead-acid)
- Sort by chemistry
- Terminal protection (tape or caps)
- No crushing or incineration
- Damaged batteries in fireproof containers with vermiculite/sand

**Storage:**
- Segregated by type
- Fireproof cabinets or containers for lithium-ion
- Ventilated area
- Secondary containment for lead-acid
- Maximum storage: {{batteryStorageTime}} months

**Downstream Vendors:**
- {{lithiumVendor}} - Lithium-ion, R2 Cert: {{lithiumVendorCert}}
- {{leadAcidVendor}} - Lead-acid, R2 Cert: {{leadAcidVendorCert}}
- {{otherBatteryVendor}} - Other chemistries, R2 Cert: {{otherBatteryVendorCert}}

---

### CRT Glass

**Sources:**
- Computer monitors
- Televisions
- Oscilloscopes

**Estimated Volume:** {{crtVolume}} units/month

**Handling Requirements:**
- PPE: Cut-resistant gloves, safety glasses, long sleeves
- No breaking - keep intact when possible
- If broken: contain glass, minimize dust
- Label: "CRT Glass - Lead-Bearing Material"

**Storage:**
- Intact units: palletized, stretch-wrapped
- Broken glass: sealed drums or super sacks
- Weather-protected
- Marked storage area
- Maximum storage: {{crtStorageTime}} months

**Downstream Vendor:** {{crtVendor}}, R2 Cert: {{crtVendorCert}}  
**Final Disposition:** {{crtFinalDisposition}}

---

### Flat Panel Displays

**Sources:**
- LCD monitors and TVs
- LED displays
- Laptop screens

**Estimated Volume:** {{lcdVolume}} units/month

**Handling Requirements:**
- PPE: Cut-resistant gloves, safety glasses
- Mercury lamps (CCFL backlights): handle as mercury waste
- Intact preferred
- Label if contains mercury lamps

**Storage:**
- Segregate mercury-lamp containing units
- Protect from breakage
- Weather-protected

**Downstream Vendor:** {{lcdVendor}}, R2 Cert: {{lcdVendorCert}}

---

### Circuit Boards

**Sources:** All electronic equipment

**Estimated Volume:** {{circuitBoardVolume}} kg/month

**Handling Requirements:**
- PPE: Cut-resistant gloves (sharp edges)
- Minimize dust generation
- Separate by grade if applicable

**Storage:**
- Gaylord boxes or super sacks
- Weather-protected
- Labeled by grade

**Downstream Vendor:** {{circuitBoardVendor}}, R2 Cert: {{circuitBoardVendorCert}}  
**Final Disposition:** {{circuitBoardFinalDisposition}}

---

## STORAGE REQUIREMENTS

### General Storage Standards

**All Focus Materials:**
- Clearly labeled with material type and hazard information
- Segregated from non-FM materials
- Accessible to authorized personnel only
- Inspected weekly for leaks, damage, or deterioration
- Inventory tracked in Material Tracking Log (MTL-001)

**Weather Protection:**
- Indoor storage preferred
- If outdoor: covered, waterproof containers
- Secondary containment for liquids

**Security:**
- Fenced or locked storage areas
- Access controlled
- Surveillance cameras: {{surveillanceEnabled}}

**Fire Protection:**
- Fire extinguishers within 50 feet
- Lithium batteries in fireproof cabinets
- No ignition sources near flammable materials
- Emergency response plan posted

**Spill Response:**
- Spill kits located at: {{spillKitLocations}}
- Contents: Absorbent, gloves, goggles, waste bags, neutralizer
- Spill response training required for all FM handlers

---

## DOWNSTREAM VENDOR MANAGEMENT

### Vendor Qualification (Appendix A)

All downstream vendors for Focus Materials must:
- Hold current R2 or e-Stewards certification
- Provide copy of certificate annually
- Sign contract specifying FM handling requirements
- Submit to due diligence questionnaire
- Accept audit rights

**Vendor Qualification Records:** Document ID DVQ-001

### Vendor Audit Schedule

| Vendor | FM Type Handled | Last Audit | Next Audit | Audit Type |
|--------|-----------------|------------|------------|------------|
| {{vendorA}} | Batteries | {{vendorAAuditDate}} | {{vendorANextAudit}} | On-site/Document |
| {{vendorB}} | CRT Glass | {{vendorBAuditDate}} | {{vendorBNextAudit}} | On-site/Document |
| {{vendorC}} | Circuit Boards | {{vendorCAuditDate}} | {{vendorCNextAudit}} | On-site/Document |

**Frequency:** Annually minimum or per risk assessment

---

## TRAINING REQUIREMENTS

All personnel handling Focus Materials must complete:

**Initial Training:**
- FM identification and classification
- Health and safety hazards
- Proper handling and storage procedures
- PPE requirements
- Spill response
- Emergency procedures

**Refresher Training:** Annual minimum

**Training Records:** Document ID TRN-001, retained 3 years

---

## EMERGENCY RESPONSE

### Emergency Scenarios

**Mercury Spill:**
1. Evacuate area
2. Restrict access
3. Contact EHS Officer
4. Use mercury spill kit
5. Dispose as hazardous waste
6. Document incident

**Battery Fire:**
1. Evacuate area
2. Call 911
3. Do not use water on lithium fires
4. Use Class D extinguisher or sand
5. Ventilate area
6. Document incident

**Emergency Contacts:**
- EHS Officer: {{ehsOfficerPhone}}
- Facility Manager: {{facilityManagerPhone}}
- Emergency Services: 911
- Poison Control: 1-800-222-1222

---

## PERFORMANCE MONITORING

### Key Performance Indicators

| Metric | Target | Current | Measurement |
|--------|--------|---------|-------------|
| FM incidents | 0 | 0 | Monthly |
| Storage duration compliance | 100% | 98% | Weekly |
| Downstream vendor compliance | 100% | 100% | Quarterly |
| Training completion | 100% | 95% | Quarterly |

**Reporting:** Monthly to management and EHS committee

---

## DOCUMENT REVISION HISTORY

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | {{currentDate}} | Initial issue | {{ehsOfficer}} |
|  |  |  |  |

---

**Document Owner:** {{ehsOfficer}}  
**Next Review Date:** {{nextReviewDate}}
    `.trim();
    }
    static generateInternalAuditChecklistTemplate() {
        return `
# INTERNAL AUDIT CHECKLIST

**Document ID:** IAC-001  
**Facility:** {{organizationName}}  
**Audit Date:** {{auditDate}}  
**Auditor(s):** {{auditorName}}  
**Standard:** R2v3 Core Requirements + Appendices {{applicableAppendices}}

---

## AUDIT SCOPE

**Area/Process:** {{auditScope}}  
**Previous Audit Date:** {{previousAuditDate}}  
**Open CARs from Previous Audit:** {{openCars}}

---

## LEGEND

- ✅ **C** = Conformity
- ⚠️ **Minor** = Minor Non-Conformance
- ❌ **Major** = Major Non-Conformance
- 📝 **OBS** = Observation
- **N/A** = Not Applicable

---

## CORE REQUIREMENT 1: SCOPE

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 1.1 | R2 certificate displayed and current | Certificate, expiry date | | |
| 1.2 | Scope statement accurate and complete | Scope document matches operations | | |
| 1.3 | All applicable appendices identified | Operations vs appendix requirements | | |

---

## CORE REQUIREMENT 2: LEGAL COMPLIANCE

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 2.1 | Legal register current (within 90 days) | Legal Compliance Register (LCR-001) | | |
| 2.2 | All permits and licenses valid | Permit files, expiration dates | | |
| 2.3 | Compliance evaluation documented | Compliance audit records | | |
| 2.4 | Access to current regulations | Subscription service or manual tracking | | |
| 2.5 | Training on applicable regulations | Training records | | |

---

## CORE REQUIREMENT 3: EHSMS

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 3.1 | EHSMS manual current and implemented | EHSMS-001 review | | |
| 3.2 | Policy statement signed and communicated | Posted policy, training records | | |
| 3.3 | Objectives established and monitored | Management review records | | |
| 3.4 | Risk assessment current | Hazard assessments, job safety analyses | | |
| 3.5 | Emergency procedures documented | Emergency Response Plan | | |
| 3.6 | Emergency drills conducted | Drill records | | |
| 3.7 | PPE requirements defined | PPE assessments, inventory | | |
| 3.8 | Internal audits conducted | Previous audit reports | | |
| 3.9 | Management review conducted | Management review records | | |

---

## CORE REQUIREMENT 4: MATERIAL TRACKING

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 4.1 | All materials tracked from receipt | Material Tracking Log (MTL-001) | | |
| 4.2 | Material IDs assigned | Tracking system review | | |
| 4.3 | Tracking system accurate | Sample material trace | | |
| 4.4 | Chain of custody maintained | Shipping/receiving documents | | |
| 4.5 | Inventory counts current | Physical vs system inventory | | |

---

## CORE REQUIREMENT 5: PROCESSING PROCEDURES

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 5.1 | SOPs documented for all processes | SOP library review | | |
| 5.2 | Personnel trained on procedures | Training matrix (TRN-001) | | |
| 5.3 | Equipment maintained | Maintenance logs | | |
| 5.4 | Processing records complete | Sample work orders/batch records | | |
| 5.5 | Quality controls in place | Inspection records | | |

---

## CORE REQUIREMENT 6: REUSE HIERARCHY

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 6.1 | Hierarchy decision framework documented | Hierarchy procedure/policy | | |
| 6.2 | Reuse opportunities evaluated | Reuse assessment records | | |
| 6.3 | Hierarchy decisions documented | Material disposition records | | |
| 6.4 | Downstream paths appropriate | Vendor qualification, contracts | | |

---

## CORE REQUIREMENT 7: DATA SECURITY

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 7.1 | Data security policy current | Data Sanitization Plan (DSP-001) | | |
| 7.2 | Risk assessment for data devices | Risk classification procedures | | |
| 7.3 | Sanitization procedures documented | Methods aligned with NIST 800-88 | | |
| 7.4 | Access controls implemented | Authorization list, access logs | | |
| 7.5 | Sanitization records complete | Data Destruction Log (DDL-001) | | |
| 7.6 | Verification conducted | Verification sampling records | | |
| 7.7 | Certificates issued | Sample certificates | | |
| 7.8 | Incident response plan documented | Incident procedures | | |

---

## CORE REQUIREMENT 8: FOCUS MATERIALS

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 8.1 | Focus Materials Management Plan current | FMMP-001 review | | |
| 8.2 | FM identification procedures | Visual inspection of operations | | |
| 8.3 | Storage segregated and labeled | Physical storage area inspection | | |
| 8.4 | Handling procedures followed | Observe handlers, check PPE | | |
| 8.5 | Tracking logs maintained | FM tracking records | | |
| 8.6 | Downstream flowcharts current | Flowchart review | | |
| 8.7 | Spill response equipment available | Inspection of spill kits | | |

---

## CORE REQUIREMENT 9: TRANSPORTATION

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 9.1 | DOT compliance for hazmat | Training records, shipping papers | | |
| 9.2 | Packaging appropriate | Visual inspection | | |
| 9.3 | Shipping documentation complete | Bills of lading, manifests | | |
| 9.4 | Driver training current | Training certificates | | |
| 9.5 | Vehicle inspections conducted | Vehicle maintenance logs | | |

---

## CORE REQUIREMENT 10: DOWNSTREAM VENDORS

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| 10.1 | All vendors qualified | Vendor Qualification (DVQ-001) | | |
| 10.2 | Vendor certifications current | R2/e-Stewards certificates | | |
| 10.3 | Contracts contain required elements | Sample contracts | | |
| 10.4 | Audits conducted per schedule | Vendor audit reports | | |
| 10.5 | Performance monitored | Vendor performance records | | |
| 10.6 | Non-conformances addressed | Corrective action records | | |

---

## APPENDIX A: DOWNSTREAM RECYCLING CHAIN

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| A.1 | Due diligence process documented | Vendor qualification procedures | | |
| A.2 | Vendor questionnaires completed | Vendor files | | |
| A.3 | On-site audits conducted | Audit reports with photos/evidence | | |
| A.4 | Insurance verification | Insurance certificates | | |
| A.5 | Material tracking through chain | Chain of custody to final disposition | | |

---

## APPENDIX B: DATA SANITIZATION

| # | Requirement | Evidence Reviewed | Status | Notes |
|---|-------------|-------------------|--------|-------|
| B.1 | Methods align with NIST 800-88 | Sanitization procedures | | |
| B.2 | Logical sanitization performed correctly | Software reports, completion logs | | |
| B.3 | Physical destruction adequate | Destruction equipment, particle size | | |
| B.4 | Verification sampling conducted | Verification records at 5% minimum | | |
| B.5 | Chain of custody maintained | Device tracking from receipt to completion | | |

---

## FINDINGS SUMMARY

**Total Items Audited:** {{totalItemsAudited}}  
**Conformities:** {{conformities}}  
**Minor Non-Conformances:** {{minorNCs}}  
**Major Non-Conformances:** {{majorNCs}}  
**Observations:** {{observations}}

---

## NON-CONFORMANCES AND OBSERVATIONS

| Finding # | Type | Requirement | Description | Evidence | CAR # |
|-----------|------|-------------|-------------|----------|-------|
| 1 | {{findingType1}} | {{requirement1}} | {{description1}} | {{evidence1}} | {{carNumber1}} |
| 2 | {{findingType2}} | {{requirement2}} | {{description2}} | {{evidence2}} | {{carNumber2}} |

---

## POSITIVE FINDINGS

{{positiveFindings}}

---

## RECOMMENDATIONS

{{recommendations}}

---

## CLOSING MEETING

**Date:** {{closingDate}}  
**Attendees:** {{attendees}}  
**Summary Presented:** [ ] Yes [ ] No  
**Questions/Comments:** {{comments}}

---

## SIGNATURES

**Auditor:** _________________________ **Date:** {{auditDate}}

**Auditee (Area Manager):** _________________________ **Date:** {{auditDate}}

**Quality Manager:** _________________________ **Date:** {{auditDate}}

---

## FOLLOW-UP

**CAR Issuance Date:** {{carIssuanceDate}}  
**Response Due Date:** {{responseDueDate}}  
**Follow-up Audit Scheduled:** {{followupAuditDate}}

---

**Document Owner:** {{qualityManager}}  
**Retention:** 3 years minimum
    `.trim();
    }
    static generateTrainingMatrixTemplate() {
        return `
# TRAINING MATRIX

**Document ID:** TRN-001  
**Facility:** {{organizationName}}  
**Revision:** 1.0  
**Date:** {{currentDate}}  
**Standard Reference:** R2v3 Core Requirement 3.7; Core Requirement 10; Appendix B

---

## PURPOSE

To track and maintain staff competency and training relevant to R2v3 management system requirements.

---

## TRAINING RECORDS

| Employee Name | Position | Department | Hire Date | Training Course | Training Type | Date Completed | Renewal Due | Score/Pass | Trainer | Verified By |
|---------------|----------|------------|-----------|-----------------|---------------|----------------|-------------|------------|---------|-------------|
| {{employeeName1}} | Technician | Data Security | {{hireDate1}} | R2v3 Overview | Compliance | {{currentDate}} | {{renewalDate}} | Pass | {{trainer1}} | {{verifier1}} |
| {{employeeName2}} | Handler | Operations | {{hireDate2}} | Focus Materials Handling | Safety | {{currentDate}} | {{renewalDate}} | 85% | {{trainer2}} | {{verifier2}} |
| {{employeeName3}} | Technician | Repair | {{hireDate3}} | Test & Repair Procedures | Technical | {{currentDate}} | {{renewalDate}} | Pass | {{trainer3}} | {{verifier3}} |
| {{employeeName4}} | Supervisor | Operations | {{hireDate4}} | Internal Auditor Training | Compliance | {{currentDate}} | {{renewalDate}} | Pass | {{trainer4}} | {{verifier4}} |

---

## REQUIRED TRAINING BY ROLE

### All Employees

| Training Course | Frequency | Duration | Method |
|-----------------|-----------|----------|--------|
| R2v3 Overview | Initial + Annual | 2 hours | Classroom |
| EHSMS Awareness | Initial + Annual | 1 hour | Classroom |
| Emergency Response | Initial + Annual | 1 hour | Classroom + Drill |
| Data Security Basics | Initial + Annual | 1 hour | Online/Classroom |

### Data Sanitization Technicians

| Training Course | Frequency | Duration | Method |
|-----------------|-----------|----------|--------|
| Data Sanitization Procedures | Initial + Annual | 4 hours | Hands-on |
| NIST 800-88 Standards | Initial + Annual | 2 hours | Classroom |
| Verification Methods | Initial + Annual | 2 hours | Hands-on |
| Equipment Operation | Initial | 4 hours | Hands-on |

### Focus Materials Handlers

| Training Course | Frequency | Duration | Method |
|-----------------|-----------|----------|--------|
| FM Identification | Initial + Annual | 2 hours | Classroom |
| Mercury Handling | Initial + Annual | 2 hours | Classroom |
| Battery Safety | Initial + Annual | 2 hours | Classroom |
| Spill Response | Initial + Annual | 2 hours | Hands-on |
| PPE Requirements | Initial + Annual | 1 hour | Classroom |

### Test & Repair Technicians

| Training Course | Frequency | Duration | Method |
|-----------------|-----------|----------|--------|
| Testing Procedures | Initial | 8 hours | Hands-on |
| Repair Techniques | Initial | 8 hours | Hands-on |
| Quality Standards | Initial + Annual | 2 hours | Classroom |
| Product Safety | Initial + Annual | 2 hours | Classroom |

### Drivers/Transportation

| Training Course | Frequency | Duration | Method |
|-----------------|-----------|----------|--------|
| DOT Hazmat Training | Initial + Every 3 years | 8 hours | Classroom |
| Vehicle Inspection | Initial + Annual | 2 hours | Hands-on |
| Loading/Securing | Initial + Annual | 2 hours | Hands-on |

### Supervisors/Managers

| Training Course | Frequency | Duration | Method |
|-----------------|-----------|----------|--------|
| R2v3 Implementation | Initial + Annual | 4 hours | Classroom |
| Internal Auditor Training | Initial + Every 3 years | 16 hours | Classroom |
| Corrective Action Process | Initial + Every 2 years | 4 hours | Classroom |
| Leadership in EHS | Initial + Every 2 years | 4 hours | Classroom |

### Compliance/Quality Personnel

| Training Course | Frequency | Duration | Method |
|-----------------|-----------|----------|--------|
| R2v3 Standard (Complete) | Initial + Annual | 16 hours | Classroom |
| ISO 14001/45001/9001 | Initial + Every 3 years | 8 hours each | Classroom |
| Lead Auditor Training | Initial + Every 3 years | 40 hours | Formal Course |
| Legal Compliance | Annual | 4 hours | Classroom |

---

## SPECIALIZED CERTIFICATIONS

| Employee Name | Certification | Issuing Body | Date Obtained | Expiry Date | Status |
|---------------|---------------|--------------|---------------|-------------|--------|
| {{certEmployeeName1}} | EPA Section 608 (Refrigerant) | EPA | {{certDate1}} | Does not expire | Current |
| {{certEmployeeName2}} | DOT Hazmat Certification | {{trainingProvider}} | {{certDate2}} | {{certExpiry2}} | Current |
| {{certEmployeeName3}} | Lead Auditor ISO 14001 | {{certificationBody}} | {{certDate3}} | {{certExpiry3}} | Current |
| {{certEmployeeName4}} | Forklift Operator | {{trainingProvider}} | {{certDate4}} | {{certExpiry4}} | Current |

---

## COMPETENCY ASSESSMENT

### Assessment Criteria

**Pass/Fail Courses:**
- Practical demonstration of skill
- Supervisor observation and sign-off

**Scored Courses:**
- Written test or practical exam
- Minimum passing score: 80%
- Retraining required if failed
- Maximum 2 attempts

### Competency Records

| Employee Name | Course | Assessment Date | Assessment Method | Score/Result | Assessor | Notes |
|---------------|--------|-----------------|-------------------|--------------|----------|-------|
| {{assessEmployeeName1}} | Data Sanitization | {{assessDate1}} | Practical Exam | 90% | {{assessor1}} | Competent |
| {{assessEmployeeName2}} | FM Handling | {{assessDate2}} | Observation | Pass | {{assessor2}} | Competent |
| {{assessEmployeeName3}} | Internal Audit | {{assessDate3}} | Mock Audit | Pass | {{assessor3}} | Competent |

---

## TRAINING TRIGGERS

Training or retraining required when:
- [ ] New hire
- [ ] Job transfer to new role
- [ ] New equipment or process introduced
- [ ] Procedure changes
- [ ] Incident or near miss related to training gap
- [ ] Audit finding related to competency
- [ ] Refresher training due per schedule
- [ ] R2v3 standard updates
- [ ] Regulatory changes

---

## TRAINING DELIVERY METHODS

### Classroom Training
- Instructor-led sessions
- Group learning environment
- Q&A opportunities
- Attendance sheet signed

### Hands-On Training
- Equipment operation
- Practical demonstrations
- Supervised practice
- Competency verification

### Online Training
- Self-paced modules
- Video presentations
- Knowledge checks
- Completion certificates

### On-the-Job Training
- Supervised work experience
- Mentoring by experienced staff
- Progressive skill development
- Sign-off when competent

---

## TRAINING RECORDS MAINTENANCE

**Records Include:**
- Attendance sheets or sign-in logs
- Training materials used
- Assessment results
- Certificates issued
- Trainer qualifications

**Retention Period:** 3 years minimum

**Storage Location:** {{storageLocation}}

**Responsible:** {{trainingCoordinator}}

---

## TRAINING PROVIDERS

### Internal Trainers

| Trainer Name | Qualified to Teach | Credentials | Last Qualified |
|--------------|-------------------|-------------|----------------|
| {{internalTrainer1}} | R2v3 Overview, EHSMS | {{credentials1}} | {{qualifiedDate1}} |
| {{internalTrainer2}} | Data Sanitization | {{credentials2}} | {{qualifiedDate2}} |
| {{internalTrainer3}} | Focus Materials | {{credentials3}} | {{qualifiedDate3}} |

### External Training Providers

| Provider | Courses Provided | Contact | Last Used |
|----------|------------------|---------|-----------|
| {{externalProvider1}} | DOT Hazmat, Forklift | {{contact1}} | {{lastUsed1}} |
| {{externalProvider2}} | ISO Lead Auditor | {{contact2}} | {{lastUsed2}} |
| {{externalProvider3}} | R2v3 Implementation | {{contact3}} | {{lastUsed3}} |

---

## ANNUAL TRAINING PLAN

### Q1 (Jan-Mar)
- [ ] Annual R2v3 refresher for all staff
- [ ] Emergency drill
- [ ] New hire orientations

### Q2 (Apr-Jun)
- [ ] Focus materials refresher
- [ ] DOT renewals (as needed)
- [ ] Internal auditor training

### Q3 (Jul-Sep)
- [ ] Data security refresher
- [ ] Equipment operator requalifications
- [ ] Emergency drill

### Q4 (Oct-Dec)
- [ ] EHSMS refresher
- [ ] Year-end competency reviews
- [ ] Next year planning

---

## TRAINING EFFECTIVENESS EVALUATION

**Methods:**
- Post-training assessments
- Supervisor observations
- Incident/near-miss trends
- Audit findings
- Employee feedback

**Review Frequency:** Quarterly

**Responsible:** {{trainingCoordinator}}

---

## TRAINING BUDGET

**Annual Budget:** ${{ trainingBudget }}

**Allocation:**
- External courses: ${{ externalCourseBudget }}
- Certifications: ${{ certificationBudget }}
- Materials/supplies: ${{ materialsBudget }}
- Travel (if applicable): ${{ travelBudget }}

---

## DOCUMENT REVISION HISTORY

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | {{currentDate}} | Initial issue | {{trainingCoordinator}} |
|  |  |  |  |

---

**Document Owner:** {{trainingCoordinator}}  
**Next Review Date:** {{nextReviewDate}}
    `.trim();
    }
    // Group 3: Operational Control & Risk Management
    static generateFacilityClosurePlanTemplate() {
        return `
FACILITY CLOSURE AND FINANCIAL ASSURANCE PLAN
{{organizationName}}

Standard Reference: R2v3 Core Requirement 9.3; Appendix E

1. PURPOSE
To define the process for orderly closure of {{organizationName}} facility while ensuring environmental protection, responsible disposition of materials, and financial accountability.

2. SCOPE
Covers all assets, materials, and records under the R2v3 certification scope during facility shutdown, relocation, or termination.

3. RESPONSIBILITIES
| Role | Responsibility |
|------|----------------|
| {{facilityManager}} | Oversees closure execution and coordination |
| {{ehsOfficer}} | Ensures safe material handling and environmental protection |
| {{financeManager}} | Manages closure costs and financial instruments |

4. CLOSURE PLAN COMPONENTS
1. Inventory of all R2 Controlled Streams
2. Identification of downstream partners for final disposition
3. Worker protection and decontamination procedures
4. Site decommissioning and waste removal steps
5. Notification process for regulators and certification body

5. FINANCIAL ASSURANCE
| Financial Instrument | Provider | Amount | Expiry | Coverage Scope |
|---------------------|----------|---------|--------|----------------|
| {{financialAssurance}} | Insurance Provider | $250,000 | 2027-01-01 | Materials handling and site cleanup |
| Reserve Fund | Internal | $50,000 | Ongoing | Final shipment and transport |

6. RECORDKEEPING
Closure documentation retained for minimum 5 years post-completion.

Document ID: FCP-001
Version: 1.0
Effective Date: {{currentDate}}
    `.trim();
    }
    static generateDownstreamVendorQualificationTemplate() {
        return `
DOWNSTREAM VENDOR QUALIFICATION AND REVIEW FORM
{{organizationName}}

Standard Reference: R2v3 Appendix A; Core Requirement 5; Core Requirement 8

1. VENDOR INFORMATION
Vendor Name: {{vendorName}}
Address: [Vendor Address]
Country: [Country]
Contact: [Contact Information]
Certification: {{certifications}}
Expiry Date: [Certificate Expiry]

2. MATERIALS HANDLED
| Material Type | Category (R2 Controlled / Unrestricted) | Volume | Final Disposition |
|---------------|----------------------------------------|---------|------------------|
| {{materialsHandled}} | Controlled | [Volume] | [Final Disposition] |
| Circuit Boards | Controlled | 10 tons/year | Smelter (R2 Certified) |
| Batteries | Controlled | 3 tons/year | Battery Recycler |

3. QUALIFICATION REVIEW
| Evaluation Area | Criteria | Evidence Reviewed | Compliant (Y/N) |
|-----------------|----------|--------------------|-----------------|
| Legal Compliance | Valid permits and licenses | Copy of permits | |
| EHS Management | EHSMS or ISO 14001 certified | Certificate copy | |
| Data Security | If handling data-bearing devices | Sanitization procedure | |
| Focus Materials | Managed per FMMP and Appendix E | Downstream flowchart | |
| Insurance | Pollution liability and general coverage | Policy document | |

4. AUDIT & REVIEW FREQUENCY
- New vendor: full qualification prior to first shipment
- Existing vendor: requalification annually or after any incident

5. APPROVAL
Reviewer Name: [Name]
Position: [Position]
Date: {{currentDate}}
Approval Status: [ ] Approved [ ] Conditional [ ] Rejected

Document ID: DVQ-001
Version: 1.0
    `.trim();
    }
    static generateIncidentResponseLogTemplate() {
        return `
INCIDENT RESPONSE AND CORRECTIVE ACTION LOG
{{organizationName}}

Standard Reference: R2v3 Core Requirement 3.4; Core Requirement 7.6; Appendix B

1. PURPOSE
To record all environmental, health, safety, and data security incidents and track corrective actions through closure.

2. LOG STRUCTURE
| Date | Incident Type | Description | Impact | Root Cause | Corrective Action | Responsible Party | Status | Closure Date |
|------|---------------|-------------|---------|-------------|-------------------|-------------------|---------|--------------|
| {{incidentDate}} | {{incidentType}} | [Description] | [Impact] | [Root Cause] | [Corrective Action] | {{responsibleParty}} | Open/Closed | [Date] |

3. INCIDENT TYPES
- Data Breach
- EHS Spill
- Equipment Failure
- Safety Violation
- Environmental Non-compliance
- Training Deficiency

4. REPORTING AND REVIEW
- All incidents reported to management within 24 hours
- Root cause analysis conducted within 5 business days
- Monthly trend reports submitted to EHS Manager

5. RETENTION
Maintain records for minimum 5 years and provide to Certification Body upon request.

Document ID: IRL-001
Version: 1.0
Effective Date: {{currentDate}}
    `.trim();
    }
    // Group 4: Audit & Certification Management
    static generateNonconformanceReportTemplate() {
        return `
NONCONFORMANCE REPORT (NCR) AND CORRECTIVE ACTION RECORD
{{organizationName}}

Standard Reference: R2v3 Core Requirement 3; ISO 9001:2015; ISO 14001:2015

1. PURPOSE
To identify, record, and resolve nonconformities discovered during internal audits, external audits, or daily operations.

2. NCR INFORMATION
NCR No.: {{ncrNumber}}
Date Identified: {{currentDate}}
Department: {{department}}
Description of Nonconformance: {{nonconformanceDescription}}
Classification: [ ] Minor [ ] Major

3. ROOT CAUSE ANALYSIS
Describe the underlying cause(s) contributing to the nonconformance:
[Root Cause Analysis]

4. CORRECTIVE ACTION PLAN
| Action Item | Responsible Person | Target Date | Verification Method | Status |
|-------------|-------------------|-------------|---------------------|---------|
| [Action Item 1] | [Person] | [Date] | [Method] | Open/Closed |
| [Action Item 2] | [Person] | [Date] | [Method] | Open/Closed |

5. VERIFICATION OF EFFECTIVENESS
Auditor confirms that corrective action eliminates the root cause and prevents recurrence.
Verification completed by: ___________________  
Date: ________________

6. RETENTION
Maintain all NCRs for minimum 3 years.

Document ID: NCR-{{ncrNumber}}
Version: 1.0
Issued Date: {{currentDate}}
    `.trim();
    }
    static generateBrokeringPolicyTemplate() {
        return `
BROKERING AND NON-PHYSICAL HANDLING POLICY
{{organizationName}}

Standard Reference: R2v3 Appendix F; Core Requirements 4, 5, and 10

1. PURPOSE
To ensure proper management and traceability of materials brokered by {{organizationName}} without physical possession, maintaining compliance with all R2v3 requirements.

2. SCOPE
Covers all activities where {{organizationName}} arranges transfer or sale of electronic equipment or materials without physical handling.

3. BROKERING ACTIVITIES
{{brokeringActivities}}

4. POLICY REQUIREMENTS
1. All brokered materials must be traceable through the R2 Controlled Stream
2. Downstream partners must be verified against R2v3 Appendix A requirements
3. Legal compliance and export/import documentation must be maintained
4. Contracts must specify environmental and data security obligations
5. Transaction records retained for minimum 3 years

5. DOWNSTREAM PARTNERS
{{downstreamPartners}}

6. RECORDKEEPING
| Record Type | Description | Responsible Department | Retention |
|-------------|-------------|------------------------|-----------|
| Brokered Shipment Record | Details of each transaction and downstream path | Logistics | 3 years |
| Vendor Qualification | Due diligence reports for each downstream vendor | Compliance | 3 years |
| Customer Communication | Proof of transparency in handling materials | Sales | 3 years |

7. OVERSIGHT AND REVIEW
Brokering activities audited annually by Compliance Manager. Deviations trigger corrective action per NCR procedure.

Document ID: BP-001
Version: 1.0
Effective Date: {{currentDate}}
    `.trim();
    }
    static generateCorrectiveActionRequestTemplate() {
        return `
# CORRECTIVE ACTION REQUEST (CAR)

**Document ID:** CAR-001  
**CAR Number:** {{carNumber}}  
**Date Issued:** {{currentDate}}  
**Issued By:** {{issuedBy}}  
**Priority:** {{priority}}

---

## NON-CONFORMANCE INFORMATION

**Source:**
- [ ] Internal Audit
- [ ] External Audit
- [ ] Management Review
- [ ] Customer Complaint
- [ ] Incident
- [ ] Process Monitoring
- [ ] Other: {{nonConformanceSource}}

**Standard/Requirement:** {{standardRequirement}}

**Area/Process:** {{areaProcess}}

**Responsible Manager:** {{responsibleManager}}

---

## DESCRIPTION OF NON-CONFORMANCE

**What was found:**
{{nonConformanceDescription}}

**Objective Evidence:**
{{objectiveEvidence}}

**Classification:**
- [ ] Major Non-Conformance
- [ ] Minor Non-Conformance
- [ ] Observation

---

## IMMEDIATE ACTION (CONTAINMENT)

**Action Taken to Address Immediate Issue:**
{{immediateAction}}

**Implemented By:** {{implementedBy}} **Date:** {{implementationDate}}

**Verification:** [ ] Effective [ ] Not Effective

---

## ROOT CAUSE ANALYSIS

**Analysis Method Used:**
- [ ] 5 Whys
- [ ] Fishbone Diagram
- [ ] Fault Tree Analysis
- [ ] Other: {{analysisMethod}}

**Root Cause(s) Identified:**
1. {{rootCause1}}
2. {{rootCause2}}
3. {{rootCause3}}

**Analysis Conducted By:** {{analysisBy}} **Date:** {{analysisDate}}

---

## CORRECTIVE ACTION PLAN

**Action(s) to Prevent Recurrence:**

| Action # | Description | Responsible Person | Target Date | Resources Required |
|----------|-------------|-------------------|-------------|-------------------|
| 1 | {{correctiveAction1}} | {{responsible1}} | {{targetDate1}} | {{resources1}} |
| 2 | {{correctiveAction2}} | {{responsible2}} | {{targetDate2}} | {{resources2}} |
| 3 | {{correctiveAction3}} | {{responsible3}} | {{targetDate3}} | {{resources3}} |

**Implementation Timeline:**
- Week 1: {{milestone1}}
- Week 2: {{milestone2}}
- Week 3: {{milestone3}}
- Week 4: {{milestone4}}

**Affected Documents/Procedures:**
{{affectedDocuments}}

---

## IMPLEMENTATION VERIFICATION

**Verification Activities:**

| Activity | Method | Responsible | Completion Date | Result |
|----------|--------|-------------|-----------------|--------|
| {{verificationActivity1}} | {{verificationMethod1}} | {{verificationResponsible1}} | {{verificationDate1}} | [ ] Complete |
| {{verificationActivity2}} | {{verificationMethod2}} | {{verificationResponsible2}} | {{verificationDate2}} | [ ] Complete |

**Implementation Verified By:** {{verifiedBy}} **Date:** {{verificationDate}}

---

## EFFECTIVENESS VERIFICATION

**Verification Method:**
- [ ] Follow-up Audit
- [ ] Process Monitoring
- [ ] Data Analysis
- [ ] Management Review
- [ ] Other: {{effectivenessMethod}}

**Verification Date:** {{effectivenessDate}}

**Verification Conducted By:** {{effectivenessBy}}

**Results:**
- [ ] Effective - No recurrence, issue resolved
- [ ] Not Effective - Issue persists or recurred
- [ ] Partially Effective - Improvement noted, additional action needed

**Evidence of Effectiveness:**
{{effectivenessEvidence}}

---

## PREVENTIVE ACTIONS (if applicable)

**Similar Processes/Areas That May Be Affected:**
{{similarProcesses}}

**Preventive Actions Taken:**
1. {{preventiveAction1}}
2. {{preventiveAction2}}
3. {{preventiveAction3}}

---

## MANAGEMENT REVIEW

**Reviewed By:** {{reviewedBy}} **Date:** {{reviewDate}}

**Comments:**
{{managementComments}}

**Approval Status:**
- [ ] Approved
- [ ] Approved with Conditions
- [ ] Rejected - Revise and Resubmit

---

## CAR CLOSURE

**Closure Criteria Met:**
- [ ] Immediate action implemented
- [ ] Root cause identified
- [ ] Corrective action implemented
- [ ] Effectiveness verified
- [ ] Documentation updated
- [ ] Training completed (if applicable)

**Closed By:** {{closedBy}} **Date:** {{closureDate}}

**Final Status:**
- [ ] Closed - Effective
- [ ] Closed - Accepted Risk
- [ ] Escalated
- [ ] Open - Pending

---

## RELATED DOCUMENTS

**Related CARs:** {{relatedCars}}

**Audit Report:** {{auditReport}}

**Revised Documents:** {{revisedDocuments}}

**Training Records:** {{trainingRecords}}

---

## LESSONS LEARNED

**What Worked Well:**
{{lessonsWorkedWell}}

**What Could Be Improved:**
{{lessonsImprovement}}

**Communication to Organization:**
[ ] Yes [ ] No  
**Method:** {{communicationMethod}}

---

## DOCUMENT REVISION HISTORY

| Version | Date | Changes | By |
|---------|------|---------|-----|
| 1.0 | {{currentDate}} | CAR initiated | {{issuedBy}} |
|  |  |  |  |

---

**Retention:** 3 years minimum  
**Distribution:** Quality Manager, Area Manager, Auditor
    `.trim();
    }
    static generateCertificationAuditRecordsPlanTemplate() {
        return `
CERTIFICATION AND AUDIT RECORDS MANAGEMENT PLAN
{{organizationName}}

Standard Reference: R2v3 Core Requirements 1–10; SERI Code of Practices

1. PURPOSE
To define procedures for maintaining and securing certification-related records, including audit reports, certificates, and communication with Certification Bodies (CBs).

2. SCOPE
Applies to all R2v3 certification, surveillance, and recertification activities for {{organizationName}}.

3. KEY PERSONNEL
Compliance Officer: {{complianceOfficer}}
Quality Manager: {{qualityManager}}
Certification Body: {{certificationBody}}

4. RECORDS TO BE MAINTAINED
| Record Type | Description | Responsible Party | Retention |
|-------------|-------------|-------------------|-----------|
| R2v3 Certificate | Official certificate with scope and appendices | {{complianceOfficer}} | Active + 3 years |
| Audit Reports | Stage 1, Stage 2, and surveillance audits | {{qualityManager}} | 5 years |
| Corrective Action Responses | Submitted CAPAs and verifications | QA Lead | 3 years |
| Correspondence with CB | Emails, notices, and approvals | {{complianceOfficer}} | 5 years |

5. DOCUMENT SECURITY AND ACCESS
- Access restricted to management, compliance, and auditors
- Electronic records stored on secure drive with access control
- Paper records archived in locked cabinet for physical audits

6. REVIEW AND UPDATE
{{complianceOfficer}} reviews this plan annually or after certification events.
Updates documented in revision log.

| Version | Date | Description | Approved By |
|---------|------|-------------|-------------|
| 1.0 | {{currentDate}} | Initial Issue | {{complianceOfficer}} |

Document ID: CARP-001
Version: 1.0
Effective Date: {{currentDate}}
    `.trim();
    }
    static generateGenericTemplate(template) {
        return `
${template.name.toUpperCase()}
{{organizationName}}

1. PURPOSE
This document provides guidance for ${template.description.toLowerCase()}.

2. SCOPE
[Define scope of application]

3. REQUIREMENTS
[List specific requirements]

4. PROCEDURES
[Detailed procedures]

5. RESPONSIBILITIES
[Roles and responsibilities]

6. RECORDS
[Record keeping requirements]

Document Version: ${template.version}
Category: ${template.category}
Type: ${template.type}
Last Updated: ${template.lastUpdated}
    `.trim();
    }
    /**
     * Process templates by type
     */
    static async processWordTemplate(template, customizations) {
        // For Word documents, replace template variables with actual values
        let content = template.toString('utf8');
        // Replace template variables
        Object.entries(customizations).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            content = content.replace(new RegExp(placeholder, 'g'), String(value));
        });
        // Add current date if not provided
        content = content.replace(/{{currentDate}}/g, new Date().toLocaleDateString());
        content = content.replace(/{{nextReviewDate}}/g, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString());
        return Buffer.from(content, 'utf8');
    }
    static async processExcelTemplate(template, customizations) {
        // For Excel files, similar processing would be done using a library like ExcelJS
        // For now, return the template as-is with metadata
        return template;
    }
    static async processPDFTemplate(template, customizations) {
        // For PDF files, would use PDF manipulation library
        // For now, return template as-is
        return template;
    }
    /**
     * Update template with latest industry standards
     */
    static async updateTemplate(templateId) {
        try {
            const template = this.templates.find(t => t.id === templateId);
            if (!template) {
                return { success: false, error: 'Template not found' };
            }
            if (!template.autoUpdateEnabled) {
                return { success: false, error: 'Auto-update not enabled for this template' };
            }
            // Simulate template update logic
            const newVersion = this.incrementVersion(template.version);
            const changes = await this.getTemplateUpdates(templateId);
            // Update template version
            template.version = newVersion;
            template.lastUpdated = new Date().toISOString();
            await ObservabilityService.log('INFO', 'Template updated', {
                service: 'document-library',
                operation: 'updateTemplate',
                userId: 'system',
                metadata: { templateId, oldVersion: template.version, newVersion }
            });
            return {
                success: true,
                version: newVersion,
                changes
            };
        }
        catch (error) {
            await ObservabilityService.logError(error, {
                service: 'document-library',
                operation: 'updateTemplate',
                severity: 'medium',
                metadata: { templateId }
            });
            return { success: false, error: 'Template update failed' };
        }
    }
    /**
     * Helper methods
     */
    static incrementVersion(currentVersion) {
        const parts = currentVersion.split('.');
        const patch = parseInt(parts[2] || '0') + 1;
        return `${parts[0]}.${parts[1]}.${patch}`;
    }
    static async getTemplateUpdates(templateId) {
        // Simulate getting template updates from industry standards
        return [
            'Updated compliance references to latest R2v3 standard',
            'Enhanced data security requirements',
            'Added new reporting requirements'
        ];
    }
    /**
     * Get library statistics
     */
    static async getLibraryStatistics() {
        const totalTemplates = this.templates.length;
        const categoryCounts = this.templates.reduce((acc, template) => {
            acc[template.category] = (acc[template.category] || 0) + 1;
            return acc;
        }, {});
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentUpdates = this.templates.filter(t => new Date(t.lastUpdated) > thirtyDaysAgo).length;
        const autoUpdateEnabled = this.templates.filter(t => t.autoUpdateEnabled).length;
        return {
            totalTemplates,
            categoryCounts,
            recentUpdates,
            autoUpdateEnabled
        };
    }
}
import { db } from '../db';
import { tenants } from '../../shared/schema';
import { eq } from 'drizzle-orm';
export class DocumentLibraryService {
    templateCategories = {
        policies: {
            name: 'Policy Templates',
            templates: [
                'EHS Management System Policy',
                'Data Sanitization Policy',
                'Focus Materials Plan',
                'Legal Compliance Register'
            ]
        },
        procedures: {
            name: 'Procedure Templates',
            templates: [
                'Internal Audit Checklist',
                'Corrective Action Request Form',
                'Training Matrix Template',
                'EHS Manual Template'
            ]
        },
        records: {
            name: 'Record Templates',
            templates: [
                'Training Records',
                'Audit Reports',
                'Compliance Certificates',
                'Environmental Monitoring Logs'
            ]
        }
    };
    async getAvailableTemplates(tenantId, category) {
        const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, tenantId)
        });
        if (!tenant) {
            throw new Error('Tenant not found');
        }
        // Filter templates based on tenant type and permissions
        const availableTemplates = category
            ? { [category]: this.templateCategories[category] }
            : this.templateCategories;
        return {
            success: true,
            data: availableTemplates,
            totalTemplates: Object.values(this.templateCategories).reduce((sum, cat) => sum + cat.templates.length, 0)
        };
    }
    async downloadTemplate(templateName, tenantId, format = 'docx') {
        // Generate template based on name and format
        const templateContent = await this.generateTemplateContent(templateName, tenantId, format);
        return {
            success: true,
            data: templateContent,
            filename: `${templateName.toLowerCase().replace(/\s+/g, '_')}.${format}`,
            mimeType: this.getMimeType(format)
        };
    }
    async generateTemplateContent(templateName, tenantId, format) {
        // Get tenant-specific branding and customization
        const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, tenantId)
        });
        const templateData = {
            companyName: tenant?.name || 'Your Company',
            templateName,
            generatedDate: new Date().toLocaleDateString(),
            format,
            customizations: tenant?.branding || {}
        };
        // Generate content based on template type
        switch (templateName) {
            case 'EHS Management System Policy':
                return this.generateEHSPolicyTemplate(templateData, format);
            case 'Data Sanitization Policy':
                return this.generateDataSanitizationTemplate(templateData, format);
            case 'Internal Audit Checklist':
                return this.generateAuditChecklistTemplate(templateData, format);
            default:
                return this.generateGenericTemplate(templateData, format);
        }
    }
    generateEHSPolicyTemplate(data, format) {
        const content = `
      ${data.companyName} Environmental, Health & Safety Management System Policy
      
      1. POLICY STATEMENT
      ${data.companyName} is committed to maintaining the highest standards of environmental, health, and safety management in all our operations.
      
      2. SCOPE
      This policy applies to all employees, contractors, and visitors to our facilities.
      
      3. RESPONSIBILITIES
      - Management: Provide resources and leadership
      - Employees: Follow all safety procedures
      - EHS Team: Monitor compliance and provide training
      
      4. IMPLEMENTATION
      - Regular training programs
      - Incident reporting system
      - Continuous improvement processes
      
      Generated on: ${data.generatedDate}
    `;
        return Buffer.from(content, 'utf8');
    }
    generateDataSanitizationTemplate(data, format) {
        const content = `
      ${data.companyName} Data Sanitization Plan
      
      1. PURPOSE
      This plan outlines the procedures for secure data sanitization in compliance with R2v3 requirements.
      
      2. SCOPE
      Applies to all electronic devices and storage media containing sensitive data.
      
      3. SANITIZATION LEVELS
      - Level 1: Basic data wiping (3-pass)
      - Level 2: DoD 5220.22-M standard (7-pass)
      - Level 3: Physical destruction
      
      4. PROCEDURES
      - Device assessment and classification
      - Appropriate sanitization method selection
      - Verification and documentation
      - Certificate of sanitization
      
      Generated on: ${data.generatedDate}
    `;
        return Buffer.from(content, 'utf8');
    }
    generateAuditChecklistTemplate(data, format) {
        const content = `
      ${data.companyName} Internal Audit Checklist
      
      CORE REQUIREMENTS AUDIT
      
      CR1: EHS Management System
      □ Policy documented and approved
      □ Procedures implemented
      □ Training records maintained
      □ Regular management reviews conducted
      
      CR2: Legal Requirements
      □ Legal register maintained
      □ Compliance monitoring system
      □ Change management process
      □ Documentation control
      
      CR3: Due Diligence
      □ Vendor qualification process
      □ Ongoing monitoring procedures
      □ Risk assessment methodology
      □ Corrective action system
      
      Generated on: ${data.generatedDate}
    `;
        return Buffer.from(content, 'utf8');
    }
    generateGenericTemplate(data, format) {
        const content = `
      ${data.companyName} - ${data.templateName}
      
      This template has been customized for your organization.
      
      Please customize the following sections:
      1. Company-specific information
      2. Operational procedures
      3. Contact information
      4. Approval signatures
      
      Generated on: ${data.generatedDate}
    `;
        return Buffer.from(content, 'utf8');
    }
    getMimeType(format) {
        const mimeTypes = {
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'pdf': 'application/pdf',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        return mimeTypes[format] || 'application/octet-stream';
    }
}
