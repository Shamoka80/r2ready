# Microsoft 365 SMTP Email Setup Guide

This guide will help you configure Microsoft 365 SMTP for sending emails through your RuR2 application.

## Overview

The email service now prioritizes Microsoft 365 SMTP as the primary email provider, keeping all email functionality internal to your Microsoft ecosystem.

## Prerequisites

1. Microsoft 365 Business or Enterprise account
2. Access to Azure Portal
3. A mailbox in your Microsoft 365 tenant

## Step 1: Get Microsoft 365 SMTP Settings

### Option A: Use Existing Mailbox (Recommended)
Use an existing mailbox in your Microsoft 365 tenant:

- **SMTP Host**: `smtp.office365.com`
- **SMTP Port**: `587` (STARTTLS) or `465` (SSL)
- **SMTP User**: Your Microsoft 365 email address (e.g., `noreply@yourdomain.com`)
- **SMTP Password**: Your mailbox password or App Password (see below)

### Option B: Create Dedicated Service Account
1. Go to Microsoft 365 Admin Center
2. Create a new user account specifically for sending emails (e.g., `noreply@yourdomain.com`)
3. Assign it a license if required
4. Use this account's credentials for SMTP

## Step 2: Configure App Password (Recommended for Security)

For better security, use an App Password instead of your regular password:

1. Go to [Microsoft Account Security](https://account.microsoft.com/security)
2. Enable **Two-factor authentication** (if not already enabled)
3. Go to **Security** → **Advanced security options**
4. Under **App passwords**, click **Create a new app password**
5. Name it "RuR2 Email Service"
6. Copy the generated app password (you'll use this instead of your regular password)

## Step 3: Environment Variables

Add these environment variables to your `.env` file in the `server/` directory:

```env
# Microsoft 365 SMTP Configuration (Primary Email Provider)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-app-password-or-regular-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=RuR2 Platform
SMTP_TLS_REJECT_UNAUTHORIZED=true
```

### Environment Variable Details

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | Microsoft 365 SMTP server | `smtp.office365.com` |
| `SMTP_PORT` | SMTP port (587 for STARTTLS, 465 for SSL) | `587` |
| `SMTP_SECURE` | Use SSL/TLS (true for port 465, false for 587) | `false` |
| `SMTP_USER` | Your Microsoft 365 email address | `noreply@yourdomain.com` |
| `SMTP_PASSWORD` | App password or regular password | `YourAppPassword123` |
| `SMTP_FROM_EMAIL` | Email address to send from | `noreply@yourdomain.com` |
| `SMTP_FROM_NAME` | Display name for sender | `RuR2 Platform` |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | Verify TLS certificates (true for production) | `true` |

## Step 4: Port Configuration

### Port 587 (STARTTLS) - Recommended
- **SMTP_PORT**: `587`
- **SMTP_SECURE**: `false`
- Uses STARTTLS encryption
- Most compatible with Microsoft 365

### Port 465 (SSL)
- **SMTP_PORT**: `465`
- **SMTP_SECURE**: `true`
- Uses SSL encryption
- Alternative option if 587 doesn't work

## Step 5: Test the Configuration

After setting up the environment variables:

1. **Restart your server** to load the new configuration
2. **Check server logs** for:
   ```
   ✅ Email service initialized with SMTP provider (smtp.office365.com:587) - Microsoft 365
   SMTP connection verified successfully
   ```

3. **Test email sending** by:
   - Registering a new user (should send verification email)
   - Requesting password reset (should send reset email)
   - Or use the test endpoint (if available)

## Step 6: Verify Email Delivery

1. Check the recipient's inbox (and spam folder)
2. Verify the "From" address shows correctly
3. Check server logs for success messages:
   ```
   Email sent successfully via SMTP
   messageId: <message-id>
   ```

## Troubleshooting

### Issue: "SMTP connection verification failed"

**Solutions:**
1. Verify your credentials are correct
2. Check if the mailbox exists and is active
3. Ensure the account has a license (if required)
4. Try using an App Password instead of regular password
5. Check if your organization has SMTP restrictions

### Issue: "Authentication failed"

**Solutions:**
1. Use an App Password instead of regular password
2. Ensure Two-Factor Authentication is enabled (required for App Passwords)
3. Verify the email address is correct
4. Check if the account is locked or disabled

### Issue: "Connection timeout"

**Solutions:**
1. Check firewall settings - port 587 or 465 must be open
2. Verify SMTP_HOST is correct: `smtp.office365.com`
3. Try port 465 with `SMTP_SECURE=true` if 587 doesn't work
4. Check if your network blocks SMTP connections

### Issue: "TLS/SSL errors"

**Solutions:**
1. For development, set `SMTP_TLS_REJECT_UNAUTHORIZED=false` (not recommended for production)
2. For production, ensure certificates are valid
3. Try port 465 with SSL instead of 587 with STARTTLS

### Issue: Emails going to spam

**Solutions:**
1. Set up SPF record for your domain
2. Configure DKIM signing (if available)
3. Set up DMARC policy
4. Use a dedicated mailbox for sending (not a personal account)
5. Ensure `SMTP_FROM_EMAIL` matches your domain

## Security Best Practices

1. **Use App Passwords**: Never use your main account password
2. **Dedicated Service Account**: Create a separate mailbox for sending emails
3. **Limit Permissions**: The service account only needs to send emails
4. **Monitor Usage**: Regularly check sent emails for suspicious activity
5. **Rotate Passwords**: Change App Passwords periodically

## Email Provider Priority

The email service uses the following priority order:

1. **SMTP (Microsoft 365)** - Primary (if configured)
2. **Resend** - Fallback #1 (if configured)
3. **SendGrid** - Fallback #2 (if configured)
4. **Console** - Development fallback (always available)

If SMTP is configured, it will be used first. If it fails, the service will automatically try the next available provider.

## Testing

### Quick Test Script

Create a test file `test-smtp.ps1`:

```powershell
# Test Microsoft 365 SMTP Configuration
$env:SMTP_HOST = "smtp.office365.com"
$env:SMTP_PORT = "587"
$env:SMTP_SECURE = "false"
$env:SMTP_USER = "noreply@yourdomain.com"
$env:SMTP_PASSWORD = "your-app-password"
$env:SMTP_FROM_EMAIL = "noreply@yourdomain.com"
$env:SMTP_FROM_NAME = "RuR2 Platform"

# Restart server and check logs
Write-Host "Check server logs for: '✅ Email service initialized with SMTP provider'" -ForegroundColor Cyan
```

## Additional Resources

- [Microsoft 365 SMTP Settings](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b6-9504-8d30580daf9b)
- [Create App Passwords](https://support.microsoft.com/en-us/account-billing/using-app-passwords-in-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944)
- [Microsoft 365 SMTP Authentication](https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365)

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test SMTP connection using a mail client (Outlook, Thunderbird)
4. Contact your Microsoft 365 administrator if organizational policies are blocking SMTP






