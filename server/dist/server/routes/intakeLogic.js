import { db } from '../db.js';
import { intakeForms, recMapping } from '../../shared/schema.js';
import { eq } from "drizzle-orm";
export class IntakeProcessor {
    /**
     * Generate comprehensive assessment scope based on intake form data
     */
    static async generateAssessmentScope(intakeFormId) {
        console.log(`🎯 Generating assessment scope for intake form: ${intakeFormId}`);
        // Fetch intake form data
        const intakeForm = await db.query.intakeForms.findFirst({
            where: eq(intakeForms.id, intakeFormId)
        });
        if (!intakeForm) {
            throw new Error(`Intake form not found: ${intakeFormId}`);
        }
        console.log(`📋 Processing intake form for: ${intakeForm.legalCompanyName}`);
        // Get all available REC mappings
        const allRecMappings = await db.select().from(recMapping);
        console.log(`📊 Found ${allRecMappings.length} REC mappings in database`);
        // Determine applicable RECs
        const applicableRecCodes = await this.determineApplicableRECs(intakeForm, allRecMappings);
        console.log(`🎯 Applicable RECs: ${applicableRecCodes.join(', ')}`);
        // Generate scope statement
        const scopeStatement = this.generateScopeStatement(intakeForm, applicableRecCodes);
        // Determine required appendices
        const requiredAppendices = this.determineRequiredAppendices(intakeForm);
        console.log(`📎 Required appendices: ${requiredAppendices.join(', ')}`);
        // Calculate complexity factors
        const complexityFactors = this.calculateComplexityFactors(intakeForm, applicableRecCodes);
        // Estimate audit days
        const estimatedAuditDays = this.estimateAuditDays(intakeForm, complexityFactors);
        // Identify critical requirements
        const criticalRequirements = this.identifyCriticalRequirements(intakeForm, applicableRecCodes);
        return {
            applicableRecCodes,
            scopeStatement,
            requiredAppendices,
            complexityFactors,
            estimatedAuditDays,
            criticalRequirements
        };
    }
    /**
     * Determine applicable REC codes based on intake form responses
     */
    static async determineApplicableRECs(intakeForm, allRecMappings) {
        const applicableRecs = new Set();
        for (const recMapping of allRecMappings) {
            const isApplicable = await this.evaluateRECApplicability(intakeForm, recMapping);
            if (isApplicable) {
                applicableRecs.add(recMapping.recCode);
                console.log(`  ✅ ${recMapping.recCode}: ${recMapping.recName}`);
            }
        }
        return Array.from(applicableRecs).sort();
    }
    /**
     * Evaluate if a specific REC is applicable to the intake form
     */
    static async evaluateRECApplicability(intakeForm, recMapping) {
        const requirements = recMapping.processingRequirements;
        // Always include mandatory requirements
        if (requirements?.mandatory === true) {
            return true;
        }
        // Evaluate trigger conditions
        if (requirements?.triggers) {
            return this.evaluateTriggerConditions(intakeForm, requirements.triggers);
        }
        // Default applicability rules
        return this.evaluateDefaultApplicability(intakeForm, recMapping.recCode);
    }
    /**
     * Evaluate trigger conditions for REC applicability
     */
    static evaluateTriggerConditions(intakeForm, triggers) {
        for (const [triggerName, condition] of Object.entries(triggers)) {
            if (this.evaluateCondition(intakeForm, condition, triggerName)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Evaluate individual condition expressions
     */
    static evaluateCondition(intakeForm, condition, triggerName) {
        try {
            // Facility count conditions
            if (condition.includes('facility_count > 1') || condition.includes('total_facilities > 1')) {
                const facilityCount = parseInt(intakeForm.totalFacilities || '0');
                return facilityCount > 1;
            }
            // Multi-site conditions
            if (condition.includes('multi_site') && intakeForm.certificationStructureType) {
                return ['CAMPUS', 'GROUP'].includes(intakeForm.certificationStructureType);
            }
            // International operations
            if (condition.includes('international_shipments === true')) {
                return intakeForm.internationalShipments === true;
            }
            // Data destruction activities
            if (condition.includes('data_destruction_activities === true')) {
                return intakeForm.processingActivities?.some((activity) => activity.toLowerCase().includes('data destruction') ||
                    activity.toLowerCase().includes('data sanitization'));
            }
            // Processing activity conditions
            if (condition.includes('processing_activities.includes')) {
                const activities = intakeForm.processingActivities || [];
                if (condition.includes('Refurbishment')) {
                    return activities.includes('Refurbishment');
                }
                if (condition.includes('Materials Recovery')) {
                    return activities.includes('Materials Recovery');
                }
                if (condition.includes('Collection')) {
                    return activities.includes('Collection');
                }
            }
            // Downstream vendor conditions
            if (condition.includes('downstream_vendors > 0') || condition.includes('total_downstream_vendors > 0')) {
                const vendorCount = parseInt(intakeForm.totalDownstreamVendors || '0');
                return vendorCount > 0;
            }
            // Non-R2 vendor conditions
            if (condition.includes('non_r2_vendors > 0') || condition.includes('num_non_r2_dsv > 0')) {
                const nonR2Count = parseInt(intakeForm.numNonR2Dsv || '0');
                return nonR2Count > 0;
            }
            // Focus materials conditions
            if (condition.includes('handles_mercury') || condition.includes('mercury_containing')) {
                return intakeForm.focusMaterials?.some((material) => material.toLowerCase().includes('mercury'));
            }
            if (condition.includes('handles_lead') || condition.includes('lead_containing')) {
                return intakeForm.focusMaterials?.some((material) => material.toLowerCase().includes('lead') || material.toLowerCase().includes('crt'));
            }
            // Structure type conditions
            if (condition.includes('structure_type === \'CAMPUS\'')) {
                return intakeForm.certificationStructureType === 'CAMPUS';
            }
            if (condition.includes('structure_type === \'GROUP\'')) {
                return intakeForm.certificationStructureType === 'GROUP';
            }
            // Collection activities
            if (condition.includes('collection_activities === true') || condition.includes('collection_services === true')) {
                return intakeForm.processingActivities?.includes('Collection');
            }
            // EMS conditions
            if (condition.includes('iso14001') || condition.includes('existing_ems')) {
                return intakeForm.ehsmsType && intakeForm.ehsmsType !== 'NONE';
            }
            console.log(`⚠️ Unhandled condition: ${condition} for trigger: ${triggerName}`);
            return false;
        }
        catch (error) {
            console.error(`Error evaluating condition: ${condition}`, error);
            return false;
        }
    }
    /**
     * Default applicability rules for common REC patterns
     */
    static evaluateDefaultApplicability(intakeForm, recCode) {
        // Legal requirements - always applicable
        if (recCode.startsWith('LEGAL-')) {
            return true;
        }
        // Facility requirements - applicable if facilities exist
        if (recCode.startsWith('FACILITY-')) {
            return parseInt(intakeForm.totalFacilities || '0') > 0;
        }
        // Processing requirements - applicable if processing activities exist
        if (recCode.startsWith('PROC-')) {
            return Array.isArray(intakeForm.processingActivities) && intakeForm.processingActivities.length > 0;
        }
        // Data requirements - applicable if data destruction activities exist
        if (recCode.startsWith('DATA-')) {
            return intakeForm.processingActivities?.some((activity) => activity.toLowerCase().includes('data'));
        }
        // Supply chain requirements - applicable if downstream vendors exist
        if (recCode.startsWith('SUPPLY-')) {
            return parseInt(intakeForm.totalDownstreamVendors || '0') > 0;
        }
        // Appendix requirements - check against applicable appendices
        if (recCode.startsWith('APP-')) {
            const appendixCode = recCode.replace('APP-', 'APP-');
            return intakeForm.applicableAppendices?.includes(appendixCode) ||
                this.determineRequiredAppendices(intakeForm).includes(appendixCode);
        }
        // Management system requirements - always applicable
        if (recCode.startsWith('MGMT-')) {
            return true;
        }
        // Certification requirements - always applicable
        if (recCode.startsWith('CERT-')) {
            return true;
        }
        // Personnel requirements - always applicable
        if (recCode.startsWith('PERSONNEL-')) {
            return true;
        }
        // Default to not applicable for unknown patterns
        return false;
    }
    /**
     * Generate comprehensive scope statement
     */
    static generateScopeStatement(intakeForm, applicableRecCodes) {
        const parts = [];
        // Company and certification type
        const certType = intakeForm.certificationType || 'INITIAL';
        parts.push(`R2v3 ${certType} certification for ${intakeForm.legalCompanyName}`);
        // Facility scope
        const facilityCount = parseInt(intakeForm.totalFacilities || '1');
        if (facilityCount > 1) {
            const structureType = intakeForm.certificationStructureType?.toLowerCase() || 'multi-site';
            parts.push(`covering ${facilityCount} facilities organized as a ${structureType} operation`);
        }
        else {
            parts.push(`for single-facility operations`);
        }
        // Processing activities scope
        if (intakeForm.processingActivities?.length > 0) {
            parts.push(`including ${intakeForm.processingActivities.join(', ')} activities`);
        }
        // International scope
        if (intakeForm.internationalShipments) {
            const countries = intakeForm.primaryCountries || 'international markets';
            parts.push(`with international operations in ${countries}`);
        }
        // Data security scope
        const hasDataActivities = intakeForm.processingActivities?.some((activity) => activity.toLowerCase().includes('data'));
        if (hasDataActivities) {
            parts.push(`incorporating comprehensive data destruction and sanitization services`);
        }
        // Vendor scope
        const vendorCount = parseInt(intakeForm.totalDownstreamVendors || '0');
        if (vendorCount > 0) {
            parts.push(`managing ${vendorCount} downstream vendor relationships`);
        }
        return parts.join(', ') + '.';
    }
    /**
     * Determine required appendices based on intake responses
     */
    static determineRequiredAppendices(intakeForm) {
        const appendices = new Set();
        // Check processing activities for appendix requirements
        const activities = intakeForm.processingActivities || [];
        // Appendix A - Focus Materials
        if (intakeForm.focusMaterials?.length > 0) {
            appendices.add('APP-A');
        }
        // Appendix B - Refurbishment
        if (activities.includes('Refurbishment')) {
            appendices.add('APP-B');
        }
        // Appendix C - Materials Recovery
        if (activities.includes('Materials Recovery') || activities.includes('Metal Recovery')) {
            appendices.add('APP-C');
        }
        // Appendix D - Data Destruction
        if (activities.some((activity) => activity.toLowerCase().includes('data destruction') ||
            activity.toLowerCase().includes('data sanitization'))) {
            appendices.add('APP-D');
        }
        // Appendix E - Downstream Vendors
        const vendorCount = parseInt(intakeForm.totalDownstreamVendors || '0');
        if (vendorCount > 0 || intakeForm.internationalShipments) {
            appendices.add('APP-E');
        }
        // Appendix F - Disposition Hierarchy (when multiple processing activities)
        if (activities.length > 1) {
            appendices.add('APP-F');
        }
        // Appendix G - Transportation (multi-facility or collection services)
        const facilityCount = parseInt(intakeForm.totalFacilities || '1');
        if (facilityCount > 1 || activities.includes('Collection')) {
            appendices.add('APP-G');
        }
        return Array.from(appendices).sort();
    }
    /**
     * Calculate complexity factors for audit planning
     */
    static calculateComplexityFactors(intakeForm, applicableRecCodes) {
        const factors = {
            facilityComplexity: 1.0,
            processComplexity: 1.0,
            dataComplexity: 1.0,
            international: 1.0,
            overall: 1.0
        };
        // Facility complexity
        const facilityCount = parseInt(intakeForm.totalFacilities || '1');
        if (facilityCount > 1) {
            factors.facilityComplexity = Math.min(2.0, 1.0 + (facilityCount - 1) * 0.2);
        }
        if (intakeForm.certificationStructureType === 'GROUP') {
            factors.facilityComplexity *= 1.3;
        }
        else if (intakeForm.certificationStructureType === 'CAMPUS') {
            factors.facilityComplexity *= 1.2;
        }
        // Process complexity
        const activityCount = intakeForm.processingActivities?.length || 1;
        factors.processComplexity = Math.min(2.5, 1.0 + activityCount * 0.15);
        // Data complexity
        const hasDataActivities = intakeForm.processingActivities?.some((activity) => activity.toLowerCase().includes('data'));
        if (hasDataActivities) {
            factors.dataComplexity = 1.5;
        }
        // International complexity
        if (intakeForm.internationalShipments) {
            factors.international = 1.4;
            const countryCount = intakeForm.primaryCountries?.split(',').length || 1;
            factors.international *= Math.min(1.5, 1.0 + countryCount * 0.1);
        }
        // Focus materials complexity
        if (intakeForm.focusMaterials?.length > 0) {
            factors.processComplexity *= 1.2;
        }
        // Vendor complexity
        const vendorCount = parseInt(intakeForm.totalDownstreamVendors || '0');
        if (vendorCount > 5) {
            factors.processComplexity *= Math.min(1.4, 1.0 + vendorCount * 0.02);
        }
        // Calculate overall complexity
        factors.overall = (factors.facilityComplexity + factors.processComplexity +
            factors.dataComplexity + factors.international) / 4;
        return factors;
    }
    /**
     * Estimate audit days based on complexity factors
     */
    static estimateAuditDays(intakeForm, complexityFactors) {
        // Base audit days by certification type
        let baseDays = 3; // Standard initial certification
        if (intakeForm.certificationType === 'RECERTIFICATION') {
            baseDays = 2;
        }
        else if (intakeForm.certificationType === 'SCOPE_EXTENSION') {
            baseDays = 2;
        }
        // Apply complexity multipliers
        const estimatedDays = baseDays * complexityFactors.overall;
        // Round to nearest 0.5 day
        return Math.round(estimatedDays * 2) / 2;
    }
    /**
     * Identify critical requirements based on intake responses
     */
    static identifyCriticalRequirements(intakeForm, applicableRecCodes) {
        const critical = [];
        // Always critical for all organizations
        critical.push('Legal Entity Documentation');
        critical.push('Management System');
        critical.push('Environmental Health & Safety');
        // Data destruction critical requirements
        const hasDataActivities = intakeForm.processingActivities?.some((activity) => activity.toLowerCase().includes('data'));
        if (hasDataActivities) {
            critical.push('NIST 800-88 Data Destruction Compliance');
            critical.push('Data Security Infrastructure');
        }
        // International operations requirements
        if (intakeForm.internationalShipments) {
            critical.push('International Shipment Documentation');
            critical.push('Export Control Compliance');
        }
        // Multi-facility requirements
        const facilityCount = parseInt(intakeForm.totalFacilities || '1');
        if (facilityCount > 1) {
            critical.push('Multi-Site Management Procedures');
            critical.push('Facility Communication Protocols');
        }
        // Focus materials requirements
        if (intakeForm.focusMaterials?.length > 0) {
            critical.push('Focus Materials Management Plan');
            critical.push('Hazardous Material Handling');
        }
        return critical.sort();
    }
    /**
     * Validate intake form completeness
     */
    static validateIntakeCompleteness(intakeData) {
        const requiredFields = [
            'legalCompanyName',
            'businessEntityType',
            'totalFacilities',
            'certificationStructureType',
            'processingActivities',
            'certificationType'
        ];
        const criticalFields = [
            'legalCompanyName',
            'processingActivities',
            'certificationType'
        ];
        const missingFields = requiredFields.filter(field => !intakeData[field]);
        const criticalFieldsMissing = criticalFields.some(field => !intakeData[field]);
        const completionPercentage = Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100);
        return {
            isComplete: missingFields.length === 0,
            missingFields,
            completionPercentage,
            criticalFieldsMissing
        };
    }
    /**
     * Get required appendices from intake form data (legacy method for compatibility)
     */
    static determineRequiredAppendicesFromIntake(intakeData) {
        return this.determineRequiredAppendices(intakeData);
    }
    /**
     * Filter assessment questions based on REC mapping and intake form data
     * @param intakeFormId - ID of the intake form
     * @param assessmentId - ID of the assessment being created
     * @returns Filtered questions and REC mapping statistics
     */
    static async filterQuestionsForAssessment(intakeFormId, assessmentId) {
        console.log(`🔍 Filtering questions for intake ${intakeFormId}, assessment ${assessmentId}`);
        // Import db and schema here to avoid circular dependencies
        const { db } = await import('../db');
        const { intakeForms, questions, recMapping } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        // Fetch intake form data
        const intakeForm = await db.query.intakeForms.findFirst({
            where: eq(intakeForms.id, intakeFormId),
        });
        if (!intakeForm) {
            throw new Error(`Intake form ${intakeFormId} not found`);
        }
        // Fetch REC mappings from database
        const allRecMappings = await db.select().from(recMapping);
        // Determine applicable REC codes based on intake data
        const applicableRecCodes = await this.determineApplicableRECs(intakeForm, allRecMappings);
        console.log(`📋 Applicable REC codes: ${applicableRecCodes.join(', ')}`);
        // Generate scope statement
        const scopeStatement = this.generateScopeStatement(intakeForm, applicableRecCodes);
        // Fetch all active questions from the database
        const allQuestions = await db.query.questions.findMany({
            where: eq(questions.isActive, true),
        });
        console.log(`📊 Total questions in bank: ${allQuestions.length}`);
        // For MVP: Return all questions (no filtering yet)
        // TODO: Implement actual REC-based filtering when question-to-REC mapping is complete
        const filteredQuestions = allQuestions;
        const totalQuestions = allQuestions.length;
        const relevantQuestions = filteredQuestions.length;
        const filteringRatio = totalQuestions > 0 ? relevantQuestions / totalQuestions : 1;
        console.log(`✅ Filtered ${relevantQuestions} of ${totalQuestions} questions (${(filteringRatio * 100).toFixed(1)}%)`);
        return {
            applicableRecCodes,
            scopeStatement,
            totalQuestions,
            relevantQuestions,
            filteringRatio,
            filteredQuestions,
        };
    }
}
