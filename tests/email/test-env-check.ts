/**
 * Test: Environment Variables Check
 * 
 * Verifies all required environment variables are set.
 */

import * as dotenv from 'dotenv';

dotenv.config();

function checkEnvironmentVariables() {
  console.log('🔍 Checking Environment Variables...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const requiredVars = [
    'MICROSOFT_365_CLIENT_ID',
    'MICROSOFT_365_CLIENT_SECRET',
    'MICROSOFT_365_TENANT_ID',
    'MICROSOFT_365_FROM_EMAIL'
  ];

  const optionalVars = [
    'TEST_RECIPIENT_EMAIL'
  ];

  let allPresent = true;
  const missing: string[] = [];
  const present: string[] = [];

  console.log('\n📋 Required Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value && value.trim() !== '' && !value.includes('your-') && !value.includes('here')) {
      console.log(`   ✅ ${varName}: Set (${value.length} characters)`);
      present.push(varName);
    } else {
      console.log(`   ❌ ${varName}: Missing or not configured`);
      missing.push(varName);
      allPresent = false;
    }
  });

  console.log('\n📋 Optional Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value && value.trim() !== '') {
      console.log(`   ✅ ${varName}: Set`);
    } else {
      console.log(`   ⚠️  ${varName}: Not set (using default: test@example.com)`);
    }
  });

  // Check for alternative variable names
  console.log('\n📋 Alternative Variable Names (if using template):');
  const altVars = {
    'AZ_TENANT_ID': 'MICROSOFT_365_TENANT_ID',
    'AZ_CLIENT_ID': 'MICROSOFT_365_CLIENT_ID',
    'AZ_CLIENT_SECRET': 'MICROSOFT_365_CLIENT_SECRET',
    'MAIL_SENDER': 'MICROSOFT_365_FROM_EMAIL'
  };

  Object.entries(altVars).forEach(([altName, expectedName]) => {
    const altValue = process.env[altName];
    if (altValue && altValue.trim() !== '' && !altValue.includes('your-') && !altValue.includes('here')) {
      console.log(`   ⚠️  Found ${altName} but code expects ${expectedName}`);
      console.log(`      Please rename ${altName} to ${expectedName} in .env file`);
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (allPresent) {
    console.log('✅ All required environment variables are set!\n');
    console.log('📝 Next steps:');
    console.log('   1. Run: npx tsx tests/email/test-token-acquisition.ts');
    console.log('   2. Run: npx tsx tests/email/test-send-email.ts\n');
    return true;
  } else {
    console.log('❌ Missing required environment variables!\n');
    console.log('📝 To fix this:');
    console.log('   1. Open your .env file');
    console.log('   2. Add the following variables with your actual values:');
    missing.forEach(varName => {
      console.log(`      ${varName}=your-actual-value-here`);
    });
    console.log('\n   See docs/MICROSOFT_365_EMAIL_SETUP.md for instructions on obtaining these values.\n');
    return false;
  }
}

const result = checkEnvironmentVariables();
process.exit(result ? 0 : 1);

