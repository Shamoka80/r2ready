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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 };

  constructor(maxSize: number = 1000, ttlMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
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
  set(key: string, data: T): void {
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
  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  /**
   * Invalidate all keys matching pattern
   */
  invalidatePattern(pattern: RegExp): number {
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
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }
}

// Global cache instances
export const questionCache = new LRUCache<any>(500, 10 * 60 * 1000); // 500 questions, 10min TTL
export const recMappingCache = new LRUCache<any>(1000, 10 * 60 * 1000); // 1000 mappings, 10min TTL
export const mustPassRuleCache = new LRUCache<any>(100, 10 * 60 * 1000); // 100 rules, 10min TTL
export const scoringConfigCache = new LRUCache<any>(50, 10 * 60 * 1000); // 50 configs, 10min TTL
export const cloudStorageMetadataCache = new LRUCache<any>(500, 60 * 60 * 1000); // 500 files, 1hr TTL
export const cloudStorageUrlCache = new LRUCache<any>(1000, 5 * 60 * 1000); // 1000 URLs, 5min TTL

/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
  /**
   * Invalidate question cache
   */
  invalidateQuestion(questionId?: string): void {
    if (questionId) {
      questionCache.invalidate(`question:${questionId}`);
    } else {
      questionCache.clear();
    }
  },

  /**
   * Invalidate REC mapping cache
   */
  invalidateRecMapping(recCode?: string): void {
    if (recCode) {
      recMappingCache.invalidate(`rec:${recCode}`);
    } else {
      recMappingCache.clear();
    }
  },

  /**
   * Invalidate must-pass rules cache
   */
  invalidateMustPassRules(): void {
    mustPassRuleCache.clear();
  },

  /**
   * Invalidate scoring config cache
   */
  invalidateScoringConfig(configId?: string): void {
    if (configId) {
      scoringConfigCache.invalidate(`config:${configId}`);
    } else {
      scoringConfigCache.clear();
    }
  },

  /**
   * Invalidate cloud storage metadata cache (includes both file metadata and list caches)
   */
  invalidateStorageMetadata(tenantId?: string, fileId?: string): void {
    if (tenantId && fileId) {
      // Invalidate specific file metadata
      cloudStorageMetadataCache.invalidate(`storage_meta:${tenantId}:${fileId}`);
      // Also invalidate all list caches for this tenant since file was modified
      cloudStorageMetadataCache.invalidatePattern(new RegExp(`^storage_list:${tenantId}:`));
    } else if (tenantId) {
      // Invalidate all metadata and lists for this tenant
      cloudStorageMetadataCache.invalidatePattern(new RegExp(`^storage_meta:${tenantId}:`));
      cloudStorageMetadataCache.invalidatePattern(new RegExp(`^storage_list:${tenantId}:`));
    } else {
      cloudStorageMetadataCache.clear();
    }
  },

  /**
   * Invalidate cloud storage URL cache
   */
  invalidateStorageUrls(tenantId?: string, fileId?: string): void {
    if (tenantId && fileId) {
      cloudStorageUrlCache.invalidate(`storage_url:${tenantId}:${fileId}`);
    } else if (tenantId) {
      cloudStorageUrlCache.invalidatePattern(new RegExp(`^storage_url:${tenantId}:`));
    } else {
      cloudStorageUrlCache.clear();
    }
  },

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
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
