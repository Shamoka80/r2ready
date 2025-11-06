
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import { systemLogs, auditLog, users } from '@shared/schema';

export interface UserActivityMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  usersByRole: Record<string, number>;
  activityByHour: Array<{ hour: number; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  retentionRate: number;
}

export interface UserReport {
  userId: string;
  email: string;
  role: string;
  lastActive: Date;
  totalSessions: number;
  averageSessionDuration: number;
  topActivities: Array<{ activity: string; count: number }>;
  securityEvents: Array<{ event: string; timestamp: Date; severity: string }>;
}

class UserActivityAnalyticsService {
  async getUserActivityMetrics(timeRange: string = '30d'): Promise<UserActivityMetrics> {
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
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

    const [
      totalUsers,
      activeUsers,
      newUsers,
      usersByRole,
      activityByHour,
      topActions
    ] = await Promise.all([
      this.getTotalUsers(),
      this.getActiveUsers(startTime, endTime),
      this.getNewUsers(startTime, endTime),
      this.getUsersByRole(),
      this.getActivityByHour(startTime, endTime),
      this.getTopActions(startTime, endTime)
    ]);

    const retentionRate = await this.calculateRetentionRate(timeRange);

    return {
      totalUsers,
      activeUsers,
      newUsers,
      usersByRole,
      activityByHour,
      topActions,
      retentionRate
    };
  }

  private async getTotalUsers(): Promise<number> {
    const [result] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(users)
      .where(eq(users.isActive, true));

    return result.count || 0;
  }

  private async getActiveUsers(startTime: Date, endTime: Date): Promise<number> {
    const [result] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT user_id)`
      })
      .from(systemLogs)
      .where(and(
        gte(systemLogs.timestamp, startTime),
        lte(systemLogs.timestamp, endTime),
        sql`user_id IS NOT NULL`
      ));

    return result.count || 0;
  }

  private async getNewUsers(startTime: Date, endTime: Date): Promise<number> {
    const [result] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(auditLog)
      .where(and(
        gte(auditLog.timestamp, startTime),
        lte(auditLog.timestamp, endTime),
        eq(auditLog.action, 'USER_CREATED')
      ));

    return result.count || 0;
  }

  private async getUsersByRole(): Promise<Record<string, number>> {
    const businessRoles = await db
      .select({
        role: users.businessRole,
        count: sql<number>`COUNT(*)`
      })
      .from(users)
      .where(and(
        eq(users.isActive, true),
        sql`business_role IS NOT NULL`
      ))
      .groupBy(users.businessRole);

    const consultantRoles = await db
      .select({
        role: users.consultantRole,
        count: sql<number>`COUNT(*)`
      })
      .from(users)
      .where(and(
        eq(users.isActive, true),
        sql`consultant_role IS NOT NULL`
      ))
      .groupBy(users.consultantRole);

    const roleMap: Record<string, number> = {};

    businessRoles.forEach(role => {
      if (role.role) {
        roleMap[role.role] = role.count;
      }
    });

    consultantRoles.forEach(role => {
      if (role.role) {
        roleMap[role.role] = role.count;
      }
    });

    return roleMap;
  }

  private async getActivityByHour(startTime: Date, endTime: Date): Promise<Array<{ hour: number; count: number }>> {
    const activities = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM timestamp)`,
        count: sql<number>`COUNT(*)`
      })
      .from(systemLogs)
      .where(and(
        gte(systemLogs.timestamp, startTime),
        lte(systemLogs.timestamp, endTime)
      ))
      .groupBy(sql`EXTRACT(HOUR FROM timestamp)`)
      .orderBy(sql`EXTRACT(HOUR FROM timestamp)`);

    // Fill in missing hours with 0 count
    const hourlyActivity: Array<{ hour: number; count: number }> = [];
    for (let hour = 0; hour < 24; hour++) {
      const activity = activities.find(a => a.hour === hour);
      hourlyActivity.push({
        hour,
        count: activity?.count || 0
      });
    }

    return hourlyActivity;
  }

  private async getTopActions(startTime: Date, endTime: Date): Promise<Array<{ action: string; count: number }>> {
    const actions = await db
      .select({
        action: auditLog.action,
        count: sql<number>`COUNT(*)`
      })
      .from(auditLog)
      .where(and(
        gte(auditLog.timestamp, startTime),
        lte(auditLog.timestamp, endTime)
      ))
      .groupBy(auditLog.action)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    return actions.map(action => ({
      action: action.action || 'unknown',
      count: action.count
    }));
  }

  private async calculateRetentionRate(timeRange: string): Promise<number> {
    // Simplified retention calculation
    const totalUsers = await this.getTotalUsers();
    const endTime = new Date();
    const startTime = new Date();
    
    if (timeRange === '30d') {
      startTime.setDate(endTime.getDate() - 30);
    } else if (timeRange === '7d') {
      startTime.setDate(endTime.getDate() - 7);
    } else {
      startTime.setHours(endTime.getHours() - 24);
    }

    const activeUsers = await this.getActiveUsers(startTime, endTime);
    
    return totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
  }

  async generateUserReport(userId: string, timeRange: string = '30d'): Promise<UserReport> {
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
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

    // Get user info
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const userInfo = user[0];

    // Get last active time
    const [lastActivity] = await db
      .select({
        timestamp: systemLogs.timestamp
      })
      .from(systemLogs)
      .where(eq(systemLogs.userId, userId))
      .orderBy(desc(systemLogs.timestamp))
      .limit(1);

    // Get session count (simplified)
    const [sessionData] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT session_id)`
      })
      .from(systemLogs)
      .where(and(
        eq(systemLogs.userId, userId),
        gte(systemLogs.timestamp, startTime),
        lte(systemLogs.timestamp, endTime),
        sql`session_id IS NOT NULL`
      ));

    // Get top activities
    const topActivities = await db
      .select({
        activity: systemLogs.operation,
        count: sql<number>`COUNT(*)`
      })
      .from(systemLogs)
      .where(and(
        eq(systemLogs.userId, userId),
        gte(systemLogs.timestamp, startTime),
        lte(systemLogs.timestamp, endTime)
      ))
      .groupBy(systemLogs.operation)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);

    // Get security events
    const securityEvents = await db
      .select({
        event: systemLogs.message,
        timestamp: systemLogs.timestamp,
        severity: systemLogs.level
      })
      .from(systemLogs)
      .where(and(
        eq(systemLogs.userId, userId),
        gte(systemLogs.timestamp, startTime),
        lte(systemLogs.timestamp, endTime),
        sql`service = 'security' OR level IN ('warn', 'error')`
      ))
      .orderBy(desc(systemLogs.timestamp))
      .limit(10);

    return {
      userId,
      email: userInfo.email,
      role: userInfo.businessRole || userInfo.consultantRole || 'unknown',
      lastActive: lastActivity?.timestamp || new Date(0),
      totalSessions: sessionData.count || 0,
      averageSessionDuration: 0, // Simplified - would need more complex calculation
      topActivities: topActivities.map(activity => ({
        activity: activity.activity || 'unknown',
        count: activity.count
      })),
      securityEvents: securityEvents.map(event => ({
        event: event.event,
        timestamp: event.timestamp,
        severity: event.severity
      }))
    };
  }
}

export const userActivityAnalyticsService = new UserActivityAnalyticsService();
