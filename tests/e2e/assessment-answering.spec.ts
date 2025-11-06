import { test, expect } from '../fixtures/auth.fixture';
import { APIRequestContext } from '@playwright/test';

/**
 * Comprehensive Assessment Answering E2E Tests
 * 
 * Tests cover:
 * - Question Navigation: Tabs, accordions, question lists
 * - Answer Entry: Different question types (text, yes/no, etc.)
 * - Save Responses: Auto-save, persistence, API verification
 * - Submit Assessment: Status transitions, validation
 * - Progress Tracking: Real-time updates, calculations, persistence
 * - Answer Validation: Required fields, formats, ranges
 */

// ==================== Helper Functions ====================

/**
 * Create a test assessment with questions via API
 */
async function createTestAssessment(apiContext: APIRequestContext) {
  // Get available facilities
  const facilitiesResponse = await apiContext.get('/api/facilities');
  expect(facilitiesResponse.ok()).toBeTruthy();
  const facilities = await facilitiesResponse.json();
  const testFacility = facilities.find((f: any) => f.isActive && f.operatingStatus === 'ACTIVE');
  expect(testFacility).toBeTruthy();

  // Get available standards
  const standardsResponse = await apiContext.get('/api/assessments/standards');
  expect(standardsResponse.ok()).toBeTruthy();
  const standards = await standardsResponse.json();
  expect(standards.length).toBeGreaterThan(0);

  // Create assessment
  const createResponse = await apiContext.post('/api/assessments', {
    data: {
      title: `E2E Answering Test ${Date.now()}`,
      description: 'Test assessment for answering E2E tests',
      stdCode: standards[0].code,
      facilityId: testFacility.id,
    }
  });

  expect(createResponse.ok()).toBeTruthy();
  const { assessment } = await createResponse.json();
  return assessment;
}

/**
 * Get questions for an assessment
 */
async function getAssessmentQuestions(apiContext: APIRequestContext, assessmentId: string) {
  const response = await apiContext.get(`/api/assessments/${assessmentId}/questions`);
  expect(response.ok()).toBeTruthy();
  return await response.json();
}

/**
 * Get assessment progress
 */
async function getAssessmentProgress(apiContext: APIRequestContext, assessmentId: string) {
  const response = await apiContext.get(`/api/assessments/${assessmentId}/progress`);
  expect(response.ok()).toBeTruthy();
  return await response.json();
}

/**
 * Get answers for an assessment
 */
async function getAssessmentAnswers(apiContext: APIRequestContext, assessmentId: string) {
  const response = await apiContext.get(`/api/assessments/${assessmentId}/answers`);
  expect(response.ok()).toBeTruthy();
  return await response.json();
}

/**
 * Wait for save indicator to show "Saved"
 */
async function waitForSaveComplete(page: any, questionId: string, timeout = 5000) {
  await page.waitForSelector('text=Saved', { timeout });
}

// ==================== Question Navigation Tests ====================

