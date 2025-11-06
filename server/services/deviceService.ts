import crypto from 'crypto';
import { eq, and, desc, lt } from 'drizzle-orm';
import { db } from '../db';
import { 
  userDevices, 
  securityAuditLog,
  type UserDevice, 
  type NewUserDevice,
  type NewSecurityAuditLog 
} from '@shared/schema';

/**
 * Device Management Service
 * Handles device registration, tracking, and security management
 */
export class DeviceService {
  
  /**
   * Generate device fingerprint from device characteristics
   */
  private generateDeviceFingerprint(
    userAgent: string,
    ipAddress: string,
    additionalData?: Record<string, any>
  ): string {
    // Create a hash of device characteristics
    const fingerprintData = {
      userAgent: this.normalizeUserAgent(userAgent),
      ipClass: this.getIPClass(ipAddress),
      ...additionalData
    };
    
    const dataString = JSON.stringify(fingerprintData);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Normalize user agent for consistent fingerprinting
   */
  private normalizeUserAgent(userAgent: string): string {
    // Remove version numbers for more stable fingerprinting
    return userAgent
      .replace(/\/[\d.]+/g, '') // Remove version numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Get IP address class for privacy-preserving fingerprinting
   */
  private getIPClass(ipAddress: string): string {
    // Return IP class instead of full IP for privacy
    if (ipAddress.includes(':')) {
      // IPv6 - return first 4 groups
      return ipAddress.split(':').slice(0, 4).join(':') + '::';
    } else {
      // IPv4 - return first 3 octets
      return ipAddress.split('.').slice(0, 3).join('.') + '.0';
    }
  }

  /**
   * Parse device type from user agent
   */
  private parseDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Parse platform from user agent
   */
  private parsePlatform(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac os') || ua.includes('macos')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
    
    return 'Unknown';
  }

  /**
   * Parse browser from user agent
   */
  private parseBrowser(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('edg')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    
    return 'Unknown';
  }

  /**
   * Log security events for audit trail
   */
  private async logSecurityEvent(
    eventType: string,
    userId: string,
    deviceId?: string,
    sessionId?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
    severity: 'info' | 'warning' | 'critical' = 'info'
  ): Promise<void> {
    try {
      const auditEntry: NewSecurityAuditLog = {
        eventType,
        severity,
        userId,
        sessionId,
        deviceId,
        targetUserId: userId,
        targetResourceType: 'device',
        targetResourceId: deviceId || 'unknown',
        ipAddress: ipAddress || 'unknown',
        userAgent,
        description: `Device operation: ${eventType}`,
        metadata: metadata || {},
        isSuccessful: true
      };

      await db.insert(securityAuditLog).values(auditEntry);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Register or update a device for a user
   */
  async registerDevice(
    userId: string,
    userAgent: string,
    ipAddress: string,
    deviceName?: string,
    sessionId?: string,
    additionalData?: Record<string, any>
  ): Promise<{
    deviceId: string;
    isNewDevice: boolean;
    device: UserDevice;
  }> {
    const deviceFingerprint = this.generateDeviceFingerprint(userAgent, ipAddress, additionalData);
    
    // Check if device already exists
    const existingDevices = await db
      .select()
      .from(userDevices)
      .where(and(
        eq(userDevices.userId, userId),
        eq(userDevices.deviceFingerprint, deviceFingerprint),
        eq(userDevices.isRevoked, false)
      ))
      .limit(1);

    if (existingDevices.length > 0) {
      // Update existing device
      const device = existingDevices[0];
      
      const updatedDevice = await db
        .update(userDevices)
        .set({
          lastSeenAt: new Date(),
          loginCount: device.loginCount + 1,
          ipAddress,
          userAgent,
          updatedAt: new Date()
        })
        .where(eq(userDevices.id, device.id))
        .returning();

      await this.logSecurityEvent(
        'device_login',
        userId,
        device.id,
        sessionId,
        { 
          loginCount: device.loginCount + 1,
          fingerprintMatched: true 
        },
        ipAddress,
        userAgent
      );

      return {
        deviceId: device.id,
        isNewDevice: false,
        device: updatedDevice[0]
      };
    }

    // Create new device
    const newDevice: NewUserDevice = {
      userId,
      deviceFingerprint,
      deviceName: deviceName || `${this.parsePlatform(userAgent)} ${this.parseBrowser(userAgent)}`,
      deviceType: this.parseDeviceType(userAgent),
      userAgent,
      ipAddress,
      platform: this.parsePlatform(userAgent),
      browser: this.parseBrowser(userAgent),
      isTrusted: false, // New devices start as untrusted
      isRevoked: false,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      loginCount: 1
    };

    const createdDevice = await db
      .insert(userDevices)
      .values(newDevice)
      .returning();

    const device = createdDevice[0];

    await this.logSecurityEvent(
      'device_registered',
      userId,
      device.id,
      sessionId,
      { 
        deviceType: device.deviceType,
        platform: device.platform,
        browser: device.browser 
      },
      ipAddress,
      userAgent
    );

    return {
      deviceId: device.id,
      isNewDevice: true,
      device
    };
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<{
    devices: Array<{
      id: string;
      deviceName?: string;
      deviceType?: string;
      platform?: string;
      browser?: string;
      isTrusted: boolean;
      isRevoked: boolean;
      firstSeenAt: Date;
      lastSeenAt: Date;
      loginCount: number;
      ipAddress: string;
      revokedAt?: Date;
      revokeReason?: string;
    }>;
  }> {
    const devicesResult = await db
      .select({
        id: userDevices.id,
        deviceName: userDevices.deviceName,
        deviceType: userDevices.deviceType,
        platform: userDevices.platform,
        browser: userDevices.browser,
        isTrusted: userDevices.isTrusted,
        isRevoked: userDevices.isRevoked,
        firstSeenAt: userDevices.firstSeenAt,
        lastSeenAt: userDevices.lastSeenAt,
        loginCount: userDevices.loginCount,
        ipAddress: userDevices.ipAddress,
        revokedAt: userDevices.revokedAt,
        revokeReason: userDevices.revokeReason
      })
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .orderBy(desc(userDevices.lastSeenAt));

    // Convert null values to undefined for type compatibility
    const devices = devicesResult.map(device => ({
      ...device,
      deviceName: device.deviceName || undefined,
      deviceType: device.deviceType || undefined,
      platform: device.platform || undefined,
      browser: device.browser || undefined,
      revokedAt: device.revokedAt || undefined,
      revokeReason: device.revokeReason || undefined
    }));

    return { devices };
  }

  /**
   * Trust a device
   */
  async trustDevice(
    deviceId: string,
    userId: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await db
        .update(userDevices)
        .set({
          isTrusted: true,
          updatedAt: new Date()
        })
        .where(and(
          eq(userDevices.id, deviceId),
          eq(userDevices.userId, userId),
          eq(userDevices.isRevoked, false)
        ))
        .returning();

      if (result.length === 0) {
        return { success: false, message: 'Device not found or already revoked' };
      }

      await this.logSecurityEvent(
        'device_trusted',
        userId,
        deviceId,
        sessionId,
        {},
        ipAddress,
        userAgent
      );

      return { success: true, message: 'Device marked as trusted' };
    } catch (error) {
      return { success: false, message: 'Failed to trust device' };
    }
  }

  /**
   * Revoke a device
   */
  async revokeDevice(
    deviceId: string,
    userId: string,
    reason: string,
    revokedBy?: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await db
        .update(userDevices)
        .set({
          isRevoked: true,
          revokedAt: new Date(),
          revokedBy,
          revokeReason: reason,
          updatedAt: new Date()
        })
        .where(and(
          eq(userDevices.id, deviceId),
          eq(userDevices.userId, userId)
        ))
        .returning();

      if (result.length === 0) {
        return { success: false, message: 'Device not found' };
      }

      await this.logSecurityEvent(
        'device_revoked',
        userId,
        deviceId,
        sessionId,
        { reason, revokedBy },
        ipAddress,
        userAgent,
        'warning'
      );

      return { success: true, message: 'Device revoked successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to revoke device' };
    }
  }

  /**
   * Update device name
   */
  async updateDeviceName(
    deviceId: string,
    userId: string,
    newName: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await db
        .update(userDevices)
        .set({
          deviceName: newName,
          updatedAt: new Date()
        })
        .where(and(
          eq(userDevices.id, deviceId),
          eq(userDevices.userId, userId),
          eq(userDevices.isRevoked, false)
        ))
        .returning();

      if (result.length === 0) {
        return { success: false, message: 'Device not found or already revoked' };
      }

      await this.logSecurityEvent(
        'device_renamed',
        userId,
        deviceId,
        sessionId,
        { oldName: result[0].deviceName, newName },
        ipAddress,
        userAgent
      );

      return { success: true, message: 'Device name updated' };
    } catch (error) {
      return { success: false, message: 'Failed to update device name' };
    }
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(deviceId: string, userId: string): Promise<boolean> {
    const devices = await db
      .select({ isTrusted: userDevices.isTrusted })
      .from(userDevices)
      .where(and(
        eq(userDevices.id, deviceId),
        eq(userDevices.userId, userId),
        eq(userDevices.isRevoked, false)
      ))
      .limit(1);

    return devices.length > 0 && devices[0].isTrusted;
  }

  /**
   * Get device by fingerprint
   */
  async getDeviceByFingerprint(
    userId: string,
    userAgent: string,
    ipAddress: string,
    additionalData?: Record<string, any>
  ): Promise<UserDevice | null> {
    const fingerprint = this.generateDeviceFingerprint(userAgent, ipAddress, additionalData);
    
    const devices = await db
      .select()
      .from(userDevices)
      .where(and(
        eq(userDevices.userId, userId),
        eq(userDevices.deviceFingerprint, fingerprint),
        eq(userDevices.isRevoked, false)
      ))
      .limit(1);

    return devices.length > 0 ? devices[0] : null;
  }

  /**
   * Get suspicious login attempts (new devices from unusual locations)
   */
  async getSuspiciousDevices(userId: string): Promise<{
    devices: Array<{
      id: string;
      deviceName?: string;
      platform?: string;
      browser?: string;
      ipAddress: string;
      firstSeenAt: Date;
      loginCount: number;
      riskScore: number;
    }>;
  }> {
    // Get user's known IP ranges
    const knownDevices = await db
      .select({ ipAddress: userDevices.ipAddress })
      .from(userDevices)
      .where(and(
        eq(userDevices.userId, userId),
        eq(userDevices.isTrusted, true)
      ));

    const knownIPClasses = new Set(
      knownDevices.map(device => this.getIPClass(device.ipAddress))
    );

    // Get recent devices
    const recentDevices = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .orderBy(desc(userDevices.firstSeenAt));

    // Calculate risk scores
    const suspiciousDevices = recentDevices
      .filter(device => !device.isTrusted && !device.isRevoked)
      .map(device => {
        let riskScore = 0;
        
        // New IP class
        if (!knownIPClasses.has(this.getIPClass(device.ipAddress))) {
          riskScore += 0.5;
        }
        
        // Low login count
        if (device.loginCount === 1) {
          riskScore += 0.3;
        }
        
        // Recent first seen
        const hoursSinceFirstSeen = (Date.now() - device.firstSeenAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceFirstSeen < 24) {
          riskScore += 0.2;
        }

        return {
          id: device.id,
          deviceName: device.deviceName || undefined,
          platform: device.platform || undefined,
          browser: device.browser || undefined,
          ipAddress: device.ipAddress,
          firstSeenAt: device.firstSeenAt,
          loginCount: device.loginCount,
          riskScore: Math.min(riskScore, 1.0)
        };
      })
      .filter(device => device.riskScore > 0.3)
      .sort((a, b) => b.riskScore - a.riskScore);

    return { devices: suspiciousDevices };
  }

  /**
   * Clean up old revoked devices
   */
  async cleanupOldDevices(olderThanDays: number = 90): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db
        .delete(userDevices)
        .where(and(
          eq(userDevices.isRevoked, true),
          lt(userDevices.revokedAt, cutoffDate)
        ))
        .returning();

      console.log(`Cleaned up ${result.length} old revoked devices`);
      
      return { deletedCount: result.length };
    } catch (error) {
      console.error('Failed to cleanup old devices:', error);
      return { deletedCount: 0 };
    }
  }
}

// Export singleton instance
export const deviceService = new DeviceService();
