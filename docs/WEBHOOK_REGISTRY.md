
# Webhook Registry

## Overview

This document maintains a centralized registry of all webhook endpoints used in the RUR2 application for third-party service integrations.

## Purpose

- **Centralized Management**: Single source of truth for all webhook configurations
- **Security**: Track authentication methods and security configurations
- **Monitoring**: Enable proper monitoring and alerting for webhook failures
- **Documentation**: Provide clear implementation details for each webhook

---

## Payment Processing Webhooks

### Stripe Payment Webhooks
- **Endpoint**: `/api/stripe/webhook`
- **Provider**: Stripe
- **Method**: `POST`
- **Authentication**: Webhook signature verification
- **Events Handled**:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- **Security**:
  - Webhook secret: `whsec_...` (stored in secrets)
  - Signature header: `Stripe-Signature`
  - Timestamp tolerance: 300 seconds
- **Retry Policy**: Stripe automatic retry (up to 3 days)
- **Error Handling**: 
  - Return 200 for successful processing
  - Return 400/500 for errors to trigger retry
- **Monitoring**: 
  - Success rate > 99%
  - Response time < 2 seconds
- **Implementation**: `server/routes/stripe-webhooks.ts`

#### Sample Webhook Payload
```json
{
  "id": "evt_...",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_...",
      "amount": 5000,
      "currency": "usd",
      "status": "succeeded"
    }
  }
}
```

---

## Cloud Storage Webhooks

### Google Cloud Storage Notifications
- **Endpoint**: `/api/cloud-storage/gcs/notification`
- **Provider**: Google Cloud Storage
- **Method**: `POST`
- **Authentication**: Service account verification
- **Events Handled**:
  - `OBJECT_FINALIZE` (file upload complete)
  - `OBJECT_DELETE` (file deletion)
  - `OBJECT_METADATA_UPDATE` (metadata changes)
- **Security**:
  - Bearer token authentication
  - IP whitelist: Google Cloud IP ranges
- **Retry Policy**: Exponential backoff (up to 7 days)
- **Error Handling**: HTTP status code based retry logic
- **Implementation**: `server/routes/cloud-storage.ts`

### Azure Blob Storage Event Grid
- **Endpoint**: `/api/cloud-storage/azure/events`
- **Provider**: Microsoft Azure Event Grid
- **Method**: `POST`
- **Authentication**: Event Grid validation
- **Events Handled**:
  - `Microsoft.Storage.BlobCreated`
  - `Microsoft.Storage.BlobDeleted`
- **Security**:
  - Validation code verification
  - Subscription validation handshake
- **Retry Policy**: Event Grid retry policy
- **Implementation**: `server/routes/cloud-storage.ts`

### AWS S3 Event Notifications
- **Endpoint**: `/api/cloud-storage/s3/notification`
- **Provider**: Amazon SNS (via S3)
- **Method**: `POST`
- **Authentication**: SNS message verification
- **Events Handled**:
  - `s3:ObjectCreated:*`
  - `s3:ObjectRemoved:*`
- **Security**:
  - SNS signature verification
  - Topic ARN validation
- **Retry Policy**: SNS retry policy
- **Implementation**: `server/routes/cloud-storage.ts`

---

## Authentication Webhooks

### Auth0 User Events
- **Endpoint**: `/api/auth/auth0/webhook`
- **Provider**: Auth0
- **Method**: `POST`
- **Authentication**: Shared secret
- **Events Handled**:
  - User login
  - User registration
  - Password reset
  - Account verification
- **Security**:
  - Shared secret verification
  - IP whitelist: Auth0 IP ranges
- **Implementation**: `server/routes/auth.ts`

---

## Communication Webhooks

### SendGrid Email Events
- **Endpoint**: `/api/email/sendgrid/events`
- **Provider**: SendGrid
- **Method**: `POST`
- **Authentication**: HTTP Basic Auth
- **Events Handled**:
  - `delivered`
  - `bounce`
  - `dropped`
  - `spam_report`
  - `unsubscribe`
  - `click`
  - `open`
- **Security**:
  - Basic authentication with username/password
  - Event verification via OAuth
- **Retry Policy**: SendGrid automatic retry
- **Implementation**: `server/routes/email-webhooks.ts`

---

## Monitoring & Observability Webhooks

### Sentry Issue Webhooks
- **Endpoint**: `/api/monitoring/sentry/webhook`
- **Provider**: Sentry
- **Method**: `POST`
- **Authentication**: Secret token
- **Events Handled**:
  - `issue.created`
  - `issue.resolved`
  - `issue.assigned`
- **Security**: Secret token in header
- **Implementation**: `server/routes/observability.ts`

---

## Webhook Security Framework

### Authentication Methods

#### 1. Signature Verification (Stripe, GitHub)
```typescript
import crypto from 'crypto';

function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

#### 2. Basic Authentication (SendGrid)
```typescript
function verifyBasicAuth(authHeader: string, username: string, password: string): boolean {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return authHeader === `Basic ${credentials}`;
}
```

#### 3. Bearer Token (Custom APIs)
```typescript
function verifyBearerToken(authHeader: string, expectedToken: string): boolean {
  return authHeader === `Bearer ${expectedToken}`;
}
```

### Security Best Practices

1. **Always Verify Authenticity**
   - Use signature verification when available
   - Validate source IP addresses
   - Check timestamp to prevent replay attacks

2. **Implement Idempotency**
   - Use event IDs to prevent duplicate processing
   - Store processed event IDs for deduplication

3. **Error Handling**
   - Return appropriate HTTP status codes
   - Implement proper retry mechanisms
   - Log all webhook events for audit trail

4. **Rate Limiting**
   - Implement rate limiting per provider
   - Monitor for unusual webhook volumes
   - Alert on rate limit violations

---

## Webhook Monitoring

### Health Checks
- **Endpoint Availability**: Monitor webhook endpoint uptime
- **Response Times**: Track webhook processing performance
- **Error Rates**: Monitor success/failure rates per provider
- **Alert Thresholds**:
  - Error rate > 5%
  - Response time > 5 seconds
  - Endpoint downtime > 1 minute

### Monitoring Dashboard Metrics
- **Total Webhooks Processed**: Daily/monthly counts
- **Success Rate**: Percentage of successful webhook processing
- **Average Response Time**: Processing time metrics
- **Error Breakdown**: Categorized error analysis
- **Provider Status**: Per-provider health status

### Alerting Rules
```yaml
webhook_error_rate:
  condition: error_rate > 0.05
  for: 5m
  alert: "Webhook error rate exceeded 5%"
  severity: warning

