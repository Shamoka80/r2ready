# RuR2 User Flow

## Overview
This document outlines the complete user journey through the RuR2 application, from initial registration to ongoing assessment management. The current implementation follows an onboarding-first approach where users complete profile setup before payment processing.

## New User Registration Flow

### 1. Landing Page
- User visits RuR2 application
- Clear value proposition for R2v3 compliance
- Call-to-action for registration

### 2. Registration Process
- User creates account with email/password
- Account type selection (Business or Consultant)
- Initial user profile creation
- **Important**: Registration does NOT immediately redirect to payment

### 3. Onboarding Wizard (OnboardingV2)
- **Step 1**: Organization Profile Setup
  - Company/organization details
  - Contact information
  - Business type and size
- **Step 2**: Facility/Client Management
  - Primary facility setup (Business users)
  - Client organization management (Consultant users)
- **Step 3**: Scope and Applicability
  - Assessment scope definition
  - Compliance requirements identification
- **Step 4**: Final Setup
  - Review and confirmation
  - Account marked as setup_complete

### 4. Payment Processing (Payment-First Flow)
- **Direct to Pricing**: Users can access pricing immediately after registration
- **Plan Selection**: Choose from Business (Solo/Team/Enterprise) or Consultant (Independent/Agency/Enterprise) tiers
- **Stripe Checkout**: Integrated payment with test mode for development
- **License Activation**: Webhook-driven license activation upon successful payment
- **Account Unlock**: Payment completion unlocks full application features

### 5. Dashboard Access (Setup Gate Protection)
- **Setup Gate**: All users must complete onboarding wizard before dashboard access
- **Status Check**: `setup_complete` flag determines access permissions
- **Business Users**: Facility management dashboard with assessment tracking
- **Consultant Users**: Multi-client portfolio dashboard with project oversight
- **Incomplete Setup**: Automatic redirect to onboarding wizard until completion
- **Post-Setup Features**: Full assessment creation, reporting, and collaboration tools

Here is a clean, industry-standard new user journey for an R2v3 pre-certification web app. It removes redundancy and enforces the correct Business vs Consultant branching.

1) Entry → Signup → Access
Public landing with value proposition and pricing. Register, choose plan, pay, then log in with 2-factor authentication.

2) Role + Organization Setup
Select role: Business or Consultant. Complete organization profile, branding, timezone, and preferences through a setup wizard.

3) Branching

- Business: Create facilities, assign facility managers, set permissions.

- Consultant: Create client organizations first, then client facilities; enable white-label and client billing.

4) Assessment Initialization
Start assessment, choose scope (full R2v3, subset, or re-assessment), select facilities, assign team, set milestones.

5) Organization & Facility Facts
Capture legal entity data, contacts, facility activities and volumes, certification history. Auto-save to account.

6) REC Mapping + Appendix Determination
Select equipment categories and activities. Record determinations such as presence of data, focus materials, downstream vendors. System maps applicable R2v3 Appendices per facility.

7) Questionnaire + Evidence
Navigate section-based questions, answer using Yes/Partial/No/N/A, attach evidence, add notes. Auto-save and allow team collaboration.

8) Scoring & Gap Analysis
Provide real-time scoring, gap classification, readiness status, benchmarking, and trend tracking.

9) Results Dashboard
Show executive summary, clause breakdown, prioritized actions with timelines, and estimated effort/cost.

10) Corrective Actions (CAPA)
Track action items with owners, due dates, status, and maintain a CAPA dashboard.

11) Scope Statement Generator
Generate R2v3 scope statement automatically from collected data; make it exportable.

12) Reporting & Exports
Produce executive, detailed, and action-plan reports with branding. Share securely, track versions, export to PDF/Excel/Word.

13) Mock Audit
Run simulated audits with randomized scenarios and instant feedback to verify readiness.

14) Training & Knowledge
Provide clause-level tutorials, knowledge base, and glossary to address gaps and sustain compliance.

15) Collaboration + Audit Trail
Enable team assignments, approvals, comments, activity logging, and concurrent editing with traceability.

16) Account, Security, and Data Management
Role-based access control, consultant multi-client dashboard, billing, profile and security settings, data export/retention, encryption, incident response, and session handling.

Flow summary:
Landing → Registration/Payment → Login/Onboarding → Branch (Business: Facilities | Consultant: Clients → Facilities) → Assessment Setup → REC/Appendix Mapping → Questionnaire/Evidence → Scoring → Results → CAPA → Scope Statement → Reports → Mock Audit → Ongoing Training/Collaboration → Account/Security/Data.

Key improvements over your original: explicit role branching at onboarding, REC/Appendix mapping placed before the questionnaire, and a defined sequence of CAPA → Scope → Report → Mock-audit.