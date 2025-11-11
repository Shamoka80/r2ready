import { db } from "../db";
import { 
  tenants,
  users,
  intakeForms,
  assessments,
  questions,
  answers
} from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { AuthService } from "../services/authService";

/**
 * Phase 6: Test Data Seed Script
 * 
 * Creates deterministic test scenarios for comprehensive validation:
 * 1. Baseline Assessment - Mix of answers for normal scoring
 * 2. Critical Gate Failure - Answers that trigger must-pass blockers
 * 3. N/A Edge Cases - Heavy N/A usage to test exclusion logic
 * 4. Maturity Dimensions - Questions targeting BCP/CI/Stakeholder scoring
 */

export async function seedPhase6TestData() {
  console.log("🌱 Starting Phase 6 Test Data seeding...\n");

  try {
    // Step 0: Clear existing test data
    console.log("🧹 Step 0: Clearing existing Phase 6 test data...");
    await clearPhase6TestData();
    console.log("✅ Cleared existing test data\n");

    // Step 1: Create test tenant and user
    console.log("👤 Step 1: Creating test tenant and user...");
    const { tenant, user, token } = await createTestTenantAndUser();
    console.log(`✅ Created tenant: ${tenant.name} (ID: ${tenant.id})`);
    console.log(`✅ Created user: ${user.email} (ID: ${user.id})`);
    console.log(`✅ Session token: ${token.substring(0, 20)}...`);

    // Step 2: Create baseline assessment scenario
    console.log("\n📊 Step 2: Creating baseline assessment scenario...");
    const baselineAssessment = await createBaselineAssessment(tenant.id, user.id);
    console.log(`✅ Created baseline assessment: ${baselineAssessment.id}`);
    console.log(`   - ${baselineAssessment.questionCount} questions`);
    console.log(`   - Expected score: ~75% (NEEDS_IMPROVEMENT)`);

    // Step 3: Create critical gate failure scenario
    console.log("\n🚫 Step 3: Creating critical gate failure scenario...");
    const criticalGateAssessment = await createCriticalGateFailureAssessment(tenant.id, user.id);
    console.log(`✅ Created critical gate assessment: ${criticalGateAssessment.id}`);
    console.log(`   - ${criticalGateAssessment.questionCount} questions`);
    console.log(`   - Expected: Multiple must-pass blockers`);

    // Step 4: Create N/A edge case scenario
    console.log("\n❓ Step 4: Creating N/A edge case scenario...");
    const naEdgeCaseAssessment = await createNAEdgeCaseAssessment(tenant.id, user.id);
    console.log(`✅ Created N/A edge case assessment: ${naEdgeCaseAssessment.id}`);
    console.log(`   - ${naEdgeCaseAssessment.questionCount} questions`);
    console.log(`   - ${naEdgeCaseAssessment.naCount} N/A answers (~40%)`);
    console.log(`   - Tests N/A exclusion from denominators`);

    // Step 5: Create maturity scoring scenario
    console.log("\n📈 Step 5: Creating maturity scoring scenario...");
    const maturityAssessment = await createMaturityScoringAssessment(tenant.id, user.id);
    console.log(`✅ Created maturity assessment: ${maturityAssessment.id}`);
    console.log(`   - ${maturityAssessment.questionCount} questions`);
    console.log(`   - Targets BCP, CI, and Stakeholder dimensions`);

    console.log("\n🎉 Phase 6 test data seeding complete!");
    console.log("\n📋 Test Scenarios Summary:");
    console.log(`   1. Baseline: ${baselineAssessment.id} - Normal scoring, mixed answers`);
    console.log(`   2. Critical Gates: ${criticalGateAssessment.id} - Must-pass failures`);
    console.log(`   3. N/A Edge Cases: ${naEdgeCaseAssessment.id} - N/A exclusion testing`);
    console.log(`   4. Maturity: ${maturityAssessment.id} - BCP/CI/Stakeholder scoring`);
    console.log(`\n   Test Tenant: ${tenant.id}`);
    console.log(`   Test User: ${user.id}`);
    console.log(`   Auth Token: ${token}`);

    return {
      success: true,
      tenant,
      user,
      token,
      assessments: {
        baseline: baselineAssessment.id,
        criticalGate: criticalGateAssessment.id,
        naEdgeCase: naEdgeCaseAssessment.id,
        maturity: maturityAssessment.id
      }
    };

  } catch (error) {
    console.error("❌ Error seeding Phase 6 test data:", error);
    throw error;
  }
}

/**
 * Clear existing Phase 6 test data
 */
