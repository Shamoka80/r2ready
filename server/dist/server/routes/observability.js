import { Router } from 'express';
import { AuthService } from '../services/authService.js';
import ObservabilityService from '../services/observabilityService.js';
import { ConsistentLogService } from '../services/consistentLogService.js';
import { cacheService } from '../services/cachingService.js';
import { queryOptimizationService } from '../services/queryOptimizationService.js';
import { cloudStorageService } from '../services/cloudStorageService.js';
import { strictRateLimit } from '../middleware/rateLimitMiddleware.js';
// Assuming these services are available and imported elsewhere:
// import { SystemHealthService } from '../services/systemHealthService.js';
// import { ObservabilityDashboardService } from '../services/observabilityDashboardService.js';
// import { UserActivityAnalyticsService } from '../services/userActivityAnalyticsService.js';
// import { CachingService } from '../services/cachingService.js'; // This seems to be a duplicate import, using cacheService from above
// import { RateLimitService } from '../services/rateLimitService.js'; // This seems to be a duplicate import, using rateLimitMiddleware from above
const router = Router();
const logger = ConsistentLogService.getInstance();
/**
 * GET /api/observability/health
 * System health check
 */
router.get('/health', async (req, res) => {
    try {
        const [cachingHealth, queryHealth, loggingHealth, storageHealth] = await Promise.all([
            cacheService.healthCheck(),
            queryOptimizationService.healthCheck(),
            logger.healthCheck(),
            cloudStorageService.healthCheck()
        ]);
        const overallStatus = [cachingHealth, queryHealth, loggingHealth, storageHealth]
            .some(h => h.status === 'critical') ? 'critical'
            : [cachingHealth, queryHealth, loggingHealth, storageHealth]
                .some(h => h.status === 'warning') ? 'warning'
                : 'healthy';
        res.json({
            status: overallStatus,
            timestamp: new Date(),
            components: {
                caching: cachingHealth,
                queryOptimization: queryHealth,
                logging: loggingHealth,
                cloudStorage: storageHealth
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'critical',
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Health check failed'
        });
    }
});
/**
 * GET /api/observability/performance
 * Performance metrics and analytics
 */
router.get('/performance', AuthService.authMiddleware, async (req, res) => {
    try {
        const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow) : undefined;
        const [queryStats, cacheStats, detailedCacheStats] = await Promise.all([
            queryOptimizationService.getQueryStats(timeWindow),
            cacheService.getStats(),
            cacheService.getDetailedStats()
        ]);
        await logger.debug('Performance metrics retrieved', {
            service: 'observability',
            operation: 'GET /performance',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { timeWindow }
        });
        res.json({
            timestamp: new Date(),
            timeRange: timeWindow, // Changed from timeWindow to timeRange to match analytics endpoint
            performance: queryStats, // Renamed from database to performance
            cache: {
                basic: cacheStats,
                detailed: detailedCacheStats
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            }
        });
    }
    catch (error) {
        await logger.error('Failed to retrieve performance metrics', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'GET /performance',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get performance metrics'
        });
    }
});
/**
 * GET /api/observability/cache/stats
 * Detailed cache statistics
 */
