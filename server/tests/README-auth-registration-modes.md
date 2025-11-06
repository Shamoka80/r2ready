# Dual-Mode Registration Integration Tests

## Overview

The `auth-registration-modes.test.js` file contains integration tests for the dual-mode registration endpoint that verify the feature flag gate logic for `enable_email_verification`.

## Test Coverage

### 1. Email-First Flow (Feature Flag ON)
- Enables the `enable_email_verification` feature flag
- Registers a new tenant
- Verifies response does NOT include session token
- Verifies response includes `requiresEmailVerification: true`
- Queries database to confirm `setupStatus = 'email_pending'`
- Confirms `emailVerified = false` and `emailVerificationToken` is set

### 2. Legacy Payment-First Flow (Feature Flag OFF)
- Disables the `enable_email_verification` feature flag
- Registers a new tenant
- Verifies response INCLUDES session token (immediate login)
- Verifies response includes `user`, `tenant`, and `permissions`
- Queries database to confirm `emailVerified = true`
- Confirms user can login immediately
- Confirms `emailVerificationToken` is null

### 3. Feature Flag Toggle
- Tests switching between the two modes
- Verifies correct behavior when flag is toggled

## Important: Rate Limiting

The registration endpoint has rate limiting applied:
- **Limit**: 5 registration attempts per 5 minutes (300 seconds)
- **Scope**: Per IP address

### Running the Tests

**Option 1: Wait for rate limit window to clear**
```bash
# Wait 5+ minutes since last test run, then:
cd server && npx playwright test tests/auth-registration-modes.test.js
```

**Option 2: Run with max-failures flag (recommended)**
```bash
# This will stop after first failure to avoid accumulating rate limit violations
cd server && npx playwright test tests/auth-registration-modes.test.js --max-failures=1
```

**Option 3: Run individually**
```bash
# Run specific test (waits are built in)
cd server && npx playwright test tests/auth-registration-modes.test.js -g "Email-First Flow"

# Wait 5 minutes, then run next test
cd server && npx playwright test tests/auth-registration-modes.test.js -g "Legacy Flow"
```

## Test Design

The tests are designed to:
1. Run sequentially (`test.describe.configure({ mode: 'serial' })`)
2. Include delays between requests to minimize rate limit violations
3. Use only 5 total registrations (within the rate limit)
4. Clean up test data after completion

## Expected Results

When rate limits are not exceeded, all 3 tests should pass:

```
✓ Email-First Flow: should register without session when flag is ON
✓ Legacy Flow: should register with immediate session when flag is OFF  
✓ Feature Flag Toggle: should switch between flows correctly
```

## Troubleshooting

### Error: 429 Rate Limit Exceeded

If you see this error:
```
Error: expect(received).toBe(expected)
Expected: 201
Received: 429
```

**Solution**: Wait 5 minutes for the rate limit window to clear before running tests again.

### Brute-Force Alert

If you see a security alert in the logs:
```
🚨 SECURITY ALERT [HIGH]
📋 Brute-Force Attack Detected
```

This is expected when rate limits are exceeded during testing. The rate limit window will reset after 5 minutes.

## Database Queries

The tests verify database state using Drizzle ORM:

```javascript
const user = await db.query.users.findFirst({
  where: eq(users.email, testEmail)
});
```

Key assertions:
- `setupStatus`: 'email_pending' for email-first, NOT 'email_pending' for legacy
- `emailVerified`: false for email-first, true for legacy
- `emailVerificationToken`: set for email-first, null/undefined for legacy

## Test File Location

`server/tests/auth-registration-modes.test.js`

## Dependencies

- `@playwright/test`: Test framework
- `drizzle-orm`: Database queries
- Running server on `localhost:5000`
- Feature flag system enabled