async function clearPhase6TestData() {
  // Delete test answers first (FK to assessments)
  await db.delete(answers).where(
    sql`"assessmentId" IN (SELECT id FROM "Assessment" WHERE "tenantId" LIKE 'phase6-test-%')`
  );
  
  // Delete test assessments
  await db.delete(assessments).where(
    sql`"tenantId" LIKE 'phase6-test-%'`
  );
  
  // Delete test intake forms
  await db.delete(intakeForms).where(
    sql`"tenantId" LIKE 'phase6-test-%'`
  );
  
  // Delete test users
  await db.delete(users).where(
    sql`"tenantId" LIKE 'phase6-test-%'`
  );
  
  // Delete test tenants
  await db.delete(tenants).where(
    sql`id LIKE 'phase6-test-%'`
  );
  
  console.log("  ✓ Cleared test assessments, answers, users, and tenants");
}

/**
 * Create test tenant and user with auth token
 */
async function createTestTenantAndUser() {
  const tenantId = `phase6-test-tenant-${Date.now()}`;
  
  // Create tenant
  const [tenant] = await db.insert(tenants).values({
    id: tenantId,
    name: 'Phase 6 Test Organization',
    tenantType: 'BUSINESS',
    domain: 'phase6-test.example.com',
    isActive: true,
    licenseStatus: 'active',
    settings: {
      timezone: 'America/New_York',
      notifications: false
    }
  }).returning();

  // Create user
  const passwordHash = await AuthService.hashPassword('TestPassword123!');
  const userResult = await db.insert(users).values({
    id: `phase6-test-user-${Date.now()}`,
    tenantId: tenant.id,
    email: `phase6-test-${Date.now()}@example.com`,
    passwordHash,
    firstName: 'Phase6',
    lastName: 'TestUser',
    businessRole: 'facility_manager',
    isActive: true,
    emailVerified: true,
    setupStatus: 'setup_complete'
  }).returning();
  const user = userResult[0];

  // Create session token
  const { token } = await AuthService.createSession(
    user.id,
    tenant.id,
    '127.0.0.1',
    'Phase 6 Test Suite'
  );

  return { tenant, user, token };
}

/**
 * Scenario 1: Baseline Assessment
 * Mix of Yes/Partial/No answers targeting ~75% score (NEEDS_IMPROVEMENT)
 */
async function createBaselineAssessment(tenantId: string, answeredBy: string) {
  // Get a representative sample of questions across categories
  const allQuestions = await db.query.questions.findMany({
    where: sql`category IS NOT NULL`,
    limit: 50
  });

  const assessmentId = `phase6-baseline-${Date.now()}`;
  
  // Create assessment
  const [assessment] = await db.insert(assessments).values({
    id: assessmentId,
    tenantId,
    createdBy: answeredBy,
    title: 'Phase 6 Baseline Test Assessment',
    status: 'IN_PROGRESS',
    createdAt: new Date()
  }).returning();

  // Create answers: 60% Yes, 20% Partial, 15% No, 5% N/A
  // Expected weighted score: ~75%
  // Deterministic pattern (no randomization)
  const answerRecords = allQuestions.map((q, idx) => {
    let value: 'Yes' | 'Partial' | 'No' | 'N/A';
    if (idx < 30) value = 'Yes';           // 60%
    else if (idx < 40) value = 'Partial';  // 20%
    else if (idx < 48) value = 'No';       // 15%
    else value = 'N/A';                     // 5%

    return {
      assessmentId: assessment.id,
      questionId: q.id!,
      answeredBy,
      value,
      notes: `Baseline test answer ${idx + 1}`
    };
  });

  await db.insert(answers).values(answerRecords);

  return {
    id: assessment.id,
    questionCount: allQuestions.length,
    expectedScore: 75
  };
}

/**
 * Scenario 2: Critical Gate Failure
 * Answer "No" to must-pass questions to trigger blockers
 */
async function createCriticalGateFailureAssessment(tenantId: string, answeredBy: string) {
  // Get must-pass mapped questions
  const mustPassQuestions = await db.query.mustPassRuleQuestions.findMany({
    with: {
      question: true,
      rule: true
    },
    limit: 20  // Get enough to trigger multiple must-pass failures
  });

  // Get additional questions to fill out the assessment
  const additionalQuestions = await db.query.questions.findMany({
    where: sql`category IS NOT NULL`,
    limit: 30
  });

  const assessmentId = `phase6-critical-gate-${Date.now()}`;
  
  const [assessment] = await db.insert(assessments).values({
    id: assessmentId,
    tenantId,
    createdBy: answeredBy,
    title: 'Phase 6 Critical Gate Failure Test',
    status: 'IN_PROGRESS',
    createdAt: new Date()
  }).returning();

  // Answer "No" to all must-pass questions (triggers blockers)
  const mustPassAnswers = mustPassQuestions.map(mp => {
    const ruleData = mp.rule as any;
    return {
      assessmentId: assessment.id,
      questionId: mp.questionId,
      answeredBy,
      value: 'No' as 'Yes' | 'No' | 'Partial' | 'N/A',
      notes: `Critical failure: ${ruleData?.ruleName || 'Must-pass requirement'}`
    };
  });

  // Answer mix for additional questions
  const additionalAnswers = additionalQuestions.map((q, idx) => {
    const val = idx % 2 === 0 ? 'Yes' : 'Partial';
    return {
      assessmentId: assessment.id,
      questionId: q.id!,
      answeredBy,
      value: val as 'Yes' | 'No' | 'Partial' | 'N/A',
      notes: `Additional question ${idx + 1}`
    };
  });

  await db.insert(answers).values([...mustPassAnswers, ...additionalAnswers]);

  return {
    id: assessment.id,
    questionCount: mustPassQuestions.length + additionalQuestions.length,
    expectedBlockers: mustPassQuestions.length
  };
}

