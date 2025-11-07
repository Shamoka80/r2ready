import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { systemLogs, performanceMetrics, errorLogs, assessments, answers } from '@shared/schema';
export class ObservabilityDashboardService {
    async getSystemMetrics(timeRange = '24h') {
        const endTime = new Date();
        const startTime = new Date();
        switch (timeRange) {
            case '1h':
                startTime.setHours(endTime.getHours() - 1);
                break;
            case '24h':
                startTime.setHours(endTime.getHours() - 24);
                break;
            case '7d':
                startTime.setDate(endTime.getDate() - 7);
                break;
            case '30d':
                startTime.setDate(endTime.getDate() - 30);
                break;
        }
        const [systemHealth, applicationMetrics, alerts, trends] = await Promise.all([
            this.getSystemHealth(startTime, endTime),
            this.getApplicationMetrics(startTime, endTime),
            this.getActiveAlerts(),
            this.getTrends(startTime, endTime)
        ]);
        return {
            systemHealth,
            applicationMetrics,
            alerts,
            trends
        };
    }
    async getSystemHealth(startTime, endTime) {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        // Get average response time from metrics
        const [responseTimeData] = await db
            .select({
            avgResponseTime: sql `AVG(value)`
        })
            .from(performanceMetrics)
            .where(and(gte(performanceMetrics.timestamp, startTime), lte(performanceMetrics.timestamp, endTime), eq(performanceMetrics.unit, 'ms')));
        // Get active users count (approximate from recent logs)
        const [activeUsersData] = await db
            .select({
            count: sql `COUNT(DISTINCT user_id)`
        })
            .from(systemLogs)
            .where(and(gte(systemLogs.timestamp, new Date(Date.now() - 60 * 60 * 1000)), // Last hour
        sql `user_id IS NOT NULL`));
        return {
            uptime: Math.round(uptime),
            memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            cpuUsage: 0, // Node.js doesn't provide direct CPU usage
            dbConnections: 1, // Simplified for this implementation
            activeUsers: activeUsersData.count || 0,
            responseTime: Math.round(responseTimeData.avgResponseTime || 0)
        };
    }
    async getApplicationMetrics(startTime, endTime) {
        try {
            // Get real assessment data from assessments table
            const assessmentCounts = await db
                .select({
                totalAssessments: sql `COUNT(*)`,
                completedAssessments: sql `COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)`,
                inProgressAssessments: sql `COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END)`,
                newAssessments: sql `COUNT(CASE WHEN created_at >= ${startTime} THEN 1 END)`
            })
                .from(assessments)
                .where(lte(assessments.createdAt, endTime));
            // Get active user count from system logs
            const userActivity = await db
                .select({
                activeUsers: sql `COUNT(DISTINCT user_id)`,
                totalSessions: sql `COUNT(DISTINCT session_id)`
            })
                .from(systemLogs)
                .where(and(gte(systemLogs.timestamp, startTime), lte(systemLogs.timestamp, endTime), sql `user_id IS NOT NULL`));
            // Get error metrics from system logs
            const errorMetrics = await db
                .select({
                errorCount: sql `COUNT(CASE WHEN level = 'error' THEN 1 END)`,
                warningCount: sql `COUNT(CASE WHEN level = 'warn' THEN 1 END)`,
                totalLogs: sql `COUNT(*)`
            })
                .from(systemLogs)
                .where(and(gte(systemLogs.timestamp, startTime), lte(systemLogs.timestamp, endTime)));
            // Calculate error rate as percentage of total logs
            const errorRate = errorMetrics[0]?.totalLogs > 0
                ? (errorMetrics[0].errorCount / errorMetrics[0].totalLogs) * 100
                : 0;
            // Calculate throughput (requests per minute)
            const durationMinutes = Math.max((endTime.getTime() - startTime.getTime()) / (1000 * 60), 1);
            const throughput = (errorMetrics[0]?.totalLogs || 0) / durationMinutes;
            // Get question answering activity
            const answerActivity = await db
                .select({
                totalAnswers: sql `COUNT(*)`,
                uniqueQuestions: sql `COUNT(DISTINCT question_id)`
            })
                .from(answers)
                .where(and(gte(answers.createdAt, startTime), lte(answers.createdAt, endTime)));
            return {
                totalAssessments: assessmentCounts[0]?.totalAssessments || 0,
                completedAssessments: assessmentCounts[0]?.completedAssessments || 0,
                inProgressAssessments: assessmentCounts[0]?.inProgressAssessments || 0,
                newAssessments: assessmentCounts[0]?.newAssessments || 0,
                totalUsers: userActivity[0]?.activeUsers || 0, // Assuming totalUsers is derived from activeUsers for now
                activeUsers: userActivity[0]?.activeUsers || 0,
                totalSessions: userActivity[0]?.totalSessions || 0,
                errorRate: Math.round(errorRate * 100) / 100,
                warningCount: errorMetrics[0]?.warningCount || 0,
                throughput: Math.round(throughput * 100) / 100,
                answersSubmitted: answerActivity[0]?.totalAnswers || 0,
                questionsAnswered: answerActivity[0]?.uniqueQuestions || 0
            };
        }
        catch (error) {
            console.error('Error getting application metrics:', error);
            // Return default values in case of an error
            return {
                totalAssessments: 0,
                completedAssessments: 0,
                inProgressAssessments: 0,
                newAssessments: 0,
                totalUsers: 0,
                activeUsers: 0,
                totalSessions: 0,
                errorRate: 0,
                warningCount: 0,
                throughput: 0,
                answersSubmitted: 0,
                questionsAnswered: 0
            };
        }
    }
    async getActiveAlerts() {
        const alerts = [];
        // Check for high error rates
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const [errorRateData] = await db
            .select({
            errorCount: sql `COUNT(*)`
        })
            .from(errorLogs)
            .where(gte(errorLogs.timestamp, oneHourAgo));
        if (errorRateData.errorCount > 100) {
            alerts.push({
                id: `error-rate-${Date.now()}`,
                type: 'error',
                severity: 'high',
                message: `High error rate detected: ${errorRateData.errorCount} errors in the last hour`,
                timestamp: new Date(),
                resolved: false,
                actionRequired: 'Investigate error logs and fix underlying issues'
            });
        }
        // Check memory usage
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        if (memUsedMB > 500) {
            alerts.push({
                id: `memory-${Date.now()}`,
                type: 'performance',
                severity: 'medium',
                message: `High memory usage: ${memUsedMB}MB`,
                timestamp: new Date(),
                resolved: false,
                actionRequired: 'Monitor memory usage and consider optimization'
            });
        }
        // Check for failed logins
        const [failedLogins] = await db
            .select({
            count: sql `COUNT(*)`
        })
            .from(systemLogs)
            .where(and(gte(systemLogs.timestamp, oneHourAgo), sql `message LIKE '%failed login%' OR message LIKE '%authentication failed%'`));
        if (failedLogins.count > 20) {
            alerts.push({
                id: `security-${Date.now()}`,
                type: 'security',
                severity: 'high',
                message: `Multiple failed login attempts: ${failedLogins.count} in the last hour`,
                timestamp: new Date(),
                resolved: false,
                actionRequired: 'Review security logs and consider IP blocking'
            });
        }
        return alerts;
    }
    async getTrends(startTime, endTime) {
        // Get response time trend
        const responseTimeTrend = await db
            .select({
            timestamp: performanceMetrics.timestamp,
            value: performanceMetrics.value
        })
            .from(performanceMetrics)
            .where(and(gte(performanceMetrics.timestamp, startTime), lte(performanceMetrics.timestamp, endTime), eq(performanceMetrics.unit, 'ms')))
            .orderBy(performanceMetrics.timestamp);
        // Calculate trend direction
        const calculateTrend = (data) => {
            if (data.length < 2)
                return { trend: 'stable', changePercentage: 0 };
            const first = data[0].value;
            const last = data[data.length - 1].value;
            const changePercentage = ((last - first) / first) * 100;
            let trend;
            if (Math.abs(changePercentage) < 5)
                trend = 'stable';
            else if (changePercentage < 0)
                trend = 'improving'; // Lower response time is better
            else
                trend = 'declining';
            return { trend, changePercentage: Math.abs(changePercentage) };
        };
        const responseTimeTrendData = calculateTrend(responseTimeTrend);
        return [
            {
                metric: 'Response Time',
                timeRange: `${startTime.toISOString()} to ${endTime.toISOString()}`,
                data: responseTimeTrend,
                ...responseTimeTrendData
            }
        ];
    }
    async generateHealthReport() {
        const metrics = await this.getSystemMetrics('1h');
        let score = 100;
        const issues = [];
        const recommendations = [];
        // Check system health
        if (metrics.systemHealth.memoryUsage > 500) {
            score -= 20;
            issues.push('High memory usage');
            recommendations.push('Monitor and optimize memory usage');
        }
        if (metrics.systemHealth.responseTime > 1000) {
            score -= 15;
            issues.push('Slow response times');
            recommendations.push('Optimize database queries and API endpoints');
        }
        // Check application metrics
        if (metrics.applicationMetrics.errorRate > 5) {
            score -= 25;
            issues.push('High error rate');
            recommendations.push('Review and fix application errors');
        }
        // Check active alerts
        if (metrics.alerts.length > 0) {
            score -= metrics.alerts.length * 10;
            issues.push(`${metrics.alerts.length} active alerts`);
            recommendations.push('Address active system alerts');
        }
        let status;
        if (score >= 90)
            status = 'healthy';
        else if (score >= 70)
            status = 'degraded';
        else
            status = 'critical';
        return { status, score, issues, recommendations };
    }
    async createAlert(alertData) {
        // In a real implementation, this would store alerts in a database
        console.log('Alert created:', alertData);
    }
}
export const observabilityDashboardService = new ObservabilityDashboardService();
