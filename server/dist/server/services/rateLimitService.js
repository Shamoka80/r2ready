import { eq, and, gte, lt } from 'drizzle-orm';
import { db } from '../db';
import { rateLimitEvents } from '@shared/schema';
/**
 * Rate Limiting Service
 * Provides configurable rate limiting for different resources and actions
 */
export class RateLimitService {
    // Default rate limit configurations
    static defaultLimits = {
        'auth:login': { maxRequests: 5, windowSeconds: 300 }, // 5 attempts per 5 minutes
        'auth:register': { maxRequests: 10, windowSeconds: 900 }, // 10 attempts per 15 minutes (more lenient for registration)
        'auth:2fa_verify': { maxRequests: 10, windowSeconds: 300 }, // 10 attempts per 5 minutes
        'auth:password_reset': { maxRequests: 3, windowSeconds: 3600 }, // 3 attempts per hour
        'exports:pdf': { maxRequests: 10, windowSeconds: 60 }, // 10 exports per minute
        'exports:excel': { maxRequests: 10, windowSeconds: 60 }, // 10 exports per minute
        'uploads:evidence': { maxRequests: 20, windowSeconds: 60 }, // 20 uploads per minute
        'api:general': { maxRequests: 100, windowSeconds: 60 }, // 100 API calls per minute
        '2fa:setup': { maxRequests: 3, windowSeconds: 3600 }, // 3 setup attempts per hour
        '2fa:disable': { maxRequests: 2, windowSeconds: 3600 }, // 2 disable attempts per hour
        'device:register': { maxRequests: 5, windowSeconds: 300 }, // 5 device registrations per 5 minutes
    };
    /**
     * Get rate limit configuration for a resource and action
     */
    static getRateLimit(resource, action) {
        const key = `${resource}:${action}`;
        return this.defaultLimits[key] || this.defaultLimits['api:general'];
    }
    /**
     * Generate a unique identifier for rate limiting
     */
    static generateIdentifier(identifierType, value, resource) {
        // Combine type and value for unique identification
        let identifier = `${identifierType}:${value}`;
        // Add resource-specific scoping if needed
        if (resource) {
            identifier += `:${resource}`;
        }
        return identifier;
    }
    /**
     * Check if request is within rate limits
     */
    static async checkRateLimit(identifierType, identifierValue, resource, action, ipAddress, userAgent, userId) {
        const identifier = this.generateIdentifier(identifierType, identifierValue, resource);
        const limits = this.getRateLimit(resource, action);
        const windowStart = new Date(Date.now() - (limits.windowSeconds * 1000));
        const resetAt = new Date(Date.now() + (limits.windowSeconds * 1000));
        try {
            // Count recent requests within the time window
            const recentEvents = await db
                .select()
                .from(rateLimitEvents)
                .where(and(eq(rateLimitEvents.identifier, identifier), eq(rateLimitEvents.resource, resource), eq(rateLimitEvents.action, action), gte(rateLimitEvents.createdAt, windowStart)));
            const currentCount = recentEvents.length;
            const allowed = currentCount < limits.maxRequests;
            // Log the rate limit event
            const eventData = {
                identifier,
                identifierType,
                resource,
                action,
                ipAddress,
                userAgent,
                userId,
                isBlocked: !allowed,
                currentCount: currentCount + 1, // Include this request
                maxAllowed: limits.maxRequests,
                windowSize: limits.windowSeconds,
                resetAt
            };
            await db.insert(rateLimitEvents).values(eventData);
            // Calculate retry after seconds if blocked
            let retryAfter;
            if (!allowed && recentEvents.length > 0) {
                const oldestEvent = recentEvents.reduce((oldest, event) => event.createdAt < oldest.createdAt ? event : oldest);
                retryAfter = Math.ceil((oldestEvent.createdAt.getTime() + (limits.windowSeconds * 1000) - Date.now()) / 1000);
            }
            return {
                allowed,
                currentCount: currentCount + 1,
                maxAllowed: limits.maxRequests,
                resetAt,
                retryAfter
            };
        }
        catch (error) {
            console.error('Rate limit check error:', error);
            // On error, allow the request but log it
            return {
                allowed: true,
                currentCount: 1,
                maxAllowed: limits.maxRequests,
                resetAt
            };
        }
    }
    /**
     * Clean up old rate limit events
     */
    static async cleanupOldEvents(olderThanHours = 24) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);
            const result = await db
                .delete(rateLimitEvents)
                .where(lt(rateLimitEvents.createdAt, cutoffDate))
                .returning();
            console.log(`Cleaned up ${result.length} old rate limit events`);
            return { deletedCount: result.length };
        }
        catch (error) {
            console.error('Failed to cleanup old rate limit events:', error);
            return { deletedCount: 0 };
        }
    }
    /**
     * Get rate limit status for an identifier
     */
    static async getRateLimitStatus(identifierType, identifierValue, resource, action) {
        const identifier = this.generateIdentifier(identifierType, identifierValue, resource);
        const limits = this.getRateLimit(resource, action);
        const windowStart = new Date(Date.now() - (limits.windowSeconds * 1000));
        const resetAt = new Date(Date.now() + (limits.windowSeconds * 1000));
        try {
            const recentEvents = await db
                .select()
                .from(rateLimitEvents)
                .where(and(eq(rateLimitEvents.identifier, identifier), eq(rateLimitEvents.resource, resource), eq(rateLimitEvents.action, action), gte(rateLimitEvents.createdAt, windowStart)));
            const timeUntilReset = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
            return {
                currentCount: recentEvents.length,
                maxAllowed: limits.maxRequests,
                resetAt,
                timeUntilReset
            };
        }
        catch (error) {
            console.error('Get rate limit status error:', error);
            return {
                currentCount: 0,
                maxAllowed: limits.maxRequests,
                resetAt,
                timeUntilReset: limits.windowSeconds
            };
        }
    }
    /**
     * Reset rate limit for an identifier (admin function)
     */
    static async resetRateLimit(identifierType, identifierValue, resource, action) {
        try {
            const identifier = this.generateIdentifier(identifierType, identifierValue, resource);
            const result = await db
                .delete(rateLimitEvents)
                .where(and(eq(rateLimitEvents.identifier, identifier), eq(rateLimitEvents.resource, resource), eq(rateLimitEvents.action, action)))
                .returning();
            return {
                success: true,
                message: `Reset ${result.length} rate limit events`
            };
        }
        catch (error) {
            console.error('Reset rate limit error:', error);
            return {
                success: false,
                message: 'Failed to reset rate limit'
            };
        }
    }
    /**
     * Get blocked identifiers (those currently rate limited)
     */
    static async getBlockedIdentifiers(resource, action, limitMinutes = 30) {
        try {
            const windowStart = new Date(Date.now() - (limitMinutes * 60 * 1000));
            // Build where clause
            let whereClause = gte(rateLimitEvents.createdAt, windowStart);
            if (resource) {
                whereClause = and(whereClause, eq(rateLimitEvents.resource, resource)) || whereClause;
            }
            if (action) {
                whereClause = and(whereClause, eq(rateLimitEvents.action, action)) || whereClause;
            }
            const recentEvents = await db
                .select()
                .from(rateLimitEvents)
                .where(whereClause);
            // Group by identifier, resource, action
            const groupedEvents = new Map();
            for (const event of recentEvents) {
                const key = `${event.identifier}:${event.resource}:${event.action}`;
                if (!groupedEvents.has(key)) {
                    groupedEvents.set(key, []);
                }
                groupedEvents.get(key).push(event);
            }
            // Find blocked identifiers
            const blockedIdentifiers = [];
            for (const [key, events] of groupedEvents) {
                const event = events[0]; // Get example event for metadata
                const limits = this.getRateLimit(event.resource, event.action);
                if (events.length >= limits.maxRequests) {
                    const oldestEvent = events.reduce((oldest, e) => e.createdAt < oldest.createdAt ? e : oldest);
                    const blockedUntil = new Date(oldestEvent.createdAt.getTime() + (limits.windowSeconds * 1000));
                    // Only include if still blocked
                    if (blockedUntil > new Date()) {
                        blockedIdentifiers.push({
                            identifier: event.identifier,
                            identifierType: event.identifierType,
                            resource: event.resource,
                            action: event.action,
                            blockedUntil,
                            currentCount: events.length,
                            maxAllowed: limits.maxRequests
                        });
                    }
                }
            }
            return blockedIdentifiers;
        }
        catch (error) {
            console.error('Get blocked identifiers error:', error);
            return [];
        }
    }
}
// Export singleton instance
export const rateLimitService = RateLimitService;
