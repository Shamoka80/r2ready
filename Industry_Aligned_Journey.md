# Industry-Aligned User Journey Specification
## R2v3 Pre-Certification Self-Assessment Platform

**Document Version:** 1.0  
**Last Updated:** January 24, 2025  
**Status:** Authoritative Specification  
**Supersedes:** All previous journey documentation

---

## Executive Summary

This specification defines the complete user journey for the RuR2 platform, aligned with industry best practices from leading certification and compliance SaaS platforms (Vanta, Drata, TrustCloud, ISO assessment tools, and certification body portals).

### Key Industry Standards Applied:
- **Email verification** for security and license management
- **Role-based user paths** diverging immediately post-purchase
- **Dual-dashboard architecture** for Business vs. Consultant workflows
- **Payment-first model** aligned with certification services
- **Multi-tenant architecture** for consultant client management
- **White-label capabilities** for enterprise consultant tier

### Critical Distinction:
This platform serves **two fundamentally different user types**:
- **Business Users**: Self-assessing their own organization for R2v3 certification
- **Consultant Users**: Managing multiple client organizations through their certification journey

These paths **must diverge immediately after license purchase** to provide appropriate onboarding, dashboards, and workflows.

---

## Journey Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIVERSAL PRE-PURCHASE FLOW                   │
│  Landing → Registration → Email Verification → Account Type →   │
│                    Pricing → Payment (Stripe)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
                  ╔════════════════════╗
                  ║  CRITICAL BRANCH   ║
                  ║   LICENSE TYPE     ║
                  ╚════════════════════╝
                           ↓
         ┌─────────────────┴─────────────────┐
         ↓                                   ↓
┌─────────────────────┐           ┌─────────────────────┐
│  BUSINESS LICENSE   │           │ CONSULTANT LICENSE  │
│   (Self-Assessment) │           │  (Multi-Client Mgmt)│
└─────────────────────┘           └─────────────────────┘
         ↓                                   ↓
┌─────────────────────┐           ┌─────────────────────┐
│ Business Onboarding │           │Consultant Onboarding│
│  - Own Company      │           │  - Consultant Profile│
│  - Own Facilities   │           │  - Client Orgs      │
│  - Team Setup       │           │  - Client Facilities│
└─────────────────────┘           └─────────────────────┘
         ↓                                   ↓
┌─────────────────────┐           ┌─────────────────────┐
│ Business Dashboard  │           │Consultant Dashboard │
│  Facility-Centric   │           │  Client Portfolio   │
└─────────────────────┘           └─────────────────────┘
         ↓                                   ↓
┌─────────────────────┐           ┌─────────────────────┐
│   Self-Assessment   │           │  Client Assessment  │
│   Workflow          │           │  Management         │
└─────────────────────┘           └─────────────────────┘
         ↓                                   ↓
         └─────────────────┬─────────────────┘
                           ↓
                ┌──────────────────────┐
                │  SHARED WORKFLOWS    │
                │ REC Mapping → Intake │
                │ → Questions → Scoring│
                │ → Reports → Export   │
                └──────────────────────┘
