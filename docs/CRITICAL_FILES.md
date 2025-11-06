
# Critical Files Registry

This document lists files that are **CRITICAL** to the application and must never be deleted or left empty.

## Database Schema Files

### `shared/schema.ts` 
**🚨 CRITICAL - DO NOT DELETE**

**Purpose**: Contains all database table definitions, relations, and TypeScript types for the entire application.

**Why Critical**: 
- Defines the complete database structure
- Contains TypeScript types used across client and server
- Required for database migrations and queries
- Loss of this file breaks the entire application

**Validation**: 
- Must be > 1KB in size
- Must contain: `pgTable`, `users`, `assessments`, `export`
- Validated in pre-commit hooks and CI

**Recovery**: If accidentally deleted, restore from:
1. Git history: `git checkout HEAD~1 -- shared/schema.ts`
2. Regenerate from migration files in `migrations/` directory
3. Restore from backup in `server/db.ts` (partial schema may exist)

### `server/db.ts`
**🚨 CRITICAL - DO NOT DELETE**

**Purpose**: Database connection configuration and Drizzle setup.

**Why Critical**: Required for all database operations.

### `drizzle.config.ts`
**🚨 CRITICAL - DO NOT DELETE**

**Purpose**: Drizzle ORM configuration for migrations and schema management.

**Why Critical**: Required for database schema changes and migrations.

## Configuration Files

### `package.json`
**🚨 CRITICAL - DO NOT DELETE**

**Purpose**: Project dependencies and scripts configuration.

**Why Critical**: Required for npm operations and dependency management.

## Protection Mechanisms

### Pre-commit Hook Protection
Located in `.husky/pre-commit`, validates critical files before each commit:
```bash
CRITICAL_FILES=("shared/schema.ts" "server/db.ts" "drizzle.config.ts")
```

### CI Validation
GitHub Actions workflow validates critical files on every push/PR in `.github/workflows/ci-gates.yml`.

### Validation Script
Run manually: `npx tsx scripts/validate-critical-files.ts`

## Emergency Recovery Procedures

### If `shared/schema.ts` is Deleted or Corrupted:

1. **Immediate Recovery from Git**:
   ```bash
   git checkout HEAD~1 -- shared/schema.ts
   ```

2. **Regenerate from Migrations**:
   ```bash
   npx drizzle-kit introspect:pg
   ```

3. **Restore from Database**:
   ```bash
   npx drizzle-kit pull:pg
   ```

### If Multiple Critical Files are Missing:

1. **Check Git Status**:
   ```bash
   git status
   git log --oneline -10
   ```

2. **Restore from Last Good Commit**:
   ```bash
   git checkout HEAD~1 -- shared/schema.ts server/db.ts drizzle.config.ts
   ```

3. **Run Validation**:
   ```bash
   npx tsx scripts/validate-critical-files.ts
   ```

## Adding New Critical Files

To add a file to the critical files list:

1. Add to `CRITICAL_FILES` array in `scripts/validate-critical-files.ts`
2. Add to `.husky/pre-commit` validation
3. Add to `.github/workflows/ci-gates.yml`
4. Document in this file with recovery procedures

## Monitoring and Alerts

- Pre-commit hooks prevent commits with missing critical files
- CI fails if critical files are missing or empty
- Validation script can be run in production health checks
- Consider adding file system monitoring in production

---

**⚠️ WARNING**: Bypassing critical file validation can break the entire application. Always ensure critical files are present and valid before deploying.