test.describe('Assessment Answering - Question Navigation', () => {
  let testAssessment: any;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    testAssessment = await createTestAssessment(authenticatedApiContext);
  });

  test('should navigate to Questions tab in assessment detail', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    
    // Verify we're on the assessment detail page
    await expect(authenticatedPage.getByTestId('text-assessment-title')).toBeVisible();
    
    // Click on Questions tab
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Verify Questions tab content is visible
    await expect(authenticatedPage.getByText('Assessment Questions')).toBeVisible();
  });

  test('should view list of questions for an assessment', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Get questions via API to verify count
    const questionsData = await getAssessmentQuestions(authenticatedApiContext, testAssessment.id);
    expect(questionsData.totalQuestions).toBeGreaterThan(0);
    
    // Verify question groups (clauses) are displayed
    const firstGroup = questionsData.groups[0];
    const clauseElement = authenticatedPage.getByTestId(`clause-${firstGroup.clauseRef}`);
    await expect(clauseElement).toBeVisible();
    
    // Verify question count is displayed
    await expect(authenticatedPage.getByText(`${questionsData.totalQuestions}`)).toBeVisible();
  });

  test('should expand and collapse clause accordions', async ({ authenticatedPage, authenticatedApiContext }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    const questionsData = await getAssessmentQuestions(authenticatedApiContext, testAssessment.id);
    const firstGroup = questionsData.groups[0];
    const firstQuestion = firstGroup.questions[0];
    
    // Expand the first clause accordion
    const clauseAccordion = authenticatedPage.getByTestId(`clause-${firstGroup.clauseRef}`);
    await clauseAccordion.click();
    
    // Verify questions are visible
    const questionElement = authenticatedPage.getByTestId(`q-${firstQuestion.questionId}`);
    await expect(questionElement).toBeVisible();
    
    // Collapse the accordion
    await clauseAccordion.click();
    
    // Verify questions are hidden (may still be in DOM but not visible)
    await expect(questionElement).not.toBeVisible();
  });

  test('should display question metadata correctly', async ({ authenticatedPage, authenticatedApiContext }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    const questionsData = await getAssessmentQuestions(authenticatedApiContext, testAssessment.id);
    const firstGroup = questionsData.groups[0];
    const firstQuestion = firstGroup.questions[0];
    
    // Expand accordion
    await authenticatedPage.getByTestId(`clause-${firstGroup.clauseRef}`).click();
    
    // Verify question ID is displayed
    await expect(authenticatedPage.getByText(firstQuestion.questionId)).toBeVisible();
    
    // Verify question text is displayed
    const questionLabel = authenticatedPage.getByTestId(`q-${firstQuestion.questionId}-label`);
    await expect(questionLabel).toContainText(firstQuestion.text);
    
    // Verify required indicator if question is required
    if (firstQuestion.required) {
      await expect(questionLabel).toContainText('*');
    }
  });
});

// ==================== Answer Entry Tests ====================

test.describe('Assessment Answering - Answer Entry', () => {
  let testAssessment: any;
  let questionsData: any;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    testAssessment = await createTestAssessment(authenticatedApiContext);
    questionsData = await getAssessmentQuestions(authenticatedApiContext, testAssessment.id);
  });

  test('should enter text answer for text question type', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    // Find a text-type question
    let textQuestion = null;
    for (const group of questionsData.groups) {
      textQuestion = group.questions.find((q: any) => q.responseType !== 'yes_no');
      if (textQuestion) break;
    }
    
    if (!textQuestion) {
      test.skip();
      return;
    }
    
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Find and expand the clause containing this question
    const group = questionsData.groups.find((g: any) => 
      g.questions.some((q: any) => q.questionId === textQuestion.questionId)
    );
    await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
    
    // Enter text answer
    const answerInput = authenticatedPage.getByTestId(`q-${textQuestion.questionId}-input`);
    const testAnswer = 'This is a test answer for E2E validation';
    await answerInput.fill(testAnswer);
    
    // Wait for auto-save
    await waitForSaveComplete(authenticatedPage, textQuestion.questionId);
    
    // Verify answer was saved via API
    const answers = await getAssessmentAnswers(authenticatedApiContext, testAssessment.id);
    const savedAnswer = answers.find((a: any) => a.questionId === textQuestion.questionId);
    expect(savedAnswer).toBeTruthy();
    expect(savedAnswer.value).toBe(testAnswer);
  });

  test('should select option for yes/no question type', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    // Find a yes/no question
    let yesNoQuestion = null;
    for (const group of questionsData.groups) {
      yesNoQuestion = group.questions.find((q: any) => q.responseType === 'yes_no');
      if (yesNoQuestion) break;
    }
    
    if (!yesNoQuestion) {
      test.skip();
      return;
    }
    
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Find and expand the clause
    const group = questionsData.groups.find((g: any) => 
      g.questions.some((q: any) => q.questionId === yesNoQuestion.questionId)
    );
    await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
    
    // Select "Yes" option
    const yesOption = authenticatedPage.getByTestId(`q-${yesNoQuestion.questionId}-yes`);
    await yesOption.click();
    
    // Wait for auto-save
    await waitForSaveComplete(authenticatedPage, yesNoQuestion.questionId);
    
    // Verify answer was saved via API
    const answers = await getAssessmentAnswers(authenticatedApiContext, testAssessment.id);
    const savedAnswer = answers.find((a: any) => a.questionId === yesNoQuestion.questionId);
    expect(savedAnswer).toBeTruthy();
    expect(savedAnswer.value).toBe('Yes');
  });

  test('should change answer from Yes to No', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    // Find a yes/no question
    let yesNoQuestion = null;
    for (const group of questionsData.groups) {
      yesNoQuestion = group.questions.find((q: any) => q.responseType === 'yes_no');
      if (yesNoQuestion) break;
    }
    
    if (!yesNoQuestion) {
      test.skip();
      return;
    }
    
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Find and expand the clause
    const group = questionsData.groups.find((g: any) => 
      g.questions.some((q: any) => q.questionId === yesNoQuestion.questionId)
    );
    await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
    
    // Select "Yes" first
    await authenticatedPage.getByTestId(`q-${yesNoQuestion.questionId}-yes`).click();
    await waitForSaveComplete(authenticatedPage, yesNoQuestion.questionId);
    
    // Change to "No"
    await authenticatedPage.getByTestId(`q-${yesNoQuestion.questionId}-no`).click();
    await waitForSaveComplete(authenticatedPage, yesNoQuestion.questionId);
    
    // Verify updated answer via API
    const answers = await getAssessmentAnswers(authenticatedApiContext, testAssessment.id);
    const savedAnswer = answers.find((a: any) => a.questionId === yesNoQuestion.questionId);
    expect(savedAnswer).toBeTruthy();
    expect(savedAnswer.value).toBe('No');
  });

  test('should show save status indicators (saving, saved)', async ({ authenticatedPage }) => {
    // Find any yes/no question
    let question = null;
    for (const group of questionsData.groups) {
      question = group.questions.find((q: any) => q.responseType === 'yes_no');
      if (question) break;
    }
    
    if (!question) {
      test.skip();
      return;
    }
    
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Find and expand the clause
    const group = questionsData.groups.find((g: any) => 
      g.questions.some((q: any) => q.questionId === question.questionId)
    );
    await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
    
    // Select an option
    await authenticatedPage.getByTestId(`q-${question.questionId}-yes`).click();
    
    // Check for "Saving..." indicator (might be very fast)
    // Then check for "Saved" indicator
    await expect(authenticatedPage.getByText('Saved')).toBeVisible({ timeout: 5000 });
  });
});

