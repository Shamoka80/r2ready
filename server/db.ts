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

// Parameterized query helper for Neon
export async function executeQuery(query: string, params: any[] = []) {
  // Neon uses tagged template syntax, so we need to handle params differently
  if (params.length === 0) {
    const result = await sql(query);
    return { rows: result, rowCount: Array.isArray(result) ? result.length : 0 };
  }
  
  // For parameterized queries with Neon, we need to use the tagged template
  // This is a simplified version - for complex queries, use sql`` directly
  let paramIndex = 0;
  const processedQuery = query.replace(/\?/g, () => {
    const param = params[paramIndex++];
    return typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param);
  });
  
  const result = await sql(processedQuery);
  return { rows: result, rowCount: Array.isArray(result) ? result.length : 0 };
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