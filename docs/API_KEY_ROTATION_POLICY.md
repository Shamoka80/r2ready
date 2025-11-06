
# API Key Rotation Policy

## Overview

This document defines the policies, procedures, and schedules for rotating API keys and authentication credentials used in third-party integrations within the RUR2 application.

## Purpose

- **Security**: Minimize the risk of compromised credentials
- **Compliance**: Meet industry security standards and audit requirements
- **Operational Continuity**: Ensure seamless key rotation without service disruption
- **Accountability**: Establish clear ownership and responsibility for key management

---

## Rotation Schedules

### Production Environment
- **Critical Services**: Every 90 days
- **Standard Services**: Every 180 days
- **Development/Testing**: Every 30 days
- **Emergency Rotation**: Immediate upon compromise detection

### Service Classification

#### Critical Services (90-day rotation)
- **Payment Processing**: Stripe API keys
- **Authentication**: JWT signing keys, Auth0 secrets
- **Database**: Database connection credentials
- **Security**: Encryption keys, webhook secrets

#### Standard Services (180-day rotation)
- **Email**: SendGrid API keys
- **Cloud Storage**: GCS, Azure, AWS access keys
- **Monitoring**: DataDog, Sentry API keys
- **Analytics**: Third-party analytics API keys

#### Development Services (30-day rotation)
- **Test Environment Keys**: All sandbox/test API keys
- **Development Tools**: Development-only service keys

---

## Key Inventory

### Payment Processing

#### Stripe
- **Live Secret Key**: `sk_live_...`
- **Live Publishable Key**: `pk_live_...`
- **Webhook Secret**: `whsec_...`
- **Connect Keys**: Platform account keys
- **Rotation Frequency**: 90 days
- **Owner**: Finance Team Lead
- **Backup Owner**: Technical Lead

#### PayPal (if implemented)
- **Client ID**: PayPal application client ID
- **Client Secret**: PayPal application secret
- **Rotation Frequency**: 90 days
- **Owner**: Finance Team Lead

### Authentication & Security

#### JWT Configuration
- **Signing Key**: RSA private key for JWT signing
- **Refresh Token Secret**: Secret for refresh token generation
- **Session Secret**: Express session secret
- **Rotation Frequency**: 90 days
- **Owner**: Security Lead
- **Storage**: Encrypted in secrets management

#### Auth0 (if implemented)
- **Client Secret**: Auth0 application secret
- **Management API Token**: Long-lived management token
- **Rotation Frequency**: 90 days
- **Owner**: Security Lead

### Cloud Storage

#### Google Cloud Storage
- **Service Account Key**: JSON key file
- **Project ID**: GCP project identifier
- **Rotation Frequency**: 180 days
- **Owner**: DevOps Lead

#### Azure Blob Storage
- **Account Key**: Storage account access key
- **Connection String**: Full connection string
- **SAS Tokens**: Shared access signature tokens
- **Rotation Frequency**: 180 days
- **Owner**: DevOps Lead

#### AWS S3
- **Access Key ID**: IAM user access key
- **Secret Access Key**: IAM user secret
- **Session Tokens**: Temporary session tokens
- **Rotation Frequency**: 180 days
- **Owner**: DevOps Lead

### Communication Services

#### SendGrid
- **API Key**: SendGrid API key
- **Webhook Verification Key**: Webhook authentication
- **Rotation Frequency**: 180 days
- **Owner**: Development Team Lead

#### Twilio (if implemented)
- **Account SID**: Twilio account identifier
- **Auth Token**: Twilio authentication token
- **Rotation Frequency**: 180 days
- **Owner**: Development Team Lead

### Monitoring & Observability

#### DataDog
- **API Key**: DataDog API key
- **Application Key**: DataDog application key
- **Rotation Frequency**: 180 days
- **Owner**: SRE Team Lead

#### Sentry
- **DSN**: Sentry Data Source Name
- **Auth Token**: Sentry API authentication
- **Rotation Frequency**: 180 days
- **Owner**: Development Team Lead

---

## Rotation Procedures

### Pre-Rotation Checklist

1. **Schedule Planning**
   - [ ] Identify upcoming rotation dates
   - [ ] Coordinate with team members
   - [ ] Plan for low-traffic periods
   - [ ] Prepare rollback procedures

2. **Environment Preparation**
   - [ ] Verify current key functionality
   - [ ] Backup current configurations
   - [ ] Test key generation procedures
   - [ ] Prepare monitoring for transition

3. **Team Coordination**
   - [ ] Notify all relevant team members
   - [ ] Schedule rotation window
   - [ ] Assign primary and backup personnel
   - [ ] Prepare communication channels

### Rotation Process

#### Phase 1: Generate New Keys
1. **Create New Credentials**
   ```bash
   # Example: Generate new JWT signing key
   openssl genpkey -algorithm RSA -out new-jwt-private-key.pem -pkcs8 -keysize 2048
   openssl rsa -pubout -in new-jwt-private-key.pem -out new-jwt-public-key.pem
   ```

