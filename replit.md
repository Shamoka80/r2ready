# RUR2 - R2v3 Pre-Certification Self-Assessment

## Overview
RUR2 is a professional monorepo application designed for managing R2v3 pre-certification self-assessments. Its primary purpose is to streamline security and compliance evaluations, data management, and progress tracking via a modern web interface. Key capabilities include a payment-first registration, integrated cloud storage for document management, and robust authentication with 2FA. The project aims for high extensibility, operational readiness, and compliance within the R2v3 framework.

## User Preferences
- Preferred communication style: Simple, everyday language.
- **Working Standards**: ALWAYS verify solutions will work BEFORE proposing them. Never make assumptions or suggest actions without first consulting architect or doing proper analysis. User values efficiency and thoroughness - jumping to unverified solutions wastes time and credits.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Vite, Wouter for routing.
- **State Management**: TanStack Query.
- **UI Framework**: Tailwind CSS with custom branding and shadcn/ui.
- **Layout**: Global layout with top and sidebar navigation.

### Backend
- **Runtime**: Node.js 20 with Express.js.
- **Language**: TypeScript with strict mode.
- **API Design**: RESTful endpoints.
- **Validation**: Zod library.

### Data Layer
- **ORM**: Drizzle ORM for PostgreSQL.
- **Database**: PostgreSQL with Neon serverless configuration.
- **Schema Management**: Shared schema definitions with automated validation and migration tools.

### Styling and Theming
- **Design System**: Premium SaaS dark theme with a glassmorphism aesthetic.
- **Color Palette**: Professional neon accents (Blue, Success Green, Accent Orange) on deep dark backgrounds.
- **Accessibility**: WCAG 2.2 AAA contrast compliance, reduced motion support, and high contrast mode.
- **Theming**: Supports multiple professional dark themes for varied brand aesthetics while maintaining performance.

### Development Environment
- **Monorepo Structure**: Separate client, server, and shared directories.
- **Package Management**: npm workspaces.
- **Code Quality**: TypeScript strict mode, path aliases.

### Component Architecture
- **UI Components**: Modular shadcn/ui components.
- **Form Handling**: React Hook Form integration.

### User Journey & Onboarding
- **Mandatory Intake Process**: Users must complete payment, organization setup, and a 12-section intake form before dashboard access.
- **Guided Workflow**: Enforced by a `SetupGate` component checking user setup status, license validity, and intake form completion.
- **Intake Form Features**: Auto-save, pre-population, progress tracking, and user guidance.

### R2v3 REC Mapping & Validation
- **Intelligent REC Mapping**: Dynamic assessment question generation based on intake form data using Relevance, Exclusion, Conditional (REC) logic.
- **Comprehensive Validation**: `validateIntakeCompleteness()` enforces 10 core fields + supply chain for accurate REC evaluation.
- **Facility-First REC Mapping**: Facility records are auto-created based on `totalFacilities`, inheriting organization-level processing data, with REC mapping prioritizing aggregated facility-level data.
- **Data Persistence**: REC mapping metadata (`filteringInfo`) is persisted to the database for consistency.
- **Question-to-REC Mapping Seeding**: Versioned JSON mapping file (`server/data/question-rec-mappings-v1.json`) with idempotent merge and fresh modes for database seeding.

### Security
- **Type Safety**: Comprehensive TypeScript coverage.
- **Input Validation**: Zod schema validation.
- **Authentication**: Comprehensive 2FA (TOTP, QR code, backup codes), JWT with refresh token rotation, device fingerprinting, and revocation.
- **Rate Limiting**: Production-ready middleware with a development-only test user bypass.
- **Cloud Storage Security**: Automatic AES-256-GCM encryption for sensitive files.
- **Test User Management**: Environment-based guardrails prevent test data pollution in production.