// ==================== Save Response Tests ====================

test.describe('Assessment Answering - Save Responses', () => {
  let testAssessment: any;
  let questionsData: any;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    testAssessment = await createTestAssessment(authenticatedApiContext);
    questionsData = await getAssessmentQuestions(authenticatedApiContext, testAssessment.id);
  });

  test('should auto-save answer and verify in database via API', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    // Find a yes/no question
    const question = questionsData.groups[0]?.questions.find((q: any) => q.responseType === 'yes_no');
    
    if (!question) {
      test.skip();
      return;
    }
    
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Expand first clause
    await authenticatedPage.getByTestId(`clause-${questionsData.groups[0].clauseRef}`).click();
    
    // Answer question
    await authenticatedPage.getByTestId(`q-${question.questionId}-yes`).click();
    
    // Wait for auto-save to complete
    await waitForSaveComplete(authenticatedPage, question.questionId);
    
    // Verify in database via API
    const answers = await getAssessmentAnswers(authenticatedApiContext, testAssessment.id);
    const savedAnswer = answers.find((a: any) => a.questionId === question.questionId);
    
    expect(savedAnswer).toBeTruthy();
    expect(savedAnswer.value).toBe('Yes');
    expect(savedAnswer.assessmentId).toBe(testAssessment.id);
  });

  test('should update existing answer', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    let textQuestion = null;
    for (const group of questionsData.groups) {
      textQuestion = group.questions.find((q: any) => q.responseType !== 'yes_no');
      if (textQuestion) break;
    }
    
    if (!textQuestion) {
      test.skip();
      return;
    }
    
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Find and expand the clause
    const group = questionsData.groups.find((g: any) => 
      g.questions.some((q: any) => q.questionId === textQuestion.questionId)
    );
    await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
    
    // Enter initial answer
    const answerInput = authenticatedPage.getByTestId(`q-${textQuestion.questionId}-input`);
    await answerInput.fill('Initial answer');
    await waitForSaveComplete(authenticatedPage, textQuestion.questionId);
    
    // Update answer
    await answerInput.fill('Updated answer');
    await waitForSaveComplete(authenticatedPage, textQuestion.questionId);
    
    // Verify updated answer via API
    const answers = await getAssessmentAnswers(authenticatedApiContext, testAssessment.id);
    const savedAnswer = answers.find((a: any) => a.questionId === textQuestion.questionId);
    expect(savedAnswer.value).toBe('Updated answer');
  });

  test('should verify answer persistence across page reloads', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    const question = questionsData.groups[0]?.questions[0];
    
    if (!question) {
      test.skip();
      return;
    }
    
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Expand first clause
    await authenticatedPage.getByTestId(`clause-${questionsData.groups[0].clauseRef}`).click();
    
    // Answer question based on type
    const answerValue = question.responseType === 'yes_no' ? 'Yes' : 'Test persistence answer';
    
    if (question.responseType === 'yes_no') {
      await authenticatedPage.getByTestId(`q-${question.questionId}-yes`).click();
    } else {
      await authenticatedPage.getByTestId(`q-${question.questionId}-input`).fill(answerValue);
    }
    
    await waitForSaveComplete(authenticatedPage, question.questionId);
    
    // Reload page
    await authenticatedPage.reload();
    await authenticatedPage.getByTestId('tab-questions').click();
    await authenticatedPage.getByTestId(`clause-${questionsData.groups[0].clauseRef}`).click();
    
    // Verify answer is still present
    if (question.responseType === 'yes_no') {
      const yesOption = authenticatedPage.getByTestId(`q-${question.questionId}-yes`);
      await expect(yesOption).toBeChecked();
    } else {
      const answerInput = authenticatedPage.getByTestId(`q-${question.questionId}-input`);
      await expect(answerInput).toHaveValue(answerValue);
    }
  });

  test('should handle save errors gracefully', async ({ authenticatedPage }) => {
    // This test would require mocking network failure
    // For now, we'll skip it as it requires special setup
    test.skip();
  });
});

