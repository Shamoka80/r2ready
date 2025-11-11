# RUR2 - R2v3 Pre-Certification Self-Assessment

## Overview
RUR2 is a professional monorepo application for managing R2v3 pre-certification self-assessments. Its core purpose is to streamline security and compliance evaluations, data management, and progress tracking through a modern web interface. Key features include payment-first registration, integrated cloud storage for document management, and robust authentication with 2FA. The project emphasizes extensibility, operational readiness, and compliance within the R2v3 framework, aiming for high business potential in security and compliance markets.

## User Preferences
- Preferred communication style: Simple, everyday language.
- **Working Standards**: ALWAYS verify solutions will work BEFORE proposing them. Never make assumptions or suggest actions without first consulting architect or doing proper analysis. User values efficiency and thoroughness - jumping to unverified solutions wastes time and credits.

## Recent Changes

### R2v3 Algorithm Enhancement Project (November 2025)
**Goal**: Enhance the readiness assessment algorithm with modular, configurable system featuring dynamic question branching, critical gate enforcement, separate maturity scoring, and externalized configuration while maintaining 100% backward compatibility.

**Phase 2 - Schema Design & Implementation (✅ FULLY COMPLETED - Nov 11, 2025)**:

*Schema TypeScript Implementation*:
- ✅ Enhanced `questions` table with 10 new fields: isMustPass, mustPassRuleId, parentQuestionId, displayCondition, isMaturityQuestion, maturityCategory, weightOverride, scoringConfigId, effectiveDate, deprecatedDate
- ✅ Enhanced `assessments` table with 5 new fields: readinessClassification, criticalBlockers, criticalBlockersCount, maturityScoreId, scoringConfigId
- ✅ Added 7 new configuration tables with normalized schema:
  - `scoringConfigs`: Externalized weights, thresholds, N/A handling rules
  - `mustPassRules`: Critical gate rule definitions (8 specific must-pass requirements)
  - `mustPassRuleQuestions`: Normalized FK join table for rule-question mappings
  - `conditionalRules`: Dynamic branching logic definitions
  - `conditionalRuleTargets`: Normalized FK join table for rule-target mappings
  - `questionDependencies`: Parent-child question relationships
  - `maturityScores`: Separate operational maturity tracking (BCP, CI, Stakeholder dimensions)
- ✅ All FK constraints include explicit `onDelete` behavior (`SET NULL` for configs, `CASCADE` for join tables)
- ✅ Insert/select schemas and type exports added for all new tables
- ✅ Drizzle relations defined for all new tables
- ✅ 100% backward compatible: All new fields nullable or defaulted, no schema removals

*Database Migration & Verification*:
- ✅ PostgreSQL database provisioned successfully
- ✅ Migration executed via `drizzle-kit push`
- ✅ All 7 new tables created in database
- ✅ All 10 Question columns verified in database
- ✅ All 5 Assessment columns verified in database  
- ✅ All FK constraints verified with correct onDelete behavior
- ✅ Application running without errors post-migration
- **Architect Review**: Approved (Nov 11, 2025)

**Implementation Approach**:
- Hybrid enhancement strategy: Layer new modules on existing foundation rather than replacement
- Discovered existing conditional question infrastructure (ConditionalQuestionService, QuestionDependencyService)
- Strategy revised from "build from scratch" to "enhance and externalize" existing hardcoded rules to database configuration
- Feature flags planned for gradual rollout: USE_CONFIG_WEIGHTS, ENFORCE_MUST_PASS, SEPARATE_MATURITY, EXCLUDE_NA_FROM_DENOMINATOR

**Phase 3 - Core Services (✅ COMPLETED - Nov 11, 2025)**:

*Service Implementations*:
- ✅ **CriticalGateEngine** (`server/services/criticalGateEngine.ts`): Evaluates 8 must-pass rules from database, identifies critical blockers, updates assessment readiness classification
- ✅ **MaturityEngine** (`server/services/maturityEngine.ts`): Calculates separate BCP/CI/Stakeholder maturity scores, determines maturity levels, saves scores to database with trend tracking
- ✅ **ConfigurableScoring** (`server/services/configurableScoring.ts`): Loads scoring configs from database, applies externalized weights and thresholds, implements configurable N/A handling
- ✅ **EnhancedConditionalQuestionService** (`server/services/enhancedConditionalQuestionService.ts`): Loads conditional rules from database, evaluates trigger conditions, manages question dependencies and display logic

*Schema Integration*:
- ✅ All services use Phase 2 schema fields correctly (value, ruleName, configName, ruleQuestions)
- ✅ Proper FK relation handling (SET NULL for configs, CASCADE for join tables)
- ✅ No LSP errors, full TypeScript type safety
- ✅ Application compiles and runs without errors

