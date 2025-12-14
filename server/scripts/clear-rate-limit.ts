/**
 * Script to clear rate limit events for testing
 * Usage: npx tsx server/scripts/clear-rate-limit.ts [resource] [action] [identifier]
 * 
 * Examples:
 *   npx tsx server/scripts/clear-rate-limit.ts auth login
 *   npx tsx server/scripts/clear-rate-limit.ts auth register
 *   npx tsx server/scripts/clear-rate-limit.ts auth register 127.0.0.1
 */

import "dotenv/config";
import { db } from '../db.js';
import { rateLimitEvents } from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

async function clearRateLimit(resource?: string, action?: string, identifier?: string) {
  try {
    console.log('🧹 Clearing rate limit events...\n');

    let query = db.delete(rateLimitEvents);

    const conditions = [];
    
    if (resource) {
      conditions.push(eq(rateLimitEvents.resource, resource));
      console.log(`   Resource: ${resource}`);
    }
    
    if (action) {
      conditions.push(eq(rateLimitEvents.action, action));
      console.log(`   Action: ${action}`);
    }
    
    if (identifier) {
      conditions.push(eq(rateLimitEvents.identifier, identifier));
      console.log(`   Identifier: ${identifier}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else {
      console.log('   ⚠️  No filters specified - will clear ALL rate limit events');
      console.log('   Press Ctrl+C to cancel, or wait 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const result = await query.returning();

    console.log(`\n✅ Cleared ${result.length} rate limit event(s)\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing rate limit:', error);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const resource = args[0];
const action = args[1];
const identifier = args[2];

clearRateLimit(resource, action, identifier);