```

---

## Phase 1: Pre-Authentication Flow (Universal)

All users follow this path regardless of intended license type.

### 1.1 Landing Page
**Route:** `/`

**Purpose:** Value proposition and user acquisition

**Components:**
- Hero section with R2v3 certification value proposition
- Feature showcase (REC mapping, smart assessments, reporting)
- Social proof (testimonials, success metrics)
- Pricing overview link
- Primary CTA: "Get Started" → Registration
- Secondary CTA: "Login" → Existing users

**Industry Standard:** Clean, professional, trust-building design with clear differentiation between business and consultant benefits.

---

### 1.2 Registration
**Route:** `/register`

**Purpose:** Initial account creation with minimal friction

**Required Fields:**
- First Name
- Last Name
- Email Address (becomes username)
- Password (min 8 chars, strength indicator)
- Company/Organization Name
- Agree to Terms of Service

**Optional Fields:**
- Phone Number

**Technical Requirements:**
- Client-side validation
- Password strength meter
- Email format validation
- Duplicate email check (real-time)
- reCAPTCHA or similar anti-bot protection

**Process:**
1. User submits registration form
2. System creates user record (status: `email_pending`)
3. System generates email verification token (6-hour expiry)
4. System sends verification email
5. Redirect to `/verify-email` with instructions

**Database:**
```typescript
users: {
  id: uuid
  email: string (unique)
  password_hash: string
  first_name: string
  last_name: string
  company_name: string
  email_verified: boolean (default: false)
  email_verification_token: string (nullable)
  token_expiry: timestamp (nullable)
  created_at: timestamp
  status: enum ('email_pending', 'payment_pending', 'active')
}
```

**Industry Standard:** Email verification is **mandatory** for security, license management, and preventing spam accounts.

---

### 1.3 Email Verification
**Route:** `/verify-email`

**Purpose:** Confirm email ownership and prevent fraudulent accounts

**User Experience:**
1. User receives email: "Verify your RuR2 account"
2. Email contains verification link with token
3. User clicks link → `/verify-email?token=xxx`
4. System validates token
5. System marks email as verified
6. Redirect to `/account-type-selection`

**Token Validation:**
- Check token exists and matches user
- Check token not expired (6 hours)
- Mark `email_verified = true`
- Clear verification token
- Update status to `payment_pending`

**Resend Functionality:**
- Allow user to request new verification email
- Rate limit: 1 per 2 minutes
- Generate new token, invalidate old

**Industry Standard:** 
- Short token expiry (4-8 hours)
- Clear email with company branding
- Resend option with rate limiting
- Graceful handling of expired tokens

---

### 1.4 Account Type Selection
**Route:** `/account-type-selection`

**Purpose:** Critical decision point determining entire user journey path

**Options:**
1. **Business Account**
   - "I'm evaluating my own company for R2v3 certification"
   - Icon: Building/Factory
   - Features: Self-assessment, facility management, team collaboration
   
2. **Consultant Account**
   - "I'm helping clients achieve R2v3 certification"
   - Icon: Users/Briefcase
   - Features: Multi-client management, white-label reports, client portal

**User Experience:**
- Large, clear cards for each option
- Feature comparison table
- "Not sure?" help text with guidance
- Cannot proceed without selection

**Technical:**
```typescript
// Store selection in session/state
accountType: 'business' | 'consultant'
// This determines pricing tiers shown next
```

**Industry Standard:** Role selection before pricing ensures users see relevant plans and prevents confusion.

---

### 1.5 Pricing & Plan Selection
**Route:** `/pricing` or `/pricing?type=business|consultant`

**Purpose:** License selection based on account type

#### Business Pricing Tiers:
| Tier | Price | Facilities | Seats | Key Features |
|------|-------|------------|-------|--------------|
| **Solo Business** | $399 | 1 | 1-3 | Self-assessment, reports, audit prep |
| **Team Business** | $899 | 2 | Up to 10 | + RBAC, team collaboration, admin panel |
| **Enterprise Multi-Site** | $1,799 | 3+ | Up to 25 | + Cross-facility reporting, priority support |

**Add-ons:**
- Extra facilities: $400 each (+5 seats)
- Extra seats: $45-50 each

#### Consultant Pricing Tiers:
| Tier | Price | Clients | Key Features |
|------|-------|---------|--------------|
| **Independent Consultant** | $599 | Up to 5 | Client management, all toolkit features |
| **Agency Consultant** | $1,199 | Up to 15 | Multi-consultant workflows, advanced client mgmt |
| **Enterprise Agency/CB** | $2,499 | Up to 50 | White-label branding, custom reports, premium dashboards |

**Add-ons:**
- Extra client businesses: $90-100 each

**CTA Buttons:**
- "Get Started" → Proceeds to payment
- No trial option initially (can be added later)

**Technical:**
```typescript
selectedPlan: {
  accountType: 'business' | 'consultant'
  tier: 'solo' | 'team' | 'enterprise' | 'independent' | 'agency' | 'enterprise_consultant'
  price: number
  licenseId: string // For Stripe
}
```

---

### 1.6 Payment Processing
**Route:** `/purchase/:planId` → Stripe Checkout → `/payment-success?session_id=xxx`

**Purpose:** License purchase and account activation

**Process:**
1. User clicks plan CTA
2. System creates Stripe checkout session
3. Session metadata includes:
   ```json
   {
     "user_id": "uuid",
     "account_type": "business|consultant",
     "license_tier": "solo|team|enterprise|...",
     "email": "user@example.com"
   }
   ```
4. Redirect to Stripe Checkout
5. User completes payment
6. Stripe webhook fires: `checkout.session.completed`
7. System processes webhook:
   - Validate payment
   - Create license record
   - Update user status to `active`
   - Send confirmation email
8. User redirected to `/payment-success`
9. From success page → `/onboarding`

**Database:**
```typescript
licenses: {
  id: uuid
  user_id: uuid (FK to users)
  account_type: enum ('business', 'consultant')
  tier: enum ('solo', 'team', 'enterprise', 'independent', 'agency', 'enterprise_consultant')
  stripe_session_id: string
  stripe_customer_id: string
  stripe_subscription_id: string (nullable)
  status: enum ('active', 'suspended', 'cancelled')
  purchased_at: timestamp
  expires_at: timestamp (nullable, for subscriptions)
  features: jsonb // Serialized feature flags
}
```

**Industry Standard:**
- Payment-first for certification services (high-value, specific deliverable)
- Stripe webhook for reliable activation
- Confirmation email with receipt
- Clear next steps in success page

---

## Phase 2: Critical Branch Point

**After successful payment**, the user journey **diverges completely** based on `license.account_type`.

The onboarding wizard, dashboard, and primary workflows are **fundamentally different** for Business vs. Consultant users.

---

## Phase 3: Business User Path

### 3.1 Business Onboarding Wizard
**Route:** `/onboarding`  
**Triggered when:** User has Business license and `setup_status = 'not_started'`

**Purpose:** Set up user's own organization for self-assessment

#### Step 1: Company Profile
**Title:** "Tell us about your organization"

**Fields:**
- Legal Company Name (required)
- DBA / Trade Name (optional)
- Business Entity Type (select: LLC, Corporation, Partnership, Sole Proprietor, Other)
- Tax ID / EIN (optional)
- Primary Contact Name (pre-filled from registration)
- Primary Contact Email (pre-filled)
- Primary Contact Phone
- Headquarters Address (street, city, state/province, ZIP, country)
- Company Website (optional)
- Number of Total Employees (select range: 1-10, 11-50, 51-200, 201-500, 500+)

**Validation:**
- Legal name required
- HQ address required (street, city, state, ZIP)
- Entity type required

**Technical:**
```typescript
// Create organization record
organizations: {
  id: uuid
  user_id: uuid (owner)
  legal_name: string
  dba: string (nullable)
  entity_type: enum
  tax_id: string (nullable)
  hq_address: string
  hq_city: string
  hq_state: string
  hq_zip: string
  hq_country: string (default: 'US')
  website: string (nullable)
  employee_count_range: string
  created_at: timestamp
}
```

---

#### Step 2: Primary Facility Setup
**Title:** "Set up your primary facility"

**Context:** "Every assessment requires at least one facility. Let's start with your main location."

**Fields:**
- Facility Name (required, e.g., "Main Processing Center")
- Same as HQ address? (checkbox)
  - If no: Facility Address (street, city, state, ZIP, country)
- Operating Status (select: Active, Planned, Under Construction)
- Facility Type (select: Processing, Collection, Repair/Refurbish, Recycling, Brokering, Other)
- Is this your primary facility? (checkbox, default: true)

**Multi-Facility Question:**
- "How many total facilities do you plan to certify?" (number input, 1-50)
- "Will you manage multiple sites?" (checkbox)

**Validation:**
- Facility name required
- Address required if not same as HQ
- At least 1 facility planned

**Technical:**
```typescript
facilities: {
  id: uuid
  organization_id: uuid (FK)
  name: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  operating_status: enum ('active', 'planned', 'under_construction', 'inactive')
  facility_type: enum
  is_primary: boolean
  created_at: timestamp
}