webhook_response_time:
  condition: avg_response_time > 5s
  for: 2m
  alert: "Webhook response time exceeded 5 seconds"
  severity: critical

webhook_endpoint_down:
  condition: endpoint_available == false
  for: 1m
  alert: "Webhook endpoint unavailable"
  severity: critical
```

---

## Implementation Guidelines

### Webhook Handler Template
```typescript
import { Request, Response } from 'express';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { validateWebhookSignature } from '../utils/webhookValidation';

export async function handleProviderWebhook(req: Request, res: Response) {
  try {
    // 1. Verify webhook signature
    const isValid = validateWebhookSignature(
      req.body,
      req.headers['signature'] as string,
      process.env.PROVIDER_WEBHOOK_SECRET!
    );
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Parse webhook event
    const event = req.body;
    const eventId = event.id;

    // 3. Check for duplicate processing
    const alreadyProcessed = await checkEventProcessed(eventId);
    if (alreadyProcessed) {
      return res.status(200).json({ status: 'already_processed' });
    }

    // 4. Process webhook event
    await processWebhookEvent(event);

    // 5. Mark event as processed
    await markEventProcessed(eventId);

    // 6. Return success response
    res.status(200).json({ status: 'processed' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Retry Logic Implementation
```typescript
async function processWebhookWithRetry(event: any, maxRetries = 3): Promise<void> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      await processWebhookEvent(event);
      return; // Success
    } catch (error) {
      attempts++;
      
      if (attempts >= maxRetries) {
        throw error; // Final attempt failed
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempts) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Testing & Development

### Webhook Testing Tools
- **ngrok**: Expose local development server for webhook testing
- **Webhook.site**: Capture and inspect webhook payloads
- **Provider Test Modes**: Use sandbox/test environments

### Local Development Setup
```bash
# Install ngrok for webhook testing
npm install -g ngrok

# Expose local server
ngrok http 5000

# Update webhook URLs in provider dashboards to:
# https://abc123.ngrok.io/api/stripe/webhook
```

### Integration Testing
```typescript
describe('Webhook Integration Tests', () => {
  it('should process Stripe webhook successfully', async () => {
    const payload = {
      id: 'evt_test_123',
      type: 'payment_intent.succeeded',
      data: { /* test data */ }
    };
    
    const signature = generateTestSignature(payload);
    
    const response = await request(app)
      .post('/api/stripe/webhook')
      .set('Stripe-Signature', signature)
      .send(payload);
    
    expect(response.status).toBe(200);
  });
});
```

---

## Troubleshooting Guide

### Common Issues

1. **Signature Verification Failures**
   - Check webhook secret configuration
   - Verify timestamp tolerance settings
   - Ensure correct payload encoding

2. **Timeout Errors**
   - Optimize webhook processing logic
   - Implement background job processing
   - Increase provider timeout settings

3. **Duplicate Event Processing**
   - Implement idempotency keys
   - Check event deduplication logic
   - Review database constraints

### Debug Commands
```bash
# Check webhook logs
tail -f logs/webhook.log | grep "stripe"

# Test webhook endpoint
curl -X POST http://localhost:5000/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test_signature" \
  -d '{"test": "data"}'

# Verify webhook configuration
npm run verify-webhooks
```

---

## Compliance & Audit

### Audit Requirements
- **Webhook Logs**: Maintain detailed logs for all webhook events
- **Access Control**: Document webhook endpoint access controls
- **Data Retention**: Define webhook log retention policies
- **Security Reviews**: Regular security audits of webhook implementations

### GDPR Compliance
- **Data Processing**: Document personal data processed via webhooks
- **Consent**: Ensure proper consent for webhook data processing
- **Right to Deletion**: Implement webhook data deletion procedures

---

**Document Version**: 1.0  
**Last Updated**: December 22, 2024  
**Next Review**: March 22, 2025  
**Owner**: Integration Team Lead  
**Approved By**: Technical Lead, Security Lead

---

## Quick Reference

### Emergency Webhook Debugging
```bash
# Disable problematic webhook temporarily
curl -X POST https://api.stripe.com/v1/webhook_endpoints/{ENDPOINT_ID} \
  -u {STRIPE_SECRET_KEY}: \
  -d "disabled=true"

# Check webhook delivery attempts
curl https://api.stripe.com/v1/events/{EVENT_ID}/attempts \
  -u {STRIPE_SECRET_KEY}:
```

### Provider Support Contacts
- **Stripe**: Support via dashboard or email
- **SendGrid**: Email support (support@sendgrid.com)
- **Auth0**: Support portal for paid plans
- **Google Cloud**: Cloud Console support

This registry ensures all webhook integrations are properly documented, secured, and maintained for reliable third-party service communication.