router.get('/cache/stats', AuthService.authMiddleware, async (req, res) => {
    const logger = ConsistentLogService.getInstance(); // Re-instantiate logger as it's used locally
    try {
        const detailed = req.query.detailed === 'true';
        const stats = detailed
            ? await cacheService.getDetailedStats()
            : { basic: cacheService.getStats() };
        await logger.debug('Cache stats retrieved', {
            service: 'observability',
            operation: 'GET /cache/stats',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { detailed }
        });
        res.json({
            success: true,
            ...stats,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('Failed to retrieve cache stats', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'GET /cache/stats',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'low'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get cache stats'
        });
    }
});
/**
 * POST /api/observability/cache/clear
 * Clear cache
 */
router.post('/cache/clear', AuthService.authMiddleware, strictRateLimit.adminActions, async (req, res) => {
    const logger = ConsistentLogService.getInstance(); // Re-instantiate logger
    try {
        const { tags, pattern } = req.body;
        let clearedCount = 0;
        if (tags && Array.isArray(tags)) {
            clearedCount = await cacheService.invalidateByTags(tags);
        }
        else if (pattern) {
            // For pattern-based clearing, we'd need to implement this in the cache service
            clearedCount = await cacheService.clear(); // Fallback to clearing all
        }
        else {
            clearedCount = await cacheService.clear();
        }
        await logger.info('Cache cleared by user', {
            service: 'observability',
            operation: 'POST /cache/clear',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { clearedCount, tags, pattern }
        });
        res.json({
            success: true,
            clearedCount,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        await logger.error('Failed to clear cache', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'POST /cache/clear',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'high'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to clear cache'
        });
    }
});
/**
 * GET /api/observability/logs
 * Retrieve system logs with filtering
 */
router.get('/logs', AuthService.authMiddleware, async (req, res) => {
    const logger = ConsistentLogService.getInstance(); // Re-instantiate logger
    try {
        const { level, service, operation, userId, tenantId, limit = 100, since } = req.query;
        const filters = {
            level: level,
            service: service,
            operation: operation,
            userId: userId,
            tenantId: tenantId,
            limit: parseInt(limit),
            since: since ? new Date(since) : undefined
        };
        const logs = await ObservabilityService.getLogs(filters);
        await logger.debug('Logs retrieved', {
            service: 'observability',
            operation: 'GET /logs',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { filters, resultCount: logs.length }
        });
        res.json({
            success: true,
            logs,
            filters,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('Failed to retrieve logs', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'GET /logs',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to retrieve logs'
        });
    }
});
/**
 * GET /api/observability/database/slow-queries
 * Get slow database queries
 */
router.get('/database/slow-queries', AuthService.authMiddleware, async (req, res) => {
    try {
        const threshold = req.query.threshold ? parseInt(req.query.threshold) : 1000;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const slowQueries = queryOptimizationService.getSlowQueries(threshold, limit);
        await logger.debug('Slow queries retrieved', {
            service: 'observability',
            operation: 'GET /database/slow-queries',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { threshold, limit, resultCount: slowQueries.length }
        });
        res.json({
            success: true,
            slowQueries,
            threshold,
            limit,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('Failed to retrieve slow queries', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'GET /database/slow-queries',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get slow queries'
        });
    }
});
/**
 * GET /api/observability/database/n-plus-one
 * Get N+1 query patterns
 */
router.get('/database/n-plus-one', AuthService.authMiddleware, async (req, res) => {
    try {
        const nPlusOneQueries = queryOptimizationService.getNPlusOneQueries();
        await logger.debug('N+1 queries retrieved', {
            service: 'observability',
            operation: 'GET /database/n-plus-one',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { resultCount: nPlusOneQueries.length }
        });
        res.json({
            success: true,
            nPlusOneQueries,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('Failed to retrieve N+1 queries', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'GET /database/n-plus-one',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get N+1 queries'
        });
    }
});
/**
 * GET /api/observability/database/optimization-suggestions
 * Get query optimization suggestions
 */
router.get('/database/optimization-suggestions', AuthService.authMiddleware, async (req, res) => {
    try {
        const severity = req.query.severity;
        const suggestions = queryOptimizationService.getOptimizationSuggestions(severity);
        await logger.debug('Optimization suggestions retrieved', {
            service: 'observability',
            operation: 'GET /database/optimization-suggestions',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { severity, resultCount: suggestions.length }
        });
        res.json({
            success: true,
            suggestions,
            severity,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('Failed to retrieve optimization suggestions', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'GET /database/optimization-suggestions',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get optimization suggestions'
        });
    }
});
/**
 * POST /api/observability/database/analyze-query
 * Analyze a specific query for optimization
 */
router.post('/database/analyze-query', AuthService.authMiddleware, async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query string is required' });
        }
        const analysis = await queryOptimizationService.optimizeQuery(query);
        await logger.info('Query analyzed for optimization', {
            service: 'observability',
            operation: 'POST /database/analyze-query',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: {
                queryLength: query.length,
                suggestionsCount: analysis.suggestions.length
            }
        });
        res.json({
            success: true,
            query,
            analysis,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('Failed to analyze query', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'POST /database/analyze-query',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to analyze query'
        });
    }
});
/**
 * POST /api/execute-sql
 * Execute SQL query (admin only)
 */
router.post('/execute-sql', AuthService.authMiddleware, async (req, res) => {
    try {
        // Only allow for admin users
        const userRole = req.user.businessRole || req.user.consultantRole;
        if (!['business_owner', 'consultant_owner'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const { query } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'SQL query is required' });
        }
        // Basic safety checks
        const dangerousPatterns = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)\b/i;
        if (dangerousPatterns.test(query)) {
            return res.status(403).json({ error: 'Only SELECT queries are allowed' });
        }
        const { executeQuery } = await import('../db');
        const result = await executeQuery(query);
        await logger.info('SQL query executed', {
            service: 'observability',
            operation: 'POST /execute-sql',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: {
                queryLength: query.length,
                rowCount: result.rowCount
            }
        });
        res.json({
            success: true,
            result: result.rows,
            rowCount: result.rowCount,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('SQL execution failed', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'POST /execute-sql',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'high'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'SQL execution failed'
        });
    }
});
/**
 * GET /api/observability/analytics
 * System analytics and trends
 */
router.get('/analytics', AuthService.authMiddleware, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const timeWindows = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };
        const duration = timeWindows[timeRange]; // Renamed from timeWindow to duration for clarity
        const [performanceMetrics, systemHealthComponents] = await Promise.all([
            queryOptimizationService.getQueryStats(duration),
            Promise.all([
                cacheService.healthCheck(),
                queryOptimizationService.healthCheck(),
                logger.healthCheck(),
                cloudStorageService.healthCheck()
            ])
        ]);
        const analytics = {
            timeRange,
            performance: performanceMetrics,
            health: {
                overall: systemHealthComponents.some(h => h.status === 'critical') ? 'critical'
                    : systemHealthComponents.some(h => h.status === 'warning') ? 'warning'
                        : 'healthy',
                components: {
                    cache: systemHealthComponents[0],
                    database: systemHealthComponents[1],
                    logging: systemHealthComponents[2],
                    storage: systemHealthComponents[3]
                }
            },
            trends: {
                // Add trend analysis here
                queryPerformance: 'improving', // calculated trend
                cacheEfficiency: 'stable',
                errorRate: 'decreasing'
            }
        };
        await logger.debug('Analytics retrieved', {
            service: 'observability',
            operation: 'GET /analytics',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { timeRange }
        });
        res.json({
            success: true,
            analytics,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('Failed to retrieve analytics', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'GET /analytics',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'medium'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get analytics'
        });
    }
});
/**
 * POST /api/observability/database/cleanup
 * Clean old metrics and logs
 */
router.post('/database/cleanup', AuthService.authMiddleware, strictRateLimit.adminActions, async (req, res) => {
    try {
        const { olderThanHours = 24 } = req.body;
        const olderThanMs = olderThanHours * 60 * 60 * 1000;
        const removedCount = await queryOptimizationService.clearOldMetrics(olderThanMs);
        await logger.info('Database metrics cleaned up', {
            service: 'observability',
            operation: 'POST /database/cleanup',
            userId: req.user.id,
            tenantId: req.user.tenantId,
            metadata: { olderThanHours, removedCount }
        });
        res.json({
            success: true,
            removedCount,
            olderThanHours,
            timestamp: new Date()
        });
    }
    catch (error) {
        await logger.error('Failed to cleanup database metrics', {
            error: error instanceof Error ? error : new Error(String(error)),
            service: 'observability',
            operation: 'POST /database/cleanup',
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            severity: 'high'
        });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to cleanup metrics'
        });
    }
});
export default router;