/**
 * Scenario 3: N/A Edge Cases
 * ~40% N/A answers to test denominator exclusion logic
 */
async function createNAEdgeCaseAssessment(tenantId: string, answeredBy: string) {
  const allQuestions = await db.query.questions.findMany({
    where: sql`category IS NOT NULL`,
    limit: 60
  });

  const assessmentId = `phase6-na-edge-${Date.now()}`;
  
  const [assessment] = await db.insert(assessments).values({
    id: assessmentId,
    tenantId,
    createdBy: answeredBy,
    title: 'Phase 6 N/A Edge Case Test',
    status: 'IN_PROGRESS',
    createdAt: new Date()
  }).returning();

  // Create deterministic answer pattern: 40% N/A, 60% mix of Yes/Partial/No
  let naCount = 0;
  
  const answerRecords = allQuestions.map((q, idx) => {
    let value: 'Yes' | 'Partial' | 'No' | 'N/A';
    
    if (idx % 5 < 2) {  // 40% N/A
      value = 'N/A';
      naCount++;
    } else if (idx % 3 === 0) {
      value = 'Yes';
    } else if (idx % 3 === 1) {
      value = 'Partial';
    } else {
      value = 'No';
    }

    return {
      assessmentId: assessment.id,
      questionId: q.id!,
      answeredBy,
      value,
      notes: value === 'N/A' ? 'Not applicable to this facility' : `Answer ${idx + 1}`
    };
  });

  await db.insert(answers).values(answerRecords);

  return {
    id: assessment.id,
    questionCount: allQuestions.length,
    naCount,
    naPercentage: Math.round((naCount / allQuestions.length) * 100)
  };
}

/**
 * Scenario 4: Maturity Scoring
 * Target questions in maturity categories (if marked in schema)
 */
async function createMaturityScoringAssessment(tenantId: string, answeredBy: string) {
  // Get questions across different categories that would map to maturity dimensions
  // BCP: Business Continuity Planning (legal, facility, management questions)
  // CI: Continuous Improvement (process, training questions)
  // Stakeholder: Stakeholder Engagement (supply chain, downstream vendor questions)
  
  const allQuestions = await db.query.questions.findMany({
    where: sql`category IN ('LEGAL', 'FACILITY', 'MANAGEMENT', 'PROCESSING', 'SUPPLY_CHAIN') AND category IS NOT NULL`,
    limit: 45
  });

  const assessmentId = `phase6-maturity-${Date.now()}`;
  
  const [assessment] = await db.insert(assessments).values({
    id: assessmentId,
    tenantId,
    createdBy: answeredBy,
    title: 'Phase 6 Maturity Scoring Test',
    status: 'IN_PROGRESS',
    createdAt: new Date()
  }).returning();

  // Create varied answers to test maturity level determination
  // Strong in some dimensions, weak in others
  const answerRecords = allQuestions.map((q, idx) => {
    let value: 'Yes' | 'Partial' | 'No' | 'N/A';
    
    // Legal/Facility questions: Strong (mostly Yes) - High BCP maturity
    if (q.category === 'LEGAL' || q.category === 'FACILITY') {
      value = idx % 4 === 0 ? 'Partial' : 'Yes';
    }
    // Processing questions: Medium (mix) - Medium CI maturity
    else if (q.category === 'PROCESSING') {
      value = idx % 3 === 0 ? 'Partial' : (idx % 3 === 1 ? 'Yes' : 'No');
    }
    // Supply chain: Weak (mostly Partial/No) - Low Stakeholder maturity
    else {
      value = idx % 3 === 0 ? 'Yes' : (idx % 3 === 1 ? 'Partial' : 'No');
    }

    return {
      assessmentId: assessment.id,
      questionId: q.id!,
      answeredBy,
      value,
      notes: `Maturity test: ${q.category} dimension`
    };
  });

  await db.insert(answers).values(answerRecords);

  return {
    id: assessment.id,
    questionCount: allQuestions.length,
    expectedMaturity: {
      bcp: 'HIGH',
      ci: 'MEDIUM',
      stakeholder: 'LOW'
    }
  };
}

// Run if executed directly
seedPhase6TestData()
  .then(() => {
    console.log("\n✅ Seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  });
