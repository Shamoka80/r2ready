# Code Review Guidelines

**Last Updated**: October 1, 2025  
**Owner**: Tech Lead  
**Status**: Active

---

## Overview

Code reviews are essential for maintaining code quality, sharing knowledge, and catching issues early. This document provides guidelines for both reviewers and authors to ensure effective, constructive reviews.

---

## Goals of Code Review

1. **Catch Bugs**: Identify logic errors, edge cases, and potential runtime issues
2. **Ensure Quality**: Maintain code standards, readability, and maintainability
3. **Share Knowledge**: Educate team members on codebase patterns and best practices
4. **Improve Design**: Validate architectural decisions and suggest improvements
5. **Security**: Identify security vulnerabilities before they reach production
6. **Consistency**: Enforce coding standards and project conventions

---

## Review Response Time SLA

| Priority | Response Time | Review Time |
|----------|--------------|-------------|
| **P0 - Hotfix** | 15 minutes | 30 minutes |
| **P1 - Blocking** | 2 hours | 4 hours |
| **P2 - Normal** | 4 hours | 1 business day |
| **P3 - Low Priority** | 1 business day | 2 business days |

**Core Hours**: 10 AM - 3 PM ET (all team members available)

---

## For Authors: Preparing a PR

### Before Requesting Review

1. **Self-Review First**
   - Read through your own changes as if you were the reviewer
   - Check for obvious issues, typos, debug code
   - Ensure all tests pass locally
   - Run linters and formatters

2. **Keep PRs Small**
   - Target: < 400 lines of code changed
   - Split large features into smaller, logical PRs
   - Each PR should have a single, clear purpose

3. **Write a Clear Description**
   - Explain WHAT changed and WHY
   - Link related issues/tickets
   - Include screenshots/recordings for UI changes
   - Highlight areas needing special attention

4. **Ensure Tests Pass**
   ```bash
   npm run quality-check  # lint + typecheck + format
   npm run test           # unit and integration tests
   npm run test:e2e       # e2e tests (if applicable)
   ```

5. **Add Context**
   - Add inline comments for complex logic
   - Document non-obvious decisions
   - Explain workarounds or technical debt

### PR Title Format

Follow conventional commit format:
```
<type>(<scope>): <description>

Examples:
feat(auth): add 2FA authentication support
fix(pdf): resolve template rendering issue
docs(api): update endpoint documentation
refactor(db): optimize query performance
```

### Requesting Reviews

1. **Tag Appropriate Reviewers**
   - Required: At least 1 senior developer or tech lead
   - Optional: Domain experts for specialized code
   - Avoid: Requesting reviews from entire team

2. **Provide Testing Instructions**
   ```markdown
   ## How to Test
   1. Check out this branch: `git checkout feature/my-feature`
   2. Run `npm install` to update dependencies
   3. Start dev server: `npm run dev`
   4. Navigate to http://localhost:5000/new-feature
   5. Test the new form submission
   ```

3. **Mark as Draft if WIP**
   - Use draft PRs for early feedback
   - Convert to ready when complete
   - Clearly indicate what's still pending

---

## For Reviewers: Conducting a Review

### Review Checklist

#### 1. Purpose & Scope
- [ ] PR description clearly explains the change
- [ ] Changes align with stated purpose
- [ ] Scope is appropriate (not too large)
- [ ] Related issues properly linked

#### 2. Code Quality

**Readability**
- [ ] Code is self-documenting with clear names
- [ ] Complex logic has explanatory comments
- [ ] Consistent formatting and style
- [ ] No unnecessarily clever or obscure code

