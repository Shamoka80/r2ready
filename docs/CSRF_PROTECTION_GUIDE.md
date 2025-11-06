# CSRF Protection Implementation Guide

**Status:** Recommended for production deployment
**Priority:** CRITICAL
**Last Updated:** November 5, 2025

## Overview

Cross-Site Request Forgery (CSRF) is a security vulnerability where an attacker tricks a user's browser into making unwanted requests to an application where the user is authenticated. This guide provides implementation options for CSRF protection in the R2v3 application.

## Current Status

**❌ No CSRF Protection Implemented**

The application currently relies on:
- JWT tokens in Authorization headers (✅ Protected against CSRF)
- No session cookies (yet)
- CORS restrictions (⚠️ Helps but not sufficient)

## Recommended Implementation: SameSite Cookies

### Why SameSite Cookies?

- **Simplest to implement** - No additional tokens or state management needed
- **Browser-native protection** - Leverages modern browser security features
- **Compatible with our architecture** - Works well with JWT-based auth
- **Industry standard** - Recommended by OWASP

### Implementation Steps

#### 1. Update Session Cookie Configuration

If/when using cookies for session management, configure them with SameSite attribute:

```typescript
// In server/routes/auth.ts or session management code
res.cookie('sessionToken', token, {
  httpOnly: true,              // Prevent JavaScript access
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
  sameSite: 'strict',          // CSRF protection
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined
});
```

#### 2. SameSite Options Explained

| Option | Protection Level | Use Case |
|--------|-----------------|----------|
| `Strict` | **Highest** | Best for most apps. Cookies never sent cross-site. |
| `Lax` | **Medium** | Good balance. Cookies sent on top-level GET navigations. |
| `None` | **No Protection** | ⛔ Never use (requires Secure flag). |

**Recommended:** Use `Strict` for maximum protection.

#### 3. Cookie-Based Auth Migration (Optional)

If migrating from Bearer tokens to cookies:

```typescript
// Login endpoint
router.post('/login', async (req, res) => {
  // ... authenticate user ...
  
  const token = AuthService.generateToken(payload);
  
  // Set secure cookie instead of returning token in response
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });
  
  res.json({ success: true, user: userData });
  // Don't send token in response body
});
```

```typescript
// Update auth middleware to read from cookies
export const authenticateUser = async (req, res, next) => {
  // Try cookie first, fall back to Authorization header
  let token = req.cookies?.authToken;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // ... verify token ...
};
```

## Alternative: CSRF Tokens

If SameSite cookies are not sufficient (e.g., need cross-origin authenticated requests):

### 1. Install CSRF Package

```bash
npm install csurf cookie-parser
npm install --save-dev @types/csurf @types/cookie-parser
```

### 2. Configure CSRF Middleware

```typescript
// server/index.ts
import cookieParser from 'cookie-parser';
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });

app.use(cookieParser());
app.use(csrfProtection); // Apply to all routes or specific routes
```

### 3. Send CSRF Token to Client

```typescript
// Add endpoint to get CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

### 4. Include Token in Requests

```typescript
// Client-side (frontend)
const response = await fetch('/api/csrf-token');
const { csrfToken } = await response.json();

// Include in subsequent requests
await fetch('/api/protected-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
```

## Double Submit Cookie Pattern

Another CSRF protection method without server-side state:

### 1. Set CSRF Cookie on Login

```typescript
router.post('/login', async (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  
  res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false,  // Client needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });
  
  res.json({ success: true, csrfToken });
});
```

### 2. Verify Token on Protected Routes

```typescript
const csrfMiddleware = (req, res, next) => {
  const cookieToken = req.cookies['XSRF-TOKEN'];
  const headerToken = req.headers['x-csrf-token'];
  
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }
  
  next();
};

// Apply to protected routes
router.post('/protected-route', csrfMiddleware, handler);
```

## Current Architecture Compatibility

### ✅ Already CSRF-Resistant

These patterns in our current implementation are naturally CSRF-resistant:

1. **Bearer Token Authentication in Headers**
   - JavaScript cannot be tricked into sending custom headers cross-origin
   - Attackers cannot read or set Authorization headers via CSRF

2. **CORS Restrictions**
   - Strict origin validation prevents unauthorized cross-origin requests
   - Preflight requests block many CSRF attempts

3. **JSON Request Bodies**
   - Many CSRF attacks rely on form submissions
   - JSON bodies require JavaScript (blocked cross-origin)

### ⚠️ Vulnerable Patterns

If you implement these features, add CSRF protection:

1. **Cookie-Based Authentication** - Requires SameSite or CSRF tokens
2. **GET Requests with Side Effects** - Should be POST with CSRF protection
3. **Simple POST Requests** - Requires CSRF protection if using cookies

## Testing CSRF Protection

### Manual Testing

```bash
# 1. Get valid session (login)
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 2. Try CSRF attack (should fail with SameSite=Strict)
curl -b cookies.txt -X POST http://localhost:5000/api/protected-route \
  -H "Origin: http://evil-site.com" \
  -H "Content-Type: application/json" \
  -d '{"malicious":"data"}'
```

### Automated Testing

```typescript
// tests/security/csrf.test.ts
describe('CSRF Protection', () => {
  it('should reject requests without CSRF token', async () => {
    const response = await request(app)
      .post('/api/protected-route')
      .set('Cookie', validSessionCookie)
      .send({ data: 'test' });
    
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('CSRF');
  });

  it('should accept requests with valid CSRF token', async () => {
    const response = await request(app)
      .post('/api/protected-route')
      .set('Cookie', validSessionCookie)
      .set('X-CSRF-Token', validCsrfToken)
      .send({ data: 'test' });
    
    expect(response.status).toBe(200);
  });
});
```

## Production Deployment Checklist

Before deploying to production, verify:

- [ ] All cookies have `Secure` flag in production
- [ ] All cookies have `HttpOnly` flag (except CSRF tokens if using Double Submit)
- [ ] All cookies have `SameSite=Strict` or `SameSite=Lax`
- [ ] CORS is properly configured for production origins only
- [ ] CSRF tokens are validated on all state-changing operations
- [ ] GET requests never perform state-changing operations
- [ ] Referer header validation is not relied upon alone

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [CSRF Token Best Practices](https://portswigger.net/web-security/csrf/tokens)

---

**Next Steps:**
1. Decide on CSRF protection method (SameSite cookies recommended)
2. Implement chosen method
3. Test thoroughly
4. Deploy to production
5. Monitor for CSRF-related security events
