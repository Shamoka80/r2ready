# R2v3 Control Plane

## Feature Flags

| Flag | Default | Purpose | Scope |
|------|---------|---------|-------|
| `onboarding_v2` | OFF | New role-based onboarding wizard | Per-tenant |
| `license_perpetual` | OFF | One-time purchase licensing model | Global |
| `multi_facility` | OFF | Multiple facility management | Per-user |
| `exports_v2` | OFF | Versioned export templates with validation | Per-tenant |
| `evidence_pipeline` | OFF | Hardened evidence upload with AV scanning | Global |
| `security_hardening` | OFF | 2FA enforcement and session management | Per-tenant |

## State Machine

```
Initial → Setup_Required → Setup_Complete → Active
  ↓           ↓              ↓            ↓
Disabled ← Rollback ← Validation_Failed ← Error
```

**States:**
- `Initial`: Fresh tenant, no onboarding
- `Setup_Required`: Onboarding wizard must be completed
- `Setup_Complete`: All required setup finished
- `Active`: Normal operation mode
- `Validation_Failed`: Setup validation errors
- `Error`: System errors requiring attention
- `Rollback`: Feature rollback in progress
- `Disabled`: Feature disabled for tenant

## SLOs (Service Level Objectives)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Onboarding Success Rate | >95% | Wizard completion without errors |
| Export Generation | <30s p95 | PDF/Excel generation latency |
| Evidence Upload | <60s p95 | File upload + AV scan completion |
| Authentication Availability | >99.9% | Login success rate |
| Database Query Performance | <200ms p95 | Query execution time |
| Migration Rollback Time | <5min | Down→Up migration cycle |

## Rollout Strategy

### Phase 0: Infrastructure (Current)
- ✅ Control Plane documentation
- 🔄 Reversible migrations
- 🔄 CI gates and testing
- 🔄 Feature flag system

### Phase 1: Onboarding V2
- Enable `onboarding_v2` for internal tenants
- Monitor wizard completion rates
- Validate role-based flows (business/consultant)

### Phase 2: Multi-Facility RBAC
- Enable `multi_facility` for beta users
- Test facility-scoped data isolation
- Validate permission enforcement

### Phase 3: License Model
- Enable `license_perpetual` globally
- Migrate existing subscriptions
- Remove credits system artifacts

### Phase 4: Exports & Evidence
- Enable `exports_v2` with template validation
- Enable `evidence_pipeline` with AV scanning
- Monitor upload success rates

### Phase 5: Security Hardening
- Enable `security_hardening` for consultants
- Enforce 2FA enrollment
- Monitor session management

## Backout Procedures

### Immediate Rollback (Flag Toggle)
```bash
# Disable feature flag
curl -X POST /api/admin/flags -d '{"flag":"feature_name","value":false}'

# Monitor error rates for 5 minutes
# If stable, investigate and fix
# If unstable, proceed to migration rollback
```

### Migration Rollback
```bash
# 1. Stop all workflows
npm run db:rollback

# 2. Verify data integrity
npm run db:validate

# 3. Restart with previous schema
npm run db:migrate
```

### Full System Rollback
```bash
# 1. Revert to last known good state
git checkout <last-stable-commit>

# 2. Rollback database
npm run db:rollback --target=<stable-migration>

# 3. Clear caches and restart
npm run cache:clear && npm run dev
```

## Test Fixtures

### Demo Tenants
- **Business Tenant**: `demo-business-corp`
  - 3 facilities: HQ, Warehouse, Remote
  - Complete assessment data
  - Export history
- **Consultant Tenant**: `demo-consultant-llc`
  - 2 client organizations
  - Multi-facility access
  - Evidence samples

### Seed Data Requirements
- User accounts for each role type
- Facilities with assessments
- License and subscription data
- Evidence objects with checksums

## CI Gates

### Pre-commit Hooks
- [x] TypeScript type checking
- [x] ESLint validation
- [x] Prettier formatting
- [ ] Unit test execution (placeholder implemented)

### CI Pipeline Gates
- [x] Build verification (client + server)
- [ ] Unit test suite (>90% coverage) - placeholder implemented
- [ ] Integration tests - placeholder implemented
- [x] E2E smoke tests setup
- [x] Migration idempotency testing
- [ ] Export contract validation
- [ ] Security scanning

### Deployment Gates
- [x] Database migration validation
- [ ] Feature flag verification (in progress)
- [ ] Health check endpoints
- [ ] Performance regression testing

### Quality Thresholds
- TypeScript: 0 errors
- Tests: >90% coverage, 0 failures
- Performance: <5% regression
- Security: 0 high/critical vulnerabilities

## Monitoring & Alerts

### Error Budget Tracking
- Weekly error budget reports
- SLO breach notifications
- Performance regression alerts

### Key Metrics Dashboards
- Onboarding funnel conversion
- Export generation latency
- Authentication success rates
- Database performance metrics

### Alert Escalation
1. Automated issue creation
2. Team notification (Slack/Email)
3. Rollback consideration (>5% error rate)
4. Incident response activation

---

**Last Updated**: 2025-09-28  
**Next Review**: Weekly during active development  
**Owner**: Platform Team