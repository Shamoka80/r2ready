// Load environment variables from server/.env file FIRST
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from server directory before accessing process.env
config({ path: path.join(__dirname, '.env') });

import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "../shared/schema";

neonConfig.pipelineConnect = 'password';

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  console.error("Please ensure your database is properly configured");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = process.env.DATABASE_URL;
const sql = neon(dbUrl);
export const db = drizzle(sql as any, { schema });
export { sql };

// Safe parameterized query helper using Neon
export async function executeQuery(query: string, params: any[] = []) {
  // Neon uses tagged template literals, so we need to handle params differently
  if (params.length === 0) {
    const result = await sql.unsafe(query);
    return { rows: result, rowCount: Array.isArray(result) ? result.length : 1 };
  }
  // For parameterized queries with Neon, we need to use a different approach
  // This is a simplified version - adjust based on your actual needs
  const result = await sql.unsafe(query, params);
  return { rows: result, rowCount: Array.isArray(result) ? result.length : 1 };
}

// Test database connection
export async function testDatabaseConnection() {
  try {
    await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}