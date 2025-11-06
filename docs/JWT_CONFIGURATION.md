
# JWT Configuration and Key Management

This document explains how to configure JWT authentication for the RUR2 application, including environment variables, key rotation, and Replit Secrets setup.

## Environment Variables

### Required Environment Variables

The application supports multiple JWT algorithms. Configure the appropriate variables based on your chosen algorithm:

#### HS256 (HMAC with SHA-256)
```bash
JWT_SECRET=your-secret-key-must-be-at-least-32-characters-long
JWT_ACTIVE_KID=production-key-id-v1
```

#### RS256 (RSA Signature with SHA-256)
```bash
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----
JWT_ACTIVE_KID=production-rsa-key-id-v1
```

#### EdDSA (Ed25519 Signature)
```bash
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----
JWT_ALGORITHM=EdDSA
JWT_ACTIVE_KID=production-eddsa-key-id-v1
```

### Key Rotation Variables

For seamless key rotation, configure next keys alongside active keys:

```bash
# Next keys for rotation
JWT_NEXT_KID=production-key-id-v2
JWT_NEXT_SECRET=your-next-secret-for-rotation  # For HS256
JWT_NEXT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...  # For asymmetric
JWT_NEXT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...   # For asymmetric
```

## Setting Up Secrets in Replit

### Step 1: Access Secrets Manager

1. Open your Replit project
2. Click on the "Secrets" tab in the left sidebar
3. Or use the shortcut: Tools → Secrets

### Step 2: Add JWT Secrets

For **HS256** setup:
```
Key: JWT_SECRET
Value: your-production-secret-key-at-least-32-characters-long-and-secure

Key: JWT_ACTIVE_KID  
Value: prod-hmac-v1
```

For **RS256** setup:
```
Key: JWT_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKB
[... your full private key ...]
-----END PRIVATE KEY-----

Key: JWT_PUBLIC_KEY
Value: -----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1L7VLPHCgVwh44jB
[... your full public key ...]
-----END PUBLIC KEY-----

Key: JWT_ACTIVE_KID
Value: prod-rsa-v1
```

### Step 3: Verify Configuration

After adding secrets, restart your application and check the health endpoint:

```bash
curl https://your-repl.replit.dev/api/auth/health
```

Expected response:
```json
{
  "status": "ok",
  "jwt": {
    "algorithm": "HS256",
    "kid": "prod-hmac-v1", 
    "keysLoaded": true,
    "nextKidAvailable": false
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Key Generation

### Generate HS256 Secret

```bash
# Generate a secure random secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Generate RS256 Key Pair

```bash
# Generate private key
openssl genpkey -algorithm RSA -out jwt_private.pem -pkcs8 -aes256

# Extract public key
openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem

# View keys (copy these to Replit Secrets)
cat jwt_private.pem
cat jwt_public.pem
```

### Generate Ed25519 Key Pair

```bash
# Generate Ed25519 key pair
openssl genpkey -algorithm Ed25519 -out jwt_ed25519_private.pem
openssl pkey -in jwt_ed25519_private.pem -pubout -out jwt_ed25519_public.pem

# View keys
cat jwt_ed25519_private.pem  
cat jwt_ed25519_public.pem
```

## Key Rotation Process

### Planning Rotation

1. **Prepare new keys**: Generate new key pair/secret with new KID
2. **Configure next keys**: Add `JWT_NEXT_*` environment variables
3. **Deploy changes**: Application will sign with active, verify with both
4. **Monitor transition**: Watch logs and health endpoint
5. **Promote keys**: Move next keys to active after transition period
6. **Clean up**: Remove old keys after all tokens expire

### Example Rotation (HS256)

#### Phase 1: Prepare Next Key
```bash
# In Replit Secrets, add:
JWT_NEXT_SECRET=new-secret-key-for-rotation-at-least-32-characters-long
JWT_NEXT_KID=prod-hmac-v2
```

#### Phase 2: Deploy and Monitor
```bash
# Check health endpoint
curl https://your-repl.replit.dev/api/auth/health

# Response should show:
{
  "jwt": {
    "algorithm": "HS256", 
    "kid": "prod-hmac-v1",
    "keysLoaded": true,
    "nextKidAvailable": true
  }
}
```

#### Phase 3: Promote Keys (after 24+ hours)
```bash
# In Replit Secrets, update:
JWT_SECRET=new-secret-key-for-rotation-at-least-32-characters-long
JWT_ACTIVE_KID=prod-hmac-v2

# Remove rotation keys:
# Delete JWT_NEXT_SECRET
# Delete JWT_NEXT_KID
```

## Security Best Practices

### Secret Management
- **Never hardcode secrets** in source code
- **Use strong secrets**: 32+ characters for HS256, 2048+ bit RSA keys
- **Rotate regularly**: Every 90 days or after security incidents
- **Monitor access**: Watch audit logs for suspicious activity

### Algorithm Selection
- **HS256**: Simple, fast, good for single-service deployments
- **RS256**: Better for microservices, allows verification without signing key
- **EdDSA**: Modern, efficient, quantum-resistant preparation

### Environment Security
- **Separate secrets** per environment (dev/staging/prod)
- **Audit access** to Replit Secrets regularly
- **Use unique KIDs** to track key usage
- **Monitor health endpoint** for configuration issues

## Troubleshooting

### Common Issues

#### Application Won't Start
```
❌ JWT Configuration Error: JWT_SECRET is required for HS256 algorithm
```
**Solution**: Add `JWT_SECRET` to Replit Secrets

#### Authentication Failing
```json
{"error": "Invalid signature"}
```
**Solutions**:
- Verify secret/key values in Replit Secrets
- Check algorithm configuration matches keys
- Ensure KID values are correct

#### Key Rotation Not Working
```json
{"error": "Unknown kid"}
```
**Solutions**:
- Verify `JWT_NEXT_KID` is set correctly
- Check next key/secret values
- Monitor health endpoint for `nextKidAvailable: true`

### Debug Commands

```bash
# Check environment (without exposing secrets)
curl https://your-repl.replit.dev/api/auth/health

# Test authentication
curl -X POST https://your-repl.replit.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Verify token manually (for debugging)
echo "YOUR_JWT_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

## Support

For additional help with JWT configuration:

1. Check the health endpoint: `/api/auth/health`
2. Review application logs in Replit console
3. Verify environment variables in Replit Secrets
4. Test with the provided integration tests

Remember: Never expose JWT secrets in logs, code, or support requests.