// Update user metadata
users: {
  total_facilities_planned: number
  multi_site_operations: boolean
}
```

---

#### Step 3: Team Setup (Optional)
**Title:** "Invite your team (optional)"

**Context:** "Collaborate with team members on your assessment. You can skip this and add them later."

**Fields:**
- Team member email (repeatable)
- Role (select: Manager, User, Read-Only)
- Facility access (if multi-facility)

**Process:**
1. User enters email(s)
2. System sends invitation email
3. Invited user creates account with pre-assigned role
4. Skip button available

**Technical:**
```typescript
team_invitations: {
  id: uuid
  organization_id: uuid
  invited_by_user_id: uuid
  email: string
  role: enum ('admin', 'manager', 'user', 'read_only')
  token: string
  status: enum ('pending', 'accepted', 'expired')
  expires_at: timestamp
  sent_at: timestamp
}
```

---

#### Step 4: Completion
**Title:** "You're all set!"

**Content:**
- Summary of setup:
  - ✓ Organization: [Company Name]
  - ✓ Primary Facility: [Facility Name]
  - ✓ Team: [X members invited / Solo]
- "Ready to start your R2v3 assessment?"
- CTA: "Go to Dashboard"

**Technical:**
- Update `user.setup_status = 'setup_complete'`
- Log onboarding completion event
- Redirect to `/dashboard` (Business Dashboard)

---

### 3.2 Business Dashboard
**Route:** `/dashboard`  
**Access:** Business license holders only

**Purpose:** Facility-centric self-assessment management

**Layout:**

#### Header:
- Welcome message: "Welcome back, [First Name]"
- Quick actions: Start Assessment | Invite Team | View Reports
- Notification bell

#### Primary Widgets:

**1. Assessment Progress Card**
```
┌─────────────────────────────────────┐
│ Your R2v3 Assessment                │
│                                     │
│ [Facility Name]                     │
│ Status: In Progress                 │
│ Completion: 45%                     │
│ [Progress bar]                      │
│                                     │
│ Next: Complete Appendix B questions│
│ [Continue Assessment] button        │
└─────────────────────────────────────┘
```

**2. Readiness Level Indicator**
```
┌─────────────────────────────────────┐
│ Certification Readiness             │
│                                     │
│ Current Score: 72%                  │
│ Status: Significant Gaps            │
│ [Circular gauge]                    │
│                                     │
│ Critical gaps: 3                    │
│ [View Gap Analysis] button          │
└─────────────────────────────────────┘
```

**3. Facilities Overview**
```
┌─────────────────────────────────────┐
│ Your Facilities                     │
│                                     │
│ • Main Processing (Active) ✓        │
│   Assessment: 45% complete          │
│                                     │
│ • Warehouse B (Planned)             │
│   No assessment started             │
│                                     │
│ [+ Add Facility]                    │
└─────────────────────────────────────┘
```

**4. Team Activity** (if team members exist)
```
┌─────────────────────────────────────┐
│ Team Activity                       │
│                                     │
│ • John uploaded evidence (2h ago)   │
│ • Sarah completed Section 3 (1d)    │
│                                     │
│ Team: 3 active members              │
│ [Manage Team] button                │
└─────────────────────────────────────┘
```

#### Sidebar Navigation:
- 📊 Dashboard (current)
- 📝 Assessments
- 🏭 Facilities
- 📄 Reports
- 👥 Team
- ⚙️ Settings
- 💳 Billing

---

### 3.3 Business Assessment Workflow

#### Start Assessment
**Route:** `/assessments/new`

**Process:**
1. Select facility (dropdown of user's facilities)
2. Assessment type:
   - Full R2v3 Assessment (recommended)
   - Targeted Section Review
   - Re-assessment (annual renewal)
3. Assign team members (if applicable)
4. Set target completion date
5. Click "Start Assessment"

**System creates:**
```typescript
assessments: {
  id: uuid
  organization_id: uuid
  facility_id: uuid
  created_by_user_id: uuid
  assessment_type: enum
  status: enum ('draft', 'in_progress', 'submitted', 'completed')
  target_completion_date: date (nullable)
  started_at: timestamp
  completed_at: timestamp (nullable)
}
```

#### Intake & REC Mapping
**Route:** `/assessments/:id/intake`

This is the **data collection phase** specific to the selected facility.

**Sections:**
1. Facility Operations
2. Processing Activities
3. Equipment & Electronics Types
4. Downstream Vendors
5. Data Management
6. Focus Materials
7. Specialty Electronics (PV modules, etc.)

**REC Logic Applied:**
Based on intake responses, system determines applicable appendices:
- Appendix A: Downstream Vendor Management
- Appendix B: Data Destruction & Security
- Appendix C: Repair/Refurbish Operations
- Appendix D: Specialty Electronics (Medical, Telecom)
- Appendix E: Materials Recovery/Focus Materials
- Appendix F: Brokering
- Appendix G: PV Modules

**Technical:**
```typescript
intake_data: {
  id: uuid
  assessment_id: uuid
  facility_id: uuid
  // Facility-specific data
  processing_activities: string[]
  equipment_types: string[]
  electronics_types: string[]
  has_downstream_vendors: boolean
  has_data_bearing_devices: boolean
  has_repair_operations: boolean
  // ... other intake fields
  
  // REC mapping results
  applicable_appendices: string[] // ['A', 'B', 'C']
  rec_codes: string[] // Generated REC codes
  completed_at: timestamp
}
```

---

#### Dynamic Questionnaire
**Route:** `/assessments/:id/questions`

Questions displayed based on REC mapping results.

**Structure:**
- Core Requirements (CR1-CR10) - always included
- Applicable Appendices (A-G) - based on REC mapping

**For each question:**
```typescript
question_responses: {
  id: uuid
  assessment_id: uuid
  question_id: uuid
  response: enum ('yes', 'partial', 'no', 'na')
  evidence_files: string[] // S3/storage URLs
  notes: text
  answered_by_user_id: uuid
  answered_at: timestamp
  points_earned: number
}
```

**UI Features:**
- Progress tracking (% complete per section)
- Evidence upload (drag-drop, multiple files)
- Auto-save every 30 seconds
- Section navigation
- Filter by: All, Unanswered, Flagged

---

#### Scoring & Results
**Route:** `/assessments/:id/results`

**Real-time calculation:**
```typescript
scoring_data: {
  assessment_id: uuid
  total_points_possible: number
  total_points_earned: number
  score_percentage: number
  
  // Category scores
  category_scores: {
    core_requirements: { earned: number, possible: number },
    appendix_a: { earned: number, possible: number },
    // ... per appendix
  }
  
  // Readiness classification
  readiness_level: enum (
    'certification_ready',    // 90-100%
    'minor_gaps',             // 75-89%
    'significant_gaps',       // 60-74%
    'major_work_required'     // <60%
  )
  
  // Gap analysis
  gaps: [
    {
      question_id: uuid,
      severity: enum ('critical', 'important', 'minor'),
      recommendation: text
    }
  ]
}
```

**Dashboard Display:**
- Executive summary card
- Score breakdown by category
- Gap severity visualization
- Action plan with priorities
- Estimated remediation timeline

---

#### Report Generation
**Route:** `/assessments/:id/export`

**Four Report Formats:**

1. **PDF - Audit-Ready Report**
   - Formal compliance report
   - Complete gap analysis
   - Evidence inventory
   - Action plan with timelines
   - Charts and visualizations

2. **Excel - Interactive Workbook**
   - Gap tracking spreadsheet
   - KPI dashboard
   - Question-by-question breakdown
   - Pivot tables for analysis

3. **Word - Executive Summary**
   - Plain-language overview
   - Key findings
   - Recommendations
   - Leadership-focused

4. **Email - Consultation Request**
   - Pre-filled email to consulting@wrekdtech.com
   - Summary metrics
   - Request for expert review

**Technical:**
```typescript
reports: {
  id: uuid
  assessment_id: uuid
  report_type: enum ('pdf', 'excel', 'word', 'email')
  generated_by_user_id: uuid
  file_url: string (S3/storage)
  generated_at: timestamp
  version: number
}
```

**Branding:**
- Business users: Standard RuR2 branding
- Custom logo upload (Enterprise tier)

---

## Phase 4: Consultant User Path

### 4.1 Consultant Onboarding Wizard
**Route:** `/onboarding`  
**Triggered when:** User has Consultant license and `setup_status = 'not_started'`

**Purpose:** Set up consultant profile and first client organization

**Key Difference:** Consultants don't enter their own company details for assessment—they enter **client** organization details.

---

#### Step 1: Consultant Profile Setup
**Title:** "Set up your consultant profile"

**Fields:**
- Consultant/Agency Name (required)
- Business Type (select: Individual, Agency, Certification Body)
- Contact Information:
  - Primary Contact Name (pre-filled)
  - Email (pre-filled)
  - Phone
  - Website
- Business Address (for invoicing)
- Tax ID / Business License (optional)
- Specialization (multi-select: Electronics Recycling, IT Asset Disposition, Medical Equipment, etc.)

**White-Label Branding** (Enterprise tier only):
- Upload logo (for client reports)
- Brand colors (primary, secondary)
- Company tagline

**Validation:**
- Consultant/agency name required
- Contact info required

**Technical:**
```typescript
consultant_profiles: {
  id: uuid
  user_id: uuid (FK)
  agency_name: string
  business_type: enum ('individual', 'agency', 'certification_body')
  phone: string
  website: string (nullable)
  business_address: string
  tax_id: string (nullable)
  specializations: string[]
  
  // White-label settings (Enterprise tier)
  logo_url: string (nullable)
  brand_color_primary: string (nullable)
  brand_color_secondary: string (nullable)
  tagline: string (nullable)
  
  created_at: timestamp
}
```

---

#### Step 2: First Client Organization
**Title:** "Add your first client"

**Context:** "Let's set up your first client organization. You can add more clients later."

**Fields:**
- Client Company Name (required)
- Primary Contact at Client:
  - Name (required)
  - Email (required)
  - Phone
- Client Business Type (select: LLC, Corporation, etc.)
- Client Headquarters Address
- Engagement Details:
  - Project Name/ID (optional)
  - Start Date
  - Target Certification Date

**Validation:**
- Client company name required
- Primary contact name and email required
- HQ address required

**Technical:**
```typescript
client_organizations: {
  id: uuid
  consultant_profile_id: uuid (FK)
  legal_name: string
  primary_contact_name: string
  primary_contact_email: string
  primary_contact_phone: string (nullable)
  entity_type: enum
  hq_address: string
  hq_city: string
  hq_state: string
  hq_zip: string
  hq_country: string
  
  // Engagement tracking
  project_name: string (nullable)
  engagement_start_date: date
  target_certification_date: date (nullable)
  status: enum ('active', 'on_hold', 'completed', 'archived')
  
  created_at: timestamp
}
```

---

#### Step 3: Client Facility Setup
**Title:** "Add client facility"

**Context:** "Set up the first facility for [Client Name]."

**Fields:**
- Facility Name (required)
- Same as client HQ address? (checkbox)
  - If no: Facility Address
- Operating Status
- Facility Type
- Is primary facility? (checkbox, default: true)
- How many facilities does this client have? (number, 1-50)

**Validation:**
- Same as Business path, but tied to client org

**Technical:**
```typescript
client_facilities: {
  id: uuid
  client_organization_id: uuid (FK)
  consultant_profile_id: uuid (FK) // For quick filtering
  name: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  operating_status: enum
  facility_type: enum
  is_primary: boolean
  created_at: timestamp
}
```

---

#### Step 4: Collaboration Setup
**Title:** "Client collaboration settings"

**Options:**
1. **Client Portal Access** (optional)
   - "Give [Client Contact] access to view assessment progress?"
   - If yes: Send invitation email to client
   - Client gets read-only dashboard view

2. **Team Assignment** (optional)
   - "Assign team members from your agency to this project?"
   - Add consultant team member emails
   - Assign roles

**Technical:**
```typescript
client_portal_invitations: {
  id: uuid
  client_organization_id: uuid
  invited_email: string
  access_level: enum ('view_only', 'comment', 'collaborate')
  token: string
  status: enum ('pending', 'accepted', 'expired')
  expires_at: timestamp
}

