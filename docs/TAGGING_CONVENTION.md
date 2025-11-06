# Tagging Convention

**Last Updated**: October 1, 2025  
**Owner**: DevOps Lead  
**Status**: Active

---

## Overview

RUR2 uses **Semantic Versioning 2.0.0** for release tagging with prelaunch-specific conventions for pre-production releases.

---

## Semantic Versioning Format

```
v{MAJOR}.{MINOR}.{PATCH}[-{PRERELEASE}][+{BUILD}]
```

### Version Components

#### MAJOR
- **When to increment**: Incompatible API changes or breaking changes
- **Reset**: MINOR and PATCH to 0
- **Example**: v1.0.0 → v2.0.0

#### MINOR
- **When to increment**: New functionality added in a backwards-compatible manner
- **Reset**: PATCH to 0
- **Example**: v1.2.3 → v1.3.0

#### PATCH
- **When to increment**: Backwards-compatible bug fixes
- **Reset**: Nothing
- **Example**: v1.2.3 → v1.2.4

#### PRERELEASE (optional)
- **Format**: `-alpha.1`, `-beta.2`, `-rc.1`
- **Purpose**: Pre-production releases for testing
- **Example**: v2.0.0-beta.1

#### BUILD (optional)
- **Format**: `+20250101`, `+build.123`
- **Purpose**: Build metadata (not used for precedence)
- **Example**: v2.0.0+20250101

---

## Tag Naming Conventions

### Production Releases

```bash
# Major release
v2.0.0

# Minor release
v2.1.0

# Patch release
v2.1.1
```

### Pre-production Releases

```bash
# Alpha releases (internal testing)
v2.0.0-alpha.1
v2.0.0-alpha.2

# Beta releases (limited external testing)
v2.0.0-beta.1
v2.0.0-beta.2

# Release candidates (production-ready, final testing)
v2.0.0-rc.1
v2.0.0-rc.2

# Prelaunch releases (current convention)
prelaunch-20251001142530
prelaunch-YYYYMMDDHHMMSS
```

### Special Tags

```bash
# Hotfix releases
v2.0.1  # Emergency fix from v2.0.0

# Nightly builds (if needed)
v2.1.0-nightly.20251001
```

---

## Version Precedence

According to Semantic Versioning precedence rules:

```
v1.0.0-alpha.1 < v1.0.0-alpha.2 < v1.0.0-beta.1 < v1.0.0-rc.1 < v1.0.0
v1.0.0 < v1.0.1 < v1.1.0 < v2.0.0
```

---

## Tagging Process

### Manual Tagging (Standard Release)

```bash
# 1. Ensure you're on main branch with latest changes
git checkout main
git pull origin main

# 2. Verify version in package.json matches tag
cat package.json | grep version
# Should show: "version": "2.0.0"

# 3. Create annotated tag with changelog summary
git tag -a v2.0.0 -m "Release version 2.0.0

Features:
- Add 2FA authentication
- Implement PDF export templates
- Cloud storage integration

Bug Fixes:
- Fix evidence upload validation
- Resolve session timeout issues

Breaking Changes:
- API endpoint /auth/login now requires 2FA token
"

# 4. Push tag to remote
git push origin v2.0.0

# 5. Create GitHub Release manually in GitHub UI
#    - Or push will automatically trigger ci.yml workflow:
#    - Build and verify release package
#    - Upload release artifacts
# 6. Manual deployment to production environment required
```

### Automated Tagging (CI/CD)

The repository has two automated workflows for releases:

**For Prelaunch Releases** (`.github/workflows/publish.yml`):
```yaml
# Triggered by:
# 1. Pushing a prelaunch-* tag manually:
#    git tag prelaunch-$(date +%Y%m%d%H%M%S)
#    git push origin prelaunch-20251001142530
# 2. Manual workflow dispatch (creates tag automatically)

# What happens:
# - Builds release package (phase7_release.sh)
# - Creates GitHub Release with artifacts
# - Marks as pre-release
```

**For Production Releases** (`.github/workflows/ci.yml`):
```yaml
# Triggered by:
# - GitHub Release published or pre-released event
# - Push to main branch
# - Pull requests to main

# What happens:
# - Runs full CI/CD pipeline
# - Builds and verifies release package
# - Runs E2E tests
# - Uploads release artifacts

# Production release process:
# 1. Push SemVer tag: git push origin v2.0.0
# 2. Create GitHub Release from that tag (manually in GitHub UI)
# 3. CI workflow automatically triggers on release publish
# 4. Artifacts built and uploaded (manual deployment to production required)
```

**Tag Formats**:
- Prelaunch: `prelaunch-YYYYMMDDHHMMSS`
- Production: `v{MAJOR}.{MINOR}.{PATCH}`

### Pre-release Tagging

```bash
# Alpha release
git tag -a v2.0.0-alpha.1 -m "Alpha release 1 for version 2.0.0"
git push origin v2.0.0-alpha.1

# Beta release
git tag -a v2.0.0-beta.1 -m "Beta release 1 for version 2.0.0"
git push origin v2.0.0-beta.1

# Release candidate
git tag -a v2.0.0-rc.1 -m "Release candidate 1 for version 2.0.0"
git push origin v2.0.0-rc.1
```

---

## Version Bumping Guidelines

### When to Increment MAJOR

- Removing or renaming API endpoints
- Changing API response structure (breaking existing clients)
- Removing environment variables
- Database schema changes requiring data migration
- Changing authentication mechanisms
- Node.js or major dependency version bump requiring code changes

