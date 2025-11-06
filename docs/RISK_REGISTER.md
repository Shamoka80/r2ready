# Risk Register

**Document Owner**: Engineering Manager  
**Last Updated**: October 1, 2025  
**Review Frequency**: Monthly (CCB), Quarterly (Full Audit)  
**Status**: Active

---

## Active Risks

| ID | Risk | Probability | Impact | Score | Owner | Mitigation | Review Date |
|----|------|-------------|--------|-------|-------|------------|-------------|
| R001 | Database connection pool exhaustion | Medium | High | 15 | DevOps Lead | Connection pool monitoring + auto-scaling | Weekly |
| R002 | Stripe API rate limiting during high traffic | Low | Critical | 12 | Backend Lead | Request batching + circuit breaker | Monthly |
| R003 | Neon database service outage | Low | Critical | 12 | DevOps Lead | Multi-region failover + read replicas | Monthly |
| R004 | Team member departure during release | Medium | Medium | 9 | Eng Manager | Knowledge documentation + pair programming | Bi-weekly |
| R005 | Security vulnerability in dependency | High | Medium | 12 | Security Lead | Automated scanning + patch SLA | Weekly |
| R006 | PDF generation failures during peak hours | Medium | High | 6 | Backend Lead | Queue-based generation + retry logic + monitoring | Bi-weekly |
| R007 | File upload storage limits exceeded | Medium | Medium | 4 | DevOps Lead | Storage quota monitoring + auto-cleanup of old files + alerting | Monthly |
| R008 | Multi-tenant data leakage via API | Low | Critical | 4 | Security Lead | Row-level security audits + automated testing + query review | Weekly |
| R009 | Excel export performance degradation (>10MB files) | Medium | Medium | 4 | Backend Lead | Streaming exports + background job processing + size limits | Monthly |
| R010 | Authentication token expiration causing session loss | Medium | Medium | 4 | Backend Lead | Token refresh mechanism + session persistence + user warnings | Bi-weekly |
| R011 | Payment webhook delivery failures | Low | High | 3 | Backend Lead | Webhook retry queue + dead letter queue + monitoring dashboard | Monthly |
| R012 | Data migration rollback failures | Low | Critical | 4 | DevOps Lead | Backup verification + rollback testing + migration dry runs | Monthly |
| R013 | Replit platform outage during deployment | Low | High | 3 | DevOps Lead | Deployment window scheduling + status monitoring + rollback plan | Monthly |
| R014 | Assessment data corruption during concurrent edits | Medium | High | 6 | Backend Lead | Optimistic locking + conflict resolution + auto-save versioning | Bi-weekly |

---

## Risk Scoring

**Probability Levels**:
- **Low (1)**: Unlikely to occur (0-25% chance)
- **Medium (2)**: May occur occasionally (25-50% chance)
- **High (3)**: Likely to occur (50-75% chance)

**Impact Levels**:
- **Low (1)**: Minor inconvenience, no business impact
- **Medium (2)**: Moderate impact, workarounds available
- **High (3)**: Significant impact, service degradation
- **Critical (4)**: Severe impact, service outage or data loss

**Score Calculation**: Probability × Impact

**Priority Classification**:
- **Critical (Score >12)**: Immediate attention required, executive escalation
- **High (Score 8-12)**: Active management required, regular reviews
- **Medium (Score 4-7)**: Standard monitoring, planned mitigation
- **Low (Score <4)**: Periodic monitoring, accept or mitigate opportunistically

---

## SLA per Risk Owner

### Critical Risks (Score >12)
- **Monitoring**: Daily dashboard review and metrics tracking
- **Review**: Weekly status updates to CCB
- **Action**: Immediate escalation on threshold breach
- **Owner Commitment**: 24/7 on-call availability
- **Response Time**: <2 hours for mitigation activation

### High Risks (Score 8-12)
- **Monitoring**: Weekly metrics review and trend analysis
- **Review**: Bi-weekly status updates to risk owner
- **Action**: Escalation within 4 hours of incident
- **Owner Commitment**: Business hours availability
- **Response Time**: <4 hours for mitigation activation

### Medium Risks (Score 4-7)
- **Monitoring**: Bi-weekly metrics review
- **Review**: Monthly status updates in team meeting
- **Action**: Escalation within 24 hours of incident
- **Owner Commitment**: Standard response during business hours
- **Response Time**: <1 business day for mitigation activation

