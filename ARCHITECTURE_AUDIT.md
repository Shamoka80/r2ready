# Complete Architecture Audit - User Journey Verification
## R2v3 Pre-Certification Self-Assessment Platform

**Audit Date:** November 6, 2025
**Auditor:** Systematic Verification Process
**Purpose:** Map intended vs actual implementation of complete user journey

---

## INTENDED USER JOURNEY (Per Industry_Aligned_Journey.md)

### Phase 1: Pre-Purchase Flow
1. **Registration** → `/register`
   - Creates user with `email_pending` status
   - Sends verification email
   - Redirects to `/verify-email`

2. **Email Verification** → `/verify-email?token=xxx`
   - Validates token
   - Marks email verified
   - Updates status to `payment_pending`
   - Redirects to `/account-type-selection`

3. **Account Type Selection** → `/account-type-selection`
   - User chooses Business or Consultant
   - Stores account type preference
   - Redirects to `/pricing?type=business|consultant`

4. **Pricing & Plan Selection** → `/pricing`
   - Shows filtered tiers based on account type
   - User selects tier
   - Clicks "Get Started"
   - Creates Stripe checkout session
   - Redirects to Stripe

5. **Payment Processing**
   - Stripe checkout completes
   - Stripe redirects to `/licenses/success?session_id=xxx`
   - **CRITICAL:** License activation must occur here
   - Redirects to `/onboarding`

### Phase 2: Post-Purchase Flow (After License Activation)
6. **Onboarding Wizard** → `/onboarding`
   - Step 1: Company Profile
   - Step 2: Facility Setup
   - Step 3: Team Setup (optional)
   - Updates `setupStatus` to `setup_complete`
   - Redirects to `/dashboard`

7. **Dashboard Access** → `/dashboard`
   - SetupGate checks: email verified + license active + onboarding complete
   - Shows appropriate dashboard (Business vs Consultant)

8. **Assessment Creation** → `/assessments/new`
   - Create new assessment
   - Link to facility
   - Redirects to `/assessments/:id/intake`

9. **Intake Form** → `/assessments/:id/intake`
   - 12-section comprehensive form
   - REC mapping logic
   - Saves intake data
   - Redirects to `/assessments/:id/questions`

10. **Assessment Questions** → `/assessments/:id/questions`
    - Answer questions
    - Auto-save responses
    - Track progress

11. **PDF Export** → `/assessments/:id/export` or `/assessments/:id`
    - Generate PDF report
    - Download

---

## ACTUAL IMPLEMENTATION VERIFICATION

### Frontend Routes (App.tsx)

### CRITICAL GAP ANALYSIS

#### Payment → License Activation Flow
**SPECIFICATION SAYS:**
- Stripe redirects to `/licenses/success?session_id=xxx`
- Page must trigger license creation in database
- Must redirect to `/onboarding` after activation

**ACTUAL IMPLEMENTATION:**
- ✅ Frontend route exists: `/licenses/success` (LicenseSuccess.tsx in App.tsx line 35)
- ✅ Stripe redirect URLs fixed (use getBaseUrl() helper)
- ✅ Endpoint exists: GET `/api/stripe/session/:sessionId` (retrieves session data)
- ❌ **MISSING**: POST `/api/stripe/session/:sessionId/activate` (creates license in DB)
- ❌ **MISSING**: GET `/api/licenses` (list user licenses - causes 404 on success page)
- ⚠️ License creation logic exists in GET `/api/stripe/verify-license/:sessionId` but **NEVER CALLED**

#### SetupGate Routing Logic
**SPECIFICATION SAYS:**
- Paid users with incomplete onboarding → `/onboarding`
- Unpaid users → `/pricing`

**ACTUAL IMPLEMENTATION:**
- SetupGate line 101-104: If no license → redirect to `/pricing` ✅
- SetupGate line 108-112: If `setupStatus` incomplete → redirect to `/onboarding` ✅
- ⚠️ **PROBLEM**: When user completes payment but license not created, they have no license → redirected back to `/pricing` (loop!)

---

## ROOT CAUSE IDENTIFIED

### The Missing Link
License creation code exists in `server/routes/stripe.ts` at line 157-195 (inside `GET /verify-license/:sessionId`), but:

1. **Nothing calls this endpoint** in the payment flow
2. Frontend `/licenses/success` page fetches session data but doesn't trigger activation
3. No webhook handler processes `checkout.session.completed` events
4. No synchronous activation call on success page mount

### Why User Got Stuck
1. User completed Stripe payment ✅
2. Redirected to `/licenses/success?session_id=xxx` ✅  
3. Page loaded Stripe session (GET `/api/stripe/session/:sessionId`) ✅
4. Page tried to fetch licenses (GET `/api/licenses`) → **404 ERROR** ❌
5. No license created in database ❌
6. SetupGate checks license → none found → redirect to `/pricing` ❌
7. **INFINITE LOOP**: Paid user redirected back to pricing

---

## REQUIRED FIXES (Prioritized by Dependency)

### Layer 1: Backend API Endpoints (Required First)

1. **Add POST `/api/stripe/session/:sessionId/activate`**
   - Location: `server/routes/stripe.ts`
   - Purpose: Create license record after payment verification
   - Logic: Move code from GET `/verify-license` into this POST endpoint
   - Returns: `{ success: true, license: {...}, nextRoute: '/onboarding' }`

2. **Add GET `/api/licenses`**
   - Location: `server/routes/licenses.ts`
   - Purpose: List user's licenses for confirmation
   - Returns: Array of license objects

### Layer 2: Integration Logic (Depends on Layer 1)

3. **Update `LicenseSuccess.tsx`**
   - Call POST `/api/stripe/session/:sessionId/activate` on mount
   - Handle activation success/failure
   - Redirect to `/onboarding` on success (not stay on technical page)
   - Show proper error if activation fails

4. **Update `SetupGate.tsx`**
   - Add intermediate state for paid-but-not-onboarded users
   - Route them to `/onboarding` not `/pricing`
   - Don't loop users who have paid

### Layer 3: Testing & Validation (Depends on Layers 1 & 2)

5. **E2E Test Execution**
   - Fresh test user registration → payment → onboarding → assessment → PDF
   - Verify license created after payment
   - Verify proper routing through all gates
   - Capture all database state changes

