# Impact Assessment Template

## Scope Impact Analysis
**Current Sprint Scope**: [List committed features/stories]

**Proposed Change Scope**: [What would be added/modified]

**Scope Increase**: [Estimated story points or hours added]

**Dependencies Affected**: 
- [ ] Frontend components
- [ ] Backend API endpoints
- [ ] Database schema
- [ ] Third-party integrations (Stripe, Neon, etc.)
- [ ] Authentication/authorization
- [ ] Reporting/export functionality

**Features at Risk**: [Which committed features might be delayed?]

---

## Timeline Impact

**Original Release Date**: [Date]

**Estimated Delay**: [Days/weeks]

**Critical Path Impact**: [Yes/No - explain if yes]

**Milestone Risks**:
- Feature Freeze: [Impact assessment]
- Code Freeze: [Impact assessment]
- UAT Window: [Impact assessment]
- Go-Live Date: [Impact assessment]

**Recovery Options**:
- [ ] Scope reduction elsewhere
- [ ] Additional resources
- [ ] Overtime/weekend work
- [ ] Defer to next release

---

## Resource Impact

**Team Members Required**: [List roles and estimated hours]
- Engineering Lead: [X hours]
- Backend Developer: [X hours]
- Frontend Developer: [X hours]
- QA Engineer: [X hours]
- DevOps Engineer: [X hours]

**Current Allocation**: [Are these team members available?]

**Skill Gaps**: [Any specialized skills needed that team lacks?]

**External Dependencies**: [Vendor support, third-party documentation, etc.]

**Budget Impact**: 
- Development: $[amount]
- Infrastructure: $[amount]
- Third-party services: $[amount]
- Total: $[amount]

---

## Risk Assessment

**Risk Level**: ☐ Low  ☐ Medium  ☐ High  ☐ Critical

**Technical Risks**:
- [ ] Breaking changes to existing APIs
- [ ] Database migration complexity
- [ ] Stripe integration modifications
- [ ] Neon database performance impact
- [ ] Replit deployment configuration changes
- [ ] Browser compatibility issues
- [ ] Mobile responsiveness concerns

**Business Risks**:
- [ ] Customer-facing changes requiring communication
- [ ] Regulatory/compliance implications
- [ ] Data migration requirements
- [ ] Training/documentation needs
- [ ] Support team readiness

**Mitigation Strategies**: [How will we address each risk?]

**Rollback Complexity**: ☐ Simple  ☐ Moderate  ☐ Complex

**Blast Radius**: [What fails if this change breaks?]

---

## Technical Debt Analysis

**Debt Introduced**: [New shortcuts, workarounds, or temporary solutions]

**Debt Paid Down**: [Refactoring, improvements, or fixes included]

**Net Debt Impact**: ☐ Positive (reduces debt)  ☐ Neutral  ☐ Negative (adds debt)

**Long-term Maintenance**: [Ongoing costs/complexity added]

**Code Quality Impact**:
- Test Coverage: [Expected change in %]
- Code Complexity: [Cyclomatic complexity impact]
- Documentation: [What needs to be updated/created]

**Future Flexibility**: [Does this change lock us into specific patterns?]

---

## Integration Impact

**Affected Integrations**:
- [ ] Stripe Payment Processing
- [ ] Neon PostgreSQL Database
- [ ] Replit Deployment Platform
- [ ] Cloud Storage (Azure/Google/Dropbox)
- [ ] Email/Notification Services
- [ ] Authentication System
- [ ] PDF Generation
- [ ] Excel Export

**API Version Dependencies**: [Any version-specific requirements?]

**Data Consistency**: [Impact on existing data, migration needs]

**Performance Implications**: [Load testing required? Expected impact on response times]

---

## Recommendation

**Assessor Name**: [Name]
**Assessment Date**: [Date]

**Recommendation**: ☐ Approve  ☐ Approve with Conditions  ☐ Reject  ☐ Defer

**Rationale**: [Why this recommendation?]

**Conditions (if applicable)**: [What must be true for approval?]

**Alternative Approach**: [If rejected/deferred, what's the recommended alternative?]