*Testing & Validation*:
- ✅ Integration test suite created verifying all service interfaces
- ✅ Application boot validation confirms services integrate without faults
- ✅ Database query patterns validated
- **Architect Review**: PASS - Phase 3 meets functional objectives (Nov 11, 2025)

**Phase 4 - Configuration Layer (✅ COMPLETED - Nov 11, 2025)**:

*Database Seeding* (`server/tools/seed-phase4-configuration.ts`):
- ✅ Seeded 8 must-pass rules representing R2v3 critical requirements:
  - MUST_PASS_EHSMS: EH&S Management System
  - MUST_PASS_LEGAL: Legal and Regulatory Compliance Plan
  - MUST_PASS_FOCUS_MATERIALS: Focus Materials Management Plan
  - MUST_PASS_DSV: Downstream Supplier Verification (DSV)
  - MUST_PASS_DATA_SECURITY: Data Security and Sanitization
  - MUST_PASS_CLOSURE: Facility Closure Plan
  - MUST_PASS_FINANCIAL: Financial Assurance
  - MUST_PASS_SERI: SERI R2 License
- ✅ Created 132 question-to-rule mappings linking assessment questions to must-pass requirements
- ✅ Created default R2v3 scoring configuration:
  - Category weights: LEGAL (15%), FACILITY (15%), EHS (20%), PROCESSING (15%), DATA (15%), SUPPLY_CHAIN (10%), MANAGEMENT (10%)
  - Readiness thresholds: 75% (ready), 85% (highly ready)
  - N/A handling: EXCLUDE (N/A responses excluded from denominator)
- ✅ Migrated 5 hardcoded conditional rules to database seed data:
  - Hazardous waste handler requirement (triggered by hasHazardousWasteFacilities)
  - Mechanical processing equipment requirement (triggered by hasMechanicalProcessing)
  - R2v3 downstream verification requirement (triggered by hasDownstreamOperations)
  - Destruction service requirement (triggered by offersDestructionServices)
  - Refurbishment service requirement (triggered by offersRefurbishmentServices)

*Admin API Routes* (`server/routes/configuration.ts`):
- ✅ Built 21 authenticated REST endpoints for configuration management
- ✅ **Scoring Configurations API**: GET/POST/PATCH/DELETE scoring configs, get active config
- ✅ **Must-Pass Rules API**: CRUD operations for rules, add/remove question mappings
- ✅ **Conditional Rules API**: CRUD operations for rules, add/remove target questions
- ✅ All routes secured with `AuthService.authMiddleware` following established admin pattern
- ✅ Registered in `server/routes.ts` at `/api/configuration`
- ✅ Direct database access via Drizzle ORM (matches existing admin route architecture)

*Verification & Testing*:
- ✅ Database verification: 8 rules, 132 mappings, 1 scoring config confirmed via SQL
- ✅ Application boots cleanly with no runtime or LSP errors
- ✅ Routes respond with proper authentication requirements (401 Unauthorized without token)
- ✅ All Phase 2 schema fields utilized correctly by seed data
- **Architect Review**: PASS - Phase 4 meets objectives and ready for Phase 5 (Nov 11, 2025)

**Phase 5 - Integration (✅ COMPLETED - Nov 11, 2025)**:

*Feature Flag System*:
- ✅ Added FeatureFlag table to schema with UUID PK and unique indexes
- ✅ Integrated 4 feature flags into existing shared/flags.ts system:
  - `use_config_weights`: Enable database-driven ConfigurableScoring
  - `enforce_must_pass`: Enable CriticalGateEngine evaluation
  - `separate_maturity`: Enable MaturityEngine scoring
  - `exclude_na_from_denominator`: Exclude N/A from scoring denominators
- ✅ All flags default to false for gradual rollout

*ScoringOrchestrator Service* (`server/services/scoringOrchestrator.ts`):
- ✅ Wraps legacy calculateAssessmentScore with feature flag checks
- ✅ Conditionally delegates to ConfigurableScoring when use_config_weights=true
- ✅ Runs CriticalGateEngine.evaluateAssessment when enforce_must_pass=true
- ✅ Calculates & persists MaturityScore when separate_maturity=true
- ✅ Maps new service results to legacy format for backward compatibility
- ✅ Returns EnhancedScoringResult with optional Phase 5 fields
- ✅ Implements adjustLegacyScoringForNAExclusion() for N/A exclusion in legacy path

*Scoring Routes Integration* (`server/routes/scoring.ts`):
- ✅ GET /api/assessments/:id/scoring uses ScoringOrchestrator
- ✅ POST /api/assessments/:id/scoring/refresh uses ScoringOrchestrator
- ✅ Maintains backward compatibility (legacy scoring when flags disabled)

