import { Router } from 'express';
import { cacheService } from '../services/cachingService.js';
const router = Router();
/**
 * Prometheus metrics endpoint for cache monitoring
 * GET /api/cache/metrics - Returns Prometheus-formatted metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const prometheusFormat = cacheService.getPrometheusExport();
        res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(prometheusFormat);
    }
    catch (error) {
        console.error('Failed to export cache metrics:', error);
        res.status(500).json({
            error: 'Failed to export metrics',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * JSON metrics endpoint for internal monitoring
 * GET /api/cache/metrics/json - Returns JSON-formatted metrics
 */
router.get('/metrics/json', async (req, res) => {
    try {
        const metrics = cacheService.getPrometheusMetrics();
        const stats = cacheService.getStats();
        const healthCheck = await cacheService.healthCheck();
        res.json({
            prometheus: metrics,
            stats: stats,
            health: healthCheck,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Failed to get cache metrics:', error);
        res.status(500).json({
            error: 'Failed to get metrics',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * Cache management endpoint for manual cleanup
 * POST /api/cache/cleanup - Trigger manual cleanup
 */
router.post('/cleanup', async (req, res) => {
    try {
        // Trigger async cleanup manually
        cacheService.asyncCleanup();
        res.json({
            message: 'Manual cleanup triggered',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Failed to trigger cleanup:', error);
        res.status(500).json({
            error: 'Failed to trigger cleanup',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
export default router;
