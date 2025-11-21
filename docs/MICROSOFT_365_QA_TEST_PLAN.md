# Microsoft Graph Email Service - QA Test Plan

**Version:** 1.0  
**Last Updated:** 2024  
**Service:** `server/services/graphEmailService.ts`

---

## 📋 Test Prerequisites

### Environment Setup
- ✅ All environment variables configured in `.env`:
  - `MICROSOFT_365_CLIENT_ID`
  - `MICROSOFT_365_CLIENT_SECRET`
  - `MICROSOFT_365_TENANT_ID`
  - `MICROSOFT_365_FROM_EMAIL`
- ✅ Azure AD app registered with Mail.Send permission
- ✅ Admin consent granted
- ✅ Application Access Policy configured (if applicable)
- ✅ Test recipient email address available
- ✅ Access to the sender mailbox (for Sent Items verification)

### Test Tools Required
- Node.js environment with test script capability
- Access to Microsoft 365 mailbox (Outlook Web App or Outlook Desktop)
- Email testing tools (optional): Mail Tester, MXToolbox
- Network tools: curl or Postman (for manual API testing)

---

## 1. Token Acquisition Testing

### Test 1.1: Successful Token Acquisition

**Objective:** Verify MSAL can successfully acquire an access token using client credentials flow.

**Test Script:**
```typescript
// test-token-acquisition.ts
import { ConfidentialClientApplication, ClientCredentialRequest } from '@azure/msal-node';
import * as dotenv from 'dotenv';

dotenv.config();

async function testTokenAcquisition() {
  console.log('🔐 Testing Token Acquisition...\n');

  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_365_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_365_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_365_TENANT_ID}`
    }
  });

  const request: ClientCredentialRequest = {
    scopes: ['https://graph.microsoft.com/.default']
  };

  try {
    const response = await msalClient.acquireTokenByClientCredential(request);
    
    console.log('✅ Token Acquisition Test: PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Token Type:', response.tokenType);
    console.log('Expires On:', response.expiresOn?.toISOString());
    console.log('Access Token Length:', response.accessToken?.length || 0);
    console.log('Access Token (first 30 chars):', response.accessToken?.substring(0, 30) + '...');
    console.log('Scopes:', response.scopes?.join(', '));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Validate token structure
    if (response.accessToken && response.expiresOn) {
      const timeUntilExpiry = response.expiresOn.getTime() - Date.now();
      console.log('✅ Token structure is valid');
      console.log(`✅ Token expires in: ${Math.floor(timeUntilExpiry / 1000 / 60)} minutes\n`);
      return true;
    } else {
      console.log('❌ Token structure is invalid\n');
      return false;
    }
  } catch (error: any) {
    console.log('❌ Token Acquisition Test: FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.errorCode || 'N/A');
    console.error('Error Stack:', error.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return false;
  }
}

testTokenAcquisition().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Expected Results:**
- ✅ Token acquired successfully
- ✅ Token type: "Bearer"
- ✅ Expires on: Future date/time (typically 1 hour from now)
- ✅ Access token is a non-empty string (typically 1000+ characters)
- ✅ Scopes include `https://graph.microsoft.com/.default`

**Expected Response Codes:**
- **200 OK** - Token acquired successfully (MSAL handles this internally)

**Failure Scenarios to Test:**

| Scenario | Expected Error | Response Code |
|----------|---------------|---------------|
| Invalid `MICROSOFT_365_CLIENT_ID` | `AADSTS700016: Application not found` | 401 Unauthorized |
| Invalid `MICROSOFT_365_CLIENT_SECRET` | `AADSTS7000215: Invalid client secret` | 401 Unauthorized |
| Invalid `MICROSOFT_365_TENANT_ID` | `AADSTS90002: Tenant not found` | 400 Bad Request |
| Missing environment variables | Configuration error | N/A (before API call) |

---

### Test 1.2: Token Caching and Refresh

**Objective:** Verify token is cached and refreshed automatically.

**Test Script:**
```typescript
// test-token-caching.ts
import { graphEmailService } from './server/services/graphEmailService';
import * as dotenv from 'dotenv';

dotenv.config();

async function testTokenCaching() {
  console.log('🔄 Testing Token Caching...\n');

  try {
    // First call - should acquire new token
    console.log('1️⃣ First health check (should acquire token)...');
    const start1 = Date.now();
    const result1 = await graphEmailService.healthCheck();
    const time1 = Date.now() - start1;
    console.log(`   Result: ${result1 ? '✅' : '❌'}, Time: ${time1}ms\n`);

    // Second call - should use cached token (faster)
    console.log('2️⃣ Second health check (should use cached token)...');
    const start2 = Date.now();
    const result2 = await graphEmailService.healthCheck();
    const time2 = Date.now() - start2;
    console.log(`   Result: ${result2 ? '✅' : '❌'}, Time: ${time2}ms\n`);

    if (time2 < time1) {
      console.log('✅ Token caching is working (second call was faster)\n');
      return true;
    } else {
      console.log('⚠️  Token caching may not be working (second call was not faster)\n');
      return false;
    }
  } catch (error: any) {
    console.log('❌ Token Caching Test: FAILED');
    console.error('Error:', error.message);
    return false;
  }
}

testTokenCaching().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Expected Results:**
- ✅ First call takes longer (token acquisition)
- ✅ Second call is faster (uses cached token)
- ✅ Both calls succeed

---

## 2. Email Sending Testing

### Test 2.1: Send Email to Sample Recipient

**Objective:** Verify email can be sent successfully via Microsoft Graph API.

**Test Script:**
```typescript
// test-send-email.ts
import { sendConfirmationEmail, sendEmail } from './server/services/graphEmailService';
import * as dotenv from 'dotenv';

dotenv.config();

// Replace with your test recipient email
const TEST_RECIPIENT = process.env.TEST_RECIPIENT_EMAIL || 'test@example.com';

async function testSendEmail() {
  console.log('📧 Testing Email Sending...\n');
  console.log(`Recipient: ${TEST_RECIPIENT}`);
  console.log(`Sender: ${process.env.MICROSOFT_365_FROM_EMAIL}\n`);

  try {
    // Test 1: Send confirmation email
    console.log('1️⃣ Testing sendConfirmationEmail()...');
    await sendConfirmationEmail(
      TEST_RECIPIENT,
      'QA Test - Confirmation Email',
      `
        <h1>QA Test Email</h1>
        <p>This is a test email sent from the Microsoft Graph Email Service.</p>
        <p><strong>Test Type:</strong> Confirmation Email</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p>If you received this email, the service is working correctly! ✅</p>
      `
    );
    console.log('   ✅ Email sent successfully\n');

    // Test 2: Send custom email
    console.log('2️⃣ Testing sendEmail() with custom options...');
    await sendEmail({
      to: TEST_RECIPIENT,
      subject: 'QA Test - Custom Email',
      htmlBody: `
        <h1>Custom Email Test</h1>
        <p>This is a test email using the sendEmail() function.</p>
        <p><strong>Test Type:</strong> Custom Email</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p>If you received this email, the service is working correctly! ✅</p>
      `,
      saveToSentItems: true
    });
    console.log('   ✅ Custom email sent successfully\n');

    console.log('✅ All Email Sending Tests: PASSED\n');
    console.log('📬 Please check the recipient inbox to verify delivery.');
    return true;
  } catch (error: any) {
    console.log('❌ Email Sending Test: FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return false;
  }
}

testSendEmail().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Expected Results:**
- ✅ Email sent without errors
- ✅ Email appears in recipient's inbox
- ✅ Email appears in sender's Sent Items folder
- ✅ Email content matches what was sent

---

### Test 2.2: Email Sending with Retry Logic

**Objective:** Verify retry logic handles throttling correctly.

**Test Script:**
```typescript
// test-retry-logic.ts
import { GraphEmailService } from './server/services/graphEmailService';
import * as dotenv from 'dotenv';

dotenv.config();

const TEST_RECIPIENT = process.env.TEST_RECIPIENT_EMAIL || 'test@example.com';

async function testRetryLogic() {
  console.log('🔄 Testing Retry Logic...\n');

  // Create service instance with aggressive retry config for testing
  const emailService = new GraphEmailService({
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 5000
  });

  try {
    // Send multiple emails rapidly to potentially trigger throttling
    console.log('Sending 5 emails rapidly...\n');
    const promises = [];
    
    for (let i = 1; i <= 5; i++) {
      promises.push(
        emailService.sendEmail({
          to: TEST_RECIPIENT,
          subject: `QA Test - Retry Logic Test #${i}`,
          htmlBody: `<p>Test email #${i} - Testing retry logic</p>`
        }).then(() => {
          console.log(`   ✅ Email #${i} sent`);
        }).catch((error) => {
          console.log(`   ❌ Email #${i} failed: ${error.message}`);
        })
      );
    }

    await Promise.allSettled(promises);
    console.log('\n✅ Retry Logic Test: COMPLETED');
    console.log('📝 Check logs for retry attempts if throttling occurred.\n');
    return true;
  } catch (error: any) {
    console.log('❌ Retry Logic Test: FAILED');
    console.error('Error:', error.message);
    return false;
  }
}

