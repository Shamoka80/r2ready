
# Logging Standards & Schema

**Created**: October 1, 2025  
**Version**: 1.0  
**Owner**: Platform Engineering  

## Structured Logging Format

All log entries must follow this JSON schema:

```json
{
  "timestamp": "2025-10-01T10:30:00.000Z",
  "level": "INFO",
  "service": "api",
  "operation": "GET /api/assessments",
  "message": "Request completed successfully",
  "userId": "user_123",
  "tenantId": "tenant_456",
  "sessionId": "session_789",
  "correlationId": "req_abc123",
  "duration": 245,
  "metadata": {
    "statusCode": 200,
    "cacheHit": true,
    "queryCount": 3
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

## Required Fields

### Core Fields (Always Required)
- `timestamp`: ISO 8601 formatted timestamp
- `level`: Log level (DEBUG, INFO, WARN, ERROR)
- `service`: Service name (api, auth, export, etc.)
- `operation`: Specific operation being performed
- `message`: Human-readable log message

### Context Fields (When Available)
- `userId`: User performing the action
- `tenantId`: Tenant context
- `sessionId`: Session identifier
- `correlationId`: Request correlation ID
- `duration`: Operation duration in milliseconds

### Optional Fields
- `metadata`: Additional structured data
- `ipAddress`: Client IP address
- `userAgent`: Client user agent

## Log Levels

### DEBUG
- Detailed diagnostic information
- Only in development environment
- Examples: SQL queries, cache operations

### INFO
- General application flow
- Successful operations
- Examples: Request completion, user login

### WARN
- Potentially harmful situations
- Recoverable errors
- Examples: Rate limiting, validation failures

### ERROR
- Error events that require attention
- Application exceptions
- Examples: Database failures, API errors

## Service Categories

### API Service (`api`)
- HTTP request/response logging
- Authentication events
- Route-specific operations

### Authentication Service (`auth`)
- Login/logout events
- Token operations
- Security events

### Database Service (`database`)
- Query performance
- Connection events
- Migration operations

### Export Service (`export`)
- Export generation
- File operations
- Template processing

### Cache Service (`cache`)
- Cache operations
- Hit/miss statistics
- Performance metrics

## Operation Naming Convention

Format: `{method} {resource}` or `{action}.{resource}`

Examples:
- `GET /api/assessments`
- `POST /api/auth/login`
- `user.login`
- `assessment.create`
- `export.generate`

## Performance Logging

### API Request Logging
```json
{
  "level": "INFO",
  "service": "api",
  "operation": "GET /api/assessments",
  "message": "Request completed",
  "duration": 245,
  "metadata": {
    "statusCode": 200,
    "cacheHits": 2,
    "queryCount": 3,
    "memoryDelta": 1024
  }
}
```

### Database Query Logging
```json
{
  "level": "DEBUG",
  "service": "database",
  "operation": "query.assessments",
  "message": "Query executed",
  "duration": 45,
  "metadata": {
    "query": "SELECT * FROM assessments WHERE...",
    "rowCount": 25,
    "fromCache": false
  }
}
```

## Security Event Logging

### Authentication Events
```json
{
  "level": "INFO",
  "service": "auth",
  "operation": "user.login",
  "message": "User login successful",
  "userId": "user_123",
  "metadata": {
    "method": "password",
    "twoFactorUsed": true
  }
}
```

### Security Violations
```json
{
  "level": "WARN",
  "service": "auth",
  "operation": "security.violation",
  "message": "Multiple failed login attempts",
  "metadata": {
    "attemptCount": 5,
    "timeWindow": "5m",
    "action": "account_locked"
  }
}
```

## Error Logging

### Application Errors
```json
{
  "level": "ERROR",
  "service": "api",
  "operation": "POST /api/assessments",
  "message": "Database connection failed",
  "metadata": {
    "error": "ConnectionTimeoutError",
    "stack": "Error stack trace...",
    "dbHost": "db.example.com",
    "retryCount": 3
  }
}
```

### Business Logic Errors
```json
{
  "level": "WARN",
  "service": "api",
  "operation": "assessment.validate",
  "message": "Assessment validation failed",
  "userId": "user_123",
  "metadata": {
    "validationErrors": [
      "Required field missing: facilityName",
      "Invalid email format"
    ]
  }
}
```

## Log Retention Policy

### Development Environment
- Retention: 7 days
- All log levels enabled
- Detailed debugging information

### Staging Environment
- Retention: 30 days
- INFO level and above
- Performance metrics included

### Production Environment
- Retention: 90 days
- WARN level and above for general logs
- INFO level for audit events
- Compressed storage after 7 days

## Correlation & Tracing

### Request Correlation
Every HTTP request gets a unique correlation ID that follows the request through all services:

```javascript
const correlationId = `req_${randomUUID()}`;
res.set('X-Correlation-ID', correlationId);
```

### Distributed Tracing
For multi-service operations, maintain correlation across service boundaries:

```javascript
const parentCorrelationId = req.headers['x-correlation-id'];
const childCorrelationId = `${parentCorrelationId}.${randomUUID()}`;
```

## Implementation Examples

### Basic Logging
```typescript
await logger.info('User registered successfully', {
  service: 'auth',
  operation: 'user.register',
  userId: user.id,
  tenantId: user.tenantId,
  metadata: {
    registrationMethod: 'email',
    emailVerified: false
  }
});
```

### Performance Logging
```typescript
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;

await logger.info('Assessment exported', {
  service: 'export',
  operation: 'assessment.export',
  duration,
  metadata: {
    format: 'pdf',
    size: fileSize,
    templateUsed: 'standard'
  }
});
```

### Error Logging
```typescript
try {
  // ... operation ...
} catch (error) {
  await logger.error('Export generation failed', {
    service: 'export',
    operation: 'assessment.export',
    userId: req.user.id,
    metadata: {
      error: error.message,
      stack: error.stack,
      assessmentId: assessmentId
    }
  });
  throw error;
}
```

## Monitoring & Alerting

### Log-based Alerts
- Error rate > 5% in 5-minute window
- Authentication failures > 10 in 1-minute window
- Response time p95 > 1000ms in 5-minute window
- Database connection failures

### Log Analysis Queries
```sql
-- High error rate detection
SELECT service, COUNT(*) as error_count
FROM logs 
WHERE level = 'ERROR' 
  AND timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY service
HAVING error_count > 10;

-- Slow operation detection
SELECT operation, AVG(duration) as avg_duration
FROM logs 
WHERE level = 'INFO' 
  AND duration IS NOT NULL 
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY operation
HAVING avg_duration > 1000;
```

## Best Practices

### DO
- Use structured logging consistently
- Include correlation IDs for request tracing
- Log business events for audit trails
- Sanitize sensitive data before logging
- Use appropriate log levels
- Include performance metrics

### DON'T
- Log passwords or sensitive personal data
- Log entire request/response bodies in production
- Use console.log in production code
- Create overly verbose debug logs
- Log the same event multiple times
- Use logs for application state storage

---

**Last Updated**: October 1, 2025  
**Next Review**: January 1, 2026  
**Approved By**: Platform Engineering Lead, Security Team
