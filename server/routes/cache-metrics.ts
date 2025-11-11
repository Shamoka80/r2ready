
import { Router } from 'express';
import { cacheService } from '../services/cachingService.js';
import { getAllCacheStats, cacheInvalidation } from '../services/dataCache.js';

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
  } catch (error) {
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
  } catch (error) {
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
    (cacheService as any).asyncCleanup();
    
    res.json({ 
      message: 'Manual cleanup triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to trigger cleanup:', error);
    res.status(500).json({ 
      error: 'Failed to trigger cleanup',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get statistics for all data caches (LRU caches for static data)
 * GET /api/cache/stats - Returns statistics for question, REC, must-pass, and config caches
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = getAllCacheStats();
    
    res.json({
      success: true,
      caches: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    res.status(500).json({ 
      error: 'Failed to get cache stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Invalidate specific cache type
 * POST /api/cache/invalidate/:type - Invalidates a specific cache (questions, recMappings, mustPassRules, scoringConfigs)
 */
router.post('/invalidate/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { id } = req.body;

    switch (type) {
      case 'questions':
        cacheInvalidation.invalidateQuestion(id);
        break;
      case 'recMappings':
        cacheInvalidation.invalidateRecMapping(id);
        break;
      case 'mustPassRules':
        cacheInvalidation.invalidateMustPassRules();
        break;
      case 'scoringConfigs':
        cacheInvalidation.invalidateScoringConfig(id);
        break;
      default:
        return res.status(400).json({
          error: 'Invalid cache type',
          validTypes: ['questions', 'recMappings', 'mustPassRules', 'scoringConfigs']
        });
    }

    res.json({
      success: true,
      message: `Cache invalidated: ${type}${id ? ` (id: ${id})` : ''}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
    res.status(500).json({ 
      error: 'Failed to invalidate cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Invalidate all data caches
 * POST /api/cache/invalidate/all - Clears all LRU caches
 */
router.post('/invalidate/all', async (req, res) => {
  try {
    cacheInvalidation.invalidateAll();
    
    res.json({
      success: true,
      message: 'All caches invalidated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to invalidate all caches:', error);
    res.status(500).json({ 
      error: 'Failed to invalidate all caches',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
