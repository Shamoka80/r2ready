# Release Runbook

**Last Updated**: October 1, 2025  
**Owner**: DevOps Lead  
**Stakeholders**: Engineering, QA, Product, SRE  

---

## Table of Contents

1. [Pre-Release (T-7 days)](#pre-release-t-7-days)
2. [Environment Validation](#environment-validation)
3. [Release Day (T-0)](#release-day-t-0)
4. [Smoke Test Procedures](#smoke-test-procedures)
5. [Success Metrics & Go/No-Go Criteria](#success-metrics--gono-go-criteria)
6. [Rollback Procedures](#rollback-procedures)
7. [Post-Release (T+1 to T+7)](#post-release-t1-to-t7)
8. [Environment Owners](#environment-owners)
9. [Handoff Checklists](#handoff-checklists)
10. [Communication Templates](#communication-templates)

---

## Pre-Release (T-7 days)

### Day T-7: Release Branch Creation
- [ ] Create release branch from develop (`release/v{version}`)
- [ ] Update version numbers in:
  - [ ] `package.json`
  - [ ] `client/package.json` (if separate)
  - [ ] Environment configuration files
- [ ] Generate CHANGELOG.md from git commits
- [ ] Tag release candidate: `v{version}-rc.1`
- [ ] Notify team via Slack #releases channel

### Day T-6 to T-5: Testing Phase
- [ ] Run full regression test suite (Playwright E2E)
- [ ] Execute performance benchmarks
  - [ ] API response times <200ms for P95
  - [ ] Page load times <2s for P95
  - [ ] Database query performance <100ms
- [ ] Run security scan (npm audit, Snyk)
- [ ] Verify all E2E test scenarios pass (95%+ pass rate)

### Day T-4: Staging Deployment
- [ ] Deploy release candidate to staging environment
- [ ] Verify staging deployment health
- [ ] Conduct User Acceptance Testing (UAT)
- [ ] Test Stripe payment flows (test mode)
- [ ] Verify Neon database migrations
- [ ] Performance testing on staging

### Day T-3 to T-2: Final Validation
- [ ] UAT sign-off from Product Owner
- [ ] Security scan approval
- [ ] Performance test results reviewed
- [ ] Create production deployment plan
- [ ] Schedule deployment window (Tuesday-Thursday, 10 AM - 2 PM ET)

### Day T-1: Pre-Deployment Prep
- [ ] Freeze code (no changes except critical bugs)
- [ ] Create production database backup via Neon
- [ ] Verify staging-to-production parity (>90%)
- [ ] Pre-deployment handoff checklist completed (see [Handoff Checklists](#handoff-checklists))
- [ ] Send release start announcement (see [Communication Templates](#communication-templates))
- [ ] Confirm on-call rotation assignments
- [ ] Review rollback procedures with team

---

## Environment Validation

### Pre-Deployment Environment Health Checks

Run these checks **1 hour before deployment** to ensure environment readiness.

#### 1. Infrastructure Health Check
```bash
# Check Replit deployment status
curl -f https://rur2-production.replit.app/health || echo "FAIL: Application not responding"

# Verify SSL certificate
openssl s_client -connect rur2-production.replit.app:443 -servername rur2-production.replit.app < /dev/null 2>/dev/null | openssl x509 -noout -dates

# Check DNS resolution
nslookup rur2-production.replit.app
```

**Success Criteria**: HTTP 200, valid SSL certificate, DNS resolves correctly

#### 2. Database Health Check (Neon)
```bash
# Verify database connectivity
npx drizzle-kit introspect --config=drizzle.config.ts

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();"

# Verify schema version
psql $DATABASE_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"
```

**Success Criteria**: 
- Connection pool <80% capacity
- Schema version matches expected release version
- No blocking queries >30 seconds

#### 3. External Service Health
```bash
# Stripe API connectivity
curl -f https://api.stripe.com/v1/charges -u "$STRIPE_SECRET_KEY:" || echo "FAIL: Stripe API unreachable"

# Verify webhook endpoints
curl -f https://rur2-production.replit.app/api/payments/webhook -X POST -H "Content-Type: application/json" -d '{"test": true}'
```

**Success Criteria**: 
- Stripe API responds with HTTP 200 or 401 (auth working)
- Webhook endpoint returns 200 or 400 (endpoint exists)

#### 4. Staging-to-Production Parity Verification

Run weekly and before each deployment:

```bash
#!/bin/bash
# parity-check.sh

echo "=== Dependency Parity Check ==="
STAGING_DEPS=$(curl -s https://rur2-staging.replit.app/api/health | jq -r '.dependencies')
PROD_DEPS=$(curl -s https://rur2-production.replit.app/api/health | jq -r '.dependencies')
diff <(echo "$STAGING_DEPS") <(echo "$PROD_DEPS") || echo "WARNING: Dependency mismatch"

echo "=== Environment Variable Structure Check ==="
# Compare env var keys (not values) between staging and production
# This assumes /api/health returns sanitized env structure
STAGING_ENV=$(curl -s https://rur2-staging.replit.app/api/health | jq -r '.env_keys | sort')
PROD_ENV=$(curl -s https://rur2-production.replit.app/api/health | jq -r '.env_keys | sort')
diff <(echo "$STAGING_ENV") <(echo "$PROD_ENV") || echo "WARNING: Environment structure mismatch"

echo "=== Database Schema Parity ==="
# Compare schema versions
STAGING_SCHEMA=$(psql $DATABASE_URL_STAGING -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;")
PROD_SCHEMA=$(psql $DATABASE_URL_PROD -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;")
echo "Staging schema: $STAGING_SCHEMA"
echo "Production schema: $PROD_SCHEMA"
```

**Parity Threshold**: >90% match required for go-live approval

**Acceptable Differences**:
- Environment variable values (API keys, secrets)
- Database data volume
- Log verbosity levels
- Rate limiting thresholds (may be lower in staging)

**Unacceptable Differences**:
- Node.js version mismatch
- npm package version differences
- Database schema version mismatch
- Missing environment variables

#### 5. Database Migration Validation

**Pre-Deployment Migration Check**:
```bash
# Dry-run migration on staging
npm run db:migrate:dry-run

# Check for destructive operations
grep -i "DROP\|DELETE\|TRUNCATE" migrations/*.sql && echo "WARNING: Destructive migration detected"

# Verify rollback migrations exist
ls -la migrations/*_rollback.sql || echo "WARNING: No rollback migrations found"
```

**Migration Execution**:
1. Create Neon branch for migration testing
2. Run migration on branch: `npm run db:push`
3. Verify data integrity queries
4. Merge branch to production database

**Rollback Plan**: 
- Keep previous schema version backed up
- Neon point-in-time recovery available (7 days retention)
- Manual rollback scripts in `migrations/*_rollback.sql`

#### 6. Configuration Drift Detection

**Automated Drift Check** (runs daily):
```bash
#!/bin/bash
# config-drift-check.sh

# Compare Replit Secrets with expected configuration
EXPECTED_SECRETS=("DATABASE_URL" "STRIPE_SECRET_KEY" "JWT_SECRET" "NEON_API_KEY")
MISSING_SECRETS=()

for secret in "${EXPECTED_SECRETS[@]}"; do
  if ! replit secrets list | grep -q "^$secret"; then
    MISSING_SECRETS+=("$secret")
  fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  echo "ALERT: Missing secrets: ${MISSING_SECRETS[*]}"
  # Send Slack alert
  curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"⚠️ Config drift detected: Missing secrets in production"}'
fi

# Check for unexpected configuration changes
CURRENT_CONFIG_HASH=$(md5sum .env.example | awk '{print $1}')
LAST_KNOWN_HASH=$(cat .env.example.md5)

if [ "$CURRENT_CONFIG_HASH" != "$LAST_KNOWN_HASH" ]; then
  echo "WARNING: Configuration structure changed"
  echo "$CURRENT_CONFIG_HASH" > .env.example.md5
fi
```

**Drift Resolution**:
- Automatically alert DevOps team via Slack
- Create incident ticket for investigation
- Restore from known-good configuration baseline
- Document drift in change log

---

## Release Day (T-0)

### Morning Preparation (9:00 AM - 10:00 AM)

#### 9:00 AM: Team Standup
- [ ] All team members present (Engineering, DevOps, QA, Product)
- [ ] Review release checklist
- [ ] Confirm no blocking issues
- [ ] Assign roles:
  - **Deployment Lead**: Executes deployment
  - **Monitor**: Watches metrics/logs
  - **Communications**: Updates stakeholders
  - **Rollback Lead**: Prepared to execute rollback if needed

#### 9:30 AM: Final Environment Validation
- [ ] Run environment health checks (see [Environment Validation](#environment-validation))
- [ ] Verify staging health: `curl https://rur2-staging.replit.app/health`
- [ ] Confirm all pre-deployment checks pass
- [ ] Create production backup via Neon console
  - [ ] Verify backup completion
  - [ ] Document backup ID and timestamp

#### 9:45 AM: Go/No-Go Decision
- [ ] Review [Success Metrics & Go/No-Go Criteria](#success-metrics--gono-go-criteria)
- [ ] Product Owner approval
- [ ] Engineering Lead approval
- [ ] DevOps Lead approval
- [ ] If NO-GO: Postpone deployment, notify stakeholders

### Deployment Execution (10:00 AM - 10:30 AM)

#### 10:00 AM: Start Deployment
- [ ] Send "Release Start" announcement (see [Communication Templates](#communication-templates))
- [ ] Enable maintenance mode (if applicable)
- [ ] Merge release branch to main: `git merge release/v{version} --no-ff`
- [ ] Tag release: `git tag -a v{version} -m "Release v{version}"`
- [ ] Push to GitHub: `git push origin main --tags`

#### 10:05 AM: Database Migration (if needed)
- [ ] Execute database migrations on Neon production
- [ ] Verify migration success: `npm run db:migrate:status`
- [ ] Run post-migration data integrity checks

#### 10:10 AM: Replit Deployment
- [ ] Trigger deployment via GitHub Actions or Replit auto-deploy
- [ ] Monitor deployment logs in real-time
- [ ] Verify application startup
- [ ] Check for startup errors in logs

#### 10:15 AM: Smoke Tests
- [ ] Run automated smoke tests (see [Smoke Test Procedures](#smoke-test-procedures))
- [ ] Manual verification of critical paths
- [ ] Verify Stripe webhook connectivity

#### 10:20 AM: Health Verification
- [ ] Application responds: `curl https://rur2-production.replit.app/health`
- [ ] Database connectivity confirmed
- [ ] External services (Stripe) accessible
- [ ] No critical errors in logs

#### 10:25 AM: Disable Maintenance Mode
- [ ] Remove maintenance mode
- [ ] Send "Release Progress Update" (see [Communication Templates](#communication-templates))

### Post-Deployment Monitoring (10:30 AM - 12:30 PM)

#### First 30 Minutes (Critical Window)
- [ ] Monitor error rates (target: <0.5%)
- [ ] Track API response times (target: <200ms P95)
- [ ] Watch for Stripe payment failures
- [ ] Monitor database connection pool
- [ ] Check user authentication flows

#### 30-60 Minutes
- [ ] Review application logs for warnings
- [ ] Verify background job processing
- [ ] Check assessment creation flow
- [ ] Validate PDF export functionality
- [ ] Monitor Neon database performance

#### 60-120 Minutes (Extended Monitoring)
- [ ] Continuous error rate monitoring
- [ ] Performance metrics tracking
- [ ] User feedback monitoring
- [ ] Verify all critical endpoints operational

### Release Completion (12:30 PM)

- [ ] If all success metrics met: Send "Release Complete" notification (see [Communication Templates](#communication-templates))
- [ ] If issues detected: Evaluate rollback criteria (see [Rollback Procedures](#rollback-procedures))
- [ ] Update status page to "All Systems Operational"
- [ ] Post-deployment handoff checklist completed (see [Handoff Checklists](#handoff-checklists))
- [ ] Schedule post-release retrospective

---

## Smoke Test Procedures

### Automated Smoke Test Suite

Run immediately after deployment (target: <5 minutes execution time)

#### 1. Health Endpoints
```bash
# System health check
curl -f https://rur2-production.replit.app/health
# Expected: {"status":"ok","timestamp":"2025-10-01T10:15:00Z","version":"2.0.0"}
# Response time: <100ms

# API health check
curl -f https://rur2-production.replit.app/api/health
# Expected: {"status":"healthy","database":"connected","stripe":"configured"}
# Response time: <200ms
```

#### 2. Authentication Flow
```bash
# User login endpoint
curl -X POST https://rur2-production.replit.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'
# Expected: {"token":"jwt_token_here","user":{...}}
# Response time: <300ms

# Session validation
curl https://rur2-production.replit.app/api/auth/me \
  -H "Authorization: Bearer {token}"
# Expected: {"id":123,"email":"test@example.com",...}
# Response time: <150ms
```

#### 3. Core Assessment Endpoints
```bash
# List assessments
curl https://rur2-production.replit.app/api/assessments \
  -H "Authorization: Bearer {token}"
# Expected: [{"id":1,"name":"Assessment 1",...}]
# Response time: <250ms

# Create assessment
curl -X POST https://rur2-production.replit.app/api/assessments \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Assessment","facilityId":1}'
# Expected: {"id":456,"name":"Smoke Test Assessment","status":"draft"}
# Response time: <400ms

# Fetch assessment details
curl https://rur2-production.replit.app/api/assessments/456 \
  -H "Authorization: Bearer {token}"
# Expected: {"id":456,"name":"Smoke Test Assessment","questions":[...]}
# Response time: <300ms
```

#### 4. Stripe Payment Integration
```bash
# Verify Stripe webhook endpoint
curl -X POST https://rur2-production.replit.app/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: {test_signature}" \
  -d '{"type":"checkout.session.completed","data":{...}}'
# Expected: {"received":true} or 400 (signature validation)
# Response time: <200ms

# Payment session creation (requires valid auth)
curl -X POST https://rur2-production.replit.app/api/payments/create-checkout \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_test_123"}'
# Expected: {"sessionId":"cs_test_...","url":"https://checkout.stripe.com/..."}
# Response time: <500ms
```

#### 5. Database Connectivity
```bash
# Run test query via API
curl https://rur2-production.replit.app/api/health/db \
  -H "Authorization: Bearer {admin_token}"
# Expected: {"connected":true,"latency_ms":45,"pool_size":10,"active_connections":3}
# Response time: <150ms
```

#### 6. File Upload/Evidence Management
```bash
# Upload evidence file (multipart form data)
curl -X POST https://rur2-production.replit.app/api/assessments/456/evidence \
  -H "Authorization: Bearer {token}" \
  -F "file=@test-evidence.pdf" \
  -F "questionId=789"
# Expected: {"id":999,"filename":"test-evidence.pdf","url":"https://..."}
# Response time: <1000ms (includes file processing)
```

#### 7. Export Functionality
```bash
# Generate assessment PDF
curl -X POST https://rur2-production.replit.app/api/assessments/456/export \
  -H "Authorization: Bearer {token}"
# Expected: {"exportId":"exp_123","status":"processing"}
# Response time: <500ms

# Download PDF (after processing)
curl https://rur2-production.replit.app/api/exports/exp_123/download \
  -H "Authorization: Bearer {token}" \
  --output test-export.pdf
# Expected: PDF file download, HTTP 200
# Response time: <2000ms
```

### Performance Thresholds

| Endpoint | P95 Response Time | Max Response Time | Error Rate |
|----------|-------------------|-------------------|------------|
| GET /health | <100ms | <200ms | <0.1% |
| GET /api/health | <200ms | <400ms | <0.1% |
| POST /api/auth/login | <300ms | <600ms | <0.5% |
| GET /api/assessments | <250ms | <500ms | <0.5% |
| POST /api/assessments | <400ms | <800ms | <1% |
| GET /api/assessments/:id | <300ms | <600ms | <0.5% |
| POST /api/payments/webhook | <200ms | <400ms | <0.1% |
| POST /api/payments/create-checkout | <500ms | <1000ms | <1% |
| POST /api/assessments/:id/evidence | <1000ms | <2000ms | <2% |
| POST /api/assessments/:id/export | <500ms | <1000ms | <1% |

### Data Integrity Checks

**Post-Deployment Data Validation**:
```sql
-- Verify no data loss during migration
SELECT COUNT(*) FROM assessments; -- Should match pre-deployment count
SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'; -- Recent users intact
SELECT COUNT(*) FROM evidence_files WHERE uploaded_at >= NOW() - INTERVAL '24 hours'; -- Recent uploads intact

-- Check referential integrity
SELECT COUNT(*) FROM assessments a 
LEFT JOIN facilities f ON a.facility_id = f.id 
WHERE f.id IS NULL; -- Should be 0 (no orphaned assessments)

-- Verify Stripe subscription sync
SELECT COUNT(*) FROM users WHERE stripe_customer_id IS NULL AND subscription_status = 'active'; 
-- Should be 0 (all active users have Stripe ID)
```

**Success Criteria**: 
- All data counts match pre-deployment baseline (±5% for active operations)
- No referential integrity violations
- No orphaned records

---

## Success Metrics & Go/No-Go Criteria

### Pre-Deployment Go/No-Go Decision (9:45 AM)

**GO Criteria** (all must be TRUE):
- [ ] All E2E tests pass (>95% pass rate)
- [ ] No P0/P1 bugs open in release branch
- [ ] UAT sign-off received from Product Owner
- [ ] Security scan shows no critical/high vulnerabilities
- [ ] Staging environment parity >90%
- [ ] Database backup completed successfully
- [ ] On-call team confirmed and ready
- [ ] Rollback procedures reviewed and understood
- [ ] All environment health checks pass

**NO-GO Criteria** (any one triggers postponement):
- [ ] P0/P1 bug discovered in release candidate
- [ ] E2E test pass rate <95%
- [ ] Security vulnerability (CVSS >7.0) detected
- [ ] Staging environment unavailable or unhealthy
- [ ] Database backup failed
- [ ] Key team member unavailable (no backup)
- [ ] Staging-to-production parity <80%

### Post-Deployment Success Criteria

**Immediate Success (0-30 minutes)** - Continue or Rollback Decision:
- **Error Rate**: <0.5% across all endpoints
- **API Response Time**: P95 <200ms, P99 <500ms
- **Critical Path Availability**: 100% (login, assessment creation, payment)
- **Database Performance**: Query time P95 <100ms
- **Stripe Integration**: Webhook processing <200ms, 0 payment failures
- **User Authentication**: <0.1% login failure rate

**If ANY metric exceeds threshold for >5 minutes**: Initiate rollback evaluation

**Extended Success (30-120 minutes)** - Continued Monitoring:
- **Sustained Error Rate**: <1%
- **No Critical Errors**: 0 P0 errors in logs
- **Performance Stability**: Response times within 10% of baseline
- **User Impact**: <5 customer complaints
- **Data Integrity**: No data loss or corruption detected

### Go/No-Go Decision Points

#### Decision Point 1: Pre-Deployment (9:45 AM)
- **Decision Makers**: Product Owner, Engineering Lead, DevOps Lead
- **Input**: Pre-deployment checklist, test results, environment health
- **Outcome**: GO (deploy at 10:00 AM) or NO-GO (postpone 24-48 hours)

#### Decision Point 2: Post-Smoke Tests (10:20 AM)
- **Decision Makers**: Deployment Lead, DevOps Lead
- **Input**: Smoke test results, initial error rates
- **Outcome**: CONTINUE (monitor) or ROLLBACK (execute immediate rollback)

#### Decision Point 3: 30-Minute Mark (10:45 AM)
- **Decision Makers**: Deployment Lead, Engineering Lead
- **Input**: Error rates, performance metrics, user feedback
- **Outcome**: SUCCESS (continue monitoring) or ROLLBACK (critical issues detected)

#### Decision Point 4: 2-Hour Mark (12:30 PM)
- **Decision Makers**: Product Owner, Engineering Lead
- **Input**: All success metrics, customer feedback, incident count
- **Outcome**: RELEASE COMPLETE (success) or INVESTIGATE (potential issues)

### Post-Release Validation Period

**First 24 Hours** (Intensive Monitoring):
- Hourly error rate checks
- Continuous performance monitoring
- Customer support ticket tracking
- Stripe payment success rate monitoring
- Database performance trending

**Days 2-7** (Extended Monitoring):
- Daily metrics review
- Performance trend analysis
- Customer feedback aggregation
- Bug report triage
- Post-release retrospective (Day 3-5)

**Success Declaration**: 
Release is considered successful if all metrics remain within thresholds for 48 hours with no P0/P1 incidents.

---

## Rollback Procedures

### Rollback Decision Criteria

**Immediate Rollback Required** (P0 - Execute within 5 minutes of detection):
- **Error Rate**: >5% across any critical endpoint for >5 minutes
- **Complete Service Outage**: Application unreachable for >2 minutes
- **Database Corruption**: Data integrity violation detected
- **Payment Failures**: Stripe payment success rate <90%
- **Security Breach**: Active security incident or data exposure
- **Critical Bug**: P0 bug causing customer data loss or financial impact

**Urgent Rollback** (P1 - Execute within 15 minutes):
- **Error Rate**: 2-5% for >10 minutes
- **Performance Degradation**: P95 response time >3x baseline for >10 minutes
- **Partial Outage**: Critical feature unavailable (e.g., assessment creation fails)
- **Database Issues**: Connection pool exhaustion, query timeouts >500ms
- **Integration Failure**: Stripe webhook processing failures >10%

**Evaluate Rollback** (P2 - Assess within 30 minutes):
- **Error Rate**: 1-2% for >15 minutes
- **Performance Issues**: P95 response time 2-3x baseline
- **Minor Feature Broken**: Non-critical functionality impaired
- **User Complaints**: >10 customer reports of same issue
- **Data Inconsistency**: Minor data sync issues (e.g., delayed exports)

**Monitor Only** (P3 - No immediate action):
- **Error Rate**: <1%
- **Acceptable Performance**: Response times within 2x baseline
- **Isolated Issues**: <3 customer reports, no pattern
- **Known Issues**: Previously documented and acceptable risks

### Rollback Execution Steps

**Target Rollback Time**: <15 minutes for P0 incidents, <30 minutes for P1

#### Step 1: Declare Rollback (0-2 minutes)
1. **Incident Commander** announces rollback decision in Slack #incidents
2. Send "Rollback Announcement" (see [Communication Templates](#communication-templates))
3. Notify on-call team and stakeholders
4. Assign roles:
   - **Rollback Lead**: Coordinates rollback execution
   - **Database Lead**: Handles database rollback
   - **Monitor**: Tracks metrics during rollback
   - **Communications**: Updates stakeholders

#### Step 2: Stop Incoming Changes (2-3 minutes)
1. Enable maintenance mode (if available) or display maintenance banner
2. Pause background job processing
3. Disable Stripe webhook processing (to prevent payment issues during rollback)
4. Redirect traffic to status page (if using CDN)

#### Step 3: Code Revert (3-8 minutes)

**Option A: Replit Deployment Rollback (Fastest - 5 minutes)**
```bash
# Via Replit Console (if supported)
replit deployments rollback --deployment-id {previous_deployment_id}

# Or via Git revert
git revert HEAD --no-edit
git push origin main --force-with-lease

# Replit auto-deploys from main branch
# Monitor deployment logs
```

**Option B: Git Tag Rollback (Alternative - 8 minutes)**
```bash
# Identify previous stable version
git tag -l "v*" --sort=-version:refname | head -5

# Reset main branch to previous version
git checkout main
git reset --hard v{previous_version}
git push origin main --force-with-lease

# Trigger Replit deployment
# Or manually redeploy via Replit console
```

#### Step 4: Database Rollback (3-5 minutes)

**Option A: Point-in-Time Recovery (Neon)**
```bash
# Via Neon Console
# 1. Navigate to Neon project dashboard
# 2. Select "Restore" option
# 3. Choose timestamp BEFORE deployment (e.g., 9:55 AM)
# 4. Confirm restore operation
# 5. Wait for restore completion (~2-3 minutes)
# 6. Update DATABASE_URL in Replit Secrets if branch changed
```

**Option B: Migration Rollback (If Minimal Schema Changes)**
```bash
# Run rollback migration scripts
npm run db:migrate:rollback

# Verify schema version
npx drizzle-kit introspect

# Confirm data integrity
npm run db:verify:integrity
```

**Data Loss Considerations**:
- Neon PITR: Loses all data written after restore point
- Migration rollback: May require manual data reconciliation
- Always communicate potential data loss to users

#### Step 5: Verify Rollback Success (8-12 minutes)
```bash
# Check application health
curl https://rur2-production.replit.app/health

# Run smoke tests on rolled-back version
npm run test:smoke:rollback

# Verify critical endpoints
curl https://rur2-production.replit.app/api/assessments \
  -H "Authorization: Bearer {test_token}"

# Check database connectivity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM assessments;"

# Verify Stripe integration (re-enable webhooks)
curl -X POST https://rur2-production.replit.app/api/payments/webhook/test
```

**Rollback Success Criteria**:
- [ ] Application health endpoint returns 200
- [ ] Error rate <1%
- [ ] API response times <300ms P95
- [ ] Database queries functional
- [ ] No data corruption detected
- [ ] Stripe webhooks processing correctly

#### Step 6: Re-enable Services (12-15 minutes)
1. Disable maintenance mode
2. Re-enable background job processing
3. Re-enable Stripe webhook processing
4. Restore normal traffic routing
5. Monitor error rates for 15 minutes

#### Step 7: Communicate Rollback Complete (15 minutes)
- Send "Rollback Complete" notification (see [Communication Templates](#communication-templates))
- Update status page
- Notify customer support team of potential user impact

### Post-Rollback Investigation Process

**Immediate Actions (0-2 hours post-rollback)**:
1. **Preserve Evidence**:
   - Export application logs from failed deployment window
   - Capture database state snapshots
   - Save error rate graphs and metrics
   - Document user reports and incident timeline

2. **Initial Root Cause Analysis**:
   - Review deployment logs for errors
   - Analyze error patterns from monitoring
   - Identify specific commit/change that caused failure
   - Document hypotheses for failure

3. **Communication**:
   - Send detailed incident report to stakeholders
   - Update engineering team on findings
   - Create postmortem document template

**Short-term Investigation (2-24 hours)**:
1. **Detailed Analysis**:
   - Reproduce issue in staging environment
   - Review code changes in failed release
   - Test database migration scripts in isolation
   - Analyze performance metrics vs. baseline

2. **Fix Development**:
   - Create hotfix branch from previous stable version
   - Implement fix for root cause
   - Add regression tests to prevent recurrence
   - Document fix in CHANGELOG

3. **Testing**:
   - Run full test suite on hotfix
   - Deploy to staging for validation
   - Conduct targeted UAT on affected features
   - Performance test hotfix version

**Long-term Actions (1-7 days)**:
1. **Postmortem Meeting** (within 48 hours):
   - Review timeline of events
   - Identify root cause(s)
   - Discuss what went well/poorly
   - Document lessons learned
   - Create action items for process improvements

2. **Process Improvements**:
   - Update deployment checklist with new checks
   - Enhance monitoring/alerting for early detection
   - Improve rollback procedures based on experience
   - Add automated safeguards to prevent similar issues

3. **Documentation**:
   - Update runbook with lessons learned
   - Document the incident in knowledge base
   - Share findings with broader engineering team
   - Update training materials

**Postmortem Template** (`docs/postmortems/YYYY-MM-DD-incident.md`):
```markdown
# Incident Postmortem: [Release Version] Rollback

**Date**: YYYY-MM-DD  
**Incident Commander**: [Name]  
**Severity**: P0/P1/P2  
**Duration**: [Time from deployment to rollback complete]  
**Customer Impact**: [Number of affected users, features impacted]  

## Timeline
- **10:00 AM**: Deployment started
- **10:15 AM**: Issue first detected
- **10:20 AM**: Rollback decision made
- **10:35 AM**: Rollback completed

## Root Cause
[Detailed explanation of what caused the failure]

## Impact
- **Users Affected**: [Number]
- **Revenue Impact**: [If applicable]
- **Data Loss**: [If any]
- **Availability**: [% uptime during incident]

## What Went Well
- [List things that worked well during incident response]

## What Went Poorly
- [List areas for improvement]

## Action Items
- [ ] [Action item with owner and due date]
- [ ] [Action item with owner and due date]

## Lessons Learned
[Key takeaways and preventive measures]
```

---

## Post-Release (T+1 to T+7)

### Day T+1: Intensive Monitoring
- [ ] Review overnight error rates and metrics
- [ ] Check database performance trends
- [ ] Analyze Stripe payment success rates
- [ ] Review customer support tickets
- [ ] Triage any new bug reports
- [ ] Update stakeholders on release status

### Day T+2 to T+3: Stabilization
- [ ] Continue performance monitoring
- [ ] Address high-priority bugs (P1/P2)
- [ ] Monitor user adoption of new features
- [ ] Gather customer feedback
- [ ] Review application logs for patterns
- [ ] Optimize database queries if needed

### Day T+3 to T+5: Retrospective
- [ ] Schedule release retrospective meeting
- [ ] Review success metrics vs. targets
- [ ] Document lessons learned
- [ ] Identify process improvements
- [ ] Update runbook with insights
- [ ] Celebrate team success

### Day T+5 to T+7: Wrap-up
- [ ] Finalize all documentation updates
- [ ] Close out release tasks in project board
- [ ] Archive release artifacts
- [ ] Update release calendar for next cycle
- [ ] Knowledge transfer to support team
- [ ] Plan hotfix releases if needed

### Continuous Monitoring Metrics

**Application Health**:
- Error rate trending (target: <1%)
- API response time P95/P99
- Database query performance
- Background job success rate

**Business Metrics**:
- Assessment creation rate
- PDF export success rate
- Stripe payment conversion rate
- User engagement metrics

**Infrastructure**:
- Replit resource utilization
- Neon database connections
- Memory/CPU usage trends
- API rate limit consumption

---

## Environment Owners

### Staging Environment
**Owner**: DevOps Lead  
**Backup**: Senior DevOps Engineer  
**Responsibilities**:
- Maintain staging environment parity with production (>90%)
- Deploy release candidates for testing
- Troubleshoot staging-specific issues
- Coordinate staging access for QA team
- Execute weekly parity verification
- Manage staging Neon database and migrations
- Configure staging Stripe test mode

**Escalation Path**: DevOps Lead → Engineering Manager → VP Engineering

**On-Call**: Weekdays 9 AM - 6 PM ET (no weekend coverage for staging)

### Production Environment
**Owner**: Senior DevOps Engineer  
**Backup**: DevOps Lead  
**Responsibilities**:
- Execute production deployments
- Monitor production health 24/7 (via on-call rotation)
- Respond to production incidents (P0/P1)
- Coordinate rollback procedures
- Manage production Replit deployment
- Ensure uptime SLA >99.5%
- Execute emergency hotfixes

**Escalation Path**: Senior DevOps Engineer → DevOps Lead → Engineering Manager → CTO

**On-Call**: 24/7 rotation (weekly shifts)

### Database (Neon PostgreSQL)
**Owner**: Database Administrator  
**Backup**: Senior Backend Engineer  
**Responsibilities**:
- Manage Neon production and staging databases
- Execute database migrations
- Monitor query performance and optimize slow queries
- Manage database backups and point-in-time recovery
- Handle database scaling and connection pooling
- Coordinate with Neon support for issues
- Ensure data integrity and referential constraints

**Escalation Path**: DBA → Senior Backend Engineer → Engineering Manager

**On-Call**: Weekdays 9 AM - 9 PM ET, weekend on-call for P0 only

### Monitoring & Observability
**Owner**: SRE Lead  
**Backup**: DevOps Lead  
**Responsibilities**:
- Configure and maintain monitoring dashboards
- Set up alerting rules and thresholds
- Manage log aggregation and analysis
- Incident response coordination
- Define and track SLIs/SLOs
- Conduct incident postmortems
- Maintain observability tooling (logs, metrics, traces)

**Escalation Path**: SRE Lead → Engineering Manager → VP Engineering

**On-Call**: 24/7 rotation for P0 alerts

### External Integrations

#### Stripe Payment Processing
**Owner**: Senior Backend Engineer  
**Backup**: Backend Engineer  
**Responsibilities**:
- Maintain Stripe integration code
- Monitor webhook processing
- Handle payment failures and disputes
- Coordinate Stripe API version upgrades
- Manage test/live mode configurations
- Troubleshoot payment flow issues

**Escalation Path**: Senior Backend Engineer → Engineering Lead → CTO

#### Replit Deployment Platform
**Owner**: DevOps Lead  
**Backup**: Senior DevOps Engineer  
**Responsibilities**:
- Manage Replit deployment configuration
- Handle Replit platform issues
- Coordinate with Replit support
- Optimize deployment pipelines
- Manage Replit Secrets and environment variables

**Escalation Path**: DevOps Lead → Engineering Manager → Replit Support

---

## Handoff Checklists

### Pre-Deployment Handoff (Development → Operations)

**Timing**: T-1 day (day before deployment)  
**Participants**: Engineering Lead, DevOps Lead, QA Lead  
**Duration**: 30 minutes  

**Checklist**:
- [ ] **Release Artifacts**:
  - [ ] Release branch tagged and frozen: `release/v{version}`
  - [ ] CHANGELOG.md updated with all changes
  - [ ] Version numbers updated in package.json
  - [ ] Database migration scripts reviewed and tested

- [ ] **Testing Status**:
  - [ ] All E2E tests passing (>95% pass rate)
  - [ ] UAT completed and signed off by Product Owner
  - [ ] Performance tests meet baseline (<200ms P95)
  - [ ] Security scan completed (no critical vulnerabilities)

- [ ] **Documentation**:
  - [ ] Deployment instructions documented
  - [ ] Rollback procedures reviewed
  - [ ] Known issues documented in release notes
  - [ ] API changes documented (if applicable)

- [ ] **Environment Readiness**:
  - [ ] Staging deployment successful
  - [ ] Staging-to-production parity verified (>90%)
  - [ ] Database backup plan confirmed
  - [ ] Environment health checks passing

- [ ] **Risk Assessment**:
  - [ ] Risk register reviewed
  - [ ] Rollback decision criteria understood
  - [ ] Incident response team identified
  - [ ] Communication plan finalized

- [ ] **Infrastructure**:
  - [ ] Replit production environment verified
  - [ ] Neon database capacity checked
  - [ ] Stripe webhook endpoints verified
  - [ ] All secrets/environment variables configured

**Sign-off Required**:
- Engineering Lead: _________________ Date: _______
- DevOps Lead: _________________ Date: _______
- QA Lead: _________________ Date: _______

**Handoff Artifacts**:
- Release notes document
- Deployment runbook (this document)
- Test results summary
- Environment health report

---

### Post-Deployment Handoff (Operations → On-Call)

**Timing**: T+2 hours (after deployment monitoring period)  
**Participants**: DevOps Lead (Deployment Lead), On-Call Engineer, SRE Lead  
**Duration**: 15 minutes  

**Checklist**:
- [ ] **Deployment Status**:
  - [ ] Deployment completed successfully at: _______
  - [ ] All smoke tests passed
  - [ ] No rollback required
  - [ ] Release version deployed: v______

- [ ] **Current System Health**:
  - [ ] Error rate: ____% (target: <1%)
  - [ ] API response time P95: ____ms (target: <200ms)
  - [ ] Database performance: P95 query time ____ms (target: <100ms)
  - [ ] Active users: ____
  - [ ] Stripe payment success rate: ____% (target: >98%)

- [ ] **Known Issues**:
  - [ ] No known issues OR
  - [ ] Known issues documented:
    - Issue 1: _________________ (Severity: ___) (Workaround: _________________)
    - Issue 2: _________________ (Severity: ___) (Workaround: _________________)

- [ ] **Monitoring Setup**:
  - [ ] All alerts configured and tested
  - [ ] Dashboard links shared: _________________
  - [ ] Log aggregation confirmed working
  - [ ] Incident response runbook location: _________________

- [ ] **Action Items for On-Call**:
  - [ ] Monitor error rates for next 4 hours (alert if >1%)
  - [ ] Watch for customer support tickets related to release
  - [ ] Track Stripe payment failures (alert if >2%)
  - [ ] Review logs hourly for warnings
  - [ ] Escalate P0/P1 issues immediately to: _________________

- [ ] **Rollback Information**:
  - [ ] Previous stable version: v______
  - [ ] Rollback procedure location: docs/RELEASE_RUNBOOK.md#rollback-procedures
  - [ ] Database backup ID: _________________ (Timestamp: _______)
  - [ ] Rollback authorization: DevOps Lead or Engineering Manager

- [ ] **Communication**:
  - [ ] Release announcement sent to: #releases, #engineering
  - [ ] Customer-facing release notes published: [Yes/No]
  - [ ] Support team briefed on changes: [Yes/No]
  - [ ] Stakeholders notified: [Yes/No]

**Sign-off Required**:
- Deployment Lead: _________________ Date/Time: _______
- On-Call Engineer: _________________ Date/Time: _______
- SRE Lead: _________________ Date/Time: _______

**Handoff Artifacts**:
- Deployment summary report
- Current metrics snapshot
- Known issues list
- Escalation contact list

**On-Call Contact Information**:
- Primary On-Call: _________________ (Phone: ______________)
- Secondary On-Call: _________________ (Phone: ______________)
- Escalation: DevOps Lead _________________ (Phone: ______________)

---

### Emergency Handoff (Incident Response)

**Timing**: During P0/P1 incidents  
**Participants**: Current Incident Commander, Incoming Incident Commander  
**Duration**: 5 minutes  

**Checklist**:
- [ ] **Incident Status**:
  - [ ] Incident ID: _________________ (Severity: P0/P1/P2)
  - [ ] Started at: _______ (Duration so far: _______)
  - [ ] Current status: Investigating / Mitigating / Resolving
  - [ ] Affected systems: _________________

- [ ] **Actions Taken**:
  - [ ] Summary of actions taken so far: _________________
  - [ ] Rollback initiated: [Yes/No] (If yes, status: _______)
  - [ ] Customer communication sent: [Yes/No]
  - [ ] Stakeholders notified: [Yes/No]

- [ ] **Current Situation**:
  - [ ] Root cause identified: [Yes/No] (If yes: _________________)
  - [ ] Workaround in place: [Yes/No] (If yes: _________________)
  - [ ] Customer impact: ______ users affected
  - [ ] Revenue impact: [None/Low/Medium/High]

- [ ] **Next Steps**:
  - [ ] Immediate actions required: _________________
  - [ ] Timeline for resolution: _________________
  - [ ] Resources needed: _________________

- [ ] **Team Status**:
  - [ ] Current team members: _________________
  - [ ] Subject matter experts engaged: _________________
  - [ ] External support (Neon/Stripe/Replit): _________________

**Sign-off Required**:
- Outgoing IC: _________________ Time: _______
- Incoming IC: _________________ Time: _______

---

## Communication Templates

### 1. Release Start Announcement

**Channel**: Slack #releases, #engineering  
**Timing**: 10:00 AM (deployment start)  

```
🚀 **Release v{version} Deployment Starting**

**Deployment Window**: 10:00 AM - 12:30 PM ET  
**Expected Duration**: 30 minutes deployment + 2 hours monitoring  

**What's New**:
- [Feature 1]: Brief description
- [Feature 2]: Brief description
- [Bug Fixes]: X critical bugs resolved

**Impact**:
- Expected downtime: None (or specify if maintenance mode required)
- Affected features: [List or "None"]

**Team Roles**:
- Deployment Lead: @{name}
- Monitor: @{name}
- Rollback Lead: @{name}

**Status Updates**: Every 15 minutes in this thread

📊 Dashboard: [Link to monitoring dashboard]
📖 Release Notes: [Link to full release notes]

---
Please hold non-urgent deployments and avoid production changes during this window.
```

---

### 2. Release Progress Update

**Channel**: Slack #releases (thread on release start message)  
**Timing**: Every 15 minutes during deployment  

```
⏱️ **Release v{version} - Progress Update** (T+15 min)

**Status**: ✅ On Track / ⚠️ Minor Issue / 🚨 Critical Issue

**Completed**:
- ✅ Code deployed to production
- ✅ Database migrations applied
- ✅ Smoke tests passed
- 🔄 Monitoring error rates (currently 0.3%)

**Next Steps**:
- Continue monitoring for 15 more minutes
- Validate Stripe webhook processing
- Check customer support tickets

**Metrics**:
- Error Rate: 0.3% ✅
- API Response Time P95: 185ms ✅
- Active Users: 145 👥

No issues detected. Continuing monitoring...
```

---

### 3. Release Complete Notification

**Channel**: Slack #releases, #engineering, Email to stakeholders  
**Timing**: 12:30 PM (after 2-hour monitoring)  

**Slack Message**:
```
✅ **Release v{version} - COMPLETE**

**Deployment Status**: Successfully Deployed  
**Completion Time**: 12:30 PM ET  
**Total Duration**: 2 hours 30 minutes  

**Success Metrics**:
- ✅ Error Rate: 0.4% (target: <1%)
- ✅ API Response Time P95: 178ms (target: <200ms)
- ✅ Smoke Tests: All Passed
- ✅ Database Performance: Optimal
- ✅ Stripe Payments: 100% success rate
- ✅ Zero Rollbacks Required

**What's Live**:
- [Feature 1]: Now available to all users
- [Feature 2]: Enabled for Team Business plan users
- [Bug Fixes]: X critical issues resolved

**Monitoring**:
On-call team will continue monitoring for next 24 hours. Any issues will be escalated immediately.

**Customer Communication**:
- Release notes published: [Link]
- Support team briefed: ✅
- Known issues: None

**Next Steps**:
- Retrospective scheduled for {date}
- Post-release metrics review in 48 hours

🎉 Great work team! Thanks @{deployment-lead}, @{monitor}, @{qa-lead}, and everyone involved!

**On-Call**: @{on-call-engineer} (Primary), @{backup-engineer} (Secondary)
```

**Email Template** (for executive stakeholders):
```
Subject: Release v{version} Successfully Deployed

Hi Team,

I'm pleased to report that Release v{version} has been successfully deployed to production.

**Deployment Summary**:
- Deployment Window: 10:00 AM - 12:30 PM ET
- Status: ✅ Success (no rollback required)
- Customer Impact: None (zero downtime)
- Performance: All metrics within target thresholds

**Key Improvements**:
1. [Feature 1 with business value]
2. [Feature 2 with business value]
3. [X critical bug fixes improving user experience]

**Metrics** (2-hour post-deployment):
- Error Rate: 0.4% (target: <1%) ✅
- API Response Time: 178ms P95 (target: <200ms) ✅
- Payment Success Rate: 100% ✅
- User Adoption: [X users already using new features]

**Monitoring Plan**:
Our on-call team will continue intensive monitoring for the next 24 hours. We'll provide a 48-hour metrics review on {date}.

**Customer Communication**:
Release notes have been published and the support team is briefed on all changes.

Thank you to the entire engineering and QA teams for a smooth deployment!

Best regards,
{Engineering Manager}
```

---

### 4. Rollback Announcement

**Channel**: Slack #incidents, #engineering, #releases  
**Timing**: Immediately upon rollback decision  

**Initial Announcement**:
```
🚨 **ROLLBACK IN PROGRESS - Release v{version}**

**Severity**: P0 / P1  
**Rollback Started**: {time}  
**Incident Commander**: @{name}  

**Reason for Rollback**:
[Brief description of the critical issue that triggered rollback]

**Impact**:
- Affected Users: ~{number} users
- Affected Features: [List]
- Data Loss Risk: [None/Low/Medium/High]

**Current Actions**:
- ⏳ Reverting code deployment (ETA: 5 min)
- ⏳ Rolling back database (ETA: 5 min)
- ⏳ Re-enabling previous version

**Team**:
- Rollback Lead: @{name}
- Database Lead: @{name}
- Communications: @{name}

**Status Updates**: Every 5 minutes in this thread

⚠️ **DO NOT MAKE ANY PRODUCTION CHANGES UNTIL ROLLBACK IS COMPLETE**

---
Incident Channel: #incident-{date}-{id}
```

**Progress Updates** (every 5 minutes):
```
⏱️ **Rollback Progress Update** (T+5 min)

**Completed**:
- ✅ Code reverted to v{previous_version}
- 🔄 Database rollback in progress (60% complete)
- ⏳ Running verification tests

**ETA to Completion**: 10 minutes

**Current Status**:
- Error Rate: 3.2% (decreasing)
- Application Status: Maintenance mode enabled
```

**Rollback Complete**:
```
✅ **ROLLBACK COMPLETE - v{previous_version} Restored**

**Completion Time**: {time}  
**Total Rollback Duration**: {minutes} minutes  
**Previous Stable Version**: v{previous_version}  

**Verification**:
- ✅ Application health: Normal
- ✅ Error rate: 0.5% (within normal range)
- ✅ Database: Rolled back successfully
- ✅ Smoke tests: All passing
- ✅ Stripe integration: Operational

**Customer Impact**:
- Affected Users: ~{number} (approx. {duration} downtime)
- Data Loss: [None/Minimal - describe if any]
- Services Restored: All services operational

**Next Steps**:
1. Root cause investigation (owner: @{name})
2. Incident postmortem scheduled for {date/time}
3. Fix development for next release attempt
4. Customer communication (if required): @{comms-lead}

**Monitoring**:
On-call team will monitor for next 4 hours to ensure stability.

**Status**: Incident resolved. Normal operations resumed.

---
Postmortem: Will be published in #engineering within 48 hours
```

**Customer-Facing Communication** (if needed):
```
Subject: Service Restoration - Brief Disruption Resolved

Dear RuR2 Users,

We experienced a brief service disruption today from {start_time} to {end_time} ET (approximately {duration} minutes) during a planned release.

**What Happened**:
We deployed a new version of RuR2 that encountered unexpected technical issues. To ensure service reliability, we immediately rolled back to the previous stable version.

**Impact**:
- Duration: Approximately {duration} minutes
- Affected Features: [List or "All services"]
- Data: No customer data was lost

**Current Status**:
All services are now fully operational and stable. We're closely monitoring the system to ensure continued reliability.

**Next Steps**:
Our engineering team is investigating the root cause. We'll deploy the new features in a future release after implementing additional safeguards.

We apologize for any inconvenience and appreciate your patience.

If you experience any issues, please contact support@rur2.com.

Best regards,
The RuR2 Team
```

---

### 5. Emergency Incident Communication

**Channel**: Slack #incidents  
**Timing**: Immediately upon P0/P1 incident detection  

```
🚨 **P0 INCIDENT - {Brief Description}**

**Incident ID**: INC-{YYYY-MM-DD}-{number}  
**Severity**: P0 (Critical) / P1 (High)  
**Detected At**: {time}  
**Incident Commander**: @{name}  

**Issue**:
[1-2 sentence description of the problem]

**Impact**:
- Affected Users: {number/percentage}
- Affected Services: [List]
- Revenue Impact: [Yes/No - if known]

**Current Status**:
- Error Rate: {percentage}
- Service Availability: {percentage}
- Root Cause: Investigating / Identified

**Immediate Actions**:
- [ ] War room created: [Link to video call]
- [ ] Team assembled: @{team-members}
- [ ] Monitoring: [Dashboard link]
- [ ] Customer communication: Pending / Sent

**Estimated Time to Resolution**: {time or "Unknown - Investigating"}

⚠️ **Join war room if you can help**: [Video call link]

Updates will be posted every 10 minutes in this thread.
```

---

## Document Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-10-01 | 2.0 | DevOps Lead | Enhanced runbook with Phase 2 specifications: Added rollback procedures, environment validation, owners, handoff checklists, smoke tests, communication templates, and success metrics |
| 2025-09-15 | 1.0 | DevOps Lead | Initial release runbook creation |

---

**Review Schedule**: Quarterly review and update after each major release  
**Next Review Date**: 2026-01-01  
**Feedback**: Submit improvement suggestions via #engineering-process channel
