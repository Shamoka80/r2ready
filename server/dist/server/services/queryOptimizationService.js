import { db } from '../db.js';
import { eq, and, inArray, desc, count } from 'drizzle-orm';
import { users, assessments, questions, answers, evidenceFiles, facilityProfiles } from '../../shared/schema.js';
import { cacheService, CacheKeys, CacheTags } from './cachingService.js';
import { ConsistentLogService } from './consistentLogService.js';
export class QueryOptimizationService {
    logger = ConsistentLogService.getInstance();
    queryMetrics = [];
    queryPatterns = new Map();
    optimizationSuggestions = [];
    performanceBaselines = new Map();
    maxMetrics = 10000;
    nPlusOneDetectionWindow = 5000; // 5 seconds
    queryCache = new Map();
    // N+1 detection state
    recentQueries = new Map();
    async trackQuery(query, startTime, options = {}) {
        const duration = Date.now() - startTime;
        const queryId = this.generateQueryId();
        const normalizedQuery = this.normalizeQuery(query);
        const metric = {
            id: queryId,
            query: this.sanitizeQuery(query),
            normalizedQuery,
            duration,
            timestamp: new Date(),
            ...options
        };
        // Store metric
        this.queryMetrics.unshift(metric);
        if (this.queryMetrics.length > this.maxMetrics) {
            this.queryMetrics = this.queryMetrics.slice(0, this.maxMetrics);
        }
        // Update query patterns
        await this.updateQueryPattern(metric);
        // Detect N+1 queries
        await this.detectNPlusOneQuery(metric);
        // Check against performance baselines
        await this.checkPerformanceBaseline(metric);
        // Generate optimization suggestions
        await this.generateOptimizationSuggestions(metric);
        // Log based on severity
        await this.logQueryMetric(metric);
    }
    async batchTrackQueries(queries) {
        // Detect potential N+1 patterns in batch
        if (queries.length > 10) {
            const patterns = this.analyzeQueryBatch(queries);
            for (const pattern of patterns) {
                if (pattern.isNPlusOne) {
                    await this.logger.warn('Potential N+1 query pattern detected in batch', {
                        service: 'database',
                        operation: 'batch_analysis',
                        metadata: {
                            batchSize: queries.length,
                            pattern: pattern.pattern,
                            occurrences: pattern.count
                        }
                    });
                }
            }
        }
        // Track individual queries
        for (const { query, startTime, options } of queries) {
            await this.trackQuery(query, startTime, options || {});
        }
    }
    async getCachedQuery(queryKey) {
        const cached = this.queryCache.get(queryKey);
        if (!cached) {
            return null;
        }
        // Check if cache is still valid (5 minutes)
        if (Date.now() - cached.timestamp > 300000) {
            this.queryCache.delete(queryKey);
            return null;
        }
        cached.hits++;
        await cacheService.set(`query:${queryKey}`, cached.result, { ttl: 300 });
        return cached.result;
    }
    async setCachedQuery(queryKey, result) {
        this.queryCache.set(queryKey, {
            result,
            timestamp: Date.now(),
            hits: 0
        });
        await cacheService.set(`query:${queryKey}`, result, {
            ttl: 300,
            tags: ['database', 'query_cache']
        });
    }
    getSlowQueries(threshold = 1000, limit = 50) {
        return this.queryMetrics
            .filter(m => m.duration > threshold)
            .sort((a, b) => b.duration - a.duration)
            .slice(0, limit);
    }
    getFrequentQueries(limit = 20) {
        return Array.from(this.queryPatterns.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit)
            .map(p => ({
            pattern: p.pattern,
            count: p.count,
            averageDuration: p.averageDuration,
            totalDuration: p.totalDuration
        }));
    }
    getNPlusOneQueries() {
        return Array.from(this.queryPatterns.values())
            .filter(p => p.isNPlusOne)
            .sort((a, b) => b.count - a.count);
    }
    getOptimizationSuggestions(severity) {
        let suggestions = this.optimizationSuggestions;
        if (severity) {
            suggestions = suggestions.filter(s => s.severity === severity);
        }
        return suggestions
            .sort((a, b) => {
            const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        })
            .slice(0, 50);
    }
    getQueryStats(timeWindow) {
        let queries = this.queryMetrics;
        if (timeWindow) {
            const cutoff = Date.now() - timeWindow;
            queries = queries.filter(q => q.timestamp.getTime() > cutoff);
        }
        if (queries.length === 0) {
            return {
                totalQueries: 0,
                averageDuration: 0,
                medianDuration: 0,
                p95Duration: 0,
                p99Duration: 0,
                slowQueries: 0,
                fastQueries: 0,
                nPlusOneQueries: 0,
                cacheHitRate: 0,
                topSlowQueries: [],
                queryDistribution: { byHour: new Array(24).fill(0), byType: {} },
                timestamp: new Date()
            };
        }
        const durations = queries.map(q => q.duration).sort((a, b) => a - b);
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        const slowQueries = queries.filter(q => q.duration > 1000).length;
        const nPlusOneQueries = Array.from(this.queryPatterns.values())
            .filter(p => p.isNPlusOne).length;
        // Calculate percentiles
        const p50Index = Math.floor(durations.length * 0.5);
        const p95Index = Math.floor(durations.length * 0.95);
        const p99Index = Math.floor(durations.length * 0.99);
        // Calculate cache hit rate
        const totalCacheQueries = Array.from(this.queryCache.values()).length;
        const totalCacheHits = Array.from(this.queryCache.values())
            .reduce((sum, cache) => sum + cache.hits, 0);
        const cacheHitRate = totalCacheQueries > 0 ? totalCacheHits / totalCacheQueries : 0;
        // Top slow queries by pattern
        const topSlowQueries = Array.from(this.queryPatterns.values())
            .filter(p => p.averageDuration > 500)
            .sort((a, b) => b.averageDuration - a.averageDuration)
            .slice(0, 10)
            .map(p => ({
            query: p.pattern,
            duration: p.averageDuration,
            count: p.count
        }));
        // Query distribution by hour
        const byHour = new Array(24).fill(0);
        const byType = {};
        queries.forEach(q => {
            const hour = q.timestamp.getHours();
            byHour[hour]++;
            const queryType = this.getQueryType(q.query);
            byType[queryType] = (byType[queryType] || 0) + 1;
        });
        return {
            totalQueries: queries.length,
            averageDuration: totalDuration / queries.length,
            medianDuration: durations[p50Index] || 0,
            p95Duration: durations[p95Index] || 0,
            p99Duration: durations[p99Index] || 0,
            slowQueries,
            fastQueries: queries.length - slowQueries,
            nPlusOneQueries,
            cacheHitRate,
            topSlowQueries,
            queryDistribution: { byHour, byType },
            timestamp: new Date()
        };
    }
    async addPerformanceBaseline(queryPattern, expectedDuration, warningMultiplier = 2, criticalMultiplier = 5) {
        this.performanceBaselines.set(queryPattern, {
            query: queryPattern,
            expectedDuration,
            warningThreshold: expectedDuration * warningMultiplier,
            criticalThreshold: expectedDuration * criticalMultiplier
        });
        await this.logger.info('Performance baseline added', {
            service: 'database',
            operation: 'add_baseline',
            metadata: {
                queryPattern,
                expectedDuration,
                warningThreshold: expectedDuration * warningMultiplier,
                criticalThreshold: expectedDuration * criticalMultiplier
            }
        });
    }
    async optimizeQuery(query) {
        const normalizedQuery = this.normalizeQuery(query);
        const suggestions = [];
        let estimatedImprovement = '0-10%';
        // Analyze query for optimization opportunities
        if (this.hasSelectStar(query)) {
            suggestions.push('Avoid SELECT * - specify only needed columns');
            estimatedImprovement = '20-40%';
        }
        if (this.hasMissingJoins(query)) {
            suggestions.push('Consider adding proper JOINs instead of multiple queries');
            estimatedImprovement = '50-80%';
        }
        if (this.hasNoWhereClause(query)) {
            suggestions.push('Add WHERE clause to filter results');
            estimatedImprovement = '60-90%';
        }
        if (this.hasComplexSubqueries(query)) {
            suggestions.push('Consider simplifying subqueries or using CTEs');
            estimatedImprovement = '30-60%';
        }
        // Check for potential indexes
        const indexSuggestions = this.suggestIndexes(query);
        suggestions.push(...indexSuggestions);
        return {
            suggestions,
            estimatedImprovement,
            optimizedQuery: suggestions.length > 0 ? this.generateOptimizedQuery(query, suggestions) : undefined
        };
    }
    async clearOldMetrics(olderThanMs) {
        const cutoffTime = new Date(Date.now() - olderThanMs);
        let removedCount = 0;
        // Only run cleanup if memory usage is high
        const memUsage = process.memoryUsage();
        const usagePercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        if (usagePercentage < 85) {
            return 0; // Skip cleanup if memory is healthy
        }
        const initialLength = this.queryMetrics.length;
        this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > cutoffTime);
        removedCount = initialLength - this.queryMetrics.length;
        return removedCount;
    }
    // Private helper methods
    generateQueryId() {
        return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    normalizeQuery(query) {
        return query
            .replace(/\s+/g, ' ')
            .replace(/\$\d+/g, '?')
            .replace(/VALUES\s*\([^)]*\)/gi, 'VALUES (?)')
            .replace(/IN\s*\([^)]*\)/gi, 'IN (?)')
            .replace(/['"][^'"]*['"]/g, '?')
            .toLowerCase()
            .trim();
    }
    sanitizeQuery(query) {
        return query
            .replace(/(['"])[^'"]*\1/g, '?')
            .replace(/\$\d+/g, '?')
            .substring(0, 500);
    }
    async updateQueryPattern(metric) {
        const pattern = metric.normalizedQuery;
        const existing = this.queryPatterns.get(pattern);
        if (existing) {
            existing.count++;
            existing.totalDuration += metric.duration;
            existing.averageDuration = existing.totalDuration / existing.count;
            existing.lastSeen = metric.timestamp;
        }
        else {
            this.queryPatterns.set(pattern, {
                pattern,
                count: 1,
                totalDuration: metric.duration,
                averageDuration: metric.duration,
                lastSeen: metric.timestamp,
                isNPlusOne: false,
                suggestions: []
            });
        }
    }
    async detectNPlusOneQuery(metric) {
        const pattern = metric.normalizedQuery;
        const now = Date.now();
        // Clean old entries
        for (const [key, data] of this.recentQueries.entries()) {
            if (now - data.timestamp > this.nPlusOneDetectionWindow) {
                this.recentQueries.delete(key);
            }
        }
        // Track recent queries by pattern
        if (!this.recentQueries.has(pattern)) {
            this.recentQueries.set(pattern, { queries: [], timestamp: now });
        }
        const recentData = this.recentQueries.get(pattern);
        recentData.queries.push(metric);
        recentData.timestamp = now;
        // Detect N+1 pattern: same query executed many times in short window
        if (recentData.queries.length >= 10) {
            const queryPattern = this.queryPatterns.get(pattern);
            if (queryPattern) {
                queryPattern.isNPlusOne = true;
                queryPattern.suggestions.push('Use JOIN instead of multiple queries');
                queryPattern.suggestions.push('Implement query batching');
                queryPattern.suggestions.push('Add data loader pattern');
            }
            await this.addOptimizationSuggestion({
                type: 'n_plus_one',
                severity: 'high',
                query: metric.query,
                suggestion: `N+1 query detected: ${recentData.queries.length} similar queries in ${this.nPlusOneDetectionWindow}ms. Consider using JOINs or batching.`,
                estimatedImprovement: '70-90%',
                detectedAt: new Date()
            });
            // Reset to avoid spam
            recentData.queries = [];
        }
    }
    async checkPerformanceBaseline(metric) {
        const baseline = this.performanceBaselines.get(metric.normalizedQuery);
        if (baseline) {
            if (metric.duration > baseline.criticalThreshold) {
                await this.addOptimizationSuggestion({
                    type: 'inefficient_join',
                    severity: 'critical',
                    query: metric.query,
                    suggestion: `Query exceeded critical performance baseline by ${((metric.duration / baseline.expectedDuration - 1) * 100).toFixed(1)}%`,
                    estimatedImprovement: '50-80%',
                    detectedAt: new Date()
                });
            }
            else if (metric.duration > baseline.warningThreshold) {
                await this.addOptimizationSuggestion({
                    type: 'inefficient_join',
                    severity: 'medium',
                    query: metric.query,
                    suggestion: `Query exceeded warning performance baseline by ${((metric.duration / baseline.expectedDuration - 1) * 100).toFixed(1)}%`,
                    estimatedImprovement: '20-50%',
                    detectedAt: new Date()
                });
            }
        }
    }
    async generateOptimizationSuggestions(metric) {
        const suggestions = [];
        // Slow query analysis
        if (metric.duration > 5000) {
            suggestions.push({
                type: 'complex_query',
                severity: 'critical',
                query: metric.query,
                suggestion: 'Query is very slow (>5s). Consider query optimization, indexing, or pagination.',
                estimatedImprovement: '60-90%',
                detectedAt: new Date()
            });
        }
        else if (metric.duration > 1000) {
            suggestions.push({
                type: 'complex_query',
                severity: 'medium',
                query: metric.query,
                suggestion: 'Query is slow (>1s). Consider optimization.',
                estimatedImprovement: '30-60%',
                detectedAt: new Date()
            });
        }
        // Large result set analysis
        if (metric.rowsAffected && metric.rowsAffected > 10000) {
            suggestions.push({
                type: 'large_result_set',
                severity: 'high',
                query: metric.query,
                suggestion: `Large result set (${metric.rowsAffected} rows). Consider pagination or filtering.`,
                estimatedImprovement: '40-70%',
                detectedAt: new Date()
            });
        }
        // Add all new suggestions
        for (const suggestion of suggestions) {
            await this.addOptimizationSuggestion(suggestion);
        }
    }
    async addOptimizationSuggestion(suggestion) {
        // Avoid duplicates
        const exists = this.optimizationSuggestions.some(s => s.query === suggestion.query && s.type === suggestion.type);
        if (!exists) {
            this.optimizationSuggestions.unshift(suggestion);
            // Limit suggestions
            if (this.optimizationSuggestions.length > 1000) {
                this.optimizationSuggestions = this.optimizationSuggestions.slice(0, 1000);
            }
        }
    }
    async logQueryMetric(metric) {
        const level = metric.duration > 2000 ? 'ERROR' : metric.duration > 1000 ? 'WARN' : 'DEBUG';
        await this.logger.logDatabaseQuery(metric.query, metric.duration, {
            service: 'database',
            operation: 'query',
            userId: metric.userId,
            tenantId: metric.tenantId,
            metadata: {
                queryId: metric.id,
                rowsAffected: metric.rowsAffected,
                source: metric.source,
                connectionId: metric.connectionId,
                normalizedQuery: metric.normalizedQuery
            }
        });
    }
    analyzeQueryBatch(queries) {
        const patterns = new Map();
        for (const { query } of queries) {
            const normalized = this.normalizeQuery(query);
            const existing = patterns.get(normalized);
            if (existing) {
                existing.count++;
                if (existing.count >= 5) {
                    existing.isNPlusOne = true;
                }
            }
            else {
                patterns.set(normalized, {
                    count: 1,
                    isNPlusOne: false,
                    pattern: normalized
                });
            }
        }
        return Array.from(patterns.values())
            .filter(p => p.isNPlusOne)
            .map(p => ({
            pattern: p.pattern,
            count: p.count,
            totalDuration: 0,
            averageDuration: 0,
            lastSeen: new Date(),
            isNPlusOne: p.isNPlusOne,
            suggestions: ['Batch queries', 'Use data loader', 'Implement proper JOINs']
        }));
    }
    getQueryType(query) {
        const normalizedQuery = query.toLowerCase().trim();
        if (normalizedQuery.startsWith('select'))
            return 'SELECT';
        if (normalizedQuery.startsWith('insert'))
            return 'INSERT';
        if (normalizedQuery.startsWith('update'))
            return 'UPDATE';
        if (normalizedQuery.startsWith('delete'))
            return 'DELETE';
        if (normalizedQuery.startsWith('with'))
            return 'CTE';
        return 'OTHER';
    }
    hasSelectStar(query) {
        return /select\s+\*\s+from/i.test(query);
    }
    hasMissingJoins(query) {
        const hasMultipleFrom = (query.match(/from\s+\w+/gi) || []).length > 1;
        const hasJoin = /\s+join\s+/i.test(query);
        return hasMultipleFrom && !hasJoin;
    }
    hasNoWhereClause(query) {
        return /select\s+.*\s+from\s+\w+(?:\s+|$)/i.test(query) && !/\s+where\s+/i.test(query);
    }
    hasComplexSubqueries(query) {
        const subqueryCount = (query.match(/\(\s*select\s+/gi) || []).length;
        return subqueryCount >= 3;
    }
    suggestIndexes(query) {
        const suggestions = [];
        // Simple heuristics for index suggestions
        const whereMatches = query.match(/where\s+(\w+)\s*=/gi);
        if (whereMatches) {
            whereMatches.forEach(match => {
                const column = match.replace(/where\s+|\s*=/gi, '');
                suggestions.push(`Consider adding index on column: ${column}`);
            });
        }
        const joinMatches = query.match(/join\s+\w+\s+on\s+(\w+)/gi);
        if (joinMatches) {
            joinMatches.forEach(match => {
                const column = match.replace(/join\s+\w+\s+on\s+/gi, '');
                suggestions.push(`Consider adding index on join column: ${column}`);
            });
        }
        return suggestions;
    }
    generateOptimizedQuery(query, suggestions) {
        let optimized = query;
        // Apply basic optimizations
        if (suggestions.some(s => s.includes('SELECT *'))) {
            optimized = optimized.replace(/select\s+\*/gi, 'SELECT column1, column2, ...');
        }
        return optimized;
    }
    // Optimized user queries with caching and relation loading
    async getUserById(userId, options = {}) {
        const cacheKey = CacheKeys.user(userId);
        if (options.useCache !== false) {
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                this.logger.debug('Cache hit for user query', { userId });
                return cached;
            }
        }
        const startTime = Date.now();
        try {
            const baseQuery = db
                .select()
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);
            const [user] = await baseQuery;
            if (!user) {
                this.logger.warn('User not found', { userId });
                return null;
            }
            let result = user;
            // Load relations if requested
            if (options.includeRelations?.includes('assessments')) {
                result = await this.attachUserAssessments(result);
            }
            if (options.includeRelations?.includes('facilities')) {
                result = await this.attachUserFacilities(result);
            }
            // Cache the result
            if (options.useCache !== false) {
                await cacheService.set(cacheKey, result, {
                    ttl: options.cacheTTL,
                    tags: [CacheTags.USER, CacheTags.userTag(userId), ...(options.cacheTags || [])]
                });
            }
            const duration = Date.now() - startTime;
            await this.trackQuery(baseQuery.toSQL().sql, startTime, { rowsAffected: result ? 1 : 0, userId, source: 'getUserById' });
            this.logger.debug('User query completed', {
                service: 'query-optimization',
                operation: 'getUserById',
                metadata: { userId, duration, cached: false }
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to fetch user', {
                service: 'query-optimization',
                operation: 'getUserById',
                metadata: { userId, error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }
    // Batch user loading to prevent N+1 queries
    async getUsersByIds(userIds, options = {}) {
        if (userIds.length === 0)
            return new Map();
        const result = new Map();
        const uncachedIds = [];
        // Check cache first
        if (options.useCache !== false) {
            for (const userId of userIds) {
                const cached = await cacheService.get(CacheKeys.user(userId));
                if (cached) {
                    result.set(userId, cached);
                }
                else {
                    uncachedIds.push(userId);
                }
            }
        }
        else {
            uncachedIds.push(...userIds);
        }
        if (uncachedIds.length === 0) {
            this.logger.debug('All users found in cache', {
                service: 'query-optimization',
                operation: 'getUsersByIds',
                metadata: { requestedCount: userIds.length }
            });
            return result;
        }
        const startTime = Date.now();
        try {
            // Batch fetch uncached users
            const batchSize = options.batchSize || 100;
            for (let i = 0; i < uncachedIds.length; i += batchSize) {
                const batch = uncachedIds.slice(i, i + batchSize);
                const batchUsersQuery = db
                    .select()
                    .from(users)
                    .where(inArray(users.id, batch));
                const batchUsers = await batchUsersQuery;
                // Process batch results
                for (const user of batchUsers) {
                    let processedUser = user;
                    // Load relations if requested
                    if (options.includeRelations?.includes('assessments')) {
                        processedUser = await this.attachUserAssessments(processedUser);
                    }
                    if (options.includeRelations?.includes('facilities')) {
                        processedUser = await this.attachUserFacilities(processedUser);
                    }
                    result.set(user.id, processedUser);
                    // Cache individual results
                    if (options.useCache !== false) {
                        await cacheService.set(CacheKeys.user(user.id), processedUser, {
                            ttl: options.cacheTTL,
                            tags: [CacheTags.USER, CacheTags.userTag(user.id)]
                        });
                    }
                }
                await this.trackQuery(batchUsersQuery.toSQL().sql, startTime, { rowsAffected: batchUsers.length, userId: userIds.join(','), source: 'getUsersByIds' });
            }
            const duration = Date.now() - startTime;
            this.logger.debug('Batch user query completed', {
                service: 'query-optimization',
                operation: 'getUsersByIds',
                metadata: {
                    requestedCount: userIds.length,
                    cachedCount: userIds.length - uncachedIds.length,
                    fetchedCount: uncachedIds.length,
                    duration
                }
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to batch fetch users', {
                service: 'query-optimization',
                operation: 'getUsersByIds',
                metadata: { userIds: uncachedIds, error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }
    // Optimized assessment queries with eager loading
    async getAssessmentWithDetails(assessmentId, options = {}) {
        const cacheKey = CacheKeys.assessment(assessmentId);
        if (options.useCache !== false) {
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                this.logger.debug('Cache hit for assessment query', {
                    service: 'query-optimization',
                    operation: 'getAssessmentWithDetails',
                    metadata: { assessmentId }
                });
                return cached;
            }
        }
        const startTime = Date.now();
        try {
            // Single query to get assessment with user info
            const assessmentQuery = db
                .select({
                id: assessments.id,
                title: assessments.title,
                status: assessments.status,
                progress: assessments.progress,
                createdAt: assessments.createdAt,
                updatedAt: assessments.updatedAt,
                createdBy: assessments.createdBy,
                tenantId: assessments.tenantId,
                facilityId: assessments.facilityId,
                user: {
                    id: users.id,
                    email: users.email,
                    firstName: users.firstName,
                    lastName: users.lastName
                }
            })
                .from(assessments)
                .leftJoin(users, eq(assessments.createdBy, users.id))
                .where(eq(assessments.id, assessmentId))
                .limit(1);
            const [assessment] = await assessmentQuery;
            if (!assessment) {
                this.logger.warn('Assessment not found', {
                    service: 'query-optimization',
                    operation: 'getAssessmentWithDetails',
                    metadata: { assessmentId }
                });
                return null;
            }
            const result = { ...assessment };
            // Batch load related data if requested
            if (options.includeRelations?.includes('answers')) {
                result.answers = await this.getAnswersByAssessmentId(assessmentId, { useCache: false });
            }
            if (options.includeRelations?.includes('evidence')) {
                result.evidence = await this.getEvidenceByAssessmentId(assessmentId, { useCache: false });
            }
            if (options.includeRelations?.includes('questions')) {
                result.questions = await this.getQuestionsByAssessmentId(assessmentId, { useCache: false });
            }
            // Cache the complete result
            if (options.useCache !== false) {
                await cacheService.set(cacheKey, result, {
                    ttl: options.cacheTTL,
                    tags: [
                        CacheTags.ASSESSMENT,
                        CacheTags.assessmentTag(assessmentId),
                        CacheTags.userTag(assessment.createdBy),
                        CacheTags.tenantTag(assessment.tenantId),
                        ...(options.cacheTags || [])
                    ]
                });
            }
            await this.trackQuery(assessmentQuery.toSQL().sql, startTime, { rowsAffected: result ? 1 : 0, userId: assessment.createdBy, tenantId: assessment.tenantId, source: 'getAssessmentWithDetails' });
            const duration = Date.now() - startTime;
            this.logger.debug('Assessment with details query completed', {
                service: 'query-optimization',
                operation: 'getAssessmentWithDetails',
                metadata: {
                    assessmentId,
                    duration,
                    includeRelations: options.includeRelations
                }
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to fetch assessment with details', {
                service: 'query-optimization',
                operation: 'getAssessmentWithDetails',
                metadata: { assessmentId, error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }
    // Optimized pagination with total count
    async getAssessmentsPaginated(tenantId, options = {}) {
        const { limit = 25, offset = 0, includeTotal = false } = options;
        const cacheKey = `assessments:paginated:${tenantId}:${JSON.stringify(options)}`;
        if (options.useCache !== false) {
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                this.logger.debug('Cache hit for paginated assessments', {
                    service: 'query-optimization',
                    operation: 'getAssessmentsPaginated',
                    metadata: { tenantId, options }
                });
                return cached;
            }
        }
        const startTime = Date.now();
        try {
            // Build where conditions
            const conditions = [eq(assessments.tenantId, tenantId)];
            if (options.status) {
                conditions.push(eq(assessments.status, options.status));
            }
            if (options.userId) {
                conditions.push(eq(assessments.createdBy, options.userId));
            }
            if (options.facilityId) {
                conditions.push(eq(assessments.facilityId, options.facilityId));
            }
            const whereClause = and(...conditions);
            // Execute queries in parallel if total is needed
            const queries = [
                db
                    .select({
                    id: assessments.id,
                    title: assessments.title,
                    status: assessments.status,
                    progress: assessments.progress,
                    createdAt: assessments.createdAt,
                    updatedAt: assessments.updatedAt,
                    createdBy: assessments.createdBy,
                    facilityId: assessments.facilityId,
                    user: {
                        id: users.id,
                        email: users.email,
                        firstName: users.firstName,
                        lastName: users.lastName
                    }
                })
                    .from(assessments)
                    .leftJoin(users, eq(assessments.createdBy, users.id))
                    .where(whereClause)
                    .orderBy(desc(assessments.updatedAt))
                    .limit(limit + 1) // Get one extra to check if there are more
                    .offset(offset)
            ];
            if (includeTotal) {
                queries.push(db
                    .select({ count: count() })
                    .from(assessments)
                    .where(whereClause)
                    .then(result => result[0]?.count || 0));
            }
            const [assessmentResults, totalCount] = await Promise.all(queries);
            const hasMore = assessmentResults.length > limit;
            const finalAssessments = hasMore ? assessmentResults.slice(0, limit) : assessmentResults;
            const result = {
                assessments: finalAssessments,
                ...(includeTotal && { total: totalCount }),
                hasMore
            };
            // Cache with shorter TTL for paginated results
            if (options.useCache !== false) {
                await cacheService.set(cacheKey, result, {
                    ttl: 5 * 60 * 1000, // 5 minutes
                    tags: [CacheTags.ASSESSMENT, CacheTags.tenantTag(tenantId)]
                });
            }
            const duration = Date.now() - startTime;
            this.logger.debug('Paginated assessments query completed', {
                service: 'query-optimization',
                operation: 'getAssessmentsPaginated',
                metadata: {
                    tenantId,
                    count: finalAssessments.length,
                    hasMore,
                    duration
                }
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to fetch paginated assessments', {
                service: 'query-optimization',
                operation: 'getAssessmentsPaginated',
                metadata: { tenantId, options, error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }
    // Optimized question loading with batching
    async getQuestionsByAssessmentId(assessmentId, options = {}) {
        const cacheKey = CacheKeys.questionsByAssessment(assessmentId);
        if (options.useCache !== false) {
            const cached = await cacheService.get(cacheKey);
            if (cached)
                return cached;
        }
        const startTime = Date.now();
        try {
            const questionsQuery = db
                .select()
                .from(questions)
                .where(eq(questions.isActive, true))
                .orderBy(questions.order);
            const questionsResult = await questionsQuery;
            if (options.useCache !== false) {
                await cacheService.set(cacheKey, questionsResult, {
                    ttl: 30 * 60 * 1000, // 30 minutes - questions don't change often
                    tags: [CacheTags.QUESTION, CacheTags.assessmentTag(assessmentId)]
                });
            }
            await this.trackQuery(questionsQuery.toSQL().sql, startTime, { rowsAffected: questionsResult.length, source: 'getQuestionsByAssessmentId' });
            return questionsResult;
        }
        catch (error) {
            this.logger.error('Failed to fetch questions for assessment', {
                service: 'query-optimization',
                operation: 'getQuestionsByAssessmentId',
                metadata: { assessmentId, error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }
    // Optimized answer loading
    async getAnswersByAssessmentId(assessmentId, options = {}) {
        const cacheKey = CacheKeys.answers(assessmentId);
        if (options.useCache !== false) {
            const cached = await cacheService.get(cacheKey);
            if (cached)
                return cached;
        }
        const startTime = Date.now();
        try {
            const answersQuery = db
                .select()
                .from(answers)
                .where(eq(answers.assessmentId, assessmentId));
            const answersResult = await answersQuery;
            if (options.useCache !== false) {
                await cacheService.set(cacheKey, answersResult, {
                    ttl: 10 * 60 * 1000, // 10 minutes - answers change more frequently
                    tags: [CacheTags.ANSWER, CacheTags.assessmentTag(assessmentId)]
                });
            }
            await this.trackQuery(answersQuery.toSQL().sql, startTime, { rowsAffected: answersResult.length, source: 'getAnswersByAssessmentId' });
            return answersResult;
        }
        catch (error) {
            this.logger.error('Failed to fetch answers for assessment', {
                service: 'query-optimization',
                operation: 'getAnswersByAssessmentId',
                metadata: { assessmentId, error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }
    // Optimized evidence loading
    async getEvidenceByAssessmentId(assessmentId, options = {}) {
        const cacheKey = CacheKeys.evidenceList(assessmentId);
        if (options.useCache !== false) {
            const cached = await cacheService.get(cacheKey);
            if (cached)
                return cached;
        }
        const startTime = Date.now();
        try {
            const evidenceQuery = db
                .select()
                .from(evidenceFiles)
                .where(eq(evidenceFiles.assessmentId, assessmentId))
                .orderBy(desc(evidenceFiles.createdAt));
            const evidenceResult = await evidenceQuery;
            if (options.useCache !== false) {
                await cacheService.set(cacheKey, evidenceResult, {
                    ttl: 15 * 60 * 1000, // 15 minutes
                    tags: [CacheTags.EVIDENCE, CacheTags.assessmentTag(assessmentId)]
                });
            }
            await this.trackQuery(evidenceQuery.toSQL().sql, startTime, { rowsAffected: evidenceResult.length, source: 'getEvidenceByAssessmentId' });
            return evidenceResult;
        }
        catch (error) {
            this.logger.error('Failed to fetch evidence for assessment', {
                service: 'query-optimization',
                operation: 'getEvidenceByAssessmentId',
                metadata: { assessmentId, error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }
    // Helper methods for relation loading
    async attachUserAssessments(user) {
        const startTime = Date.now();
        const userAssessmentsQuery = db
            .select()
            .from(assessments)
            .where(eq(assessments.createdBy, user.id))
            .orderBy(desc(assessments.updatedAt))
            .limit(10); // Limit to recent assessments
        const userAssessments = await userAssessmentsQuery;
        await this.trackQuery(userAssessmentsQuery.toSQL().sql, startTime, { rowsAffected: userAssessments.length, userId: user.id, source: 'attachUserAssessments' });
        return { ...user, assessments: userAssessments };
    }
    async attachUserFacilities(user) {
        const startTime = Date.now();
        const userFacilitiesQuery = db
            .select()
            .from(facilityProfiles)
            .where(eq(facilityProfiles.tenantId, user.tenantId));
        const userFacilities = await userFacilitiesQuery;
        await this.trackQuery(userFacilitiesQuery.toSQL().sql, startTime, { rowsAffected: userFacilities.length, tenantId: user.tenantId, source: 'attachUserFacilities' });
        return { ...user, facilities: userFacilities };
    }
    // Cache invalidation helpers
    async invalidateUserCache(userId) {
        await cacheService.invalidateByTags([CacheTags.userTag(userId)]);
        this.logger.debug('Invalidated user cache', {
            service: 'query-optimization',
            operation: 'invalidateUserCache',
            metadata: { userId }
        });
    }
    async invalidateAssessmentCache(assessmentId) {
        await cacheService.invalidateByTags([CacheTags.assessmentTag(assessmentId)]);
        this.logger.debug('Invalidated assessment cache', {
            service: 'query-optimization',
            operation: 'invalidateAssessmentCache',
            metadata: { assessmentId }
        });
    }
    async invalidateTenantCache(tenantId) {
        await cacheService.invalidateByTags([CacheTags.tenantTag(tenantId)]);
        this.logger.debug('Invalidated tenant cache', {
            service: 'query-optimization',
            operation: 'invalidateTenantCache',
            metadata: { tenantId }
        });
    }
    // Health check for query optimization
    async healthCheck() {
        try {
            const cacheHealth = await cacheService.healthCheck();
            const cacheStats = cacheService.getStats();
            const queryServiceHealth = await this.getQueryServiceHealth();
            let status = 'healthy';
            const issues = [];
            if (queryServiceHealth.status === 'critical' || cacheHealth.status === 'critical') {
                status = 'critical';
                if (queryServiceHealth.status === 'critical')
                    issues.push('Query service critical');
                if (cacheHealth.status === 'critical')
                    issues.push('Cache service critical');
            }
            else if (queryServiceHealth.status === 'warning' || cacheHealth.status === 'warning' || cacheStats.hitRate < 60) {
                status = 'warning';
                if (queryServiceHealth.status === 'warning')
                    issues.push('Query service warning');
                if (cacheHealth.status === 'warning')
                    issues.push('Cache service warning');
                if (cacheStats.hitRate < 60)
                    issues.push('Low cache hit rate');
            }
            return {
                status,
                details: {
                    queryService: queryServiceHealth.details,
                    cacheHealth: cacheHealth.status,
                    cacheStats: {
                        hitRate: cacheStats.hitRate,
                        totalQueries: cacheStats.hits + cacheStats.misses,
                        cacheSize: cacheStats.totalKeys,
                        memoryUsage: cacheHealth.details.memoryUsage
                    },
                    issues
                }
            };
        }
        catch (error) {
            this.logger.error('Query optimization health check failed', {
                service: 'query-optimization',
                operation: 'healthCheck',
                metadata: { error: error instanceof Error ? error.message : String(error) }
            });
            return {
                status: 'critical',
                details: { error: error instanceof Error ? error.message : 'Unknown error' }
            };
        }
    }
    async getQueryServiceHealth() {
        const stats = this.getQueryStats();
        const nPlusOneQueries = this.getNPlusOneQueries();
        const criticalSuggestions = this.getOptimizationSuggestions('critical');
        let status = 'healthy';
        const issues = [];
        if (stats.averageDuration > 500) {
            status = 'warning';
            issues.push('High average query duration');
        }
        if (stats.averageDuration > 2000) {
            status = 'critical';
            issues.push('Very high average query duration');
        }
        const slowQueryRatio = stats.totalQueries > 0 ? stats.slowQueries / stats.totalQueries : 0;
        if (slowQueryRatio > 0.1) {
            status = 'warning';
            issues.push('High ratio of slow queries');
        }
        if (slowQueryRatio > 0.3) {
            status = 'critical';
            issues.push('Very high ratio of slow queries');
        }
        if (nPlusOneQueries.length > 0) {
            status = 'warning';
            issues.push(`${nPlusOneQueries.length} N+1 query patterns detected`);
        }
        if (nPlusOneQueries.length > 10) {
            status = 'critical';
            issues.push('Many N+1 query patterns detected');
        }
        if (criticalSuggestions.length > 0) {
            status = 'critical';
            issues.push(`${criticalSuggestions.length} critical optimization issues`);
        }
        return {
            status,
            details: {
                ...stats,
                nPlusOnePatterns: nPlusOneQueries.length,
                optimizationSuggestions: this.optimizationSuggestions.length,
                criticalSuggestions: criticalSuggestions.length,
                issues,
                cacheStats: {
                    cachedQueries: this.queryCache.size,
                    cacheHitRate: stats.cacheHitRate
                }
            }
        };
    }
}
export const queryOptimizationService = new QueryOptimizationService();
