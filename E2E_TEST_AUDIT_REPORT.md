# E2E Test Audit Report: Assessment Creation & Answering
**Date:** October 4, 2025  
**Status:** Critical Mismatches Found

## Executive Summary
This audit identifies **3 critical API contract mismatches** and **12 specific test issues** across the assessment lifecycle and answering test suites. The primary issues involve:
1. **Field name mismatch**: Frontend sends `selectedFacilityId`, backend expects `facilityId`
2. **Schema confusion**: Database has both `facilityId` AND `selectedFacilityId` columns
3. **Standard reference inconsistency**: Tests use `stdCode`, backend converts to `stdId`

---

## Critical Issue #1: Facility ID Field Mismatch

### Root Cause
The schema contains TWO facility identifier columns (lines 774-775 in `shared/schema.ts`):
```typescript
facilityId: varchar("facilityId"),
selectedFacilityId: varchar("selectedFacilityId").references(() => facilityProfiles.id),
```

### The Flow
1. **Frontend** (`NewAssessment.tsx:266`): Sends `selectedFacilityId`
   ```typescript
   selectedFacilityId: formData.selectedFacilityId,
   ```

2. **Backend Validation** (`routes/assessments.ts:67`): Expects `facilityId`
   ```typescript
   facilityId: z.string().uuid("Valid facility ID is required"),
   ```

3. **Backend Save** (`routes/assessments.ts:206`): Saves to `facilityId`
   ```typescript
   facilityId: data.facilityId,
   ```

4. **Database Verification** (Tests line 119, 294, etc.): Checks `facilityId`
   ```typescript
   expect(assessmentData.facilityId).toBe(testFacility.id);
   ```

### Impact
- **Frontend to Backend**: Request FAILS validation because `selectedFacilityId` is sent but `facilityId` is required
- **Assessment Creation**: All test assertions checking `facilityId` will fail
- **User Experience**: Users cannot create assessments via UI

---

## Critical Issue #2: Standard Code vs Standard ID

### The Flow
1. **Tests** send `stdCode` (string like 'R2V3_1')
2. **Backend** receives `stdCode` and must convert to `stdId` (UUID)
3. **Database** stores `stdId` (UUID reference)
4. **Tests verify** using `stdId` field

### Current State
The backend conversion is NOT explicitly shown in the route. The schema validation accepts `stdCode` as optional with default:
```typescript
stdCode: z.string().optional().default("R2V3_1"),
```

But the database expects:
```typescript
stdId: varchar("stdId").notNull().references(() => standardVersions.id),
```

### Issue Locations
- Line 81 in assessment-lifecycle.spec.ts
- Line 89 in assessment-lifecycle.spec.ts  
- Line 180 in assessment-lifecycle.spec.ts
- Line 294 in assessment-lifecycle.spec.ts
- Line 40 in assessment-answering.spec.ts

---

## Detailed Test Mismatches

### File: `tests/e2e/assessment-lifecycle.spec.ts`

#### Mismatch #1: Assessment Creation Field Names
**Location:** Lines 176-182
```typescript
const response = await authenticatedApiContext.post('/api/assessments', {
  data: {
    title: generateUniqueTitle('Read Test Assessment'),
    description: 'Test assessment for read operations',
    stdCode: standards[0].code,
    facilityId: facilities[0].id,  // ❌ WRONG
  }
});
```

**What Test Expects:** Backend accepts `facilityId` and `stdCode`  
**What Actually Exists:** 
- Backend validation schema expects `facilityId` ✓
- Frontend sends `selectedFacilityId` ✗ (mismatch)
- stdCode is accepted but must be converted to stdId

**Recommended Fix:**
```typescript
const response = await authenticatedApiContext.post('/api/assessments', {
  data: {
    title: generateUniqueTitle('Read Test Assessment'),
    description: 'Test assessment for read operations',
    stdCode: standards[0].code,  // Backend should handle conversion
    facilityId: facilities[0].id, // Keep this - backend expects facilityId
  }
});
```

**Status:** PARTIAL - Tests are correct, but frontend is wrong

---

#### Mismatch #2: Facility ID Verification
**Location:** Line 119
```typescript
expect(assessmentData.facilityId).toBe(testFacility.id);
```

**What Test Expects:** Assessment has `facilityId` populated  
**What Actually Exists:** Schema has BOTH `facilityId` and `selectedFacilityId`  
**Recommended Fix:** Clarify which field should be used and remove the duplicate from schema

---

#### Mismatch #3: Standard ID Verification  
**Location:** Line 153
```typescript
expect(assessmentData.stdId).toBeTruthy();
```

