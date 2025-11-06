
import ObservabilityService from './observabilityService';

export interface LogContext {
  service: string;
  operation: string;
  userId?: string;
  tenantId?: string;
  facilityId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface ErrorContext extends LogContext {
  error: Error | string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  stack?: string;
  code?: string | number;
}

export interface MetricContext {
  name: string;
  value: number;
  unit: string;
  service: string;
  operation?: string;
  userId?: string;
  tenantId?: string;
  tags?: Record<string, string>;
}

export interface PerformanceContext extends LogContext {
  startTime: number;
  endTime?: number;
  memoryUsage?: {
    before: number;
    after: number;
  };
  queryCount?: number;
  cacheHits?: number;
  cacheMisses?: number;
}

export class ConsistentLogService {
  private static instance: ConsistentLogService;
  private performanceTrackers = new Map<string, PerformanceContext>();

  static getInstance(): ConsistentLogService {
    if (!this.instance) {
      this.instance = new ConsistentLogService();
    }
    return this.instance;
  }

  // Core logging methods
  async debug(message: string, context: Partial<LogContext> = {}): Promise<void> {
    await this.log('DEBUG', message, context);
  }

  async info(message: string, context: Partial<LogContext> = {}): Promise<void> {
    await this.log('INFO', message, context);
  }

  async warn(message: string, context: Partial<LogContext> = {}): Promise<void> {
    await this.log('WARN', message, context);
  }

