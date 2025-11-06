
# Network Topology Documentation

**Created**: October 1, 2025  
**Version**: 1.0  
**Owner**: Technical Architect  

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet/Users                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Replit Edge Network                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │     CDN     │  │ Load Balancer│  │   DDoS Protection   │  │
│  │             │  │              │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                RUR2 Application (Replit)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Frontend  │  │   Backend   │  │    File Storage     │  │
│  │  (React)    │  │ (Express)   │  │     (Local)         │  │
│  │   Port 5173 │  │  Port 5000  │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                External Services                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    Neon     │  │   Stripe    │  │    Email Service    │  │
│  │ (Database)  │  │ (Payments)  │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### Replit Infrastructure Layer

#### Edge Network
- **Global CDN**: Replit's global content delivery network
- **Load Balancing**: Automatic request distribution
- **DDoS Protection**: Built-in protection against attacks
- **SSL Termination**: TLS certificate management

#### Application Runtime
- **Container**: Isolated execution environment
- **Resource Limits**: CPU and memory constraints
- **Networking**: Internal container networking
- **Storage**: Persistent and temporary storage

### Application Layer

#### Frontend (React)
```
Port: 5173 (development), 80/443 (production)
Technology: React 18 + TypeScript
Build Tool: Vite
Deployment: Static files served by Replit
```

#### Backend (Express)
```
Port: 5000 (internal), mapped to 80/443
Technology: Node.js + Express + TypeScript
Database ORM: Drizzle
Runtime: Node.js 18+
```

#### Inter-Service Communication
```javascript
// Internal service communication
const serviceUrls = {
  frontend: process.env.NODE_ENV === 'production' 
    ? 'https://rur2.{username}.repl.co'
    : 'http://localhost:5173',
  backend: process.env.NODE_ENV === 'production'
    ? 'https://rur2.{username}.repl.co/api'
    : 'http://localhost:5000/api'
};
```

## External Service Integrations

### Neon Database
- **Connection**: Secure PostgreSQL over TLS
- **Endpoint**: `{project}.{region}.neon.tech`
- **Authentication**: Username/password + SSL certificates
- **Connection Pooling**: Built-in connection management
- **Backup**: Automated backups and point-in-time recovery

### Stripe Payment Processing
- **API Endpoint**: `https://api.stripe.com`
- **Webhooks**: `https://rur2.{username}.repl.co/api/stripe/webhook`
- **Authentication**: API keys (secret and publishable)
- **Security**: Webhook signature verification

### Email Service Integration
- **Provider**: Configurable (SendGrid, Mailgun, etc.)
- **Authentication**: API key based
- **Templates**: Transactional email templates
- **Tracking**: Delivery and engagement metrics

## Security Zones & Trust Boundaries

### Zone Classification

#### Public Zone (Internet)
- **Components**: User browsers, external APIs
- **Security Level**: Untrusted
- **Access**: HTTPS only, rate limited
- **Protection**: DDoS protection, WAF

#### DMZ (Replit Edge)
- **Components**: Load balancers, CDN, proxy
- **Security Level**: Semi-trusted
- **Access**: Controlled ingress/egress
- **Protection**: SSL termination, request filtering

#### Application Zone (Replit Container)
- **Components**: Frontend, backend application
- **Security Level**: Trusted
- **Access**: Internal container network
- **Protection**: Container isolation, resource limits

#### Data Zone (External Services)
- **Components**: Database, payment processor
- **Security Level**: Highly trusted
- **Access**: Encrypted connections only
- **Protection**: Service-level authentication

### Trust Boundaries

```
Internet ──[HTTPS]──→ Replit Edge ──[HTTP]──→ Application ──[TLS]──→ Database
   │                      │                      │                    │
   │                      │                      │                    │
Untrusted            Semi-trusted           Application            Service
 Zone                   Zone                   Zone                Zone
```

## Network Security Controls

### Ingress Controls
- **HTTPS Enforcement**: All traffic encrypted in transit
- **Rate Limiting**: API endpoints protected against abuse
- **IP Filtering**: Geographic and reputation-based blocking
- **Request Validation**: Input sanitization and validation

