/**
 * E2E Test: User Journey 2 - Consultant Agency License with Word Report Generation
 * 
 * Test User: jorelaiken@gmail.com
 * Password: Passw0rD80!
 * License: Agency Consultant ($1,199)
 * Goal: Generate a Word (DOCX) report of the client assessment
 * 
 * Journey Flow:
 * 1. Registration
 * 2. Email Verification (Manual: Click link or we extract token from DB)
 * 3. Account Type Selection (Consultant)
 * 4. Pricing Selection (Agency Consultant)
 * 5. Payment (Manual: Stripe checkout with test card)
 * 6. Consultant Onboarding (Consultant profile setup)
 * 7. Create Client Organization
 * 8. Create Client Facility
 * 9. Create Client Assessment
 * 10. Complete Intake Form for Client
 * 11. Answer Assessment Questions
 * 12. Generate Word Report (Download & Validate)
 */

import { test, expect, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const TEST_USER = {
  email: 'jorelaiken@gmail.com',
  password: 'Passw0rD80!',
  firstName: 'Jorel',
  lastName: 'Aiken',
  companyName: 'R2 Compliance Consulting Group'
};

const CONSULTANT_DATA = {
  agencyName: 'R2 Compliance Consulting Group',
  agencyType: 'Certification Consultant',
  website: 'https://r2compliance.example.com',
  phone: '(555) 123-4567',
  address: '456 Business Plaza',
  city: 'San Francisco',
  state: 'CA',
  zipCode: '94105'
};

const CLIENT_DATA = {
  legalName: 'TechWaste Solutions Inc',
  dbaName: 'TechWaste',
  entityType: 'CORPORATION',
  taxId: '98-7654321',
  address: '789 Recycling Drive',
  city: 'Portland',
  state: 'OR',
  zipCode: '97201',
  primaryContactName: 'Sarah Johnson',
  primaryContactEmail: 'sarah.johnson@techwaste.example.com',
  primaryContactPhone: '(503) 555-0200'
};

const CLIENT_FACILITY_DATA = {
  name: 'TechWaste Main Facility',
  address: '789 Recycling Drive',
  city: 'Portland',
  state: 'OR',
  zipCode: '97201',
  operatingStatus: 'ACTIVE'
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

test.describe('User Journey 2: Consultant Agency License - Word Report', () => {
  test.setTimeout(600000); // 10 minutes for full journey
  
  let userId: string;
  let clientOrgId: string;
  let clientFacilityId: string;
  let assessmentId: string;
  
  // Automatic database cleanup before tests
  test.beforeAll(async () => {
    console.log('\n🧹 Running automatic database cleanup...\n');
    const { cleanupTestData } = await import('./helpers/db-cleanup');
    await cleanupTestData();
    console.log('✅ Database cleanup completed\n');
  });
  
  test('Complete Consultant User Journey from Registration to Word Report', async ({ page, context }) => {
    // Ensure screenshots directory exists
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots', { recursive: true });
    }
    
    console.log('\n🚀 Starting User Journey 2: Consultant Agency License - Word Report\n');
    
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
    
    await page.screenshot({ path: 'screenshots/consultant-01-registration-filled.png', fullPage: true });
    
    // Submit registration
    await page.click('button[data-testid="button-register"], button[type="submit"]:has-text("Register"), button:has-text("Sign Up"), button:has-text("Create Account")');
    
    // Wait for redirect to email verification page
    await page.waitForURL(/verify-email|email-sent/, { timeout: 10000 });
    await page.screenshot({ path: 'screenshots/consultant-02-email-verification-page.png', fullPage: true });
    
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
      await page.screenshot({ path: 'screenshots/consultant-03-email-verified.png', fullPage: true });
    } else {
      // Option 2: Manual intervention
      await waitForManualAction(
        page,
        `Please check email for ${TEST_USER.email} and click the verification link.\n` +
        `Or manually navigate to the verification URL.\n` +
        `The test will continue after 5 minutes or when you navigate to the next page.`,
        300000
      );
    }
    
    // Verify we're on account type selection or post-verification page
    await page.waitForURL(/account-type|pricing|onboarding/, { timeout: 30000 });
    console.log('✅ Email verified successfully');
    
    // ========================================
    // STEP 3: ACCOUNT TYPE SELECTION
    // ========================================
    console.log('\n👔 Step 3: Account Type Selection (Consultant)');
    
    // Check if we're on account type selection page
    const currentUrl = page.url();
    if (currentUrl.includes('account-type')) {
      await page.screenshot({ path: 'screenshots/consultant-04-account-type-selection.png', fullPage: true });
      
      // Select Consultant account type
      await page.click('button:has-text("Consultant"), [data-testid="button-consultant"], div:has-text("Consultant") button');
      await page.waitForTimeout(1000);
      console.log('✅ Selected Consultant account type');
    }
    
    // ========================================
    // STEP 4: PRICING SELECTION
    // ========================================
    console.log('\n💰 Step 4: Pricing Selection (Agency Consultant $1,199)');
    
    await page.waitForURL(/pricing/, { timeout: 10000 });
    await page.screenshot({ path: 'screenshots/consultant-05-pricing-page.png', fullPage: true });
    
    // Click Agency Consultant plan
    await page.click('button:has-text("Agency"):has-text("$1,199"), button:has-text("Agency"):has-text("$1199"), button:has-text("Get Started"):near(:has-text("Agency"))');
    
    await page.waitForTimeout(2000);
    console.log('✅ Selected Agency Consultant plan');
    
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
    await page.screenshot({ path: 'screenshots/consultant-06-payment-success.png', fullPage: true });
    console.log('✅ Payment completed successfully');
    
    // ========================================
    // STEP 6: CONSULTANT ONBOARDING
    // ========================================
    console.log('\n🏢 Step 6: Consultant Onboarding');
    
    // Navigate to onboarding if not already there
    if (!page.url().includes('onboarding')) {
      await page.goto('/onboarding');
    }
    
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/consultant-07-onboarding-start.png', fullPage: true });
    
    // Fill consultant profile
    console.log('  → Consultant Profile Setup');
    
    if (await page.locator('input[name="agencyName"], input[name="consultantName"]').count() > 0) {
      await page.fill('input[name="agencyName"], input[name="consultantName"]', CONSULTANT_DATA.agencyName);
    }
    
    if (await page.locator('input[name="phone"]').count() > 0) {
      await page.fill('input[name="phone"]', CONSULTANT_DATA.phone);
    }
    
    if (await page.locator('input[name="website"]').count() > 0) {
      await page.fill('input[name="website"]', CONSULTANT_DATA.website);
    }
    
    await page.screenshot({ path: 'screenshots/consultant-08-onboarding-profile.png', fullPage: true });
    
    // Click Next/Complete/Skip to continue
    const continueButton = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Complete"), button:has-text("Skip")');
    if (await continueButton.count() > 0) {
      await continueButton.first().click();
      await page.waitForTimeout(2000);
    }
    
    // If there's a completion screen, go to dashboard
    if (await page.locator('button:has-text("Dashboard"), a:has-text("Dashboard")').count() > 0) {
      await page.click('button:has-text("Dashboard"), a:has-text("Dashboard")');
    }
    
    await page.waitForURL(/dashboard|consultant/, { timeout: 30000 });
    await page.screenshot({ path: 'screenshots/consultant-09-dashboard.png', fullPage: true });
    console.log('✅ Consultant onboarding completed');
    
    // ========================================
    // STEP 7: CREATE CLIENT ORGANIZATION
    // ========================================
    console.log('\n🏭 Step 7: Create Client Organization');
    
    // Navigate to clients page
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/consultant-10-clients-page.png', fullPage: true });
    
    // Click Add Client button
    await page.click('button:has-text("Add Client"), button:has-text("New Client"), [data-testid="button-add-client"]');
    await page.waitForTimeout(1000);
    
    // Fill client organization form
    await page.fill('input[name="legalName"], input[data-testid="input-legalName"]', CLIENT_DATA.legalName);
    await page.fill('input[name="dbaName"], input[data-testid="input-dbaName"]', CLIENT_DATA.dbaName);
    
    // Entity type
    const entityTypeSelect = page.locator('select[name="entityType"], [data-testid="select-entityType"]');
    if (await entityTypeSelect.count() > 0) {
      await entityTypeSelect.selectOption(CLIENT_DATA.entityType);
    }
    
    await page.fill('input[name="taxId"], input[data-testid="input-taxId"]', CLIENT_DATA.taxId);
    await page.fill('input[name="hqAddress"], input[name="address"]', CLIENT_DATA.address);
    await page.fill('input[name="hqCity"], input[name="city"]', CLIENT_DATA.city);
    await page.fill('input[name="hqState"], input[name="state"]', CLIENT_DATA.state);
    await page.fill('input[name="hqZipCode"], input[name="zipCode"]', CLIENT_DATA.zipCode);
    await page.fill('input[name="primaryContactName"]', CLIENT_DATA.primaryContactName);
    await page.fill('input[name="primaryContactEmail"]', CLIENT_DATA.primaryContactEmail);
    await page.fill('input[name="primaryContactPhone"]', CLIENT_DATA.primaryContactPhone);
    
    await page.screenshot({ path: 'screenshots/consultant-11-client-form-filled.png', fullPage: true });
    
    // Submit client creation
    await page.click('button:has-text("Create"), button:has-text("Add Client"), button[type="submit"]');
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'screenshots/consultant-12-client-created.png', fullPage: true });
    
    // Extract client org ID from URL or page
    const clientUrlMatch = page.url().match(/clients\/([a-f0-9-]+)/);
    if (clientUrlMatch) {
      clientOrgId = clientUrlMatch[1];
      console.log(`✅ Client organization created: ${clientOrgId}`);
    }
    
    // ========================================
    // STEP 8: CREATE CLIENT FACILITY
    // ========================================
    console.log('\n🏭 Step 8: Create Client Facility');
    
    // Navigate to client detail or facilities page
    if (!page.url().includes('/clients/')) {
      await page.goto(`/clients/${clientOrgId}`);
      await page.waitForLoadState('networkidle');
    }
    
    // Click Add Facility button
    await page.click('button:has-text("Add Facility"), button:has-text("New Facility"), [data-testid="button-add-facility"]');
    await page.waitForTimeout(1000);
    
    // Fill facility form
    await page.fill('input[name="name"], input[data-testid="input-name"]', CLIENT_FACILITY_DATA.name);
    await page.fill('input[name="address"]', CLIENT_FACILITY_DATA.address);
    await page.fill('input[name="city"]', CLIENT_FACILITY_DATA.city);
    await page.fill('input[name="state"]', CLIENT_FACILITY_DATA.state);
    await page.fill('input[name="zipCode"]', CLIENT_FACILITY_DATA.zipCode);
    
    // Operating status
    const statusSelect = page.locator('select[name="operatingStatus"]');
    if (await statusSelect.count() > 0) {
      await statusSelect.selectOption(CLIENT_FACILITY_DATA.operatingStatus);
    }
    
    await page.screenshot({ path: 'screenshots/consultant-13-facility-form-filled.png', fullPage: true });
    
    // Submit facility creation
    await page.click('button:has-text("Create"), button:has-text("Add"), button[type="submit"]');
    await page.waitForTimeout(2000);
    
    console.log('✅ Client facility created');
    await page.screenshot({ path: 'screenshots/consultant-14-facility-created.png', fullPage: true });
    
    // ========================================
    // STEP 9: CREATE CLIENT ASSESSMENT
    // ========================================
    console.log('\n📋 Step 9: Create Client Assessment');
    
    // Navigate to new assessment
    await page.goto('/assessments/new');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/consultant-15-new-assessment.png', fullPage: true });
    
    // Fill assessment details
    await page.fill('input[name="title"], input[data-testid="input-title"]', `${CLIENT_DATA.legalName} - R2v3 Assessment`);
    await page.fill('textarea[name="description"], textarea[data-testid="input-description"]', 'Complete R2v3 pre-certification assessment for client');
    
    // Select client organization
    const clientOrgSelect = page.locator('select[name="clientOrganizationId"], [data-testid="select-client"]');
    if (await clientOrgSelect.count() > 0) {
      await clientOrgSelect.selectOption({ index: 0 }); // Select first client
    }
    
    // Select client facility
    const clientFacilitySelect = page.locator('select[name="clientFacilityId"], [data-testid="select-facility"]');
    if (await clientFacilitySelect.count() > 0) {
      await clientFacilitySelect.selectOption({ index: 0 }); // Select first facility
    }
    
    await page.screenshot({ path: 'screenshots/consultant-16-assessment-form-filled.png', fullPage: true });
    
    // Create assessment
    await page.click('button:has-text("Create"), button:has-text("Start Assessment"), button[type="submit"]');
    
    // Wait for redirect to assessment detail or intake
    await page.waitForURL(/assessments\/[a-f0-9-]+/, { timeout: 30000 });
    
    // Extract assessment ID from URL
    const urlMatch = page.url().match(/assessments\/([a-f0-9-]+)/);
    if (urlMatch) {
      assessmentId = urlMatch[1];
      console.log(`✅ Client assessment created: ${assessmentId}`);
    }
    
    await page.screenshot({ path: 'screenshots/consultant-17-assessment-created.png', fullPage: true });
    
    // ========================================
    // STEP 10: COMPLETE INTAKE FORM FOR CLIENT
    // ========================================
    console.log('\n📝 Step 10: Complete Intake Form for Client');
    
    // Navigate to intake form if not already there
    if (!page.url().includes('intake')) {
      await page.goto(`/assessments/${assessmentId}/intake`);
      await page.waitForLoadState('networkidle');
    }
    
    await page.screenshot({ path: 'screenshots/consultant-18-intake-form.png', fullPage: true });
    
    // Fill out intake form with client data
    const processingActivities = ['Collection', 'Sorting', 'Disassembly', 'Shredding', 'Recovery'];
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
    
    // Focus materials
    const focusMaterialsYes = page.locator('input[value="yes"]:near(:has-text("focus materials")), input[type="radio"][value="true"]:near(:has-text("focus"))');
    if (await focusMaterialsYes.count() > 0) {
      await focusMaterialsYes.first().check();
    }
    
    await page.screenshot({ path: 'screenshots/consultant-19-intake-filled.png', fullPage: true });
    
    // Save/Submit intake
    await page.click('button:has-text("Save"), button:has-text("Submit"), button:has-text("Continue")');
    await page.waitForTimeout(3000);
    
    console.log('✅ Client intake form completed');
    
    // ========================================
    // STEP 11: ANSWER ASSESSMENT QUESTIONS
    // ========================================
    console.log('\n❓ Step 11: Answer Assessment Questions');
    
    // Navigate to questions
    await page.goto(`/assessments/${assessmentId}/questions`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/consultant-20-questions-page.png', fullPage: true });
    
    // Answer first 15 questions to generate meaningful report
    console.log('  → Answering questions (simplified for test)');
    
    for (let i = 0; i < 15; i++) {
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
    
    await page.screenshot({ path: 'screenshots/consultant-21-questions-answered.png', fullPage: true });
    console.log('✅ Questions answered');
    
    // ========================================
    // STEP 12: GENERATE WORD REPORT
    // ========================================
    console.log('\n📄 Step 12: Generate Word Report');
    
    // Navigate to reports/export page
    await page.goto(`/assessments/${assessmentId}`);
    await page.waitForLoadState('networkidle');
    
    // Look for export/report button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Generate Report"), a:has-text("Reports")');
    if (await exportButton.count() > 0) {
      await exportButton.first().click();
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: 'screenshots/consultant-22-export-options.png', fullPage: true });
    
    // Select Word format
    const wordButton = page.locator('button:has-text("Word"), button:has-text("DOCX"), input[value="word"], input[value="docx"], [data-testid="button-word"]');
    if (await wordButton.count() > 0) {
      await wordButton.first().click();
    }
    
    // Download the report
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    
    // Click generate/download button
    await page.click('button:has-text("Generate"), button:has-text("Download"), button:has-text("Export")');
    
    const download = await downloadPromise;
    const downloadPath = path.join('downloads', `consultant-report-${Date.now()}.docx`);
    
    // Ensure downloads directory exists
    if (!fs.existsSync('downloads')) {
      fs.mkdirSync('downloads', { recursive: true });
    }
    
    await download.saveAs(downloadPath);
    
    console.log(`✅ Word Report downloaded: ${downloadPath}`);
    await page.screenshot({ path: 'screenshots/consultant-23-report-downloaded.png', fullPage: true });
    
    // Verify file exists and has content
    const fileStats = fs.statSync(downloadPath);
    expect(fileStats.size).toBeGreaterThan(1000); // At least 1KB
    
    console.log(`✅ Report file size: ${(fileStats.size / 1024).toFixed(2)} KB`);
    
    // ========================================
    // JOURNEY COMPLETE
    // ========================================
    console.log('\n✨ USER JOURNEY 2 COMPLETE ✨');
    console.log('='.repeat(80));
    console.log('Summary:');
    console.log(`  ✓ Consultant registered: ${TEST_USER.email}`);
    console.log(`  ✓ Email verified`);
    console.log(`  ✓ Consultant account type selected`);
    console.log(`  ✓ Agency Consultant license purchased`);
    console.log(`  ✓ Consultant onboarding completed`);
    console.log(`  ✓ Client organization created: ${clientOrgId}`);
    console.log(`  ✓ Client facility created`);
    console.log(`  ✓ Client assessment created: ${assessmentId}`);
    console.log(`  ✓ Intake form filled for client`);
    console.log(`  ✓ Questions answered`);
    console.log(`  ✓ Word Report generated: ${downloadPath}`);
    console.log('='.repeat(80) + '\n');
  });
});
