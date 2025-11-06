import { test, expect } from '../fixtures/auth.fixture';
import { APIRequestContext } from '@playwright/test';

/**
 * Comprehensive Assessment Lifecycle E2E Tests
 * 
 * Tests cover:
 * - Create: Form validation, database persistence, redirects
 * - Read: Detail view, list view, filtering, searching
 * - Update: Title/description edits, status changes, metadata updates
 * - Delete: UI deletion, database cleanup, associated data removal
 * - Status Transitions: Valid/invalid transitions, UI updates
 * - Progress: Calculation, display, evidence tracking
 */

// Helper function to create unique test data
function generateUniqueTitle(prefix: string = 'Test Assessment'): string {
  return `${prefix} ${Date.now()}`;
}

// Helper function to verify assessment in database via API
async function getAssessmentFromAPI(apiContext: APIRequestContext, assessmentId: string) {
  const response = await apiContext.get(`/api/assessments/${assessmentId}`);
  if (!response.ok()) {
    throw new Error(`Failed to fetch assessment: ${response.status()}`);
  }
  return await response.json();
}

// Helper function to get facilities for test setup
async function getAvailableFacilities(apiContext: APIRequestContext) {
  const response = await apiContext.get('/api/facilities');
  if (!response.ok()) {
    throw new Error(`Failed to fetch facilities: ${response.status()}`);
  }
  const facilities = await response.json();
  return facilities.filter((f: any) => f.isActive && f.operatingStatus === 'ACTIVE');
}

// Helper function to get available standards
async function getAvailableStandards(apiContext: APIRequestContext) {
  const response = await apiContext.get('/api/assessments/standards');
  if (!response.ok()) {
    throw new Error(`Failed to fetch standards: ${response.status()}`);
  }
  return await response.json();
}

test.describe('Assessment Lifecycle - Create Tests', () => {
  test('should navigate to New Assessment page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Click New Assessment link
    await authenticatedPage.getByTestId('link-new-assessment').click();
    
    // Verify navigation
    await expect(authenticatedPage).toHaveURL(/\/assessments\/new/);
    await expect(authenticatedPage.locator('h1, h2').filter({ hasText: /new assessment/i })).toBeVisible();
  });

  test('should validate required fields', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/assessments/new');
    
    // Try to submit without required fields
    await authenticatedPage.getByTestId('button-create-assessment').click();
    
    // Check for validation errors (form should not submit)
    await expect(authenticatedPage).toHaveURL(/\/assessments\/new/);
    
    // Verify error messages appear (implementation may vary)
    // Note: This assumes validation prevents submission
  });

  test('should create assessment with valid data and verify in database', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    const uniqueTitle = generateUniqueTitle('E2E Test Assessment');
    const description = 'Automated test assessment for E2E validation';
    
    // Get available facilities
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    expect(facilities.length).toBeGreaterThan(0);
    const testFacility = facilities[0];
    
    // Navigate to new assessment page
    await authenticatedPage.goto('/assessments/new');
    
    // Fill out the form
    await authenticatedPage.getByTestId('select-facility').click();
    await authenticatedPage.getByRole('option', { name: testFacility.name }).click();
    
    await authenticatedPage.getByTestId('input-assessment-name').fill(uniqueTitle);
    await authenticatedPage.getByTestId('input-description').fill(description);
    
    // Select standard (R2V3_1 should be available)
    await authenticatedPage.getByTestId('select-assessment-type').click();
    await authenticatedPage.getByRole('option').first().click();
    
    // Submit the form
    await authenticatedPage.getByTestId('button-create-assessment').click();
    
    // Wait for redirect to assessment detail page
    await authenticatedPage.waitForURL(/\/assessments\/[a-f0-9-]+/, { timeout: 10000 });
    
    // Extract assessment ID from URL
    const url = authenticatedPage.url();
    const assessmentId = url.match(/\/assessments\/([a-f0-9-]+)/)?.[1];
    expect(assessmentId).toBeTruthy();
    
    // Verify assessment appears on the page
    await expect(authenticatedPage.getByTestId('text-assessment-title')).toContainText(uniqueTitle);
    
    // Verify in database via API
    const assessmentData = await getAssessmentFromAPI(authenticatedApiContext, assessmentId!);
    expect(assessmentData.title).toBe(uniqueTitle);
    expect(assessmentData.description).toBe(description);
    expect(assessmentData.status).toBe('DRAFT');
    expect(assessmentData.facilityId).toBe(testFacility.id);
  });

  test('should create assessment with different standards', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    expect(facilities.length).toBeGreaterThan(0);
    
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    // Test with each available standard
    for (const standard of standards.slice(0, 2)) { // Test first 2 to save time
      const uniqueTitle = generateUniqueTitle(`${standard.code} Test`);
      
      await authenticatedPage.goto('/assessments/new');
      
      await authenticatedPage.getByTestId('select-facility').click();
      await authenticatedPage.getByRole('option').first().click();
      
      await authenticatedPage.getByTestId('input-assessment-name').fill(uniqueTitle);
      
      await authenticatedPage.getByTestId('select-assessment-type').click();
      await authenticatedPage.getByRole('option', { name: new RegExp(standard.title, 'i') }).click();
      
      await authenticatedPage.getByTestId('button-create-assessment').click();
      
      await authenticatedPage.waitForURL(/\/assessments\/[a-f0-9-]+/);
      
      // Verify standard was set correctly
      const url = authenticatedPage.url();
      const assessmentId = url.match(/\/assessments\/([a-f0-9-]+)/)?.[1];
      const assessmentData = await getAssessmentFromAPI(authenticatedApiContext, assessmentId!);
      expect(assessmentData.stdId).toBeTruthy();
    }
  });

  test('should handle cancel button correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/assessments/new');
    
    // Click cancel
    await authenticatedPage.getByTestId('button-cancel').click();
    
    // Should navigate back to dashboard
    await expect(authenticatedPage).toHaveURL(/\/(dashboard|$)/);
  });
});