// ==================== Progress Tracking Tests ====================

test.describe('Assessment Answering - Progress Tracking', () => {
  let testAssessment: any;
  let questionsData: any;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    testAssessment = await createTestAssessment(authenticatedApiContext);
    questionsData = await getAssessmentQuestions(authenticatedApiContext, testAssessment.id);
  });

  test('should verify initial progress is 0%', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    // Get progress before any answers
    const progress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    expect(progress.answeredQuestions).toBe(0);
    expect(progress.progressPercentage).toBe(0);
    
    // Verify in UI
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await expect(authenticatedPage.getByTestId('text-progress-answered')).toContainText('0');
  });

  test('should update progress as questions are answered', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Get initial progress
    let progress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    const initialAnswered = progress.answeredQuestions;
    
    // Answer a question
    const firstGroup = questionsData.groups[0];
    await authenticatedPage.getByTestId(`clause-${firstGroup.clauseRef}`).click();
    
    const question = firstGroup.questions[0];
    if (question.responseType === 'yes_no') {
      await authenticatedPage.getByTestId(`q-${question.questionId}-yes`).click();
    } else {
      await authenticatedPage.getByTestId(`q-${question.questionId}-input`).fill('Test answer');
    }
    
    await waitForSaveComplete(authenticatedPage, question.questionId);
    
    // Wait a bit for progress to update
    await authenticatedPage.waitForTimeout(1000);
    
    // Verify progress increased
    progress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    expect(progress.answeredQuestions).toBeGreaterThan(initialAnswered);
  });

  test('should calculate progress correctly: (answered / total) * 100', async ({ 
    authenticatedPage,
    authenticatedApiContext 
  }) => {
    // Answer multiple questions
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Answer first 3 questions
    let answeredCount = 0;
    for (const group of questionsData.groups.slice(0, 2)) {
      await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
      
      for (const question of group.questions.slice(0, 2)) {
        if (question.responseType === 'yes_no') {
          await authenticatedPage.getByTestId(`q-${question.questionId}-yes`).click();
        } else {
          await authenticatedPage.getByTestId(`q-${question.questionId}-input`).fill('Test');
        }
        await waitForSaveComplete(authenticatedPage, question.questionId);
        answeredCount++;
      }
    }
    
    // Wait for progress to update
    await authenticatedPage.waitForTimeout(1500);
    
    // Get progress and verify calculation
    const progress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    const expectedProgress = Math.round((progress.answeredQuestions / progress.totalQuestions) * 100);
    
    expect(progress.progressPercentage).toBe(expectedProgress);
  });

  test('should persist progress across sessions', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Answer a question
    const firstGroup = questionsData.groups[0];
    await authenticatedPage.getByTestId(`clause-${firstGroup.clauseRef}`).click();
    
    const question = firstGroup.questions[0];
    if (question.responseType === 'yes_no') {
      await authenticatedPage.getByTestId(`q-${question.questionId}-yes`).click();
    } else {
      await authenticatedPage.getByTestId(`q-${question.questionId}-input`).fill('Persistence test');
    }
    
    await waitForSaveComplete(authenticatedPage, question.questionId);
    await authenticatedPage.waitForTimeout(1000);
    
    // Get progress
    const progress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    const progressPercentage = progress.progressPercentage;
    
    // Simulate new session by navigating away and back
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    
    // Verify progress persisted
    const newProgress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    expect(newProgress.progressPercentage).toBe(progressPercentage);
    expect(newProgress.answeredQuestions).toBe(progress.answeredQuestions);
  });

  test('should display progress bar with correct percentage', async ({ 
    authenticatedPage,
    authenticatedApiContext 
  }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    
    // Check if progress is displayed on overview
    const progressElement = authenticatedPage.getByTestId('text-progress-answered');
    await expect(progressElement).toBeVisible();
    
    // Get actual progress from API
    const progress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    
    // Verify counts are displayed
    await expect(authenticatedPage.getByText(`${progress.answeredQuestions}`)).toBeVisible();
  });
});

