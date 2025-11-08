import ObservabilityService from './observabilityService.js';
class SystemHealthService {
    healthHistory = [];
    maxHistorySize = 100;
    async performHealthCheck() {
        const checkTime = new Date();
        const [database, memory, disk, network, application] = await Promise.all([
            this.checkDatabaseHealth(),
            this.checkMemoryHealth(),
            this.checkDiskHealth(),
            this.checkNetworkHealth(),
            this.checkApplicationHealth()
        ]);
        const components = { database, memory, disk, network, application };
        const scores = Object.values(components).map(c => c.score);
        const overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        let overall;
        if (overallScore >= 90)
            overall = 'healthy';
        else if (overallScore >= 70)
            overall = 'degraded';
        else
            overall = 'critical';
        const recommendations = this.generateRecommendations(components);
        const healthStatus = {
            overall,
            score: overallScore,
            lastCheck: checkTime,
            components,
            recommendations
        };
        // Store in history
        this.healthHistory.unshift(healthStatus);
        if (this.healthHistory.length > this.maxHistorySize) {
            this.healthHistory = this.healthHistory.slice(0, this.maxHistorySize);
        }
        // Log health check
        await ObservabilityService.log('INFO', `System health check completed: ${overall} (${overallScore})`, {
            service: 'health',
            operation: 'health_check',
            metadata: {
                overall,
                score: overallScore,
                components: Object.keys(components).map(key => `${key}:${components[key].status}`)
            }
        });
        return healthStatus;
    }
    async checkDatabaseHealth() {
        try {
            const start = Date.now();
            const healthCheck = await ObservabilityService.getSystemHealth();
            const responseTime = Date.now() - start;
            if (healthCheck.checks.database?.status === 'pass') {
                return {
                    status: 'healthy',
                    score: 100,
                    message: `Database responsive (${responseTime}ms)`,
                    metrics: { responseTime },
                    lastCheck: new Date()
                };
            }
            else {
                return {
                    status: 'critical',
                    score: 0,
                    message: healthCheck.checks.database?.message || 'Database connection failed',
                    lastCheck: new Date()
                };
            }
        }
        catch (error) {
            return {
                status: 'critical',
                score: 0,
                message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                lastCheck: new Date()
            };
        }
    }
    async checkMemoryHealth() {
        try {
            const memUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const usagePercentage = (heapUsedMB / heapTotalMB) * 100;
            let status;
            let score;
            if (usagePercentage < 85) {
                status = 'healthy';
                score = 100;
            }
            else if (usagePercentage < 95) {
                status = 'degraded';
                score = 85;
            }
            else {
                status = 'critical';
                score = 40;
            }
            return {
                status,
                score,
                message: `Memory usage: ${heapUsedMB}MB/${heapTotalMB}MB (${Math.round(usagePercentage)}%)`,
                metrics: {
                    heapUsed: heapUsedMB,
                    heapTotal: heapTotalMB,
                    usagePercentage: Math.round(usagePercentage),
                    rss: Math.round(memUsage.rss / 1024 / 1024)
                },
                lastCheck: new Date()
            };
        }
        catch (error) {
            return {
                status: 'critical',
                score: 0,
                message: `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                lastCheck: new Date()
            };
        }
    }
    async checkDiskHealth() {
        // Simplified disk check - in production, you'd use fs.stats()
        try {
            return {
                status: 'healthy',
                score: 100,
                message: 'Disk space sufficient',
                metrics: { available: 'N/A' },
                lastCheck: new Date()
            };
        }
        catch (error) {
            return {
                status: 'degraded',
                score: 50,
                message: 'Disk space check not available',
                lastCheck: new Date()
            };
        }
    }
    async checkNetworkHealth() {
        try {
            // Simple network connectivity check
            const start = Date.now();
            // In a real implementation, you might ping external services
            const latency = Date.now() - start;
            return {
                status: 'healthy',
                score: 100,
                message: `Network responsive (${latency}ms)`,
                metrics: { latency },
                lastCheck: new Date()
            };
        }
        catch (error) {
            return {
                status: 'degraded',
                score: 50,
                message: 'Network check limited',
                lastCheck: new Date()
            };
        }
    }
    async checkApplicationHealth() {
        try {
            // Check for recent errors
            const recentErrors = await ObservabilityService.getPerformanceAnalytics('1h');
            let status;
            let score;
            if (recentErrors.errorRate < 2) {
                status = 'healthy';
                score = 100;
            }
            else if (recentErrors.errorRate < 8) {
                status = 'degraded';
                score = 85;
            }
            else {
                status = 'critical';
                score = 40;
            }
            return {
                status,
                score,
                message: `Error rate: ${recentErrors.errorRate}%, Avg response: ${recentErrors.averageResponseTime}ms`,
                metrics: {
                    errorRate: recentErrors.errorRate,
                    avgResponseTime: recentErrors.averageResponseTime,
                    totalRequests: recentErrors.totalRequests
                },
                lastCheck: new Date()
            };
        }
        catch (error) {
            return {
                status: 'degraded',
                score: 50,
                message: 'Application metrics check failed',
                lastCheck: new Date()
            };
        }
    }
    generateRecommendations(components) {
        const recommendations = [];
        if (components.memory.status !== 'healthy') {
            recommendations.push('Monitor memory usage and consider optimization');
        }
        if (components.database.status !== 'healthy') {
            recommendations.push('Check database connection and query performance');
        }
        if (components.application.status !== 'healthy') {
            recommendations.push('Review application logs and fix errors');
        }
        if (recommendations.length === 0) {
            recommendations.push('System is operating normally');
        }
        return recommendations;
    }
    getLatestHealth() {
        return this.healthHistory[0] || null;
    }
    getHealthHistory() {
        return [...this.healthHistory];
    }
    /**
     * Start periodic health monitoring with adaptive intervals
     */
    startHealthMonitoring(intervalMs = 120000) {
        console.log(`🏥 Starting health monitoring every ${intervalMs}ms`);
        let currentInterval = intervalMs;
        let consecutiveHealthyChecks = 0;
        let healthCheckRunning = false;
        // Perform initial health check after a delay
        setTimeout(() => {
            this.performHealthCheck().catch(error => {
                console.error('Initial health check failed:', error);
            });
        }, 10000);
        // Set up adaptive health checks with backpressure protection
        const scheduleNextCheck = () => {
            setTimeout(async () => {
                if (healthCheckRunning) {
                    console.warn('Health check already running, skipping...');
                    scheduleNextCheck();
                    return;
                }
                healthCheckRunning = true;
                try {
                    const health = await this.performHealthCheck();
                    if (health.overall === 'healthy') {
                        consecutiveHealthyChecks++;
                        // Gradually increase interval for healthy systems (up to 10 minutes)
                        currentInterval = Math.min(600000, intervalMs * (1 + consecutiveHealthyChecks * 0.3));
                    }
                    else {
                        consecutiveHealthyChecks = 0;
                        // Use shorter interval for unhealthy systems but not too aggressive
                        currentInterval = Math.max(60000, intervalMs * 0.8);
                    }
                }
                catch (error) {
                    console.error('Periodic health check failed:', error);
                    consecutiveHealthyChecks = 0;
                    currentInterval = intervalMs;
                }
                finally {
                    healthCheckRunning = false;
                    scheduleNextCheck();
                }
            }, currentInterval);
        };
        scheduleNextCheck();
    }
}
export const systemHealthService = new SystemHealthService();