consultant_team_assignments: {
  id: uuid
  consultant_profile_id: uuid
  client_organization_id: uuid
  user_id: uuid (team member)
  role: enum ('lead_consultant', 'associate', 'viewer')
}
```

---

#### Step 5: Completion
**Title:** "Client setup complete!"

**Summary:**
- ✓ Your Profile: [Agency Name]
- ✓ First Client: [Client Name]
- ✓ Client Facility: [Facility Name]
- ✓ Collaboration: [Status]

**CTA:** "Go to Dashboard"

**Technical:**
- Update `user.setup_status = 'setup_complete'`
- Redirect to `/consultant-dashboard`

---

### 4.2 Consultant Dashboard
**Route:** `/consultant-dashboard`  
**Access:** Consultant license holders only

**Purpose:** Multi-client portfolio management

**Layout:**

#### Header:
- Welcome: "Welcome back, [Agency Name]"
- Quick actions: Add Client | Start Assessment | Generate Report
- Client switcher dropdown (if multiple clients)

#### Primary Widgets:

**1. Client Portfolio Overview**
```
┌─────────────────────────────────────┐
│ Active Clients                      │
│                                     │
│ 📊 Total Clients: 5 of 15 (Agency)  │
│ ✅ Active Assessments: 8            │
│ ⏱️ In Progress: 3                   │
│ ✓ Completed: 5                      │
│                                     │
│ [+ Add New Client]                  │
└─────────────────────────────────────┘
```

**2. Client List Table**
```
┌─────────────────────────────────────────────────────────────┐
│ Client Name        │ Facilities │ Assessment │ Progress     │
├────────────────────┼────────────┼────────────┼──────────────┤
│ ABC Recycling      │ 2          │ In Progress│ ████░ 65%    │
│ XYZ Electronics    │ 1          │ Completed  │ █████ 100%   │
│ Tech Disposal Inc  │ 3          │ In Progress│ ██░░░ 40%    │
└─────────────────────────────────────────────────────────────┘
[View] [Manage] [Report] buttons per row
```

**3. Upcoming Deadlines**
```
┌─────────────────────────────────────┐
│ Project Deadlines                   │
│                                     │
│ • ABC Recycling - Assessment Due    │
│   Mar 15, 2025 (21 days)            │
│                                     │
│ • Tech Disposal - Facility 2 Audit  │
│   Apr 1, 2025 (38 days)             │
│                                     │
│ [View All Projects]                 │
└─────────────────────────────────────┘
```

**4. Revenue/Billing Summary** (if billing module enabled)
```
┌─────────────────────────────────────┐
│ Billing Overview                    │
│                                     │
│ This Month: $4,200                  │
│ Outstanding: $1,500                 │
│ Paid: $2,700                        │
│                                     │
│ [Manage Billing]                    │
└─────────────────────────────────────┘
```

#### Sidebar Navigation:
- 📊 Dashboard (current)
- 🏢 Clients
- 📝 Assessments
- 📄 Reports
- 👥 Team
- 🎨 Branding (Enterprise)
- ⚙️ Settings
- 💳 Billing

---

### 4.3 Consultant Assessment Workflow

**Key Difference:** Consultant selects **which client** and **which client facility** before starting assessment.

#### Start Assessment
**Route:** `/assessments/new`

**Process:**
1. **Select Client** (dropdown of consultant's clients)
2. **Select Facility** (dropdown of selected client's facilities)
3. Assessment type (same options as Business)
4. Assign consultant team members
5. Client involvement (read-only access, collaboration)
6. Set target completion date
7. Click "Start Assessment"

**System creates:**
```typescript
assessments: {
  id: uuid
  client_organization_id: uuid (key difference!)
  facility_id: uuid
  consultant_profile_id: uuid
  created_by_user_id: uuid
  assessment_type: enum
  client_access_level: enum ('none', 'view_only', 'collaborate')
  status: enum
  target_completion_date: date
  started_at: timestamp
}
```

---

#### Intake & REC Mapping
**Route:** `/assessments/:id/intake`

**Same process as Business**, but data is about **client's facility**, not consultant's.

**Context Banner:**
```
┌─────────────────────────────────────────────────────────────┐
│ Client: ABC Recycling Corp | Facility: Main Processing      │
│ Assessment for: R2v3 Full Certification                     │
└─────────────────────────────────────────────────────────────┘
```

All intake data saved to `client_facilities` and `intake_data` tables.

---

#### Questionnaire, Scoring, Results
**Same as Business path**, with these modifications:

**Context Awareness:**
- All UI shows client name/facility
- Activity logs track consultant user actions
- Client portal users (if enabled) can view progress in real-time

**Collaboration Features:**
- Consultant team members can work concurrently
- Client contact can add comments (if collaboration enabled)
- Internal notes (consultant-only, not visible to client)

---

#### Report Generation - White Label
**Route:** `/assessments/:id/export`

**Same four formats (PDF, Excel, Word, Email)**, but with key differences:

**Branding (Enterprise Tier):**
- Consultant logo on all reports (not RuR2 logo)
- Consultant brand colors
- Custom footer: "[Agency Name] | Prepared for [Client Name]"
- Consultant tagline/contact info

**Report Recipient:**
- Business: Reports for self
- Consultant: Reports for client delivery

**Technical:**
```typescript
reports: {
  id: uuid
  assessment_id: uuid
  client_organization_id: uuid (consultant path)
  consultant_profile_id: uuid
  report_type: enum
  white_label: boolean (Enterprise tier)
  branding_settings: jsonb // Logo URL, colors, etc.
  file_url: string
  shared_with_client: boolean
  generated_at: timestamp
}
```

---

## Phase 5: Shared Assessment Workflow

Once in the assessment phase, both Business and Consultant users follow the same **question structure**, but with contextual differences:

| Feature | Business User | Consultant User |
|---------|--------------|-----------------|
| **Data Context** | Own organization/facility | Client organization/facility |
| **Report Branding** | Standard RuR2 | White-label (Enterprise) |
| **Team Collaboration** | Internal team only | Consultant team + optional client |
| **Evidence Storage** | Own account storage | Client project folder |
| **Report Recipient** | Self/team | Client delivery |

**Common Elements:**
- REC mapping logic
- CR1-CR10 + Appendices A-G
- Question types (Yes/Partial/No/N/A)
- Evidence upload
- Scoring algorithm
- Gap analysis
- Export formats

---

## Phase 6: Dashboard Differentiation

### Business Dashboard Features:
- **Primary Focus:** Own facilities and certification readiness
- **Widgets:** Assessment progress, readiness score, team activity
- **Actions:** Start assessment, add facility, invite team
- **Navigation:** Assessments → Facilities → Team → Reports

### Consultant Dashboard Features:
- **Primary Focus:** Client portfolio management
- **Widgets:** Client list, project deadlines, billing summary
- **Actions:** Add client, start client assessment, generate client report
- **Navigation:** Clients → Assessments → Reports → Team → Branding
- **Client Switcher:** Dropdown to navigate between client contexts

**Visual Distinction:**
- Business: Blue/teal color scheme, factory/building icons
- Consultant: Purple/orange color scheme, briefcase/users icons

---

## Technical Requirements

### Database Schema Updates

#### New Tables:
```typescript
// Consultant-specific
consultant_profiles
client_organizations
client_facilities
client_portal_invitations
consultant_team_assignments