**What Test Expects:** Assessment has `stdId` populated after sending `stdCode`  
**What Actually Exists:** Backend must lookup and convert `stdCode` to `stdId`  
**Recommended Fix:** Verify backend conversion logic exists (currently at lines 91-100 in routes/assessments.ts)

---

#### Mismatch #4: Repeated Field Name Issues
**Locations:** Lines 289-295, 398-405, 467-474
All instances repeat the same pattern:
```typescript
data: {
  title: generateUniqueTitle(...),
  description: '...',
  stdCode: standards[0].code,
  facilityId: facilities[0].id,  // Correct for API, wrong vs frontend
}
```

**Recommended Fix:** Document that:
- Tests correctly use `facilityId` (matches backend API)
- Frontend incorrectly uses `selectedFacilityId` (MUST BE FIXED)

---

### File: `tests/e2e/assessment-answering.spec.ts`

#### Mismatch #5: Test Assessment Creation
**Location:** Lines 36-42
```typescript
const createResponse = await apiContext.post('/api/assessments', {
  data: {
    title: `E2E Answering Test ${Date.now()}`,
    description: 'Test assessment for answering E2E tests',
    stdCode: standards[0].code,
    facilityId: testFacility.id,
  }
});
```

**What Test Expects:** Same as lifecycle tests  
**What Actually Exists:** Same mismatch as above  
**Recommended Fix:** Same - tests are correct, frontend needs fixing

---

#### Mismatch #6: Question ID vs Question Database ID
**Location:** Lines 220-222
```typescript
const savedAnswer = answers.find((a: any) => a.questionId === textQuestion.id);
expect(savedAnswer).toBeTruthy();
expect(savedAnswer.value).toBe(testAnswer);
```

**What Test Expects:** Uses `textQuestion.id` to find answer  
**What Actually Exists:** API returns questions with `questionId` field (not `id`)  
**Recommended Fix:** 
```typescript
const savedAnswer = answers.find((a: any) => a.questionId === textQuestion.questionId);
```

**Instances:** Lines 220, 260, 300, 372, 414

---

#### Mismatch #7: Answer Value Comparison
**Location:** Lines 261, 301, 375
```typescript
expect(savedAnswer.value).toBe('Yes');
```

**What Test Expects:** Answer value is stored as string 'Yes'  
**What Actually Exists:** Answer value is JSON type in database  
**Recommended Fix:** Verify API response format - may need:
```typescript
expect(savedAnswer.value).toBe('Yes'); // If API serializes to string
// OR
expect(JSON.parse(savedAnswer.value)).toBe('Yes'); // If stored as JSON
```

---

## Schema Issues

### File: `shared/schema.ts`

#### Issue #1: Duplicate Facility Fields
**Location:** Lines 774-775
```typescript
facilityId: varchar("facilityId"),
selectedFacilityId: varchar("selectedFacilityId").references(() => facilityProfiles.id),
```

**Problem:** Two fields for the same purpose causes confusion  
**Recommended Fix:** 
```typescript
// Option 1: Keep only facilityId with foreign key
facilityId: varchar("facilityId")
  .notNull()
  .references(() => facilityProfiles.id),

// Option 2: Use selectedFacilityId consistently everywhere
selectedFacilityId: varchar("selectedFacilityId")
  .notNull()
  .references(() => facilityProfiles.id),
```

**Preferred:** Option 1 - rename to `facilityId` everywhere for consistency

---

#### Issue #2: Missing stdCode Field
**Location:** Line 763
```typescript
stdId: varchar("stdId").notNull().references(() => standardVersions.id),
```

**Problem:** No `stdCode` field in schema, but API accepts it  
**Current State:** Backend must convert `stdCode` → `stdId` before saving  
**Recommended Fix:** Add explicit documentation that API accepts `stdCode` but stores `stdId`

---

## Backend Validation Issues

### File: `server/routes/assessments.ts`

#### Issue #1: Validation Schema Mismatch
**Location:** Lines 66-68
```typescript
const createAssessmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).optional(),
  description: z.string().max(1000).optional(),
  stdCode: z.string().optional().default("R2V3_1"),
  intakeFormId: z.string().uuid().optional(),
  facilityId: z.string().uuid("Valid facility ID is required"), // ❌
  assignedUsers: z.array(z.string().uuid()).optional(),
});
```

**Problem:** 
- Expects `facilityId`
- Frontend sends `selectedFacilityId`

**Recommended Fix:**
```typescript
const createAssessmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).optional(),
  description: z.string().max(1000).optional(),
  stdCode: z.string().optional().default("R2V3_1"),
  intakeFormId: z.string().uuid().optional(),
  selectedFacilityId: z.string().uuid("Valid facility ID is required"), // Change here
  assignedUsers: z.array(z.string().uuid()).optional(),
});
```

