
# Sandbox Environment Registry

## Overview

This document maintains a centralized registry of all sandbox and test environments for third-party integrations used in the RUR2 application.

## Purpose

- **Environment Isolation**: Maintain clear separation between development, staging, and production environments
- **Security**: Ensure test credentials and sandbox keys are properly managed
- **Documentation**: Provide clear setup instructions for all third-party integrations
- **Compliance**: Track sandbox usage for audit and compliance purposes

---

## Payment Processing

### Stripe Test Environment
- **Environment**: Stripe Test Mode
- **Purpose**: Payment processing testing and development
- **Setup**: 
  - Test Publishable Key: `pk_test_...` (stored in secrets)
  - Test Secret Key: `sk_test_...` (stored in secrets)
  - Webhook Endpoint: `/api/stripe/webhook`
- **Test Cards**: 
  - Success: `4242424242424242`
  - Decline: `4000000000000002`
  - 3D Secure: `4000002500003155`
- **Monitoring**: Stripe Dashboard Test Mode
- **Data Reset**: Test data cleared monthly

---

## Email Services

### SendGrid Sandbox
- **Environment**: SendGrid Development
- **Purpose**: Email delivery testing
- **Setup**:
  - API Key: `SG.test_...` (stored in secrets)
  - Sender Email: `noreply-dev@rur2.app`
  - Template IDs: Development versions
- **Testing**: Email capture via SendGrid's test mode
- **Limitations**: 100 emails/day in sandbox

### Ethereal Email (Development)
- **Environment**: Local Development
- **Purpose**: Email testing without external delivery
- **Setup**:
  - Host: `smtp.ethereal.email`
  - Port: `587`
  - Auto-generated credentials
- **Testing**: Preview emails via Ethereal web interface
- **Reset**: Credentials expire after 24 hours

---

## Cloud Storage

### Google Cloud Storage Development
- **Environment**: GCS Development Bucket
- **Purpose**: File upload/download testing
- **Setup**:
  - Bucket: `rur2-dev-storage`
  - Service Account: `rur2-dev@...gserviceaccount.com`
  - Credentials: JSON key file (stored in secrets)
- **Quota**: 5GB storage limit
- **Cleanup**: Files auto-deleted after 7 days

### Azure Blob Storage Development
- **Environment**: Azure Development Storage
- **Purpose**: Cloud storage integration testing
- **Setup**:
  - Account: `rur2devstorage`
  - Container: `dev-documents`
  - Connection String: (stored in secrets)
- **Quota**: 1GB storage limit
- **Cleanup**: Weekly automated cleanup

### AWS S3 Development
- **Environment**: S3 Development Bucket
- **Purpose**: S3 integration testing
- **Setup**:
  - Bucket: `rur2-dev-bucket`
  - Region: `us-east-1`
  - IAM User: `rur2-dev-user`
  - Access Keys: (stored in secrets)
- **Quota**: 2GB storage limit
- **Cleanup**: Lifecycle policy - 30 days

---

## Authentication & Security

### Auth0 Development
- **Environment**: Auth0 Development Tenant
- **Purpose**: SSO and authentication testing
- **Setup**:
  - Domain: `rur2-dev.auth0.com`
  - Client ID: (stored in secrets)
  - Client Secret: (stored in secrets)
- **Test Users**: Pre-configured test accounts
- **Rules**: Development-specific authentication rules

### Okta Sandbox
- **Environment**: Okta Developer Edition
- **Purpose**: Enterprise SSO testing
- **Setup**:
  - Domain: `dev-rur2.okta.com`
  - Application ID: (stored in secrets)
  - API Token: (stored in secrets)
- **Test Users**: Limited to 100 active users
- **Features**: Full feature set available in developer edition

---

## Database Services

### Neon Database Branching
- **Environment**: Neon Branch Databases
- **Purpose**: Database schema testing and migrations
- **Setup**:
  - Main Branch: `main`
  - Development Branch: `development`
  - Feature Branches: Created per feature
- **Connection**: Branch-specific connection strings
- **Data**: Anonymized production data subset

---

## Monitoring & Observability

### DataDog Trial
- **Environment**: DataDog Trial Account
- **Purpose**: Application monitoring and alerting
- **Setup**:
  - API Key: (stored in secrets)
  - Application Key: (stored in secrets)
  - Tags: `env:development`
- **Limitations**: 14-day trial, 5 hosts max
- **Metrics**: Custom application metrics and logs

### Sentry Development
- **Environment**: Sentry Development Project
- **Purpose**: Error tracking and performance monitoring
- **Setup**:
  - DSN: (stored in secrets)
  - Project: `rur2-development`
  - Environment: `development`
- **Quota**: 5,000 errors/month
- **Alerts**: Email notifications for critical errors

---

## API Services

