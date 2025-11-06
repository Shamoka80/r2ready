#!/usr/bin/env tsx

import { db } from "../db.js";
import { standardVersions, clauses, questions } from "../../shared/schema.js";

/**
 * Minimal data seeding for Phase 2 development
 * Creates essential R2v3 standard with basic clause and question structure
 */

const R2V3_STANDARD = {
  code: "R2V3_1",
  name: "R2 v3.1", 
  version: "1.0",
  description: "Responsible Recycling Standard Version 3.1",
  isActive: true
};

const R2V3_CLAUSES = [
  {
    ref: "4.1",
    title: "Data Security Requirements",
    description: "Requirements for secure data handling and destruction"
  },
  {
    ref: "4.2", 
    title: "Environmental Management",
    description: "Environmental compliance and management requirements"
  },
  {
    ref: "A.1",
    title: "Focus Materials and Components",
    description: "Requirements for handling focus materials"
  }
];

const R2V3_QUESTIONS = [
  {
    questionId: "DS-001",
    clauseRef: "4.1",
    text: "Do you have documented data security policies?",
    responseType: "BOOLEAN",
    required: true,
    evidenceRequired: true,
    weight: 3.0,
    category: "Data Security"
  },
  {
    questionId: "DS-002", 
    clauseRef: "4.1",
    text: "Are data destruction methods verified through testing?",
    responseType: "BOOLEAN",
    required: true,
    evidenceRequired: true,
    weight: 3.0,
    category: "Data Security"
  },
  {
    questionId: "EM-001",
    clauseRef: "4.2", 
    text: "Do you have an environmental management system?",
    responseType: "BOOLEAN",
    required: true,
    evidenceRequired: false,
    weight: 2.5,
    category: "Environmental"
  },
  {
    questionId: "FM-001",
    clauseRef: "A.1",
    text: "Do you handle focus materials as defined in Appendix A?",
    responseType: "BOOLEAN", 
    required: false,
    evidenceRequired: false,
    weight: 2.0,
    category: "Focus Materials"
  }
];

export async function setupMinimalData() {
  try {
    console.log("🚀 Setting up minimal R2v3 data for Phase 2...\n");

    // Clear existing data in proper order (respect foreign keys)
    console.log("🗑️  Clearing existing data...");
    await db.delete(questions);
    await db.delete(clauses);
    
    // Clear assessments that might reference standards
    const { assessments } = await import("../../shared/schema.js");
    await db.delete(assessments);
    
    await db.delete(standardVersions);

    // Insert standard
    console.log("📋 Creating R2v3 standard...");
    const [standard] = await db.insert(standardVersions)
      .values(R2V3_STANDARD)
      .returning();
    console.log(`   ✅ Standard: ${standard.code} - ${standard.name}`);

    // Insert clauses
    console.log("📄 Creating clauses...");
    const createdClauses = [];
    for (const clauseData of R2V3_CLAUSES) {
      const [clause] = await db.insert(clauses)
        .values({
          ...clauseData,
          stdId: standard.id
        })
        .returning();
      createdClauses.push(clause);
      console.log(`   ✅ Clause: ${clause.ref} - ${clause.title}`);
    }

    // Insert questions
    console.log("❓ Creating questions...");
    const createdQuestions = [];
    for (const questionData of R2V3_QUESTIONS) {
      const clause = createdClauses.find(c => c.ref === questionData.clauseRef);
      if (!clause) continue;
      
      const [question] = await db.insert(questions)
        .values({
          questionId: questionData.questionId,
          clauseId: clause.id,
          text: questionData.text,
          responseType: questionData.responseType,
          required: questionData.required,
          evidenceRequired: questionData.evidenceRequired,
          weight: questionData.weight,
          category: questionData.category
        })
        .returning();
      createdQuestions.push(question);
      console.log(`   ✅ Question: ${question.questionId} - ${question.text.substring(0, 50)}...`);
    }

    console.log("\n🎉 Minimal data setup complete!");
    console.log("=" .repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   • Standards: 1`);
    console.log(`   • Clauses: ${createdClauses.length}`); 
    console.log(`   • Questions: ${createdQuestions.length}`);
    console.log("=" .repeat(50));

    return {
      success: true,
      standard: standard,
      clauses: createdClauses.length,
      questions: createdQuestions.length
    };

  } catch (error) {
    console.error("💥 Minimal data setup failed:", error);
    throw error;
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('setup-minimal-data.ts')) {
  setupMinimalData()
    .then(() => {
      console.log("🎯 Setup complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Setup failed:", error);
      process.exit(1);
    });
}