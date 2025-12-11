/**
 * Test SMTP Connection Script
 * This script tests your SMTP credentials without sending an email
 * Usage: npx tsx server/scripts/test-smtp-connection.ts
 */

import "dotenv/config";
import nodemailer from 'nodemailer';

async function testSMTPConnection() {
  console.log('🔍 Testing SMTP Connection...\n');

  // Check required environment variables
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   Host: ${process.env.SMTP_HOST}`);
  console.log(`   Port: ${process.env.SMTP_PORT}`);
  console.log(`   User: ${process.env.SMTP_USER}`);
  console.log(`   From: ${process.env.SMTP_FROM_EMAIL}`);
  console.log(`   Password: ${'*'.repeat(process.env.SMTP_PASSWORD?.length || 0)} (${process.env.SMTP_PASSWORD?.length || 0} characters)`);
  console.log('');

  const smtpPort = parseInt(process.env.SMTP_PORT!);
  const isSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
  });

  try {
    console.log('🔄 Verifying connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');
    console.log('Your SMTP credentials are correct.');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ SMTP connection verification failed!\n');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);
    if (error.code) console.error(`   Code: ${error.code}`);
    if (error.response) console.error(`   Response: ${error.response}`);
    if (error.responseCode) console.error(`   Response Code: ${error.responseCode}`);
    
    console.error('\n💡 Troubleshooting Tips:');
    
    if (error.message.includes('Authentication') || error.message.includes('535')) {
      console.error('   1. Check if your password is correct');
      console.error('   2. If 2FA is enabled, you MUST use an App Password (not your regular password)');
      console.error('   3. Verify the email address matches the account');
      console.error('   4. Check if the account is locked or disabled');
      console.error('   5. Try generating a new App Password from Microsoft 365');
    } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      console.error('   1. Check if port 587 or 465 is open in your firewall');
      console.error('   2. Verify SMTP_HOST is correct');
      console.error('   3. Check your network connection');
    } else if (error.message.includes('TLS') || error.message.includes('SSL')) {
      console.error('   1. Try setting SMTP_TLS_REJECT_UNAUTHORIZED=false (development only)');
      console.error('   2. Try port 465 with SMTP_SECURE=true');
    }
    
    process.exit(1);
  }
}

testSMTPConnection();




