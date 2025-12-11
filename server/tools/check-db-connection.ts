#!/usr/bin/env tsx
/**
 * Database Connection Diagnostic Tool
 * Helps diagnose and fix database connection issues
 */

import "dotenv/config";
import { neon } from '@neondatabase/serverless';

async function checkDatabaseConnection() {
  console.log('🔍 Database Connection Diagnostic Tool\n');
  console.log('='.repeat(60));

  // Step 1: Check if DATABASE_URL is set
  console.log('\n📋 Step 1: Checking DATABASE_URL environment variable...\n');
  
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is NOT SET');
    console.error('\n💡 Solution:');
    console.error('   1. Create or edit server/.env file');
    console.error('   2. Add: DATABASE_URL="postgresql://username:password@host:port/database"');
    console.error('   3. For local PostgreSQL: DATABASE_URL="postgresql://postgres:password@localhost:5432/r2ready"');
    console.error('   4. For Neon: Get connection string from Neon dashboard');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL is set');
  
  // Parse and display URL info (masked)
  try {
    const urlMatch = dbUrl.match(/postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?|$)/);
    if (urlMatch) {
      const [, , username, password, host, port, database] = urlMatch;
      console.log('\n📊 Connection Details:');
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${'*'.repeat(Math.min(password.length, 8))}...`);
      console.log(`   Host: ${host}`);
      console.log(`   Port: ${port}`);
      console.log(`   Database: ${database}`);
      console.log(`   Is Localhost: ${host === 'localhost' || host === '127.0.0.1' ? 'YES ⚠️' : 'NO'}`);
      
      if (host === 'localhost' || host === '127.0.0.1') {
        console.log('\n⚠️  Using localhost - ensure PostgreSQL is running locally');
      }
    } else {
      console.log('⚠️  Could not parse DATABASE_URL format');
      console.log(`   Preview: ${dbUrl.substring(0, 50)}...`);
    }
  } catch (e) {
    console.log('⚠️  Could not parse DATABASE_URL');
  }

  // Step 2: Validate URL format
  console.log('\n📋 Step 2: Validating DATABASE_URL format...\n');
  
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    console.error('❌ Invalid DATABASE_URL format');
    console.error('   Must start with postgresql:// or postgres://');
    console.error(`   Current: ${dbUrl.substring(0, 20)}...`);
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL format is valid');

  // Step 3: Test connection
  console.log('\n📋 Step 3: Testing database connection...\n');
  
  try {
    const sql = neon(dbUrl);
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    
    console.log('✅ Database connection successful!');
    console.log(`   Current time: ${result[0].current_time}`);
    console.log(`   PostgreSQL version: ${result[0].pg_version.split(' ')[0]} ${result[0].pg_version.split(' ')[1]}`);
    console.log('\n🎉 Your database connection is working correctly!');
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Database connection failed\n');
    
    const errorMessage = error?.message || String(error);
    const isConnectionRefused = 
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connect');
    
    if (isConnectionRefused) {
      console.error('🔴 Connection Refused Error\n');
      console.error('This means the database server is not accessible.\n');
      
      const urlMatch = dbUrl.match(/postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?|$)/);
      const host = urlMatch ? urlMatch[4] : 'unknown';
      const port = urlMatch ? urlMatch[5] : 'unknown';
      
      if (host === 'localhost' || host === '127.0.0.1') {
        console.error('💡 Since you\'re using localhost, try these steps:\n');
        console.error('   1. Check if PostgreSQL is running:');
        console.error('      Windows: Open Services, look for "postgresql"');
        console.error('      Or run: pg_ctl status');
        console.error('\n   2. Start PostgreSQL if it\'s not running:');
        console.error('      Windows: net start postgresql-x64-XX (replace XX with version)');
        console.error('      Or: Start from Services panel');
        console.error('\n   3. Verify PostgreSQL is listening on port', port);
        console.error('      Run: netstat -an | findstr', port);
        console.error('\n   4. Check if the database exists:');
        console.error('      Run: psql -U postgres -l');
        console.error('\n   5. If database doesn\'t exist, create it:');
        console.error('      Run: createdb r2ready');
      } else {
        console.error('💡 Since you\'re using a remote/cloud database, try these steps:\n');
        console.error('   1. Verify the host and port are correct');
        console.error('   2. Check if the database server is running');
        console.error('   3. Verify your IP is not blocked by firewall');
        console.error('   4. For Neon/Supabase:');
        console.error('      - Check if the endpoint is enabled in dashboard');
        console.error('      - Verify the connection string is correct');
        console.error('      - Check if database is suspended (free tier)');
        console.error('   5. Test connection from another tool (pgAdmin, DBeaver)');
      }
      
      console.error('\n📝 Common Issues:');
      console.error('   - Wrong host/port in DATABASE_URL');
      console.error('   - Incorrect username/password');
      console.error('   - Database server not running');
      console.error('   - Firewall blocking connection');
      console.error('   - Database doesn\'t exist');
      console.error('   - SSL/TLS configuration mismatch');
      
    } else {
      console.error('🔴 Other Database Error:\n');
      console.error(`   Error: ${errorMessage}`);
      console.error('\n💡 This might be:');
      console.error('   - Authentication failure (wrong password)');
      console.error('   - Database doesn\'t exist');
      console.error('   - Permission issues');
      console.error('   - SSL/TLS configuration problem');
    }
    
    process.exit(1);
  }
}

checkDatabaseConnection().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});




