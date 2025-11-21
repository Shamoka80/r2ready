// Load environment variables before importing db
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file - check both server directory and root directory
const serverEnvPath = path.resolve(__dirname, '.env');
const rootEnvPath = path.resolve(__dirname, '..', '.env');

// Try server directory first, then root directory
const envPath = fs.existsSync(serverEnvPath) ? serverEnvPath : rootEnvPath;
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log(`📄 Loaded environment variables from: ${envPath}`);
} else {
  console.warn(`⚠️  No .env file found in ${serverEnvPath} or ${rootEnvPath}`);
  // Still try to load from default location (current working directory)
  config();
}

import { db } from './db.js';

async function checkDatabaseHealth() {
  try {
    console.log('🔍 Checking database connection...');
    
    // Simple database connectivity test
    const result = await db.execute('SELECT 1 as test');
    console.log('✅ Database connection successful');
    console.log('🎉 Database health check completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    console.error('💡 Possible solutions:');
    console.error('  1. Check DATABASE_URL in .env file');
    console.error('  2. Ensure PostgreSQL/Neon database is running');
    console.error('  3. Run database migrations if needed');
    process.exit(1);
  }
}

checkDatabaseHealth().catch(error => {
  console.error('❌ Unexpected error in database health check:', error);
  process.exit(1);
});
