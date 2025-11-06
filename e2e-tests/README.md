# E2E Test Suite - RUR2 User Journey Tests

This directory contains comprehensive end-to-end tests for the complete user journeys in the RUR2 platform, following the Industry-Aligned Journey specification.

## Test Overview

### Test User 1: Business Solo License → PDF Report
**File:** `user-journey-1-business-solo-pdf.spec.ts`  
**Email:** shamoka@gmail.com  
**Password:** Passw0rD80?  
**License:** Solo Business ($399)

**Journey:**
1. ✅ Registration
2. ✅ Email Verification (automated via DB token extraction)
3. ✅ Account Type Selection (Business)
4. ✅ Pricing Selection (Solo Business)
5. ⏸️ **Payment (MANUAL: Stripe test card)**
6. ✅ Business Onboarding
7. ✅ Create Assessment
8. ✅ Complete Intake Form
9. ✅ Answer Questions
10. ✅ **Generate PDF Report**

### Test User 2: Agency Consultant License → Word Report
**File:** `user-journey-2-consultant-agency-word.spec.ts`  
**Email:** jorelaiken@gmail.com  
**Password:** Passw0rD80!  
**License:** Agency Consultant ($1,199)

**Journey:**
1. ✅ Registration
2. ✅ Email Verification (automated via DB token extraction)
3. ✅ Account Type Selection (Consultant)
4. ✅ Pricing Selection (Agency Consultant)
5. ⏸️ **Payment (MANUAL: Stripe test card)**
6. ✅ Consultant Onboarding
7. ✅ Create Client Organization
8. ✅ Create Client Facility
9. ✅ Create Client Assessment
10. ✅ Complete Intake Form for Client
11. ✅ Answer Questions
12. ✅ **Generate Word (DOCX) Report**

## Prerequisites

1. **Application must be running**
   - The test suite will start the dev server automatically
   - Or you can manually run `npm run dev` first

2. **Stripe test mode enabled**
   - Use Stripe test API keys
   - Test card: `4242 4242 4242 4242`

3. **Database cleanup (AUTOMATIC)**
   - Tests automatically clean up before running
   - No manual cleanup required
   - Cleanup happens in `beforeAll` hook

## Running the Tests

> **Note:** Database cleanup is **automatic**! The test suite will automatically clean up test users and their data before running. You don't need to run any cleanup scripts manually.

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Individual Journey Tests
```bash
# Test User 1 - Business Solo (PDF)
npx playwright test user-journey-1-business-solo-pdf.spec.ts

# Test User 2 - Consultant Agency (Word)
npx playwright test user-journey-2-consultant-agency-word.spec.ts
```

#### Run with UI Mode (Recommended for First Run)
```bash
npx playwright test --ui
```

#### Run in Headed Mode (See Browser)
```bash
npx playwright test --headed
```

## Test Flow

Each test follows this automated flow:

1. **Automatic Database Cleanup** (runs before tests)
   - Removes any existing test users
   - Clears associated data (tenants, assessments, etc.)
   - Preserves system data (standards, clauses, questions)

2. **Automated Steps** (no manual intervention)
   - Registration
   - Email verification (via DB token extraction)
   - Account type selection
   - Pricing selection

3. **Manual Step** (requires user action)
   - 🛑 **Stripe Payment** (only manual step)

4. **Automated Steps** (continue automatically)
   - Onboarding
   - Assessment creation
   - Intake form completion
   - Question answering
   - Report generation

## Manual Intervention Points

### 🛑 ONLY Manual Step: Stripe Payment