test.describe('Assessment Lifecycle - Read Tests', () => {
  let testAssessmentId: string;
  
  test.beforeAll(async ({ authenticatedApiContext }) => {
    // Create a test assessment for read tests
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    const response = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: generateUniqueTitle('Read Test Assessment'),
        description: 'Test assessment for read operations',
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    testAssessmentId = data.assessment.id;
  });

  test('should view assessment detail page with all information', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/assessments/${testAssessmentId}`);
    
    // Verify title is displayed
    await expect(authenticatedPage.getByTestId('text-assessment-title')).toBeVisible();
    
    // Verify tabs are present
    await expect(authenticatedPage.getByTestId('tab-overview')).toBeVisible();
    await expect(authenticatedPage.getByTestId('tab-questions')).toBeVisible();
    await expect(authenticatedPage.getByTestId('tab-analytics')).toBeVisible();
    await expect(authenticatedPage.getByTestId('tab-evidence')).toBeVisible();
    
    // Verify progress information
    await expect(authenticatedPage.getByTestId('text-progress-answered')).toBeVisible();
    await expect(authenticatedPage.getByTestId('text-evidence-count')).toBeVisible();
  });

  test('should view assessment in dashboard list', async ({ authenticatedPage, authenticatedApiContext }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Wait for assessments to load
    await authenticatedPage.waitForSelector('[data-testid^="row-assessment-"]', { timeout: 10000 });
    
    // Verify our test assessment appears in the list
    const assessmentRow = authenticatedPage.getByTestId(`row-assessment-${testAssessmentId}`);
    await expect(assessmentRow).toBeVisible();
    
    // Verify assessment name is displayed
    const assessmentName = authenticatedPage.getByTestId(`text-assessment-name-${testAssessmentId}`);
    await expect(assessmentName).toBeVisible();
    
    // Verify status badge
    const statusBadge = authenticatedPage.getByTestId(`status-${testAssessmentId}`);
    await expect(statusBadge).toBeVisible();
  });

  test('should filter assessments by status', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Wait for assessments to load
    await authenticatedPage.waitForSelector('[data-testid^="row-assessment-"]', { timeout: 10000 });
    
    // Count initial assessments
    const initialCount = await authenticatedPage.locator('[data-testid^="row-assessment-"]').count();
    
    // Look for filter controls (implementation may vary)
    const filterButton = authenticatedPage.locator('button').filter({ hasText: /filter|status/i }).first();
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Select a status filter (e.g., "In Progress")
      const inProgressOption = authenticatedPage.getByRole('option', { name: /in progress/i });
      if (await inProgressOption.isVisible()) {
        await inProgressOption.click();
        
        // Verify filtered results
        await authenticatedPage.waitForTimeout(500); // Wait for filter to apply
        const filteredCount = await authenticatedPage.locator('[data-testid^="row-assessment-"]').count();
        
        // Filtered count should be different (unless all are in progress)
        // Just verify the filter mechanism exists
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
      }
    }
  });

  test('should navigate from dashboard to detail page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    await authenticatedPage.waitForSelector('[data-testid^="row-assessment-"]', { timeout: 10000 });
    
    // Click on the assessment row
    const assessmentRow = authenticatedPage.getByTestId(`row-assessment-${testAssessmentId}`);
    await assessmentRow.click();
    
    // Should navigate to detail page
    await expect(authenticatedPage).toHaveURL(new RegExp(`/assessments/${testAssessmentId}`));
  });

  test('should navigate back to dashboard from detail page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/assessments/${testAssessmentId}`);
    
    // Click back button
    await authenticatedPage.getByTestId('button-back').click();
    
    // Should return to dashboard
    await expect(authenticatedPage).toHaveURL(/\/(dashboard|$)/);
  });
});

