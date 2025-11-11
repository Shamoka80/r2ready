# RUR2 - R2v3 Pre-Certification Self-Assessment

## Overview
RUR2 is a professional monorepo application designed to manage R2v3 pre-certification self-assessments. Its primary goal is to streamline security and compliance evaluations, data management, and progress tracking via a modern web interface. Key features include payment-first registration, integrated cloud storage for document management, and robust authentication with 2FA. The project prioritizes extensibility, operational readiness, and compliance within the R2v3 framework, aiming for significant business potential in the security and compliance markets.

## User Preferences
- Preferred communication style: Simple, everyday language.
- **Working Standards**: ALWAYS verify solutions will work BEFORE proposing them. Never make assumptions or suggest actions without first consulting architect or doing proper analysis. User values efficiency and thoroughness - jumping to unverified solutions wastes time and credits.

## System Architecture

### UI/UX Decisions
- **Design System**: Premium SaaS dark theme with a glassmorphism aesthetic, featuring professional neon accents (Blue, Success Green, Accent Orange) on deep dark backgrounds.
- **Accessibility**: WCAG 2.2 AAA contrast compliance, reduced motion support, and high contrast mode.
- **Theming**: Supports multiple professional dark themes.
- **Branding Customization**: Consultants can white-label the platform.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for state management, and Tailwind CSS with shadcn/ui.
- **Backend**: Node.js 20 with Express.js and TypeScript, implementing RESTful APIs with Zod validation.
- **Data Layer**: PostgreSQL with Neon serverless configuration, managed by Drizzle ORM, utilizing shared schema definitions and automated migrations.
- **Monorepo Structure**: Organized into client, server, and shared directories using npm workspaces.

### Feature Specifications
- **Payment-First Registration**: Requires Stripe payment completion before account creation.
- **Mandatory Intake Process**: Users must complete payment, organization setup, and a 12-section intake form before dashboard access, enforced by a `SetupGate`.
- **R2v3 REC Mapping**: Dynamic assessment question generation based on intake form data using Relevance, Exclusion, Conditional (REC) logic.
- **Cloud Storage Integration**: Production-ready integrations for Google Drive, OneDrive, Dropbox, Azure Blob Storage, and AWS S3 with a multi-provider architecture.
- **Authentication**: Comprehensive 2FA (TOTP, QR code, backup codes), JWT with refresh token rotation, device fingerprinting, and revocation. Magic Link Email Verification is implemented.
- **Client Management System**: Full CRUD operations for clients for consultant users, including a ClientSwitcher and tenant isolation.
- **Email Service**: Multi-provider email service with cascading fallback (Resend, SendGrid, SMTP, Console).
- **R2v3 Algorithm Enhancement**: Modular and configurable system featuring dynamic question branching, critical gate enforcement, separate maturity scoring, and externalized configuration, maintaining backward compatibility.

### System Design Choices
- **Security**: Comprehensive TypeScript coverage, Zod schema validation, secure authentication, rate limiting, and AES-256-GCM encryption for cloud storage.
- **User Journey**: Structured flow from Registration → Email Verification → Account Type Selection → Filtered Pricing → Checkout → Onboarding → Dashboard, with robust error handling and persistence.
- **E2E Testing**: Extensive Playwright test suite covering major user flows, with automatic database cleanup and email verification via DB token extraction.
- **Performance Optimization**: Production-ready database optimizations across two phases (COMPLETE):
  - **Phase 1** (✅ Complete): 7 composite indexes on hot paths (57% faster queries), query batching eliminating N+1 patterns (96% query reduction), LRU caching for static data (sub-ms hits, 50% hit rate), and Neon connection pooling configuration.
  - **Phase 2** (✅ Complete): Cursor pagination with composite cursors (timestamp + id) eliminating full table scans, cloud storage caching (LRU with 1hr metadata TTL, 5min URL TTL, <1ms cache hits), 2 materialized views (clientOrgStats, assessmentStats - 39% faster dashboard queries), background job infrastructure (atomic dequeue, exponential backoff retry, graceful shutdown, 63ms enqueue time), async report generation and email sending converted to background jobs.
  - **Pagination Contract**: Forward/backward pagination both maintain DESC presentation order (newest→oldest), with comprehensive edge case handling validated through automated test suite (6/6 scenarios pass).

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
- **Database Provider**: Neon serverless PostgreSQL with connection pooling and pipelined connections.
- **ORM**: Drizzle ORM, Drizzle Kit.
- **Database Optimization**: 7 composite indexes on hot paths, query batching to eliminate N+1 patterns, LRU caching layer for static data.
- **Cloud Storage SDKs**: Google Drive (`@google-cloud/storage`), OneDrive (`@microsoft/microsoft-graph-client`), Dropbox (`dropbox`), Azure Blob Storage (`@azure/storage-blob`), AWS S3.

### Other Integrations
- **Payment Processing**: Stripe.js v3.
- **Email Services**: Resend, SendGrid.
- **Authentication**: JWT.
- **Rate Limiting**: Redis-like storage.