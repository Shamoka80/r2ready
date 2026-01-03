import { db } from '../db';
import { sql } from 'drizzle-orm';

interface ColumnDefinition {
  name: string;
  dataType: string;
  isNullable: boolean;
}

interface TableDefinition {
  tableName: string;
  columns: ColumnDefinition[];
}

// Define critical tables and columns that must exist
const CRITICAL_SCHEMA: TableDefinition[] = [
  {
    tableName: 'Tenant',
    columns: [
      { name: 'id', dataType: 'character varying', isNullable: false },
      { name: 'name', dataType: 'text', isNullable: false },
      { name: 'tenantType', dataType: 'USER-DEFINED', isNullable: false },
    ]
  },
  {
    tableName: 'User',
    columns: [
      { name: 'id', dataType: 'character varying', isNullable: false },
      { name: 'tenantId', dataType: 'character varying', isNullable: false },
      { name: 'email', dataType: 'text', isNullable: false },
      { name: 'firstName', dataType: 'text', isNullable: false },
      { name: 'lastName', dataType: 'text', isNullable: false },
    ]
  },
  {
    tableName: 'IntakeForm',
    columns: [
      { name: 'id', dataType: 'character varying', isNullable: false },
      { name: 'tenantId', dataType: 'character varying', isNullable: false },
      { name: 'userId', dataType: 'character varying', isNullable: false },
      { name: 'facilityId', dataType: 'character varying', isNullable: true },
      { name: 'status', dataType: 'USER-DEFINED', isNullable: false },
    ]
  },
  {
    tableName: 'ClientOrganization',
    columns: [
      { name: 'id', dataType: 'character varying', isNullable: false },
      { name: 'tenantId', dataType: 'character varying', isNullable: false },
      { name: 'consultantTenantId', dataType: 'character varying', isNullable: false },
      { name: 'legalName', dataType: 'text', isNullable: false },
    ]
  },
  {
    tableName: 'FacilityProfile',
    columns: [
      { name: 'id', dataType: 'character varying', isNullable: false },
      { name: 'tenantId', dataType: 'character varying', isNullable: false },
      { name: 'name', dataType: 'text', isNullable: false },
    ]
  },
  {
    tableName: 'OrganizationProfile',
    columns: [
      { name: 'id', dataType: 'character varying', isNullable: false },
      { name: 'tenantId', dataType: 'character varying', isNullable: false },
      { name: 'legalName', dataType: 'text', isNullable: false },
    ]
  },
  {
    tableName: 'License',
    columns: [
      { name: 'id', dataType: 'character varying', isNullable: false },
      { name: 'tenantId', dataType: 'character varying', isNullable: false },
      { name: 'licenseType', dataType: 'text', isNullable: false },
      { name: 'amountPaid', dataType: 'integer', isNullable: false },
    ]
  },
  {
    tableName: 'LicenseAddon',
    columns: [
      { name: 'id', dataType: 'character varying', isNullable: false },
      { name: 'tenantId', dataType: 'character varying', isNullable: false },
      { name: 'addonType', dataType: 'text', isNullable: false },
      { name: 'amountPaid', dataType: 'integer', isNullable: false },
    ]
  },
];

interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateSchemaConsistency(): Promise<SchemaValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('🔍 Starting database schema validation...');

  try {
    for (const tableDefinition of CRITICAL_SCHEMA) {
      const { tableName, columns } = tableDefinition;

      // Check if table exists
      let tableExistsQuery;
      try {
        tableExistsQuery = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          );
        `);
      } catch (queryError) {
        const errorMsg = queryError instanceof Error ? queryError.message : String(queryError);
        errors.push(`❌ Failed to check if table '${tableName}' exists: ${errorMsg}`);
        continue;
      }

      let tableExists = false;
      if (tableExistsQuery && tableExistsQuery.rows && Array.isArray(tableExistsQuery.rows) && tableExistsQuery.rows.length > 0) {
        tableExists = (tableExistsQuery.rows[0] as any)?.exists ?? false;
      } else if (Array.isArray(tableExistsQuery) && tableExistsQuery.length > 0) {
        tableExists = (tableExistsQuery[0] as any)?.exists ?? false;
      } else {
        warnings.push(`⚠️  Could not determine if table '${tableName}' exists - unexpected result structure`);
        continue;
      }

      if (!tableExists) {
        errors.push(`❌ Critical table '${tableName}' does not exist in the database`);
        continue;
      }

      // Get actual columns from database
      let columnsQuery;
      try {
        columnsQuery = await db.execute(sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
          ORDER BY ordinal_position;
        `);
      } catch (queryError) {
        const errorMsg = queryError instanceof Error ? queryError.message : String(queryError);
        errors.push(`❌ Failed to get columns for table '${tableName}': ${errorMsg}`);
        continue;
      }

      let actualColumns: Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }> = [];
      if (columnsQuery && columnsQuery.rows && Array.isArray(columnsQuery.rows)) {
        actualColumns = columnsQuery.rows as Array<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>;
      } else if (Array.isArray(columnsQuery)) {
        actualColumns = columnsQuery as Array<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>;
      } else {
        warnings.push(`⚠️  Could not get columns for table '${tableName}' - unexpected result structure`);
        continue;
      }

      // Check each expected column
      for (const expectedColumn of columns) {
        const actualColumn = actualColumns.find(
          (col) => col.column_name === expectedColumn.name
        );

        if (!actualColumn) {
          errors.push(
            `❌ Column '${expectedColumn.name}' is missing from table '${tableName}'`
          );
          continue;
        }

        // Validate data type (allow some flexibility for enums and postgres types)
        const actualType = actualColumn.data_type.toLowerCase();
        const expectedType = expectedColumn.dataType.toLowerCase();

        if (
          actualType !== expectedType &&
          !(expectedType === 'user-defined' && actualType === 'user-defined')
        ) {
          warnings.push(
            `⚠️  Column '${tableName}.${expectedColumn.name}' has type '${actualType}' but expected '${expectedType}'`
          );
        }

        // Validate nullability
        const actualNullable = actualColumn.is_nullable === 'YES';
        if (actualNullable !== expectedColumn.isNullable) {
          warnings.push(
            `⚠️  Column '${tableName}.${expectedColumn.name}' nullability mismatch: ` +
            `actual=${actualNullable}, expected=${expectedColumn.isNullable}`
          );
        }
      }
    }

    // Summary
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ Database schema validation passed - all critical tables and columns exist');
      return { isValid: true, errors: [], warnings: [] };
    }

    if (errors.length > 0) {
      console.error('\n❌ SCHEMA VALIDATION FAILED:');
      errors.forEach(error => console.error(`  ${error}`));
    }

    if (warnings.length > 0) {
      console.warn('\n⚠️  Schema validation warnings:');
      warnings.forEach(warning => console.warn(`  ${warning}`));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`❌ Schema validation error: ${errorMessage}`);
    console.error('❌ Schema validation failed with error:', error);
    return { isValid: false, errors, warnings };
  }
}

export class SchemaValidationError extends Error {
  constructor(public validationResult: SchemaValidationResult) {
    super('Database schema validation failed');
    this.name = 'SchemaValidationError';
  }
}
