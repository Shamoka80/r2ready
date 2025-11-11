import { db } from "../db";
import { assessments, answers, tenants, users, standardVersions, questions } from "../../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Minimal Phase 6 Test Data Seeder
 * 
 * Creates ONE test assessment with answers using existing database records
 * Minimal dependencies - uses first available tenant, user, standard
 */

async function seedMinimalTestAssessment() {
  console.log("🌱 Seeding minimal test assessment for Phase 6 validation\n");

  try {
    // Step 1: Find existing database records to use as FK references
    console.log("📋 Step 1: Finding existing database records...");
    
    const existingTenant = await db.query.tenants.findFirst();
    if (!existingTenant) {
      console.error("❌ No tenants found - cannot create assessment");
      return;
    }
    console.log(`   ✅ Found tenant: ${existingTenant.id}`);

    const existingUser = await db.query.users.findFirst({
      where: eq(users.tenantId, existingTenant.id)
    });
    if (!existingUser) {
      console.error("❌ No users found for tenant - cannot create assessment");
      return;
    }
    console.log(`   ✅ Found user: ${existingUser.email}`);

    const existingStandard = await db.query.standardVersions.findFirst();
    if (!existingStandard) {
      console.error("❌ No standards found - cannot create assessment");
      return;
    }
    console.log(`   ✅ Found standard: ${existingStandard.code}`);

    const allQuestions = await db.select().from(questions).where(eq(questions.stdId, existingStandard.id));
    const existingQuestions = allQuestions.slice(0, 20); // Get first 20 questions for variety
    if (existingQuestions.length === 0) {
      console.error("❌ No questions found for standard - cannot create assessment");
      return;
    }
    console.log(`   ✅ Found ${existingQuestions.length} questions`);

    // Step 2: Check if test assessment already exists
    console.log("\n🔍 Step 2: Checking for existing test assessment...");
    const [existingAssessment] = await db.select().from(assessments)
      .where(eq(assessments.title, "Phase 6 Test Assessment"))
      .limit(1);

    if (existingAssessment) {
      console.log(`   ⚠️ Test assessment already exists: ${existingAssessment.id}`);
      console.log("   Skipping creation, using existing assessment for validation");
      return { assessmentId: existingAssessment.id };
    }

    // Step 3: Create test assessment
    console.log("\n📝 Step 3: Creating test assessment...");
    const [newAssessment] = await db.insert(assessments).values({
      tenantId: existingTenant.id,
      createdBy: existingUser.id,
      stdId: existingStandard.id,
      title: "Phase 6 Test Assessment",
      description: "Test assessment for Phase 6 validation of scoring orchestrator",
      status: "IN_PROGRESS",
      progress: 0
    }).returning();

    console.log(`   ✅ Created assessment: ${newAssessment.id}`);

    // Step 4: Create test answers with variety (Yes, No, N/A, Partial)
    console.log("\n💬 Step 4: Creating test answers...");
    
    const answerVariants = [
      { value: "yes", description: "Yes answers (compliant)" },
      { value: "no", description: "No answers (non-compliant)" },
      { value: "n/a", description: "N/A answers (not applicable)" },
      { value: "partial", description: "Partial answers" },
    ];

    const answersToCreate = [];
    let answerIndex = 0;

    // Distribute answers across question set with variety
    for (let i = 0; i < existingQuestions.length && i < 20; i++) {
      const question = existingQuestions[i];
      const variant = answerVariants[answerIndex % answerVariants.length];
      
      answersToCreate.push({
        assessmentId: newAssessment.id,
        questionId: question.id,
        answeredBy: existingUser.id,
        value: variant.value,
        notes: `Test answer for Phase 6 validation - ${variant.description}`
      });

      answerIndex++;
    }

    if (answersToCreate.length > 0) {
      await db.insert(answers).values(answersToCreate);
      console.log(`   ✅ Created ${answersToCreate.length} test answers`);
      console.log(`      - ~${Math.floor(answersToCreate.length / 4)} of each type (Yes, No, N/A, Partial)`);
    }

    // Step 5: Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ MINIMAL TEST DATA SEEDED SUCCESSFULLY");
    console.log("=".repeat(60));
    console.log(`Assessment ID: ${newAssessment.id}`);
    console.log(`Status: ${newAssessment.status}`);
    console.log(`Answers: ${answersToCreate.length}`);
    console.log("\n🎯 Ready for Phase 6 validation!");
    console.log("   Run: npx tsx server/tools/validate-phase6-scoring.ts");

    return {
      assessmentId: newAssessment.id,
      answerCount: answersToCreate.length
    };

  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    throw error;
  }
}

// Run seeder
seedMinimalTestAssessment()
  .then((result) => {
    if (result) {
      console.log("\n✅ Seeding complete");
      process.exit(0);
    } else {
      console.log("\n⚠️ Seeding skipped (data already exists)");
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error("\n❌ Seeding error:", error);
    process.exit(1);
  });
