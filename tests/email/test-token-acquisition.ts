/**
 * Test: Token Acquisition
 * 
 * Verifies MSAL can successfully acquire an access token using client credentials flow.
 */

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