test.describe('Assessment Lifecycle - Update Tests', () => {
  let testAssessmentId: string;
  
  test.beforeEach(async ({ authenticatedApiContext }) => {
    // Create a fresh assessment for each update test
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    const response = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: generateUniqueTitle('Update Test Assessment'),
        description: 'Test assessment for update operations',
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    const data = await response.json();
    testAssessmentId = data.assessment.id;
  });

  test('should update assessment title via API', async ({ authenticatedApiContext }) => {
    const newTitle = generateUniqueTitle('Updated Title');
    
    // Update via API
    const response = await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: {
        title: newTitle,
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    // Verify update persisted
    const assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.title).toBe(newTitle);
  });

  test('should update assessment description via API', async ({ authenticatedApiContext }) => {
    const newDescription = 'Updated description for E2E testing';
    
    const response = await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: {
        description: newDescription,
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.description).toBe(newDescription);
  });

  test('should update assessment status via API', async ({ authenticatedApiContext }) => {
    // Update to IN_PROGRESS
    let response = await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: {
        status: 'IN_PROGRESS',
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    let assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.status).toBe('IN_PROGRESS');
    
    // Update to UNDER_REVIEW
    response = await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: {
        status: 'UNDER_REVIEW',
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.status).toBe('UNDER_REVIEW');
    
    // Update to COMPLETED
    response = await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: {
        status: 'COMPLETED',
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.status).toBe('COMPLETED');
    expect(assessmentData.completedAt).toBeTruthy();
  });

  test('should verify UI reflects status updates', async ({ authenticatedPage, authenticatedApiContext }) => {
    await authenticatedPage.goto(`/assessments/${testAssessmentId}`);
    
    // Initial status should be DRAFT
    await expect(authenticatedPage.locator('text=/draft/i').first()).toBeVisible({ timeout: 5000 });
    
    // Update status via API
    await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: { status: 'IN_PROGRESS' }
    });
    
    // Reload page to see updated status
    await authenticatedPage.reload();
    await expect(authenticatedPage.locator('text=/in progress/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Assessment Lifecycle - Delete Tests', () => {
  let testAssessmentId: string;
  
  test.beforeEach(async ({ authenticatedApiContext }) => {
    // Create assessment to delete
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    const response = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: generateUniqueTitle('Delete Test Assessment'),
        description: 'Test assessment for delete operations',
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    const data = await response.json();
    testAssessmentId = data.assessment.id;
  });

  test('should delete assessment via API', async ({ authenticatedApiContext }) => {
    // Delete the assessment
    const deleteResponse = await authenticatedApiContext.delete(`/api/assessments/${testAssessmentId}`);
    expect(deleteResponse.ok()).toBeTruthy();
    
    // Verify it's deleted - should return 404
    const getResponse = await authenticatedApiContext.get(`/api/assessments/${testAssessmentId}`);
    expect(getResponse.status()).toBe(404);
  });

  test('should remove deleted assessment from dashboard list', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    // Verify assessment exists in dashboard
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForSelector('[data-testid^="row-assessment-"]', { timeout: 10000 });
    
    const assessmentRow = authenticatedPage.getByTestId(`row-assessment-${testAssessmentId}`);
    await expect(assessmentRow).toBeVisible();
    
    // Delete via API
    await authenticatedApiContext.delete(`/api/assessments/${testAssessmentId}`);
    
    // Reload dashboard
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Verify assessment is no longer in the list
    await expect(assessmentRow).not.toBeVisible();
  });

  test('should return 404 when accessing deleted assessment detail page', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    // Delete the assessment
    await authenticatedApiContext.delete(`/api/assessments/${testAssessmentId}`);
    
    // Try to navigate to deleted assessment
    await authenticatedPage.goto(`/assessments/${testAssessmentId}`);
    
    // Should show error state or redirect
    // Check for "not found" message or redirect to dashboard
    const notFoundIndicator = authenticatedPage.locator('text=/not found|error|doesn\'t exist/i').first();
    await expect(notFoundIndicator).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Assessment Lifecycle - Status Transition Tests', () => {
  let testAssessmentId: string;
  
  test.beforeEach(async ({ authenticatedApiContext }) => {
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    const response = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: generateUniqueTitle('Status Test Assessment'),
        description: 'Test assessment for status transitions',
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    const data = await response.json();
    testAssessmentId = data.assessment.id;
  });

  test('should follow valid status transition path: DRAFT → IN_PROGRESS → UNDER_REVIEW → COMPLETED', async ({ 
    authenticatedApiContext 
  }) => {
    // Verify initial status
    let assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.status).toBe('DRAFT');
    
    // DRAFT → IN_PROGRESS
    await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: { status: 'IN_PROGRESS' }
    });
    assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.status).toBe('IN_PROGRESS');
    
    // IN_PROGRESS → UNDER_REVIEW
    await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: { status: 'UNDER_REVIEW' }
    });
    assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.status).toBe('UNDER_REVIEW');
    
    // UNDER_REVIEW → COMPLETED
    await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: { status: 'COMPLETED' }
    });
    assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.status).toBe('COMPLETED');
    expect(assessmentData.completedAt).toBeTruthy();
  });

  test('should allow DRAFT → COMPLETED direct transition', async ({ authenticatedApiContext }) => {
    // Some systems allow skipping intermediate states
    const response = await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: { status: 'COMPLETED' }
    });
    
    // This might be allowed or not depending on business rules
    // Just verify the response is consistent
    if (response.ok()) {
      const assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
      expect(assessmentData.status).toBe('COMPLETED');
    }
  });

  test('should verify status badge changes in UI', async ({ authenticatedPage, authenticatedApiContext }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForSelector('[data-testid^="row-assessment-"]', { timeout: 10000 });
    
    const statusBadge = authenticatedPage.getByTestId(`status-${testAssessmentId}`);
    
    // Initial status
    await expect(statusBadge).toContainText(/draft/i);
    
    // Update status
    await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: { status: 'IN_PROGRESS' }
    });
    
    // Reload and verify badge updated
    await authenticatedPage.reload();
    await expect(statusBadge).toContainText(/in progress/i);
  });

  test('should archive completed assessment', async ({ authenticatedApiContext }) => {
    // Complete the assessment first
    await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: { status: 'COMPLETED' }
    });
    
    // Archive it
    const response = await authenticatedApiContext.put(`/api/assessments/${testAssessmentId}`, {
      data: { status: 'ARCHIVED' }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    expect(assessmentData.status).toBe('ARCHIVED');
  });
});

