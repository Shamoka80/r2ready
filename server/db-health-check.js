
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
