import { db } from '../db.js';
import { licenses, facilityProfiles } from '../../shared/schema.js';
import { eq, and, count } from "drizzle-orm";
export class LicenseService {
    /**
     * Get license entitlements for a tenant based on pricing strategy
     */
    static async getLicenseEntitlements(tenantId) {
        const license = await db.query.licenses.findFirst({
            where: and(eq(licenses.tenantId, tenantId), eq(licenses.isActive, true))
        });
        if (!license) {
            return {
                maxFacilities: 0,
                maxSeats: 0,
                planName: 'No License',
                canAddFacilities: false
            };
        }
        // Map pricing strategy to facility limits
        const facilityLimits = this.getFacilityLimitsFromPlan(license.planId, license.planName);
        return {
            maxFacilities: facilityLimits.maxFacilities,
            maxSeats: facilityLimits.maxSeats,
            planName: license.planName,
            canAddFacilities: facilityLimits.canAddFacilities
        };
    }
    /**
     * Check if tenant can add a new facility based on license
     */
    static async canAddFacility(tenantId) {
        const entitlements = await this.getLicenseEntitlements(tenantId);
        // Count current active facilities
        const currentFacilitiesResult = await db
            .select({ count: count() })
            .from(facilityProfiles)
            .where(and(eq(facilityProfiles.tenantId, tenantId), eq(facilityProfiles.isActive, true)));
        const currentCount = currentFacilitiesResult[0]?.count || 0;
        if (currentCount >= entitlements.maxFacilities) {
            return {
                allowed: false,
                reason: `License limit reached. Your ${entitlements.planName} plan allows ${entitlements.maxFacilities} facilities.`,
                currentCount,
                maxAllowed: entitlements.maxFacilities
            };
        }
        return {
            allowed: true,
            currentCount,
            maxAllowed: entitlements.maxFacilities
        };
    }
    /**
     * Map plan ID and name to facility limits based on pricing strategy
     */
    static getFacilityLimitsFromPlan(planId, planName) {
        // Business plan mapping based on pricing strategy
        const businessPlans = {
            'business-solo': { maxFacilities: 1, maxSeats: 3, canAddFacilities: true },
            'business-team': { maxFacilities: 2, maxSeats: 10, canAddFacilities: true },
            'business-enterprise': { maxFacilities: 3, maxSeats: 25, canAddFacilities: true },
            'business-standard': { maxFacilities: 5, maxSeats: 25, canAddFacilities: true }
        };
        // Consultant plan mapping
        const consultantPlans = {
            'consultant-starter': { maxFacilities: 2, maxSeats: 5, canAddFacilities: true },
            'consultant-professional': { maxFacilities: 5, maxSeats: 15, canAddFacilities: true },
            'consultant-pro': { maxFacilities: null, maxSeats: 10, canAddFacilities: true }, // Unlimited facilities
            'consultant-enterprise': { maxFacilities: null, maxSeats: 50, canAddFacilities: true }
        };
        // Check business plans first
        if (businessPlans[planId]) {
            return businessPlans[planId];
        }
        // Check consultant plans
        if (consultantPlans[planId]) {
            const plan = consultantPlans[planId];
            return {
                maxFacilities: plan.maxFacilities || 999, // Use high number for unlimited
                maxSeats: plan.maxSeats,
                canAddFacilities: plan.canAddFacilities
            };
        }
        // Fallback: try to extract from planName or use database values
        if (planName.toLowerCase().includes('solo')) {
            return { maxFacilities: 1, maxSeats: 3, canAddFacilities: true };
        }
        else if (planName.toLowerCase().includes('team')) {
            return { maxFacilities: 2, maxSeats: 10, canAddFacilities: true };
        }
        else if (planName.toLowerCase().includes('enterprise')) {
            return { maxFacilities: 3, maxSeats: 25, canAddFacilities: true };
        }
        // Ultimate fallback to database or conservative limits
        return { maxFacilities: 1, maxSeats: 3, canAddFacilities: false };
    }
}