### OpenAI API Development
- **Environment**: OpenAI Development Usage
- **Purpose**: AI-powered features testing
- **Setup**:
  - API Key: (stored in secrets)
  - Organization: `rur2-development`
  - Model: `gpt-3.5-turbo` (cost-effective for testing)
- **Quota**: $50/month spending limit
- **Usage**: Content generation and analysis features

---

## Environment Management

### Configuration Management
```yaml
# Example environment configuration
development:
  stripe:
    publishable_key: ${STRIPE_TEST_PUBLISHABLE_KEY}
    secret_key: ${STRIPE_TEST_SECRET_KEY}
    webhook_secret: ${STRIPE_TEST_WEBHOOK_SECRET}
  
  email:
    service: "ethereal"
    smtp_host: "smtp.ethereal.email"
    smtp_port: 587
  
  storage:
    provider: "gcs"
    bucket: "rur2-dev-storage"
    credentials_path: ${GCS_CREDENTIALS_PATH}

staging:
  stripe:
    publishable_key: ${STRIPE_TEST_PUBLISHABLE_KEY}
    secret_key: ${STRIPE_TEST_SECRET_KEY}
    webhook_secret: ${STRIPE_TEST_WEBHOOK_SECRET}
  
  email:
    service: "sendgrid"
    api_key: ${SENDGRID_API_KEY}
    from_email: "noreply-staging@rur2.app"
```

### Environment Promotion Workflow

1. **Development → Staging**
   - Update staging secrets with test credentials
   - Run integration tests against staging APIs
   - Verify sandbox connectivity

2. **Staging → Production**
   - Replace test credentials with production keys
   - Update webhook endpoints to production URLs
   - Enable production monitoring

---

## Security Guidelines

### Credential Management
- **Storage**: All sandbox credentials stored in Replit Secrets
- **Rotation**: Test credentials rotated quarterly
- **Access**: Limited to development team members
- **Documentation**: Never commit credentials to version control

### Data Protection
- **PII**: No real PII in sandbox environments
- **Anonymization**: Production data anonymized before use in staging
- **Retention**: Test data retained for maximum 30 days
- **Cleanup**: Automated cleanup scripts run weekly

---

## Monitoring & Alerts

### Health Checks
- **Frequency**: Hourly health checks for all sandbox services
- **Monitoring**: Uptime monitoring via synthetic tests
- **Alerts**: Slack notifications for service outages
- **Escalation**: Email alerts for extended outages (>30 minutes)

### Usage Tracking
- **Quotas**: Monitor API usage against sandbox limits
- **Cost Tracking**: Track sandbox costs monthly
- **Reporting**: Monthly sandbox usage reports
- **Optimization**: Review and optimize sandbox usage quarterly

---

## Troubleshooting

### Common Issues

1. **Expired Test Credentials**
   - Check credential expiration dates
   - Regenerate expired keys
   - Update secrets in environment

2. **Quota Exceeded**
   - Monitor usage dashboards
   - Request quota increases if needed
   - Implement usage throttling

3. **Webhook Failures**
   - Verify webhook URLs are accessible
   - Check webhook secret configurations
   - Review webhook delivery logs

### Support Contacts
- **Infrastructure**: DevOps Team (`devops@rur2.app`)
- **Integrations**: Development Team (`dev@rur2.app`)
- **Security**: Security Team (`security@rur2.app`)

---

## Compliance & Audit

### Audit Requirements
- **Access Logs**: Maintain logs of sandbox access
- **Change Management**: Document all sandbox configuration changes
- **Security Reviews**: Quarterly security reviews of sandbox environments
- **Compliance**: Ensure sandbox usage complies with vendor ToS

### Documentation Updates
- **Frequency**: Update documentation monthly
- **Reviews**: Quarterly review of all sandbox configurations
- **Approval**: Changes approved by Technical Lead
- **Version Control**: Maintain version history of this document

---

**Document Version**: 1.0  
**Last Updated**: December 22, 2024  
**Next Review**: March 22, 2025  
**Owner**: Integration Team Lead  
**Approved By**: Technical Lead, Security Lead

---

## Quick Reference

### Emergency Contacts
- **Stripe Support**: Available 24/7 via dashboard
- **SendGrid Support**: Email support for paid plans
- **Google Cloud**: Premium support (business hours)
- **Azure Support**: Basic support included

### Key Resources
- [Stripe Test Mode Documentation](https://stripe.com/docs/testing)
- [SendGrid Email Testing](https://docs.sendgrid.com/for-developers/sending-email/sandbox-mode)
- [Google Cloud Storage Testing](https://cloud.google.com/storage/docs/testing)
- [Azure Storage Testing](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-emulator)

This registry ensures all third-party integrations are properly documented, secured, and maintained across all environments.