  async error(message: string, errorContext: Partial<ErrorContext> = {}): Promise<void> {
    const context: LogContext = {
      service: errorContext.service || 'unknown',
      operation: errorContext.operation || 'unknown',
      userId: errorContext.userId,
      tenantId: errorContext.tenantId,
      facilityId: errorContext.facilityId,
      sessionId: errorContext.sessionId,
      requestId: errorContext.requestId,
      metadata: {
        ...errorContext.metadata,
        severity: errorContext.severity || 'medium',
        errorCode: errorContext.code,
        stack: errorContext.error instanceof Error ? errorContext.error.stack : undefined
      },
      ipAddress: errorContext.ipAddress,
      userAgent: errorContext.userAgent,
      correlationId: errorContext.correlationId
    };

    // Log error through observability service
    if (errorContext.error) {
      await ObservabilityService.logError(errorContext.error, {
        service: context.service,
        operation: context.operation,
        userId: context.userId,
        tenantId: context.tenantId,
        severity: errorContext.severity || 'medium',
        metadata: context.metadata,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    await this.log('ERROR', message, context);
  }

  // Performance tracking
  startPerformanceTracker(
    trackerId: string, 
    context: Omit<PerformanceContext, 'startTime'>
  ): void {
    const memoryBefore = process.memoryUsage().heapUsed;
    
    this.performanceTrackers.set(trackerId, {
      ...context,
      startTime: Date.now(),
      memoryUsage: {
        before: memoryBefore,
        after: 0
      }
    });

    this.debug(`Performance tracking started: ${trackerId}`, {
      service: context.service,
      operation: context.operation,
      userId: context.userId,
      tenantId: context.tenantId,
      metadata: { trackerId, memoryBefore }
    });
  }

  async endPerformanceTracker(
    trackerId: string, 
    additionalContext: {
      queryCount?: number;
      cacheHits?: number;
      cacheMisses?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<PerformanceContext | null> {
    const tracker = this.performanceTrackers.get(trackerId);
    if (!tracker) {
      await this.warn(`Performance tracker not found: ${trackerId}`);
      return null;
    }

    const endTime = Date.now();
    const memoryAfter = process.memoryUsage().heapUsed;
    const duration = endTime - tracker.startTime;

    const completedTracker: PerformanceContext = {
      ...tracker,
      endTime,
      duration,
      memoryUsage: {
        before: tracker.memoryUsage?.before || 0,
        after: memoryAfter
      },
      queryCount: additionalContext.queryCount,
      cacheHits: additionalContext.cacheHits,
      cacheMisses: additionalContext.cacheMisses,
      metadata: {
        ...tracker.metadata,
        ...additionalContext.metadata
      }
    };

    // Remove from active trackers
    this.performanceTrackers.delete(trackerId);

    // Log performance metrics
    await this.recordMetric({
      name: 'request_duration',
      value: duration,
      unit: 'ms',
      service: tracker.service,
      operation: tracker.operation,
      userId: tracker.userId,
      tenantId: tracker.tenantId,
      tags: {
        operation: tracker.operation,
        ...(additionalContext.queryCount && { queryCount: additionalContext.queryCount.toString() })
      }
    });

    if (tracker.memoryUsage) {
      const memoryDelta = memoryAfter - tracker.memoryUsage.before;
      await this.recordMetric({
        name: 'memory_delta',
        value: memoryDelta,
        unit: 'bytes',
        service: tracker.service,
        operation: tracker.operation,
        userId: tracker.userId,
        tenantId: tracker.tenantId
      });
    }

    // Log completion
    const performanceLevel = duration > 5000 ? 'ERROR' : duration > 1000 ? 'WARN' : 'INFO';
    await this.log(performanceLevel, `Performance tracking completed: ${trackerId}`, {
      service: tracker.service,
      operation: tracker.operation,
      userId: tracker.userId,
      tenantId: tracker.tenantId,
      duration,
      metadata: {
        trackerId,
        memoryDelta: memoryAfter - (tracker.memoryUsage?.before || 0),
        queryCount: additionalContext.queryCount,
        cacheHits: additionalContext.cacheHits,
        cacheMisses: additionalContext.cacheMisses
      }
    });

    return completedTracker;
  }

  // Metric recording
  async recordMetric(context: MetricContext): Promise<void> {
    await ObservabilityService.recordMetric(
      context.name,
      context.value,
      context.unit,
      {
        service: context.service,
        operation: context.operation,
        userId: context.userId,
        tenantId: context.tenantId,
        tags: context.tags
      }
    );
  }

  // Structured logging for common patterns
  async logDatabaseQuery(
    query: string,
    duration: number,
    context: Partial<LogContext> = {}
  ): Promise<void> {
    const level = duration > 1000 ? 'WARN' : 'DEBUG';
    const message = `Database query executed`;
    
    await this.log(level, message, {
      ...context,
      duration,
      metadata: {
        ...context.metadata,
        query: query.length > 200 ? query.substring(0, 200) + '...' : query,
        queryLength: query.length
      }
    });

    await this.recordMetric({
      name: 'db_query_duration',
      value: duration,
      unit: 'ms',
      service: context.service || 'database',
      operation: context.operation || 'query',
      userId: context.userId,
      tenantId: context.tenantId
    });
  }

  async logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'invalidate',
    key: string,
    context: Partial<LogContext> = {}
  ): Promise<void> {
    await this.debug(`Cache ${operation}`, {
      ...context,
      metadata: {
        ...context.metadata,
        cacheKey: key,
        cacheOperation: operation
      }
    });

    await this.recordMetric({
      name: 'cache_operations',
      value: 1,
      unit: 'count',
      service: context.service || 'cache',
      operation: context.operation || operation,
      userId: context.userId,
      tenantId: context.tenantId,
      tags: {
        operation,
        hit: operation === 'hit' ? 'true' : 'false'
      }
    });
  }

  async logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context: Partial<LogContext> = {}
  ): Promise<void> {
    const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
    const message = `API request completed`;

    await this.log(level, message, {
      ...context,
      duration,
      metadata: {
        ...context.metadata,
        method,
        path,
        statusCode,
        requestType: 'api'
      }
    });

    await this.recordMetric({
      name: 'api_request_duration',
      value: duration,
      unit: 'ms',
      service: context.service || 'api',
      operation: `${method} ${path}`,
      userId: context.userId,
      tenantId: context.tenantId,
      tags: {
        method,
        statusCode: statusCode.toString(),
        path: path.split('?')[0] // Remove query parameters
      }
    });

    await this.recordMetric({
      name: 'api_requests',
      value: 1,
      unit: 'count',
      service: context.service || 'api',
      operation: `${method} ${path}`,
      userId: context.userId,
      tenantId: context.tenantId,
      tags: {
        method,
        statusCode: statusCode.toString(),
        success: statusCode < 400 ? 'true' : 'false'
      }
    });
  }

  async logAuthEvent(
    event: 'login' | 'logout' | 'register' | 'password_reset' | 'token_refresh' | 'access_denied',
    success: boolean,
    context: Partial<LogContext> = {}
  ): Promise<void> {
    const level = !success && event === 'login' ? 'WARN' : 'INFO';
    const message = `Authentication event: ${event}`;

    await this.log(level, message, {
      ...context,
      metadata: {
        ...context.metadata,
        authEvent: event,
        success,
        securityEvent: true
      }
    });

    await this.recordMetric({
      name: 'auth_events',
      value: 1,
      unit: 'count',
      service: context.service || 'auth',
      operation: event,
      userId: context.userId,
      tenantId: context.tenantId,
      tags: {
        event,
        success: success.toString()
      }
    });
  }

  async logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: Partial<LogContext> = {}
  ): Promise<void> {
    const level = severity === 'critical' ? 'ERROR' : severity === 'high' ? 'WARN' : 'INFO';
    const message = `Security event: ${event}`;

    await this.log(level, message, {
      ...context,
      metadata: {
        ...context.metadata,
        securityEvent: event,
        severity,
        requiresAttention: severity === 'critical' || severity === 'high'
      }
    });

    await this.recordMetric({
      name: 'security_events',
      value: 1,
      unit: 'count',
      service: context.service || 'security',
      operation: event,
      userId: context.userId,
      tenantId: context.tenantId,
      tags: {
        event,
        severity
      }
    });
  }

  // Core logging implementation
  private async log(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    context: Partial<LogContext>
  ): Promise<void> {
    // Ensure required fields
    const fullContext: LogContext = {
      service: 'unknown',
      operation: 'unknown',
      ...context
    };

    // Log through observability service
    await ObservabilityService.log(level, message, fullContext);
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    details: any;
  }> {
    const activeTrackers = this.performanceTrackers.size;
    const memoryUsage = process.memoryUsage();
    
    // Check for memory leaks in trackers
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (activeTrackers > 100) {
      status = 'critical';
    } else if (activeTrackers > 50) {
      status = 'warning';
    }

    return {
      status,
      details: {
        activePerformanceTrackers: activeTrackers,
        memoryUsage: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        },
        observabilityServiceAvailable: !!ObservabilityService
      }
    };
  }

  // Cleanup
  cleanup(): void {
    this.performanceTrackers.clear();
  }
}

// Export singleton instance
export const consistentLogger = ConsistentLogService.getInstance();

// Helper decorator for automatic performance tracking
export function trackPerformance(service: string, operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const logger = ConsistentLogService.getInstance();
      const trackerId = `${service}_${operation}_${Date.now()}_${Math.random()}`;
      
      logger.startPerformanceTracker(trackerId, {
        service,
        operation,
        userId: this?.userId || args[0]?.userId,
        tenantId: this?.tenantId || args[0]?.tenantId,
        metadata: { method: propertyName }
      });

      try {
        const result = await method.apply(this, args);
        await logger.endPerformanceTracker(trackerId, { 
          metadata: { success: true } 
        });
        return result;
      } catch (error) {
        await logger.endPerformanceTracker(trackerId, { 
          metadata: { success: false, error: error instanceof Error ? error.message : 'Unknown error' } 
        });
        throw error;
      }
    };
  };
}

// Helper function for request correlation
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
