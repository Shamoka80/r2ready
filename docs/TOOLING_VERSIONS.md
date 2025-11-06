# Tooling Version Matrix

**Last Updated**: October 1, 2025  
**Owner**: DevOps Lead  
**Status**: Active

---

## Overview

This document maintains a comprehensive inventory of all tools, frameworks, and dependencies used in the RUR2 project, along with version requirements and update policies.

---

## Runtime Environment

| Tool | Version | Type | Update Policy |
|------|---------|------|---------------|
| **Node.js** | 20.x LTS | Runtime | Major: Annual review (Oct)<br>Minor: Quarterly<br>Security: Immediate |
| **npm** | 10.x | Package Manager | Bundled with Node.js |
| **TypeScript** | 5.9.2 | Language | Minor: Monthly<br>Patch: Weekly |
| **PostgreSQL** | 15+ | Database | Via Neon (managed) |

**Note**: All CI/CD workflows standardized on Node.js 20.x for consistency.

### Version Constraints
```json
{
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

---

## Frontend Stack

### Core Framework

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **react** | ^18.3.1 | UI Framework | Major: Requires RFC<br>Minor: Quarterly |
| **react-dom** | ^18.3.1 | DOM Renderer | Match React version |
| **wouter** | ^3.7.1 | Client Routing | Minor: Quarterly<br>Patch: Monthly |
| **vite** | ^5.4.20 | Build Tool | Minor: Monthly<br>Patch: Weekly |

### State Management

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **@tanstack/react-query** | ^5.89.0 | Server State | Minor: Monthly |

### UI Framework

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **tailwindcss** | ^3.4.17 | CSS Framework | Minor: Quarterly |
| **@tailwindcss/vite** | ^4.1.3 | Vite Plugin | Match Tailwind |
| **@radix-ui/react-*** | ^1.x-^2.x | UI Primitives | Minor: Monthly |
| **lucide-react** | ^0.453.0 | Icon Library | Minor: Weekly (visual only) |
| **framer-motion** | ^11.13.1 | Animations | Minor: Quarterly |

### Forms & Validation

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **react-hook-form** | ^7.55.0 | Form Management | Minor: Monthly |
| **@hookform/resolvers** | ^3.10.0 | Form Resolvers | Match RHF version |
| **zod** | ^3.24.2 | Validation | Minor: Monthly |

---

## Backend Stack

### Core Framework

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **express** | ^4.21.2 | Web Framework | Minor: Quarterly<br>Security: Immediate |
| **typescript** | ^5.9.2 | Language | Minor: Monthly |
| **tsx** | ^4.20.6 | TS Executor | Minor: Monthly |

### Database

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **drizzle-orm** | 0.39.1 | ORM | Minor: Monthly (careful) |
| **drizzle-kit** | ^0.31.5 | Migrations | Match Drizzle ORM |
| **drizzle-zod** | ^0.7.0 | Schema Validation | Match Drizzle ORM |
| **@neondatabase/serverless** | ^0.10.0 | DB Driver | Minor: Monthly |
| **postgres** | ^3.4.5 | Postgres Client | Minor: Quarterly |

### Authentication & Security

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **jsonwebtoken** | ^9.0.2 | JWT Tokens | Security: Immediate<br>Minor: Quarterly |
| **bcryptjs** | ^3.0.2 | Password Hashing | Security: Immediate |
| **express-session** | ^1.18.1 | Session Management | Security: Immediate |
| **passport** | ^0.7.0 | Auth Middleware | Minor: Quarterly |
| **passport-local** | ^1.0.0 | Local Strategy | Match Passport |

---

## Testing Infrastructure

### E2E Testing

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **playwright** | ^1.55.1 | E2E Testing | Minor: Monthly |
| **@playwright/test** | ^1.55.1 | Test Runner | Match Playwright |

### Browser Compatibility

| Browser | Version | Support Level | Testing |
|---------|---------|---------------|---------|
| **Chromium** | 130+ | Primary | Playwright E2E |
| **Chrome** | Latest 2 major versions | Full support | Manual + Automated |
| **Firefox** | Latest 2 major versions | Full support | Manual testing |
| **Safari** | Latest 2 major versions | Full support | Manual testing |
| **Edge** | Latest 2 major versions | Full support | Manual testing |
| **Mobile Safari** | iOS 15+ | Full support | Manual testing |
| **Mobile Chrome** | Latest | Full support | Manual testing |

**Compatibility Notes**:
- ES2022 features supported
- CSS Grid and Flexbox required
- Modern JavaScript (async/await, modules)
- No IE11 support

---

## External Services

### Payment Processing

| Service | API Version | SDK Version | Update Policy |
|---------|-------------|-------------|---------------|
| **Stripe** | 2024-11-20 | stripe: ^18.5.0 | API: Pin for stability<br>SDK: Monthly review |
| **@stripe/stripe-js** | ^7.9.0 | Frontend SDK | Match backend SDK |
| **@stripe/react-stripe-js** | ^4.0.2 | React Integration | Match @stripe/stripe-js |

**Security Note**: Always use test keys in development. Live keys managed via environment variables only.

### Database

| Service | Version | Connection | Update Policy |
|---------|---------|------------|---------------|
| **Neon PostgreSQL** | 15+ | Serverless | Managed by Neon |

### Cloud Storage

| Provider | SDK Version | Purpose | Update Policy |
|----------|-------------|---------|---------------|
| **AWS S3** | aws-sdk ^2.1692.0 | File Storage | Monthly review |
| **Azure Blob** | @azure/storage-blob ^12.28.0 | File Storage | Monthly review |
| **Google Cloud** | @google-cloud/storage ^7.17.1 | File Storage | Monthly review |
| **Dropbox** | dropbox ^10.34.0 | File Storage | Monthly review |
| **Microsoft Graph** | @microsoft/microsoft-graph-client ^3.0.7 | OneDrive | Monthly review |

---

## Development Tools

### Code Quality

| Tool | Version | Purpose | Update Policy |
|------|---------|---------|---------------|
| **ESLint** | ^9.36.0 | Linting | Minor: Quarterly |
| **@typescript-eslint/parser** | ^8.44.1 | TS Parser | Match ESLint |
| **@typescript-eslint/eslint-plugin** | ^8.44.1 | TS Rules | Match Parser |
| **eslint-plugin-react** | ^7.37.5 | React Rules | Match ESLint |
| **eslint-plugin-react-hooks** | ^5.2.0 | Hooks Rules | Match ESLint |
| **Prettier** | ^3.6.2 | Formatting | Minor: Quarterly |

### Git Hooks

| Tool | Version | Purpose | Update Policy |
|------|---------|---------|---------------|
| **husky** | ^9.1.7 | Git Hooks | Minor: Quarterly |
| **lint-staged** | ^16.2.0 | Staged Linting | Minor: Quarterly |

---

## Build & Deployment

### Build Tools

| Tool | Version | Purpose | Update Policy |
|------|---------|---------|---------------|
| **vite** | ^5.4.20 | Frontend Build | Minor: Monthly |
| **@vitejs/plugin-react** | ^4.7.0 | React Plugin | Match Vite |
| **esbuild** | ^0.25.0 | JS Bundler | Minor: Monthly |
| **postcss** | ^8.5.6 | CSS Processing | Minor: Quarterly |
| **autoprefixer** | ^10.4.21 | CSS Prefixing | Minor: Quarterly |

### CI/CD

| Tool | Version | Purpose | Update Policy |
|------|---------|---------|---------------|
| **GitHub Actions** | Latest | CI/CD | Managed by GitHub |
| **Dependabot** | v2 | Dependency Updates | Managed by GitHub |
| **Node.js (Actions)** | 20.x | CI Runtime | Match production |

---

## Document Processing

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **pdfkit** | ^0.17.2 | PDF Generation | Security: Immediate<br>Minor: Quarterly |
| **docx** | ^9.5.1 | Word Documents | Minor: Quarterly |
| **exceljs** | ^4.4.0 | Excel Spreadsheets | Minor: Quarterly |
| **csv-parse** | ^5.6.0 | CSV Parsing | Minor: Quarterly |

---

## Utility Libraries

| Package | Version | Purpose | Update Policy |
|---------|---------|---------|---------------|
| **lodash** | ^4.17.21 | Utilities | Security: Immediate |
| **date-fns** | ^3.6.0 | Date Manipulation | Minor: Quarterly |
| **zod-validation-error** | ^3.4.0 | Error Formatting | Minor: Monthly |
| **chalk** | ^5.6.2 | Terminal Colors | Minor: As needed |
| **cors** | ^2.8.5 | CORS Middleware | Security: Immediate |

---

## Deprecated / Removed

| Package | Removed Version | Removal Date | Reason | Replacement |
|---------|----------------|--------------|--------|-------------|
| _None currently_ | - | - | - | - |

---

## Update Policies

### Security Updates
- **Critical**: Within 24 hours
- **High**: Within 48 hours
- **Medium**: Within 1 week
- **Low**: Next regular update cycle

### Version Update Cadence

| Category | Frequency | Review Day |
|----------|-----------|------------|
| **Security Patches** | Immediate | N/A |
| **Patch Versions** | Weekly | Monday |
| **Minor Versions** | Monthly | First Monday |
| **Major Versions** | Quarterly | Q1, Q2, Q3, Q4 |

### Major Version Upgrades

Require:
1. **RFC (Request for Comments)**
   - Document breaking changes
   - Migration path outlined
   - Risk assessment completed

2. **Testing Plan**
   - All test suites updated
   - E2E tests pass
   - Performance benchmarks met

3. **Approval**
   - Tech Lead approval
   - Engineering Manager signoff
   - CCB review for production impact

4. **Rollout**
   - Deploy to staging first
   - Monitor for 1 week
   - Rollback plan documented

---

## Version Pinning Strategy

### Exact Versions (no `^` or `~`)
- **Database drivers**: Stability critical
- **Stripe SDK**: API compatibility
- **Drizzle ORM**: Schema stability

### Caret Ranges (`^`)
- **Framework packages**: React, Vue, etc.
- **Build tools**: Vite, esbuild
- **Most npm packages**: Default

### Tilde Ranges (`~`)
- **Security-sensitive**: When cautious updates needed
- **Legacy packages**: When major changes risky

---

## Compatibility Matrix

### Node.js vs TypeScript
| Node.js | TypeScript | Status |
|---------|------------|--------|
| 20.x | 5.9.2 | ✅ Current |
| 18.x | 5.9.2 | ⚠️ Supported (EOL April 2025) |
| 16.x | 5.9.2 | ❌ Unsupported |

### React vs React Query
| React | React Query | Status |
|-------|-------------|--------|
| 18.3.x | 5.89.0 | ✅ Current |
| 18.2.x | 5.x | ✅ Compatible |
| 17.x | 5.x | ❌ Unsupported |

---

## Monitoring & Automation

### Automated Dependency Scanning
- **Dependabot**: Weekly PR for outdated packages
- **npm audit**: Daily security scan (CI/CD)
- **Snyk**: Weekly vulnerability scan
- **Renovate**: Alternative to Dependabot (configured)

### Manual Review Process
1. **Weekly**: Review Dependabot PRs
2. **Monthly**: Review minor version updates
3. **Quarterly**: Review major version roadmap
4. **Annually**: Full stack review (October)

---

## Breaking Change Management

### When a Dependency Has Breaking Changes

1. **Assess Impact**
   - Read changelog thoroughly
   - Identify affected code areas
   - Estimate migration effort

2. **Plan Migration**
   - Create migration branch
   - Update all dependent code
   - Update tests
   - Update documentation

3. **Test Thoroughly**
   - Run full test suite
   - Manual regression testing
   - Performance testing

4. **Deploy Safely**
   - Deploy to staging first
   - Monitor for 48 hours
   - Rollback plan ready

---

## Version Query Commands

```bash
# Current versions
npm list --depth=0