**Maintainability**
- [ ] Functions are single-purpose and focused
- [ ] Code follows DRY principle (Don't Repeat Yourself)
- [ ] Proper separation of concerns
- [ ] Technical debt is documented

**Error Handling**
- [ ] Edge cases considered
- [ ] Proper error handling implemented
- [ ] User-friendly error messages
- [ ] Errors logged appropriately

#### 3. Functionality

- [ ] Logic appears correct
- [ ] Implementation matches requirements
- [ ] Edge cases handled
- [ ] No obvious bugs
- [ ] Performance considerations addressed

#### 4. Testing

- [ ] Adequate test coverage
- [ ] Tests are meaningful (not just for coverage)
- [ ] Tests cover happy path and error cases
- [ ] Tests are maintainable
- [ ] Manual testing instructions provided

#### 5. Security

- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented
- [ ] SQL injection prevented (using Drizzle ORM)
- [ ] XSS vulnerabilities addressed
- [ ] Authentication/authorization proper
- [ ] Sensitive data encrypted
- [ ] No logging of sensitive information

**Stripe-Specific Security**:
- [ ] Only test API keys used in development/staging
- [ ] No live Stripe keys in code or logs
- [ ] Webhook signatures validated
- [ ] PCI compliance maintained (no card data stored)
- [ ] Proper error handling for payment failures
- [ ] Idempotency keys used for payment operations

#### 6. Performance

- [ ] No unnecessary database queries
- [ ] Queries optimized with indexes
- [ ] No N+1 query problems
- [ ] Large operations paginated
- [ ] Caching used appropriately
- [ ] Bundle size impact considered (frontend)

#### 7. Database Changes

- [ ] Schema changes documented
- [ ] Migrations are idempotent
- [ ] No data loss on migration
- [ ] Indexes added for query optimization
- [ ] Foreign keys properly defined

#### 8. API Changes

- [ ] Backwards compatibility maintained
- [ ] Breaking changes documented
- [ ] API versioning considered
- [ ] Request/response validation with Zod
- [ ] Proper HTTP status codes used

#### 9. Frontend Specifics

- [ ] Responsive design tested
- [ ] Loading states implemented
- [ ] Error states handled
- [ ] Accessibility considerations (ARIA labels, keyboard nav)
- [ ] No console errors or warnings
- [ ] Proper use of React hooks

#### 10. Documentation

- [ ] README updated if needed
- [ ] API docs updated if needed
- [ ] Inline code comments for complex logic
- [ ] Breaking changes documented

---

## Review Feedback Guidelines

### Levels of Feedback

#### 🔴 **Critical** - Must Fix Before Merge
- Security vulnerabilities
- Data corruption risks
- Breaking changes without migration path
- Major bugs

Example:
```
🔴 Critical: This SQL query is vulnerable to injection.
Use Drizzle's parameterized queries instead.
```

#### 🟡 **Important** - Should Fix Before Merge
- Logic errors
- Performance issues
- Missing test coverage
- Code quality concerns

Example:
```
🟡 Important: This N+1 query will cause performance issues.
Consider using `.include()` to eager load relationships.
```

#### 🔵 **Suggestion** - Nice to Have
- Code organization improvements
- Alternative approaches
- Optimization opportunities
- Best practices

Example:
```
🔵 Suggestion: Consider extracting this validation logic
into a reusable utility function.
```

#### 💡 **Nitpick** - Optional Polish
- Naming improvements
- Formatting preferences
- Minor readability tweaks

Example:
```
💡 Nitpick: Consider renaming `data` to `assessmentData`
for clarity. Not blocking.
```

#### ❓ **Question** - Need Clarification
- Understanding implementation decisions
- Clarifying requirements
- Exploring alternatives

Example:
```
❓ Question: Why did we choose this approach over using
the existing utility function?
```

### Feedback Best Practices

#### DO
✅ **Be Specific**
```
❌ Bad: "This function is too complex"
✅ Good: "This function has 5 levels of nesting and handles 3 different concerns. 
         Consider splitting into: validateInput(), processData(), and saveResult()"
```

✅ **Suggest Solutions**
```
❌ Bad: "This won't work"
✅ Good: "This will fail for null values. Consider adding:
         if (!user) { throw new Error('User not found'); }"
```

✅ **Reference Code**
```
✅ Good: "Line 45: This query will be slow for large datasets.
         See server/utils/queryOptimization.ts for pagination pattern."
```

✅ **Acknowledge Good Work**
```
✅ Good: "Nice use of React.memo here to prevent unnecessary re-renders!"
✅ Good: "This error handling is excellent - clear messages and proper logging."
```

✅ **Ask Questions**
```
✅ Good: "I'm not familiar with this pattern - can you help me understand
         why we're using useMemo here instead of useState?"
```

#### DON'T
❌ **Be Vague**
```
❌ "I don't like this"
❌ "This needs improvement"
❌ "Why did you do it this way?"
```

❌ **Be Condescending**
```
❌ "Obviously this is wrong"
❌ "Everyone knows you shouldn't do this"
❌ "Did you even test this?"
```

❌ **Nitpick Everything**
```
❌ Commenting on every minor formatting issue
❌ Suggesting rewrites for working, acceptable code
❌ Imposing personal style preferences
```

❌ **Block on Non-Issues**
```
❌ Requesting changes for matters of personal preference
❌ Demanding perfection over progress
❌ Rejecting working solutions without cause
```

---

## Review Decision Guidelines

### ✅ **Approve**
- No critical or important issues remain
- Minor suggestions can be addressed in follow-up
- Code meets quality standards
- Tests pass and coverage adequate
- Documentation sufficient

### 💬 **Comment** (No Approval/Rejection)
- Sharing knowledge or context
- Asking questions
- Making suggestions for future improvements
- Not the designated reviewer but providing input

### 🔄 **Request Changes**
- Critical or important issues must be resolved
- Security vulnerabilities present
- Tests insufficient or failing
- Breaking changes without proper migration
- Major bugs or logic errors

---

## Common Review Scenarios

### Scenario 1: Large PR

**Reviewer**:
```
This PR has 1,200 lines changed across 25 files. 
Could we split this into smaller PRs? Suggested breakdown:

1. Database schema changes + migrations
2. API endpoint implementation
3. Frontend UI components
4. Integration tests

This will make review more effective and reduce risk.
```

### Scenario 2: Missing Tests

**Reviewer**:
```
🟡 Important: No tests found for the new authentication logic.
Please add:
- Unit tests for token validation (server/auth/__tests__/jwt.test.ts)
- Integration tests for login flow (tests/integration/auth.test.ts)
- E2E test for complete user journey (tests/e2e/auth.spec.ts)
```

### Scenario 3: Security Concern

**Reviewer**:
```
🔴 Critical: User input is not validated before database query.

Current code:
  const email = req.body.email;
  const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`);

