# Microsoft 365 Email Integration - Environment Variables

This document describes the environment variables required for Microsoft 365 email integration.

## Required Environment Variables

To enable Microsoft 365 email sending, you must set the following environment variables:

### `MICROSOFT_365_CLIENT_ID`
- **Description**: Azure AD Application (Client) ID
- **Type**: String (UUID format)
- **Example**: `12345678-1234-1234-1234-123456789012`
- **Where to find**: Azure Portal → App Registrations → Your App → Overview → Application (client) ID
- **Required**: Yes

### `MICROSOFT_365_CLIENT_SECRET`
- **Description**: Azure AD Client Secret value
- **Type**: String
- **Example**: `abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz`
- **Where to find**: Azure Portal → App Registrations → Your App → Certificates & secrets → Client secrets
- **Required**: Yes
- **Security Note**: Store this securely. Never commit to version control.

### `MICROSOFT_365_TENANT_ID`
- **Description**: Azure AD Directory (Tenant) ID
- **Type**: String (UUID format)
- **Example**: `87654321-4321-4321-4321-210987654321`
- **Where to find**: Azure Portal → App Registrations → Your App → Overview → Directory (tenant) ID
- **Required**: Yes

### `MICROSOFT_365_FROM_EMAIL`
- **Description**: Email address of the mailbox to send emails from
- **Type**: String (email format)
- **Example**: `noreply@yourcompany.com`
- **Required**: Yes
- **Note**: This mailbox must:
  - Exist in your Exchange Online
  - Be included in the Application Access Policy (if one is configured)
  - Have proper Exchange Online license

## Environment Variable Priority

The email service uses the following priority order for providers:

1. **Resend** (if `RESEND_API_KEY` is set)
2. **Microsoft 365** (if all Microsoft 365 variables are set)
3. **SendGrid** (if `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` are set)
4. **SMTP** (if SMTP variables are set)
5. **Console** (always available as fallback for development)

## Example Configuration

### `.env` file example:

```env
# Microsoft 365 Email Configuration
MICROSOFT_365_CLIENT_ID=12345678-1234-1234-1234-123456789012
MICROSOFT_365_CLIENT_SECRET=abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz
MICROSOFT_365_TENANT_ID=87654321-4321-4321-4321-210987654321
MICROSOFT_365_FROM_EMAIL=noreply@yourcompany.com
```

## Verification

After setting the environment variables, the service will automatically:

1. Initialize the Microsoft 365 email provider on startup
2. Log initialization status (success or failure with missing variables)
3. Include Microsoft 365 in the provider fallback chain

### Check if Microsoft 365 is configured:

Look for this log message on server startup:
```
✅ Email service initialized with Microsoft 365 provider
```

If you see a warning about missing variables, check that all four variables are set correctly.

## Troubleshooting

### Service not initializing

**Problem**: Microsoft 365 provider not appearing in logs

**Solutions**:
- Verify all four environment variables are set
- Check for typos in variable names
- Ensure no extra spaces or quotes around values
- Restart the server after setting variables

### Authentication errors

**Problem**: `Microsoft 365 authentication failed`

**Solutions**:
- Verify `MICROSOFT_365_CLIENT_ID` is correct
- Verify `MICROSOFT_365_CLIENT_SECRET` is correct (not expired)
- Verify `MICROSOFT_365_TENANT_ID` is correct
- Check that admin consent was granted for Mail.Send permission

### Access denied errors

**Problem**: `Microsoft 365 access denied`

**Solutions**:
- Verify Mail.Send application permission is granted
- Check Application Access Policy allows the mailbox
- Verify the mailbox exists and is active
- Ensure the mailbox has Exchange Online license

### Mailbox not found errors

**Problem**: `Microsoft 365 mailbox not found`

**Solutions**:
- Verify `MICROSOFT_365_FROM_EMAIL` is correct
- Check the mailbox exists in Exchange Online
- Ensure the mailbox is not disabled or deleted

## Security Best Practices

1. **Never commit secrets to version control**
   - Add `.env` to `.gitignore`
   - Use environment variable management in production (Azure Key Vault, AWS Secrets Manager, etc.)

2. **Rotate secrets regularly**
   - Set expiration dates on client secrets
   - Create new secrets before old ones expire
   - Update environment variables before old secrets expire

3. **Use Application Access Policies**
   - Restrict the application to specific mailboxes
   - Follow the instructions in `MICROSOFT_365_EMAIL_SETUP.md`

4. **Monitor usage**
   - Review application usage in Azure AD
   - Set up alerts for unusual activity
   - Regularly audit permissions

## Related Documentation

- **Admin Setup Instructions**: See `docs/MICROSOFT_365_EMAIL_SETUP.md`
- **Email Service Implementation**: See `server/services/microsoft365EmailService.ts`
- **Email Service Integration**: See `server/services/emailService.ts`

