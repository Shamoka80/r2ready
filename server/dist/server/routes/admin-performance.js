import { Router } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { QueryMonitoringService } from '../services/queryMonitoring.js';
import { IndexHealthService } from '../services/indexHealth.js';
const router = Router();
const getPerformanceMetricsSchema = z.object({
    days: z.coerce.number().int().min(1).max(30).default(7),
});
router.get('/', authenticateUser, async (req, res) => {
    try {
        const userRole = req.user?.businessRole || req.user?.consultantRole;
        if (!['business_owner', 'consultant_owner'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'INSUFFICIENT_PERMISSIONS',
                message: 'Admin access required. Only business owners and consultant owners can access performance metrics.',
            });
        }
        const validationResult = getPerformanceMetricsSchema.safeParse(req.query);
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Invalid query parameters',
                details: validationResult.error.errors,
            });
        }
        const { days } = validationResult.data;
        const [metrics, slowQueries] = await Promise.all([
            QueryMonitoringService.getPerformanceMetrics(),
            QueryMonitoringService.getSlowQueries(days),
        ]);
        const redactedSlowQueries = slowQueries.map(q => ({
            id: q.id,
            query: redactSensitiveData(q.query),
            duration: q.duration,
            timestamp: q.timestamp,
            caller: q.caller,
        }));
        return res.status(200).json({
            success: true,
            data: {
                ...metrics,
                slowQueries: redactedSlowQueries,
                slowQueryCount: redactedSlowQueries.length,
                slowQueryPeriodDays: days,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[AdminPerformance] Error fetching performance metrics:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to fetch performance metrics',
            details: error.message,
        });
    }
});
router.get('/index-health', authenticateUser, async (req, res) => {
    try {
        const userRole = req.user?.businessRole || req.user?.consultantRole;
        if (!['business_owner', 'consultant_owner'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'INSUFFICIENT_PERMISSIONS',
                message: 'Admin access required. Only business owners and consultant owners can access index health metrics.',
            });
        }
        const includeHistory = req.query.includeHistory === 'true';
        const report = await IndexHealthService.generateIndexHealthReport();
        return res.status(200).json({
            success: true,
            data: {
                ...report,
                includeHistory,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[AdminPerformance] Error fetching index health:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to fetch index health metrics',
            details: error.message,
        });
    }
});
function redactSensitiveData(query) {
    let redacted = query;
    redacted = redacted.replace(/(['"])[^'"]*password[^'"]*\1/gi, '$1[REDACTED]$1');
    redacted = redacted.replace(/(['"])[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\1/g, '$1[EMAIL_REDACTED]$1');
    redacted = redacted.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID_REDACTED]');
    redacted = redacted.replace(/(['"])[0-9]{10,}\1/g, '$1[NUMBER_REDACTED]$1');
    return redacted;
}
export default router;
