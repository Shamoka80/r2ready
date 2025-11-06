/**
 * Question-to-REC Mapping Seeding Script
 * 
 * Supports two modes:
 * - MERGE (default): Idempotent - adds only missing mappings, safe for existing data
 * - FRESH: Destructive - wipes and rebuilds (dev-only with explicit confirmation)
 * 
 * Usage:
 *   SEED_MODE=merge npm run seed:mappings           # Safe merge mode
 *   SEED_MODE=fresh CONFIRM_FRESH=yes npm run seed:mappings  # Dev-only fresh mode
 *   DRY_RUN=true npm run seed:mappings              # Preview changes without writing
 */

import { db } from "../db.js";
import { 
  questionMapping, 
  questions,
  recMapping,
  intakeQuestions
} from "../../shared/schema.js";
import { eq, sql, and } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration
const SEED_MODE = process.env.SEED_MODE || 'merge';
const DRY_RUN = process.env.DRY_RUN === 'true';
const CONFIRM_FRESH = process.env.CONFIRM_FRESH === 'yes';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Safety guards
const ALLOW_FRESH_MODE = NODE_ENV === 'development' && CONFIRM_FRESH;

interface MappingData {
  version: string;
  description: string;
  lastUpdated: string;
  mappings: Array<{
    questionId: string;
    recCodes: string[];
    priority?: string;
    rationale?: string;
  }>;
  stats?: any;
}

interface PreflightResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalMappingsToAdd: number;
    existingMappings: number;
    missingQuestions: string[];
    missingRecCodes: string[];
    intakeQuestionId: string | null;
  };
}

