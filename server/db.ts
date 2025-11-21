// CRITICAL: Load environment variables FIRST before checking DATABASE_URL
// This ensures .env is loaded no matter how this module is imported
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
  const result = config({ path: envPath });
  if (result.error) {
    console.warn(`⚠️  [db.ts] Error loading .env from ${envPath}:`, result.error);
  }
} else {
  // Fallback to default location (current working directory)
  config();
}

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

// Create PostgreSQL connection using postgres-js
// This works with standard PostgreSQL databases (not Neon-specific)
const sql = postgres(dbUrl, {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
});

export const db = drizzle(sql, { schema });
export { sql };

// Safe parameterized query helper using postgres-js parameter binding
export async function executeQuery(query: string, params: any[] = []) {
  // Use postgres-js parameter binding with $1, $2, etc. placeholders
  // This prevents SQL injection by using proper parameter binding
  
  if (params.length === 0) {
    const rows = await sql.unsafe(query);
    return {
      rows,
      rowCount: rows.length
    };
  }
  
  // postgres-js supports parameterized queries directly
  // Convert $1, $2 placeholders to postgres-js format
  const rows = await sql.unsafe(query, params);
  
  return {
    rows,
    rowCount: rows.length
  };
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