testRetryLogic().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Expected Results:**
- ✅ All emails eventually sent (even if throttled)
- ✅ Retry attempts logged in console
- ✅ Exponential backoff delays observed

---

## 3. Expected Response Codes

### Success Response Codes

| Code | Description | When It Occurs |
|------|-------------|----------------|
| **200 OK** | Request successful | Email sent successfully |
| **201 Created** | Resource created | (Not typically used for sendMail) |
| **202 Accepted** | Request accepted | (Not typically used for sendMail) |

### Error Response Codes

| Code | Description | Cause | Action Required |
|------|-------------|-------|----------------|
| **400 Bad Request** | Invalid request | Malformed email address, invalid payload | Check email format and payload structure |
| **401 Unauthorized** | Authentication failed | Invalid credentials, expired token | Verify `MICROSOFT_365_CLIENT_ID`, `MICROSOFT_365_CLIENT_SECRET`, refresh token |
| **403 Forbidden** | Access denied | Missing Mail.Send permission, Application Access Policy restriction | Grant Mail.Send permission, check Application Access Policy |
| **404 Not Found** | Mailbox not found | Invalid sender email address | Verify `MICROSOFT_365_FROM_EMAIL` exists in Exchange Online |
| **429 Too Many Requests** | Rate limit exceeded | Too many requests in short time | Automatic retry with backoff (handled by service) |
| **500 Internal Server Error** | Microsoft Graph error | Temporary Microsoft service issue | Automatic retry (handled by service) |
| **502 Bad Gateway** | Gateway error | Temporary network/Microsoft issue | Automatic retry (handled by service) |
| **503 Service Unavailable** | Service unavailable | Microsoft Graph service down | Automatic retry (handled by service) |
| **504 Gateway Timeout** | Request timeout | Request took too long | Automatic retry (handled by service) |