### Low Risks (Score <4)
- **Monitoring**: Monthly metrics review
- **Review**: Quarterly assessment during risk audit
- **Action**: Logged and tracked, non-urgent response
- **Owner Commitment**: Standard support channels
- **Response Time**: <3 business days for mitigation planning

---

## Review Cadence

### Daily Reviews
- **Audience**: DevOps Lead, On-Call Engineer
- **Focus**: Critical risk dashboard monitoring (R001, R002, R003)
- **Duration**: 15 minutes
- **Deliverable**: Daily status log entry
- **Escalation**: Immediate alert to Engineering Manager if thresholds breached

### Weekly Reviews
- **Audience**: Risk Owners (all High and Critical risks)
- **Focus**: Status updates, mitigation progress, metric trends
- **Duration**: 30 minutes (async Slack thread)
- **Deliverable**: Risk owner status update in #engineering-risk channel
- **Escalation**: Flag blocking issues to CCB

### Monthly Reviews
- **Audience**: Change Control Board (CCB)
- **Focus**: Full risk register review, new risk identification, mitigation effectiveness
- **Duration**: 60 minutes
- **Deliverable**: Updated risk register, action items assigned
- **Agenda**:
  1. Review all active risks (status changes, score updates)
  2. Assess mitigation effectiveness
  3. Identify new risks from retrospectives/incidents
  4. Approve risk closure requests
  5. Adjust monitoring/review frequencies as needed

### Quarterly Reviews
- **Audience**: Engineering Leadership + Product Owner
- **Focus**: Risk mitigation effectiveness analysis, strategic risk assessment
- **Duration**: 90 minutes
- **Deliverable**: Quarterly risk report, budget requests for mitigation projects
- **Agenda**:
  1. Analyze risk trend data (historical scores, incident correlation)
  2. Evaluate ROI of mitigation investments
  3. Conduct risk landscape horizon scan (new technologies, threats)
  4. Update risk scoring methodology if needed
  5. Plan mitigation roadmap for next quarter

---

## Risk Mitigation Status

### In Progress
- **R001**: Connection pool monitoring dashboard (75% complete, ETA: Oct 15)
- **R008**: Row-level security audit (40% complete, ETA: Oct 22)
- **R014**: Optimistic locking implementation (60% complete, ETA: Oct 18)

### Planned
- **R006**: Queue-based PDF generation (Planned for Sprint 3)
- **R010**: Token refresh mechanism (Planned for Sprint 4)

### Monitoring Only
- **R002, R003, R007, R009, R011, R012, R013**: Active monitoring with documented runbooks

---

## Risk Escalation Path

1. **Risk Owner** → Identifies risk threshold breach or new risk
2. **Engineering Manager** → Assesses impact, convenes emergency CCB if Critical
3. **CCB** → Approves mitigation plan and resource allocation
4. **VP Engineering** → Executive escalation for Critical risks with budget implications
5. **Executive Sponsor** → Board-level escalation for business-continuity threats

**Escalation Timeline**:
- Critical risks: Immediate (within 1 hour)
- High risks: Within 4 hours
- Medium risks: Within 1 business day
- Low risks: Next scheduled review

---

## Risk Closure Criteria

A risk may be closed when:
1. Mitigation is fully implemented and verified
2. Risk probability reduced to negligible (<5%)
3. Impact reduced to Low (1) or lower
4. Risk is no longer applicable due to architectural changes
5. CCB approves risk closure with supporting evidence

**Closure Process**:
1. Risk owner submits closure request with evidence
2. CCB reviews at monthly meeting
3. Independent verification by QA/Security (if applicable)
4. Formal approval and archival to closed risks log
5. Lessons learned documented in knowledge base

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-01 | Engineering Manager | Initial risk register creation with 14 identified risks |

---

## Appendix: Risk Definitions

### R001: Database Connection Pool Exhaustion
**Description**: Connection pool reaches maximum capacity, causing new requests to timeout or fail.  
**Trigger Conditions**: >80% pool utilization for >5 minutes, connection wait times >2 seconds  
**Impact**: API failures, user-facing errors, degraded performance across all services  
**Historical Incidents**: None to date (preventative risk)