**When:** After pricing selection  
**What to do:**
1. Test displays Stripe Checkout page with payment instructions
2. Enter test card details:
   - **Card Number:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/34`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **ZIP:** Any 5 digits (e.g., `12345`)
3. Click "Pay" button
4. **Test automatically resumes** when Stripe redirects back

**Smart Navigation Detection:**
- Test uses `Promise.race` to detect URL change
- Resumes immediately when payment completes
- Fails fast if timeout (5 minutes) exceeded
- No need to manually continue the test

### All Other Steps: Fully Automated

- **Database Cleanup**: Automatic via `beforeAll` hook
- **Email Verification**: Automatic via DB token extraction
- **Form Filling**: Automatic with test data
- **Navigation**: Automatic flow through all pages

## Test Output

### Screenshots
All screenshots are saved to `screenshots/` directory:
- `01-registration-filled.png` - Registration form
- `02-email-verification-page.png` - Email sent confirmation
- `03-email-verified.png` - Successful verification
- ... and more (20+ screenshots per journey)

### Downloaded Reports
Reports are saved to `downloads/` directory:
- `business-report-[timestamp].pdf` - Business user PDF report
- `consultant-report-[timestamp].docx` - Consultant user Word report

### Logs
Comprehensive console output shows:
- Each step being executed
- Manual intervention prompts
- Success/failure status
- File downloads
- Final summary

## Test Results

After completion, you'll see:
```
✨ USER JOURNEY 1 COMPLETE ✨
================================================================================
Summary:
  ✓ User registered: shamoka@gmail.com
  ✓ Email verified
  ✓ Business account type selected
  ✓ Solo Business license purchased
  ✓ Onboarding completed
  ✓ Assessment created: [uuid]
  ✓ Intake form filled
  ✓ Questions answered
  ✓ PDF Report generated: downloads/business-report-[timestamp].pdf
================================================================================
```

## Troubleshooting

### Test Fails at Registration
**Issue:** "Email already exists"  
**Solution:** Tests should handle this automatically via `beforeAll` cleanup. If issue persists, manually run: `npx tsx e2e-tests/helpers/db-cleanup.ts`

### Test Fails at Email Verification
**Issue:** Token not found in database  
**Solution:** Check that email service is configured and user was created successfully

### Test Fails at Payment
**Issue:** Stripe checkout timeout or "Manual action timeout"  
**Solution:** 
- Complete payment within 5 minutes (timeout limit)
- Use the correct test card: `4242 4242 4242 4242`
- Test uses smart navigation detection - it will resume immediately when Stripe redirects back
- If timeout occurs, test will fail with clear error message

### Report Download Fails
**Issue:** No download detected  
**Solution:**
- Check that assessment has data (intake + questions answered)
- Verify export service is working
- Check server logs for errors

## Adding More Tests

To add additional journey tests:

1. Create new test file in `e2e-tests/`
2. Follow the pattern from existing tests
3. Add `beforeAll` hook with automatic cleanup:
   ```typescript
   test.beforeAll(async () => {
     const { cleanupTestData } = await import('./helpers/db-cleanup');
     await cleanupTestData();
   });
   ```
4. Use helper functions:
   - `waitForManualAction()` - Smart pause with navigation detection
   - `getEmailVerificationToken()` - Extract DB token
5. Add test email to `helpers/db-cleanup.ts` TEST_EMAILS array

## CI/CD Integration

For automated testing in CI/CD:

1. Set `CI=true` environment variable
2. Configure Stripe test webhooks
3. Use headless mode (default)
4. Mock email verification if needed

```bash
CI=true npm run test:e2e
```

## Test Data

### Company Data (Business User)
- Legal Name: GreenTech Recycling Solutions LLC
- Location: Austin, TX
- Facility: Main Processing Center

### Client Data (Consultant User)
- Client: TechWaste Solutions Inc
- Location: Portland, OR
- Facility: TechWaste Main Facility

All test data uses realistic values with Faker.js for dynamic fields.

## Key Features

✨ **Automation-Ready Design:**
- **Automatic cleanup**: No manual database cleanup required
- **Smart navigation detection**: Resumes immediately when user completes manual actions
- **Fail-fast timeouts**: Clear error messages if manual actions not completed
- **Repeatable execution**: Can run tests consecutively without manual intervention

✨ **Only Manual Step:**
- Stripe payment (required due to external payment gateway)
- All other steps fully automated

## Support

For issues or questions about these tests:
1. Check screenshots in `screenshots/` directory
2. Review test output logs (includes cleanup status)
3. Check application is running on port 5173
4. Verify Stripe test mode is enabled
