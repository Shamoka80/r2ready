# Microsoft Graph Email Service - Production Module

A complete, production-ready Node.js module for sending emails via Microsoft Graph API using MSAL (Microsoft Authentication Library) client credentials flow.

## Features

✅ **MSAL Client Credentials Flow** - Secure app-only authentication  
✅ **Axios-based Graph API Calls** - Reliable HTTP requests  
✅ **Automatic Retry Logic** - Handles Graph throttling (429 errors) with exponential backoff  
✅ **Comprehensive Error Logging** - Detailed error tracking and debugging  
✅ **Token Caching** - Automatic token refresh and caching  
✅ **Environment Variable Configuration** - Secure credential management  
✅ **TypeScript Support** - Full type definitions included  

## Installation

The module requires the following npm packages:

```bash
npm install @azure/msal-node axios
```

## Environment Variables

Set the following environment variables before using the module:

```env
MICROSOFT_365_CLIENT_ID=your-client-id
MICROSOFT_365_CLIENT_SECRET=your-client-secret
MICROSOFT_365_TENANT_ID=your-tenant-id
MICROSOFT_365_FROM_EMAIL=noreply@yourcompany.com
```

## Usage

### Basic Usage - Send Confirmation Email

```typescript
import { sendConfirmationEmail } from './services/graphEmailService';

// Send a confirmation email
await sendConfirmationEmail(
  'user@example.com',
  'Welcome to Our Service!',
  '<h1>Welcome!</h1><p>Thank you for joining us.</p>'
);
```

### Advanced Usage - Custom Email Options

```typescript
import { sendEmail } from './services/graphEmailService';

// Send a custom email with full options
await sendEmail({
  to: 'user@example.com',
  subject: 'Your Order Confirmation',
  htmlBody: '<h1>Order #12345</h1><p>Your order has been confirmed.</p>',
  from: 'orders@yourcompany.com', // Optional, uses MICROSOFT_365_FROM_EMAIL if not provided
  saveToSentItems: true // Optional, defaults to true
});
```

### Health Check

```typescript
import { healthCheck } from './services/graphEmailService';

// Check if the service is properly configured and working
const isHealthy = await healthCheck();
if (isHealthy) {
  console.log('Microsoft Graph email service is ready');
} else {
  console.error('Microsoft Graph email service is not configured or not working');
}
```

### Advanced - Using the Service Class

```typescript
import { GraphEmailService } from './services/graphEmailService';

// Create a custom instance with custom retry configuration
const emailService = new GraphEmailService({
  maxRetries: 10,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  retryableStatusCodes: [429, 500, 502, 503, 504]
});

// Use the instance
await emailService.sendConfirmationEmail(
  'user@example.com',
  'Test Email',
  '<p>This is a test email.</p>'
);
```

## Retry Logic

The module includes intelligent retry logic for handling Graph API throttling and transient errors:

- **Automatic Retry**: Retries on 429 (throttling), 500, 502, 503, 504 errors
- **Exponential Backoff**: Delays increase exponentially with each retry
- **Retry-After Header**: Respects Graph API's `Retry-After` header when provided
- **Jitter**: Adds random jitter to prevent thundering herd problems
- **Configurable**: Customize retry behavior via constructor options

### Default Retry Configuration

```typescript
{
  maxRetries: 5,
  baseDelayMs: 1000,        // 1 second
  maxDelayMs: 30000,         // 30 seconds
  retryableStatusCodes: [429, 500, 502, 503, 504]
}
```

## Error Handling

The module provides detailed error messages for common scenarios:

- **401 Unauthorized**: Authentication failed - check credentials and permissions
- **403 Forbidden**: Access denied - verify Mail.Send permission and Application Access Policy
- **404 Not Found**: Mailbox not found - verify the mailbox exists
- **429 Too Many Requests**: Rate limit exceeded - automatic retry with backoff
- **500/502/503/504**: Server errors - automatic retry with backoff

### Example Error Handling

```typescript
import { sendConfirmationEmail } from './services/graphEmailService';

try {
  await sendConfirmationEmail(
    'user@example.com',
    'Welcome!',
    '<h1>Welcome!</h1>'
  );
  console.log('Email sent successfully');
} catch (error) {
  if (error.message.includes('authentication failed')) {
    console.error('Check your Azure AD credentials');
  } else if (error.message.includes('access denied')) {
    console.error('Check Mail.Send permission and Application Access Policy');
  } else if (error.message.includes('rate limit')) {
    console.error('Too many requests - will retry automatically');
  } else {
    console.error('Email send failed:', error.message);
  }
}
```

