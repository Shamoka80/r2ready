import { eq, and, gte, desc, count, or, like } from 'drizzle-orm';
import { db } from '../db';
import { securityAuditLog, type NewSecurityAuditLog } from '@shared/schema';

/**
 * Brute-Force Detection and Alert Service
 * 
 * This service monitors rate limit violations and security events to detect
 * potential brute-force attacks and notify administrators of suspicious activity.
 */
export class BruteForceAlertService {

  /**
   * Alert thresholds for different types of brute-force attacks
   */
  private readonly alertThresholds = {
    login: {
      maxAttempts: 10,      // Max failed login attempts before alert
      timeWindow: 300,      // 5 minutes
      severity: 'HIGH' as const
    },
    twoFactor: {
      maxAttempts: 5,       // Max 2FA failures before alert
      timeWindow: 180,      // 3 minutes  
      severity: 'CRITICAL' as const
    },
    passwordReset: {
      maxAttempts: 5,       // Max password reset attempts
      timeWindow: 600,      // 10 minutes
      severity: 'MEDIUM' as const
    },
    export: {
      maxAttempts: 20,      // Max export attempts (data exfiltration)
      timeWindow: 900,      // 15 minutes
      severity: 'HIGH' as const
    }
  };

  /**
   * Map rate limiting action names to threshold keys
   */
  private normalizeActionKey(action: string): keyof typeof this.alertThresholds | null {
    const actionMappings: Record<string, keyof typeof this.alertThresholds> = {
      // Login related
      'login': 'login',
      'signin': 'login',
      'authenticate': 'login',
      
      // 2FA related
      '2fa_verify': 'twoFactor',
      '2fa_enable': 'twoFactor',
      '2fa_setup': 'twoFactor',
      'totp_verify': 'twoFactor',
      'verify': 'twoFactor',
      
      // Password reset related
      'password_reset': 'passwordReset',
      'forgot_password': 'passwordReset',
      'reset_password': 'passwordReset',
      
      // Export related  
      'pdf': 'export',
      'excel': 'export',
      'export': 'export',
      'download': 'export',
      'report': 'export'
    };

    return actionMappings[action.toLowerCase()] || null;
  }

  /**
   * Track and alert on rate limit violations
   */
  async handleRateLimitViolation(params: {
    resource: string;
    action: string;
    identifierType: string;
    identifierValue: string;
    ipAddress: string;
    userAgent: string;
    userId?: string;
    currentCount: number;
    maxAllowed: number;
  }): Promise<void> {
    const { resource, action, identifierType, identifierValue, ipAddress, userAgent, userId, currentCount, maxAllowed } = params;

    try {
      // Log the rate limit violation
      await this.logSecurityEvent({
        userId: userId || null,
        eventType: 'RATE_LIMIT_EXCEEDED',
        targetResourceType: resource,
        targetResourceId: `${action}:${identifierValue}`,
        severity: 'MEDIUM',
        details: {
          identifierType,
          identifierValue,
          currentCount,
          maxAllowed,
          ipAddress,
          userAgent,
          resource,
          action
        },
        ipAddress,
        userAgent
      });

      // Check if this should trigger a brute-force alert
      await this.checkBruteForcePattern(resource, action, identifierValue, ipAddress, userId);

    } catch (error) {
      console.error('Error handling rate limit violation:', error);
    }
  }

  /**
   * Analyze patterns to detect potential brute-force attacks
   */
  private async checkBruteForcePattern(
    resource: string, 
    action: string, 
    identifierValue: string, 
    ipAddress: string, 
    userId?: string
  ): Promise<void> {
    const actionKey = this.normalizeActionKey(action);
    
    if (!actionKey) {
      return;
    }

    const threshold = this.alertThresholds[actionKey];

    // Count recent violations for this specific identifier and action
    const recentViolations = await this.countRecentViolations(
      identifierValue, 
      resource, 
      action, 
      threshold.timeWindow
    );

    if (recentViolations >= threshold.maxAttempts) {
      await this.triggerBruteForceAlert({
        resource,
        action,
        identifierValue,
        ipAddress,
        userId,
        violationCount: recentViolations,
        threshold: threshold.maxAttempts,
        timeWindow: threshold.timeWindow,
        severity: threshold.severity
      });
    }
  }

  /**
   * Count recent rate limit violations for pattern analysis
   * Now properly scoped to specific identifier and action to prevent false positives
   */
  private async countRecentViolations(
    identifierValue: string,
    resource: string, 
    action: string,
    timeWindowSeconds: number
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - (timeWindowSeconds * 1000));

