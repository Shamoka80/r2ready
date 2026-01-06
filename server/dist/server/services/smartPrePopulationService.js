import { db } from '../db';
import { intakeForms, organizationProfiles, facilityProfiles, tenants } from '../../shared/schema';
import { eq } from 'drizzle-orm';
/**
 * Smart Pre-Population Service for Phase 4
 * Intelligently pre-fills intake forms based on available data
 */
export class SmartPrePopulationService {
    /**
     * Generate comprehensive pre-population data for a new intake form
     */
    static async generatePrePopulationData(tenantId, userId) {
        try {
            const prePopulatedFields = {};
            const smartSuggestions = [];
            const dataSources = [];
            // Get onboarding data
            const onboardingData = await this.getOnboardingData(tenantId);
            if (onboardingData) {
                dataSources.push(onboardingData);
                Object.assign(prePopulatedFields, onboardingData.data);
            }
            // Get facility profile data
            const facilityData = await this.getFacilityData(tenantId);
            if (facilityData) {
                dataSources.push(facilityData);
                Object.assign(prePopulatedFields, facilityData.data);
            }
            // Generate industry-based suggestions
            const industrySuggestions = await this.getIndustryBasedSuggestions(tenantId);
            smartSuggestions.push(...industrySuggestions);
            // Generate smart suggestions based on patterns
            const patternSuggestions = await this.generatePatternBasedSuggestions(prePopulatedFields);
            smartSuggestions.push(...patternSuggestions);
            // Calculate overall confidence
            const totalConfidence = dataSources.reduce((sum, source) => sum + source.confidence, 0);
            const avgConfidence = dataSources.length > 0 ? totalConfidence / dataSources.length : 0;
            return {
                prePopulatedFields,
                smartSuggestions,
                confidence: avgConfidence,
                dataSources
            };
        }
        catch (error) {
            console.error('Error generating pre-population data:', error);
            throw error;
        }
    }
    /**
     * Get pre-population data from onboarding profile
     */
    static async getOnboardingData(tenantId) {
        try {
            const profile = await db.query.organizationProfiles.findFirst({
                where: eq(organizationProfiles.tenantId, tenantId)
            });
            if (!profile)
                return null;
            const data = {};
            // Map onboarding fields to intake fields
            if (profile.legalName) {
                data.legalCompanyName = profile.legalName;
            }
            if (profile.entityType) {
                data.businessEntityType = profile.entityType;
            }
            if (profile.taxId) {
                data.taxIdEin = profile.taxId;
            }
            // Address mapping
            if (profile.hqAddress) {
                data.hqStreet = profile.hqAddress;
                data.hqCity = profile.hqCity;
                data.hqState = profile.hqState;
                data.hqCountry = profile.hqCountry;
                data.hqZipCode = profile.hqZipCode;
            }
            // Contact mapping
            if (profile.primaryContactName) {
                data.primaryR2ContactName = profile.primaryContactName;
                data.primaryR2ContactEmail = profile.primaryContactEmail;
                data.primaryR2ContactPhone = profile.primaryContactPhone;
            }
            return {
                source: 'onboarding',
                confidence: 0.95,
                data,
                reasoning: 'Data sourced from completed onboarding profile'
            };
        }
        catch (error) {
            console.error('Error getting onboarding data:', error);
            return null;
        }
    }
    /**
     * Get pre-population data from facility profile
     */
    static async getFacilityData(tenantId) {
        try {
            const facility = await db.query.facilityProfiles.findFirst({
                where: eq(facilityProfiles.tenantId, tenantId)
            });
            if (!facility)
                return null;
            const data = {};
            // Facility-specific mappings
            if (facility.headcount) {
                data.totalEmployees = facility.headcount.toString();
            }
            if (facility.hoursOfOperation) {
                data.operatingSchedule = facility.hoursOfOperation;
            }
            if (facility.floorArea) {
                // Infer facility size category
                const sqft = facility.floorArea;
                if (sqft < 5000) {
                    data.estimatedAuditTimeCategory = '1-2_days';
                }
                else if (sqft < 20000) {
                    data.estimatedAuditTimeCategory = '3-4_days';
                }
                else {
                    data.estimatedAuditTimeCategory = '5+_days';
                }
            }
            // Default to single facility if only one facility profile exists
            data.totalFacilities = '1';
            data.certificationStructureType = 'SINGLE';
            return {
                source: 'facility',
                confidence: 0.85,
                data,
                reasoning: 'Data sourced from facility profile information'
            };
        }
        catch (error) {
            console.error('Error getting facility data:', error);
            return null;
        }
    }
    /**
     * Generate industry-based suggestions
     */
    static async getIndustryBasedSuggestions(tenantId) {
        const suggestions = [];
        try {
            // Get tenant info to determine industry patterns
            const tenant = await db.query.tenants.findFirst({
                where: eq(tenants.id, tenantId)
            });
            if (!tenant)
                return suggestions;
            // Electronics recycling industry suggestions
            suggestions.push({
                field: 'processingActivities',
                suggestedValue: ['Collection', 'Materials Recovery'],
                alternatives: [
                    ['Collection', 'Testing', 'Refurbishment'],
                    ['Collection', 'Data Destruction', 'Materials Recovery'],
                    ['Materials Recovery', 'Disposal']
                ],
                confidence: 0.7,
                reasoning: 'Common processing activities for electronics recycling operations'
            });
            suggestions.push({
                field: 'applicableAppendices',
                suggestedValue: [
                    'Appendix A: Downstream Recycling Chain',
                    'Appendix E: Materials Recovery'
                ],
                alternatives: [
                    ['Appendix A: Downstream Recycling Chain', 'Appendix B: Data Sanitization'],
                    ['Appendix C: Test and Repair', 'Appendix E: Materials Recovery']
                ],
                confidence: 0.6,
                reasoning: 'Typical appendices for electronics recycling operations'
            });
            suggestions.push({
                field: 'certificationType',
                suggestedValue: 'INITIAL',
                alternatives: ['RECERTIFICATION', 'TRANSFER'],
                confidence: 0.8,
                reasoning: 'Most organizations start with initial certification'
            });
            return suggestions;
        }
        catch (error) {
            console.error('Error generating industry suggestions:', error);
            return suggestions;
        }
    }
    /**
     * Generate pattern-based suggestions from existing data
     */
    static async generatePatternBasedSuggestions(existingData) {
        const suggestions = [];
        try {
            // Business entity type influences other fields
            if (existingData.businessEntityType === 'CORPORATION') {
                suggestions.push({
                    field: 'totalFacilities',
                    suggestedValue: '2',
                    alternatives: ['1', '3', '5'],
                    confidence: 0.6,
                    reasoning: 'Corporations often operate multiple facilities'
                });
            }
            // Multi-facility operations pattern
            const facilityCount = parseInt(existingData.totalFacilities || '1');
            if (facilityCount > 1) {
                suggestions.push({
                    field: 'certificationStructureType',
                    suggestedValue: facilityCount <= 3 ? 'CAMPUS' : 'GROUP',
                    alternatives: ['COMMON_PARENT', 'SHARED'],
                    confidence: 0.7,
                    reasoning: 'Multi-facility operations typically use campus or group structures'
                });
                suggestions.push({
                    field: 'estimatedAuditTimeCategory',
                    suggestedValue: facilityCount <= 2 ? '3-4_days' : '5+_days',
                    alternatives: ['1-2_days', '3-4_days', '5+_days'],
                    confidence: 0.8,
                    reasoning: 'Audit time increases with facility count'
                });
            }
            // Processing activities influence appendices
            if (existingData.processingActivities?.includes('Data Destruction')) {
                suggestions.push({
                    field: 'applicableAppendices',
                    suggestedValue: ['Appendix B: Data Sanitization'],
                    alternatives: [],
                    confidence: 0.95,
                    reasoning: 'Data sanitization and destruction activities require Appendix B compliance'
                });
                suggestions.push({
                    field: 'dataSecurityReadiness',
                    suggestedValue: 'We have implemented NIST-compliant data sanitization procedures',
                    alternatives: [
                        'We are developing data security protocols',
                        'We require assistance with data security implementation'
                    ],
                    confidence: 0.6,
                    reasoning: 'Data destruction operations need security protocols'
                });
            }
            if (existingData.processingActivities?.includes('Refurbishment')) {
                suggestions.push({
                    field: 'applicableAppendices',
                    suggestedValue: ['Appendix C: Test and Repair'],
                    alternatives: [],
                    confidence: 0.95,
                    reasoning: 'Test and repair activities require Appendix C compliance'
                });
            }
            return suggestions;
        }
        catch (error) {
            console.error('Error generating pattern suggestions:', error);
            return suggestions;
        }
    }
    /**
     * Apply smart pre-population to an intake form
     */
    static async applySmartPrePopulation(intakeFormId, prePopulationData, userPreferences = { autoApply: false, confidenceThreshold: 0.8 }) {
        try {
            const applied = {};
            const skipped = {};
            // Get current form data to avoid overwriting user input
            const currentForm = await db.query.intakeForms.findFirst({
                where: eq(intakeForms.id, intakeFormId)
            });
            if (!currentForm) {
                throw new Error('Intake form not found');
            }
            // Apply pre-population data
            const updateData = {};
            for (const [field, value] of Object.entries(prePopulationData)) {
                // Skip if field already has user input
                if (currentForm[field] &&
                    currentForm[field] !== null &&
                    currentForm[field] !== '') {
                    skipped[field] = 'Field already has user input';
                    continue;
                }
                // Apply the pre-populated value
                updateData[field] = value;
                applied[field] = value;
            }
            // Update the form if there's data to apply
            if (Object.keys(updateData).length > 0) {
                await db.update(intakeForms)
                    .set({
                    ...updateData,
                    updatedAt: new Date()
                })
                    .where(eq(intakeForms.id, intakeFormId));
            }
            return {
                applied,
                skipped,
                success: true
            };
        }
        catch (error) {
            console.error('Error applying smart pre-population:', error);
            return {
                applied: {},
                skipped: {},
                success: false
            };
        }
    }
}