## Logging

The module uses the `ConsistentLogService` for comprehensive logging:

- **Info**: Successful email sends, retry attempts
- **Warn**: Retry attempts, configuration issues
- **Error**: Failed requests, authentication errors
- **Debug**: Token acquisition, detailed request information

## Token Management

- **Automatic Caching**: Access tokens are cached and reused until expiry
- **Automatic Refresh**: Tokens are refreshed automatically before expiry (5-minute buffer)
- **Error Recovery**: Cached tokens are cleared on authentication failures

## Security Best Practices

1. **Environment Variables**: Never hardcode credentials - always use environment variables
2. **Secret Rotation**: Regularly rotate client secrets and update environment variables
3. **Application Access Policy**: Use Application Access Policies to restrict mailbox access
4. **Monitoring**: Monitor email sending activity and set up alerts for failures
5. **Error Logging**: Review error logs regularly to identify issues early

## API Reference

### Functions

#### `sendConfirmationEmail(to: string, subject: string, htmlBody: string): Promise<void>`

Send a confirmation email.

**Parameters:**
- `to`: Recipient email address
- `subject`: Email subject line
- `htmlBody`: HTML email body content

**Throws:** Error if email send fails

#### `sendEmail(options: EmailOptions): Promise<void>`

Send an email with full options.

**Parameters:**
- `options.to`: Recipient email address (required)
- `options.subject`: Email subject line (required)
- `options.htmlBody`: HTML email body content (required)
- `options.from`: Sender email address (optional, uses `MICROSOFT_365_FROM_EMAIL` if not provided)
- `options.saveToSentItems`: Save to sent items folder (optional, defaults to `true`)

**Throws:** Error if email send fails

#### `healthCheck(): Promise<boolean>`

Check if the service is properly configured and working.

**Returns:** `true` if service is healthy, `false` otherwise

### Classes

#### `GraphEmailService`

Main service class. Can be instantiated with custom retry configuration.

**Constructor:**
```typescript
new GraphEmailService(retryConfig?: Partial<RetryConfig>)
```

**Methods:**
- `sendEmail(options: EmailOptions): Promise<void>`
- `sendConfirmationEmail(to: string, subject: string, htmlBody: string): Promise<void>`
- `healthCheck(): Promise<boolean>`
- `configured: boolean` (getter)

## Testing

### Unit Testing Example

```typescript
import { sendConfirmationEmail } from './services/graphEmailService';

describe('GraphEmailService', () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.MICROSOFT_365_CLIENT_ID = 'test-client-id';
    process.env.MICROSOFT_365_CLIENT_SECRET = 'test-secret';
    process.env.MICROSOFT_365_TENANT_ID = 'test-tenant-id';
    process.env.MICROSOFT_365_FROM_EMAIL = 'test@example.com';
  });

  it('should send confirmation email', async () => {
    await expect(
      sendConfirmationEmail('user@example.com', 'Test', '<p>Test</p>')
    ).resolves.not.toThrow();
  });
});
```

## Troubleshooting

### Service Not Initializing

**Problem**: Service shows as not configured

**Solutions**:
- Verify all four environment variables are set
- Check for typos in variable names
- Ensure no extra spaces or quotes around values
- Restart the application after setting variables

### Authentication Errors

**Problem**: `authentication failed` errors

**Solutions**:
- Verify `MICROSOFT_365_CLIENT_ID` is correct
- Verify `MICROSOFT_365_CLIENT_SECRET` is correct and not expired
- Verify `MICROSOFT_365_TENANT_ID` is correct
- Check that admin consent was granted for Mail.Send permission

### Access Denied Errors

**Problem**: `access denied` errors

**Solutions**:
- Verify Mail.Send application permission is granted
- Check Application Access Policy allows the mailbox
- Verify the mailbox exists and is active
- Ensure the mailbox has Exchange Online license

### Rate Limiting

**Problem**: Frequent 429 errors even with retry logic

**Solutions**:
- Increase `maxRetries` in retry configuration
- Increase `maxDelayMs` to allow longer backoff periods
- Implement request queuing for high-volume scenarios
- Consider using multiple mailboxes with load balancing

## Related Documentation

- **Admin Setup Instructions**: See `docs/MICROSOFT_365_EMAIL_SETUP.md`
- **Environment Variables**: See `docs/MICROSOFT_365_ENV_VARIABLES.md`
- **Microsoft Graph API Documentation**: https://docs.microsoft.com/en-us/graph/api/user-sendmail

## License

This module is part of the RUR2 project and follows the same license terms.