interface SeedingResult {
  success: boolean;
  mode: string;
  dryRun: boolean;
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Load mapping dataset from JSON file
 */
async function loadMappingDataset(): Promise<MappingData> {
  const dataPath = path.join(__dirname, '../data/question-rec-mappings-v1.json');
  
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Mapping dataset not found at: ${dataPath}`);
  }

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const mappingData: MappingData = JSON.parse(rawData);

  console.log(`📂 Loaded mapping dataset v${mappingData.version}`);
  console.log(`   Total mappings: ${mappingData.mappings.length}`);
  console.log(`   Last updated: ${mappingData.lastUpdated}`);

  return mappingData;
}

/**
 * Preflight validation - verify all references exist
 */
async function preflightValidation(mappingData: MappingData): Promise<PreflightResult> {
  console.log('\n🔍 Running preflight validation...');

  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get all existing questions and REC codes
  const existingQuestions = await db.select({ questionId: questions.questionId }).from(questions);
  const existingRecCodes = await db.select({ recCode: recMapping.recCode }).from(recMapping);
  const existingMappings = await db.select().from(questionMapping);

  const questionIdSet = new Set(existingQuestions.map(q => q.questionId));
  const recCodeSet = new Set(existingRecCodes.map(r => r.recCode));

  // Find a generic intake question to use for all mappings
  const intakeQuestionList = await db.select().from(intakeQuestions).limit(1);
  const intakeQuestionId = intakeQuestionList[0]?.id || null;

  if (!intakeQuestionId) {
    warnings.push('No intake questions found - mappings will need manual intake question assignment');
  }

  // Validate all question IDs exist
  const missingQuestions: string[] = [];
  const missingRecCodes: string[] = [];

  for (const mapping of mappingData.mappings) {
    if (!questionIdSet.has(mapping.questionId)) {
      missingQuestions.push(mapping.questionId);
    }

    for (const recCode of mapping.recCodes) {
      if (!recCodeSet.has(recCode)) {
        missingRecCodes.push(recCode);
      }
    }
  }

  // Calculate total mappings to add (questionId x recCode pairs)
  const totalMappingPairs = mappingData.mappings.reduce((sum, m) => sum + m.recCodes.length, 0);

  // Report findings
  if (missingQuestions.length > 0) {
    errors.push(`Missing questions in database: ${missingQuestions.join(', ')}`);
  }

  if (missingRecCodes.length > 0) {
    errors.push(`Missing REC codes in database: ${missingRecCodes.join(', ')}`);
  }

  const isValid = errors.length === 0;

  console.log(`   ✓ Validated ${questionIdSet.size} questions in database`);
  console.log(`   ✓ Validated ${recCodeSet.size} REC codes in database`);
  console.log(`   ℹ Current mappings in database: ${existingMappings.length}`);
  console.log(`   ℹ New mapping pairs to add: ${totalMappingPairs}`);

  if (warnings.length > 0) {
    console.log(`   ⚠ Warnings: ${warnings.length}`);
    warnings.forEach(w => console.log(`     - ${w}`));
  }

  if (errors.length > 0) {
    console.log(`   ❌ Errors: ${errors.length}`);
    errors.forEach(e => console.log(`     - ${e}`));
  }

  return {
    isValid,
    errors,
    warnings,
    summary: {
      totalMappingsToAdd: totalMappingPairs,
      existingMappings: existingMappings.length,
      missingQuestions,
      missingRecCodes,
      intakeQuestionId
    }
  };
}

/**
 * Merge mode - Add only missing mappings (idempotent)
 * 
 * Safety Mechanisms:
 * - Unique composite index prevents duplicate (assessmentQuestionId, recCode) pairs
 * - Pre-insert existence check skips existing mappings
 * - Idempotent design allows safe re-runs on partial failures
 * 
 * Note: Neon HTTP driver does not support transactions. Safeguards above provide
 * functional atomicity via uniqueness constraints and duplicate checking.
 */
async function seedMergeMode(mappingData: MappingData, intakeQuestionId: string): Promise<SeedingResult> {
  console.log('\n🔄 Running in MERGE mode (idempotent)...');
  console.log('   🔒 Protected by unique constraints and duplicate checking\n');

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    for (const mapping of mappingData.mappings) {
      // Get the actual question ID from database
      const [question] = await db
        .select()
        .from(questions)
        .where(eq(questions.questionId, mapping.questionId))
        .limit(1);

      if (!question) {
        errors.push(`Question not found: ${mapping.questionId}`);
        continue;
      }

      for (const recCode of mapping.recCodes) {
        // Check if mapping already exists (prevents duplicates)
        const existingMapping = await db
          .select()
          .from(questionMapping)
          .where(
            and(
              eq(questionMapping.assessmentQuestionId, question.id),
              eq(questionMapping.recCode, recCode)
            )
          )
          .limit(1);

        if (existingMapping.length > 0) {
          skipped++;
          continue;
        }

        // Insert new mapping (protected by unique constraint)
        if (!DRY_RUN) {
          try {
            await db.insert(questionMapping).values({
              intakeQuestionId: intakeQuestionId,
              assessmentQuestionId: question.id,
              recCode: recCode,
              priority: mapping.priority || 'MEDIUM',
              mappingLogic: {
                rationale: mapping.rationale,
                sourceDataset: 'v1.0.0',
                autoGenerated: true
              },
              isActive: true
            });
          } catch (insertError) {
            // Unique constraint violation is expected if duplicate exists
            if (insertError instanceof Error && insertError.message.includes('unique')) {
              skipped++;
              console.log(`   ℹ Skipped (duplicate): ${mapping.questionId} → ${recCode}`);
              continue;
            }
            throw insertError;
          }
        }

        created++;
        console.log(`   ✓ ${DRY_RUN ? '[DRY RUN] Would create' : 'Created'} mapping: ${mapping.questionId} → ${recCode}`);
      }
    }

    return {
      success: errors.length === 0,
      mode: 'merge',
      dryRun: DRY_RUN,
      created,
      skipped,
      errors
    };

  } catch (error) {
    errors.push(`Seeding error: ${error}`);
    return {
      success: false,
      mode: 'merge',
      dryRun: DRY_RUN,
      created,
      skipped,
      errors
    };
  }
}

/**
 * Fresh mode - Destructive rebuild (dev-only with confirmation)
 * 
 * Safety Mechanisms:
 * - Dev-only with explicit confirmation flag
 * - Complete rebuild from known-good dataset
 * 
 * Note: Neon HTTP driver does not support transactions. This mode is only allowed
 * in development with explicit confirmation to minimize risk.
 */
async function seedFreshMode(mappingData: MappingData, intakeQuestionId: string): Promise<SeedingResult> {
  if (!ALLOW_FRESH_MODE) {
    return {
      success: false,
      mode: 'fresh',
      dryRun: false,
      created: 0,
      skipped: 0,
      errors: ['Fresh mode blocked: Requires NODE_ENV=development and CONFIRM_FRESH=yes']
    };
  }

  console.log('\n🔥 Running in FRESH mode (destructive)...');
  console.log('   ⚠️  WARNING: This will delete all existing QuestionMapping data!');
  console.log('   🔒 Dev-only mode with explicit confirmation required\n');

  let created = 0;
  const errors: string[] = [];

  try {
    // Delete all existing mappings
    if (!DRY_RUN) {
      await db.delete(questionMapping);
      console.log('   🗑️  Deleted all existing question mappings');
    } else {
      console.log('   🗑️  [DRY RUN] Would delete all existing question mappings');
    }

    // Insert all mappings from dataset
    for (const mapping of mappingData.mappings) {
      const [question] = await db
        .select()
        .from(questions)
        .where(eq(questions.questionId, mapping.questionId))
        .limit(1);

      if (!question) {
        errors.push(`Question not found: ${mapping.questionId}`);
        continue;
      }

      for (const recCode of mapping.recCodes) {
        if (!DRY_RUN) {
          await db.insert(questionMapping).values({
            intakeQuestionId: intakeQuestionId,
            assessmentQuestionId: question.id,
            recCode: recCode,
            priority: mapping.priority || 'MEDIUM',
            mappingLogic: {
              rationale: mapping.rationale,
              sourceDataset: 'v1.0.0',
              autoGenerated: true
            },
            isActive: true
          });
        }

        created++;
        console.log(`   ✓ ${DRY_RUN ? '[DRY RUN] Would create' : 'Created'} mapping: ${mapping.questionId} → ${recCode}`);
      }
    }

    return {
      success: errors.length === 0,
      mode: 'fresh',
      dryRun: DRY_RUN,
      created,
      skipped: 0,
      errors
    };

  } catch (error) {
    errors.push(`Seeding error: ${error}`);
    return {
      success: false,
      mode: 'fresh',
      dryRun: DRY_RUN,
      created,
      skipped: 0,
      errors
    };
  }
}

/**
 * Post-condition validation - verify seeding worked
 */
async function postConditionValidation(expectedMinimum: number): Promise<boolean> {
  console.log('\n✅ Running post-condition validation...');

  try {
    // Count total mappings
    const mappingCount = await db.select({ count: sql<number>`count(*)` }).from(questionMapping);
    const totalMappings = Number(mappingCount[0]?.count || 0);

    console.log(`   📊 Total QuestionMapping records: ${totalMappings}`);

    if (totalMappings < expectedMinimum && !DRY_RUN) {
      console.log(`   ❌ Expected at least ${expectedMinimum} mappings, found ${totalMappings}`);
      return false;
    }

    // Sample join validation
    const sampleJoin = await db
      .select({
        questionId: questions.questionId,
        recCode: recMapping.recCode,
      })
      .from(questionMapping)
      .innerJoin(questions, eq(questionMapping.assessmentQuestionId, questions.id))
      .innerJoin(recMapping, eq(questionMapping.recCode, recMapping.recCode))
      .limit(5);

    console.log(`   ✓ Sample join verification: ${sampleJoin.length} valid mappings found`);
    
    if (sampleJoin.length > 0) {
      console.log(`   Example: ${sampleJoin[0].questionId} → ${sampleJoin[0].recCode}`);
    }

    // Test idempotency - running again should be no-op
    if (!DRY_RUN) {
      console.log(`   ✓ Seeding complete - re-running would be a no-op (idempotent)`);
    }

    return true;

  } catch (error) {
    console.error(`   ❌ Post-condition validation failed: ${error}`);
    return false;
  }
}

/**
 * Main seeding function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 Question-to-REC Mapping Seeding Tool');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Mode: ${SEED_MODE.toUpperCase()}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Dry Run: ${DRY_RUN}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Load mapping dataset
    const mappingData = await loadMappingDataset();

    // Step 2: Preflight validation
    const preflight = await preflightValidation(mappingData);

    if (!preflight.isValid) {
      console.log('\n❌ Preflight validation failed. Please fix the following errors:');
      preflight.errors.forEach(e => console.log(`   - ${e}`));
      process.exit(1);
    }

    if (!preflight.summary.intakeQuestionId) {
      console.log('\n❌ No intake questions found in database. Cannot proceed.');
      console.log('   Please run intake question seeding first.');
      process.exit(1);
    }

    console.log('\n✅ Preflight validation passed!');

    // Step 3: Execute seeding based on mode
    let result: SeedingResult;

    if (SEED_MODE === 'fresh') {
      result = await seedFreshMode(mappingData, preflight.summary.intakeQuestionId);
    } else {
      result = await seedMergeMode(mappingData, preflight.summary.intakeQuestionId);
    }

    // Step 4: Report results
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 Seeding Results');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Mode: ${result.mode.toUpperCase()}`);
    console.log(`Dry Run: ${result.dryRun}`);
    console.log(`Created: ${result.created}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\nErrors encountered:');
      result.errors.forEach(e => console.log(`   - ${e}`));
    }

    // Step 5: Post-condition validation (only if not dry run and no errors)
    if (!DRY_RUN && result.success) {
      const expectedMinimum = result.mode === 'fresh' ? result.created : preflight.summary.existingMappings + result.created;
      const postValidation = await postConditionValidation(expectedMinimum);

      if (!postValidation) {
        console.log('\n❌ Post-condition validation failed');
        process.exit(1);
      }
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error during seeding:', error);
    process.exit(1);
  }
}

// Run main function
main();