Fix:
  import { z } from 'zod';
  const emailSchema = z.string().email();
  const email = emailSchema.parse(req.body.email);
  const user = await db.select().from(users).where(eq(users.email, email));
```

### Scenario 4: Performance Issue

**Reviewer**:
```
🟡 Important: This will cause N+1 query problem.

Problem: Loading 100 assessments, then querying sections for each (100 queries)
Solution: Use Drizzle's eager loading:

const assessments = await db.query.assessments.findMany({
  with: {
    sections: true,
    evidences: true
  }
});
```

### Scenario 5: Unclear Code

**Reviewer**:
```
❓ Question: Can you help me understand what this function does?

The logic is complex and variable names like `data`, `temp`, and `result`
don't provide much context. Consider:
- Adding a doc comment explaining the purpose
- Renaming variables descriptively
- Breaking into smaller functions
```

---

## For Both: Handling Disagreements

### When to Escalate

1. **Technical Disagreement**: Consult tech lead or architect
2. **Design Philosophy**: Discuss in team meeting
3. **Scope Creep**: Involve product owner
4. **Timeline Conflict**: Escalate to engineering manager

### Resolution Process

1. **Discuss**: Author and reviewer discuss directly (Slack/video call)
2. **Document**: Record decision and rationale in PR comments
3. **Consult**: Bring in third party (tech lead) if no consensus
4. **Decide**: Tech lead makes final call
5. **Move Forward**: Implement decision without resentment

---

## Metrics & Goals

### Target Metrics
- **Review Turnaround**: <4 hours for 90% of PRs
- **PR Size**: <400 lines for 80% of PRs
- **Review Cycles**: <3 rounds for 90% of PRs
- **Approval Time**: <24 hours for 95% of PRs

### Red Flags
- PRs sitting unreviewed >24 hours
- >5 review cycles on single PR
- Multiple PRs blocked on single reviewer
- Consistent late-night PR activity (burnout indicator)

---

## Tools & Automation

### Automated Checks
- ✅ ESLint (code quality)
- ✅ Prettier (formatting)
- ✅ TypeScript (type safety)
- ✅ Unit tests (functionality)
- ✅ E2E tests (integration)
- ✅ Security audit (vulnerabilities)

### Code Review Tools
- GitHub PR interface
- GitHub CLI for quick reviews
- Browser extensions (Octotree, Refined GitHub)

---

## Review Checklist Template

Save this as a comment template for consistent reviews:

```markdown
## Review Checklist

### Code Quality
- [ ] Readable and maintainable
- [ ] Follows project conventions
- [ ] Proper error handling
- [ ] No code duplication

### Functionality
- [ ] Logic is correct
- [ ] Edge cases handled
- [ ] Performance acceptable

### Testing
- [ ] Tests added/updated
- [ ] Coverage adequate
- [ ] Tests are meaningful

### Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] No security vulnerabilities

### Documentation
- [ ] Code is self-documenting
- [ ] Complex logic explained
- [ ] API docs updated (if needed)

### Verdict
- [x] ✅ Approved
- [ ] 💬 Comments (non-blocking)
- [ ] 🔄 Request Changes

## Comments
[Add specific feedback here]
```

---

## Related Documentation

- [Branching Strategy](BRANCHING_STRATEGY.md)
- [Pull Request Template](../.github/pull_request_template.md)
- [Testing Guide](TESTING_GUIDE.md)
- [Definition of Done](DEFINITION_OF_DONE.md)

---

**Revision History**
- v1.0.0 (2025-10-01): Initial code review guidelines
