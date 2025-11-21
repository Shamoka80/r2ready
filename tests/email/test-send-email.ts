/**
 * Test: Email Sending
 * 
 * Verifies email can be sent successfully via Microsoft Graph API.
 */

import { sendConfirmationEmail, sendEmail } from '../../server/services/graphEmailService';
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

