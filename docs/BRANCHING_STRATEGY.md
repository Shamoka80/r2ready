# Branching Strategy

**Last Updated**: October 1, 2025  
**Owner**: DevOps Lead  
**Status**: Active

---

## Overview

RUR2 uses a modified **GitFlow** branching model optimized for the Replit platform. This strategy balances team collaboration, code quality, and deployment safety.

## Branch Types

### Permanent Branches

#### `main`
- **Purpose**: Production-ready code
- **Protection**: Highest level
- **Deployment**: Pushing tags triggers `publish.yml` which builds and publishes release artifacts (no automatic environment deployment configured)
- **Requirements**: 
  - 2 approving reviews required
  - All CI checks must pass
  - No force pushes allowed
  - Linear history required

#### `develop`
- **Purpose**: Integration branch for next release
- **Protection**: High level
- **Deployment**: No automatic deployment (artifacts can be manually deployed to staging)
- **Requirements**:
  - 1 approving review required
  - All CI checks must pass
  - No force pushes allowed

### Temporary Branches

#### `feature/*`
- **Purpose**: New feature development
- **Created from**: `develop`
- **Merged to**: `develop` via Pull Request
- **Naming**: `feature/short-description` (e.g., `feature/add-2fa-auth`)
- **Lifetime**: Deleted after merge
- **Examples**:
  - `feature/evidence-upload`
  - `feature/pdf-export-improvements`
  - `feature/stripe-integration`

#### `release/*`
- **Purpose**: Release preparation and stabilization
- **Created from**: `develop`
- **Merged to**: `main` and back to `develop`
- **Naming**: `release/v{MAJOR}.{MINOR}.{PATCH}` (e.g., `release/v2.0.0`)
- **Lifetime**: Deleted after merge to main
- **Allowed changes**: Bug fixes, documentation, version bumps only

#### `hotfix/*`
- **Purpose**: Emergency production fixes
- **Created from**: `main`
- **Merged to**: `main` and `develop`
- **Naming**: `hotfix/issue-description` (e.g., `hotfix/auth-token-expiry`)
- **Lifetime**: Deleted after merge
- **Priority**: Highest - bypasses normal code freeze

#### `bugfix/*`
- **Purpose**: Non-critical bug fixes
- **Created from**: `develop`
- **Merged to**: `develop` via Pull Request
- **Naming**: `bugfix/issue-description` (e.g., `bugfix/form-validation`)
- **Lifetime**: Deleted after merge

---

## Development Workflow

### Standard Feature Development

```bash
# 1. Start from latest develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Develop and commit
git add .
git commit -m "feat: add my feature"

# 4. Push to remote
git push origin feature/my-feature

# 5. Create Pull Request to develop
# - Fill out PR template
# - Request reviews
# - Address feedback
# - Ensure CI passes

# 6. Merge via GitHub (squash & merge recommended)
# 7. Delete feature branch
git branch -d feature/my-feature
```

### Release Process

```bash
# 1. Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/v2.0.0

# 2. Update version numbers
# - package.json
# - server/package.json
# - client/package.json

# 3. Generate CHANGELOG
# Document all changes since last release

# 4. Commit version bump
git add .
git commit -m "chore: bump version to 2.0.0"
git push origin release/v2.0.0

# 5. Deploy to staging and run full test suite
# - UAT testing
# - Performance testing
# - Security scanning

# 6. Fix bugs if needed (commit to release branch)
git commit -m "fix: resolve bug found during testing"

# 7. Create PR to main (requires 2 approvals)
# Once approved and merged:

# 8. Tag the release
git checkout main
git pull origin main
git tag -a v2.0.0 -m "Release version 2.0.0"
git push origin v2.0.0

# 9. Merge release changes back to develop
git checkout develop
git merge release/v2.0.0
git push origin develop

# 10. Delete release branch
git branch -d release/v2.0.0
```

### Hotfix Process

```bash
# 1. Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# 2. Fix the issue
git add .
git commit -m "fix: resolve critical security vulnerability"

# 3. Test thoroughly
npm run test
npm run test:e2e

# 4. Update version (patch increment)
# package.json: 2.0.0 -> 2.0.1

# 5. Push and create PR to main
git push origin hotfix/critical-security-fix

# 6. After merge, tag the hotfix
git checkout main
git pull origin main
git tag -a v2.0.1 -m "Hotfix 2.0.1 - critical security fix"
git push origin v2.0.1

# 7. Merge hotfix to develop
git checkout develop
git merge hotfix/critical-security-fix
git push origin develop

# 8. Delete hotfix branch
git branch -d hotfix/critical-security-fix
```

---

## Branch Protection Rules

### Main Branch Protection
```yaml
Protections:
  - Require pull request reviews: 2 approvals
  - Dismiss stale reviews: true
  - Require review from Code Owners: true
  - Require status checks: true
  - Required checks (exact GitHub job IDs):
    - "lint"
    - "typecheck"
    - "build-verification"
    - "unit-tests"
    - "integration-tests"
    - "e2e-smoke"
    - "dependency-audit"
  - Require linear history: true
  - Require signed commits: false (optional)
  - Include administrators: true
  - Restrict force pushes: true
  - Allow deletions: false
```

**Note**: Only configure job IDs that exist in workflows. Adding phantom checks will break PR merging.

### Develop Branch Protection
```yaml
Protections:
  - Require pull request reviews: 1 approval
  - Dismiss stale reviews: false
  - Require status checks: true
  - Required checks (exact GitHub status names):
    - "lint"
    - "typecheck"
    - "build-verification"
  - Require linear history: false
  - Restrict force pushes: true
  - Allow deletions: false
```