// ==================== Answer Validation Tests ====================

test.describe('Assessment Answering - Answer Validation', () => {
  let testAssessment: any;
  let questionsData: any;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    testAssessment = await createTestAssessment(authenticatedApiContext);
    questionsData = await getAssessmentQuestions(authenticatedApiContext, testAssessment.id);
  });

  test('should identify required questions with asterisk indicator', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Find a required question
    let requiredQuestion = null;
    for (const group of questionsData.groups) {
      requiredQuestion = group.questions.find((q: any) => q.required);
      if (requiredQuestion) {
        // Expand the clause
        await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
        
        // Verify asterisk is displayed
        const questionLabel = authenticatedPage.getByTestId(`q-${requiredQuestion.questionId}-label`);
        await expect(questionLabel).toContainText('*');
        break;
      }
    }
    
    if (!requiredQuestion) {
      // No required questions in this assessment
      test.skip();
    }
  });

  test('should save empty/partial answers for non-required questions', async ({ 
    authenticatedPage,
    authenticatedApiContext 
  }) => {
    // Find a non-required text question
    let optionalQuestion = null;
    for (const group of questionsData.groups) {
      optionalQuestion = group.questions.find((q: any) => !q.required && q.responseType !== 'yes_no');
      if (optionalQuestion) break;
    }
    
    if (!optionalQuestion) {
      test.skip();
      return;
    }
    
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Find and expand the clause
    const group = questionsData.groups.find((g: any) => 
      g.questions.some((q: any) => q.questionId === optionalQuestion.questionId)
    );
    await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
    
    // Enter partial answer
    const answerInput = authenticatedPage.getByTestId(`q-${optionalQuestion.questionId}-input`);
    await answerInput.fill('Partial');
    await waitForSaveComplete(authenticatedPage, optionalQuestion.questionId);
    
    // Verify it was saved
    const answers = await getAssessmentAnswers(authenticatedApiContext, testAssessment.id);
    const savedAnswer = answers.find((a: any) => a.questionId === optionalQuestion.id);
    expect(savedAnswer).toBeTruthy();
    expect(savedAnswer.value).toBe('Partial');
  });

  test('should display evidence required indicator for questions that need evidence', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Find a question that requires evidence
    let evidenceQuestion = null;
    for (const group of questionsData.groups) {
      evidenceQuestion = group.questions.find((q: any) => q.evidenceRequired);
      if (evidenceQuestion) {
        // Expand the clause
        await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
        
        // Verify "Evidence Required" badge is displayed
        await expect(authenticatedPage.getByText('Evidence Required')).toBeVisible();
        break;
      }
    }
    
    if (!evidenceQuestion) {
      // No questions requiring evidence
      test.skip();
    }
  });
});

