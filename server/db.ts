// Load environment variables from server/.env file FIRST
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from server directory before accessing process.env
config({ path: path.join(__dirname, '.env') });

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  console.error("Please ensure your database is properly configured");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Validate DATABASE_URL format
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
  console.error("Invalid DATABASE_URL format. Expected postgresql:// or postgres://");
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection string");
}

console.log('✅ Database configuration validated');

const client = postgres(dbUrl);
const sql = client; // Create local reference for use in this module
export const db = drizzle(client, { schema });
export { sql };

export async function executeQuery(query: string, params: any[] = []) {
  if (params.length === 0) {
    const rows = await sql.unsafe(query);
    return { rows, rowCount: rows.length };
  }
  const rows = await sql.unsafe(query, params);
  return { rows, rowCount: rows.length };
}

// Test database connection
export async function testDatabaseConnection() {
  try {
    await sql.unsafe('SELECT 1 as test');
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}