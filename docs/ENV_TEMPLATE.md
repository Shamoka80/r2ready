# Environment Variables Template

Copy the content below to create your `.env` file:

```env
# Microsoft 365 / Azure AD Email Configuration
# Copy this file to .env and fill in your actual values

# Azure AD Tenant ID (Directory ID)
# Found in: Azure Portal → App Registrations → Your App → Overview → Directory (tenant) ID
AZ_TENANT_ID=your-tenant-id-here

# Azure AD Application (Client) ID
# Found in: Azure Portal → App Registrations → Your App → Overview → Application (client) ID
AZ_CLIENT_ID=your-client-id-here

# Azure AD Client Secret
# Found in: Azure Portal → App Registrations → Your App → Certificates & secrets → Client secrets
# ⚠️ IMPORTANT: Keep this secret secure. Never commit to version control.
AZ_CLIENT_SECRET=your-client-secret-here

# Email address of the mailbox to send emails from
# This mailbox must exist in Exchange Online and be included in Application Access Policy
MAIL_SENDER=noreply@yourcompany.com

# ============================================
# Optional: Other Email Providers
# ============================================

# Resend API Key (if using Resend as primary email provider)
# RESEND_API_KEY=re_xxxxxxxxxxxxx
# RESEND_FROM_EMAIL=noreply@yourcompany.com

# SendGrid API Key (if using SendGrid as fallback)
# SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
# SENDGRID_FROM_EMAIL=noreply@yourcompany.com

# SMTP Configuration (if using SMTP as fallback)
# SMTP_HOST=smtp.office365.com
# SMTP_PORT=587
# SMTP_USER=your-email@yourcompany.com
# SMTP_PASSWORD=your-smtp-password
# SMTP_FROM_EMAIL=noreply@yourcompany.com
```

## Quick Setup

1. Copy the template above
2. Create a `.env` file in the project root
3. Paste the template and replace the placeholder values with your actual credentials
4. Ensure `.env` is in your `.gitignore` (it should be already)

## Getting Your Values

See `docs/MICROSOFT_365_EMAIL_SETUP.md` for detailed instructions on obtaining:
- `AZ_TENANT_ID`
- `AZ_CLIENT_ID`
- `AZ_CLIENT_SECRET`
- `MAIL_SENDER`

## Security Notes

⚠️ **Never commit your `.env` file to version control!**

The `.env` file is already in `.gitignore`, but always double-check before committing.

