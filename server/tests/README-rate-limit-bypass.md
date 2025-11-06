# Rate Limit Bypass for Test Environment

## Overview
Integration tests now run without rate limit errors by automatically bypassing rate limiting when `NODE_ENV=test`.

## Implementation

### Modified Files
- **server/middleware/rateLimitMiddleware.ts**: Added test environment bypass to the `createRateLimit()` factory function

### How It Works
When `process.env.NODE_ENV === 'test'`, the rate limiting middleware immediately calls `next()` and returns, skipping all rate limit checks.

```typescript
return async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Bypass rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
      next();
      return;
    }
    
    // ... normal rate limiting logic
  }
};
```

### Test Setup
The test file `server/tests/auth-registration-modes.test.ts` already sets the environment variable in `beforeAll`:

```typescript
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  // ... rest of setup
});
```

## Security
- **Production Safe**: Rate limiting remains fully active in production environments
- **Test-Only Bypass**: Only bypassed when `NODE_ENV === 'test'`
- **No Configuration Changes**: Rate limit values and rules remain unchanged

## Impact
- ✅ Integration tests can execute multiple rapid requests without 429 errors
- ✅ No more 5 registrations per 5 minutes limit during testing
- ✅ All rate limiting endpoints bypass in test mode (login, registration, exports, etc.)
- ✅ Production behavior unchanged

## Verification Test
A verification test is available at `server/tests/verify-rate-limit-bypass.test.ts` which:
- Attempts 6+ rapid registrations (exceeds 5/5min limit)
- Attempts 6+ rapid logins
- Verifies no 429 (rate limit) responses are returned
- Confirms all requests process normally

## Affected Endpoints
All endpoints using rate limiting middleware are bypassed in test environment:
- `/api/auth/login`
- `/api/auth/register-tenant`
- `/api/auth/password-reset`
- `/api/auth/token-refresh`
- `/api/auth2fa/verify`
- `/api/exports/pdf`
- `/api/exports/excel`
- `/api/uploads/evidence`
- All other rate-limited endpoints

## Testing
Run the integration tests with:
```bash
cd server && npm test
```

Run specific test:
```bash
cd server && npm test -- auth-registration-modes.test.ts
```

Run verification test:
```bash
cd server && npm test -- verify-rate-limit-bypass.test.ts
```
