/**
 * Test: Check Sent Items
 * 
 * Verifies emails appear in Sent Items folder via Microsoft Graph API.
 */

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

  if (!accessToken || !fromEmail) {
    console.log('❌ Missing access token or from email');
    return false;
  }

  try {
    // Get messages from Sent Items folder
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail)}/mailFolders('SentItems')/messages`,
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