2. **Validate New Keys**
   - Test key functionality in staging environment
   - Verify key format and encoding
   - Confirm key strength and security parameters

3. **Store New Keys Securely**
   - Update secrets management system
   - Apply proper access controls
   - Document key metadata

#### Phase 2: Gradual Deployment
1. **Dual-Key Configuration**
   ```typescript
   // Example: Support both old and new JWT keys during transition
   const jwtVerificationKeys = [
     process.env.JWT_SIGNING_KEY_CURRENT,
     process.env.JWT_SIGNING_KEY_NEW
   ];
   
   function verifyToken(token: string): any {
     for (const key of jwtVerificationKeys) {
       try {
         return jwt.verify(token, key);
       } catch (error) {
         continue; // Try next key
       }
     }
     throw new Error('Token verification failed');
   }
   ```

2. **Staged Rollout**
   - Deploy to staging environment first
   - Monitor for any issues or errors
   - Gradually roll out to production

#### Phase 3: Full Transition
1. **Switch to New Keys**
   - Update application configuration
   - Switch primary key usage to new keys
   - Maintain old keys for compatibility period

2. **Monitor Transition**
   - Watch error rates and success metrics
   - Monitor third-party service responses
   - Check application logs for issues

#### Phase 4: Cleanup
1. **Deprecate Old Keys**
   - Remove old keys from active configuration
   - Revoke old keys at service provider
   - Clean up temporary dual-key configurations

2. **Update Documentation**
   - Record rotation completion
   - Update key inventory
   - Document any issues encountered

### Emergency Rotation

#### Immediate Actions (0-15 minutes)
1. **Assess Compromise Scope**
   - Identify which keys are compromised
   - Determine potential impact
   - Activate incident response team

2. **Revoke Compromised Keys**
   ```bash
   # Example: Emergency Stripe key revocation
   curl -X POST https://api.stripe.com/v1/api_keys/{KEY_ID}/revoke \
     -u sk_live_...:
   ```

3. **Generate Emergency Keys**
   - Create new keys immediately
   - Deploy to production without staging delay
   - Implement emergency access controls

#### Follow-up Actions (15+ minutes)
1. **Investigate Compromise**
   - Analyze how keys were compromised
   - Check for unauthorized usage
   - Review security logs

2. **Strengthen Security**
   - Update access controls
   - Implement additional monitoring
   - Review security procedures

---

## Automation & Tools

### Automated Rotation Scripts

#### JWT Key Rotation
```typescript
// scripts/rotate-jwt-keys.ts
import { execSync } from 'child_process';
import { updateSecret } from '../server/utils/secretsManager';

async function rotateJWTKeys(): Promise<void> {
  console.log('🔄 Starting JWT key rotation...');
  
  try {
    // Generate new RSA key pair
    execSync('openssl genpkey -algorithm RSA -out new-jwt-key.pem -pkcs8 -keysize 2048');
    execSync('openssl rsa -pubout -in new-jwt-key.pem -out new-jwt-public.pem');
    
    // Read new keys
    const privateKey = execSync('cat new-jwt-key.pem').toString();
    const publicKey = execSync('cat new-jwt-public.pem').toString();
    
    // Update secrets
    await updateSecret('JWT_SIGNING_KEY_NEW', privateKey);
    await updateSecret('JWT_PUBLIC_KEY_NEW', publicKey);
    
    console.log('✅ JWT keys rotated successfully');
    
    // Schedule cleanup of old keys (after 30 days)
    setTimeout(() => {
      rotateJWTKeysCleanup();
    }, 30 * 24 * 60 * 60 * 1000);
    
  } catch (error) {
    console.error('❌ JWT key rotation failed:', error);
    throw error;
  }
}
```

#### Cloud Storage Key Rotation
```typescript
// scripts/rotate-storage-keys.ts
import { Storage } from '@google-cloud/storage';

async function rotateGCSKeys(): Promise<void> {
  console.log('🔄 Starting GCS key rotation...');
  
  try {
    // Create new service account key
    const serviceAccount = 'rur2-storage@project.iam.gserviceaccount.com';
    const newKey = await createServiceAccountKey(serviceAccount);
    
    // Test new key functionality
    await testGCSConnection(newKey);
    
    // Update application secrets
    await updateSecret('GCS_SERVICE_ACCOUNT_KEY', JSON.stringify(newKey));
    
    console.log('✅ GCS keys rotated successfully');
    
    // Schedule old key deletion
    setTimeout(() => {
      deleteOldServiceAccountKey(serviceAccount);
    }, 7 * 24 * 60 * 60 * 1000); // 7 days grace period
    
  } catch (error) {
    console.error('❌ GCS key rotation failed:', error);
    throw error;
  }
}
```

### Monitoring & Alerting