### Egress Controls
- **Allowlisted Destinations**: Limited external service access
- **API Key Management**: Secure credential storage
- **Certificate Pinning**: Validate external service certificates
- **Connection Timeouts**: Prevent resource exhaustion

### Internal Security
```javascript
// Network security middleware
app.use((req, res, next) => {
  // Enforce HTTPS
  if (req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.get('host')}${req.url}`);
  }
  
  // Security headers
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  next();
});
```

## Data Flow Diagrams

### User Authentication Flow
```
User Browser ──[1. Login Request]──→ Replit Edge ──[2. Forward]──→ RUR2 Backend
      ↑                                    ↑                        │
      │                                    │                        │
      └──[5. JWT Token]──────────────────────────────────────────[3. Validate]
                                                                     │
                                                                     ▼
                                                              Neon Database
                                                                     │
                                                                     │
                                                              [4. User Data]
```

### Payment Processing Flow
```
User ──[1. Payment]──→ Frontend ──[2. Stripe.js]──→ Stripe ──[3. Webhook]──→ Backend
                                                      │                        │
                                                      │                        │
                                                      └──[4. Event Data]──────┘
                                                                               │
                                                                               ▼
                                                                        Neon Database
```

### Assessment Data Flow
```
User ──[1. Answer]──→ Frontend ──[2. API Call]──→ Backend ──[3. Process]──→ Database
                                                     │                        │
                                                     │                        │
                                             [5. Evidence Upload]    [4. Store Answer]
                                                     │                        │
                                                     ▼                        │
                                              File Storage ◄─────────────────┘
```

## Performance Characteristics

### Network Latency Targets
- **Frontend Assets**: < 200ms (CDN cached)
- **API Responses**: < 500ms (95th percentile)
- **Database Queries**: < 100ms (95th percentile)
- **External API Calls**: < 2s (timeout)

### Bandwidth Requirements
- **Typical User Session**: 1-5 MB
- **File Uploads**: Up to 100 MB per file
- **API Overhead**: < 10 KB per request
- **Static Assets**: Cached, minimal repeated transfer

### Connection Limits
- **Concurrent Users**: 500 (Replit limit dependent)
- **Database Connections**: 20 (Neon connection pooling)
- **API Rate Limits**: 1000 requests/hour per user
- **File Upload Concurrent**: 10 simultaneous uploads

## Monitoring & Observability

### Network Monitoring Points
1. **Edge Ingress**: Request volume, error rates, latency
2. **Application**: Internal API performance, error tracking
3. **Database**: Connection health, query performance
4. **External Services**: API call success rates, latency

### Health Check Endpoints
```javascript
// Network health checks
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabaseConnection(),
      external_apis: await checkExternalServices(),
      internal_services: await checkInternalHealth()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## Disaster Recovery Network Plan

### Primary Failure Scenarios
1. **Replit Edge Failure**: Automatic failover within Replit infrastructure
2. **Database Connection Loss**: Connection retry with exponential backoff
3. **External Service Outage**: Graceful degradation, retry mechanisms
4. **Complete Replit Outage**: Manual migration to backup infrastructure

### Network Recovery Procedures
```javascript
// Connection resilience patterns
const retryConfig = {
  database: { retries: 3, backoff: 'exponential', maxDelay: 5000 },
  external_apis: { retries: 2, backoff: 'linear', maxDelay: 2000 },
  internal_services: { retries: 5, backoff: 'exponential', maxDelay: 1000 }
};
```

## Compliance & Audit

### Network Security Compliance
- **SOC 2 Type II**: Network controls and monitoring
- **GDPR**: Data transmission encryption requirements
- **PCI DSS**: Payment data network security
- **ISO 27001**: Network security management

### Audit Trail Requirements
- **Network Access Logs**: 90-day retention
- **Security Event Logs**: 1-year retention
- **Performance Metrics**: 30-day retention
- **Configuration Changes**: Permanent retention

---

**Last Updated**: October 1, 2025  
**Next Review**: April 1, 2026  
**Approved By**: Technical Architect, Security Lead, CTO
