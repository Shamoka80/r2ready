
import { neon } from '@neondatabase/serverless';

async function wakeDatabase() {
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds
  
  console.log('Attempting to connect to database with retry logic...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  console.log('Database URL configured:', process.env.DATABASE_URL.substring(0, 50) + '...');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);
      
      const sql = neon(process.env.DATABASE_URL);
      const result = await sql`SELECT NOW() as current_time, 'Database is awake!' as message`;
      
      console.log('✅ Database is connected:', result);
      console.log('✅ Connection successful!');
      process.exit(0);
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('❌ All retry attempts failed');
        console.error('Please check:');
        console.error('1. Your Neon database is accessible');
        console.error('2. Your DATABASE_URL is correct');
        console.error('3. Your database credentials are valid');
        process.exit(1);
      }
    }
  }
}

wakeDatabase();
