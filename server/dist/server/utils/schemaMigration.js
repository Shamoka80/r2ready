import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { validateSchemaConsistency } from './schemaValidator.js';
export async function autoMigrateSchema() {
    const appliedMigrations = [];
    const errors = [];
    console.log('🔄 Starting automatic schema migration...');
    try {
        // First, validate to see what's missing
        const validation = await validateSchemaConsistency();
        if (validation.isValid) {
            console.log('✅ Schema is already in sync, no migrations needed');
            return { success: true, appliedMigrations: [], errors: [] };
        }
        console.log('📋 Detected schema issues, attempting to fix...');
        // Parse errors to generate fix SQL
        for (const error of validation.errors) {
            try {
                const migration = await generateMigrationSQL(error);
                if (migration) {
                    console.log(`🔧 Applying migration: ${migration.description}`);
                    await db.execute(sql.raw(migration.sql));
                    appliedMigrations.push(migration.description);
                    console.log(`✅ Successfully applied: ${migration.description}`);
                }
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                errors.push(`Failed to apply migration for: ${error}. Error: ${errorMsg}`);
                console.error(`❌ Migration failed: ${errorMsg}`);
            }
        }
        // Validate again to confirm
        const postValidation = await validateSchemaConsistency();
        if (!postValidation.isValid) {
            errors.push('Schema validation still failing after migrations');
            return { success: false, appliedMigrations, errors };
        }
        console.log('✅ Schema migration completed successfully');
        return { success: true, appliedMigrations, errors: [] };
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Migration process failed: ${errorMsg}`);
        return { success: false, appliedMigrations, errors };
    }
}
async function generateMigrationSQL(error) {
    // Parse error message to determine what needs to be fixed
    // Pattern: "Column 'columnName' is missing from table 'TableName'"
    const missingColumnMatch = error.match(/Column '(\w+)' is missing from table '(\w+)'/);
    if (missingColumnMatch) {
        const [, columnName, tableName] = missingColumnMatch;
        return generateAddColumnMigration(tableName, columnName);
    }
    // Pattern: "Column 'TableName.columnName' nullability mismatch"
    const nullabilityMatch = error.match(/Column '(\w+)\.(\w+)' nullability mismatch: actual=(\w+), expected=(\w+)/);
    if (nullabilityMatch) {
        const [, tableName, columnName, actual, expected] = nullabilityMatch;
        const shouldBeNullable = expected === 'true';
        return {
            description: `Set ${tableName}.${columnName} nullability to ${shouldBeNullable ? 'NULL' : 'NOT NULL'}`,
            sql: `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" ${shouldBeNullable ? 'DROP' : 'SET'} NOT NULL;`
        };
    }
    // Pattern: "Critical table 'TableName' does not exist"
    const missingTableMatch = error.match(/Critical table '(\w+)' does not exist/);
    if (missingTableMatch) {
        const [, tableName] = missingTableMatch;
        return {
            description: `Create missing table ${tableName}`,
            sql: `-- Cannot auto-create table ${tableName}, please use 'npm run db:push --force' to create missing tables`
        };
    }
    console.warn(`⚠️  Could not generate migration for error: ${error}`);
    return null;
}
async function generateAddColumnMigration(tableName, columnName) {
    // Define type mappings based on common patterns
    const columnTypeMappings = {
        'amountPaid': 'integer NOT NULL DEFAULT 0',
        'id': 'varchar PRIMARY KEY',
        'tenantId': 'varchar NOT NULL',
        'userId': 'varchar NOT NULL',
        'email': 'text NOT NULL',
        'firstName': 'text NOT NULL',
        'lastName': 'text NOT NULL',
        'name': 'text NOT NULL',
        'legalName': 'text NOT NULL',
        'status': 'text NOT NULL',
        'licenseType': 'text NOT NULL',
        'addonType': 'text NOT NULL',
    };
    const columnType = columnTypeMappings[columnName] || 'text';
    return {
        description: `Add missing column ${tableName}.${columnName}`,
        sql: `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType};`
    };
}
// Export function to help generate column definitions
export function getColumnDefinition(tableName, columnName) {
    // This would ideally read from the schema.ts file
    // For now, return a basic definition
    return { name: columnName, dataType: 'text', isNullable: true };
}