### R002: Stripe API Rate Limiting
**Description**: Stripe API rate limits exceeded during high transaction volume periods.  
**Trigger Conditions**: >80 requests/second, approaching Stripe's 100/sec limit  
**Impact**: Payment failures, subscription processing delays, revenue loss  
**Historical Incidents**: Near-miss during beta launch (78 req/sec peak)

### R003: Neon Database Service Outage
**Description**: Neon-managed PostgreSQL service becomes unavailable.  
**Trigger Conditions**: Neon status page reports outage, database connection failures  
**Impact**: Complete application outage, no data access, no new signups  
**Historical Incidents**: Neon had 99.95% uptime in 2024 (acceptable risk)

### R004: Team Member Departure During Release
**Description**: Key engineer or product owner leaves during critical release window.  
**Trigger Conditions**: Resignation notice received <30 days before release  
**Impact**: Knowledge loss, velocity reduction, potential release delay  
**Historical Incidents**: None to date (preventative risk)

### R005: Security Vulnerability in Dependency
**Description**: Critical/high severity CVE discovered in npm dependency.  
**Trigger Conditions**: npm audit reports high/critical vulnerability, Dependabot alert  
**Impact**: Security breach risk, compliance violation, emergency patching required  
**Historical Incidents**: 2 medium-severity vulnerabilities patched in Q3 2025

### R006: PDF Generation Failures During Peak Hours
**Description**: PDF report generation service overloaded, causing timeouts or corrupted files.  
**Trigger Conditions**: >50 concurrent PDF generation requests, >30s generation time  
**Impact**: Users unable to download reports, compliance reporting delays  
**Historical Incidents**: None to date (identified during load testing)

### R007: File Upload Storage Limits Exceeded
**Description**: Evidence file storage quota exhausted, preventing new uploads.  
**Trigger Conditions**: >80% storage quota used, no auto-cleanup configured  
**Impact**: Users cannot attach evidence files, assessment completion blocked  
**Historical Incidents**: None to date (preventative risk)

### R008: Multi-Tenant Data Leakage via API
**Description**: API query allows one organization to access another organization's data.  
**Trigger Conditions**: Missing organizationId filter in query, authorization bypass  
**Impact**: Data breach, GDPR violation, customer trust loss, legal liability  
**Historical Incidents**: None to date (caught in security audit)

### R009: Excel Export Performance Degradation
**Description**: Large dataset Excel exports (>10MB) cause server memory issues or timeouts.  
**Trigger Conditions**: Export file size >10MB, >100k rows, >30s export time  
**Impact**: Export failures, user frustration, server resource exhaustion  
**Historical Incidents**: None to date (identified during scalability testing)

### R010: Authentication Token Expiration
**Description**: JWT tokens expire during active user sessions, causing unexpected logouts.  
**Trigger Conditions**: Token expiry <5 minutes, no refresh mechanism  
**Impact**: User session loss, unsaved work lost, poor user experience  
**Historical Incidents**: 3 user complaints in September 2025

### R011: Payment Webhook Delivery Failures
**Description**: Stripe webhook events fail to deliver or process, causing payment state mismatch.  
**Trigger Conditions**: Webhook endpoint downtime, event processing errors  
**Impact**: Subscriptions not activated, payment status incorrect, revenue tracking issues  
**Historical Incidents**: None to date (preventative risk)

### R012: Data Migration Rollback Failures
**Description**: Database migration cannot be rolled back, leaving database in inconsistent state.  
**Trigger Conditions**: Missing down() migration, breaking schema changes  
**Impact**: Application downtime, data corruption, manual recovery required  
**Historical Incidents**: None to date (prevented by migration review process)

### R013: Replit Platform Outage During Deployment
**Description**: Replit infrastructure outage occurs during critical deployment window.  
**Trigger Conditions**: Replit status page reports outage, deployment failures  
**Impact**: Deployment blocked, rollback may be required, release delay  
**Historical Incidents**: Replit had 99.9% uptime in 2024 (acceptable risk)

### R014: Assessment Data Corruption During Concurrent Edits
**Description**: Multiple users editing same assessment causes data conflicts or overwrites.  
**Trigger Conditions**: >2 concurrent editors, no conflict resolution, rapid saves  
**Impact**: User data loss, assessment integrity compromised, customer complaints  
**Historical Incidents**: 1 reported incident in September 2025 (triggered this risk item)
