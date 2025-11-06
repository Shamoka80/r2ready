import { db } from '../db';
import { questions, clauses, standardVersions } from '../../shared/schema';
import { parse } from 'csv-parse/sync';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CSVQuestion {
  id: string;
  category: string;
  category_code: string;
  category_name: string;
  question: string;
  compliance_expectation: string;
  tags: string;
}

interface ClauseMap {
  [key: string]: string; // category_code -> clauseId
}

async function seedQuestions() {
  try {
    console.log('🚀 Starting R2v3 Question Database Seeding...\n');

    // Step 1: Read and parse CSV
    const csvPath = path.join(__dirname, '../../Fixes/questions.csv');
    console.log(`📖 Reading CSV from: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at ${csvPath}`);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records: CSVQuestion[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`✅ Parsed ${records.length} questions from CSV\n`);

    // Step 2: Get or create standard version (use existing R2V3_1)
    const existingStandards = await db.select().from(standardVersions).where(eq(standardVersions.code, 'R2V3_1'));
    
    let standardId: string;
    if (existingStandards.length > 0) {
      standardId = existingStandards[0].id;
      console.log(`✅ Using existing standard: ${existingStandards[0].name} (ID: ${standardId})\n`);
    } else {
      throw new Error('No R2V3_1 standard found. Please ensure the standard exists before seeding questions.');
    }

    // Step 3: Group questions by category and create clauses
    const categoryMap = new Map<string, CSVQuestion[]>();
    records.forEach(record => {
      const key = record.category_code || record.category;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, []);
      }
      categoryMap.get(key)!.push(record);
    });

    console.log(`📊 Found ${categoryMap.size} unique categories\n`);

    // Step 4: Create or find clauses for each category
    const clauseMap: ClauseMap = {};
    let clausesCreated = 0;
    let clausesFound = 0;

    for (const [categoryCode, categoryQuestions] of categoryMap) {
      const sampleQuestion = categoryQuestions[0];
      const categoryName = sampleQuestion.category_name || sampleQuestion.category;
      
      // Check if clause already exists
      const existingClause = await db.select()
        .from(clauses)
        .where(
          and(
            eq(clauses.ref, categoryCode),
            eq(clauses.stdId, standardId)
          )
        )
        .limit(1);

      if (existingClause.length > 0) {
        clauseMap[categoryCode] = existingClause[0].id;
        clausesFound++;
      } else {
        // Create new clause
        const newClause = await db.insert(clauses).values({
          ref: categoryCode,
          title: categoryName,
          description: `Questions related to ${sampleQuestion.category}`,
          stdId: standardId,
          order: Object.keys(clauseMap).length,
          isActive: true
        }).returning();

        clauseMap[categoryCode] = newClause[0].id;
        clausesCreated++;
        console.log(`  ✨ Created clause: ${categoryCode} - ${categoryName}`);
      }
    }

    console.log(`\n✅ Clauses ready: ${clausesFound} existing, ${clausesCreated} newly created\n`);

    // Step 5: Insert questions
    let questionsInserted = 0;
    let questionsSkipped = 0;
    let questionsUpdated = 0;

    console.log('📝 Inserting questions...\n');

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      // Progress logging every 50 questions
      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${records.length} questions processed...`);
      }

      // Determine clauseId from category
      const categoryCode = record.category_code || record.category;
      const clauseId = clauseMap[categoryCode];

      if (!clauseId) {
        console.warn(`  ⚠️  Warning: No clause found for category "${categoryCode}", skipping question ${record.id}`);
        questionsSkipped++;
        continue;
      }

      // Parse tags from semicolon-separated to array
      const tagsArray = record.tags 
        ? record.tags.split(';').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : [];

      // Check for evidence requirement based on tags
      const evidenceRequired = tagsArray.includes('A') || tagsArray.includes('AUDIT');

      // Create questionId in format Q###
      const questionId = `Q${record.id.padStart(3, '0')}`;

      // Check if question already exists
      const existingQuestion = await db.select()
        .from(questions)
        .where(eq(questions.questionId, questionId))
        .limit(1);

      if (existingQuestion.length > 0) {
        // Update existing question to ensure data is current
        await db.update(questions)
          .set({
            text: record.question,
            helpText: record.compliance_expectation,
            category: record.category,
            category_code: record.category_code,
            categoryName: record.category_name,
            tags: tagsArray,
            evidenceRequired,
            clauseId,
            order: parseInt(record.id),
            isActive: true
          })
          .where(eq(questions.questionId, questionId));
        
        questionsUpdated++;
      } else {
        // Insert new question
        await db.insert(questions).values({
          questionId,
          clauseId,
          text: record.question,
          helpText: record.compliance_expectation,
          category: record.category,
          category_code: record.category_code,
          categoryName: record.category_name,
          tags: tagsArray,
          responseType: 'yes_no',
          required: false,
          evidenceRequired,
          weight: 1,
          order: parseInt(record.id),
          isActive: true
        });

        questionsInserted++;
      }
    }

    console.log(`\n✅ Question seeding complete!\n`);
    console.log('📊 Summary:');
    console.log(`  • Questions inserted: ${questionsInserted}`);
    console.log(`  • Questions updated: ${questionsUpdated}`);
    console.log(`  • Questions skipped: ${questionsSkipped}`);
    console.log(`  • Total processed: ${records.length}`);
    console.log(`  • Clauses created: ${clausesCreated}`);
    console.log(`  • Clauses reused: ${clausesFound}`);

    // Final verification
    const totalQuestions = await db.select().from(questions);
    console.log(`\n✅ Database now contains ${totalQuestions.length} total questions\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding questions:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Auto-run the seeding function
seedQuestions();

export { seedQuestions };
