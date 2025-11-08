// Comprehensive R2v3 Training Modules - Business Implementation Program
const R2V3_TRAINING_MODULES = [
    // Module 1: R2v3 Overview & Certification Fundamentals
    {
        id: 'r2v3-overview-fundamentals',
        title: 'R2v3 Overview & Certification Fundamentals',
        description: 'Understand R2v3 purpose, certification structure, updates in v3.1, and roles of facility, CB, and SERI',
        category: 'CORE_REQUIREMENT',
        difficulty: 'BEGINNER',
        estimatedTime: 120, // 2 hours
        requirements: [],
        status: 'AVAILABLE',
        progress: 0,
        content: {
            overview: 'This foundational module provides comprehensive understanding of the R2v3 standard, its history, purpose, and the certification process. Learn about the global context and the roles of all stakeholders in the R2v3 ecosystem.',
            learningObjectives: [
                'Understand R2v3 history, purpose, and global impact on electronics recycling',
                'Navigate the certification cycle: readiness → audit → certification → surveillance',
                'Distinguish between Core Requirements and Appendix structure',
                'Identify R2v3 v3.1 updates including PV modules and 2024 revisions',
                'Recognize roles and responsibilities of facilities, certification bodies, consultants, and SERI'
            ],
            sections: [
                {
                    id: 'r2-history-purpose',
                    title: 'R2v3 History and Global Context',
                    type: 'TEXT',
                    content: `The Responsible Recycling (R2) Standard was developed to address the growing need for responsible electronics recycling practices globally. R2v3 represents the third major revision, incorporating lessons learned from over a decade of implementation.

Key Milestones:
• 2008: First R2 Standard developed by EPA and industry stakeholders
• 2013: R2:2013 revision expanded scope and requirements
• 2020: R2v3 introduced significant enhancements including data security requirements
• 2024: R2v3.1 adds photovoltaic modules and refines existing requirements

Global Impact:
• Over 1,000 certified facilities worldwide
• Covers billions of pounds of electronics annually
• Recognized by major OEMs and government agencies
• Drives industry best practices for responsible recycling`
                },
                {
                    id: 'certification-cycle',
                    title: 'Certification Process Lifecycle',
                    type: 'INTERACTIVE',
                    content: `Understanding the certification journey is crucial for successful R2v3 implementation.

Stage 1: Application and Readiness Assessment
• Submit application to accredited certification body
• Conduct internal readiness assessment
• Prepare documentation package
• Schedule Stage 1 audit

Stage 2: On-site Certification Audit
• Document review and facility tour
• Interview key personnel
• Verify conformance to all applicable requirements
• Issue certificate (if conforming) or nonconformance report

Ongoing: Surveillance and Maintenance
• Annual surveillance audits
• Continuous improvement requirements
• Documentation updates
• Staff training maintenance`
                },
                {
                    id: 'core-vs-appendix',
                    title: 'Core Requirements vs. Appendix Structure',
                    type: 'TEXT',
                    content: `R2v3 is structured around 10 Core Requirements that apply to all certified facilities, plus 7 optional Appendices for specialized activities.

Core Requirements (1-10) - Mandatory for All:
1. Scope Definition
2. Hierarchy of Responsible Management
3. Environmental, Health & Safety Management System
4. Legal and Other Requirements
5. Tracking Throughput
6. Sorting, Categorization, and Processing
7. Data Security
8. Focus Materials
9. Facility Standards
10. Transport

Appendices (A-G) - Apply Based on Activities:
A. Downstream Recycling Chain
B. Data Sanitization
C. Test and Repair (Reuse)
D. Specialty Electronics Reuse
E. Materials Recovery
F. Brokering
G. Photovoltaic Modules`
                },
                {
                    id: 'stakeholder-roles',
                    title: 'Stakeholder Roles and Responsibilities',
                    type: 'CHECKLIST',
                    content: `Understanding roles ensures effective implementation and audit success.

Facility Responsibilities:
□ Implement all applicable R2v3 requirements
□ Maintain documented management system
□ Conduct internal audits and management reviews
□ Provide audit access and documentation
□ Maintain continuous compliance

Certification Body (CB) Responsibilities:
□ Conduct competent and impartial audits
□ Issue certificates based on conformance
□ Perform surveillance audits
□ Report to SERI on certification activities

SERI Responsibilities:
□ Maintain and update R2v3 standard
□ Accredit certification bodies
□ Provide interpretations and guidance
□ Oversee overall program integrity`
                }
            ],
            resources: [
                {
                    id: 'r2v3-standard-document',
                    title: 'R2v3.1 Complete Standard',
                    type: 'PDF',
                    url: '/resources/r2v3-standard-complete.pdf',
                    description: 'Official R2v3.1 standard document with all requirements'
                },
                {
                    id: 'seri-code-practices',
                    title: 'SERI Code of Practices',
                    type: 'PDF',
                    url: '/resources/seri-code-practices.pdf',
                    description: 'SERI Code of Practices for certification bodies'
                },
                {
                    id: 'certification-timeline',
                    title: 'Certification Timeline Template',
                    type: 'TEMPLATE',
                    url: '/resources/certification-timeline.xlsx',
                    description: 'Project timeline template for R2v3 implementation'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'overview-q1',
                        question: 'Which year did R2v3 first introduce mandatory data security requirements?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['2013', '2018', '2020', '2024'],
                        correctAnswer: '2020',
                        explanation: 'R2v3 (2020) was the first revision to include mandatory data security requirements in Core Requirement 7.'
                    },
                    {
                        id: 'overview-q2',
                        question: 'How many Core Requirements must ALL R2v3 certified facilities implement?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['7', '8', '10', '17'],
                        correctAnswer: '10',
                        explanation: 'All R2v3 certified facilities must implement all 10 Core Requirements, regardless of their specific activities.'
                    },
                    {
                        id: 'overview-q3',
                        question: 'What is the typical frequency of surveillance audits after initial certification?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Every 6 months', 'Annually', 'Every 2 years', 'Every 3 years'],
                        correctAnswer: 'Annually',
                        explanation: 'R2v3 requires annual surveillance audits to maintain certification status.'
                    }
                ]
            }
        }
    },
    // Module 2: Core Requirement 1 - Scope Definition
    {
        id: 'core-1-scope-definition',
        title: 'Core Requirement 1: Scope Definition',
        description: 'Define certification boundaries, identify facilities and controlled processes, prepare scope statement',
        category: 'CORE_REQUIREMENT',
        difficulty: 'INTERMEDIATE',
        estimatedTime: 90, // 1.5 hours
        requirements: ['r2v3-overview-fundamentals'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Scope Definition is the foundation of R2v3 certification. This module teaches you to accurately define certification boundaries, identify all controlled processes, and prepare a comprehensive scope statement.',
            learningObjectives: [
                'Determine appropriate certification boundaries for your facility',
                'Understand multi-site and campus certification models',
                'Identify all controlled processes and materials within scope',
                'Prepare required documentation and legal entity alignment',
                'Create a clear, audit-ready scope statement'
            ],
            sections: [
                {
                    id: 'certification-boundaries',
                    title: 'Determining Certification Boundaries',
                    type: 'WORKSHOP',
                    content: `Certification boundaries define what is included in your R2v3 certification. These boundaries must be clearly defined, logical, and encompass all R2-related activities.

Boundary Considerations:
• Physical locations (buildings, yards, storage areas)
• Legal entities (corporations, subsidiaries, partnerships)
• Operational activities (processing, storage, transport)
• Controlled materials (electronics, components, data-bearing devices)

Single-Site Model:
One facility, one legal entity, all activities at one location

Multi-Site Model:
Multiple facilities under one certificate, same legal entity or management control

Campus Model:
Multiple buildings or areas within a defined geographic area

Exclusions:
Activities or areas specifically excluded from certification scope must be clearly documented and justified.`
                },
                {
                    id: 'controlled-processes',
                    title: 'Identifying Controlled Processes',
                    type: 'INTERACTIVE',
                    content: `All processes that handle R2-controlled materials must be within certification scope.

Controlled Processes Include:
• Intake and receiving operations
• Testing and evaluation activities
• Data sanitization and destruction
• Disassembly and processing operations
• Materials recovery and separation
• Storage and warehousing
• Loading and shipping operations
• Quality control and inspection

Process Mapping Exercise:
1. List all facility activities involving electronics
2. Identify which activities handle controlled materials
3. Determine process inputs, outputs, and controls
4. Map process flow from intake to final disposition
5. Identify any excluded processes and justification`
                },
                {
                    id: 'scope-statement-preparation',
                    title: 'Scope Statement Development',
                    type: 'PRACTICAL',
                    content: `The scope statement is a critical document that clearly communicates your certification boundaries to auditors and customers.

Required Elements:
• Legal entity information
• Physical address(es) of certified locations
• Activities included in scope
• Types of materials handled
• Applicable appendices
• Any exclusions and justifications

Scope Statement Template:
[Legal Entity Name] at [Address] is certified to R2v3 for the [activities] of [material types] including [appendices]. Excluded from scope: [exclusions with justification].

Example:
"ABC Electronics Recycling LLC at 123 Industrial Drive, Anytown, ST 12345 is certified to R2v3 for the collection, testing, processing, data sanitization, and materials recovery of electronics and related equipment including Appendices A, B, C, and E. Vehicle maintenance activities are excluded from scope as they do not involve R2-controlled materials."`
                }
            ],
            resources: [
                {
                    id: 'scope-definition-guide',
                    title: 'R2v3 Scope Definition Guide',
                    type: 'PDF',
                    url: '/resources/scope-definition-guide.pdf',
                    description: 'Comprehensive guide to defining certification scope'
                },
                {
                    id: 'scope-statement-template',
                    title: 'Scope Statement Template',
                    type: 'TEMPLATE',
                    url: '/resources/scope-statement-template.docx',
                    description: 'Word template for creating scope statements'
                },
                {
                    id: 'multi-site-guidance',
                    title: 'Multi-Site Certification Guidance',
                    type: 'PDF',
                    url: '/resources/multi-site-guidance.pdf',
                    description: 'Guidelines for multi-site certification models'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'scope-q1',
                        question: 'Which of the following must be included in an R2v3 scope statement?',
                        type: 'MULTIPLE_CHOICE',
                        options: [
                            'Only the main processing activities',
                            'Legal entity, address, activities, materials, and applicable appendices',
                            'Just the facility address and contact information',
                            'Only the activities that generate revenue'
                        ],
                        correctAnswer: 'Legal entity, address, activities, materials, and applicable appendices',
                        explanation: 'A complete scope statement must include legal entity information, physical addresses, activities, material types, applicable appendices, and any exclusions.'
                    }
                ]
            }
        }
    },
    // Module 3: Core Requirement 2 - Hierarchy of Responsible Management
    {
        id: 'core-2-responsible-management',
        title: 'Core Requirement 2: Hierarchy of Responsible Management',
        description: 'Apply reuse-first hierarchy, develop management policy and decision-making process flow',
        category: 'CORE_REQUIREMENT',
        difficulty: 'INTERMEDIATE',
        estimatedTime: 90, // 1.5 hours
        requirements: ['core-1-scope-definition'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'The Hierarchy of Responsible Management is R2v3\'s foundational principle that prioritizes reuse over recovery and recovery over disposal. This module teaches implementation of the hierarchy in decision-making processes.',
            learningObjectives: [
                'Understand the reuse-first hierarchy principles',
                'Develop management policy supporting the hierarchy',
                'Create decision trees for material handling',
                'Implement process flows that prioritize reuse',
                'Document hierarchy application in operations'
            ],
            sections: [
                {
                    id: 'hierarchy-principles',
                    title: 'Understanding the Hierarchy',
                    type: 'TEXT',
                    content: `The Hierarchy of Responsible Management establishes priority order for handling electronics:

1. REUSE (Highest Priority)
   - Equipment functions for original purpose
   - Minimal processing required
   - Maximum value retention
   - Environmental benefits through life extension

2. MATERIALS RECOVERY (Second Priority)  
   - Equipment cannot be reused
   - Materials extracted for manufacturing
   - Resource conservation through recycling
   - Proper handling of hazardous substances

3. DISPOSAL (Last Resort)
   - No reuse or recovery options viable
   - Environmentally sound disposal required
   - Only for materials with no value
   - Must minimize environmental impact

Decision Factors:
• Functionality and condition assessment
• Market demand and economic viability  
• Environmental impact considerations
• Customer requirements and restrictions
• Regulatory compliance requirements`
                },
                {
                    id: 'decision-tree-development',
                    title: 'Creating Decision Trees',
                    type: 'WORKSHOP',
                    content: `Decision trees provide systematic approach to hierarchy implementation.

Decision Tree Structure:

1. Initial Assessment
   ↓
2. Functionality Test
   ↓ (Functional) ↓ (Non-functional)
3. Reuse Evaluation → Materials Recovery Assessment
   ↓ (Viable) ↓ (Not viable) ↓ (Viable) ↓ (Not viable)
4. Reuse Process → Materials Recovery → Disposal

Key Decision Points:
• Can equipment function for original purpose?
• Is there market demand for reuse?
• Are materials recoverable economically?
• Do any restrictions prohibit preferred option?
• What are environmental implications?

Documentation Requirements:
• Decision criteria and thresholds
• Responsible personnel assignments
• Process flow documentation
• Exception handling procedures`
                },
                {
                    id: 'policy-development',
                    title: 'Management Policy Creation',
                    type: 'PRACTICAL',
                    content: `Your hierarchy policy guides all operational decisions.

Policy Elements:
• Commitment to hierarchy implementation
• Responsibility assignments
• Decision-making procedures  
• Training requirements
• Monitoring and review processes

Sample Policy Statement:
"[Organization] is committed to implementing the Hierarchy of Responsible Management in all operations. We prioritize reuse opportunities while ensuring materials recovery when reuse is not viable. Disposal is used only as a last resort when no other options exist. All staff are trained on hierarchy principles and empowered to make decisions supporting maximum material utilization."

Implementation Requirements:
• Staff training on hierarchy principles
• Process documentation and procedures
• Regular policy review and updates
• Performance monitoring and reporting
• Continuous improvement initiatives`
                }
            ],
            resources: [
                {
                    id: 'hierarchy-implementation-guide',
                    title: 'Hierarchy Implementation Guide',
                    type: 'PDF',
                    url: '/resources/hierarchy-guide.pdf',
                    description: 'Complete guide to implementing the responsibility hierarchy'
                },
                {
                    id: 'decision-tree-template',
                    title: 'Decision Tree Template',
                    type: 'TEMPLATE',
                    url: '/resources/decision-tree-template.xlsx',
                    description: 'Excel template for creating material handling decision trees'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'hierarchy-q1',
                        question: 'According to R2v3 Hierarchy of Responsible Management, what is the highest priority?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Materials recovery', 'Reuse', 'Recycling', 'Disposal'],
                        correctAnswer: 'Reuse',
                        explanation: 'Reuse has the highest priority in the R2v3 hierarchy because it provides maximum environmental benefit by extending product life.'
                    }
                ]
            }
        }
    },
    // Module 4: Core Requirement 3 - EHS Management System
    {
        id: 'core-3-ehs-management',
        title: 'Core Requirement 3: Environmental, Health & Safety Management System',
        description: 'Integrate ISO 14001/45001 or RIOS into R2 compliance, create EHSMS documentation',
        category: 'CORE_REQUIREMENT',
        difficulty: 'ADVANCED',
        estimatedTime: 120, // 2 hours
        requirements: ['core-2-responsible-management'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'The Environmental, Health & Safety Management System (EHSMS) is central to R2v3 compliance. This module covers integration with ISO standards, risk assessments, and comprehensive EHSMS development.',
            learningObjectives: [
                'Integrate ISO 14001, ISO 45001, or RIOS standards with R2v3 requirements',
                'Develop comprehensive EHSMS documentation and procedures',
                'Conduct effective risk assessments and hazard identification',
                'Implement worker protection and safety programs',
                'Establish monitoring, review, and continuous improvement processes'
            ],
            sections: [
                {
                    id: 'ehsms-framework',
                    title: 'EHSMS Framework and Integration',
                    type: 'TEXT',
                    content: `The R2v3 EHSMS must be based on recognized standards and integrated with R2-specific requirements.

Acceptable Framework Standards:
• ISO 14001:2015 (Environmental Management)
• ISO 45001:2018 (Occupational Health & Safety)
• RIOS (Recycling Industry Operating Standard)
• Other equivalent EHS management standards

Integration Requirements:
• R2-specific hazards and controls must be addressed
• Focus Materials management integrated into EHSMS
• Data security requirements incorporated
• Emergency response procedures for R2 activities
• Worker competency and training programs

EHSMS Structure:
1. Context and Leadership
   - Organization context and stakeholder needs
   - Leadership commitment and EHS policy
   - Roles, responsibilities, and authorities

2. Planning
   - Risk assessment and opportunity identification
   - Legal and other requirements management
   - EHS objectives and planning to achieve them

3. Support and Operation
   - Resource allocation and competence management
   - Communication and documentation control
   - Operational planning and controls

4. Performance Evaluation
   - Monitoring, measurement, and evaluation
   - Internal audit programs
   - Management review processes

5. Improvement
   - Nonconformity and corrective action
   - Continuous improvement initiatives`
                },
                {
                    id: 'risk-assessment',
                    title: 'Risk Assessment and Hazard Management',
                    type: 'WORKSHOP',
                    content: `Comprehensive risk assessment is fundamental to effective EHSMS implementation.

Risk Assessment Process:
1. Hazard Identification
   - Physical hazards (moving equipment, electrical)
   - Chemical hazards (batteries, CRTs, mercury)
   - Biological hazards (contamination)
   - Ergonomic hazards (lifting, repetitive motion)

2. Risk Evaluation
   - Likelihood assessment (probability of occurrence)
   - Consequence assessment (severity of harm)
   - Risk rating matrix application
   - Existing control effectiveness evaluation

3. Risk Control Hierarchy
   - Elimination (remove hazard completely)
   - Substitution (replace with safer alternative)
   - Engineering controls (ventilation, barriers)
   - Administrative controls (procedures, training)
   - Personal protective equipment (PPE)

4. Risk Monitoring
   - Regular review and update procedures
   - Incident investigation and analysis
   - Performance indicator tracking
   - Management review and improvement

R2-Specific Risk Areas:
• Focus Materials handling and exposure
• Data-bearing device security breaches
• Chemical exposure from processing
• Physical injury from equipment operation
• Environmental releases and contamination`
                },
                {
                    id: 'worker-protection',
                    title: 'Worker Protection and Safety Programs',
                    type: 'PRACTICAL',
                    content: `Worker protection is a critical EHSMS component requiring comprehensive programs and procedures.

Essential Protection Programs:

1. Personal Protective Equipment (PPE)
   - Hazard assessment and PPE selection
   - Training on proper use and maintenance
   - Inspection and replacement procedures
   - Documentation and record keeping

2. Chemical Exposure Management
   - Material safety data sheet (SDS) management
   - Exposure assessment and monitoring
   - Medical surveillance programs (where required)
   - Emergency response procedures

3. Equipment Safety
   - Machine guarding and safety systems
   - Lockout/tagout procedures
   - Preventive maintenance programs
   - Operator training and certification

4. Emergency Preparedness
   - Emergency action plans
   - Evacuation procedures
   - First aid and medical response
   - Incident reporting and investigation

5. Training and Competency
   - New employee orientation programs
   - Job-specific safety training
   - Refresher training schedules
   - Competency assessment and records

Implementation Requirements:
• Written procedures for all programs
• Regular training and competency assessment
• Monitoring and performance measurement
• Management review and improvement
• Integration with R2-specific requirements`
                }
            ],
            resources: [
                {
                    id: 'ehsms-template',
                    title: 'R2v3 EHSMS Template Package',
                    type: 'TEMPLATE',
                    url: '/resources/ehsms-template-package.zip',
                    description: 'Complete EHSMS documentation templates for R2v3 compliance'
                },
                {
                    id: 'risk-assessment-tool',
                    title: 'Risk Assessment Tool',
                    type: 'TEMPLATE',
                    url: '/resources/risk-assessment-tool.xlsx',
                    description: 'Excel-based risk assessment and management tool'
                },
                {
                    id: 'iso-integration-guide',
                    title: 'ISO Integration Guide',
                    type: 'PDF',
                    url: '/resources/iso-integration-guide.pdf',
                    description: 'Guide to integrating ISO standards with R2v3 requirements'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'ehs-q1',
                        question: 'Which standards are acceptable frameworks for R2v3 EHSMS?',
                        type: 'MULTIPLE_CHOICE',
                        options: [
                            'Only ISO 14001',
                            'ISO 14001, ISO 45001, and RIOS',
                            'Any company-developed system',
                            'Only RIOS for recycling facilities'
                        ],
                        correctAnswer: 'ISO 14001, ISO 45001, and RIOS',
                        explanation: 'R2v3 accepts ISO 14001, ISO 45001, RIOS, and other equivalent EHS management standards as frameworks.'
                    }
                ]
            }
        }
    },
    // Module 5: Core Requirement 4 - Legal and Other Requirements  
    {
        id: 'core-4-legal-requirements',
        title: 'Core Requirement 4: Legal and Other Requirements',
        description: 'Build legal compliance plan, understand import/export laws, labor laws, maintain audit records',
        category: 'CORE_REQUIREMENT',
        difficulty: 'INTERMEDIATE',
        estimatedTime: 120, // 2 hours
        requirements: ['core-3-ehs-management'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Legal compliance is fundamental to R2v3 certification. This module covers comprehensive legal requirements management including permits, import/export laws, labor compliance, and audit record maintenance.',
            learningObjectives: [
                'Build and maintain comprehensive legal compliance register',
                'Understand import/export legal verification procedures',
                'Implement environmental permit and reporting requirements',
                'Establish ethical labor and fair-practice policies',
                'Maintain complete audit and compliance records'
            ],
            sections: [
                {
                    id: 'legal-compliance-framework',
                    title: 'Legal Compliance Management Framework',
                    type: 'TEXT',
                    content: `R2v3 requires comprehensive compliance with all applicable laws and regulations.

Legal Compliance Categories:

1. Business and Entity Requirements
   - Valid business licenses and registrations
   - Corporate governance and structure
   - Tax compliance and reporting
   - Professional liability insurance
   - Contract and agreement management

2. Environmental Laws and Regulations
   - Waste management permits and licenses
   - Air quality permits and monitoring
   - Water discharge permits and compliance
   - Hazardous materials handling authorizations
   - Emergency response and reporting requirements

3. Occupational Health and Safety Laws
   - OSHA compliance and reporting
   - Worker safety and training requirements
   - Workplace injury and illness prevention
   - Emergency action and response plans
   - Worker compensation and benefits compliance

4. Import/Export Regulations
   - Customs and trade compliance
   - International shipping documentation
   - Restricted and prohibited materials management
   - Basel Convention compliance (where applicable)
   - Export control and licensing requirements

5. Data Protection and Privacy Laws
   - Customer data handling and protection
   - Employee privacy and confidentiality
   - Data breach notification requirements
   - Cross-border data transfer compliance
   - Record retention and disposal requirements`
                },
                {
                    id: 'compliance-register',
                    title: 'Building Legal Compliance Register',
                    type: 'WORKSHOP',
                    content: `A legal compliance register is a comprehensive database of all applicable legal requirements.

Register Development Process:

1. Legal Requirement Identification
   - Federal, state, and local law research
   - Industry-specific regulation review
   - International requirements (for exports)
   - Customer contractual requirements
   - Insurance and financial obligations

2. Requirement Documentation
   - Legal citation and reference
   - Specific compliance obligations
   - Responsible parties and roles
   - Compliance deadlines and schedules
   - Monitoring and verification methods

3. Status Tracking and Monitoring
   - Current compliance status
   - Required actions and timelines
   - Renewal dates and schedules
   - Audit and inspection records
   - Nonconformance and corrective actions

4. Regular Review and Updates
   - Periodic legal requirement updates
   - New regulation identification
   - Compliance status verification
   - Change notification processes
   - Management review and approval

Register Maintenance:
• Monthly compliance status reviews
• Quarterly legal update assessments
• Annual comprehensive register review
• Immediate updates for new requirements
• Management review of compliance performance`
                },
                {
                    id: 'import-export-compliance',
                    title: 'Import/Export Legal Verification',
                    type: 'PRACTICAL',
                    content: `Import/export compliance is critical for facilities handling international shipments.

Export Compliance Requirements:

1. Destination Country Research
   - Import restrictions and prohibitions
   - Required permits and documentation
   - Customs and duty requirements
   - Environmental and safety standards
   - Local processing and disposal laws

2. Shipping Documentation
   - Commercial invoices and packing lists
   - Export declarations and permits
   - Bills of lading and transport documents
   - Insurance and liability coverage
   - Chain of custody documentation

3. Restricted Materials Management
   - Hazardous substance identification
   - Export control classification
   - Special handling requirements
   - Documentation and tracking systems
   - Compliance verification procedures

Import Compliance Requirements:

1. Source Country Verification
   - Legal export authorization confirmation
   - Proper documentation review
   - Transportation compliance verification
   - Chain of custody validation
   - Quality and condition assessment

2. Customs and Regulatory Compliance
   - Import permit and license verification
   - Customs declaration accuracy
   - Duty and tax payment compliance
   - Inspection and quarantine requirements
   - Record keeping and documentation

Due Diligence Process:
• Vendor qualification and verification
• Legal compliance documentation review
• On-site assessments (where feasible)
• Ongoing monitoring and auditing
• Corrective action for nonconformances`
                }
            ],
            resources: [
                {
                    id: 'compliance-register-template',
                    title: 'Legal Compliance Register Template',
                    type: 'TEMPLATE',
                    url: '/resources/legal-compliance-register.xlsx',
                    description: 'Excel template for managing legal compliance requirements'
                },
                {
                    id: 'import-export-guide',
                    title: 'Import/Export Compliance Guide',
                    type: 'PDF',
                    url: '/resources/import-export-guide.pdf',
                    description: 'Comprehensive guide to international compliance requirements'
                },
                {
                    id: 'legal-update-service',
                    title: 'Legal Update Service Guide',
                    type: 'PDF',
                    url: '/resources/legal-update-service.pdf',
                    description: 'Guide to establishing legal update monitoring services'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'legal-q1',
                        question: 'How often should the legal compliance register be reviewed and updated?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Annually', 'Quarterly', 'Monthly for status, quarterly for updates', 'Only when regulations change'],
                        correctAnswer: 'Monthly for status, quarterly for updates',
                        explanation: 'Best practice requires monthly compliance status reviews and quarterly assessment of legal updates to ensure current compliance.'
                    }
                ]
            }
        }
    },
    // Module 6: Core Requirement 5 - Tracking Throughput
    {
        id: 'core-5-tracking-throughput',
        title: 'Core Requirement 5: Tracking Throughput',
        description: 'Learn recordkeeping standards, inventory limits, data logging templates, and digital systems',
        category: 'CORE_REQUIREMENT',
        difficulty: 'INTERMEDIATE',
        estimatedTime: 90, // 1.5 hours
        requirements: ['core-4-legal-requirements'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Throughput tracking is essential for R2v3 compliance and operational management. This module covers comprehensive recordkeeping systems, inventory management, and digital tracking solutions.',
            learningObjectives: [
                'Implement comprehensive recordkeeping for inbound and outbound materials',
                'Establish inventory limits and storage duration controls',
                'Create effective documentation templates and systems',
                'Deploy digital tracking solutions for throughput management',
                'Maintain audit-ready records and chain of custody documentation'
            ],
            sections: [
                {
                    id: 'recordkeeping-standards',
                    title: 'Recordkeeping Standards and Practices',
                    type: 'TEXT',
                    content: `Accurate and complete recordkeeping is fundamental to R2v3 compliance and operational transparency.

Key Record Types:
• Inbound Material Records: Source, quantity, date received, generator information, initial assessment.
• Processing Records: Material types processed, equipment used, quantities, dates, operator.
• Outbound Material Records: Destination, quantity, date shipped, downstream vendor, manifest/bill of lading.
• Inventory Records: Material type, quantity, location, date received, storage duration.
• Waste Disposal Records: Disposal method, location, vendor, certificates of disposal.
• Training Records: Employee training on R2v3 requirements and procedures.
• Audit Records: Internal and external audit reports, corrective actions.
• Management System Records: Policy documents, procedures, meeting minutes, management reviews.

Retention Requirements:
• R2v3 typically requires records to be retained for a minimum of 3-5 years, or as specified by legal requirements.
• Chain of custody documentation must be maintained for all R2-controlled materials.

Documentation Best Practices:
• Standardized templates for all record types.
• Clear and concise data entry.
• Secure storage and easy retrieval.
• Regular review and verification of records.
• Integration with digital tracking systems where possible.`
                },
                {
                    id: 'inventory-limits',
                    title: 'Inventory Limits and Storage Controls',
                    type: 'WORKSHOP',
                    content: `Effective inventory management is crucial for operational efficiency, safety, and compliance.

Inventory Management Principles:
• Maximum Storage Limits: Define maximum quantities of each material type that can be stored on-site to prevent exceeding capacity or posing safety risks.
• Storage Duration Controls: Establish maximum time limits for materials to remain in storage, preventing obsolescence or degradation.
• Segregation and Organization: Store materials in designated, organized areas based on type, hazard, or processing stage.
• Environmental Controls: Maintain appropriate environmental conditions (temperature, humidity) for sensitive materials.
• Security Measures: Implement security measures to prevent theft, unauthorized access, or damage to stored materials.

Developing Inventory Procedures:
1. Identify all material types and storage areas.
2. Determine maximum safe storage quantities for each area.
3. Establish maximum storage durations based on material type and operational flow.
4. Implement a system for tracking inventory levels and storage times.
5. Define procedures for managing aged or excess inventory.
6. Regularly review and update inventory limits and controls.`
                },
                {
                    id: 'digital-tracking-systems',
                    title: 'Digital Tracking Systems and Data Logging',
                    type: 'PRACTICAL',
                    content: `Leveraging digital systems enhances accuracy, efficiency, and traceability of throughput data.

Key Features of Digital Systems:
• Real-time tracking of inbound and outbound materials.
• Automated data logging and reporting.
• Inventory management and stock level monitoring.
• Chain of custody tracking throughout the process.
• Integration with EHS and compliance management modules.
• Audit trail for all data entries and modifications.

System Selection Considerations:
• Scalability: Can the system handle current and future volumes?
• Functionality: Does it meet all R2v3 tracking and reporting requirements?
• Usability: Is it user-friendly for staff?
• Cost: Does it fit the budget?
• Vendor Support: Is reliable support available?

Data Logging Best Practices:
• Standardize data entry fields.
• Train users on system operation.
• Implement data validation checks.
• Regularly back up system data.
• Ensure secure access controls.`
                }
            ],
            resources: [
                {
                    id: 'throughput-tracking-template',
                    title: 'Throughput Tracking System Template',
                    type: 'TEMPLATE',
                    url: '/resources/throughput-tracking-template.xlsx',
                    description: 'Excel template for tracking inbound and outbound materials'
                },
                {
                    id: 'inventory-management-guide',
                    title: 'Inventory Management Best Practices',
                    type: 'PDF',
                    url: '/resources/inventory-management-guide.pdf',
                    description: 'Guide to optimizing inventory control and storage'
                },
                {
                    id: 'chain-of-custody-form',
                    title: 'Chain of Custody Form Template',
                    type: 'TEMPLATE',
                    url: '/resources/chain-of-custody-form.docx',
                    description: 'Template for documenting material chain of custody'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'tracking-q1',
                        question: 'What is the typical minimum retention period for R2v3 records?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['1 year', '3-5 years', '7 years', 'Indefinitely'],
                        correctAnswer: '3-5 years',
                        explanation: 'R2v3 generally requires records to be retained for 3-5 years, but legal requirements may dictate longer periods.'
                    }
                ]
            }
        }
    },
    // Module 7: Core Requirement 6 - Sorting, Categorization, and Processing
    {
        id: 'core-6-sorting-categorization',
        title: 'Core Requirement 6: Sorting, Categorization, and Processing',
        description: 'Implement REC system, define controlled streams, establish processing procedures',
        category: 'CORE_REQUIREMENT',
        difficulty: 'INTERMEDIATE',
        estimatedTime: 120, // 2 hours
        requirements: ['core-5-tracking-throughput'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Effective sorting, categorization, and processing are vital for R2v3 compliance. This module covers the R2 Equipment Categorization (REC) system, controlled stream management, and best practices for processing operations.',
            learningObjectives: [
                'Understand and apply the R2 Equipment Categorization (REC) system',
                'Identify and manage R2-controlled streams of materials',
                'Develop and implement standardized processing procedures',
                'Ensure proper segregation and handling of materials',
                'Integrate processing with environmental, health, and safety requirements'
            ],
            sections: [
                {
                    id: 'rec-system-overview',
                    title: 'R2 Equipment Categorization (REC) System',
                    type: 'TEXT',
                    content: `The REC system is a standardized method for classifying and tracking electronic equipment and its components throughout the recycling process. It ensures that materials are handled according to their potential risks and value.

REC Categories:
• REC 1: R2 Device - Equipment with data storage capability. Requires data security measures.
• REC 2: Focus Material - Items containing hazardous substances (e.g., batteries, CRTs, mercury switches). Requires specialized handling and environmental controls.
• REC 3: Other Equipment - General electronic equipment not falling into REC 1 or REC 2.
• REC 4: Component - Parts harvested from R2 devices or other equipment.

Classification Process:
1. Initial assessment of incoming equipment.
2. Identification of data storage capability (REC 1).
3. Identification of potential Focus Materials (REC 2).
4. Categorization based on REC definitions.
5. Assignment of appropriate handling and processing procedures.

Importance of REC:
• Ensures data security for devices containing sensitive information.
• Manages environmental risks associated with hazardous materials.
• Facilitates accurate tracking and reporting of throughput.
• Supports compliance with downstream vendor requirements.`
                },
                {
                    id: 'controlled-streams-management',
                    title: 'Managing Controlled Streams',
                    type: 'INTERACTIVE',
                    content: `Controlled streams are specific material flows that require heightened management due to R2v3 requirements (e.g., data security, focus materials).

Key Controlled Streams:
• Data-Bearing Devices (REC 1): Require strict data sanitization or destruction protocols.
• Focus Materials (REC 2): Require specialized handling, storage, and disposal to prevent environmental contamination.
• Hazardous Wastes: Any waste stream classified as hazardous under applicable regulations.
• Exported Materials: Materials destined for international shipment, requiring compliance with export laws.

Management Procedures:
• Dedicated collection and storage areas for controlled streams.
• Clear labeling and identification of controlled materials.
• Strict access controls to areas handling sensitive materials.
• Documented procedures for handling, processing, and disposition of each controlled stream.
• Chain of custody documentation for all movements of controlled materials.
• Regular audits to ensure adherence to procedures.`
                },
                {
                    id: 'processing-procedures-development',
                    title: 'Developing Processing Procedures',
                    type: 'PRACTICAL',
                    content: `Standardized processing procedures ensure consistency, safety, and compliance across all operations.

Procedure Development Steps:
1. Define the scope and purpose of each processing activity.
2. Identify all required steps, inputs, and outputs.
3. Specify equipment, tools, and materials needed.
4. Detail safety precautions and required PPE.
5. Outline environmental protection measures.
6. Document quality control checks.
7. Specify recordkeeping requirements.
8. Include procedures for handling nonconformities.
9. Obtain necessary approvals and communicate to staff.

Examples of Processing Procedures:
• Hard drive shredding and destruction
• Battery removal and segregation
• CRT glass processing
• Component harvesting and testing
• Precious metal recovery

Integration with EHS:
• All processing procedures must align with the EHSMS.
• Risk assessments should inform procedure development.
• Emergency response plans should address potential processing hazards.`
                }
            ],
            resources: [
                {
                    id: 'rec-mapping-guide',
                    title: 'R2 Equipment Categorization (REC) Mapping Guide',
                    type: 'PDF',
                    url: '/resources/rec-mapping-guide.pdf',
                    description: 'Comprehensive guide to classifying R2 equipment'
                },
                {
                    id: 'controlled-stream-procedures',
                    title: 'Controlled Stream Management Procedures Template',
                    type: 'TEMPLATE',
                    url: '/resources/controlled-stream-procedures.docx',
                    description: 'Template for developing procedures for managing controlled streams'
                },
                {
                    id: 'processing-operations-manual',
                    title: 'Processing Operations Manual',
                    type: 'PDF',
                    url: '/resources/processing-operations-manual.pdf',
                    description: 'Best practices for electronics processing operations'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'sorting-q1',
                        question: 'Which REC category is assigned to devices with data storage capability?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['REC 1', 'REC 2', 'REC 3', 'REC 4'],
                        correctAnswer: 'REC 1',
                        explanation: 'REC 1 is designated for R2 Devices, which are electronic devices capable of storing data, requiring data security measures.'
                    },
                    {
                        id: 'sorting-q2',
                        question: 'What is a key characteristic of a controlled stream in R2v3?',
                        type: 'MULTIPLE_CHOICE',
                        options: [
                            'It is any material processed in the facility.',
                            'It requires heightened management due to R2v3 requirements like data security or focus materials.',
                            'It is a material that has been sorted and categorized.',
                            'It is a material destined for export.'
                        ],
                        correctAnswer: 'It requires heightened management due to R2v3 requirements like data security or focus materials.',
                        explanation: 'Controlled streams are material flows that need special attention due to R2v3 mandates such as data security or focus material handling.'
                    }
                ]
            }
        }
    },
    // Module 8: Core Requirement 7 - Data Security
    {
        id: 'core-7-data-security',
        title: 'Core Requirement 7: Data Security',
        description: 'NIST 800-88 compliance, data sanitization procedures, and secured areas',
        category: 'CORE_REQUIREMENT',
        difficulty: 'ADVANCED',
        estimatedTime: 120, // 2 hours
        requirements: ['core-6-sorting-categorization'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Data security is a critical R2v3 requirement. This module covers NIST 800-88 compliance, secure handling of data-bearing devices, sanitization methods, and maintaining chain of custody.',
            learningObjectives: [
                'Understand and implement NIST SP 800-88 guidelines for media sanitization',
                'Establish secure procedures for handling data-bearing devices',
                'Implement effective data sanitization and destruction methods',
                'Maintain chain of custody for all data-bearing devices',
                'Develop and manage secured areas for data processing'
            ],
            sections: [
                {
                    id: 'nist-800-88-guidelines',
                    title: 'NIST SP 800-88 Media Sanitization',
                    type: 'TEXT',
                    content: `NIST Special Publication 800-88 provides definitive guidance on media sanitization, ensuring data is irrecoverable.

Key Concepts:
• Sanitization: Process of rendering data on media unusable.
• Clear: Overwriting data with a pattern, typically done by software. Verifiable.
• Purge: More robust process that makes data recovery infeasible, often involving physical processes like degaussing or overwriting multiple times. Verifiable.
• Destroy: Physical destruction of the media (shredding, incineration, pulverization). Irreversible.
• Verification: Confirming that sanitization has been successfully completed.
• Documentation: Maintaining thorough records of all sanitization activities.

Sanitization Levels:
• Clear: Suitable for media that will remain in use.
• Purge: Suitable for media that will be reused or repurposed.
• Destroy: Required for media that will be disposed of or recycled.

R2v3 Requirement: Facilities must use methods that meet or exceed NIST 800-88 standards for data sanitization.`
                },
                {
                    id: 'secure-handling-and-storage',
                    title: 'Secure Handling and Storage of Data-Bearing Devices',
                    type: 'INTERACTIVE',
                    content: `Protecting data-bearing devices from unauthorized access is paramount.

Secure Handling Procedures:
• Restricted Access: Limit access to areas where data-bearing devices are stored or processed to authorized personnel only.
• Chain of Custody: Implement a robust chain of custody system from the moment a device is received until its final disposition. This includes detailed logs of who handled the device, when, and where it was moved.
• Secure Transportation: Ensure internal and external transportation of data-bearing devices is secure, using locked containers and verified routes.
• Visitor Management: Escort all visitors in areas handling data-bearing devices and maintain visitor logs.
• Employee Training: Train all personnel involved in handling data-bearing devices on security protocols and their responsibilities.

Secured Areas:
• Dedicated, physically secured areas for receiving, storing, and processing data-bearing devices.
• Access control systems (e.g., key cards, biometric scanners).
• Surveillance systems (CCTV) with recorded footage.
• Alarms and intrusion detection systems.
• Regular security audits of these areas.`
                },
                {
                    id: 'sanitization-and-destruction-methods',
                    title: 'Data Sanitization and Destruction Methods',
                    type: 'PRACTICAL',
                    content: `Choosing the correct method ensures data is irrecoverable and complies with R2v3 and NIST 800-88.

Methods for Media Types:
• Magnetic Media (HDDs): Degaussing, physical destruction (shredding, crushing). Overwriting can be used for 'Clear' but not always sufficient for 'Purge' or 'Destroy'.
• Solid State Media (SSDs, USB drives): Secure overwrite (multiple passes), cryptographic erasure, physical destruction (shredding, incineration). Degaussing is ineffective.
• Optical Media (CDs, DVDs): Physical destruction (shredding, incineration).

Verification and Documentation:
• Each sanitization event must be verified.
• Maintain detailed records of:
    - Device serial numbers or unique identifiers.
    - Sanitization method used.
    - Date and time of sanitization.
    - Operator performing the sanitization.
    - Verification results.
• Issue Certificates of Data Destruction upon completion.

R2v3 Specifics:
• Appendix B (Data Sanitization) and Core Requirement 7 (Data Security) must be addressed.
• Procedures must be documented and auditable.`
                }
            ],
            resources: [
                {
                    id: 'nist-800-88-guide',
                    title: 'NIST 800-88 Implementation Guide',
                    type: 'PDF',
                    url: '/resources/nist-800-88-guide.pdf',
                    description: 'Practical implementation guide for NIST 800-88 compliance'
                },
                {
                    id: 'data-sanitization-plan-template',
                    title: 'Data Sanitization Plan Template',
                    type: 'TEMPLATE',
                    url: '/resources/data-sanitization-plan-template.docx',
                    description: 'Template for creating a comprehensive data sanitization plan'
                },
                {
                    id: 'incident-response-log',
                    title: 'Incident Response Log Template',
                    type: 'TEMPLATE',
                    url: '/resources/incident-response-log.xlsx',
                    description: 'Template for logging and managing security incidents'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'data-sec-q1',
                        question: 'Which NIST 800-88 sanitization method is most appropriate for SSDs that will be destroyed?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Clear', 'Purge (Degaussing)', 'Purge (Overwriting)', 'Destroy'],
                        correctAnswer: 'Destroy',
                        explanation: 'Physical destruction is the most reliable method for rendering data on SSDs irrecoverable, especially when the media is being disposed of.'
                    },
                    {
                        id: 'data-sec-q2',
                        question: 'What is a critical component of secure handling for data-bearing devices?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Leaving devices unattended in open areas', 'Implementing a robust chain of custody system', 'Allowing unrestricted visitor access', 'Using standard office storage'],
                        correctAnswer: 'Implementing a robust chain of custody system',
                        explanation: 'A strong chain of custody ensures accountability and security from receipt to final disposition of data-bearing devices.'
                    }
                ]
            }
        }
    },
    // Module 9: Core Requirement 8 - Focus Materials
    {
        id: 'core-8-focus-materials',
        title: 'Core Requirement 8: Focus Materials',
        description: 'Identify, manage, and track focus materials (mercury, batteries, PCBs, etc.)',
        category: 'CORE_REQUIREMENT',
        difficulty: 'INTERMEDIATE',
        estimatedTime: 90, // 1.5 hours
        requirements: ['core-7-data-security'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Managing focus materials is critical for environmental protection and R2v3 compliance. This module covers identification, handling, tracking, and legal requirements for focus materials.',
            learningObjectives: [
                'Identify all applicable focus materials within incoming streams',
                'Implement procedures for safe handling and storage of focus materials',
                'Establish tracking systems for focus materials from receipt to final disposition',
                'Comply with all legal and regulatory requirements for focus materials',
                'Integrate focus materials management into the EHSMS'
            ],
            sections: [
                {
                    id: 'focus-materials-identification',
                    title: 'Identification of Focus Materials',
                    type: 'TEXT',
                    content: `Focus Materials are specific components within electronic equipment that require careful management due to their environmental or health hazards.

Common Focus Materials in R2v3:
• Mercury-Containing Equipment (MCE): e.g., LCD screens, fluorescent lamps, mercury switches.
• Batteries: Various types including lithium-ion, lead-acid, nickel-cadmium.
• PCBs: Polychlorinated biphenyls found in older transformers, capacitors.
• CRT Glass: Lead content in older cathode ray tube displays.
• Thermal Fuses: Containing mercury or other hazardous substances.
• Other Hazardous Components: As identified by regulations or risk assessments.

Identification Process:
1. Review incoming equipment and components for known focus materials.
2. Consult product specifications and Safety Data Sheets (SDS).
3. Train staff to recognize visual indicators of focus materials.
4. Integrate identification into initial sorting and categorization processes (REC system).
5. Maintain an updated list of focus materials relevant to your operations.`
                },
                {
                    id: 'safe-handling-and-storage',
                    title: 'Safe Handling and Storage',
                    type: 'INTERACTIVE',
                    content: `Proper handling and storage are essential to prevent environmental contamination and worker exposure.

Handling Procedures:
• Minimize breakage of MCE and CRTs.
• Use appropriate PPE (gloves, eye protection, respirators if needed).
• Handle batteries carefully to avoid short circuits or damage.
• Segregate focus materials from general waste streams immediately upon identification.

Storage Requirements:
• Designated, secure storage areas with appropriate containment (e.g., spill pallets for batteries, sealed containers for mercury).
• Protect focus materials from damage, extreme temperatures, or moisture.
• Ensure storage areas are well-ventilated and clearly labeled.
• Maintain inventory records of stored focus materials.
• Comply with local regulations regarding storage quantities and duration.`
                },
                {
                    id: 'tracking-and-disposition',
                    title: 'Tracking and Legal Disposition',
                    type: 'PRACTICAL',
                    content: `Tracking focus materials from receipt to final disposition ensures compliance and accountability.

Tracking Requirements:
• Document receipt of focus materials, including type and quantity.
• Record internal movements and storage locations.
• Maintain records of downstream vendors used for recycling or disposal.
• Obtain and retain manifests, bills of lading, and certificates of disposal from vendors.
• Ensure downstream vendors are R2v3 compliant or otherwise certified/licensed.

Legal and Regulatory Compliance:
• Adhere to federal, state, and local regulations governing hazardous waste, universal waste, and specific focus materials.
• Obtain necessary permits for handling, storage, and transportation.
• Comply with reporting requirements for certain hazardous materials.
• Understand export restrictions on hazardous wastes.

Integration with EHSMS:
• Incorporate focus materials management into the EHSMS risk assessment and operational control procedures.
• Ensure emergency response plans address potential incidents involving focus materials.`
                }
            ],
            resources: [
                {
                    id: 'focus-materials-guide',
                    title: 'Focus Materials Identification and Management Guide',
                    type: 'PDF',
                    url: '/resources/focus-materials-guide.pdf',
                    description: 'Comprehensive guide to identifying and managing R2 focus materials'
                },
                {
                    id: 'focus-materials-management-plan-template',
                    title: 'Focus Materials Management Plan Template',
                    type: 'TEMPLATE',
                    url: '/resources/focus-materials-management-plan-template.docx',
                    description: 'Template for developing a facility-specific focus materials plan'
                },
                {
                    id: 'downstream-vendor-requirements',
                    title: 'Downstream Vendor Requirements and Due Diligence',
                    type: 'PDF',
                    url: '/resources/downstream-vendor-requirements.pdf',
                    description: 'Guidance on qualifying and managing downstream vendors for focus materials'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'fm-q1',
                        question: 'Which of the following is typically considered a Focus Material under R2v3?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Standard plastic casings', 'Computer monitors with mercury', 'Power cords', 'Empty aluminum cans'],
                        correctAnswer: 'Computer monitors with mercury',
                        explanation: 'Mercury-containing equipment, such as older computer monitors, is classified as a Focus Material due to its hazardous components.'
                    }
                ]
            }
        }
    },
    // Module 10: Core Requirement 9 - Facility Standards
    {
        id: 'core-9-facility-standards',
        title: 'Core Requirement 9: Facility Standards',
        description: 'Ensure facility meets physical, security, and environmental standards',
        category: 'CORE_REQUIREMENT',
        difficulty: 'INTERMEDIATE',
        estimatedTime: 90, // 1.5 hours
        requirements: ['core-8-focus-materials'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'This module covers the physical, security, and environmental standards required for R2v3 certified facilities, ensuring a safe and compliant operating environment.',
            learningObjectives: [
                'Ensure facility design and layout supports R2v3 operations',
                'Implement robust physical security measures',
                'Maintain environmental controls and containment',
                'Develop and implement a facility closure plan',
                'Obtain and maintain adequate insurance coverage'
            ],
            sections: [
                {
                    id: 'facility-design',
                    title: 'Facility Design and Layout',
                    type: 'TEXT',
                    content: `R2v3 facilities must be designed and maintained to support safe, secure, and efficient processing of electronic equipment and materials.

Design Requirements:
• Segregated processing areas for different material types
• Controlled access points and security barriers
• Adequate storage areas with appropriate conditions
• Processing equipment placement and safety zones
• Emergency access and evacuation routes
• Environmental controls (temperature, humidity, ventilation)`
                },
                {
                    id: 'security-systems',
                    title: 'Security and Access Control',
                    type: 'TEXT',
                    content: `Security measures must protect materials, data, and personnel throughout the facility.

Security Requirements:
• Perimeter security (fencing, barriers, lighting)
• Access control systems (key cards, biometrics, logs)
• Surveillance systems (cameras, monitoring, recording)
• Alarm systems (intrusion, fire, emergency)
• Visitor management and escort procedures
• Security incident response procedures`
                },
                {
                    id: 'environmental-controls',
                    title: 'Environmental Controls and Containment',
                    type: 'TEXT',
                    content: `Facilities must implement measures to prevent environmental contamination.

Environmental Controls:
• Secondary containment for liquid storage areas (e.g., fuel, oils).
• Proper ventilation to manage air quality.
• Temperature and humidity controls where necessary for material stability or safety.
• Spill prevention and response plans.
• Stormwater management systems.
• Waste segregation and containment.`
                },
                {
                    id: 'facility-closure-plan',
                    title: 'Facility Closure Plan and Financial Assurance',
                    type: 'TEXT',
                    content: `A closure plan ensures that the facility can be safely decommissioned at the end of its operational life.

Closure Plan Elements:
• Procedures for dismantling equipment and infrastructure.
• Plans for removal and proper disposal of all residual materials.
• Site remediation and restoration activities.
• Estimated costs for closure.

Financial Assurance:
• Demonstrate financial capability to fund closure activities.
• Options include trust funds, surety bonds, or insurance policies.
• Requirement may vary by jurisdiction and material handled.`
                }
            ],
            resources: [
                {
                    id: 'facility-security-guide',
                    title: 'R2v3 Facility Security Guide',
                    type: 'PDF',
                    url: '/resources/facility-security-guide.pdf',
                    description: 'Complete guide to facility security requirements'
                },
                {
                    id: 'facility-closure-template',
                    title: 'Facility Closure Plan Template',
                    type: 'TEMPLATE',
                    url: '/resources/facility-closure-template.docx',
                    description: 'Template for developing a comprehensive facility closure plan'
                },
                {
                    id: 'insurance-requirements-guide',
                    title: 'Insurance Requirements Guide',
                    type: 'PDF',
                    url: '/resources/insurance-requirements-guide.pdf',
                    description: 'Overview of insurance coverage needed for R2v3 facilities'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'facility-q1',
                        question: 'What is a key component of R2v3 facility standards regarding environmental protection?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Allowing uncontrolled discharge of wastewater', 'Implementing secondary containment for liquids', 'Using open-air storage for all materials', 'Neglecting ventilation systems'],
                        correctAnswer: 'Implementing secondary containment for liquids',
                        explanation: 'Secondary containment is a crucial measure to prevent environmental contamination from spills of liquids.'
                    }
                ]
            }
        }
    },
    // Module 11: Core Requirement 10 - Transport
    {
        id: 'core-10-transport',
        title: 'Core Requirement 10: Transport',
        description: 'Ensure safe, secure, and documented transport of materials',
        category: 'CORE_REQUIREMENT',
        difficulty: 'INTERMEDIATE',
        estimatedTime: 90, // 1.5 hours
        requirements: ['core-9-facility-standards'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'This module covers the requirements for safe, secure, and legally compliant transportation of electronic materials, including chain of custody and documentation.',
            learningObjectives: [
                'Implement safe and secure transportation practices',
                'Ensure compliance with all relevant transport regulations',
                'Maintain chain of custody documentation for all shipments',
                'Select and manage qualified transport providers',
                'Document all transport activities thoroughly'
            ],
            sections: [
                {
                    id: 'transport-safety-security',
                    title: 'Safe and Secure Transport Practices',
                    type: 'TEXT',
                    content: `Transportation of electronic materials must prioritize safety and security to prevent accidents, environmental releases, and unauthorized access.

Key Practices:
• Proper Packaging: Ensure materials are packaged securely to prevent damage, spills, or leaks during transit.
• Load Securing: Properly secure loads to prevent shifting or falling during transport.
• Vehicle Maintenance: Regularly maintain transport vehicles to ensure operational safety.
• Driver Training: Train drivers on safe handling procedures, emergency response, and regulatory compliance.
• Route Planning: Plan routes to avoid sensitive areas and minimize transit time where possible.
• Security Measures: Implement security measures to prevent theft or tampering during transit, especially for data-bearing devices or valuable materials.`
                },
                {
                    id: 'regulatory-compliance',
                    title: 'Transport Regulatory Compliance',
                    type: 'TEXT',
                    content: `Compliance with national and international transport regulations is mandatory.

Key Regulations:
• Department of Transportation (DOT) regulations (USA) for hazardous materials.
• International agreements like ADR (Europe), IATA (air cargo), IMDG (maritime).
• Customs and import/export regulations for cross-border shipments.
• Specific waste transport regulations.

Compliance Measures:
• Correct classification, labeling, and placarding of shipments.
• Use of licensed and approved transport providers.
• Accurate shipping documentation (e.g., bills of lading, manifests).
• Adherence to weight and dimension limits.
• Emergency response information readily available.`
                },
                {
                    id: 'chain-of-custody-documentation',
                    title: 'Chain of Custody Documentation',
                    type: 'TEXT',
                    content: `Maintaining a continuous chain of custody is essential for accountability and traceability.

Documentation Requirements:
• Detailed records of material pickup, including date, time, location, and quantity.
• Identification of the carrier and driver.
• Tracking information for the shipment.
• Record of delivery, including date, time, location, and recipient.
• Signatures at each transfer point.
• Special handling instructions documented.

Digital Tracking Integration:
• Utilize GPS tracking and electronic logs where feasible to enhance real-time visibility and data accuracy.`
                },
                {
                    id: 'transport-provider-management',
                    title: 'Managing Transport Providers',
                    type: 'PRACTICAL',
                    content: `Selecting and managing qualified transport providers is critical for ensuring compliance and reliability.

Selection Criteria:
• Valid licenses and permits.
• Proven safety record.
• Insurance coverage appropriate for the materials transported.
• Experience with electronic waste or hazardous materials (if applicable).
• Compliance with R2v3 requirements for downstream vendors.

Management Practices:
• Formal contracts outlining responsibilities and requirements.
• Regular performance monitoring and audits.
• Verification of driver qualifications and vehicle maintenance.
• Procedures for addressing noncompliance or incidents.`
                }
            ],
            resources: [
                {
                    id: 'transport-safety-guide',
                    title: 'Safe Transport of E-Waste Guide',
                    type: 'PDF',
                    url: '/resources/transport-safety-guide.pdf',
                    description: 'Best practices for safe and secure transportation of electronic materials'
                },
                {
                    id: 'transport-provider-agreement-template',
                    title: 'Transport Provider Agreement Template',
                    type: 'TEMPLATE',
                    url: '/resources/transport-provider-agreement-template.docx',
                    description: 'Template for contracts with transport providers'
                },
                {
                    id: 'hazardous-materials-shipping-guide',
                    title: 'Hazardous Materials Shipping Guide',
                    type: 'PDF',
                    url: '/resources/hazardous-materials-shipping-guide.pdf',
                    description: 'Overview of regulations for shipping hazardous materials'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'transport-q1',
                        question: 'What is a primary goal of maintaining a chain of custody for transported materials?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['To increase shipping costs', 'To ensure accountability and traceability', 'To simplify documentation', 'To allow for less secure handling'],
                        correctAnswer: 'To ensure accountability and traceability',
                        explanation: 'Chain of custody documentation provides a verifiable record of material handling and movement, ensuring accountability and traceability throughout the transport process.'
                    }
                ]
            }
        }
    },
    // Appendix Modules
    {
        id: 'appendix-a-downstream-recycling',
        title: 'Appendix A: Downstream Recycling Chain',
        description: 'Ensuring responsible downstream management, vendor qualification, and auditing',
        category: 'APPENDIX',
        difficulty: 'ADVANCED',
        estimatedTime: 120,
        requirements: ['core-10-transport'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Appendix A addresses the critical requirement of ensuring that all downstream recycling and disposal activities are conducted responsibly and in compliance with R2v3 standards.',
            learningObjectives: [
                'Understand the importance of downstream vendor management',
                'Develop a robust vendor qualification process',
                'Implement ongoing monitoring and auditing of downstream vendors',
                'Ensure compliance with all legal and ethical requirements for downstream partners',
                'Maintain comprehensive records of downstream activities'
            ],
            sections: [
                {
                    id: 'downstream-vendor-qualification',
                    title: 'Downstream Vendor Qualification',
                    type: 'TEXT',
                    content: `Thorough qualification of downstream vendors is the first step in ensuring responsible recycling.

Qualification Process:
1. Define requirements for downstream partners (e.g., certifications, licenses, R2v3 compliance).
2. Request and review vendor documentation (e.g., certifications, permits, EHS policies).
3. Conduct on-site audits or virtual assessments to verify practices.
4. Assess vendor's ability to manage materials responsibly, including data security and environmental protection.
5. Evaluate vendor's financial stability and reputation.
6. Document the qualification process and decision.`
                },
                {
                    id: 'downstream-monitoring-auditing',
                    title: 'Ongoing Monitoring and Auditing',
                    type: 'INTERACTIVE',
                    content: `Continuous monitoring and periodic audits are necessary to ensure ongoing compliance of downstream vendors.

Monitoring Activities:
• Regular review of vendor performance reports and metrics.
• Periodic requests for updated certifications and permits.
• Tracking of any incidents or nonconformances reported by vendors.

Auditing Procedures:
• Develop an audit schedule based on risk assessment and vendor performance.
• Conduct audits (on-site or remote) to verify compliance with contractual obligations and R2v3 standards.
• Focus audits on key areas such as data security, environmental practices, and material disposition.
• Document audit findings and require corrective actions from vendors.`
                },
                {
                    id: 'documentation-and-recordkeeping',
                    title: 'Documentation and Recordkeeping',
                    type: 'PRACTICAL',
                    content: `Maintaining thorough records of all downstream activities is essential for demonstrating due diligence and compliance.

Required Documentation:
• Signed contracts and agreements with downstream vendors.
• Qualification records for each vendor.
• Audit reports and corrective action plans.
• Manifests and bills of lading for all material transfers.
• Certificates of recycling or disposal.
• Records of communication and performance reviews.

Record Retention:
• Retain all downstream documentation for the period required by R2v3 and applicable regulations (typically 3-5 years).`
                }
            ],
            resources: [
                {
                    id: 'downstream-vendor-qualification-template',
                    title: 'Downstream Vendor Qualification Checklist',
                    type: 'TEMPLATE',
                    url: '/resources/downstream-vendor-qualification-checklist.docx',
                    description: 'Checklist for qualifying downstream recycling vendors'
                },
                {
                    id: 'downstream-audit-protocol',
                    title: 'Downstream Vendor Audit Protocol',
                    type: 'PDF',
                    url: '/resources/downstream-audit-protocol.pdf',
                    description: 'Protocol for conducting audits of downstream recycling partners'
                },
                {
                    id: 'downstream-vendor-management-plan',
                    title: 'Downstream Vendor Management Plan Template',
                    type: 'TEMPLATE',
                    url: '/resources/downstream-vendor-management-plan-template.docx',
                    description: 'Template for creating a comprehensive downstream vendor management plan'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'appendix-a-q1',
                        question: 'What is the primary goal of Appendix A in R2v3?',
                        type: 'MULTIPLE_CHOICE',
                        options: [
                            'To define internal processing standards',
                            'To ensure responsible management of materials by downstream vendors',
                            'To outline data security requirements',
                            'To specify EHS management system components'
                        ],
                        correctAnswer: 'To ensure responsible management of materials by downstream vendors',
                        explanation: 'Appendix A focuses on ensuring that all downstream recycling and disposal partners manage materials responsibly and in compliance with R2v3 principles.'
                    }
                ]
            }
        }
    },
    // Module 12: Appendix B - Data Sanitization
    {
        id: 'appendix-b-data-sanitization',
        title: 'Appendix B: Data Sanitization',
        description: 'Detailed procedures for data sanitization and destruction',
        category: 'APPENDIX',
        difficulty: 'ADVANCED',
        estimatedTime: 90,
        requirements: ['core-7-data-security'],
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Appendix B provides specific requirements for data sanitization, building upon Core Requirement 7. This module delves into detailed procedures, verification, and documentation.',
            learningObjectives: [
                'Implement advanced data sanitization techniques',
                'Verify the effectiveness of sanitization processes',
                'Maintain meticulous records for data destruction audits',
                'Understand the legal implications of data breaches',
                'Integrate data sanitization with broader security protocols'
            ],
            sections: [
                {
                    id: 'advanced-sanitization-techniques',
                    title: 'Advanced Sanitization Techniques',
                    type: 'TEXT',
                    content: `This section expands on NIST 800-88, detailing specific techniques applicable to various media.

Techniques Include:
• Secure Overwrite Standards (e.g., DoD 5220.22-M, NIST 800-88 R1/R2)
• Degaussing specifications for magnetic media.
• Physical destruction methods (shredding, incineration, pulverization) and required particle sizes.
• Cryptographic erasure for modern SSDs and encrypted drives.
• Verification methods for each technique (e.g., read-back tests, visual inspection of destroyed media).`
                },
                {
                    id: 'verification-and-documentation',
                    title: 'Verification and Comprehensive Documentation',
                    type: 'INTERACTIVE',
                    content: `Robust verification and documentation are non-negotiable for data sanitization.

Verification Procedures:
• Sample-based verification for large volumes.
• Complete verification for critical data or high-risk devices.
• Use of calibrated equipment for physical destruction verification.
• Independent third-party verification services.

Documentation Requirements:
• Detailed logs for each device processed (serial numbers, unique IDs).
• Record of the specific sanitization method employed.
• Date, time, and operator performing the process.
• Results of verification procedures.
• Certificates of Data Destruction issued for each batch or device.
• Maintaining logs for a minimum of 5 years.`
                },
                {
                    id: 'legal-implications-and-protocols',
                    title: 'Legal Implications and Incident Response',
                    type: 'PRACTICAL',
                    content: `Understanding potential legal consequences and having effective incident response protocols are vital.

Legal Ramifications:
• Significant fines and penalties for data breaches due to non-compliance.
• Reputational damage and loss of customer trust.
• Potential lawsuits from affected individuals or entities.

Incident Response Plan:
• Procedures for detecting and reporting potential data breaches or failures in sanitization.
• Roles and responsibilities for incident management.
• Communication protocols (internal and external, including regulatory bodies).
• Containment and remediation strategies.
• Post-incident analysis and corrective actions.`
                }
            ],
            resources: [
                {
                    id: 'data-sanitization-guidelines',
                    title: 'Data Sanitization Guidelines Document',
                    type: 'PDF',
                    url: '/resources/data-sanitization-guidelines.pdf',
                    description: 'Detailed guide on data sanitization procedures'
                },
                {
                    id: 'nist-800-88-standard',
                    title: 'NIST 800-88 Standard Document',
                    type: 'PDF',
                    url: '/resources/nist-800-88-standard.pdf',
                    description: 'Official NIST Special Publication 800-88'
                },
                {
                    id: 'equipment-handling-procedures',
                    title: 'Equipment Handling and Chain of Custody Procedures',
                    type: 'PDF',
                    url: '/resources/equipment-handling-procedures.pdf',
                    description: 'Procedures for secure handling and tracking of electronic equipment'
                },
                {
                    id: 'data-sanitization-plan',
                    title: 'Document Template: Data Sanitization Plan',
                    type: 'TEMPLATE',
                    url: '/resources/data-sanitization-plan-template.docx',
                    description: 'Template for creating a comprehensive data sanitization plan'
                },
                {
                    id: 'incident-response-log',
                    title: 'Document Template: Incident Response Log',
                    type: 'TEMPLATE',
                    url: '/resources/incident-response-log.xlsx',
                    description: 'Template for logging and managing security incidents'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'appendix-b-q1',
                        question: 'What is the primary purpose of Appendix B in R2v3?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Facility security standards', 'Focus material management', 'Detailed data sanitization procedures', 'Downstream vendor requirements'],
                        correctAnswer: 'Detailed data sanitization procedures',
                        explanation: 'Appendix B provides specific, detailed requirements and procedures for data sanitization, expanding on the principles in Core Requirement 7.'
                    }
                ]
            }
        }
    },
    // Module 13: Appendix C - Test and Repair (Reuse)
    {
        id: 'appendix-c-test-repair-reuse',
        title: 'Appendix C: Test and Repair (Reuse)',
        description: 'Implementing effective test and repair processes for maximizing reuse',
        category: 'APPENDIX',
        difficulty: 'ADVANCED',
        estimatedTime: 150, // 2.5 hours
        requirements: ['core-2-responsible-management'], // Depends on hierarchy
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'Appendix C promotes the highest level of the hierarchy: Reuse. This module covers establishing robust test and repair processes to maximize the life extension and value retention of electronic equipment.',
            learningObjectives: [
                'Develop effective testing protocols for electronic devices',
                'Implement repair procedures to restore functionality',
                'Establish quality control for reused equipment',
                'Understand marketability and value assessment for reused items',
                'Document reuse processes and track performance'
            ],
            sections: [
                {
                    id: 'testing-protocols',
                    title: 'Developing Testing Protocols',
                    type: 'TEXT',
                    content: `Comprehensive testing ensures devices are fully functional and meet safety standards before being offered for reuse.

Key Protocol Elements:
• Diagnostic Procedures: Systematic checks for all key functions.
• Functional Testing: Verifying core operations (e.g., power on, display, input/output).
• Performance Testing: Assessing speed, capacity, and stability.
• Safety Testing: Checking for electrical safety, battery health, and environmental hazards.
• Data Wiping Verification: Ensuring data has been securely removed (linking to Appendix B).
• Calibration: For devices requiring specific measurements or settings.

Documentation:
• Standardized test procedures for each device type.
• Test result logs, including pass/fail status and any identified issues.`
                },
                {
                    id: 'repair-processes-and-quality',
                    title: 'Repair Processes and Quality Management',
                    type: 'INTERACTIVE',
                    content: `Effective repair processes require skilled technicians, appropriate tools, and quality control.

Repair Procedures:
• Component-level diagnostics and repair.
• Replacement of faulty parts using quality-approved components.
• Soldering and electronic assembly skills.
• Software/firmware updates and configuration.
• Cleaning and cosmetic restoration.

Quality Management Integration:
• Implement a Quality Management System (QMS) aligned with ISO 9001 principles.
• Define quality standards for repaired items (e.g., expected lifespan, performance benchmarks).
• Conduct final inspection and functional testing after repair.
• Track repair success rates and common failure points.`
                },
                {
                    id: 'marketability-and-disposition',
                    title: 'Marketability and Disposition of Reused Equipment',
                    type: 'PRACTICAL',
                    content: `Assessing marketability and choosing appropriate disposition channels are key to successful reuse.

Market Assessment:
• Identify demand for specific types of refurbished equipment.
• Determine pricing based on condition, model, and market value.
• Consider warranty or return policies for reused items.

Disposition Channels:
• Direct sales to consumers or businesses.
• Reseller agreements.
• Donations to charities or educational institutions.
• Trade-in programs.

Documentation:
• Records of sold/donated items, including model, serial number, condition, and sale price/date.
• Tracking of warranty claims or returns related to reused equipment.`
                }
            ],
            resources: [
                {
                    id: 'test-and-repair-manual',
                    title: 'Test and Repair Operations Manual',
                    type: 'PDF',
                    url: '/resources/test-and-repair-manual.pdf',
                    description: 'Comprehensive guide to testing and repairing electronics for reuse'
                },
                {
                    id: 'reuse-quality-standards',
                    title: 'Quality Standards for Reused Equipment',
                    type: 'PDF',
                    url: '/resources/reuse-quality-standards.pdf',
                    description: 'Guidelines for ensuring quality of refurbished electronics'
                },
                {
                    id: 'market-analysis-tools',
                    title: 'Market Analysis Tools for Refurbished Electronics',
                    type: 'LINK',
                    url: '/resources/market-analysis-tools',
                    description: 'Links to resources for assessing market demand and value'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'appendix-c-q1',
                        question: 'Which R2v3 hierarchy level does Appendix C primarily support?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Disposal', 'Materials Recovery', 'Reuse', 'Recycling'],
                        correctAnswer: 'Reuse',
                        explanation: 'Appendix C directly supports the highest level of the R2v3 hierarchy, Reuse, by focusing on testing and repair to extend product life.'
                    }
                ]
            }
        }
    },
    // Module 14: Advanced Modules
    {
        id: 'advanced-audit-preparation',
        title: 'R2v3 Audit Preparation',
        description: 'Preparing for certification audit, document organization, and audit process navigation',
        category: 'ADVANCED',
        difficulty: 'ADVANCED',
        estimatedTime: 120,
        requirements: ['core-10-transport'], // Assuming transport is a prerequisite for final audit prep
        status: 'LOCKED',
        progress: 0,
        content: {
            overview: 'This advanced module prepares organizations for the R2v3 certification audit process, covering audit preparation, document organization, and effective audit management.',
            learningObjectives: [
                'Organize comprehensive audit documentation',
                'Prepare for audit interviews and facility tours',
                'Manage audit logistics and scheduling',
                'Address audit findings and corrective actions',
                'Understand auditor expectations'
            ],
            sections: [
                {
                    id: 'pre-audit-documentation',
                    title: 'Pre-Audit Documentation Organization',
                    type: 'INTERACTIVE',
                    content: 'Learn systematic approaches to organizing all required R2v3 documentation, ensuring easy access for auditors. This includes quality manuals, procedures, records, and evidence of implementation.'
                },
                {
                    id: 'audit-interview-facility-tour',
                    title: 'Preparing for Interviews and Facility Tours',
                    type: 'SCENARIO',
                    content: 'Practice responding to typical auditor questions and guiding auditors through the facility. Understand how to demonstrate compliance effectively.'
                },
                {
                    id: 'addressing-audit-findings',
                    title: 'Managing Audit Findings and Corrective Actions',
                    type: 'PRACTICAL',
                    content: 'Learn the process for receiving, analyzing, and responding to audit findings, including developing and implementing effective corrective actions.'
                }
            ],
            resources: [
                {
                    id: 'audit-prep-checklist',
                    title: 'Comprehensive Audit Preparation Checklist',
                    type: 'PDF',
                    url: '/resources/audit-prep-checklist.pdf',
                    description: '90-day audit preparation timeline and checklist'
                },
                {
                    id: 'internal-audit-checklist',
                    title: 'Document Template: Internal Audit Checklist',
                    type: 'TEMPLATE',
                    url: '/resources/internal-audit-checklist.xlsx',
                    description: 'Template for conducting internal audits and gap analysis'
                },
                {
                    id: 'focus-materials-management-plan',
                    title: 'Document Template: Focus Materials Management Plan',
                    type: 'TEMPLATE',
                    url: '/resources/focus-materials-management-plan-template.docx',
                    description: 'Template for developing a facility-specific focus materials plan'
                },
                {
                    id: 'downstream-vendor-qualification',
                    title: 'Document Template: Downstream Vendor Qualification',
                    type: 'TEMPLATE',
                    url: '/resources/downstream-vendor-qualification-checklist.docx',
                    description: 'Checklist for qualifying downstream recycling vendors'
                },
                {
                    id: 'internal-audit-checklist-2',
                    title: 'Document Template: Internal Audit Checklist',
                    type: 'TEMPLATE',
                    url: '/resources/internal-audit-checklist.xlsx',
                    description: 'Template for conducting internal audits and gap analysis'
                }
            ],
            assessment: {
                passingScore: 80,
                questions: [
                    {
                        id: 'audit-prep-q1',
                        question: 'What is a critical step in preparing for an R2v3 certification audit?',
                        type: 'MULTIPLE_CHOICE',
                        options: ['Ignoring auditor requests', 'Organizing all required documentation meticulously', 'Only preparing the processing floor', 'Hoping the auditor finds no issues'],
                        correctAnswer: 'Organizing all required documentation meticulously',
                        explanation: 'Thorough organization of all R2v3-related documentation is essential for a smooth and successful audit process.'
                    }
                ]
            }
        }
    }
];
// Certification Preparation Program
const CERTIFICATION_PREP_PROGRAM = {
    id: 'r2v3-cert-prep',
    title: 'R2v3 Certification Preparation Program',
    description: 'Comprehensive 180-day preparation program for R2v3 certification based on industry best practices',
    timeline: '180 days',
    phases: [
        {
            id: 'phase-1-foundation',
            title: 'Phase 1: Foundation Building (Days 1-60)',
            description: 'Establish fundamental systems, documentation, and organizational framework for R2v3 compliance',
            duration: '60 days',
            milestone: 'Complete foundation documentation, legal compliance, and basic management systems',
            tasks: [
                {
                    id: 'task-scope-definition',
                    title: 'Define Certification Scope and Boundaries',
                    description: 'Clearly define certification boundaries, identify controlled processes, and prepare scope statement',
                    category: 'Scope Definition',
                    priority: 'HIGH',
                    estimatedTime: '1 week',
                    resources: ['Scope definition guide', 'Scope statement template', 'Multi-site guidance']
                },
                {
                    id: 'task-legal-setup',
                    title: 'Complete Legal and Business Compliance Setup',
                    description: 'Establish legal compliance register, verify permits, and ensure all regulatory requirements are met',
                    category: 'Legal Compliance',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['Legal compliance register template', 'Permit tracking system', 'Import/export guide']
                },
                {
                    id: 'task-facility-assessment',
                    title: 'Conduct Comprehensive Facility Assessment',
                    description: 'Evaluate facility infrastructure, security systems, and physical requirements against R2v3 standards',
                    category: 'Facility Infrastructure',
                    priority: 'HIGH',
                    estimatedTime: '1 week',
                    resources: ['Facility assessment checklist', 'Security requirements guide', 'Infrastructure standards']
                },
                {
                    id: 'task-ehs-framework',
                    title: 'Develop EHS Management System Framework',
                    description: 'Create comprehensive EHSMS based on ISO 14001/45001 or RIOS integrated with R2v3 requirements',
                    category: 'EHS Management',
                    priority: 'HIGH',
                    estimatedTime: '3 weeks',
                    resources: ['EHSMS template package', 'ISO integration guide', 'Risk assessment tools']
                },
                {
                    id: 'task-hierarchy-policy',
                    title: 'Implement Hierarchy of Responsible Management',
                    description: 'Develop policy, decision trees, and procedures for implementing reuse-first hierarchy',
                    category: 'Management Hierarchy',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['Hierarchy implementation guide', 'Decision tree templates', 'Policy templates']
                },
                {
                    id: 'task-documentation-system',
                    title: 'Establish Documentation and Record Management System',
                    description: 'Create comprehensive documentation control system for all R2v3 requirements',
                    category: 'Documentation',
                    priority: 'MEDIUM',
                    estimatedTime: '2 weeks',
                    resources: ['Document control procedures', 'Record retention schedules', 'Template library']
                }
            ]
        },
        {
            id: 'phase-2-implementation',
            title: 'Phase 2: System Implementation (Days 61-120)',
            description: 'Implement operational systems, procedures, and specialized processes for comprehensive R2v3 compliance',
            duration: '60 days',
            milestone: 'All operational systems implemented, tested, and validated for R2v3 compliance',
            tasks: [
                {
                    id: 'task-throughput-tracking',
                    title: 'Implement Throughput Tracking System',
                    description: 'Deploy comprehensive material tracking, inventory management, and chain of custody documentation',
                    category: 'Throughput Management',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['Tracking system templates', 'Inventory management tools', 'Chain of custody forms']
                },
                {
                    id: 'task-rec-classification',
                    title: 'Deploy REC Classification System',
                    description: 'Implement R2 Equipment Categorization system for material classification and controlled stream management',
                    category: 'Material Classification',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['REC mapping guide', 'Classification procedures', 'Training materials']
                },
                {
                    id: 'task-data-security',
                    title: 'Establish Comprehensive Data Security Program',
                    description: 'Implement NIST 800-88 compliant data security and destruction procedures with secured areas',
                    category: 'Data Security',
                    priority: 'HIGH',
                    estimatedTime: '3 weeks',
                    resources: ['NIST 800-88 implementation guide', 'Data destruction templates', 'Security procedures']
                },
                {
                    id: 'task-focus-materials',
                    title: 'Implement Focus Materials Management',
                    description: 'Deploy comprehensive management system for mercury, batteries, PCBs, and other focus materials',
                    category: 'Focus Materials',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['FM management templates', 'EHS procedures', 'Handling protocols']
                },
                {
                    id: 'task-facility-transport',
                    title: 'Complete Facility and Transport Systems',
                    description: 'Finalize facility standards, storage requirements, insurance, and secure transport procedures',
                    category: 'Facility Operations',
                    priority: 'HIGH',
                    estimatedTime: '1 week',
                    resources: ['Facility standards checklist', 'Transport procedures', 'Insurance requirements']
                },
                {
                    id: 'task-appendix-implementation',
                    title: 'Implement Applicable Appendices',
                    description: 'Deploy all applicable appendices (A-G) based on facility scope and activities',
                    category: 'Appendix Implementation',
                    priority: 'MEDIUM',
                    estimatedTime: '3 weeks',
                    resources: ['Appendix implementation guides', 'Specialized procedures', 'Compliance templates']
                },
                {
                    id: 'task-vendor-management',
                    title: 'Deploy Downstream Vendor Management Program',
                    description: 'Establish comprehensive due diligence and ongoing management systems for downstream vendors',
                    category: 'Supply Chain Management',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['Vendor qualification templates', 'Due diligence procedures', 'Contract templates']
                }
            ]
        },
        {
            id: 'phase-3-validation',
            title: 'Phase 3: Validation and Audit Preparation (Days 121-180)',
            description: 'Test all systems, conduct comprehensive internal audits, complete staff training, and achieve audit-ready status',
            duration: '60 days',
            milestone: 'Audit-ready certification status achieved with all systems validated and staff fully trained',
            tasks: [
                {
                    id: 'task-system-integration',
                    title: 'Complete System Integration Testing',
                    description: 'Test integration of all R2v3 systems and validate end-to-end compliance processes',
                    category: 'System Integration',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['Integration testing procedures', 'Validation checklists', 'Performance benchmarks']
                },
                {
                    id: 'task-internal-audit',
                    title: 'Conduct Comprehensive Internal Audit',
                    description: 'Perform complete internal audit covering all Core Requirements and applicable Appendices',
                    category: 'Quality Assurance',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['Internal audit protocol', 'R2v3 audit checklist', 'Gap analysis templates']
                },
                {
                    id: 'task-corrective-actions',
                    title: 'Implement Corrective Actions',
                    description: 'Address all internal audit findings and verify effectiveness of corrective measures',
                    category: 'Quality Improvement',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['Corrective action procedures', 'Root cause analysis tools', 'Verification protocols']
                },
                {
                    id: 'task-staff-training',
                    title: 'Complete Comprehensive Staff Training',
                    description: 'Ensure all personnel are trained and competent in R2v3 requirements relevant to their roles',
                    category: 'Training and Competency',
                    priority: 'HIGH',
                    estimatedTime: '3 weeks',
                    resources: ['Training curriculum', 'Competency assessments', 'Training records system']
                },
                {
                    id: 'task-documentation-review',
                    title: 'Final Documentation Review and Organization',
                    description: 'Complete comprehensive review, organization, and validation of all R2v3 documentation',
                    category: 'Documentation Management',
                    priority: 'HIGH',
                    estimatedTime: '2 weeks',
                    resources: ['Document review checklist', 'Organization guidelines', 'Version control procedures']
                },
                {
                    id: 'task-audit-preparation',
                    title: 'Certification Audit Preparation',
                    description: 'Complete final audit preparation including facility preparation, staff briefing, and logistics',
                    category: 'Audit Preparation',
                    priority: 'HIGH',
                    estimatedTime: '1 week',
                    resources: ['Audit preparation checklist', 'Facility preparation guide', 'Audit day procedures']
                },
                {
                    id: 'task-mock-audit',
                    title: 'Conduct Mock Certification Audit',
                    description: 'Perform final mock audit to validate readiness and identify any remaining preparation needs',
                    category: 'Final Validation',
                    priority: 'HIGH',
                    estimatedTime: '1 week',
                    resources: ['Mock audit protocol', 'External audit consultant', 'Readiness assessment tools']
                }
            ]
        }
    ],
    checklist: [
        // Core Requirement 1: Scope Definition
        {
            id: 'checklist-scope-1',
            category: 'Scope Definition',
            item: 'Certification scope clearly defined and documented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-scope-2',
            category: 'Scope Definition',
            item: 'All controlled processes identified and included in scope',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-scope-3',
            category: 'Scope Definition',
            item: 'Scope statement prepared and approved by management',
            required: true,
            status: 'NOT_STARTED'
        },
        // Core Requirement 2: Hierarchy of Responsible Management
        {
            id: 'checklist-hierarchy-1',
            category: 'Management Hierarchy',
            item: 'Hierarchy policy documented and communicated',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-hierarchy-2',
            category: 'Management Hierarchy',
            item: 'Decision trees for material handling implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-hierarchy-3',
            category: 'Management Hierarchy',
            item: 'Staff trained on hierarchy implementation',
            required: true,
            status: 'NOT_STARTED'
        },
        // Core Requirement 3: EHS Management System
        {
            id: 'checklist-ehs-1',
            category: 'EHS Management',
            item: 'EHSMS based on ISO 14001, 45001, or RIOS implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-ehs-2',
            category: 'EHS Management',
            item: 'Comprehensive risk assessment completed and current',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-ehs-3',
            category: 'EHS Management',
            item: 'Worker protection programs implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-ehs-4',
            category: 'EHS Management',
            item: 'Emergency response procedures established',
            required: true,
            status: 'NOT_STARTED'
        },
        // Core Requirement 4: Legal and Other Requirements
        {
            id: 'checklist-legal-1',
            category: 'Legal Compliance',
            item: 'Legal compliance register established and maintained',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-legal-2',
            category: 'Legal Compliance',
            item: 'All required permits and licenses current and valid',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-legal-3',
            category: 'Legal Compliance',
            item: 'Import/export compliance procedures implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-legal-4',
            category: 'Legal Compliance',
            item: 'Labor law compliance verified and documented',
            required: true,
            status: 'NOT_STARTED'
        },
        // Core Requirement 5: Tracking Throughput
        {
            id: 'checklist-tracking-1',
            category: 'Throughput Tracking',
            item: 'Comprehensive tracking system for all materials implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-tracking-2',
            category: 'Throughput Tracking',
            item: 'Inventory limits established and monitored',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-tracking-3',
            category: 'Throughput Tracking',
            item: 'Chain of custody documentation procedures implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        // Core Requirement 6: Sorting, Categorization, and Processing
        {
            id: 'checklist-rec-1',
            category: 'Material Classification',
            item: 'REC system implemented for all material classification',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-rec-2',
            category: 'Material Classification',
            item: 'Controlled stream identification and management procedures',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-rec-3',
            category: 'Material Classification',
            item: 'Processing procedures documented and implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        // Core Requirement 7: Data Security
        {
            id: 'checklist-data-1',
            category: 'Data Security',
            item: 'Data Sanitization Plan documented and implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-data-2',
            category: 'Data Security',
            item: 'Secured areas established for data-bearing devices',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-data-3',
            category: 'Data Security',
            item: 'NIST 800-88 compliant sanitization procedures implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-data-4',
            category: 'Data Security',
            item: 'Worker authorization and training for data handling',
            required: true,
            status: 'NOT_STARTED'
        },
        // Core Requirement 8: Focus Materials
        {
            id: 'checklist-fm-1',
            category: 'Focus Materials',
            item: 'Focus Materials Management Plan developed',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-fm-2',
            category: 'Focus Materials',
            item: 'All focus materials identified and tracking implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-fm-3',
            category: 'Focus Materials',
            item: 'Downstream management for focus materials verified',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-fm-4',
            category: 'Focus Materials',
            item: 'Focus materials integrated into EHSMS',
            required: true,
            status: 'NOT_STARTED'
        },
        // Core Requirements 9-10: Facility and Transport
        {
            id: 'checklist-facility-1',
            category: 'Facility Operations',
            item: 'Facility meets physical security and storage requirements',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-facility-2',
            category: 'Facility Operations',
            item: 'Closure plan and financial assurance established',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-facility-3',
            category: 'Facility Operations',
            item: 'Appropriate insurance coverage obtained',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-facility-4',
            category: 'Facility Operations',
            item: 'Secure transport procedures implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        // Appendices (applicable based on scope)
        {
            id: 'checklist-appendix-a',
            category: 'Appendix Implementation',
            item: 'Appendix A: Downstream recycling chain verified (if applicable)',
            required: false,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-appendix-b',
            category: 'Appendix Implementation',
            item: 'Appendix B: Data sanitization procedures implemented (if applicable)',
            required: false,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-appendix-c',
            category: 'Appendix Implementation',
            item: 'Appendix C: Test and repair procedures implemented (if applicable)',
            required: false,
            status: 'NOT_STARTED'
        },
        // Management System Requirements
        {
            id: 'checklist-management-1',
            category: 'Management System',
            item: 'Internal audit program established and implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-management-2',
            category: 'Management System',
            item: 'Management review process implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-management-3',
            category: 'Management System',
            item: 'Document control and record management system implemented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-management-4',
            category: 'Management System',
            item: 'Corrective action and continuous improvement processes established',
            required: true,
            status: 'NOT_STARTED'
        },
        // Staff Training and Competency
        {
            id: 'checklist-training-1',
            category: 'Training and Competency',
            item: 'All staff trained on applicable R2v3 requirements',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-training-2',
            category: 'Training and Competency',
            item: 'Competency assessments completed and documented',
            required: true,
            status: 'NOT_STARTED'
        },
        {
            id: 'checklist-training-3',
            category: 'Training and Competency',
            item: 'Training records maintained and current',
            required: true,
            status: 'NOT_STARTED'
        }
    ]
};
class TrainingCenterService {
    // Get all training modules for a user
    async getTrainingModules(userId) {
        // In a full implementation, you would track user progress
        // For now, return all modules with basic status logic
        return R2V3_TRAINING_MODULES.map(module => ({
            ...module,
            status: module.requirements.length === 0 ? 'AVAILABLE' : 'LOCKED',
            progress: 0
        }));
    }
    // Get specific training module
    async getTrainingModule(moduleId, userId) {
        const module = R2V3_TRAINING_MODULES.find(m => m.id === moduleId);
        if (!module)
            return null;
        return {
            ...module,
            status: 'AVAILABLE', // Simplified for demo
            progress: 0
        };
    }
    // Get certification preparation program
    async getCertificationPrep(userId) {
        return CERTIFICATION_PREP_PROGRAM;
    }
    // Get knowledge base articles
    async getKnowledgeBase(category, searchTerm) {
        const knowledgeBase = [
            {
                id: 'kb-r2v3-overview',
                title: 'R2v3 Standard Complete Guide',
                category: 'Standards',
                summary: 'Comprehensive guide to R2v3 certification requirements and framework',
                content: 'This comprehensive guide covers all aspects of R2v3 implementation including Core Requirements, Appendices, certification process, and best practices for achieving and maintaining compliance.',
                tags: ['r2v3', 'standard', 'certification', 'implementation'],
                lastUpdated: '2024-01-15',
                readTime: 25
            },
            {
                id: 'kb-scope-definition',
                title: 'Scope Definition Best Practices',
                category: 'Core Requirements',
                summary: 'Master the art of defining certification scope for R2v3 success',
                content: 'Learn how to properly define certification boundaries, identify controlled processes, handle multi-site scenarios, and create audit-ready scope statements that align with business operations.',
                tags: ['scope', 'certification', 'boundaries', 'multi-site'],
                lastUpdated: '2024-01-22',
                readTime: 15
            },
            {
                id: 'kb-hierarchy-implementation',
                title: 'Hierarchy of Responsible Management Implementation',
                category: 'Core Requirements',
                summary: 'Implement the reuse-first hierarchy effectively in operations',
                content: 'Practical guidance on implementing R2v3\'s hierarchy of responsible management, creating decision trees, developing policies, and ensuring consistent application across all operations.',
                tags: ['hierarchy', 'reuse', 'management', 'decision-making'],
                lastUpdated: '2024-01-20',
                readTime: 18
            },
            {
                id: 'kb-ehs-integration',
                title: 'EHS Management System Integration with R2v3',
                category: 'Core Requirements',
                summary: 'Integrate ISO 14001/45001 or RIOS with R2v3 requirements',
                content: 'Comprehensive guide to integrating recognized EHS management standards with R2v3 requirements, including risk assessment, worker protection, and continuous improvement.',
                tags: ['ehs', 'iso', 'rios', 'integration', 'safety'],
                lastUpdated: '2024-01-25',
                readTime: 30
            },
            {
                id: 'kb-legal-compliance',
                title: 'Legal Compliance Management for R2v3',
                category: 'Core Requirements',
                summary: 'Build and maintain comprehensive legal compliance systems',
                content: 'Learn to create legal compliance registers, manage import/export requirements, ensure labor law compliance, and maintain audit-ready documentation for all legal obligations.',
                tags: ['legal', 'compliance', 'permits', 'import-export'],
                lastUpdated: '2024-01-18',
                readTime: 22
            },
            {
                id: 'kb-throughput-tracking',
                title: 'Throughput Tracking and Inventory Management',
                category: 'Core Requirements',
                summary: 'Master material tracking and inventory control systems',
                content: 'Comprehensive guide to implementing throughput tracking systems, managing inventory limits, creating documentation templates, and maintaining chain of custody records.',
                tags: ['tracking', 'inventory', 'throughput', 'documentation'],
                lastUpdated: '2024-01-21',
                readTime: 20
            },
            {
                id: 'kb-rec-mapping',
                title: 'REC Mapping and Material Classification',
                category: 'Core Requirements',
                summary: 'Master R2 Equipment Categorization for compliance',
                content: 'Learn the R2 Equipment Categorization (REC) system, proper material classification, handling of controlled streams, and integration with processing operations.',
                tags: ['rec', 'classification', 'materials', 'controlled-streams'],
                lastUpdated: '2024-01-19',
                readTime: 25
            },
            {
                id: 'kb-data-security',
                title: 'Data Security and Sanitization Programs',
                category: 'Data Security',
                summary: 'NIST 800-88 implementation and data security best practices',
                content: 'Complete guide to implementing data security programs, NIST 800-88 compliance, secured area management, incident response, and worker authorization systems.',
                tags: ['data', 'security', 'nist', 'sanitization', 'incident-response'],
                lastUpdated: '2024-01-24',
                readTime: 35
            },
            {
                id: 'kb-focus-materials',
                title: 'Focus Materials Management Systems',
                category: 'Core Requirements',
                summary: 'Comprehensive management of mercury, batteries, and other focus materials',
                content: 'Learn to identify, handle, and manage focus materials including mercury devices, batteries, PCBs, CRTs, circuit boards, and solar cells with proper EHS integration.',
                tags: ['focus-materials', 'mercury', 'batteries', 'hazardous', 'management'],
                lastUpdated: '2024-01-23',
                readTime: 28
            },
            {
                id: 'kb-facility-transport',
                title: 'Facility Standards and Transport Requirements',
                category: 'Core Requirements',
                summary: 'Facility infrastructure and secure transport compliance',
                content: 'Comprehensive coverage of facility standards, storage requirements, closure planning, insurance requirements, and secure transport procedures for R2v3 compliance.',
                tags: ['facility', 'transport', 'storage', 'insurance', 'closure'],
                lastUpdated: '2024-01-26',
                readTime: 18
            },
            {
                id: 'kb-downstream-chain',
                title: 'Downstream Recycling Chain Management (Appendix A)',
                category: 'Appendices',
                summary: 'Vendor qualification and supply chain transparency',
                content: 'Master downstream vendor management including due diligence procedures, ongoing monitoring, contract requirements, and maintaining supply chain transparency.',
                tags: ['downstream', 'vendors', 'due-diligence', 'supply-chain', 'appendix-a'],
                lastUpdated: '2024-01-27',
                readTime: 22
            },
            {
                id: 'kb-data-sanitization-appendix',
                title: 'Data Sanitization Implementation (Appendix B)',
                category: 'Appendices',
                summary: 'Advanced data destruction and sanitization procedures',
                content: 'Advanced implementation of Appendix B requirements including sanitization methods, verification procedures, documentation requirements, and quality management integration.',
                tags: ['appendix-b', 'data-destruction', 'sanitization', 'verification'],
                lastUpdated: '2024-01-28',
                readTime: 30
            },
            {
                id: 'kb-test-repair-reuse',
                title: 'Test and Repair for Reuse (Appendix C)',
                category: 'Appendices',
                summary: 'Building effective reuse programs and quality management',
                content: 'Complete guide to implementing test and repair operations, developing reuse plans, integrating with quality management systems, and maximizing reuse opportunities.',
                tags: ['appendix-c', 'reuse', 'test-repair', 'quality-management'],
                lastUpdated: '2024-01-29',
                readTime: 25
            },
            {
                id: 'kb-internal-audit',
                title: 'Internal Auditing and Gap Closure',
                category: 'Implementation',
                summary: 'Conduct effective internal audits and manage corrective actions',
                content: 'Learn to plan and conduct internal audits, identify nonconformances, classify findings, develop corrective actions, and prepare for certification audits.',
                tags: ['internal-audit', 'gap-analysis', 'corrective-action', 'audit-prep'],
                lastUpdated: '2024-01-30',
                readTime: 20
            },
            {
                id: 'kb-continuous-improvement',
                title: 'Continuous Improvement and Surveillance Readiness',
                category: 'Implementation',
                summary: 'Maintain compliance and prepare for surveillance audits',
                content: 'Strategies for maintaining R2v3 compliance, managing surveillance audits, implementing continuous improvement, and ensuring ongoing certification maintenance.',
                tags: ['continuous-improvement', 'surveillance', 'maintenance', 'compliance'],
                lastUpdated: '2024-02-01',
                readTime: 15
            },
            {
                id: 'kb-certification-preparation',
                title: 'R2v3 Certification Audit Preparation',
                category: 'Audit Preparation',
                summary: '180-day preparation program for certification success',
                content: 'Comprehensive preparation program including document organization, staff training, facility preparation, timeline management, and audit day strategies.',
                tags: ['certification', 'audit-prep', 'preparation', 'timeline'],
                lastUpdated: '2024-02-02',
                readTime: 40
            }
        ];
        let results = knowledgeBase;
        if (category && category !== 'All') {
            results = results.filter(article => article.category === category);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            results = results.filter(article => article.title.toLowerCase().includes(term) ||
                article.summary.toLowerCase().includes(term) ||
                article.tags.some(tag => tag.toLowerCase().includes(term)));
        }
        return results;
    }
    // Get interactive tutorials - REMOVED DUPLICATE (keeping version with userId parameter below)
    // Get user progress tracking
    async getProgressTracking(userId) {
        return {
            userId,
            overallProgress: 25, // Percentage
            modulesCompleted: 2,
            totalModules: R2V3_TRAINING_MODULES.length,
            certificationsEarned: [],
            currentStreak: 5, // Days
            totalLearningTime: 180, // Minutes
            achievements: [
                {
                    id: 'first-module',
                    title: 'First Steps',
                    description: 'Completed your first training module',
                    earnedDate: '2024-01-15'
                }
            ],
            upcomingDeadlines: [
                {
                    id: 'cert-prep-phase-1',
                    title: 'Phase 1 Milestone',
                    dueDate: '2024-02-15',
                    description: 'Complete foundation building phase'
                }
            ]
        };
    }
    // Update module progress
    async updateModuleProgress(userId, moduleId, progress) {
        // In a full implementation, this would update the database
        console.log(`Updated progress for user ${userId}, module ${moduleId}: ${progress}%`);
        return true;
    }
    // Complete module assessment
    async completeModuleAssessment(userId, moduleId, answers) {
        const module = R2V3_TRAINING_MODULES.find(m => m.id === moduleId);
        if (!module?.content.assessment) {
            throw new Error('Assessment not found for this module');
        }
        const assessment = module.content.assessment;
        let correctAnswers = 0;
        // Score the assessment
        answers.forEach((answer, index) => {
            if (answer.selectedAnswer === assessment.questions[index]?.correctAnswer) {
                correctAnswers++;
            }
        });
        const score = Math.round((correctAnswers / assessment.questions.length) * 100);
        const passed = score >= assessment.passingScore;
        return {
            score,
            passed,
            correctAnswers,
            totalQuestions: assessment.questions.length,
            passingScore: assessment.passingScore,
            feedback: passed ?
                'Congratulations! You have successfully completed this module.' :
                'Please review the module content and retake the assessment.',
            detailedResults: answers.map((answer, index) => ({
                questionId: assessment.questions[index]?.id,
                correct: answer.selectedAnswer === assessment.questions[index]?.correctAnswer,
                explanation: assessment.questions[index]?.explanation
            }))
        };
    }
    // Start a training module
    async startModule(userId, moduleId) {
        const module = R2V3_TRAINING_MODULES.find(m => m.id === moduleId);
        if (!module) {
            throw new Error('Module not found');
        }
        // Check prerequisites
        if (module.requirements.length > 0) {
            // In a full implementation, check if prerequisites are completed
            console.log(`Checking prerequisites for module ${moduleId}: ${module.requirements.join(', ')}`);
        }
        return {
            module: {
                ...module,
                status: 'AVAILABLE'
            },
            progress: {
                userId,
                moduleId,
                status: 'in_progress',
                progress: 0,
                startedAt: new Date(),
                timeSpent: 0,
                lastAccessed: new Date()
            }
        };
    }
    // Update training progress
    async updateProgress(userId, moduleId, progressData) {
        console.log(`Updating progress for user ${userId}, module ${moduleId}:`, progressData);
        return {
            userId,
            moduleId,
            status: progressData.status || 'in_progress',
            progress: progressData.progress || 0,
            timeSpent: progressData.timeSpent || 0,
            lastAccessed: new Date(),
            completedSections: progressData.completedSections || [],
            assessmentScores: progressData.assessmentScores || {}
        };
    }
    // Generate certificate
    async generateCertificate(userId, moduleId) {
        const module = R2V3_TRAINING_MODULES.find(m => m.id === moduleId);
        if (!module) {
            throw new Error('Module not found');
        }
        // In a full implementation, check if module is completed
        const certificateId = `cert-${userId}-${moduleId}-${Date.now()}`;
        return {
            certificateId,
            downloadUrl: `/certificates/${certificateId}.pdf`,
            issuedDate: new Date(),
            moduleTitle: module.title,
            recipientName: `User ${userId}`, // Would get from user database
            validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        };
    }
    // Get interactive tutorial
    async getInteractiveTutorial(tutorialId, userId) {
        const tutorials = {
            'facility-walkthrough': {
                id: 'facility-walkthrough',
                title: 'R2v3 Facility Virtual Walkthrough',
                description: 'Interactive walkthrough of a compliant R2v3 facility',
                steps: [
                    {
                        id: 'step-1',
                        title: 'Reception Area',
                        description: 'Learn about intake procedures and documentation requirements',
                        content: 'The reception area is the first point of contact for incoming materials...',
                        interactiveElements: ['security-checkpoint', 'weighing-station', 'documentation-center']
                    },
                    {
                        id: 'step-2',
                        title: 'Processing Floor',
                        description: 'Explore processing equipment and safety procedures',
                        content: 'The processing floor contains specialized equipment for material handling...',
                        interactiveElements: ['disassembly-stations', 'data-destruction-area', 'sorting-systems']
                    }
                ]
            },
            'scope-definition-simulator': {
                id: 'scope-definition-simulator',
                title: 'R2v3 Scope Definition Simulator',
                description: 'Interactive tool to practice determining R2v3 certification scope',
                estimatedTime: 30,
                difficulty: 'INTERMEDIATE',
                steps: [
                    {
                        id: 'step-1',
                        title: 'Facility Assessment',
                        description: 'Evaluate the facility and identify all activities involving electronics',
                        content: 'In this step, you will assess a virtual facility and identify all processes that handle R2-controlled materials.',
                        interactiveElements: ['facility-map', 'activity-checklist', 'process-identification'],
                        validation: {
                            requiredSelections: ['intake', 'processing', 'storage'],
                            feedback: 'Make sure to identify all areas where controlled materials are handled'
                        }
                    },
                    {
                        id: 'step-2',
                        title: 'Boundary Definition',
                        description: 'Define appropriate certification boundaries for the facility',
                        content: 'Based on your assessment, define the physical and operational boundaries for certification.',
                        interactiveElements: ['boundary-drawing', 'exclusion-justification'],
                        validation: {
                            requiredElements: ['physical-boundary', 'operational-scope'],
                            feedback: 'Ensure boundaries are logical and include all controlled processes'
                        }
                    },
                    {
                        id: 'step-3',
                        title: 'Scope Statement Creation',
                        description: 'Create a complete scope statement for the facility',
                        content: 'Draft a comprehensive scope statement that meets R2v3 requirements.',
                        interactiveElements: ['statement-builder', 'template-selector'],
                        validation: {
                            requiredElements: ['legal-entity', 'address', 'activities', 'materials', 'appendices'],
                            feedback: 'Include all required elements for a complete scope statement'
                        }
                    }
                ]
            },
            'data-sanitization-lab': {
                id: 'data-sanitization-lab',
                title: 'Data Sanitization Virtual Laboratory',
                description: 'Virtual lab for practicing data destruction procedures according to NIST 800-88',
                estimatedTime: 45,
                difficulty: 'ADVANCED',
                steps: [
                    {
                        id: 'lab-1',
                        title: 'Device Assessment',
                        description: 'Assess data-bearing devices and determine appropriate sanitization methods',
                        content: 'Learn to identify different types of data-bearing devices and select appropriate sanitization methods.',
                        interactiveElements: ['device-identification', 'method-selection', 'risk-assessment']
                    },
                    {
                        id: 'lab-2',
                        title: 'Sanitization Process',
                        description: 'Practice executing sanitization procedures',
                        content: 'Perform virtual sanitization procedures following NIST 800-88 guidelines.',
                        interactiveElements: ['process-execution', 'verification-procedures', 'documentation']
                    }
                ]
            }
        };
        const tutorial = tutorials[tutorialId];
        if (!tutorial) {
            throw new Error('Tutorial not found');
        }
        return {
            tutorial,
            userProgress: {
                userId,
                tutorialId,
                currentStep: 0,
                completedSteps: [],
                startedAt: new Date(),
                totalTimeSpent: 0
            }
        };
    }
    // Update tutorial progress
    async updateTutorialProgress(userId, tutorialId, stepId, responses) {
        console.log(`Updating tutorial progress for user ${userId}, tutorial ${tutorialId}, step ${stepId}`);
        return {
            stepCompleted: true,
            score: 85, // Would calculate based on responses
            feedback: 'Good work! You have successfully completed this step.',
            nextStepId: `step-${parseInt(stepId.split('-')[1]) + 1}`,
            overallProgress: 33 // Percentage complete
        };
    }
    // Get comprehensive progress tracking
    async getComprehensiveProgress(userId) {
        return {
            userId,
            overallProgress: 42,
            completedModules: 4,
            totalModules: R2V3_TRAINING_MODULES.length,
            totalLearningTime: 480, // minutes
            currentStreak: 7, // days
            certificationsEarned: [
                {
                    id: 'cert-r2v3-overview',
                    title: 'R2v3 Overview Fundamentals',
                    issuedDate: '2024-01-15',
                    moduleId: 'r2v3-overview-fundamentals'
                }
            ],
            achievements: [
                {
                    id: 'first-module',
                    title: 'Getting Started',
                    description: 'Completed your first R2v3 training module',
                    earnedDate: '2024-01-15',
                    icon: '🎯'
                },
                {
                    id: 'assessment-master',
                    title: 'Assessment Master',
                    description: 'Scored 90% or higher on 3 module assessments',
                    earnedDate: '2024-01-20',
                    icon: '🏆'
                },
                {
                    id: 'knowledge-seeker',
                    title: 'Knowledge Seeker',
                    description: 'Read 10 knowledge base articles',
                    earnedDate: '2024-01-18',
                    icon: '📚'
                }
            ],
            upcomingDeadlines: [
                {
                    id: 'cert-prep-phase-2',
                    title: 'Phase 2: System Implementation',
                    dueDate: '2024-03-15',
                    description: 'Complete system implementation phase of certification preparation'
                },
                {
                    id: 'internal-audit-milestone',
                    title: 'Internal Audit Completion',
                    dueDate: '2024-04-01',
                    description: 'Complete comprehensive internal audit'
                }
            ],
            learningPath: {
                currentPhase: 'Foundation Building',
                nextMilestone: 'Complete Core Requirement modules',
                recommendedNextModule: 'core-5-tracking-throughput',
                estimatedTimeToCompletion: '6 weeks'
            },
            performanceMetrics: {
                averageAssessmentScore: 87,
                totalTimeInvestment: 480, // minutes
                completionRate: 85,
                moduleRetentionRate: 92
            }
        };
    }
}
const trainingCenterService = new TrainingCenterService();
export { trainingCenterService as TrainingCenterService };
export default trainingCenterService;