Then update the handler to map it:
```typescript
// After validation
const facilityId = data.selectedFacilityId; // Map to internal name
```

---

## Summary of Required Fixes

### Priority 1: Critical (Breaks Functionality)

1. **Fix Frontend Field Name** (`client/src/pages/NewAssessment.tsx:266`)
   - Change: `selectedFacilityId: formData.selectedFacilityId`
   - To: `facilityId: formData.selectedFacilityId`
   - Impact: Enables assessment creation from UI

2. **Fix Backend Validation** (`server/routes/assessments.ts:67`)
   - Accept `selectedFacilityId` in validation schema
   - Map to `facilityId` when saving
   - Impact: Matches frontend contract

3. **Remove Duplicate Schema Field** (`shared/schema.ts:774-775`)
   - Keep only `facilityId` with proper foreign key
   - Remove `selectedFacilityId`
   - Impact: Eliminates confusion

### Priority 2: High (Test Failures)

4. **Fix Question ID References** (All answering tests)
   - Change: `textQuestion.id`
   - To: `textQuestion.questionId`
   - Locations: Lines 220, 260, 300, 372, 414 in assessment-answering.spec.ts

5. **Verify Answer Value Format** (Lines 261, 301, 375)
   - Test if value is string or needs JSON parsing
   - Update test expectations accordingly

### Priority 3: Medium (Documentation)

6. **Document stdCode → stdId Conversion**
   - Add comment explaining conversion in routes/assessments.ts
   - Verify conversion happens at line 91-100

7. **Update API Documentation**
   - Document that API accepts `facilityId` (not `selectedFacilityId`)
   - Document that API accepts `stdCode` but stores `stdId`

---

## Verification Checklist

After fixes are applied, verify:

- [ ] Frontend sends `facilityId` field
- [ ] Backend validation accepts `facilityId`
- [ ] Database has single `facilityId` column with FK
- [ ] Tests pass assessment creation
- [ ] Tests pass facility ID verification
- [ ] Tests pass answer creation with correct question IDs
- [ ] Standard conversion works (stdCode → stdId)
- [ ] UI can create assessments successfully

---

## Test Impact Analysis

### Currently Passing (Expected)
- ✓ Navigation tests (no data dependency)
- ✓ UI element visibility tests
- ✓ Filter/search tests (read-only)

### Currently Failing (Expected)
- ✗ All assessment creation tests (facilityId mismatch)
- ✗ Database verification tests (stdId not populated)
- ✗ Answer creation tests (questionId mismatch)
- ✗ Progress tracking tests (dependent on answer creation)

### Will Pass After Fixes
- ✓ All lifecycle tests (create, read, update, delete)
- ✓ All answering tests (entry, save, progress)
- ✓ Status transition tests
- ✓ Progress calculation tests

---

## Recommended Action Plan

1. **Immediate (Day 1)**
   - Fix frontend: Change `selectedFacilityId` → `facilityId` in NewAssessment.tsx
   - Fix backend validation: Accept `facilityId` 
   - Run lifecycle tests to verify creation works

2. **Short-term (Day 2-3)**
   - Update schema: Remove `selectedFacilityId` column
   - Run migration to ensure data integrity
   - Fix test question ID references
   - Run answering tests to verify

3. **Documentation (Day 4-5)**
   - Document API contract clearly
   - Update test documentation
   - Create integration test for full flow
   - Add validation for stdCode → stdId conversion

---

## Appendix: Complete Mismatch Reference

| Location | Test Expects | Actual Implementation | Severity |
|----------|--------------|----------------------|----------|
| lifecycle:119 | `facilityId` in response | Both fields in schema | Critical |
| lifecycle:153 | `stdId` populated | Requires conversion | High |
| lifecycle:176-182 | API accepts `facilityId` | Frontend sends `selectedFacilityId` | Critical |
| answering:40 | API accepts `facilityId` | Frontend sends `selectedFacilityId` | Critical |
| answering:220 | `textQuestion.id` exists | Should be `questionId` | High |
| answering:260 | `yesNoQuestion.id` exists | Should be `questionId` | High |
| answering:300 | `question.id` exists | Should be `questionId` | High |
| answering:372 | `question.id` exists | Should be `questionId` | High |
| answering:414 | `textQuestion.id` exists | Should be `questionId` | High |
| schema:774-775 | Single facility field | Two fields exist | Critical |
| routes:67 | Validates `facilityId` | Frontend sends different field | Critical |
| NewAssessment:266 | Sends `facilityId` | Actually sends `selectedFacilityId` | Critical |

---

**End of Audit Report**
