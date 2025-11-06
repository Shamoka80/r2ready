# Scope Freeze Policy

## Definition
Scope freeze prevents new features from entering a release cycle
to ensure quality and timely delivery.

## Freeze Windows
- **Feature Freeze**: 2 weeks before planned release
- **Code Freeze**: 1 week before release
- **Emergency Only**: 48 hours before release

## What's Allowed During Freeze
- Bug fixes (severity-based approval)
- Security patches (automatic approval)
- Documentation updates (no approval needed)
- Performance fixes (approval required)

## What's Not Allowed
- New features
- Refactoring
- Dependency major upgrades
- Database schema changes

## Exception Process
- Submit to CCB with impact analysis
- Requires unanimous approval
- Automatic 3-day timeline extension
- Executive sponsor required for code freeze exceptions
