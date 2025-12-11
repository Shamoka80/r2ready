import { neon, neonConfig } from '@neondatabase/serverless';
import postgres from 'postgres';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
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

// Detect if using localhost (needs standard postgres driver) vs cloud (needs Neon HTTP driver)
const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('::1');
const isNeon = dbUrl.includes('neon.tech') || dbUrl.includes('.neon.tech');

let sql: any;
let db: any;

if (isLocalhost) {
  console.log('💡 Using localhost database - using standard PostgreSQL driver');
  // Use standard postgres driver for localhost connections
  const client = postgres(dbUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  sql = client;
  db = drizzlePostgres(client, { schema });
} else if (isNeon) {
  console.log('💡 Using Neon database - using Neon HTTP driver');
  // Configure Neon connection pooling and performance settings
  neonConfig.pipelineConnect = 'password';
  const neonSql = neon(dbUrl);
  sql = neonSql;
  db = drizzleNeon(neonSql as any, { schema });
} else {
  // For other cloud databases, try Neon HTTP first, fallback to postgres
  console.log('💡 Using cloud database - attempting Neon HTTP driver');
  try {
    neonConfig.pipelineConnect = 'password';
    const neonSql = neon(dbUrl);
    sql = neonSql;
    db = drizzleNeon(neonSql as any, { schema });
  } catch (error) {
    console.log('⚠️  Neon HTTP driver failed, falling back to standard PostgreSQL driver');
    const client = postgres(dbUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    sql = client;
    db = drizzlePostgres(client, { schema });
  }
}
//

export { db, sql };

// Safe parameterized query helper - works with both Neon and standard postgres drivers
export async function executeQuery(query: string, params: any[] = []) {
  const dbUrl = process.env.DATABASE_URL || '';
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('::1');
  
  if (isLocal) {
    // Standard postgres driver - use parameterized queries
    if (params.length === 0) {
      const rows = await sql.unsafe(query);
      return {
        rows: rows as any[],
        rowCount: rows.length
      };
    }
    
    // For postgres driver, convert $1, $2 to ? placeholders or use sql.unsafe with params
    // postgres library handles parameterization automatically
    const rows = await sql.unsafe(query, params);
    return {
      rows: rows as any[],
      rowCount: rows.length
    };
  } else {
    // Neon HTTP driver - use tagged template syntax
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
        parts.push(currentPart);
        currentPart = '';
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
    
    const templateStrings: any = parts;
    templateStrings.raw = parts;
    const rows = await sql(templateStrings, ...params);
    
    return {
      rows,
      rowCount: rows.length
    };
  }
}

// Test database connection
export async function testDatabaseConnection() {
  try {
    // Both drivers support tagged template syntax
    await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConnectionError = 
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connect');
    
    console.error('❌ Database connection failed');
    
    if (isConnectionError) {
      const dbUrl = process.env.DATABASE_URL || '';
      const urlPreview = dbUrl.length > 0 
        ? dbUrl.substring(0, Math.min(50, dbUrl.indexOf('@') > 0 ? dbUrl.indexOf('@') : 50)) + '...'
        : 'not set';
      
      console.error('💡 Connection Error Details:');
      console.error(`   DATABASE_URL preview: ${urlPreview}`);
      console.error('   Possible issues:');
      console.error('   1. Database server is not running (if using localhost)');
      console.error('   2. DATABASE_URL is incorrect or points to wrong host/port');
      console.error('   3. Network/firewall blocking the connection');
      console.error('   4. Database credentials are incorrect');
      console.error('   5. For Neon databases: database may be suspended or endpoint disabled');
      console.error('');
      console.error('   Check your server/.env file and ensure DATABASE_URL is correct');
    } else {
      console.error('   Error:', errorMessage);
    }
    
    return false;
  }
}