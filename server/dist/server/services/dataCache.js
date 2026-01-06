/**
 * Static Data Caching Layer
 *
 * Implements LRU caching for frequently accessed, rarely changed data to reduce database load.
 * Caches: Questions, REC mappings, must-pass rules, scoring configs
 *
 * Features:
 * - LRU eviction policy with configurable max size
 * - TTL-based expiration
 * - Manual cache invalidation API
 * - Cache hit/miss metrics
 */
export class LRUCache {
    cache = new Map();
    maxSize;
    ttlMs;
    stats = { hits: 0, misses: 0, evictions: 0, size: 0 };
    constructor(maxSize = 1000, ttlMs = 5 * 60 * 1000) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }
    /**
     * Get value from cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        // Check if expired
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            this.stats.misses++;
            this.stats.evictions++;
            return null;
        }
        // Update hit count and move to end (most recently used)
        entry.hits++;
        this.stats.hits++;
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }
    /**
     * Set value in cache
     */
    set(key, data) {
        // If already exists, delete first to update order
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Evict oldest entry if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
                this.stats.evictions++;
            }
        }
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            hits: 0
        });
        this.stats.size = this.cache.size;
    }
    /**
     * Invalidate specific key
     */
    invalidate(key) {
        const deleted = this.cache.delete(key);
        this.stats.size = this.cache.size;
        return deleted;
    }
    /**
     * Invalidate all keys matching pattern
     */
    invalidatePattern(pattern) {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
                this.cache.delete(key);
                count++;
            }
        }
        this.stats.size = this.cache.size;
        return count;
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.stats.size = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get cache hit rate
     */
    getHitRate() {
        const total = this.stats.hits + this.stats.misses;
        return total === 0 ? 0 : this.stats.hits / total;
    }
}
// Global cache instances
export const questionCache = new LRUCache(500, 10 * 60 * 1000); // 500 questions, 10min TTL
export const recMappingCache = new LRUCache(1000, 10 * 60 * 1000); // 1000 mappings, 10min TTL
export const mustPassRuleCache = new LRUCache(100, 10 * 60 * 1000); // 100 rules, 10min TTL
export const scoringConfigCache = new LRUCache(50, 10 * 60 * 1000); // 50 configs, 10min TTL
export const cloudStorageMetadataCache = new LRUCache(500, 60 * 60 * 1000); // 500 files, 1hr TTL
export const cloudStorageUrlCache = new LRUCache(1000, 5 * 60 * 1000); // 1000 URLs, 5min TTL
/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
    /**
     * Invalidate question cache
     */
    invalidateQuestion(questionId) {
        if (questionId) {
            questionCache.invalidate(`question:${questionId}`);
        }
        else {
            questionCache.clear();
        }
    },
    /**
     * Invalidate REC mapping cache
     */
    invalidateRecMapping(recCode) {
        if (recCode) {
            recMappingCache.invalidate(`rec:${recCode}`);
        }
        else {
            recMappingCache.clear();
        }
    },
    /**
     * Invalidate must-pass rules cache
     */
    invalidateMustPassRules() {
        mustPassRuleCache.clear();
    },
    /**
     * Invalidate scoring config cache
     */
    invalidateScoringConfig(configId) {
        if (configId) {
            scoringConfigCache.invalidate(`config:${configId}`);
        }
        else {
            scoringConfigCache.clear();
        }
    },
    /**
     * Invalidate cloud storage metadata cache (includes both file metadata and list caches)
     */
    invalidateStorageMetadata(tenantId, fileId) {
        if (tenantId && fileId) {
            // Invalidate specific file metadata
            cloudStorageMetadataCache.invalidate(`storage_meta:${tenantId}:${fileId}`);
            // Also invalidate all list caches for this tenant since file was modified
            cloudStorageMetadataCache.invalidatePattern(new RegExp(`^storage_list:${tenantId}:`));
        }
        else if (tenantId) {
            // Invalidate all metadata and lists for this tenant
            cloudStorageMetadataCache.invalidatePattern(new RegExp(`^storage_meta:${tenantId}:`));
            cloudStorageMetadataCache.invalidatePattern(new RegExp(`^storage_list:${tenantId}:`));
        }
        else {
            cloudStorageMetadataCache.clear();
        }
    },
    /**
     * Invalidate cloud storage URL cache
     */
    invalidateStorageUrls(tenantId, fileId) {
        if (tenantId && fileId) {
            cloudStorageUrlCache.invalidate(`storage_url:${tenantId}:${fileId}`);
        }
        else if (tenantId) {
            cloudStorageUrlCache.invalidatePattern(new RegExp(`^storage_url:${tenantId}:`));
        }
        else {
            cloudStorageUrlCache.clear();
        }
    },
    /**
     * Invalidate all caches
     */
    invalidateAll() {
        questionCache.clear();
        recMappingCache.clear();
        mustPassRuleCache.clear();
        scoringConfigCache.clear();
        cloudStorageMetadataCache.clear();
        cloudStorageUrlCache.clear();
    }
};
/**
 * Get cache statistics for monitoring
 */
export function getAllCacheStats() {
    return {
        questions: {
            ...questionCache.getStats(),
            hitRate: questionCache.getHitRate()
        },
        recMappings: {
            ...recMappingCache.getStats(),
            hitRate: recMappingCache.getHitRate()
        },
        mustPassRules: {
            ...mustPassRuleCache.getStats(),
            hitRate: mustPassRuleCache.getHitRate()
        },
        scoringConfigs: {
            ...scoringConfigCache.getStats(),
            hitRate: scoringConfigCache.getHitRate()
        },
        cloudStorageMetadata: {
            ...cloudStorageMetadataCache.getStats(),
            hitRate: cloudStorageMetadataCache.getHitRate()
        },
        cloudStorageUrls: {
            ...cloudStorageUrlCache.getStats(),
            hitRate: cloudStorageUrlCache.getHitRate()
        }
    };
}