// Email verification
email_verifications: {
  id: uuid
  user_id: uuid
  token: string
  expires_at: timestamp
  verified_at: timestamp (nullable)
}

// License management (updated)
licenses: {
  // ... existing fields
  account_type: enum ('business', 'consultant') // NEW
  max_facilities: number // Business tier limits
  max_clients: number // Consultant tier limits
  white_label_enabled: boolean // Enterprise consultant
}
```

#### Modified Tables:
```typescript
users: {
  // ... existing fields
  email_verified: boolean // NEW
  account_type: enum ('business', 'consultant') // NEW
  setup_status: enum ('email_pending', 'payment_pending', 'setup_incomplete', 'setup_complete')
}

assessments: {
  // ... existing fields
  client_organization_id: uuid (nullable) // For consultant assessments
  consultant_profile_id: uuid (nullable) // For consultant assessments
}
```

---

### Routing Structure

```
Public Routes:
  / - Landing
  /about - About page
  /pricing - Pricing (shows both tiers)
  /register - Registration
  /verify-email - Email verification
  /login - Login

Authenticated (Pre-Setup):
  /account-type-selection - Choose Business/Consultant
  /payment-success - Post-payment landing

Onboarding (Branched):
  /onboarding - Wizard (different for Business vs Consultant)

Business Routes (requires business license):
  /dashboard - Business dashboard
  /facilities - Facility management
  /facilities/:id - Facility detail
  /assessments/new - Start self-assessment
  /assessments/:id/* - Assessment workflow
  /team - Team management
  /reports - Report library

Consultant Routes (requires consultant license):
  /consultant-dashboard - Consultant dashboard
  /clients - Client list
  /clients/:id - Client detail
  /clients/:id/facilities - Client facilities
  /clients/:clientId/assessments/new - Start client assessment
  /assessments/:id/* - Assessment workflow (client context)
  /branding - White-label settings (Enterprise)
  /team - Consultant team management

Shared Routes:
  /settings - Account settings
  /billing - Subscription/billing
  /help - Help center
```

---

### Access Control Middleware

```typescript
// Route guards
requireEmailVerified()
requireLicense()
requireBusinessLicense()
requireConsultantLicense()
requireEnterpriseConsultant() // For white-label features

// Resource ownership checks
canAccessAssessment(userId, assessmentId)
canAccessClient(consultantId, clientId)
canAccessFacility(userId, facilityId)
```

---

### API Endpoints

#### Email Verification:
- `POST /api/auth/send-verification-email`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`

#### Account Type:
- `POST /api/users/set-account-type`

#### Business-specific:
- `POST /api/organizations` - Create own org
- `GET /api/organizations/:id`
- `POST /api/facilities` - Create own facility
- `GET /api/facilities`
- `POST /api/assessments` - Start self-assessment

#### Consultant-specific:
- `POST /api/consultant-profiles`
- `GET /api/consultant-profiles/:id`
- `POST /api/clients` - Create client org
- `GET /api/clients`
- `GET /api/clients/:id`
- `POST /api/clients/:id/facilities` - Create client facility
- `POST /api/clients/:clientId/assessments` - Start client assessment
- `POST /api/branding` - Update white-label settings (Enterprise)

#### Shared:
- `GET /api/assessments/:id`
- `POST /api/assessments/:id/intake`
- `POST /api/assessments/:id/responses`
- `GET /api/assessments/:id/scoring`
- `POST /api/assessments/:id/reports`

---

## Gap Analysis: Current vs. Proposed

| Feature | Current Implementation | Proposed Industry Standard | Priority |
|---------|------------------------|----------------------------|----------|
| **Email Verification** | ❌ Not implemented | ✅ Mandatory after registration | **CRITICAL** |
| **Account Type Selection** | ⚠️ Partial (at pricing) | ✅ Dedicated step post-verification | **HIGH** |
| **Post-Purchase Branching** | ❌ Missing | ✅ Separate onboarding paths | **CRITICAL** |
| **Consultant Profile Setup** | ❌ Not implemented | ✅ Agency/consultant metadata | **CRITICAL** |
| **Client Organization Management** | ❌ Not implemented | ✅ Multi-client CRUD | **CRITICAL** |
| **Client Facilities** | ❌ Not implemented | ✅ Client-scoped facility management | **CRITICAL** |
| **Dashboard Differentiation** | ⚠️ Single dashboard type | ✅ Business vs Consultant dashboards | **HIGH** |
| **White-Label Branding** | ❌ Not implemented | ✅ Enterprise consultant feature | **MEDIUM** |
| **Client Portal Access** | ❌ Not implemented | ✅ Read-only client collaboration | **MEDIUM** |
| **Assessment Context** | ⚠️ Assumes self-assessment | ✅ Business=self, Consultant=client | **CRITICAL** |
| **Report Branding** | ⚠️ Standard only | ✅ White-label for consultants | **MEDIUM** |

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
**Priority: CRITICAL**

1. **Email Verification System**
   - Add `email_verified` column to users
   - Create `email_verifications` table
   - Build email sending service
   - Create verification UI pages
   - Add middleware to check verification

2. **Account Type Infrastructure**
   - Add `account_type` to users and licenses
   - Create `/account-type-selection` page
   - Update registration flow to include verification
   - Modify payment flow to store account type

**Deliverable:** New users must verify email and select account type before payment.

---

### Phase 2: Consultant Foundation (Week 3-4)
**Priority: CRITICAL**

1. **Consultant Data Model**
   - Create `consultant_profiles` table
   - Create `client_organizations` table
   - Create `client_facilities` table
   - Update `assessments` to support client context

2. **Consultant Onboarding Wizard**
   - Build consultant-specific onboarding steps
   - Client org creation flow
   - Client facility setup
   - Different from business onboarding

**Deliverable:** Consultant users can onboard and create first client.

---

### Phase 3: Dashboard Divergence (Week 5)
**Priority: HIGH**

1. **Business Dashboard** (refine existing)
   - Facility-centric widgets
   - Self-assessment focus
   - Team activity

2. **Consultant Dashboard** (new)
   - Client portfolio view
   - Multi-client table
   - Project deadlines
   - Client switcher navigation

**Deliverable:** Different dashboards for Business vs Consultant users.

---

### Phase 4: Assessment Context (Week 6)
**Priority: CRITICAL**

1. **Branched Assessment Creation**
   - Business: Select own facility
   - Consultant: Select client → facility
   - Update assessment metadata

2. **Context-Aware UI**
   - Display client name in consultant assessments
   - Separate storage paths for client data
   - Access control based on user type

**Deliverable:** Consultants can create and manage client assessments.

---

### Phase 5: Client Management (Week 7-8)
**Priority: HIGH**

1. **Client CRUD**
   - Add/edit/archive clients
   - Client detail pages
   - Client facility management

2. **Multi-Client Navigation**
   - Client list view
   - Client switcher
   - Project management per client

**Deliverable:** Full consultant multi-client management.

---

### Phase 6: White-Label & Advanced Features (Week 9-10)
**Priority: MEDIUM**

1. **White-Label Branding** (Enterprise Consultant)
   - Logo upload
   - Brand color customization
   - Report template customization

2. **Client Portal Access**
   - Read-only client user accounts
   - Client invitation system
   - Shared progress view

**Deliverable:** Enterprise consultants can white-label reports and share with clients.

---

### Phase 7: Testing & Refinement (Week 11-12)
**Priority: HIGH**

1. **E2E Testing**
   - Business user journey test
   - Consultant user journey test
   - Assessment creation both paths
   - Report generation both paths

2. **Data Migration** (for existing users)
   - Backfill `account_type` for existing users
   - Convert existing assessments to business model
   - Email verification for existing accounts (grace period)

**Deliverable:** Production-ready dual-path system.

---

## Success Metrics

### User Onboarding:
- Email verification rate: >95%
- Account type selection completion: 100%
- Onboarding wizard completion: >85%
- Time to first assessment: <30 minutes

### User Experience:
- Business users never see consultant features (0% confusion)
- Consultant users can manage multiple clients (avg 3-5 clients per agency)
- White-label adoption rate: >60% of enterprise consultants

### Technical:
- Zero cross-contamination (business user accessing consultant routes)
- Access control enforcement: 100%
- Email delivery success rate: >98%

---

## Conclusion

This industry-aligned journey specification provides a **complete, dual-path user experience** that properly serves both Business and Consultant user types.

**Key Improvements:**
1. ✅ Email verification adds security and professionalism
2. ✅ Clear post-purchase branching eliminates confusion
3. ✅ Separate onboarding paths collect appropriate data
4. ✅ Distinct dashboards serve different use cases
5. ✅ Assessment context properly scoped (self vs. client)
6. ✅ White-label capabilities enable consultant branding
7. ✅ Multi-client management supports consultant business model

**Implementation Priority:**
Focus on **Phases 1-4** first (Weeks 1-6) to establish the foundational dual-path architecture. This creates the minimum viable differentiation between Business and Consultant users.

Phases 5-7 add polish and advanced features that enhance the consultant experience but aren't blocking for core functionality.

---

**Document Status:** Ready for implementation  
**Next Steps:** Review with stakeholders → Create implementation task list → Begin Phase 1 development
