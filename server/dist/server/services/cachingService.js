import { EventEmitter } from 'events';
export class AdvancedCachingService extends EventEmitter {
    cache = new Map();
    l1Cache = new Map(); // Hot data cache
    l2Cache = new Map(); // Cold data cache
    frequencyTracker = new Map(); // For LFU tracking
    stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        memoryUsage: 0,
        totalKeys: 0
    };
    cleanupOperations = 0;
    isCleanupRunning = false;
    config;
    cleanupTimer;
    // Assuming a logger instance is available, similar to how 'this.emit' is used.
    // In a real application, this would be injected or imported.
    logger = {
        info: async (message, context) => {
            console.log(`[INFO] ${message}`, context);
        },
        warn: async (message, context) => {
            console.warn(`[WARN] ${message}`, context);
        },
        error: async (message, context) => {
            console.error(`[ERROR] ${message}`, context);
        }
    };
    constructor(config = {}) {
        super();
        this.config = {
            maxMemory: this.calculateOptimalCacheSize(), // Dynamic based on available memory
            defaultTTL: 5 * 60 * 1000, // 5 minutes
            cleanupInterval: 30 * 1000, // 30 seconds (adaptive, will adjust based on pressure)
            enableStats: true,
            compressionThreshold: 1024, // 1KB
            memoryCleanupThreshold: 75, // Trigger at 75% instead of 90%
            dynamicSizing: true,
            tieredCaching: true,
            l1CacheSize: 128 * 1024 * 1024, // 128MB for hot data
            evictionPolicy: 'HYBRID', // LRU + LFU hybrid
            ...config
        };
        this.startCleanupTimer();
        // Monitor system memory and adjust cache size periodically
        if (this.config.dynamicSizing) {
            setInterval(() => this.adjustCacheSize(), 5 * 60 * 1000); // Every 5 minutes
        }
        // Adaptive cleanup frequency adjustment
        setInterval(() => this.adjustCleanupFrequency(), 60 * 1000); // Every minute
    }
    // Core cache operations
    async set(key, value, options = {}) {
        const ttl = options.ttl || this.config.defaultTTL;
        const expiry = Date.now() + ttl;
        const tags = options.tags || [];
        const priority = options.priority || 'normal';
        let processedValue = value;
        let size = this.estimateSize(value);
        // Compress large values if needed
        if (size > this.config.compressionThreshold && options.compress !== false) {
            processedValue = this.compress(value);
            size = this.estimateSize(processedValue);
        }
        // Check memory limits and evict if necessary
        await this.ensureMemoryLimit(size);
        const now = Date.now();
        const tier = this.determineTier(key, priority, size);
        const entry = {
            value: processedValue,
            expiry,
            tags,
            size,
            accessCount: 0,
            lastAccessed: now,
            frequency: 1,
            tier,
            createdAt: now
        };
        // Store in appropriate tier
        if (tier === 'L1') {
            this.l1Cache.set(key, entry);
        }
        else {
            this.l2Cache.set(key, entry);
        }
        // Also store in main cache for compatibility
        this.cache.set(key, entry);
        // Update frequency tracker
        this.frequencyTracker.set(key, 1);
        this.updateStats({ sets: 1, memoryUsage: size, totalKeys: 1 });
        this.emit('set', { key, size, ttl, tier });
    }
    async get(key) {
        // Try L1 cache first (hot data)
        let entry = this.l1Cache.get(key);
        if (!entry) {
            // Try L2 cache (cold data)
            entry = this.l2Cache.get(key);
            // If found in L2, potentially promote to L1
            if (entry && this.shouldPromoteToL1(entry)) {
                await this.promoteToL1(key, entry);
            }
        }
        if (!entry) {
            // Fallback to main cache for compatibility
            entry = this.cache.get(key);
        }
        if (!entry) {
            this.updateStats({ misses: 1 });
            return null;
        }
        if (Date.now() > entry.expiry) {
            this.delete(key);
            this.updateStats({ misses: 1 });
            return null;
        }
        // Update access statistics and frequency
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        entry.frequency++;
        // Update frequency tracker
        const currentFreq = this.frequencyTracker.get(key) || 0;
        this.frequencyTracker.set(key, currentFreq + 1);
        this.updateStats({ hits: 1 });
        this.emit('hit', { key, tier: entry.tier });
        return this.decompress(entry.value);
    }
    async delete(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        this.cache.delete(key);
        this.updateStats({
            deletes: 1,
            memoryUsage: -entry.size,
            totalKeys: -1
        });
        this.emit('delete', { key });
        return true;
    }
    // Advanced operations
    async getMultiple(keys) {
        const results = new Map();
        for (const key of keys) {
            const value = await this.get(key);
            if (value !== null) {
                results.set(key, value);
            }
        }
        return results;
    }
    async setMultiple(entries) {
        for (const entry of entries) {
            await this.set(entry.key, entry.value, entry.options);
        }
    }
    async invalidateByTags(tags) {
        let invalidated = 0;
        const tagSet = new Set(tags);
        for (const [key, entry] of this.cache.entries()) {
            if (entry.tags.some(tag => tagSet.has(tag))) {
                this.delete(key);
                invalidated++;
            }
        }
        this.emit('invalidateByTags', { tags, count: invalidated });
        return invalidated;
    }
    async clear() {
        const keys = Array.from(this.cache.keys());
        this.cache.clear();
        await this.logger.info('Cache cleared', {
            service: 'cache',
            operation: 'clear',
            metadata: { clearedCount: keys.length }
        });
        return keys.length;
    }
    /**
     * Automatic memory-based cleanup with improved thresholds
     */
    async performMemoryBasedCleanup() {
        const cacheUsagePercent = (this.stats.memoryUsage / this.config.maxMemory) * 100;
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        // Use configurable threshold instead of hardcoded 90%
        if (cacheUsagePercent > this.config.memoryCleanupThreshold) {
            const itemsToRemove = this.selectItemsForEviction();
            let removedItems = 0;
            for (const key of itemsToRemove) {
                if (this.cache.has(key)) {
                    this.delete(key);
                    removedItems++;
                }
            }
            // Only log if we actually removed items
            if (removedItems > 0) {
                await this.logger.info('Cache cleanup performed', {
                    service: 'cache',
                    operation: 'memory_cleanup',
                    metadata: {
                        removedItems,
                        cacheUsage: `${Math.round(cacheUsagePercent)}%`,
                        memoryUsage: `${heapUsedMB}MB/${heapTotalMB}MB`,
                        threshold: `${this.config.memoryCleanupThreshold}%`
                    }
                });
            }
        }
    }
    // Query result caching with automatic invalidation
    async cacheQuery(queryKey, queryFn, options = {}) {
        // Try to get from cache first
        const cached = await this.get(queryKey);
        if (cached !== null) {
            // If background refresh is enabled and entry is close to expiry, refresh it
            if (options.refreshInBackground) {
                const entry = this.cache.get(queryKey);
                if (entry && (entry.expiry - Date.now()) < (this.config.defaultTTL * 0.1)) {
                    // Refresh in background without waiting
                    queryFn().then(result => {
                        this.set(queryKey, result, options);
                    }).catch(error => {
                        this.emit('backgroundRefreshError', { queryKey, error });
                    });
                }
            }
            return cached;
        }
        // Cache miss - execute query and cache result
        try {
            const result = await queryFn();
            await this.set(queryKey, result, options);
            return result;
        }
        catch (error) {
            this.emit('queryError', { queryKey, error });
            throw error;
        }
    }
    // Memory management
    async ensureMemoryLimit(additionalSize) {
        while (this.stats.memoryUsage + additionalSize > this.config.maxMemory) {
            const evicted = this.evictLeastRecentlyUsed();
            if (!evicted) {
                // If we can't evict anything, we might need to increase memory limit
                this.emit('memoryPressure', {
                    current: this.stats.memoryUsage,
                    limit: this.config.maxMemory
                });
                // Also trigger memory cleanup if eviction fails
                await this.performMemoryBasedCleanup();
                if (this.stats.memoryUsage + additionalSize <= this.config.maxMemory) {
                    break; // Retry after cleanup
                }
                break; // Still over limit, break to avoid infinite loop
            }
        }
    }
    evictLeastRecentlyUsed() {
        let oldestKey = null;
        let oldestTime = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.delete(oldestKey);
            this.updateStats({ evictions: 1 });
            this.emit('evict', { key: oldestKey });
            return true;
        }
        return false;
    }
    // Utility methods
    estimateSize(value) {
        if (value === null || value === undefined)
            return 8;
        if (typeof value === 'string')
            return value.length * 2;
        if (typeof value === 'number')
            return 8;
        if (typeof value === 'boolean')
            return 4;
        if (Buffer.isBuffer(value))
            return value.length;
        // For objects, approximate JSON size
        try {
            // Use a more robust size estimation for objects
            const jsonString = JSON.stringify(value);
            return jsonString.length * 2;
        }
        catch (e) {
            this.logger.error('Failed to estimate size of object', { service: 'cache', error: e });
            return 1024; // fallback estimate
        }
    }
    compress(value) {
        // Simple compression placeholder - in production, use actual compression
        // Example: const zlib = require('zlib'); return zlib.gzipSync(Buffer.from(JSON.stringify(value))).toString('base64');
        if (typeof value === 'string' && value.length > this.config.compressionThreshold) {
            // This is a placeholder, actual compression would be more complex
            return value;
        }
        // For non-strings or smaller strings, return as is
        return value;
    }
    // New helper methods for optimized caching
    calculateOptimalCacheSize() {
        const memUsage = process.memoryUsage();
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        // Use 40% of available heap for cache, with min 256MB and max 1GB
        const optimalSizeMB = Math.min(Math.max(heapTotalMB * 0.4, 256), 1024);
        return Math.round(optimalSizeMB * 1024 * 1024);
    }
    adjustCacheSize() {
        if (!this.config.dynamicSizing)
            return;
        const newOptimalSize = this.calculateOptimalCacheSize();
        if (Math.abs(newOptimalSize - this.config.maxMemory) > (this.config.maxMemory * 0.2)) {
            this.config.maxMemory = newOptimalSize;
            this.emit('cacheResized', {
                newSize: Math.round(newOptimalSize / 1024 / 1024) + 'MB',
                reason: 'dynamic_adjustment'
            });
        }
    }
    determineTier(key, priority, size) {
        if (!this.config.tieredCaching)
            return 'L1';
        // High priority items go to L1
        if (priority === 'high')
            return 'L1';
        // Large items go to L2 to preserve L1 space
        if (size > this.config.compressionThreshold * 2)
            return 'L2';
        // Check L1 capacity
        const l1Usage = Array.from(this.l1Cache.values())
            .reduce((total, entry) => total + entry.size, 0);
        return l1Usage < this.config.l1CacheSize ? 'L1' : 'L2';
    }
    shouldPromoteToL1(entry) {
        // Promote if accessed frequently and recently
        return entry.frequency > 3 && (Date.now() - entry.lastAccessed) < 60000; // 1 minute
    }
    async promoteToL1(key, entry) {
        // Check if L1 has space
        const l1Usage = Array.from(this.l1Cache.values())
            .reduce((total, entry) => total + entry.size, 0);
        if (l1Usage + entry.size <= this.config.l1CacheSize) {
            this.l2Cache.delete(key);
            entry.tier = 'L1';
            this.l1Cache.set(key, entry);
            this.emit('promoted', { key, tier: 'L1' });
        }
    }
    selectItemsForEviction() {
        const allEntries = Array.from(this.cache.entries());
        // Hybrid eviction: combine LRU and LFU
        if (this.config.evictionPolicy === 'HYBRID') {
            return this.hybridEviction(allEntries);
        }
        else if (this.config.evictionPolicy === 'LFU') {
            return this.lfuEviction(allEntries);
        }
        else {
            return this.lruEviction(allEntries);
        }
    }
    hybridEviction(entries) {
        // Score based on both recency and frequency
        const scoredEntries = entries.map(([key, entry]) => {
            const ageScore = (Date.now() - entry.lastAccessed) / 1000; // seconds
            const frequencyScore = 1 / Math.max(entry.frequency, 1);
            const score = ageScore * 0.7 + frequencyScore * 0.3; // Weighted combination
            return { key, score, entry };
        });
        scoredEntries.sort((a, b) => b.score - a.score); // Highest score = least valuable
        const targetCount = Math.floor(entries.length * 0.2); // Remove 20%
        return scoredEntries.slice(0, targetCount).map(item => item.key);
    }
    lfuEviction(entries) {
        entries.sort((a, b) => a[1].frequency - b[1].frequency);
        const targetCount = Math.floor(entries.length * 0.2);
        return entries.slice(0, targetCount).map(([key]) => key);
    }
    lruEviction(entries) {
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        const targetCount = Math.floor(entries.length * 0.2);
        return entries.slice(0, targetCount).map(([key]) => key);
    }
    /**
     * Adaptive cleanup frequency based on cache pressure
     */
    adjustCleanupFrequency() {
        const cacheUsagePercent = (this.stats.memoryUsage / this.config.maxMemory) * 100;
        let newInterval;
        if (cacheUsagePercent > 80) {
            // High pressure: cleanup every 15 seconds
            newInterval = 15 * 1000;
        }
        else if (cacheUsagePercent > 70) {
            // Medium pressure: cleanup every 30 seconds
            newInterval = 30 * 1000;
        }
        else if (cacheUsagePercent > 50) {
            // Low pressure: cleanup every minute
            newInterval = 60 * 1000;
        }
        else {
            // Very low pressure: cleanup every 2 minutes
            newInterval = 2 * 60 * 1000;
        }
        // Only restart timer if interval changed significantly (>25% difference)
        if (Math.abs(newInterval - this.config.cleanupInterval) > (this.config.cleanupInterval * 0.25)) {
            this.config.cleanupInterval = newInterval;
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
            }
            this.startCleanupTimer();
            this.emit('cleanupFrequencyAdjusted', {
                newInterval: newInterval / 1000 + 's',
                cacheUsage: Math.round(cacheUsagePercent) + '%',
                reason: 'adaptive_pressure_management'
            });
        }
    }
    /**
     * Get Prometheus-compatible metrics
     */
    getPrometheusMetrics() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) : 0;
        const memoryUsagePercent = (this.stats.memoryUsage / this.config.maxMemory) * 100;
        // Calculate L1/L2 usage
        const l1Usage = Array.from(this.l1Cache.values()).reduce((total, entry) => total + entry.size, 0);
        const l2Usage = Array.from(this.l2Cache.values()).reduce((total, entry) => total + entry.size, 0);
        const l1UsagePercent = (l1Usage / this.config.l1CacheSize) * 100;
        const l2MaxSize = this.config.maxMemory - this.config.l1CacheSize;
        const l2UsagePercent = l2MaxSize > 0 ? (l2Usage / l2MaxSize) * 100 : 0;
        return {
            cache_hit_ratio: hitRate,
            cache_miss_ratio: 1 - hitRate,
            eviction_count: this.stats.evictions,
            memory_usage_percent: memoryUsagePercent,
            cache_size_bytes: this.stats.memoryUsage,
            cache_operations_total: this.stats.hits + this.stats.misses + this.stats.sets + this.stats.deletes,
            cleanup_operations_total: this.cleanupOperations,
            l1_cache_usage_percent: l1UsagePercent,
            l2_cache_usage_percent: l2UsagePercent
        };
    }
    /**
     * Export metrics in Prometheus format
     */
    getPrometheusExport() {
        const metrics = this.getPrometheusMetrics();
        const lines = [];
        // Add metric definitions and values
        lines.push('# HELP cache_hit_ratio Cache hit rate (0-1)');
        lines.push('# TYPE cache_hit_ratio gauge');
        lines.push(`cache_hit_ratio{service="cache"} ${metrics.cache_hit_ratio.toFixed(4)}`);
        lines.push('# HELP cache_eviction_count Total number of cache evictions');
        lines.push('# TYPE cache_eviction_count counter');
        lines.push(`cache_eviction_count{service="cache"} ${metrics.eviction_count}`);
        lines.push('# HELP cache_memory_usage_percent Memory usage percentage (0-100)');
        lines.push('# TYPE cache_memory_usage_percent gauge');
        lines.push(`cache_memory_usage_percent{service="cache"} ${metrics.memory_usage_percent.toFixed(2)}`);
        lines.push('# HELP cache_size_bytes Cache size in bytes');
        lines.push('# TYPE cache_size_bytes gauge');
        lines.push(`cache_size_bytes{service="cache"} ${metrics.cache_size_bytes}`);
        lines.push('# HELP cache_operations_total Total cache operations');
        lines.push('# TYPE cache_operations_total counter');
        lines.push(`cache_operations_total{service="cache"} ${metrics.cache_operations_total}`);
        lines.push('# HELP cache_cleanup_operations_total Total cleanup operations');
        lines.push('# TYPE cache_cleanup_operations_total counter');
        lines.push(`cache_cleanup_operations_total{service="cache"} ${metrics.cleanup_operations_total}`);
        lines.push('# HELP cache_l1_usage_percent L1 cache usage percentage');
        lines.push('# TYPE cache_l1_usage_percent gauge');
        lines.push(`cache_l1_usage_percent{service="cache",tier="l1"} ${metrics.l1_cache_usage_percent.toFixed(2)}`);
        lines.push('# HELP cache_l2_usage_percent L2 cache usage percentage');
        lines.push('# TYPE cache_l2_usage_percent gauge');
        lines.push(`cache_l2_usage_percent{service="cache",tier="l2"} ${metrics.l2_cache_usage_percent.toFixed(2)}`);
        return lines.join('\n') + '\n';
    }
    decompress(value) {
        // Decompression placeholder
        // Example: const zlib = require('zlib'); return JSON.parse(zlib.gunzipSync(Buffer.from(value as string, 'base64')).toString());
        return value;
    }
    updateStats(delta) {
        if (!this.config.enableStats)
            return;
        Object.keys(delta).forEach(key => {
            const k = key;
            const value = delta[k] || 0;
            // Ensure memoryUsage is not negative due to deletions
            if (k === 'memoryUsage') {
                this.stats.memoryUsage = Math.max(0, (this.stats.memoryUsage || 0) + value);
            }
            else if (k === 'totalKeys') {
                this.stats.totalKeys = Math.max(0, (this.stats.totalKeys || 0) + value);
            }
            else {
                this.stats[k] += value;
            }
        });
    }
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.asyncCleanup();
        }, this.config.cleanupInterval);
    }
    async asyncCleanup() {
        // Prevent concurrent cleanup operations
        if (this.isCleanupRunning)
            return;
        this.isCleanupRunning = true;
        this.cleanupOperations++;
        try {
            // Run cleanup in next tick to avoid blocking current operations
            await new Promise(resolve => setImmediate(resolve));
            const now = Date.now();
            let cleaned = 0;
            const expiredKeys = [];
            // First pass: identify expired keys
            for (const [key, entry] of this.cache.entries()) {
                if (now > entry.expiry) {
                    expiredKeys.push(key);
                }
            }
            // Second pass: delete in batches to avoid blocking
            const batchSize = 100;
            for (let i = 0; i < expiredKeys.length; i += batchSize) {
                const batch = expiredKeys.slice(i, i + batchSize);
                for (const key of batch) {
                    if (this.cache.has(key)) {
                        this.delete(key);
                        cleaned++;
                    }
                }
                // Yield control after each batch
                if (i + batchSize < expiredKeys.length) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
            // Also run memory cleanup if needed
            await this.performMemoryBasedCleanup();
            if (cleaned > 0) {
                this.emit('cleanup', { cleaned, async: true });
            }
        }
        finally {
            this.isCleanupRunning = false;
        }
    }
    // Statistics and monitoring
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
        return {
            ...this.stats,
            hitRate: Math.round(hitRate * 100) / 100,
            config: this.config
        };
    }
    async getDetailedStats() {
        const basicStats = this.getStats();
        return {
            ...basicStats,
            keys: this.cache.size
        };
    }
    getKeys(pattern) {
        const keys = Array.from(this.cache.keys());
        return pattern ? keys.filter(key => pattern.test(key)) : keys;
    }
    async healthCheck() {
        const stats = this.getStats();
        const prometheusMetrics = this.getPrometheusMetrics();
        const memoryUsagePercent = prometheusMetrics.memory_usage_percent;
        let status = 'healthy';
        if (memoryUsagePercent > 90) {
            status = 'critical';
        }
        else if (memoryUsagePercent > 75 || prometheusMetrics.cache_hit_ratio < 0.5) {
            status = 'warning';
        }
        // Ensure uptime calculation is correct, considering cleanupTimer might not be set if initialized quickly
        const startTime = (this.cleanupTimer ? this.cleanupTimer._idleStart : Date.now());
        const uptime = Date.now() - startTime;
        return {
            status,
            details: {
                memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
                hitRate: prometheusMetrics.cache_hit_ratio,
                totalKeys: stats.totalKeys,
                memoryUsage: `${Math.round(stats.memoryUsage / 1024 / 1024)}MB`,
                uptime: uptime,
                maxMemory: `${Math.round(this.config.maxMemory / 1024 / 1024)}MB`,
                cleanupInterval: `${this.config.cleanupInterval / 1000}s`,
                cleanupOperations: this.cleanupOperations,
                isCleanupRunning: this.isCleanupRunning,
                l1Usage: `${prometheusMetrics.l1_cache_usage_percent.toFixed(1)}%`,
                l2Usage: `${prometheusMetrics.l2_cache_usage_percent.toFixed(1)}%`,
                evictionCount: prometheusMetrics.eviction_count
            }
        };
    }
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clear();
        this.removeAllListeners();
    }
}
// Singleton instance with optimized configuration
export const cacheService = new AdvancedCachingService({
    // Dynamic sizing based on available memory (will calculate optimal size)
    defaultTTL: 15 * 60 * 1000, // 15 minutes
    cleanupInterval: 30 * 1000, // 30 seconds (more frequent, lighter cleanup)
    enableStats: true,
    compressionThreshold: 2 * 1024, // 2KB
    memoryCleanupThreshold: 75, // Trigger cleanup at 75% instead of 90%
    dynamicSizing: true, // Enable dynamic cache sizing
    tieredCaching: true, // Enable L1/L2 separation
    l1CacheSize: 128 * 1024 * 1024, // 128MB for hot data
    evictionPolicy: 'HYBRID' // Use hybrid LRU+LFU eviction
});
// Cache key builders for consistent cache keys
export const CacheKeys = {
    user: (id) => `user:${id}`,
    usersByTenant: (tenantId) => `users:tenant:${tenantId}`,
    assessment: (id) => `assessment:${id}`,
    assessmentsByUser: (userId) => `assessments:user:${userId}`,
    assessmentsByTenant: (tenantId) => `assessments:tenant:${tenantId}`,
    questions: (clauseId) => clauseId ? `questions:clause:${clauseId}` : 'questions:all',
    questionsByAssessment: (assessmentId) => `questions:assessment:${assessmentId}`,
    answers: (assessmentId) => `answers:assessment:${assessmentId}`,
    evidenceList: (assessmentId) => `evidence:assessment:${assessmentId}`,
    systemMetrics: (timeRange) => `metrics:system:${timeRange}`,
    auditLogs: (tenantId, timeRange) => `audit:${tenantId}:${timeRange}`,
    tenantConfig: (tenantId) => `config:tenant:${tenantId}`,
    facilityUsers: (facilityId) => `users:facility:${facilityId}`,
    userPermissions: (userId) => `permissions:user:${userId}`
};
// Cache tags for group invalidation
export const CacheTags = {
    USER: 'user',
    ASSESSMENT: 'assessment',
    QUESTION: 'question',
    ANSWER: 'answer',
    EVIDENCE: 'evidence',
    TENANT: 'tenant',
    FACILITY: 'facility',
    PERMISSION: 'permission',
    SYSTEM: 'system',
    userTag: (userId) => `user:${userId}`,
    tenantTag: (tenantId) => `tenant:${tenantId}`,
    assessmentTag: (assessmentId) => `assessment:${assessmentId}`,
    facilityTag: (facilityId) => `facility:${facilityId}`
};