    try {
      // Query for violations matching this specific identifier, resource, and action
      const result = await db
        .select({ count: count() })
        .from(securityAuditLog)
        .where(and(
          eq(securityAuditLog.eventType, 'RATE_LIMIT_EXCEEDED'),
          eq(securityAuditLog.targetResourceType, resource),
          eq(securityAuditLog.targetResourceId, `${action}:${identifierValue}`),
          gte(securityAuditLog.createdAt, cutoffTime)
        ));

      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error counting recent violations:', error);
      return 0;
    }
  }

  /**
   * Trigger a brute-force alert
   */
  private async triggerBruteForceAlert(params: {
    resource: string;
    action: string;
    identifierValue: string;
    ipAddress: string;
    userId?: string;
    violationCount: number;
    threshold: number;
    timeWindow: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }): Promise<void> {
    const { resource, action, identifierValue, ipAddress, userId, violationCount, threshold, timeWindow, severity } = params;

    // Log the brute-force detection
    await this.logSecurityEvent({
      userId: userId || null,
      eventType: 'BRUTE_FORCE_DETECTED',
      targetResourceType: resource,
      targetResourceId: `${action}:${identifierValue}`,
      severity,
      details: {
        identifierValue,
        ipAddress,
        violationCount,
        threshold,
        timeWindowSeconds: timeWindow,
        attackType: 'rate_limit_brute_force',
        detection_time: new Date().toISOString()
      },
      ipAddress,
      userAgent: 'System Detection'
    });

    // Send alert notification
    await this.sendAlert({
      severity,
      title: `Brute-Force Attack Detected`,
      message: `Detected ${violationCount} rate limit violations for ${resource}:${action} from ${identifierValue} within ${timeWindow} seconds. Threshold: ${threshold}`,
      details: {
        resource,
        action,
        identifierValue,
        ipAddress,
        userId,
        violationCount,
        threshold,
        timeWindow
      }
    });

    console.warn(`🚨 BRUTE-FORCE ALERT: ${severity} - ${violationCount} violations for ${resource}:${action} from ${identifierValue}`);
  }

  /**
   * Send alert notification and take immediate action
   */
  private async sendAlert(alert: {
    severity: string;
    title: string;
    message: string;
    details: any;
  }): Promise<void> {
    // For now, log to console with clear formatting
    console.log('\n='.repeat(80));
    console.log(`🚨 SECURITY ALERT [${alert.severity}]`);
    console.log(`📋 ${alert.title}`);
    console.log(`📝 ${alert.message}`);
    console.log(`🕒 ${new Date().toISOString()}`);
    
    if (alert.details) {
      console.log('📊 Details:');
      Object.entries(alert.details).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    
    console.log('='.repeat(80) + '\n');

    // Take immediate security action for critical alerts
    if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
      // TODO: Implement automated security actions
      console.log(`🔒 Auto-security action would be taken for ${alert.severity} severity`);
    }

    // TODO: Implement actual notification system (email, Slack, webhook, etc.)
    // This could be extended to send notifications to:
    // - Administrator email alerts
    // - Slack channels
    // - Security incident management systems
    // - Webhook endpoints for security monitoring tools
  }

  /**
   * Log security events to audit trail
   */
  private async logSecurityEvent(event: {
    userId: string | null;
    eventType: string;
    targetResourceType?: string;
    targetResourceId?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: any;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    try {
      const auditEntry: NewSecurityAuditLog = {
        userId: event.userId,
        eventType: event.eventType,
        severity: event.severity || 'MEDIUM',
        targetResourceType: event.targetResourceType || null,
        targetResourceId: event.targetResourceId || null,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        description: `${event.eventType} event`,
        errorMessage: null,
        metadata: event.details,
        createdAt: new Date()
      };

      await db.insert(securityAuditLog).values(auditEntry);
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Get recent brute-force alerts for monitoring dashboard
   */
  async getRecentAlerts(limit: number = 50): Promise<any[]> {
    try {
      return await db
        .select()
        .from(securityAuditLog)
        .where(eq(securityAuditLog.eventType, 'BRUTE_FORCE_DETECTED'))
        .orderBy(desc(securityAuditLog.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting recent alerts:', error);
      return [];
    }
  }

  /**
   * Check if a specific identifier (IP/user) is currently under brute-force attack
   * Now properly scoped to specific identifier with OR logic for IP/user matching
   */
  async isUnderAttack(
    identifierValue: string, 
    timeWindowMinutes: number = 30,
    targetResourceType?: string
  ): Promise<boolean> {
    const cutoffTime = new Date(Date.now() - (timeWindowMinutes * 60 * 1000));

    try {
      // Build base query conditions
      const baseConditions = [
        eq(securityAuditLog.eventType, 'BRUTE_FORCE_DETECTED'),
        gte(securityAuditLog.createdAt, cutoffTime)
      ];

      if (targetResourceType) {
        baseConditions.push(eq(securityAuditLog.targetResourceType, targetResourceType));
      }

      // Create OR condition for identifier matching
      // Match either IP address OR targetResourceId containing the identifier
      const identifierMatch = or(
        eq(securityAuditLog.ipAddress, identifierValue),
        like(securityAuditLog.targetResourceId, `%:${identifierValue}%`)
      );

      const result = await db
        .select({ count: count() })
        .from(securityAuditLog)
        .where(and(
          ...baseConditions,
          identifierMatch
        ));

      return (result[0]?.count || 0) > 0;
    } catch (error) {
      console.error('Error checking attack status:', error);
      return false;
    }
  }
}

// Export singleton instance
export const bruteForceAlertService = new BruteForceAlertService();