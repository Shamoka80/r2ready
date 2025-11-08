import { ConsistentLogService, generateCorrelationId } from '../services/consistentLogService.js';
import { cacheService } from '../services/cachingService.js';
export function observabilityMiddleware(req, res, next) {
    const logger = ConsistentLogService.getInstance();
    // Set request start time and correlation ID
    req.startTime = Date.now();
    req.correlationId = generateCorrelationId();
    // Add correlation ID to response headers
    res.set('X-Correlation-ID', req.correlationId);
    // Track cache operations
    const originalCacheGet = cacheService.get.bind(cacheService);
    const originalCacheSet = cacheService.set.bind(cacheService);
    let cacheHits = 0;
    let cacheMisses = 0;
    let cacheSets = 0;
    cacheService.get = async function (key) {
        const result = await originalCacheGet(key);
        if (result !== null) {
            cacheHits++;
            logger.logCacheOperation('hit', key, {
                service: 'api',
                operation: `${req.method} ${req.path}`,
                correlationId: req.correlationId
            });
        }
        else {
            cacheMisses++;
            logger.logCacheOperation('miss', key, {
                service: 'api',
                operation: `${req.method} ${req.path}`,
                correlationId: req.correlationId
            });
        }
        return result;
    };
    cacheService.set = async function (key, value, options) {
        cacheSets++;
        await originalCacheSet(key, value, options);
        logger.logCacheOperation('set', key, {
            service: 'api',
            operation: `${req.method} ${req.path}`,
            correlationId: req.correlationId
        });
    };
    // Log request completion
    res.on('finish', async () => {
        const duration = Date.now() - (req.startTime || Date.now());
        await logger.logApiRequest(req.method, req.path, res.statusCode, duration, {
            service: 'api',
            operation: `${req.method} ${req.path}`,
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
            correlationId: req.correlationId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
                cacheHits,
                cacheMisses,
                cacheSets,
                queryCount: 0 // Would be populated by database middleware
            }
        });
        // Restore original cache methods
        cacheService.get = originalCacheGet;
        cacheService.set = originalCacheSet;
    });
    next();
}
/**
 * Health check middleware that provides detailed system status
 */
export const healthCheckMiddleware = async (req, res) => {
    try {
        // Placeholder for actual health check logic
        // const health = await ObservabilityService.getSystemHealth();
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            checks: {
                database: { status: 'healthy' },
                cache: { status: 'healthy' },
                service_a: { status: 'healthy' }
            }
        };
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json({
            status: health.status,
            timestamp: health.timestamp,
            checks: health.checks,
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Health check failed'
        });
    }
};
/**
 * Analytics middleware for performance and security metrics
 */
export const analyticsMiddleware = async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        // Placeholder for actual analytics retrieval
        const performanceAnalytics = { averageDuration: 100, requestCount: 1000 };
        const securityAnalytics = { threatsDetected: 5, suspiciousLogins: 2 };
        res.json({
            timestamp: new Date(),
            timeRange,
            performance: performanceAnalytics,
            security: securityAnalytics
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get analytics'
        });
    }
};
