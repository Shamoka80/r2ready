import { Request } from 'express';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export interface LogContext {
  timestamp?: string;
  level: LogLevel;
  service: string;
  traceId?: string;
  userId?: number;
  tenantId?: number;
  message: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class StructuredLogger {
  private serviceName: string;
  private isProduction: boolean;

  constructor(serviceName: string = 'rur2-app') {
    this.serviceName = serviceName;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private formatLog(context: LogContext): string {
    const logEntry = {
      timestamp: context.timestamp || new Date().toISOString(),
      level: context.level,
      service: context.service || this.serviceName,
      traceId: context.traceId,
      userId: context.userId,
      tenantId: context.tenantId,
      message: context.message,
      ...context.metadata,
      ...(context.error && { error: context.error }),
    };

    // Remove undefined fields
    Object.keys(logEntry).forEach(key => {
      if (logEntry[key as keyof typeof logEntry] === undefined) {
        delete logEntry[key as keyof typeof logEntry];
      }
    });

    return JSON.stringify(logEntry);
  }

  private log(level: LogLevel, message: string, metadata?: Partial<LogContext>): void {
    const context: LogContext = {
      level,
      service: this.serviceName,
      message,
      ...metadata,
    };

    const formattedLog = this.formatLog(context);

    // In production, always use structured JSON logs
    if (this.isProduction) {
      console.log(formattedLog);
      return;
    }

    // In development, show both formatted and raw for easier debugging
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedLog);
        break;
    }
  }

  debug(message: string, metadata?: Partial<LogContext>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Partial<LogContext>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Partial<LogContext>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error, metadata?: Partial<LogContext>): void {
    const errorContext: Partial<LogContext> = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
    this.log(LogLevel.ERROR, message, errorContext);
  }

  fatal(message: string, error?: Error, metadata?: Partial<LogContext>): void {
    const errorContext: Partial<LogContext> = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
    this.log(LogLevel.FATAL, message, errorContext);
  }

  // Extract context from Express request
  withRequest(req: Request): Pick<LogContext, 'traceId' | 'userId' | 'tenantId'> {
    return {
      traceId: req.headers['x-trace-id'] as string || req.headers['x-request-id'] as string,
      userId: (req.user as { id?: number })?.id,
      tenantId: (req.user as { tenantId?: number })?.tenantId,
    };
  }

  // Create a child logger with preset context
  child(context: Partial<LogContext>): StructuredLogger {
    const childLogger = new StructuredLogger(this.serviceName);
    const originalLog = childLogger.log.bind(childLogger);
    
    childLogger.log = (level: LogLevel, message: string, metadata?: Partial<LogContext>) => {
      originalLog(level, message, { ...context, ...metadata });
    };

    return childLogger;
  }
}

// Singleton instance
export const logger = new StructuredLogger('rur2-app');

// Factory for service-specific loggers
export function createLogger(serviceName: string): StructuredLogger {
  return new StructuredLogger(serviceName);
}

// Export for testing
export { StructuredLogger };