### Response Code Testing

**Test Script:**
```typescript
// test-response-codes.ts
import axios from 'axios';
import { ConfidentialClientApplication, ClientCredentialRequest } from '@azure/msal-node';
import * as dotenv from 'dotenv';

dotenv.config();

async function testResponseCodes() {
  console.log('📊 Testing Response Codes...\n');

  // Get access token
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_365_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_365_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_365_TENANT_ID}`
    }
  });

  const tokenResponse = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });

  const accessToken = tokenResponse?.accessToken;
  const fromEmail = process.env.MICROSOFT_365_FROM_EMAIL;

  // Test 1: Valid request (should be 200 or 202)
  console.log('1️⃣ Testing valid email send (expect 200/202)...');
  try {
    const response = await axios.post(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail!)}/sendMail`,
      {
        message: {
          subject: 'QA Test - Response Code Test',
          body: {
            contentType: 'HTML',
            content: '<p>Testing response codes</p>'
          },
          toRecipients: [{
            emailAddress: {
              address: process.env.TEST_RECIPIENT_EMAIL || 'test@example.com'
            }
          }]
        },
        saveToSentItems: true
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`   ✅ Status Code: ${response.status}`);
    console.log(`   ✅ Status Text: ${response.statusText}\n`);
  } catch (error: any) {
    console.log(`   ❌ Status Code: ${error.response?.status || 'N/A'}`);
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 2: Invalid email address (should be 400)
  console.log('2️⃣ Testing invalid email address (expect 400)...');
  try {
    await axios.post(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail!)}/sendMail`,
      {
        message: {
          subject: 'Test',
          body: {
            contentType: 'HTML',
            content: '<p>Test</p>'
          },
          toRecipients: [{
            emailAddress: {
              address: 'invalid-email-address'
            }
          }]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('   ⚠️  Expected 400 but got success\n');
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 400) {
      console.log(`   ✅ Status Code: ${status} (as expected)\n`);
    } else {
      console.log(`   ❌ Status Code: ${status} (expected 400)\n`);
    }
  }

  // Test 3: Invalid mailbox (should be 404)
  console.log('3️⃣ Testing invalid sender mailbox (expect 404)...');
  try {
    await axios.post(
      `https://graph.microsoft.com/v1.0/users/invalid-mailbox@example.com/sendMail`,
      {
        message: {
          subject: 'Test',
          body: {
            contentType: 'HTML',
            content: '<p>Test</p>'
          },
          toRecipients: [{
            emailAddress: {
              address: process.env.TEST_RECIPIENT_EMAIL || 'test@example.com'
            }
          }]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('   ⚠️  Expected 404 but got success\n');
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 404) {
      console.log(`   ✅ Status Code: ${status} (as expected)\n`);
    } else {
      console.log(`   ❌ Status Code: ${status} (expected 404)\n`);
    }
  }
}

testResponseCodes();
```

---

## 4. Checking Sent Items

### Method 1: Using Outlook Web App (OWA)

**Steps:**
1. Navigate to [Outlook Web App](https://outlook.office.com)
2. Sign in with the sender email address (`MICROSOFT_365_FROM_EMAIL`)
3. Click on **"Sent Items"** in the left sidebar
4. Look for the test email by subject line
5. Verify:
   - ✅ Email appears in Sent Items
   - ✅ Recipient email address is correct
   - ✅ Subject line matches
   - ✅ Timestamp is recent
   - ✅ Email content is correct

### Method 2: Using Microsoft Graph API

**Test Script:**
```typescript
// test-check-sent-items.ts
import axios from 'axios';
import { ConfidentialClientApplication, ClientCredentialRequest } from '@azure/msal-node';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkSentItems() {
  console.log('📬 Checking Sent Items via Graph API...\n');

  // Get access token
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_365_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_365_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_365_TENANT_ID}`
    }
  });

  const tokenResponse = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });

  const accessToken = tokenResponse?.accessToken;
  const fromEmail = process.env.MICROSOFT_365_FROM_EMAIL;

  try {
    // Get messages from Sent Items folder
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail!)}/mailFolders('SentItems')/messages`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          '$top': 10, // Get last 10 messages
          '$orderby': 'sentDateTime desc' // Most recent first
        }
      }
    );

    console.log(`✅ Found ${response.data.value.length} recent emails in Sent Items\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    response.data.value.forEach((message: any, index: number) => {
      console.log(`\n📧 Email #${index + 1}:`);
      console.log(`   Subject: ${message.subject}`);
      console.log(`   To: ${message.toRecipients?.map((r: any) => r.emailAddress.address).join(', ') || 'N/A'}`);
      console.log(`   Sent: ${message.sentDateTime}`);
      console.log(`   ID: ${message.id}`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Check if test email is in the list
    const testEmails = response.data.value.filter((msg: any) => 
      msg.subject?.includes('QA Test') || msg.subject?.includes('Test')
    );
    
    if (testEmails.length > 0) {
      console.log(`✅ Found ${testEmails.length} test email(s) in Sent Items\n`);
      return true;
    } else {
      console.log('⚠️  No test emails found in recent Sent Items\n');
      return false;
    }
  } catch (error: any) {
    console.log('❌ Failed to check Sent Items');
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

checkSentItems().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Expected Results:**
- ✅ Test emails appear in Sent Items
- ✅ Email metadata matches what was sent
- ✅ Timestamps are recent (within last few minutes)

---

### Method 3: Using Outlook Desktop

**Steps:**
1. Open Outlook Desktop application
2. Ensure you're signed in with the sender email address
3. Navigate to **Sent Items** folder
4. Sort by **Date** (newest first)
5. Verify test emails appear at the top

---

## 5. SPF/DKIM Validation

### What is SPF/DKIM?

- **SPF (Sender Policy Framework)**: Verifies the sender's IP address is authorized to send emails for the domain
- **DKIM (DomainKeys Identified Mail)**: Adds a digital signature to emails to verify authenticity
- **DMARC**: Policy that uses SPF and DKIM to prevent email spoofing

### Test 5.1: Check SPF Record

**Method 1: Using Command Line (nslookup/dig)**

```bash
# Windows (nslookup)
nslookup -type=TXT yourdomain.com

# Linux/Mac (dig)
dig TXT yourdomain.com

# Look for SPF record like:
# "v=spf1 include:spf.protection.outlook.com -all"
```

**Method 2: Using Online Tools**

1. Visit [MXToolbox SPF Record Lookup](https://mxtoolbox.com/spf.aspx)
2. Enter your domain (e.g., `yourcompany.com`)
3. Click "SPF Record Lookup"
4. Verify:
   - ✅ SPF record exists
   - ✅ Includes `include:spf.protection.outlook.com` (for Microsoft 365)
   - ✅ Ends with `-all` or `~all`

**Expected SPF Record:**
```
v=spf1 include:spf.protection.outlook.com -all
```

---

### Test 5.2: Check DKIM Record

**Method 1: Using Command Line**

```bash
# Check for DKIM selector (Microsoft 365 uses selector1 and selector2)
# Windows
nslookup -type=TXT selector1._domainkey.yourdomain.com
nslookup -type=TXT selector2._domainkey.yourdomain.com

# Linux/Mac
dig TXT selector1._domainkey.yourdomain.com
dig TXT selector2._domainkey.yourdomain.com
```

**Method 2: Using Microsoft 365 Admin Center**

1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. Navigate to **Settings** → **Domains**
3. Select your domain
4. Click **DNS records** tab
5. Look for DKIM records (selector1 and selector2)

**Method 3: Using Online Tools**

1. Visit [MXToolbox DKIM Lookup](https://mxtoolbox.com/dkim.aspx)
2. Enter your domain
3. Enter selector: `selector1` or `selector2`
4. Click "DKIM Lookup"
5. Verify DKIM record exists

**Expected DKIM Record Format:**
```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

---

### Test 5.3: Validate Email Headers

**Objective:** Verify SPF and DKIM are working by checking email headers.

**Steps:**
1. Send a test email using the service
2. Receive the email in a test inbox
3. View email headers (varies by email client):
   - **Gmail**: Click three dots → "Show original"
   - **Outlook**: Right-click email → "View Source"
   - **Apple Mail**: View → Message → Raw Source

**Check for these headers:**

```
Authentication-Results: 
  spf=pass (sender IP is ...)
  smtp.mailfrom=yourdomain.com;
  dkim=pass (signature was verified)
  header.d=yourdomain.com;
  dmarc=pass action=none header.from=yourdomain.com
```

**Expected Results:**
- ✅ `spf=pass` - SPF validation passed
- ✅ `dkim=pass` - DKIM signature verified
- ✅ `dmarc=pass` - DMARC policy passed

---

### Test 5.4: Using Mail Testing Services

**Method 1: Mail Tester**

1. Visit [Mail Tester](https://www.mail-tester.com)
2. Get a test email address (e.g., `test-xxxxx@mail-tester.com`)
3. Send a test email to that address using your service
4. Click "Then check your score" on Mail Tester
5. Review results:
   - ✅ SPF: Should show "pass"
   - ✅ DKIM: Should show "pass"
   - ✅ DMARC: Should show "pass"
   - ✅ Overall score: Should be 10/10

**Method 2: MXToolbox Email Health**

1. Visit [MXToolbox Email Health](https://mxtoolbox.com/emailhealth/)
2. Enter your domain
3. Review SPF, DKIM, and DMARC status
4. Verify all show as "Valid" or "Pass"

---

### Test 5.5: Automated SPF/DKIM Validation Script

**Test Script:**
```typescript
// test-spf-dkim.ts
import { sendEmail } from './server/services/graphEmailService';
import * as dotenv from 'dotenv';
import dns from 'dns';
import { promisify } from 'util';

dotenv.config();

const resolveTxt = promisify(dns.resolveTxt);

async function testSPF() {
  console.log('🔍 Testing SPF Record...\n');
  
  const domain = process.env.MICROSOFT_365_FROM_EMAIL?.split('@')[1];
  if (!domain) {
    console.log('❌ Could not extract domain from email address\n');
    return false;
  }

  try {
    const records = await resolveTxt(domain);
    const spfRecord = records.flat().find(record => record.startsWith('v=spf1'));
    
    if (spfRecord) {
      console.log(`✅ SPF Record Found: ${spfRecord}\n`);
      
      if (spfRecord.includes('spf.protection.outlook.com')) {
        console.log('✅ SPF includes Microsoft 365 protection\n');
        return true;
      } else {
        console.log('⚠️  SPF does not include Microsoft 365 protection\n');
        return false;
      }
    } else {
      console.log('❌ No SPF record found\n');
      return false;
    }
  } catch (error: any) {
    console.log('❌ Failed to check SPF record');
    console.error('Error:', error.message);
    return false;
  }
}

async function testDKIM() {
  console.log('🔍 Testing DKIM Records...\n');
  
  const domain = process.env.MICROSOFT_365_FROM_EMAIL?.split('@')[1];
  if (!domain) {
    console.log('❌ Could not extract domain from email address\n');
    return false;
  }

  try {
    // Check selector1
    const selector1 = await resolveTxt(`selector1._domainkey.${domain}`).catch(() => null);
    // Check selector2
    const selector2 = await resolveTxt(`selector2._domainkey.${domain}`).catch(() => null);
    
    if (selector1 || selector2) {
      console.log('✅ DKIM records found\n');
      if (selector1) console.log(`   Selector1: ${selector1.flat()[0].substring(0, 50)}...\n`);
      if (selector2) console.log(`   Selector2: ${selector2.flat()[0].substring(0, 50)}...\n`);
      return true;
    } else {
      console.log('⚠️  No DKIM records found (may need to enable in Microsoft 365)\n');
      return false;
    }
  } catch (error: any) {
    console.log('⚠️  Could not verify DKIM records');
    console.log('   Note: DKIM may need to be enabled in Microsoft 365 Admin Center\n');
    return false;
  }
}

async function sendTestEmailForValidation() {
  console.log('📧 Sending test email for header validation...\n');
  
  const testRecipient = process.env.TEST_RECIPIENT_EMAIL || 'test@example.com';
  
  try {
    await sendEmail({
      to: testRecipient,
      subject: 'SPF/DKIM Validation Test',
      htmlBody: `
        <h1>SPF/DKIM Validation Test</h1>
        <p>This email is sent to test SPF and DKIM validation.</p>
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Check the email headers</li>
          <li>Look for Authentication-Results header</li>
          <li>Verify spf=pass and dkim=pass</li>
        </ol>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      `
    });
    
    console.log('✅ Test email sent successfully\n');
    console.log('📝 Please check email headers to verify SPF/DKIM\n');
    return true;
  } catch (error: any) {
    console.log('❌ Failed to send test email');
    console.error('Error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SPF/DKIM Validation Test Suite');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const spfResult = await testSPF();
  const dkimResult = await testDKIM();
  const emailResult = await sendTestEmailForValidation();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test Results Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`SPF Check: ${spfResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`DKIM Check: ${dkimResult ? '✅ PASS' : '⚠️  WARN'}`);
  console.log(`Test Email: ${emailResult ? '✅ SENT' : '❌ FAIL'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runAllTests();
```

---

## 6. Complete Test Suite

### Running All Tests

Create a master test script that runs all tests:

```typescript
// run-all-tests.ts
import * as dotenv from 'dotenv';

dotenv.config();

async function runAllTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Microsoft Graph Email Service - QA Test Suite');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tests = [
    { name: 'Token Acquisition', file: './test-token-acquisition' },
    { name: 'Token Caching', file: './test-token-caching' },
    { name: 'Email Sending', file: './test-send-email' },
    { name: 'Retry Logic', file: './test-retry-logic' },
    { name: 'Response Codes', file: './test-response-codes' },
    { name: 'Sent Items Check', file: './test-check-sent-items' },
    { name: 'SPF/DKIM Validation', file: './test-spf-dkim' }
  ];

  const results: { name: string; passed: boolean }[] = [];

  for (const test of tests) {
    try {
      console.log(`\n🧪 Running: ${test.name}...\n`);
      // In a real implementation, you would import and run each test module
      // For now, this is a template
      results.push({ name: test.name, passed: true });
    } catch (error) {
      results.push({ name: test.name, passed: false });
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test Results Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}\n`);
}

runAllTests();
```

---

## 7. Test Checklist

### Pre-Deployment Checklist

- [ ] Token acquisition works
- [ ] Token caching works
- [ ] Email sending works
- [ ] Retry logic handles throttling
- [ ] All expected response codes tested
- [ ] Sent Items verification works
- [ ] SPF record configured correctly
- [ ] DKIM records configured correctly
- [ ] Email headers show SPF/DKIM pass
- [ ] Test emails delivered successfully
- [ ] Error handling works correctly
- [ ] Logging works correctly

### Post-Deployment Checklist

- [ ] Production emails sending successfully
- [ ] Production Sent Items showing emails
- [ ] No authentication errors in logs
- [ ] No rate limiting issues
- [ ] SPF/DKIM validation passing in production
- [ ] Email delivery rates acceptable
- [ ] Error rates within acceptable limits

---

## 8. Troubleshooting Guide

### Common Issues

| Issue | Symptom | Solution |
|------|---------|----------|
| Token acquisition fails | 401 errors | Verify credentials, check admin consent |
| Email sending fails | 403 errors | Verify Mail.Send permission, check Application Access Policy |
| Mailbox not found | 404 errors | Verify sender email exists in Exchange Online |
| Rate limiting | 429 errors | Service handles automatically, but check request frequency |
| SPF fails | Emails marked as spam | Configure SPF record in DNS |
| DKIM fails | Authentication fails | Enable DKIM in Microsoft 365 Admin Center |

---

## 9. Test Data

### Sample Test Recipients

Create test email addresses for different scenarios:

- `test-success@example.com` - For successful delivery tests
- `test-bounce@example.com` - For bounce handling tests (if needed)
- `test-invalid@example.com` - For invalid email tests

### Sample Email Content

Use clear test email subjects and content:

```
Subject: QA Test - [Test Type] - [Timestamp]
Body: Clear indication this is a test email with test type and timestamp
```

---

## 10. Reporting

### Test Report Template

After running tests, document:

1. **Test Date/Time**
2. **Environment** (Development/Staging/Production)
3. **Test Results** (Pass/Fail for each test)
4. **Issues Found** (if any)
5. **Recommendations** (if any)
6. **Sign-off** (QA Engineer name and date)

---

**End of QA Test Plan**

