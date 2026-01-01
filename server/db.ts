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

// Configure Neon connection pooling and performance settings
// Enable pipelined connections for better performance
neonConfig.pipelineConnect = 'password';

// Note: Neon HTTP driver automatically manages connection pooling.
// For production deployments, consider using Neon's connection pooler
// with pgBouncer for enhanced connection management and scalability.

// Use HTTP connection for better Replit compatibility with pooling enabled
const sql = neon(dbUrl);
export const db = drizzle(sql as any, { schema });
export { sql };

// Safe parameterized query helper using Neon's built-in parameter binding
export async function executeQuery(query: string, params: any[] = []) {
  // Use Neon's native parameter binding by converting $1, $2 placeholders to SQL template
  // This prevents SQL injection by using proper parameter binding
  
  if (params.length === 0) {
    const rows = await sql([query] as any);
    return {
      rows,
      rowCount: rows.length
    };
  }
  
  // Split query by parameter placeholders and build tagged template
  const parts: string[] = [];
  let currentPart = '';
  let i = 0;
  
  while (i < query.length) {
    if (query[i] === '$' && i + 1 < query.length && /\d/.test(query[i + 1])) {
      // Found placeholder like $1, $2, etc.
      parts.push(currentPart);
      currentPart = '';
      
      // Skip the $ and digits
      i++;
      while (i < query.length && /\d/.test(query[i])) {
        i++;
      }
    } else {
      currentPart += query[i];
      i++;
    }
  }
  parts.push(currentPart);
  
  // Create the template strings array with raw property for sql tagged template
  const templateStrings: any = parts;
  templateStrings.raw = parts;
  
  // Call sql as a tagged template with parameter binding
  const rows = await sql(templateStrings, ...params);
  
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