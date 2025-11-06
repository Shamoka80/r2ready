/**
 * E2E Test: User Journey 1 - Business Solo License with PDF Report Generation
 * 
 * Test User: shamoka@gmail.com
 * Password: Passw0rD80?
 * License: Solo Business ($399)
 * Goal: Generate a PDF report of the assessment
 * 
 * Journey Flow:
 * 1. Registration
 * 2. Email Verification (Manual: Click link or we extract token from DB)
 * 3. Account Type Selection (Business)
 * 4. Pricing Selection (Solo Business)
 * 5. Payment (Manual: Stripe checkout with test card)
 * 6. Business Onboarding (Company + Facility setup)
 * 7. Create Assessment
 * 8. Complete Intake Form
 * 9. Answer Assessment Questions
 * 10. Generate PDF Report (Download & Validate)
 */

import { test, expect, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const TEST_USER = {
  email: 'shamoka@gmail.com',
  password: 'Passw0rD80?',
  firstName: 'Shamoka',
  lastName: 'Williams',
  companyName: 'GreenTech Recycling Solutions'
};

const COMPANY_DATA = {
  legalName: 'GreenTech Recycling Solutions LLC',
  dbaName: 'GreenTech',
  entityType: 'LLC',
  taxId: '12-3456789',
  address: '123 Industrial Parkway',
  city: 'Austin',
  state: 'TX',
  zipCode: '78701',
  phone: '(512) 555-0100',
  website: 'https://greentech-recycling.example.com'
};

const FACILITY_DATA = {
  name: 'Main Processing Center',
  address: '123 Industrial Parkway',
  city: 'Austin',
  state: 'TX',
  zipCode: '78701',
  operatingStatus: 'Active',
  facilityType: 'Processing'
};

// Helper function to wait for manual intervention with smart navigation detection
async function waitForManualAction(page: Page, message: string, timeoutMs: number = 300000) {
  console.log('\n' + '='.repeat(80));
  console.log(`⏸️  MANUAL ACTION REQUIRED`);
  console.log('='.repeat(80));
  console.log(message);
  console.log('='.repeat(80) + '\n');
  
  // Take screenshot for reference
  await page.screenshot({ 
    path: `screenshots/manual-pause-${Date.now()}.png`,
    fullPage: true 
  });
  
  const startUrl = page.url();
  console.log(`Current URL: ${startUrl}`);
  console.log(`Waiting for navigation or timeout (${timeoutMs}ms)...\n`);
  
  try {
    // Race between navigation and timeout
    await Promise.race([
      // Wait for navigation (URL change indicates user completed action)
      page.waitForURL(url => url.toString() !== startUrl, { timeout: timeoutMs }),
      // Timeout fallback
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Manual action timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
    
    console.log(`✅ Navigation detected! New URL: ${page.url()}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error(`❌ Timeout: User did not complete action within ${timeoutMs}ms`);
      throw error;
    }
    throw error;
  }
}

// Helper to extract email verification token from database
async function getEmailVerificationToken(email: string): Promise<string | null> {
  try {
    const { db } = await import('../server/db');
    const { users } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });
    
    return user?.emailVerificationToken || null;
  } catch (error) {
    console.error('Failed to get verification token:', error);
    return null;
  }
}

test.describe('User Journey 1: Business Solo License - PDF Report', () => {
  test.setTimeout(600000); // 10 minutes for full journey
  
  let userId: string;
  let assessmentId: string;
  
  // Automatic database cleanup before tests
  test.beforeAll(async () => {
    console.log('\n🧹 Running automatic database cleanup...\n');
    const { cleanupTestData } = await import('./helpers/db-cleanup');
    await cleanupTestData();
    console.log('✅ Database cleanup completed\n');
  });
  
  test('Complete Business User Journey from Registration to PDF Report', async ({ page, context }) => {
    // Ensure screenshots directory exists
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots', { recursive: true });
    }
    
    console.log('\n🚀 Starting User Journey 1: Business Solo License - PDF Report\n');
    
    // ========================================
    // STEP 1: REGISTRATION
    // ========================================
    console.log('📝 Step 1: Registration');
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Fill registration form
    await page.fill('input[data-testid="input-firstName"], input[name="firstName"]', TEST_USER.firstName);
    await page.fill('input[data-testid="input-lastName"], input[name="lastName"]', TEST_USER.lastName);
    await page.fill('input[data-testid="input-email"], input[name="email"], input[type="email"]', TEST_USER.email);
    await page.fill('input[data-testid="input-password"], input[name="password"], input[type="password"]', TEST_USER.password);
    await page.fill('input[data-testid="input-companyName"], input[name="companyName"], input[name="company"]', TEST_USER.companyName);
    
    // Accept terms if checkbox exists
    const termsCheckbox = page.locator('input[type="checkbox"][name="terms"], input[type="checkbox"][data-testid="checkbox-terms"]');
    if (await termsCheckbox.count() > 0) {
      await termsCheckbox.check();
    }
    
    await page.screenshot({ path: 'screenshots/01-registration-filled.png', fullPage: true });
    
    // Submit registration
    await page.click('button[data-testid="button-register"], button[type="submit"]:has-text("Register"), button:has-text("Sign Up"), button:has-text("Create Account")');
    
    // Wait for redirect to email verification page
    await page.waitForURL(/verify-email|email-sent/, { timeout: 10000 });
    await page.screenshot({ path: 'screenshots/02-email-verification-page.png', fullPage: true });
    
    console.log('✅ Registration completed');
    
    // ========================================
    // STEP 2: EMAIL VERIFICATION
    // ========================================
    console.log('\n📧 Step 2: Email Verification');
    
    // Option 1: Extract token from database
    const token = await getEmailVerificationToken(TEST_USER.email);
    
    if (token) {
      console.log('✅ Found verification token in database');
      await page.goto(`/verify-email?token=${token}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'screenshots/03-email-verified.png', fullPage: true });
    } else {
      // Option 2: Manual intervention
      await waitForManualAction(
        page,
        `Please check email for ${TEST_USER.email} and click the verification link.\n` +
        `Or manually navigate to the verification URL.\n` +
        `The test will continue after 5 minutes or when you navigate to the next page.`,
        300000 // 5 minutes
      );
    }
    
    // Verify we're on account type selection or post-verification page
    await page.waitForURL(/account-type|pricing|onboarding/, { timeout: 30000 });
    console.log('✅ Email verified successfully');
    
    // ========================================
    // STEP 3: ACCOUNT TYPE SELECTION
    // ========================================
    console.log('\n🏢 Step 3: Account Type Selection');
    
    // Check if we're on account type selection page
    const currentUrl = page.url();
    if (currentUrl.includes('account-type')) {
      await page.screenshot({ path: 'screenshots/04-account-type-selection.png', fullPage: true });
      
      // Select Business account type
      await page.click('button:has-text("Business"), [data-testid="button-business"], div:has-text("Business") button');
      await page.waitForTimeout(1000);
      console.log('✅ Selected Business account type');
    }
    
    // ========================================
    // STEP 4: PRICING SELECTION
    // ========================================
    console.log('\n💰 Step 4: Pricing Selection (Solo Business $399)');
    
    await page.waitForURL(/pricing/, { timeout: 10000 });
    await page.screenshot({ path: 'screenshots/05-pricing-page.png', fullPage: true });
    
    // Click Solo Business plan
    await page.click('button:has-text("Solo"):has-text("$399"), button:has-text("Get Started"):near(:has-text("Solo"))');
    
    await page.waitForTimeout(2000);
    console.log('✅ Selected Solo Business plan');
    
    // ========================================
    // STEP 5: STRIPE PAYMENT (MANUAL)
    // ========================================
    console.log('\n💳 Step 5: Stripe Payment');
    
    await waitForManualAction(
      page,
      `STRIPE PAYMENT REQUIRED:\n` +
      `1. You should now be on Stripe Checkout page\n` +
      `2. Use test card: 4242 4242 4242 4242\n` +
      `3. Expiry: Any future date (e.g., 12/34)\n` +
      `4. CVC: Any 3 digits (e.g., 123)\n` +
      `5. ZIP: Any 5 digits (e.g., 12345)\n` +
      `6. Complete the payment\n\n` +
      `The test will continue after payment success or 5 minutes.`,
      300000
    );
    
    // Wait for redirect to success page or onboarding
    await page.waitForURL(/success|onboarding|dashboard/, { timeout: 60000 });
    await page.screenshot({ path: 'screenshots/06-payment-success.png', fullPage: true });
    console.log('✅ Payment completed successfully');
    
    // ========================================
    // STEP 6: BUSINESS ONBOARDING
    // ========================================
    console.log('\n🏭 Step 6: Business Onboarding');
    
    // Navigate to onboarding if not already there
    if (!page.url().includes('onboarding')) {
      await page.goto('/onboarding');
    }
    
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/07-onboarding-start.png', fullPage: true });
    
    // Step 1: Company Profile
    console.log('  → Company Profile');
    await page.fill('input[name="legalName"], input[data-testid="input-legalName"]', COMPANY_DATA.legalName);
    await page.fill('input[name="dbaName"], input[data-testid="input-dbaName"]', COMPANY_DATA.dbaName);
    
    // Entity type
    const entityTypeSelect = page.locator('select[name="entityType"], [data-testid="select-entityType"]');
    if (await entityTypeSelect.count() > 0) {
      await entityTypeSelect.selectOption(COMPANY_DATA.entityType);
    }
    
    await page.fill('input[name="taxId"], input[data-testid="input-taxId"]', COMPANY_DATA.taxId);
    await page.fill('input[name="address"], input[name="hqAddress"]', COMPANY_DATA.address);
    await page.fill('input[name="city"], input[name="hqCity"]', COMPANY_DATA.city);
    await page.fill('input[name="state"], input[name="hqState"]', COMPANY_DATA.state);
    await page.fill('input[name="zipCode"], input[name="hqZipCode"]', COMPANY_DATA.zipCode);
    await page.fill('input[name="phone"], input[type="tel"]', COMPANY_DATA.phone);
    
    if (await page.locator('input[name="website"]').count() > 0) {
      await page.fill('input[name="website"]', COMPANY_DATA.website);
    }
    
    await page.screenshot({ path: 'screenshots/08-onboarding-company.png', fullPage: true });
    
    // Click Next/Continue
    await page.click('button:has-text("Next"), button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Step 2: Primary Facility
    console.log('  → Primary Facility Setup');
    await page.fill('input[name="facilityName"], input[name="name"]', FACILITY_DATA.name);
    
    // Check "Same as HQ address" if available
    const sameAddressCheckbox = page.locator('input[type="checkbox"]:near(:has-text("Same as"))');
    if (await sameAddressCheckbox.count() > 0) {
      await sameAddressCheckbox.check();
    } else {
      // Fill facility address
      await page.fill('input[name="facilityAddress"]', FACILITY_DATA.address);
      await page.fill('input[name="facilityCity"]', FACILITY_DATA.city);
      await page.fill('input[name="facilityState"]', FACILITY_DATA.state);
      await page.fill('input[name="facilityZipCode"]', FACILITY_DATA.zipCode);
    }
    
    await page.screenshot({ path: 'screenshots/09-onboarding-facility.png', fullPage: true });
    
    // Click Next/Complete
    await page.click('button:has-text("Next"), button:has-text("Continue"), button:has-text("Complete"), button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Skip team setup if presented
    if (await page.locator('button:has-text("Skip")').count() > 0) {
      await page.click('button:has-text("Skip")');
      await page.waitForTimeout(1000);
    }
    
    // Completion screen - go to dashboard
    if (await page.locator('button:has-text("Dashboard"), a:has-text("Dashboard")').count() > 0) {
      await page.click('button:has-text("Dashboard"), a:has-text("Dashboard")');
    }
    
    await page.waitForURL(/dashboard/, { timeout: 30000 });
    await page.screenshot({ path: 'screenshots/10-dashboard.png', fullPage: true });
    console.log('✅ Onboarding completed');
    
    // ========================================
    // STEP 7: CREATE ASSESSMENT
    // ========================================
    console.log('\n📋 Step 7: Create Assessment');
    
    // Navigate to new assessment
    await page.goto('/assessments/new');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/11-new-assessment.png', fullPage: true });
    
    // Fill assessment details
    await page.fill('input[name="title"], input[data-testid="input-title"]', 'R2v3 Full Certification Assessment');
    await page.fill('textarea[name="description"], textarea[data-testid="input-description"]', 'Complete R2v3 pre-certification self-assessment for Main Processing Center');
    
    // Select facility
    const facilitySelect = page.locator('select[name="facilityId"], [data-testid="select-facility"]');
    if (await facilitySelect.count() > 0) {
      await facilitySelect.selectOption({ index: 0 }); // Select first facility
    }
    
    await page.screenshot({ path: 'screenshots/12-assessment-form-filled.png', fullPage: true });
    
    // Create assessment
    await page.click('button:has-text("Create"), button:has-text("Start Assessment"), button[type="submit"]');
    
    // Wait for redirect to assessment detail or intake
    await page.waitForURL(/assessments\/[a-f0-9-]+/, { timeout: 30000 });
    
    // Extract assessment ID from URL
    const urlMatch = page.url().match(/assessments\/([a-f0-9-]+)/);
    if (urlMatch) {
      assessmentId = urlMatch[1];
      console.log(`✅ Assessment created: ${assessmentId}`);
    }
    
    await page.screenshot({ path: 'screenshots/13-assessment-created.png', fullPage: true });
    
    // ========================================
    // STEP 8: COMPLETE INTAKE FORM
    // ========================================
    console.log('\n📝 Step 8: Complete Intake Form');
    
    // Navigate to intake form if not already there
    if (!page.url().includes('intake')) {
      await page.goto(`/assessments/${assessmentId}/intake`);
      await page.waitForLoadState('networkidle');
    }
    
    await page.screenshot({ path: 'screenshots/14-intake-form.png', fullPage: true });
    
    // Fill out intake form with realistic data
    // (This is a simplified version - real test would fill all required fields)
    const processingActivities = ['Collection', 'Sorting', 'Disassembly', 'Recovery'];
    for (const activity of processingActivities) {
      const checkbox = page.locator(`input[type="checkbox"][value="${activity}"], input[type="checkbox"]:near(:has-text("${activity}"))`);
      if (await checkbox.count() > 0) {
        await checkbox.first().check();
      }
    }
    
    // Data bearing devices
    const dataBearingYes = page.locator('input[value="yes"]:near(:has-text("data bearing")), input[type="radio"][value="true"]:near(:has-text("data"))');
    if (await dataBearingYes.count() > 0) {
      await dataBearingYes.first().check();
    }
    
    await page.screenshot({ path: 'screenshots/15-intake-filled.png', fullPage: true });
    
    // Save/Submit intake
    await page.click('button:has-text("Save"), button:has-text("Submit"), button:has-text("Continue")');
    await page.waitForTimeout(3000);
    
    console.log('✅ Intake form completed');
    
    // ========================================
    // STEP 9: ANSWER ASSESSMENT QUESTIONS
    // ========================================
    console.log('\n❓ Step 9: Answer Assessment Questions');
    
    // Navigate to questions
    await page.goto(`/assessments/${assessmentId}/questions`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/16-questions-page.png', fullPage: true });
    
    // Answer first 10 questions to generate meaningful report
    console.log('  → Answering questions (simplified for test)');
    
    for (let i = 0; i < 10; i++) {
      // Find "Yes" or "Partial" buttons and click
      const yesButton = page.locator('button:has-text("Yes"), input[value="yes"]').first();
      if (await yesButton.count() > 0) {
        await yesButton.click();
        await page.waitForTimeout(500);
      }
      
      // Click next question if available
      const nextButton = page.locator('button:has-text("Next Question")');
      if (await nextButton.count() > 0) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }
    
    await page.screenshot({ path: 'screenshots/17-questions-answered.png', fullPage: true });
    console.log('✅ Questions answered');
    
    // ========================================
    // STEP 10: GENERATE PDF REPORT
    // ========================================
    console.log('\n📄 Step 10: Generate PDF Report');
    
    // Navigate to reports/export page
    await page.goto(`/assessments/${assessmentId}`);
    await page.waitForLoadState('networkidle');
    
    // Look for export/report button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Generate Report"), a:has-text("Reports")');
    if (await exportButton.count() > 0) {
      await exportButton.first().click();
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: 'screenshots/18-export-options.png', fullPage: true });
    
    // Select PDF format
    const pdfButton = page.locator('button:has-text("PDF"), input[value="pdf"], [data-testid="button-pdf"]');
    if (await pdfButton.count() > 0) {
      await pdfButton.first().click();
    }
    
    // Download the report
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    
    // Click generate/download button
    await page.click('button:has-text("Generate"), button:has-text("Download"), button:has-text("Export")');
    
    const download = await downloadPromise;
    const downloadPath = path.join('downloads', `business-report-${Date.now()}.pdf`);
    
    // Ensure downloads directory exists
    if (!fs.existsSync('downloads')) {
      fs.mkdirSync('downloads', { recursive: true });
    }
    
    await download.saveAs(downloadPath);
    
    console.log(`✅ PDF Report downloaded: ${downloadPath}`);
    await page.screenshot({ path: 'screenshots/19-report-downloaded.png', fullPage: true });
    
    // Verify file exists and has content
    const fileStats = fs.statSync(downloadPath);
    expect(fileStats.size).toBeGreaterThan(1000); // At least 1KB
    
    console.log(`✅ Report file size: ${(fileStats.size / 1024).toFixed(2)} KB`);
    
    // ========================================
    // JOURNEY COMPLETE
    // ========================================
    console.log('\n✨ USER JOURNEY 1 COMPLETE ✨');
    console.log('='.repeat(80));
    console.log('Summary:');
    console.log(`  ✓ User registered: ${TEST_USER.email}`);
    console.log(`  ✓ Email verified`);
    console.log(`  ✓ Business account type selected`);
    console.log(`  ✓ Solo Business license purchased`);
    console.log(`  ✓ Onboarding completed`);
    console.log(`  ✓ Assessment created: ${assessmentId}`);
    console.log(`  ✓ Intake form filled`);
    console.log(`  ✓ Questions answered`);
    console.log(`  ✓ PDF Report generated: ${downloadPath}`);
    console.log('='.repeat(80) + '\n');
  });
});
