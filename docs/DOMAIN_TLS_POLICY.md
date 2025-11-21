
# Domain & TLS Management Policy

**Created**: October 1, 2025  
**Version**: 1.0  
**Owner**: DevOps Lead  

## Domain Naming Convention

### Replit Default Domains
- **Format**: `{repl-name}.{username}.repl.co`
- **Production**: `rur2.{username}.repl.co`
- **Staging**: `rur2-staging.{username}.repl.co`
- **Development**: `rur2-dev.{username}.repl.co`

### Custom Domain Strategy
- **Production**: `app.rur2.com` (when available)
- **API**: `api.rur2.com`
- **Staging**: `staging.rur2.com`
- **Documentation**: `docs.rur2.com`

### Environment-Specific Domains
| Environment | Domain Pattern | Purpose |
|-------------|----------------|---------|
| Production | `rur2.{user}.repl.co` | Live application |
| Staging | `rur2-staging.{user}.repl.co` | Pre-production testing |
| Development | `rur2-dev.{user}.repl.co` | Development environment |
| Preview | `rur2-pr-{number}.{user}.repl.co` | Pull request previews |

## TLS Certificate Management

### Replit Auto-Managed TLS
- **Coverage**: All `.repl.co` domains
- **Certificate Authority**: Let's Encrypt
- **Renewal**: Automatic every 90 days
- **Protocol**: TLS 1.3 with fallback to TLS 1.2
- **Cipher Suites**: Modern, secure cipher suites only

### TLS Configuration Standards
```nginx
# TLS Configuration (Replit managed)
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
```

### Security Headers
```javascript
// Security headers enforced by Replit
{
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

## Custom Domain Configuration

### Prerequisites
- Domain ownership verification
- DNS management access
- SSL certificate requirements
- CDN configuration (if applicable)

### Configuration Steps

#### 1. Domain Verification
```bash
# Add TXT record for domain verification
dig TXT _replit-challenge.yourdomain.com

# Expected response format
_replit-challenge.yourdomain.com. 300 IN TXT "replit-verification=abc123..."
```

#### 2. DNS Configuration
```dns
# DNS Records for custom domain
CNAME   app              rur2.{username}.repl.co.
CNAME   api              rur2.{username}.repl.co.
CNAME   staging          rur2-staging.{username}.repl.co.
A       @                1.2.3.4  # If apex domain needed
AAAA    @                ::1      # IPv6 if supported
```

#### 3. SSL Certificate Setup
```bash
# Custom domain SSL (if not using Replit managed)
certbot certonly --dns-route53 -d yourdomain.com -d *.yourdomain.com

# Certificate renewal automation
0 3 * * * /usr/bin/certbot renew --quiet
```

## Environment Configuration

### Development Environment
```bash
# .env.development
DOMAIN=rur2-dev.{username}.repl.co
PROTOCOL=https
PORT=5000
CLIENT_URL=https://rur2-dev.{username}.repl.co
```

### Staging Environment
```bash
# .env.staging
DOMAIN=rur2-staging.{username}.repl.co
PROTOCOL=https
PORT=5000
CLIENT_URL=https://rur2-staging.{username}.repl.co
```

### Production Environment
```bash
# .env.production
DOMAIN=rur2.{username}.repl.co
PROTOCOL=https
PORT=5000
CLIENT_URL=https://rur2.{username}.repl.co
```

## Security Requirements

### TLS Security Standards
- **Minimum TLS Version**: 1.2
- **Preferred TLS Version**: 1.3
- **Certificate Key Size**: Minimum 2048-bit RSA or 256-bit ECDSA
- **Certificate Validity**: Maximum 90 days (Let's Encrypt standard)
- **HSTS**: Enabled with `max-age=31536000`

### Certificate Monitoring
```javascript
// Certificate expiry monitoring
const checkCertificate = async (domain) => {
  const cert = await getTLSCertificate(domain);
  const expiryDate = new Date(cert.valid_to);
  const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 30) {
    await sendAlert('Certificate expiring soon', {
      domain,
      expiryDate,
      daysUntilExpiry
    });
  }
};
```

### Security Scanning
- **SSL Labs**: Weekly A+ rating verification
- **Certificate Transparency**: Monitor CT logs for unauthorized certificates
- **Vulnerability Scanning**: Monthly TLS configuration audits

## Deployment Integration

### Replit Deployment Configuration
```toml
# .replit configuration
[deployment]
publicDir = "client/dist"
deploymentTarget = "cloudrun"

[deployment.env]
REPL_SLUG = "rur2"
REPL_OWNER = "{username}"
```

### Domain Routing Configuration
```javascript
// Express.js domain routing
app.use((req, res, next) => {
  const host = req.get('host');
  
  // Redirect to HTTPS
  if (req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${host}${req.url}`);
  }
  
  // Environment-specific routing
  if (host.includes('staging')) {
    req.environment = 'staging';
  } else if (host.includes('dev')) {
    req.environment = 'development';
  } else {
    req.environment = 'production';
  }
  
  next();
});
```

## Monitoring & Alerting

### Domain Health Monitoring
```javascript
// Domain health check
const domainHealthCheck = {
  checks: [
    {
      name: 'DNS Resolution',
      test: () => dns.resolve(domain),
      threshold: '< 100ms'
    },
    {
      name: 'TLS Handshake',
      test: () => tlsConnect(domain),
      threshold: '< 500ms'
    },
    {
      name: 'HTTP Response',
      test: () => httpGet(`https://${domain}/health`),
      threshold: '< 2s'
    }
  ]
};
```

### Alert Conditions
- **Certificate Expiry**: < 30 days
- **DNS Resolution Failure**: > 2 consecutive failures
- **TLS Handshake Failure**: > 5% error rate
- **Domain Unreachable**: > 1 minute downtime

## Disaster Recovery

### Domain Failover
1. **Primary Domain Down**
   - Automatic failover to backup domain
   - DNS TTL set to 300 seconds for quick updates
   - User notification via status page

2. **DNS Provider Failure**
   - Secondary DNS provider activation
   - Manual DNS record migration
   - Communication plan execution

### Certificate Emergency Procedures
```bash
# Emergency certificate replacement
# 1. Generate emergency certificate
openssl req -x509 -newkey rsa:2048 -keyout emergency.key -out emergency.crt -days 7

# 2. Upload to Replit (if custom domain)
replit secrets set TLS_CERT "$(cat emergency.crt)"
replit secrets set TLS_KEY "$(cat emergency.key)"

# 3. Restart deployment
replit deploy
```

## Compliance & Audit

### Certificate Audit Trail
- **Creation**: Log certificate generation/purchase
- **Installation**: Track certificate deployment
- **Renewal**: Monitor automatic renewals
- **Revocation**: Document certificate revocations

### Domain Access Logs
- **DNS Changes**: Log all DNS modifications
- **Certificate Changes**: Track TLS certificate updates
- **Access Patterns**: Monitor unusual domain access

### Compliance Requirements
- **SOC 2**: TLS encryption for data in transit
- **GDPR**: Secure data transmission requirements
- **HIPAA**: Encryption standards compliance
- **PCI DSS**: Payment data transmission security

---

**Last Updated**: October 1, 2025  
**Next Review**: April 1, 2026  
**Approved By**: DevOps Lead, Security Lead, CTO