### Release Branch Protection
```yaml
Protections:
  - Require pull request reviews: 2 approvals
  - Require status checks: true
  - All main branch checks required
  - Manual testing documentation required
```

---

## Commit Message Convention

We follow **Conventional Commits** specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependency updates, etc.)
- `ci`: CI/CD changes
- `build`: Build system changes

### Examples
```bash
feat(auth): add 2FA authentication support
fix(pdf): resolve export template rendering issue
docs(api): update endpoint documentation
chore(deps): upgrade Stripe SDK to v18.5.0
```

---

## Best Practices

### DO
✅ Keep feature branches short-lived (< 3 days)  
✅ Rebase feature branches on develop regularly  
✅ Write descriptive commit messages  
✅ Delete branches after merge  
✅ Run tests locally before pushing  
✅ Review your own PR before requesting reviews  
✅ Respond to PR feedback promptly

### DON'T
❌ Commit directly to main or develop  
❌ Force push to shared branches  
❌ Create long-running feature branches  
❌ Mix multiple features in one branch  
❌ Merge without passing CI checks  
❌ Leave stale branches open  
❌ Bypass code review process

---

## Emergency Procedures

### Critical Production Issue
1. **Immediate**: Create hotfix branch from main
2. **Fix**: Implement minimal fix with thorough testing
3. **Fast-track PR**: 2 approvals required but expedited review
4. **Deploy**: Tag and deploy immediately after merge
5. **Post-mortem**: Document incident within 24 hours

### Rollback Scenario
```bash
# Option 1: Revert specific commit
git revert <commit-hash>
git push origin main

# Option 2: Deploy previous tag
git checkout tags/v2.0.0
# Trigger manual deployment workflow

# Option 3: Emergency hotfix
# Follow hotfix process above
```

---

## CI/CD Workflows Overview

This table maps workflows to jobs for accurate branch protection configuration:

**Important**: Update both workflows and this table together to prevent drift. Use exact Job IDs from workflow files for branch protection.

| Workflow File | Job ID | Job Name | Triggers | Purpose |
|--------------|--------|----------|----------|---------|
| **ci-gates.yml** | terminology-check | Forbidden Terminology Check | push, PR | Enforce terminology compliance |
| **ci-gates.yml** | lint | Lint & Format Check | push, PR | ESLint + Prettier validation |
| **ci-gates.yml** | typecheck | TypeScript Type Check | push, PR | TypeScript compilation check |
| **ci-gates.yml** | build-verification | Build Verification | push, PR | Client + Server build test |
| **ci-gates.yml** | migration-idempotency | Migration Idempotency Test | push, PR | Database migration testing |
| **ci-gates.yml** | unit-tests | Unit Tests | push, PR | Run unit test suite |
| **ci-gates.yml** | integration-tests | Integration Tests | push, PR | API integration testing |
| **ci-gates.yml** | seed-verification | Seed Script Verification | push, PR | Test database seeding |
| **ci-gates.yml** | e2e-smoke | E2E Smoke Tests | push, PR | Playwright smoke tests |
| **ci.yml** | build_and_verify | Build Release and Cold Verify | push (main), PR, release | Full build + QA pipeline |
| **security-audit.yml** | dependency-audit | Dependency Security Audit | push, PR, schedule | npm audit + SBOM generation |
| **security-audit.yml** | snyk-scan | Snyk Security Scan | push, PR | Snyk vulnerability scanning |
| **security-audit.yml** | codeql-analysis | CodeQL Security Analysis | push, PR | Static code analysis |
| **security-audit.yml** | security-scorecard | OSSF Security Scorecard | push (not PR) | Security best practices scoring |
| **security-audit.yml** | notify-security-team | Notify Security Team | push (not PR), on failure | Alert on security failures |
| **publish.yml** | release | Publish GitHub Release | tag push, dispatch | Build + publish release artifacts |

**For Branch Protection**: Use the **Job ID** column values as required status check names in GitHub settings. Not all jobs need to be required (e.g., notifications). Choose critical quality gates only.

---

## Frequently Asked Questions

**Q: Can I merge develop into my feature branch?**  
A: Yes, but prefer rebasing: `git rebase develop` to keep history cleaner.

**Q: What if CI fails on my PR?**  
A: Fix the issues locally, push new commits, and CI will re-run automatically.

**Q: How long should I wait for PR reviews?**  
A: Tag specific reviewers. Expect response within 4 hours during business hours.

**Q: Can I work on multiple features simultaneously?**  
A: Yes, create separate feature branches for each. Don't mix features in one branch.

**Q: What happens to my feature if develop diverges significantly?**  
A: Regularly rebase your feature branch on develop to avoid conflicts.

---

## Related Documentation

- [Pull Request Template](../.github/pull_request_template.md)
- [Code Review Guidelines](CODE_REVIEW_GUIDELINES.md)
- [Tagging Convention](TAGGING_CONVENTION.md)
- [Release Runbook](LAUNCH_RUNBOOK.md)
- [CI/CD Workflows](../.github/workflows/)
  - [CI Gates](../.github/workflows/ci-gates.yml)
  - [Full CI Build](../.github/workflows/ci.yml)
  - [Security Audit](../.github/workflows/security-audit.yml)
  - [Publish Release](../.github/workflows/publish.yml)

---

**Revision History**
- v1.0.0 (2025-10-01): Initial branching strategy documentation
