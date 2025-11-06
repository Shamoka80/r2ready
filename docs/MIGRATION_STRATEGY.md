
# Migration & Rollback Strategy

**Created**: October 1, 2025  
**Version**: 1.0  
**Owner**: DevOps Lead  

## Drizzle Migration Workflow

### Migration Development Process

1. **Schema Changes**
   ```bash
   # Generate migration after schema changes
   npx drizzle-kit generate:pg
   ```

2. **Migration Review**
   - Review generated SQL in `migrations/` directory
   - Validate migration logic
   - Test in development environment
   - Document breaking changes

3. **Migration Testing**
   ```bash
   # Test migration
   npx tsx scripts/migrate-database.ts --dry-run
   
   # Validate schema after migration
   npx tsx scripts/validate-migrations.ts
   ```

### Production Migration Procedure

#### Pre-Migration Checklist
- [ ] Database backup completed
- [ ] Migration tested in staging
- [ ] Rollback plan prepared
- [ ] Team notified of maintenance window
- [ ] Health monitoring active

#### Migration Execution
```bash
# 1. Enable maintenance mode
echo "MAINTENANCE_MODE=true" >> .env

# 2. Stop application traffic
# (Replit deployments handle this automatically)

# 3. Create pre-migration backup
npm run backup:create

# 4. Execute migration
npx tsx scripts/migrate-database.ts

# 5. Validate migration success
npx tsx scripts/validate-migrations.ts

# 6. Start application
# 7. Verify application health
# 8. Disable maintenance mode
```

## Rollback Runbook

### Automatic Rollback Triggers
- Migration fails during execution
- Schema validation fails
- Application health checks fail
- Database integrity checks fail

### Manual Rollback Decision Criteria
- **Critical**: Data corruption detected
- **High**: Application completely non-functional
- **Medium**: Significant performance degradation
- **Low**: Minor feature issues (fix forward)

### Rollback Procedure

#### Step 1: Immediate Response
```bash
# Stop application immediately
killall node

# Enable maintenance mode
echo "MAINTENANCE_MODE=true" >> .env
```

#### Step 2: Database Rollback
```bash
# Option A: Restore from backup (Complete rollback)
npm run backup:restore --backup-id=pre-migration-$(date +%Y%m%d)

# Option B: Execute down migration (if available)
npx drizzle-kit migrate:down --steps=1
```

#### Step 3: Application Rollback
```bash
# Revert to previous deployment
git checkout HEAD~1
npm install
npm run build
```

#### Step 4: Validation
```bash
# Verify database integrity
npx tsx scripts/validate-migrations.ts

# Run health checks
npx tsx scripts/comprehensive-health-check.ts

# Test critical user flows
npm run test:e2e:critical
```

#### Step 5: Recovery
```bash
# Start application
npm run start

# Monitor logs and metrics
tail -f logs/application.log

# Verify user access
curl -f https://app.replit.app/api/health
```

## Migration Testing Requirements

### Development Testing
- **Unit Tests**: Test migration logic
- **Integration Tests**: Validate schema changes
- **Performance Tests**: Measure migration duration
- **Rollback Tests**: Verify rollback procedures

### Staging Validation
- **Full Migration**: Complete migration on staging data
- **Data Integrity**: Validate all data after migration
- **Application Tests**: Run full test suite
- **Performance Validation**: Benchmark critical queries

### Production Readiness
- **Backup Verification**: Confirm backup completion
- **Rollback Rehearsal**: Practice rollback procedure
- **Team Coordination**: All team members briefed
- **Monitoring Setup**: Enhanced monitoring during migration

## Emergency Procedures

### Migration Stuck/Hanging
```bash
# 1. Check migration process
ps aux | grep drizzle

# 2. Check database locks
SELECT * FROM pg_locks WHERE granted = false;

# 3. Kill hanging migration (last resort)
kill -9 <migration-process-id>

# 4. Assess database state
npx tsx scripts/assess-migration-state.ts

# 5. Execute rollback if necessary
```

### Data Corruption Detection
```bash
# 1. Stop all write operations
echo "READ_ONLY_MODE=true" >> .env

# 2. Assess corruption scope
npx tsx scripts/data-integrity-check.ts

# 3. Restore from backup
npm run backup:restore --verify-integrity

# 4. Validate restoration
npx tsx scripts/validate-data-integrity.ts
```

### Communication Procedures
- **Internal**: Slack #incidents channel
- **External**: Status page update
- **Stakeholders**: Email notification
- **Users**: In-app notification

## Migration Monitoring

### Key Metrics
- **Duration**: Track migration execution time
- **Locks**: Monitor database lock duration
- **Performance**: Query performance before/after
- **Errors**: Track migration failures

### Alerting Thresholds
- **Critical**: Migration running > 30 minutes
- **Warning**: Migration running > 10 minutes
- **Info**: Migration started/completed

### Post-Migration Validation
- [ ] All tables exist with correct schema
- [ ] All indexes created successfully
- [ ] Data integrity constraints satisfied
- [ ] Application startup successful
- [ ] Critical user flows functional
- [ ] Performance within acceptable ranges

## Documentation Requirements

### Migration Documentation
Each migration must include:
- **Purpose**: What changes are being made
- **Impact**: How it affects existing data
- **Dependencies**: Required for which features
- **Rollback**: How to undo the changes
- **Testing**: How it was validated

### Change Log
- Track all schema changes
- Document breaking changes
- Version compatibility matrix
- Performance impact analysis

---

**Last Updated**: October 1, 2025  
**Next Review**: January 1, 2026  
**Approved By**: DevOps Lead, CTO
