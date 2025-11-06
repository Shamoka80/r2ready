import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { performanceMetrics } from '../../shared/schema';

interface PerformanceMetrics {
  duration: number;
  timestamp: Date;
  path: string;
  method: string;
  statusCode?: number;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
  };
}

// Performance monitoring middleware enhanced for Phase 2 SLOs
export function performanceMonitor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const memoryBefore = process.memoryUsage().heapUsed;

  // Capture response finish event
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDelta = memoryAfter - memoryBefore;

    const metrics: PerformanceMetrics = {
      duration,
      timestamp: new Date(),
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      userId: req.user?.id
    };

    // Store performance metrics in database
    try {
      await db.insert(performanceMetrics as any).values({
        metricName: 'request_duration',
        service: 'api',
        operation: `${req.method} ${req.path}`,
        value: duration,
        unit: 'ms',
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
        tags: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          memoryDelta,
          slow: duration > 1000
        },
        timestamp: new Date()
      });

      // Also store memory delta if significant
      if (Math.abs(memoryDelta) > 1024 * 1024) { // > 1MB change
        await db.insert(performanceMetrics as any).values({
          metricName: 'memory_delta',
          service: 'api',
          operation: `${req.method} ${req.path}`,
          value: memoryDelta,
          unit: 'bytes',
          userId: req.user?.id,
          tenantId: req.user?.tenantId,
          tags: {
            method: req.method,
            path: req.path
          },
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to store performance metrics:', error);
    }

    // Log slow requests (>1000ms)
    if (duration > 1000) {
      console.warn(`[PERF] Slow request: ${req.method} ${req.path} took ${duration}ms (Memory: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB)`);
    }

    // Log to debug if needed
    if (process.env.NODE_ENV === 'development' && req.path.startsWith('/api')) {
      console.log(`[PERF] ${req.method} ${req.path} - ${duration}ms (${res.statusCode})`);
    }
  });

  next();
}

export default performanceMonitor;