**Example**: Removing legacy authentication endpoints
```bash
v1.5.3 → v2.0.0
```

### When to Increment MINOR

- Adding new API endpoints
- Adding new features
- Adding optional fields to API responses
- Adding new environment variables (optional)
- Database schema additions (backwards-compatible)
- Dependency updates (non-breaking)

**Example**: Adding PDF template export feature
```bash
v1.5.3 → v1.6.0
```

### When to Increment PATCH

- Bug fixes
- Security patches
- Performance improvements
- Documentation updates
- Dependency updates (security/bug fixes only)
- UI/UX tweaks (non-functional)

**Example**: Fixing evidence upload validation bug
```bash
v1.5.3 → v1.5.4
```

---

## Tag Lifecycle

### Creating Tags

```bash
# Lightweight tag (not recommended for releases)
git tag v2.0.0

# Annotated tag (recommended - includes metadata)
git tag -a v2.0.0 -m "Release version 2.0.0"

# Tag specific commit
git tag -a v2.0.0 <commit-hash> -m "Release version 2.0.0"
```

### Viewing Tags

```bash
# List all tags
git tag

# List tags matching pattern
git tag -l "v2.*"

# Show tag details
git show v2.0.0

# List tags with commit messages
git tag -n
```

### Deleting Tags

```bash
# Delete local tag
git tag -d v2.0.0

# Delete remote tag
git push origin --delete v2.0.0
```

### Moving/Fixing Tags

```bash
# If tag was created on wrong commit
# 1. Delete incorrect tag
git tag -d v2.0.0
git push origin --delete v2.0.0

# 2. Create tag on correct commit
git checkout <correct-commit>
git tag -a v2.0.0 -m "Release version 2.0.0"
git push origin v2.0.0
```

---

## Release Workflow Integration

### Version Update Checklist

Before creating a release tag:

1. **Update Version in Code**
   ```bash
   # Root package.json
   npm version 2.0.0 --no-git-tag-version
   
   # Server package.json
   cd server && npm version 2.0.0 --no-git-tag-version
   
   # Client package.json
   cd client && npm version 2.0.0 --no-git-tag-version
   ```

2. **Update CHANGELOG.md**
   ```markdown
   ## [2.0.0] - 2025-10-15
   
   ### Added
   - 2FA authentication support
   - PDF export templates
   
   ### Changed
   - Updated Stripe integration to API version 2024-11-20
   
   ### Fixed
   - Evidence upload validation
   - Session timeout handling
   
   ### Breaking Changes
   - `/auth/login` endpoint now requires 2FA token
   ```

3. **Commit Version Bump**
   ```bash
   git add package.json server/package.json client/package.json CHANGELOG.md
   git commit -m "chore: bump version to 2.0.0"
   git push origin main
   ```

4. **Create Tag**
   ```bash
   git tag -a v2.0.0 -m "Release version 2.0.0"
   git push origin v2.0.0
   ```

---

## GitHub Release Automation

When a tag is pushed, GitHub Actions automatically:

1. **Builds Release Artifacts**
   - `rur2_prelaunch_YYYYMMDDHHMMSS.tar.gz`
   - SHA256 checksum file

2. **Creates GitHub Release**
   - Tag: v2.0.0
   - Title: RUR2 v2.0.0
   - Body: From `Fixes/reports/release_summary.json`
   - Artifacts: Release package and checksum

3. **Triggers Deployment**
   - Staging: Automatic
   - Production: Manual approval required

---

## Version Query Commands

```bash
# Current version from package.json
node -p "require('./package.json').version"

# Latest git tag
git describe --tags --abbrev=0

# Current commit tag (if exists)
git describe --exact-match --tags HEAD

# All tags for current branch
git tag --merged

# Tags containing specific commit
git tag --contains <commit-hash>
```

---

## Troubleshooting

### Tag Already Exists
```bash
# Error: tag 'v2.0.0' already exists
# Solution: Choose different version or delete existing tag
git tag -d v2.0.0  # local
git push origin --delete v2.0.0  # remote
```

### Tag Points to Wrong Commit
```bash
# Move tag to current HEAD
git tag -fa v2.0.0 -m "Release version 2.0.0"
git push origin v2.0.0 --force
```

### Tag Not Triggering CI
```bash
# Verify tag was pushed to remote
git ls-remote --tags origin

# Check workflow file for tag trigger pattern
cat .github/workflows/publish.yml
```

---

## Best Practices

### DO
✅ Use annotated tags for all releases (`-a` flag)  
✅ Include meaningful commit messages in tag annotations  
✅ Follow semantic versioning strictly  
✅ Update package.json versions before tagging  
✅ Document breaking changes in CHANGELOG  
✅ Test release artifacts before tagging production

### DON'T
❌ Use lightweight tags for releases  
❌ Skip version numbers (maintain sequence)  
❌ Reuse or move tags after pushing  
❌ Tag feature branches (only release branches)  
❌ Create tags without updating CHANGELOG  
❌ Force-push tags unless absolutely necessary

---

## Related Documentation

- [Branching Strategy](BRANCHING_STRATEGY.md)
- [Release Runbook](LAUNCH_RUNBOOK.md)
- [CI/CD Workflows](../.github/workflows/)

---

**Revision History**
- v1.0.0 (2025-10-01): Initial tagging convention documentation