*N/A Exclusion Implementation*:
- ✅ ConfigurableScoring: Skips N/A from maxScore/count when naHandling='EXCLUDE'
- ✅ Legacy scoring: Recalculates from raw answers using determineCategoryKey grouping
- ✅ Both paths exclude N/A from denominators when exclude_na_from_denominator=true
- ✅ All headline metrics consistent (score, percentage, complianceStatus, readinessLevel)

*Verification & Testing*:
- ✅ Application boots successfully with all services integrated
- ✅ No runtime or LSP errors
- ✅ Feature flags working correctly in both scoring paths
- ✅ Category grouping matches legacy logic (appendix → categoryCode → category)
- **Architect Review**: PASS - Phase 5 meets all functional objectives (Nov 11, 2025)

**Next Phase - Phase 6: Validation & Testing (NOT STARTED)**:
- End-to-end verification with seeded scenarios
- Integration tests for new APIs
- Regression testing with flags toggled on/off
- Performance testing under load

## System Architecture

### UI/UX Decisions
- **Design System**: Premium SaaS dark theme with a glassmorphism aesthetic, featuring professional neon accents (Blue, Success Green, Accent Orange) on deep dark backgrounds.
- **Accessibility**: WCAG 2.2 AAA contrast compliance, reduced motion support, and high contrast mode.
- **Theming**: Supports multiple professional dark themes for varied brand aesthetics.
- **Branding Customization**: Consultants can white-label the platform with custom logos and brand colors.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for state management, and Tailwind CSS with shadcn/ui for UI.
- **Backend**: Node.js 20 with Express.js and TypeScript, implementing RESTful APIs with Zod validation.
- **Data Layer**: PostgreSQL with Neon serverless configuration, managed by Drizzle ORM, utilizing shared schema definitions and automated migrations.
- **Monorepo Structure**: Organized into client, server, and shared directories using npm workspaces.

### Feature Specifications
- **Payment-First Registration**: Requires Stripe payment completion before account creation.
- **Mandatory Intake Process**: Users must complete payment, organization setup, and a 12-section intake form before dashboard access, enforced by a `SetupGate`.
- **R2v3 REC Mapping**: Dynamic assessment question generation based on intake form data using Relevance, Exclusion, Conditional (REC) logic, with comprehensive validation and facility-first mapping.
- **Cloud Storage Integration**: Production-ready integrations for Google Drive, OneDrive, Dropbox, Azure Blob Storage, and AWS S3 with a multi-provider architecture.
- **Authentication**: Comprehensive 2FA (TOTP, QR code, backup codes), JWT with refresh token rotation, device fingerprinting, and revocation. Magic Link Email Verification is implemented for streamlined user onboarding.
- **Client Management System**: Full CRUD operations for clients for consultant users, including a ClientSwitcher and tenant isolation.
- **Email Service**: Multi-provider email service with cascading fallback (Resend, SendGrid, SMTP, Console).

### System Design Choices
- **Security**: Comprehensive TypeScript coverage, Zod schema validation, secure authentication, rate limiting, and AES-256-GCM encryption for cloud storage.
- **User Journey**: Structured flow from Registration → Email Verification → Account Type Selection → Filtered Pricing → Checkout → Onboarding → Dashboard, with robust error handling and persistence.
- **E2E Testing**: Extensive Playwright test suite covering major user flows, including authentication, onboarding, and assessment lifecycle, with automatic database cleanup and email verification via DB token extraction.

## External Dependencies

### Core Frontend
- **React Ecosystem**: React 18, React DOM, Wouter.
- **UI Library**: Radix UI primitives, shadcn/ui.
- **State Management**: TanStack React Query.
- **Styling**: Tailwind CSS.
- **Icons**: Lucide React.
- **Forms**: React Hook Form.

### Core Backend
- **Server Framework**: Express.js.
- **Database**: Drizzle ORM, Neon PostgreSQL driver.
- **Validation**: Zod.

### Database and Storage
- **Database Provider**: Neon serverless PostgreSQL.
- **ORM**: Drizzle ORM, Drizzle Kit.
- **Cloud Storage SDKs**: Google Drive (`@google-cloud/storage`), OneDrive (`@microsoft/microsoft-graph-client`), Dropbox (`dropbox`), Azure Blob Storage (`@azure/storage-blob`), AWS S3.

### Other Integrations
- **Payment Processing**: Stripe.js v3.
- **Email Services**: Resend, SendGrid.
- **Authentication**: JWT.
- **Rate Limiting**: Redis-like storage.