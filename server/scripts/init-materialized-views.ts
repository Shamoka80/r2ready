#!/usr/bin/env tsx

/**
 * Initialize materialized views for the application
 * This script drops and recreates materialized views:
 * - client_org_stats: Consultant client organization statistics
 * - assessment_stats: Tenant-level assessment statistics for dashboard KPIs
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { 
  clientOrgStatsViewSQL, 
  clientOrgStatsIndexSQL, 
  dropClientOrgStatsViewSQL,
  assessmentStatsViewSQL,
  assessmentStatsIndexSQL,
  dropAssessmentStatsViewSQL
} from '../../shared/schema';

async function initializeMaterializedViews() {
  console.log('🚀 Initializing materialized views...');
  
  try {
    // === CLIENT ORG STATS MATERIALIZED VIEW ===
    console.log('\n📊 Setting up client_org_stats materialized view...');
    
    // Drop the existing materialized view to ensure a clean slate
    console.log('Dropping existing client_org_stats materialized view...');
    await db.execute(sql.raw(dropClientOrgStatsViewSQL));
    console.log('✅ Existing view dropped successfully (if it existed)');
    
    // Create the client_org_stats materialized view using the imported SQL
    console.log('Creating client_org_stats materialized view with fixed SQL...');
    await db.execute(sql.raw(clientOrgStatsViewSQL));
    console.log('✅ client_org_stats materialized view created successfully');
    
    // Create indexes separately (Neon doesn't support multiple commands in one statement)
    console.log('Creating indexes on client_org_stats...');
    for (const indexSQL of clientOrgStatsIndexSQL) {
      await db.execute(sql.raw(indexSQL));
    }
    console.log('✅ Indexes created successfully');
    
    // Refresh the view to populate with current data
    console.log('Refreshing client_org_stats with current data...');
    await db.execute(sql`REFRESH MATERIALIZED VIEW client_org_stats`);
    console.log('✅ client_org_stats materialized view refreshed successfully');
    
    // === ASSESSMENT STATS MATERIALIZED VIEW ===
    console.log('\n📈 Setting up assessment_stats materialized view...');
    
    // Drop the existing materialized view to ensure a clean slate
    console.log('Dropping existing assessment_stats materialized view...');
    await db.execute(sql.raw(dropAssessmentStatsViewSQL));
    console.log('✅ Existing view dropped successfully (if it existed)');
    
    // Create the assessment_stats materialized view using the imported SQL
    console.log('Creating assessment_stats materialized view...');
    await db.execute(sql.raw(assessmentStatsViewSQL));
    console.log('✅ assessment_stats materialized view created successfully');
    
    // Create indexes separately (Neon doesn't support multiple commands in one statement)
    console.log('Creating indexes on assessment_stats...');
    for (const indexSQL of assessmentStatsIndexSQL) {
      await db.execute(sql.raw(indexSQL));
    }
    console.log('✅ Indexes created successfully');
    
    // Refresh the view to populate with current data
    console.log('Refreshing assessment_stats with current data...');
    await db.execute(sql`REFRESH MATERIALIZED VIEW assessment_stats`);
    console.log('✅ assessment_stats materialized view refreshed successfully');
    
    console.log('\n🎉 All materialized views initialized successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error initializing materialized views:', error);
    console.error('Full error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    process.exit(1);
  }
}

// Run the initialization
initializeMaterializedViews();