#### Key Expiration Monitoring
```typescript
// server/services/keyMonitoringService.ts
export class KeyMonitoringService {
  private keyExpirationDates = new Map<string, Date>();
  
  constructor() {
    this.loadKeyExpirationDates();
    this.startExpirationMonitoring();
  }
  
  private startExpirationMonitoring(): void {
    // Check daily for keys expiring within 30 days
    setInterval(() => {
      this.checkExpiringKeys();
    }, 24 * 60 * 60 * 1000);
  }
  
  private checkExpiringKeys(): void {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    for (const [keyName, expirationDate] of this.keyExpirationDates) {
      if (expirationDate <= thirtyDaysFromNow) {
        this.alertKeyExpiration(keyName, expirationDate);
      }
    }
  }
  
  private alertKeyExpiration(keyName: string, expirationDate: Date): void {
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    
    console.warn(`🚨 Key ${keyName} expires in ${daysUntilExpiration} days`);
    
    // Send alert to monitoring system
    this.sendAlert({
      type: 'key_expiration_warning',
      keyName,
      daysUntilExpiration,
      severity: daysUntilExpiration <= 7 ? 'critical' : 'warning'
    });
  }
}
```

---

## Compliance & Audit

### Audit Trail Requirements

#### Rotation Logging
```typescript
// Log all key rotation activities
interface KeyRotationLog {
  timestamp: string;
  keyName: string;
  action: 'generated' | 'deployed' | 'deprecated' | 'revoked';
  performedBy: string;
  reason: string;
  success: boolean;
  errorMessage?: string;
}

async function logKeyRotation(log: KeyRotationLog): Promise<void> {
  await db.insert(keyRotationLogs).values({
    ...log,
    id: generateId(),
    createdAt: new Date()
  });
  
  // Also log to external audit system
  await auditService.logSecurityEvent({
    eventType: 'key_rotation',
    details: log
  });
}
```

### Compliance Standards

#### SOC 2 Type II
- **Access Controls**: Document who can rotate keys
- **Change Management**: Formal process for key rotation
- **Monitoring**: Continuous monitoring of key usage
- **Incident Response**: Procedures for key compromise

#### ISO 27001
- **Key Management**: Comprehensive key lifecycle management
- **Risk Assessment**: Regular assessment of key security risks
- **Training**: Staff training on key management procedures
- **Documentation**: Maintain detailed documentation

### Regulatory Requirements

#### PCI DSS
- **Encryption Keys**: Rotate encryption keys annually
- **Access Controls**: Restrict key access to authorized personnel
- **Audit Logs**: Maintain detailed audit logs
- **Key Storage**: Use secure key storage mechanisms

#### GDPR
- **Data Protection**: Ensure key rotation doesn't impact data protection
- **Breach Notification**: Report key compromises as data breaches
- **Access Rights**: Maintain records of key access

---

## Training & Documentation

### Team Training Requirements

#### Security Team
- Advanced key management techniques
- Cryptographic best practices
- Incident response procedures
- Compliance requirements

#### Development Team
- Application integration with new keys
- Testing procedures during rotation
- Troubleshooting common issues
- Emergency response protocols

#### Operations Team
- Monitoring key rotation status
- Infrastructure changes during rotation
- Backup and recovery procedures
- Vendor communication

### Documentation Maintenance

#### Quarterly Reviews
- Update key inventory
- Review rotation schedules
- Assess procedure effectiveness
- Update emergency contacts

#### Annual Reviews
- Complete security assessment
- Update compliance documentation
- Review and update training materials
- Assess automation opportunities

---

## Emergency Contacts

### Internal Team
- **Security Lead**: security-lead@rur2.app (Primary)
- **Technical Lead**: tech-lead@rur2.app (Secondary)
- **DevOps Lead**: devops-lead@rur2.app (Infrastructure)
- **On-Call Engineer**: oncall@rur2.app (24/7)

### Vendor Support
- **Stripe**: Available 24/7 via dashboard chat
- **Google Cloud**: Premium support (business hours)
- **Azure**: Basic support included
- **SendGrid**: Email support for paid plans

---

**Document Version**: 1.0  
**Last Updated**: December 22, 2024  
**Next Review**: March 22, 2025  
**Owner**: Security Lead  
**Approved By**: Technical Lead, Compliance Officer

---

## Quick Reference

### Emergency Key Rotation Commands
```bash
# Stripe - Revoke compromised key
curl -X POST https://api.stripe.com/v1/api_keys/{KEY_ID}/revoke \
  -u sk_live_...:

# Generate new JWT key
openssl genpkey -algorithm RSA -out emergency-jwt-key.pem -pkcs8 -keysize 2048

# Update Replit secrets
replit secrets set JWT_SIGNING_KEY_NEW "$(cat emergency-jwt-key.pem)"

# Test new configuration
npm run test:auth
```

### Key Rotation Schedule Reminder
- **Q1**: Stripe, JWT, Auth0 keys
- **Q2**: All development keys, Storage keys
- **Q3**: Email, Monitoring keys
- **Q4**: Complete annual review and emergency drill

This policy ensures systematic, secure, and compliant management of all API keys and credentials throughout their lifecycle.