### Feature Specifications
- **Payment-First Registration**: Stripe payment completion is required before account creation.
- **Cloud Storage Integration**: Production-ready integrations for Google Drive, OneDrive, Dropbox, Azure Blob Storage, and AWS S3 with a multi-provider architecture.
- **Magic Link Email Verification (November 2, 2025)**: Streamlined email verification with magic link approach:
  - **Single Verification Method**: Users receive a clickable verification link (10-minute expiry)
  - **Database Schema**: `emailVerificationToken`, `emailVerificationTokenExpiry` fields in users table
  - **API Endpoints**: 
    - `POST /api/auth/verify-email` (token-based, accepts link token)
    - `POST /api/auth/send-verification-email` (resend verification link)
  - **Frontend**: VerifyEmail page auto-verifies via URL token with clean UI states (Loading, Success, Error, Waiting)
  - **Auto-Login**: After verification, auth token stored in localStorage (`auth_token` key) and user redirects to account type selection
  - **Email Service**: Multi-provider email service with cascading fallback:
    - Priority 1: Resend (Primary) - ✅ Active
    - Priority 2: SendGrid (Fallback #1) - ✅ Configured
    - Priority 3: SMTP (Fallback #2) - Not configured
    - Priority 4: Console (Development fallback) - ✅ Available
  - **Resend Integration (Priority 1)**: Production email delivery via Resend API (resend.com)
    - **API Key**: RESEND_API_KEY environment secret
    - **Verified Domain**: wrekdtech.com (DNS records verified at resend.com/domains)
    - **From Email**: RESEND_FROM_EMAIL environment variable (using @wrekdtech.com)
    - **Status**: ✅ Active - emails successfully sent to any recipient
  - **SendGrid Integration (Priority 2)**: Fallback email delivery via SendGrid API
    - **API Key**: SENDGRID_API_KEY environment secret
    - **From Email**: SENDGRID_FROM_EMAIL environment variable  
    - **Status**: ✅ Configured and ready - activates if Resend fails
  - **Email Templates**: Professional HTML templates with gradient branding, magic links, and responsive design
  - **User Experience**: Clean, simple verification flow without code entry - click link and proceed
- **Industry-Standard Account Type Selection (November 2, 2025)**: User journey aligned with Industry_Aligned_Journey.md specification:
  - **Flow**: Register → Verify (magic link) → Account Type Selection → Filtered Pricing → Checkout → Onboarding → Dashboard
  - **Account Type Selection**: Dedicated `/account-type-selection` page after email verification where users choose Business or Consultant path
  - **Filtered Pricing**: Pricing page accepts `?type={business|consultant}` query param and shows only relevant tiers
  - **Account Type Persistence**: Selection stored via `PATCH /api/auth/account-type`, updating tenant type
  - **User Experience**: Clear visual distinction between Business (facility-centric) and Consultant (multi-client) paths before pricing
- **Phase B: Client Management System (November 2, 2025)**: Complete consultant multi-client management capabilities including:
  - **ClientContext Provider**: React Context for selected client state with localStorage persistence (key: `rur2_selected_client`)
  - **ClientSwitcher Component**: Dropdown in ConsultantDashboard header for switching between clients
  - **Client Management Pages**: Full CRUD operations with Clients list page and ClientDetail page showing profile, facilities, assessments
  - **Tenant Isolation**: All client queries filtered by `consultantTenantId` for security
  - **API Endpoints**: GET/POST /api/client-organizations with validation
  - **Context Banner**: ClientContextBanner component displays current client on assessment pages
  - **Dashboard Integration**: ConsultantDashboard filters data by selected client
  - **Known Issue**: Stripe checkout redirect issue exists (pre-existing, outside Phase B scope) - payment flow needs separate investigation
- **Phase 6: White-Label Branding (November 2, 2025)**: Professional branding customization for consultant tiers:
  - **Database Schema**: Added `logoUrl`, `brandColorPrimary`, `brandColorSecondary` fields to tenants table (migration 0016)
  - **Brand Settings Page**: `/brand-settings` route with consultant-only access for logo upload and color customization
  - **Logo Upload System**: Multer-based file upload handler with validation (PNG/JPG/SVG, max 2MB), files stored in `server/uploads/logos/`
  - **API Endpoints**:
    - `GET /api/tenants/branding` - Retrieve current branding settings (consultant-only)
    - `PATCH /api/tenants/branding` - Update brand colors and logoUrl (consultant-only, validates hex codes)
    - `POST /api/tenants/upload-logo` - Upload consultant logo with auto-generated unique filename
  - **Static File Serving**: `/uploads` route configured to serve uploaded logos
  - **Color Validation**: Hex color code validation (#RRGGBB format)
  - **Preview System**: Live preview of branding on reports and client dashboards
  - **Access Control**: All branding endpoints restricted to consultant tenants only (tenantType === 'CONSULTANT')
  - **Future Integration**: Branding data ready for use in report generation and client-facing exports
- **Authentication & Payment Flow Stability (November 6, 2025)**: Critical bug fixes ensuring seamless user progression:
  - **Email Verification Persistence Fix**: Login endpoint now returns `emailVerified` field, preventing verified users from being redirected to email verification on every login
    - **Root Cause**: `POST /api/auth/login` response was missing `emailVerified` field, causing SetupGate to always redirect verified users
    - **Solution**: Added `emailVerified: user.emailVerified` to login response payload (server/routes/auth.ts line 475)
    - **Impact**: Users can now login once and proceed directly to appropriate next step based on license/setup status
  - **Dual-Source License Success Page**: Payment success page now supports both Stripe payments and mock payments with robust fallback logic
    - **Stripe Flow**: Traditional flow with session_id query parameter fetching Stripe session data
    - **Mock Payment Flow**: Direct license status fetch when no session_id present
    - **Fallback Protection**: If Stripe session fetch fails but license exists, page falls back to displaying license data
    - **Error Handling**: Only shows error if BOTH Stripe session AND license status fail, preventing users from being stranded despite valid license
    - **Implementation Details** (client/src/pages/LicenseSuccess.tsx):
      - Line 77: License status query enabled when `!sessionId || !!sessionError`
      - Line 150-182: Dual-source error handling logic
      - Line 186: Payment success determined from either Stripe OR license status
    - **User Experience**: Seamless success page display for all payment types (Stripe checkout, mock payments, Stripe fallback)
  - **Complete User Journey**: Login → Pricing → Payment → Success → Onboarding/Dashboard now works without verification loops or payment errors

### E2E Test Suite (Playwright)
- **Coverage**: ≥95% test coverage across major user flows including Authentication, Onboarding, Assessment Lifecycle, and other core features.
- **User Journey Tests (November 5, 2025)**: Complete end-to-end tests following Industry_Aligned_Journey specification:
  - **Test User 1 - Business Solo License (PDF Report)**: shamoka@gmail.com - Registration → Onboarding → Assessment → PDF Report Generation
  - **Test User 2 - Agency Consultant License (Word Report)**: jorelaiken@gmail.com - Registration → Client Management → Assessment → Word Report Generation
  - **Automation Features**: Automatic database cleanup, smart navigation detection for Stripe payment pauses, email verification via DB token extraction
  - **Test Location**: `e2e-tests/` directory with comprehensive documentation
  - **Test Execution**: `npx playwright test e2e-tests/` or use interactive runner script `./run-e2e-tests.sh`

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

### UI and Styling
- **Component Library**: shadcn/ui.
- **Styling Utilities**: clsx, tailwind-merge.
- **Design Tokens**: class-variance-authority.
- **Carousel**: Embla Carousel.

### Other Integrations
- **Payment Processing**: Stripe.js v3.
- **Authentication**: JWT.
- **Rate Limiting**: Redis-like storage.