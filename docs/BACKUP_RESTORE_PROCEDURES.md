
# Backup & Restore Procedures

**Created**: October 1, 2025  
**Version**: 1.0  
**Owner**: DevOps Lead  

## Backup Schedule

### Database Backups
- **Full Backup**: Daily at 2:00 AM UTC
- **Incremental Backup**: Every 4 hours
- **Point-in-Time Recovery**: Enabled (15-minute intervals)
- **Retention**: 90 days for daily, 7 days for incremental

### Application Backups
- **Code Repository**: Git-based, continuous
- **Configuration**: Daily backup with database
- **User Uploads**: Synced to cloud storage backup
- **Logs**: 30-day retention, compressed after 7 days

### Replit Checkpoint Integration
- **Automatic**: Replit creates checkpoints on deploy
- **Manual**: Triggered before major changes
- **Retention**: 30 checkpoints per Repl
- **Recovery**: Instant rollback to any checkpoint

## Recovery Time & Point Objectives

### RTO (Recovery Time Objective)
- **Critical Systems**: < 1 hour
- **Database**: < 30 minutes
- **Application**: < 15 minutes
- **Complete System**: < 2 hours

### RPO (Recovery Point Objective)
- **Database**: < 5 minutes (point-in-time recovery)
- **File Storage**: < 15 minutes
- **Configuration**: < 1 hour
- **User Sessions**: < 5 minutes

## Backup Procedures

### Automated Database Backup
```bash
#!/bin/bash
# Automated backup script (runs via cron)

BACKUP_DIR="/tmp/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="${DATABASE_URL}"

# Create backup directory
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump $DATABASE_URL > $BACKUP_DIR/db_backup_$TIMESTAMP.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$TIMESTAMP.sql

# Upload to cloud storage (if configured)
if [ ! -z "$BACKUP_STORAGE_URL" ]; then
    aws s3 cp $BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz $BACKUP_STORAGE_URL/
fi

# Clean old local backups (keep 3 days)
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +3 -delete

echo "Backup completed: db_backup_$TIMESTAMP.sql.gz"
```

### Manual Backup Procedure
```bash
# 1. Create immediate backup
npm run backup:create

# 2. Verify backup integrity
npm run backup:verify --backup-id=latest

# 3. Test restore in non-production environment
npm run backup:test-restore --backup-id=latest --env=test
```

### Configuration Backup
```bash
# Backup environment configuration
cp .env .env.backup.$(date +%Y%m%d)
cp .replit .replit.backup.$(date +%Y%m%d)

# Backup application configuration
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
    .env* .replit package*.json tsconfig.json drizzle.config.ts
```

## Restore Procedures

### Database Restore

#### Full Database Restore
```bash
#!/bin/bash
# Full database restore procedure

BACKUP_FILE="$1"
DATABASE_URL="${DATABASE_URL}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: restore-db.sh <backup-file>"
    exit 1
fi

echo "WARNING: This will completely replace the current database!"
echo "Backup file: $BACKUP_FILE"
echo "Press CTRL+C to cancel, or wait 10 seconds to continue..."
sleep 10

# 1. Stop application
echo "Stopping application..."
killall node 2>/dev/null || true

# 2. Create safety backup
echo "Creating safety backup..."
pg_dump $DATABASE_URL > safety_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Drop existing database (if restoring completely)
echo "Preparing database for restore..."
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 4. Restore from backup
echo "Restoring database..."
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c $BACKUP_FILE | psql $DATABASE_URL
else
    psql $DATABASE_URL < $BACKUP_FILE
fi

# 5. Verify restoration
echo "Verifying database integrity..."
npx tsx scripts/validate-migrations.ts

# 6. Start application
echo "Starting application..."
npm run start

echo "Database restore completed successfully!"
```

#### Point-in-Time Recovery
```bash
# Restore to specific timestamp
RESTORE_TIME="2025-01-01 12:30:00"

# Using Neon's point-in-time recovery
neon restore --database=production --timestamp="$RESTORE_TIME"

# Verify restoration point
psql $DATABASE_URL -c "SELECT NOW() as current_time, '$RESTORE_TIME'::timestamp as restore_point;"
```

### Application Restore

#### Replit Checkpoint Restore
1. **Access Replit History**
   - Click three dots menu
   - Select "History"
   - Choose checkpoint before issue

2. **Verify Checkpoint**
   - Review changed files
   - Check timestamp
   - Confirm changes to revert

3. **Restore Checkpoint**
   - Click "Restore"
   - Confirm restoration
   - Test application functionality