# Outdated packages
npm outdated

# Security audit
npm audit

# Check specific package
npm show <package-name> version

# Verify Node.js version
node --version

# Verify npm version
npm --version

# TypeScript version
npx tsc --version

# Playwright version
npx playwright --version
```

---

## Environment-Specific Versions

### Development
- Latest minor versions
- Beta features enabled for testing
- Verbose logging

### Staging
- Same as production
- Matches production exactly
- Production-like data volume

### Production
- Pinned stable versions
- Minimal logging
- Performance optimized

---

## Rollback Procedures

### Dependency Rollback

```bash
# Rollback specific package
npm install <package-name>@<previous-version>

# Rollback all packages
git checkout HEAD~1 -- package-lock.json
npm install

# Rollback Node.js version
nvm use 20.16.0  # or specific version
```

---

## Related Documentation

- [Dependabot Configuration](../.github/dependabot.yml)
- [Renovate Configuration](../renovate.json)
- [Security Audit Workflow](../.github/workflows/security-audit.yml)
- [Development Setup](DEVELOPMENT_SETUP.md)

---

## Contacts

- **Version Management**: DevOps Lead
- **Security Updates**: Security Team
- **Breaking Changes**: Tech Lead
- **Questions**: #engineering Slack channel

---

**Revision History**
- v1.0.0 (2025-10-01): Initial version matrix documentation
