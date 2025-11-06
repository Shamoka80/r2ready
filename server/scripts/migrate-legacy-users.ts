import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { sql } from 'drizzle-orm';

/**
 * Migration Script: Mark existing users as legacy verified
 * 
 * Purpose: Mark all users created before the email verification feature
 * as "legacy verified" so they aren't affected by the new email verification
 * requirements.
 * 
 * Run with: npm run migrate:legacy-users
 */
async function migrateLegacyUsers() {
  console.log('🔄 Starting legacy user migration...');
  
  try {
    // Update all existing users to mark them as legacy verified
    const result = await db.update(users)
      .set({ legacyVerified: true })
      .where(sql`1=1`); // Update all rows
    
    console.log('✅ Migration completed successfully');
    console.log(`📊 Updated all existing users with legacyVerified flag`);
    
    // Query and display counts for verification
    const legacyCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM "User" WHERE "legacyVerified" = true`
    );
    const totalCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM "User"`
    );
    
    console.log(`📈 Total users: ${totalCount.rows[0]?.count || 0}`);
    console.log(`📈 Legacy verified users: ${legacyCount.rows[0]?.count || 0}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run migration
migrateLegacyUsers();
