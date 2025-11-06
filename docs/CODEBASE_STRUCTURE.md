
# Codebase Structure Guide

## Overview
This document provides a comprehensive guide to the RuR2 codebase structure, conventions, and organization principles.

## Project Architecture

```
R2v3APP/
├── client/                 # React frontend application
├── server/                 # Express.js backend API
├── shared/                 # Shared types and utilities
├── docs/                   # Documentation
├── scripts/                # Build and utility scripts
├── tests/                  # E2E and integration tests
└── migrations/             # Database migrations
```

## Frontend Structure (`client/`)

### Pages Organization
```
src/pages/
├── auth/                   # Authentication pages
│   ├── Login.tsx
│   ├── Register.tsx
│   └── Setup2FA.tsx
├── dashboard/              # Dashboard pages
│   ├── Dashboard.tsx
│   └── ConsultantDashboard.tsx
├── assessment/             # Assessment workflow
│   ├── AssessmentDetail.tsx
│   └── NewAssessment.tsx
└── facility/               # Facility management
    ├── Facilities.tsx
    └── ClientFacilities.tsx
```

### Components Organization
```
src/components/
├── ui/                     # Reusable UI components
├── layout/                 # Layout components
├── facility/               # Facility-specific components
└── analytics/              # Analytics components
```

## Backend Structure (`server/`)

### Routes Organization
```
routes/
├── auth/                   # Authentication routes
│   ├── auth.ts
│   ├── auth2fa.ts
│   └── jwt-auth.ts
├── assessment/             # Assessment management
│   ├── assessments.ts
│   ├── answers.ts
│   └── scoring.ts
├── facility/               # Facility management
│   ├── facilities.ts
│   └── client-facilities.ts
└── admin/                  # Administrative routes
    ├── adminImport.ts
    └── rbac.ts
```

### Services Organization
```
services/
├── authService.ts          # Authentication logic
├── assessmentManagementService.ts
├── licenseService.ts       # License management
├── evidenceService.ts      # Evidence handling
└── observabilityService.ts # Monitoring
```

## Shared Structure (`shared/`)

```
shared/
├── types/                  # TypeScript type definitions
├── constants/              # Application constants
├── flags.ts               # Feature flags
└── schema.ts              # Database schema
```

## Naming Conventions

### Files and Directories
- **PascalCase**: React components (`AssessmentDetail.tsx`)
- **camelCase**: Service files (`authService.ts`)
- **kebab-case**: Route files (`client-facilities.ts`)
- **UPPER_SNAKE_CASE**: Constants (`MAX_FILE_SIZE`)

### Code Conventions
- **Interfaces**: PascalCase with 'I' prefix (`IUserData`)
- **Types**: PascalCase (`UserRole`)
- **Enums**: PascalCase (`AssessmentStatus`)
- **Functions**: camelCase (`validateEmail`)
- **Variables**: camelCase (`currentUser`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

## Design Patterns

### Frontend Patterns
- **Component Composition**: Reusable UI components
- **Custom Hooks**: Shared logic extraction
- **Context API**: Global state management
- **Error Boundaries**: Graceful error handling

### Backend Patterns
- **Service Layer**: Business logic separation
- **Middleware Pattern**: Request processing pipeline
- **Repository Pattern**: Data access abstraction
- **Factory Pattern**: Object creation

## Code Quality Standards

### TypeScript Configuration
- Strict mode enabled
- No implicit any
- Strict null checks
- Path mapping for clean imports

### ESLint Rules
- Consistent formatting
- Import order enforcement
- No unused variables
- Prefer const over let

### Testing Standards
- Unit tests for utilities
- Integration tests for API endpoints
- E2E tests for user workflows
- >90% test coverage target

## Performance Guidelines

### Frontend Optimization
- Lazy loading for routes
- Image optimization
- Bundle splitting
- Caching strategies

### Backend Optimization
- Database query optimization
- Response caching
- Rate limiting
- Memory management

## Security Practices

### Authentication
- JWT with rotation
- 2FA implementation
- Session management
- Device tracking

### Data Protection
- Input validation
- SQL injection prevention
- XSS protection
- CSRF tokens

## Documentation Standards

### Code Documentation
- JSDoc for functions
- Inline comments for complex logic
- README files for modules
- API documentation

### Architecture Documentation
- Decision records
- System diagrams
- Flow charts
- Deployment guides

## Migration Guidelines

### Database Migrations
- Reversible migrations
- Version control
- Testing procedures
- Rollback strategies

### Code Migrations
- Gradual refactoring
- Backward compatibility
- Feature flags
- Progressive deployment

This structure ensures maintainable, scalable, and well-organized code that follows industry best practices.