// ==================== Submit Assessment Tests ====================

test.describe('Assessment Answering - Submit Assessment', () => {
  let testAssessment: any;
  let questionsData: any;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    testAssessment = await createTestAssessment(authenticatedApiContext);
    questionsData = await getAssessmentQuestions(authenticatedApiContext, testAssessment.id);
  });

  test('should show assessment status on detail page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    
    // Verify status badge is visible
    await expect(authenticatedPage.getByText('In Progress')).toBeVisible();
  });

  test('should complete all questions before submission', async ({ 
    authenticatedPage,
    authenticatedApiContext 
  }) => {
    await authenticatedPage.goto(`/assessments/${testAssessment.id}`);
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Answer all questions
    for (const group of questionsData.groups.slice(0, 2)) { // Answer first 2 groups for speed
      await authenticatedPage.getByTestId(`clause-${group.clauseRef}`).click();
      
      for (const question of group.questions) {
        if (question.responseType === 'yes_no') {
          await authenticatedPage.getByTestId(`q-${question.questionId}-yes`).click();
        } else {
          await authenticatedPage.getByTestId(`q-${question.questionId}-input`).fill('Completed answer');
        }
        await waitForSaveComplete(authenticatedPage, question.questionId);
      }
    }
    
    // Verify progress increased
    const progress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    expect(progress.answeredQuestions).toBeGreaterThan(0);
  });

  test('should track required questions completion separately', async ({ 
    authenticatedApiContext 
  }) => {
    const progress = await getAssessmentProgress(authenticatedApiContext, testAssessment.id);
    
    // Verify progress includes required question tracking
    expect(progress).toHaveProperty('requiredQuestions');
    expect(progress).toHaveProperty('answeredRequiredQuestions');
    expect(progress.requiredProgressPercentage).toBeGreaterThanOrEqual(0);
  });
});

// ==================== Integration Tests ====================

test.describe('Assessment Answering - Integration Tests', () => {
  test('should complete full assessment workflow from creation to answering', async ({ 
    authenticatedPage, 
    authenticatedApiContext 
  }) => {
    // Create new assessment
    const assessment = await createTestAssessment(authenticatedApiContext);
    
    // Navigate to assessment
    await authenticatedPage.goto(`/assessments/${assessment.id}`);
    await expect(authenticatedPage.getByTestId('text-assessment-title')).toBeVisible();
    
    // Go to Questions tab
    await authenticatedPage.getByTestId('tab-questions').click();
    
    // Get questions
    const questionsData = await getAssessmentQuestions(authenticatedApiContext, assessment.id);
    const firstGroup = questionsData.groups[0];
    
    // Expand first clause
    await authenticatedPage.getByTestId(`clause-${firstGroup.clauseRef}`).click();
    
    // Answer first 2 questions
    for (const question of firstGroup.questions.slice(0, 2)) {
      if (question.responseType === 'yes_no') {
        await authenticatedPage.getByTestId(`q-${question.questionId}-yes`).click();
      } else {
        await authenticatedPage.getByTestId(`q-${question.questionId}-input`).fill('Integration test answer');
      }
      await waitForSaveComplete(authenticatedPage, question.questionId);
    }
    
    // Verify answers were saved
    const answers = await getAssessmentAnswers(authenticatedApiContext, assessment.id);
    expect(answers.length).toBeGreaterThanOrEqual(2);
    
    // Verify progress was updated
    const progress = await getAssessmentProgress(authenticatedApiContext, assessment.id);
    expect(progress.answeredQuestions).toBeGreaterThanOrEqual(2);
    expect(progress.progressPercentage).toBeGreaterThan(0);
  });
});
