export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["FATAL"] = "FATAL";
})(LogLevel || (LogLevel = {}));
class StructuredLogger {
    serviceName;
    isProduction;
    constructor(serviceName = 'rur2-app') {
        this.serviceName = serviceName;
        this.isProduction = process.env.NODE_ENV === 'production';
    }
    formatLog(context) {
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
            if (logEntry[key] === undefined) {
                delete logEntry[key];
            }
        });
        return JSON.stringify(logEntry);
    }
    log(level, message, metadata) {
        const context = {
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
    debug(message, metadata) {
        this.log(LogLevel.DEBUG, message, metadata);
    }
    info(message, metadata) {
        this.log(LogLevel.INFO, message, metadata);
    }
    warn(message, metadata) {
        this.log(LogLevel.WARN, message, metadata);
    }
    error(message, error, metadata) {
        const errorContext = {
            ...metadata,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
            } : undefined,
        };
        this.log(LogLevel.ERROR, message, errorContext);
    }
    fatal(message, error, metadata) {
        const errorContext = {
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
    withRequest(req) {
        return {
            traceId: req.headers['x-trace-id'] || req.headers['x-request-id'],
            userId: req.user?.id,
            tenantId: req.user?.tenantId,
        };
    }
    // Create a child logger with preset context
    child(context) {
        const childLogger = new StructuredLogger(this.serviceName);
        const originalLog = childLogger.log.bind(childLogger);
        childLogger.log = (level, message, metadata) => {
            originalLog(level, message, { ...context, ...metadata });
        };
        return childLogger;
    }
}
// Singleton instance
export const logger = new StructuredLogger('rur2-app');
// Factory for service-specific loggers
export function createLogger(serviceName) {
    return new StructuredLogger(serviceName);
}
// Export for testing
export { StructuredLogger };
