# Pull Request

## Description
<!-- Provide a clear and concise description of your changes -->



## Type of Change
<!-- Check all that apply -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style update (formatting, renaming)
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update
- [ ] 🔧 Build configuration change
- [ ] 🔒 Security fix

## Related Issues
<!-- Link related issues using keywords: Fixes #123, Closes #456, Relates to #789 -->

Fixes #

## Changes Made
<!-- List the specific changes made in this PR -->

- 
- 
- 

## Screenshots / Recordings
<!-- If applicable, add screenshots or screen recordings to demonstrate the changes -->

| Before | After |
|--------|-------|
| | |

## Testing
<!-- Describe how you tested your changes -->

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

### Test Environment
- **Environment**: Development / Staging
- **Database**: PostgreSQL (Neon)
- **Browser(s)**: <!-- If applicable -->

### Testing Steps
<!-- Provide step-by-step instructions for reviewers to test -->

1. 
2. 
3. 

## Checklist

### Code Quality
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] No unnecessary console.logs or debug code
- [ ] No hardcoded values (use environment variables)
- [ ] Error handling implemented where appropriate

### Documentation
- [ ] Code is self-documenting with clear variable/function names
- [ ] Documentation updated (if needed)
- [ ] API documentation updated (if endpoints changed)
- [ ] README updated (if setup process changed)

### Testing & Validation
- [ ] All new and existing tests pass locally
- [ ] TypeScript compilation succeeds with no errors
- [ ] ESLint passes with no warnings
- [ ] No security vulnerabilities introduced (npm audit)
- [ ] Browser console is free of errors
- [ ] Tested on multiple screen sizes (if UI changes)

### Database Changes
<!-- If this PR includes database changes -->
- [ ] Database schema changes documented
- [ ] Migration script tested (up and down)
- [ ] No data loss on migration
- [ ] Database indexes reviewed for performance

### Security
- [ ] No secrets or API keys committed
- [ ] Input validation implemented
- [ ] Authentication/authorization checked
- [ ] SQL injection prevention verified (using Drizzle ORM)
- [ ] XSS prevention verified

#### Stripe Integration (if applicable)
- [ ] Only test keys used (never live keys in code)
- [ ] Webhook signature validation implemented
- [ ] No card data stored (PCI compliance)
- [ ] Idempotency keys used for charges/payments
- [ ] Proper error handling for payment failures

### Performance
- [ ] No performance degradation introduced
- [ ] Large queries optimized
- [ ] Bundle size impact considered (frontend)
- [ ] Loading states implemented for async operations

### Accessibility
<!-- If UI changes -->
- [ ] Semantic HTML used
- [ ] ARIA labels added where needed
- [ ] Keyboard navigation works
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader tested (if significant UI changes)

## Breaking Changes
<!-- If this is a breaking change, describe the impact and migration path -->



## Deployment Notes
<!-- Any special deployment instructions or considerations -->



## Additional Context
<!-- Add any other context about the PR here -->



## Reviewer Notes
<!-- Specific areas you'd like reviewers to focus on -->



---

## For Reviewers

### Review Checklist
- [ ] Code changes reviewed and understood
- [ ] Logic and implementation approach sound
- [ ] Edge cases considered
- [ ] Error handling adequate
- [ ] Tests provide sufficient coverage
- [ ] Security implications considered
- [ ] Performance impact acceptable
- [ ] Documentation clear and accurate
- [ ] Follows project conventions and patterns

### Review Guidelines
- Be constructive and specific in feedback
- Approve if changes are acceptable (minor suggestions can be addressed in follow-up)
- Request changes if critical issues need resolution before merge
- Comment if you need clarification or have suggestions

---

**Merge Strategy**: Squash and merge (default) | Rebase and merge | Create merge commit
