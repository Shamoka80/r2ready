# Microsoft 365 Email Integration - Admin Setup Instructions

**For Azure Tenant Administrators**

This guide provides step-by-step instructions for setting up Microsoft 365 email sending via Microsoft Graph API using app-only authentication. Follow these instructions to configure the Azure AD application and provide the necessary credentials to the development team.

---

## 📋 Prerequisites

- **Azure AD Global Administrator** or **Application Administrator** role
- Access to Microsoft 365 Admin Center
- PowerShell with Exchange Online Management module (for Application Access Policy)
- The email address of the mailbox that will be used for sending emails (e.g., `noreply@yourcompany.com`)

---

## 🎯 Overview

You will complete the following steps:

1. ✅ Register an Azure AD Application
2. ✅ Create a Client Secret
3. ✅ Add Microsoft Graph API Permission (Mail.Send)
4. ✅ Grant Admin Consent
5. ✅ Create Application Access Policy (to restrict mailbox access)
6. ✅ Provide credentials to the development team

---

## Step 1: Register Azure AD Application

### Option A: Using Azure Portal (Recommended)

1. **Navigate to Azure Portal**
   - Go to [https://portal.azure.com](https://portal.azure.com)
   - Sign in with your Azure AD Global Administrator account

2. **Open Azure Active Directory**
   - Click on **"Azure Active Directory"** in the left sidebar
   - Or search for "Azure Active Directory" in the top search bar

3. **Go to App Registrations**
   - In the left menu, click on **"App registrations"**
   - Click **"+ New registration"** button at the top

4. **Register the Application**
   - **Name**: Enter a descriptive name (e.g., `RUR2 Email Service` or `Company Email Sender`)
   - **Supported account types**: Select **"Accounts in this organizational directory only"**
   - **Redirect URI**: Leave blank (not needed for app-only authentication)
   - Click **"Register"**

5. **Note the Application (Client) ID**
   - After registration, you'll be on the **Overview** page
   - **Copy the "Application (client) ID"** - you'll need this later
   - Also note the **"Directory (tenant) ID"** - you'll need this too

### Option B: Using PowerShell

```powershell
# Connect to Azure AD
Connect-AzureAD

# Register the application
$app = New-AzureADApplication -DisplayName "RUR2 Email Service" `
    -AvailableToOtherTenants $false `
    -Oauth2AllowImplicitFlow $false

# Get the Application ID and Tenant ID
Write-Host "Application (Client) ID: $($app.AppId)"
Write-Host "Directory (Tenant) ID: $(Get-AzureADTenantDetail).ObjectId"
```

**Save these values:**
- Application (Client) ID: `_________________`
- Directory (Tenant) ID: `_________________`

---

## Step 2: Create Client Secret

### Option A: Using Azure Portal

1. **Navigate to Certificates & secrets**
   - In your registered app, click **"Certificates & secrets"** in the left menu
   - Click **"+ New client secret"**

2. **Create the Secret**
   - **Description**: Enter a description (e.g., `Email Service Secret - Production`)
   - **Expires**: Select expiration period (recommended: **24 months** or **Never** for production)
   - Click **"Add"**

3. **⚠️ IMPORTANT: Copy the Secret Value Immediately**
   - The secret value will be displayed **only once**
   - **Copy and save it securely** - you cannot retrieve it later
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` or similar

### Option B: Using PowerShell

```powershell
# Connect to Azure AD (if not already connected)
Connect-AzureAD

# Get your application
$app = Get-AzureADApplication -Filter "DisplayName eq 'RUR2 Email Service'"

# Create a client secret (valid for 24 months)
$startDate = Get-Date
$endDate = $startDate.AddMonths(24)
$secret = New-AzureADApplicationPasswordCredential -ObjectId $app.ObjectId `
    -StartDate $startDate `
    -EndDate $endDate `
    -CustomKeyIdentifier "EmailServiceSecret"

# Display the secret (save this immediately!)
Write-Host "Secret Value: $($secret.Value)"
Write-Host "Secret ID: $($secret.KeyId)"
```

**Save this value:**
- Client Secret Value: `_________________`

---

## Step 3: Add Microsoft Graph API Permission

### Option A: Using Azure Portal

1. **Navigate to API permissions**
   - In your registered app, click **"API permissions"** in the left menu
   - Click **"+ Add a permission"**

2. **Select Microsoft Graph**
   - Choose **"Microsoft Graph"**
   - Select **"Application permissions"** (not Delegated permissions)

3. **Add Mail.Send Permission**
   - In the search box, type: `Mail.Send`
   - Check the box next to **"Mail.Send"**
   - Click **"Add permissions"**

4. **Verify the Permission**
   - You should see **"Mail.Send"** listed under **"Application permissions"**
   - Status will show as **"Not granted for [Your Tenant]"** (we'll fix this in Step 4)

### Option B: Using PowerShell

```powershell
# Connect to Azure AD (if not already connected)
Connect-AzureAD

# Get your application
$app = Get-AzureADApplication -Filter "DisplayName eq 'RUR2 Email Service'"

# Get Microsoft Graph Service Principal
$graphSP = Get-AzureADServicePrincipal -Filter "AppId eq '00000003-0000-0000-c000-000000000000'"

# Get the Mail.Send Application Permission
$mailSendPermission = $graphSP.AppRoles | Where-Object { $_.Value -eq "Mail.Send" }

# Add the permission to your app
New-AzureADApplicationAppRoleAssignment -ObjectId $app.ObjectId `
    -PrincipalId $app.ObjectId `
    -ResourceId $graphSP.ObjectId `
    -Id $mailSendPermission.Id
```

---

## Step 4: Grant Admin Consent

### Option A: Using Azure Portal

1. **Grant Admin Consent**
   - Still on the **"API permissions"** page
   - Click **"Grant admin consent for [Your Tenant Name]"**
   - Click **"Yes"** to confirm

2. **Verify Consent**
   - The status should change to **"✓ Granted for [Your Tenant Name]"**
   - All permissions should show a green checkmark

### Option B: Using PowerShell

```powershell
# Connect to Azure AD (if not already connected)
Connect-AzureAD

# Get your application
$app = Get-AzureADApplication -Filter "DisplayName eq 'RUR2 Email Service'"

# Get Microsoft Graph Service Principal
$graphSP = Get-AzureADServicePrincipal -Filter "AppId eq '00000003-0000-0000-c000-000000000000'"

# Grant admin consent
$mailSendPermission = $graphSP.AppRoles | Where-Object { $_.Value -eq "Mail.Send" }
$appRoleAssignment = @{
    Id = $mailSendPermission.Id
    PrincipalId = $app.ObjectId
    ResourceId = $graphSP.ObjectId
}

New-AzureADServiceAppRoleAssignment -ObjectId $graphSP.ObjectId `
    -PrincipalId $app.ObjectId `
    -ResourceId $graphSP.ObjectId `
    -Id $mailSendPermission.Id
```

**Note:** The PowerShell method above may require additional steps. The Azure Portal method is recommended.

---

## Step 5: Create Application Access Policy (Restrict Mailbox Access)

This step restricts the application to send emails **only** from a specific mailbox. This is a security best practice.

### Prerequisites for PowerShell

```powershell
# Install Exchange Online Management module (if not already installed)
Install-Module -Name ExchangeOnlineManagement -Force -AllowClobber

# Connect to Exchange Online
Connect-ExchangeOnline
```

### Create the Application Access Policy

**Replace `noreply@yourcompany.com` with the actual mailbox email address:**

```powershell
# Connect to Exchange Online (if not already connected)
Connect-ExchangeOnline

# Get your application's Object ID
Connect-AzureAD
$app = Get-AzureADApplication -Filter "DisplayName eq 'RUR2 Email Service'"
$appObjectId = $app.ObjectId

# Disconnect from Azure AD (we need Exchange Online now)
Disconnect-AzureAD

# Create the Application Access Policy
# Replace 'noreply@yourcompany.com' with your actual mailbox
New-ApplicationAccessPolicy -AppId $appObjectId `
    -PolicyScopeGroupId "noreply@yourcompany.com" `
    -AccessRight RestrictAccess `
    -Description "Restrict RUR2 Email Service to send only from noreply@yourcompany.com"

# Verify the policy was created
Get-ApplicationAccessPolicy | Where-Object { $_.AppId -eq $appObjectId }
```

### Alternative: Using Azure Portal (Limited)

The Application Access Policy **must** be created via PowerShell/Exchange Online Management. The Azure Portal does not provide this functionality.

**Important Notes:**
- The mailbox specified in `PolicyScopeGroupId` must exist in your Exchange Online
- The application will **only** be able to send emails from this mailbox
- You can specify multiple mailboxes by creating multiple policies or using a distribution group

---

## Step 6: Verify Mailbox Permissions

Ensure the mailbox you're using has the necessary permissions:

1. **Check Mailbox Exists**
   - Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
   - Navigate to **Users** → **Active users**
   - Verify the mailbox exists (e.g., `noreply@yourcompany.com`)

2. **Verify Mailbox is Enabled**
   - The mailbox should be active and have an Exchange Online license

---

## Step 7: Provide Credentials to Development Team

After completing all steps above, provide the following information to the development team:

### Information to Send:

```
✅ APPLICATION SETUP COMPLETE

Application Name: [Your App Name]
Application (Client) ID: [Paste Client ID here]
Directory (Tenant) ID: [Paste Tenant ID here]
Client Secret Value: [Paste Secret Value here]
Client Secret Expires: [Date of expiration]

Mailbox Email: [e.g., noreply@yourcompany.com]
Application Access Policy: [Created / Not Created]

Additional Notes:
[Any relevant notes or restrictions]
```

### Example:

```
✅ APPLICATION SETUP COMPLETE

Application Name: RUR2 Email Service
Application (Client) ID: 12345678-1234-1234-1234-123456789012
Directory (Tenant) ID: 87654321-4321-4321-4321-210987654321
Client Secret Value: abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz
Client Secret Expires: 2026-12-31

Mailbox Email: noreply@yourcompany.com
Application Access Policy: Created and verified

Additional Notes:
- Policy restricts sending to noreply@yourcompany.com only
- Secret expires in 24 months
```

---

## 🔒 Security Best Practices

1. **Store Secrets Securely**
   - Never share secrets via email or chat
   - Use secure password managers or encrypted channels
   - Rotate secrets before expiration

2. **Application Access Policy**
   - Always create an Application Access Policy to restrict mailbox access
   - This prevents the app from sending from unauthorized mailboxes

3. **Monitor Usage**
   - Regularly review application usage in Azure AD
   - Set up alerts for unusual activity

4. **Secret Rotation**
   - Create new secrets before old ones expire
   - Update the application configuration with new secrets
   - Delete old secrets after verification

---

## 🧪 Testing (Optional)

After providing credentials, you can test the setup:

```powershell
# Test Graph API connection (requires the credentials)
# This is typically done by the development team after integration
```

---

## ❓ Troubleshooting

### Issue: "Insufficient privileges to complete the operation"
- **Solution**: Ensure you have **Global Administrator** or **Application Administrator** role

### Issue: "Application Access Policy not working"
- **Solution**: Verify the mailbox email is correct and exists in Exchange Online
- Ensure you're connected to Exchange Online PowerShell, not Azure AD PowerShell

### Issue: "Mail.Send permission not appearing"
- **Solution**: Make sure you selected **"Application permissions"** (not Delegated)
- Refresh the page and check again

### Issue: "Admin consent button is grayed out"
- **Solution**: You need **Global Administrator** role to grant admin consent

---

## 📞 Support

If you encounter any issues during setup, please contact:
- **Development Team**: [Your contact information]
- **Microsoft Support**: [If applicable]

---

## ✅ Checklist

Before sending credentials to the development team, verify:

- [ ] Application registered in Azure AD
- [ ] Client Secret created and saved securely
- [ ] Mail.Send permission added (Application permission)
- [ ] Admin consent granted
- [ ] Application Access Policy created (if restricting mailbox)
- [ ] Mailbox exists and is active
- [ ] All credentials documented and ready to share securely

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Prepared for:** RUR2 Email Integration Project

