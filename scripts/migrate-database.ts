#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';
import chalk from 'chalk';

async function runMigrations() {
  console.log(chalk.blue('🚀 Running Database Migrations...'));

  if (!process.env.DATABASE_URL) {
    console.error(chalk.red('❌ DATABASE_URL environment variable is required'));
    process.exit(1);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    console.log(chalk.yellow('📋 Applying migrations...'));
    await migrate(db, { migrationsFolder: './migrations' });

    console.log(chalk.green('✅ Database migrations completed successfully'));
  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'), error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}