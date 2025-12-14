# SMTP Authentication Troubleshooting Guide

## Issue: "535 5.7.139 Authentication unsuccessful" with Correct Credentials

If your email and password are correct but SMTP authentication is still failing, here are the most common causes:

## Solution 1: Check if 2FA is Enabled

**If Two-Factor Authentication (2FA) is enabled, you MUST use an App Password, not your regular password.**

### How to Check:
1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. Navigate to **Users** → **Active users**
3. Find `no-reply@wrekdtech.com`
4. Check if **Multi-factor authentication** shows as **Enabled**

### If 2FA is Enabled:
1. Go to [Microsoft Account Security](https://account.microsoft.com/security)
2. Click **Advanced security options**
3. Under **App passwords**, click **Create a new app password**
4. Name it "RuR2 Email Service"
5. Copy the 16-character password
6. Update your `.env` file with this App Password

## Solution 2: Enable SMTP AUTH for Your Account

Microsoft 365 may have SMTP AUTH disabled by default for security.

### For Individual Account:
1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. Navigate to **Users** → **Active users**
3. Select `no-reply@wrekdtech.com`
4. Click **Mail** tab
5. Under **Email apps**, ensure **Authenticated SMTP** is enabled
6. If not available, you may need to enable it via PowerShell (see below)

### For Organization (Admin):
Run this PowerShell command in Exchange Online:

```powershell
Set-CASMailbox -Identity "no-reply@wrekdtech.com" -SmtpClientAuthenticationDisabled $false
```

## Solution 3: Check Account Security Settings

1. Go to [Microsoft 365 Security Center](https://security.microsoft.com)
2. Navigate to **Policies** → **Conditional Access**
3. Check if there are policies blocking SMTP authentication
4. You may need to create an exception for your application

## Solution 4: Verify Account Type

Some Microsoft 365 account types don't support SMTP:
- Personal Microsoft accounts (@outlook.com, @hotmail.com) - Limited SMTP support
- Business/Enterprise accounts - Full SMTP support

Make sure `no-reply@wrekdtech.com` is a Business or Enterprise account.

## Solution 5: Try Alternative Authentication

If basic authentication is blocked, you might need to use OAuth2. However, this requires more complex setup.

## Quick Test

After making changes, test your connection:

```bash
npx tsx server/scripts/test-smtp-connection.ts
```

## Common Error Codes

- **535 5.7.139** - Authentication failed (wrong password or 2FA required)
- **535 5.7.3** - SMTP AUTH disabled
- **550 5.7.606** - Access denied (organization policy)

## Still Not Working?

1. **Check Microsoft 365 Admin Center** for any security alerts
2. **Verify the account is active** and not locked
3. **Try logging into Outlook** with the same credentials to confirm they work
4. **Contact your Microsoft 365 administrator** if you don't have admin access






