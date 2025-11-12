/**
 * Bulk Answer Upload Script
 * 
 * Uploads answers to all questions in an assessment to test scoring calculations.
 * Creates two scenarios:
 * 1. All compliant (all Yes) - should score 100%
 * 2. Mixed answers - tests weighted scoring
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.VITE_API_URL || 'http://localhost:5000';
const EMAIL = 'wrekdtech@gmail.com';
const PASSWORD = '7426652Sj@';

interface Question {
  id: string;
  questionId: string;
  questionText: string;
  answerValue?: string;
}

interface QuestionGroup {
  category: string;
  questions: Question[];
}

interface QuestionsResponse {
  groups: QuestionGroup[];
}

/**
 * Login and get session cookie
 */
async function login(): Promise<string> {
  console.log('🔐 Logging in...');
  
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  // Get session cookie from response
  const cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('No session cookie received');
  }

  console.log('✅ Logged in successfully');
  return cookies;
}

/**
 * Fetch all questions for an assessment
 */
async function fetchQuestions(assessmentId: string, cookie: string): Promise<Question[]> {
  console.log(`📋 Fetching questions for assessment ${assessmentId}...`);
  
  const response = await fetch(`${BASE_URL}/api/assessments/${assessmentId}/questions`, {
    headers: {
      'Cookie': cookie,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch questions: ${response.statusText}`);
  }

  const data = await response.json() as QuestionsResponse;
  const allQuestions = data.groups.flatMap(group => group.questions);
  
  console.log(`✅ Found ${allQuestions.length} questions`);
  return allQuestions;
}

/**
 * Upload answers in batches
 */
async function uploadAnswers(
  assessmentId: string,
  answers: Array<{ questionId: string; value: string }>,
  cookie: string
): Promise<void> {
  const BATCH_SIZE = 50;
  const batches: Array<Array<{ questionId: string; value: string }>> = [];
  
  for (let i = 0; i < answers.length; i += BATCH_SIZE) {
    batches.push(answers.slice(i, i + BATCH_SIZE));
  }

  console.log(`📤 Uploading ${answers.length} answers in ${batches.length} batches...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`  Uploading batch ${i + 1}/${batches.length} (${batch.length} answers)...`);
    
    const response = await fetch(`${BASE_URL}/api/answers/${assessmentId}/answers/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify({ answers: batch }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Batch ${i + 1} failed: ${response.statusText} - ${error}`);
    }

    const result = await response.json() as { count?: number };
    console.log(`  ✅ Batch ${i + 1} saved: ${result.count || batch.length} answers`);
  }

  console.log('✅ All answers uploaded successfully');
}

/**
 * Generate all-compliant answers (all Yes = 100%)
 */
function generateAllCompliantAnswers(questions: Question[]) {
  return questions.map(q => ({
    questionId: q.id,
    value: 'Yes',
  }));
}

/**
 * Generate mixed answers for weighted scoring
 */
function generateMixedAnswers(questions: Question[]) {
  return questions.map((q, index) => {
    // Create a pattern: Yes, No, Partial, Yes, In Progress, etc.
    const pattern = index % 5;
    let value: string;
    
    switch (pattern) {
      case 0:
        value = 'Yes';
        break;
      case 1:
        value = 'No';
        break;
      case 2:
        value = 'Partial';
        break;
      case 3:
        value = 'N/A';
        break;
      case 4:
        value = 'In Progress';
        break;
      default:
        value = 'Yes';
    }
    
    return {
      questionId: q.id,
      value,
    };
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('Usage: tsx server/tools/bulk-answer-upload.ts <assessmentId> <scenario>');
      console.log('Scenarios:');
      console.log('  all-compliant - Upload all Yes answers (100% score expected)');
      console.log('  mixed         - Upload mixed answers (weighted scoring test)');
      console.log('');
      console.log('Example:');
      console.log('  tsx server/tools/bulk-answer-upload.ts abc-123-def all-compliant');
      process.exit(1);
    }

    const [assessmentId, scenario] = args;

    console.log('🚀 Starting bulk answer upload...');
    console.log(`   Assessment ID: ${assessmentId}`);
    console.log(`   Scenario: ${scenario}\n`);

    // Login
    const cookie = await login();

    // Fetch questions
    const questions = await fetchQuestions(assessmentId, cookie);

    if (questions.length === 0) {
      console.log('⚠️  No questions found. Make sure the assessment exists and has questions.');
      process.exit(1);
    }

    // Generate answers based on scenario
    let answers;
    if (scenario === 'all-compliant') {
      console.log('📝 Generating all-compliant answers (all Yes)...');
      answers = generateAllCompliantAnswers(questions);
    } else if (scenario === 'mixed') {
      console.log('📝 Generating mixed answers...');
      answers = generateMixedAnswers(questions);
    } else {
      console.log(`❌ Unknown scenario: ${scenario}`);
      process.exit(1);
    }

    // Upload answers
    await uploadAnswers(assessmentId, answers, cookie);

    console.log('\n🎉 Bulk upload complete!');
    console.log(`   Total questions answered: ${answers.length}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Check the assessment progress in the UI');
    console.log('   2. Verify the scoring calculations');
    console.log('   3. Generate a PDF export to test report generation');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
