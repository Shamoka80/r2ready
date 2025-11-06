# RuR2 - R2v3 Certification Platform

A comprehensive web application for R2v3 (Responsible Recycling) certification management, built with React, Express, and PostgreSQL.

## Current Status: Phase 1 - Industry-Standard User Journey (100% Complete)

✅ **PHASE 1 COMPLETE** - Industry-aligned user journey implemented:
- Email-first registration with verification
- Business vs Consultant account type selection  
- Perpetual licensing with Stripe integration
- Comprehensive onboarding wizard (OnboardingV2)
- Setup gates enforcing sequential flow
- Assessment activation as final gate
- Role-based dashboard access

**User Journey**: Registration → Email Verification → Account Type Selection → Pricing → Payment → Onboarding → Assessment Dashboard

Ready for Phase 2: Assessment & REC Mapping Integration

## Tech Stack

### Frontend
- React 18 + Vite + TypeScript
- React Router DOM for navigation
- Tailwind CSS with custom RUR2 brand theme
- Lucide React for icons
- shadcn/ui components

### Backend
- Express.js + TypeScript
- Zod for validation
- ts-node + nodemon for development

### Database
- Prisma ORM (schema placeholder)
- PostgreSQL datasource configuration

## Development Setup

### Prerequisites
- Node.js 20+
- npm

### Installation

```bash
npm install