#### Git-Based Restore
```bash
# 1. Identify commit to restore to
git log --oneline -10

# 2. Create branch for current state (safety)
git checkout -b backup-before-restore

# 3. Restore to specific commit
git checkout main
git reset --hard <commit-hash>

# 4. Reinstall dependencies
npm install

# 5. Rebuild application
npm run build

# 6. Restart services
npm run start
```

### File Storage Restore
```bash
# Restore user uploads from cloud backup
aws s3 sync s3://backup-bucket/uploads/ server/uploads/

# Verify file integrity
npx tsx scripts/verify-file-integrity.ts

# Update file permissions
chmod -R 644 server/uploads/
```

## Disaster Recovery Scenarios

### Complete System Failure

#### Recovery Steps
1. **Assess Damage**
   - Determine scope of failure
   - Identify last known good state
   - Estimate recovery time

2. **Initialize New Environment**
   ```bash
   # Create new Repl from backup
   git clone <repository-url> rur2-recovery
   cd rur2-recovery
   npm install
   ```

3. **Restore Database**
   ```bash
   # Restore from latest backup
   npm run backup:restore --backup-id=latest
   ```

4. **Restore Configuration**
   ```bash
   # Restore environment variables
   cp .env.backup .env
   
   # Update database connections if needed
   nano .env
   ```

5. **Validate Recovery**
   ```bash
   # Run health checks
   npm run health:check
   
   # Test critical flows
   npm run test:e2e:critical
   ```

### Partial Data Loss

#### Recovery Approach
1. **Stop Write Operations**
   ```bash
   echo "READ_ONLY_MODE=true" >> .env
   ```

2. **Assess Data Loss Scope**
   ```bash
   npx tsx scripts/assess-data-loss.ts
   ```

3. **Restore Missing Data**
   ```bash
   # Selective restore from backup
   npm run backup:restore-selective --tables=affected_table
   ```

4. **Verify Data Integrity**
   ```bash
   npx tsx scripts/validate-data-integrity.ts
   ```

### Configuration Corruption

#### Recovery Steps
1. **Restore from Git**
   ```bash
   git checkout HEAD -- .env .replit package.json
   ```

2. **Restore from Backup**
   ```bash
   cp config_backup_latest.tar.gz ./
   tar -xzf config_backup_latest.tar.gz
   ```

3. **Validate Configuration**
   ```bash
   npm run config:validate
   ```

## Backup Testing

### Monthly Restore Testing
```bash
#!/bin/bash
# Monthly backup validation script

# 1. Create test environment
npm run env:create-test

# 2. Restore latest backup to test
npm run backup:restore --env=test --backup-id=latest

# 3. Run validation tests
npm run test:backup-integrity

# 4. Test critical user flows
npm run test:e2e:critical --env=test

# 5. Performance validation
npm run test:performance --env=test

# 6. Cleanup test environment
npm run env:cleanup-test

echo "Backup testing completed successfully!"
```

### Backup Integrity Checks
- **Checksum Validation**: Verify backup file integrity
- **Restore Testing**: Monthly full restore tests
- **Data Validation**: Verify data completeness
- **Performance Testing**: Ensure restore meets RTO

## Monitoring & Alerting

### Backup Monitoring
- **Success/Failure**: Alert on backup failures
- **Duration**: Alert if backup takes > 1 hour
- **Size**: Alert on significant size changes
- **Schedule**: Alert on missed scheduled backups

### Restore Monitoring
- **RTO Tracking**: Measure actual recovery times
- **Success Rate**: Track restore success rate
- **Data Integrity**: Validate restored data
- **Performance Impact**: Monitor post-restore performance

### Alert Thresholds
- **Critical**: Backup failure, RTO exceeded
- **Warning**: Backup duration increase, size anomaly
- **Info**: Backup completion, successful restore

## Compliance Requirements

### Data Retention
- **Customer Data**: Retain per agreement (typically 7 years)
- **Audit Logs**: 7 years minimum
- **Backup Logs**: 1 year
- **Security Logs**: 2 years

### Encryption Requirements
- **At Rest**: All backups encrypted with AES-256
- **In Transit**: TLS 1.3 for backup transfers
- **Key Management**: Rotate encryption keys annually

### Access Controls
- **Backup Access**: Limited to DevOps team
- **Restore Authorization**: Requires manager approval
- **Audit Trail**: Log all backup/restore operations

---

**Last Updated**: October 1, 2025  
**Next Review**: January 1, 2026  
**Approved By**: DevOps Lead, Security Lead, CTO