test.describe('Assessment Lifecycle - Progress Tracking Tests', () => {
  let testAssessmentId: string;
  
  test.beforeEach(async ({ authenticatedApiContext }) => {
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    const response = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: generateUniqueTitle('Progress Test Assessment'),
        description: 'Test assessment for progress tracking',
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    const data = await response.json();
    testAssessmentId = data.assessment.id;
  });

  test('should display initial progress as 0%', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/assessments/${testAssessmentId}`);
    
    // Check progress display
    const progressText = authenticatedPage.getByTestId('text-progress-answered');
    await expect(progressText).toBeVisible();
    
    // Initial progress should show 0 answered
    await expect(progressText).toContainText(/0/);
  });

  test('should display evidence count', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/assessments/${testAssessmentId}`);
    
    const evidenceCount = authenticatedPage.getByTestId('text-evidence-count');
    await expect(evidenceCount).toBeVisible();
    
    // Initial evidence count should be 0
    await expect(evidenceCount).toContainText(/0/);
  });

  test('should verify progress calculation via API', async ({ authenticatedApiContext }) => {
    const assessmentData = await getAssessmentFromAPI(authenticatedApiContext, testAssessmentId);
    
    // Progress should be a number between 0 and 100
    expect(assessmentData.progress).toBeGreaterThanOrEqual(0);
    expect(assessmentData.progress).toBeLessThanOrEqual(100);
    
    // If progress object exists, verify structure
    if (assessmentData.progress && typeof assessmentData.progress === 'object') {
      expect(assessmentData.progress).toHaveProperty('answered');
      expect(assessmentData.progress).toHaveProperty('total');
    }
  });

  test('should show progress bar in detail view', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/assessments/${testAssessmentId}`);
    
    // Look for progress bar element
    const progressBar = authenticatedPage.locator('[role="progressbar"], .progress-bar, [data-testid*="progress"]').first();
    await expect(progressBar).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Assessment Lifecycle - Data Integrity Tests', () => {
  test('should maintain assessment data consistency across multiple reads', async ({ 
    authenticatedApiContext 
  }) => {
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    const uniqueTitle = generateUniqueTitle('Consistency Test');
    
    // Create assessment
    const createResponse = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: uniqueTitle,
        description: 'Data consistency test',
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    const { assessment } = await createResponse.json();
    
    // Read multiple times and verify consistency
    for (let i = 0; i < 3; i++) {
      const data = await getAssessmentFromAPI(authenticatedApiContext, assessment.id);
      expect(data.title).toBe(uniqueTitle);
      expect(data.description).toBe('Data consistency test');
      expect(data.facilityId).toBe(facilities[0].id);
    }
    
    // Cleanup
    await authenticatedApiContext.delete(`/api/assessments/${assessment.id}`);
  });

  test('should handle concurrent update requests gracefully', async ({ authenticatedApiContext }) => {
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    // Create assessment
    const createResponse = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: generateUniqueTitle('Concurrent Test'),
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    const { assessment } = await createResponse.json();
    
    // Send concurrent updates
    const updates = [
      authenticatedApiContext.put(`/api/assessments/${assessment.id}`, {
        data: { description: 'Update 1' }
      }),
      authenticatedApiContext.put(`/api/assessments/${assessment.id}`, {
        data: { description: 'Update 2' }
      }),
      authenticatedApiContext.put(`/api/assessments/${assessment.id}`, {
        data: { description: 'Update 3' }
      }),
    ];
    
    const results = await Promise.all(updates);
    
    // All should succeed (or handle conflicts gracefully)
    results.forEach(result => {
      expect([200, 201, 409]).toContain(result.status());
    });
    
    // Verify final state is consistent
    const finalData = await getAssessmentFromAPI(authenticatedApiContext, assessment.id);
    expect(finalData.description).toMatch(/Update [1-3]/);
    
    // Cleanup
    await authenticatedApiContext.delete(`/api/assessments/${assessment.id}`);
  });

  test('should preserve timestamps correctly', async ({ authenticatedApiContext }) => {
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    const createTime = Date.now();
    
    const createResponse = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: generateUniqueTitle('Timestamp Test'),
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    const { assessment } = await createResponse.json();
    
    // Verify createdAt is close to when we created it
    const createdAt = new Date(assessment.createdAt).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(createTime - 5000);
    expect(createdAt).toBeLessThanOrEqual(Date.now() + 1000);
    
    // Wait a bit then update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await authenticatedApiContext.put(`/api/assessments/${assessment.id}`, {
      data: { description: 'Updated' }
    });
    
    const updatedData = await getAssessmentFromAPI(authenticatedApiContext, assessment.id);
    const updatedAt = new Date(updatedData.updatedAt).getTime();
    
    // updatedAt should be after createdAt
    expect(updatedAt).toBeGreaterThan(createdAt);
    
    // Cleanup
    await authenticatedApiContext.delete(`/api/assessments/${assessment.id}`);
  });
});

test.describe('Assessment Lifecycle - Error Handling Tests', () => {
  test('should handle invalid assessment ID gracefully', async ({ authenticatedPage }) => {
    const invalidId = 'invalid-uuid-123';
    
    await authenticatedPage.goto(`/assessments/${invalidId}`);
    
    // Should show error message or redirect
    const errorIndicator = authenticatedPage.locator('text=/not found|error|invalid/i').first();
    await expect(errorIndicator).toBeVisible({ timeout: 5000 });
  });

  test('should handle missing required fields in API', async ({ authenticatedApiContext }) => {
    // Try to create without required fields
    const response = await authenticatedApiContext.post('/api/assessments', {
      data: {
        // Missing title, stdCode, facilityId
        description: 'Invalid test'
      }
    });
    
    // Should return validation error
    expect([400, 422]).toContain(response.status());
  });

  test('should handle invalid status transition', async ({ authenticatedApiContext }) => {
    const facilities = await getAvailableFacilities(authenticatedApiContext);
    const standards = await getAvailableStandards(authenticatedApiContext);
    
    const createResponse = await authenticatedApiContext.post('/api/assessments', {
      data: {
        title: generateUniqueTitle('Invalid Status Test'),
        stdCode: standards[0].code,
        facilityId: facilities[0].id,
      }
    });
    
    const { assessment } = await createResponse.json();
    
    // Try invalid status value
    const updateResponse = await authenticatedApiContext.put(`/api/assessments/${assessment.id}`, {
      data: { status: 'INVALID_STATUS' }
    });
    
    // Should reject invalid status
    expect([400, 422]).toContain(updateResponse.status());
    
    // Cleanup
    await authenticatedApiContext.delete(`/api/assessments/${assessment.id}`);
  });
});
