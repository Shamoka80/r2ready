
# Test Data Generation & Environment Strategy

## Overview
This document establishes comprehensive policies and procedures for test data generation, PII anonymization, and test environment management across all environments.

## Test Data Generation Policy

### Synthetic Data Generation
- **Primary Tool**: Faker.js for all synthetic data generation
- **Data Quality**: Realistic but completely synthetic data that mirrors production patterns
- **No Real PII**: Zero tolerance for real personally identifiable information in non-production environments

### Test User Personas

#### 1. Business Facility Manager
- **Name**: Sarah Chen (Synthetic)
- **Email**: sarah.manager@greentech-recycling-test.com
- **Company**: GreenTech Recycling Solutions (Test)
- **Role**: Facility Manager
- **Permissions**: Full facility management, assessment creation, evidence upload
- **Use Case**: Primary business user testing

#### 2. Compliance Consultant
- **Name**: Michael Rodriguez (Synthetic)
- **Email**: michael.consultant@ecocompliance-test.consulting
- **Company**: EcoCompliance Advisory Group (Test)
- **Role**: Lead Consultant
- **Permissions**: Multi-client access, advanced analytics, template management
- **Use Case**: Consultant workflow testing

#### 3. System Administrator
- **Name**: Alex Johnson (Synthetic)
- **Email**: admin@system-test.local
- **Company**: System Administration (Test)
- **Role**: Super Admin
- **Permissions**: Full system access, user management, RBAC configuration
- **Use Case**: Administrative function testing

#### 4. Read-Only Auditor
- **Name**: Jordan Kim (Synthetic)
- **Email**: auditor@compliance-test.org
- **Company**: External Audit Firm (Test)
- **Role**: External Auditor
- **Permissions**: Read-only access, report generation
- **Use Case**: Audit workflow testing

#### 5. Multi-Facility Manager
- **Name**: Taylor Brooks (Synthetic)
- **Email**: taylor.multi@enterprise-test.com
- **Company**: Enterprise Recycling Corp (Test)
- **Role**: Regional Manager
- **Permissions**: Multiple facility oversight, aggregate reporting
- **Use Case**: Enterprise multi-facility testing

## PII Anonymization Procedures

### Data Sanitization Requirements

#### Email Addresses
- **Real**: user@company.com
- **Sanitized**: faker.hash(email) + "@test-domain.local"
- **Method**: SHA-256 hash with test domain suffix

#### Names
- **Real**: John Smith
- **Sanitized**: Faker.name.fullName()
- **Method**: Complete replacement with Faker-generated names

#### Phone Numbers
- **Real**: +1-555-123-4567
- **Sanitized**: Faker.phone.number('555-###-####')
- **Method**: Faker phone with 555 prefix (non-routable)

#### Addresses
- **Real**: 123 Main St, City, State
- **Sanitized**: Faker.address.streetAddress(), Faker.address.city(), etc.
- **Method**: Complete Faker address generation

#### SSN/Tax IDs
- **Real**: 123-45-6789
- **Sanitized**: 000-00-#### (randomized last 4)
- **Method**: Test prefix with random suffix

#### Payment Data
- **Real**: Credit card numbers, bank accounts
- **Sanitized**: Stripe test card numbers (4242424242424242)
- **Method**: Standard test payment data only

### Sanitization Tools
- **Primary**: scripts/sanitize-db-dump.ts
- **Backup**: Manual verification checklist
- **Validation**: Automated PII detection scans

## Test Data Lifecycle Management

### Data Creation
- **Source**: Faker.js synthetic generation
- **Timing**: On-demand via setup scripts
- **Isolation**: Separate tenant IDs for test data
- **Consistency**: Deterministic seed for reproducible tests

### Data Retention
- **Development**: Data persists until manual cleanup
- **Testing**: Automatic cleanup after 24 hours
- **Staging**: Weekly cleanup cycles
- **CI/CD**: Immediate cleanup after test completion

### Teardown Policy
- **Automatic Cleanup**: 24-hour retention maximum
- **Manual Cleanup**: scripts/cleanup-test-data.ts
- **Verification**: No test data remains in production
- **Audit**: Cleanup logs maintained for compliance

### Data Isolation
- **Tenant Separation**: Test tenant IDs (test-tenant-*)
- **Database Schemas**: Separate test schemas where possible
- **File Storage**: Isolated test buckets/containers
- **API Keys**: Dedicated test API keys only

## Environment Strategy

### Environment Definitions

#### Development Environment
- **Purpose**: Local development and feature testing
- **Data**: Synthetic test data only
- **Refresh**: Manual refresh as needed
- **Access**: Developer workstations only

#### Staging Environment
- **Purpose**: Pre-production testing and validation
- **Data**: Production-like synthetic data
- **Refresh**: Weekly automated refresh
- **Access**: QA team and stakeholders

#### Production Environment
- **Purpose**: Live customer data and operations
- **Data**: Real customer data (anonymized in exports)
- **Refresh**: Live data only
- **Access**: Strictly controlled production access

### Environment Promotion Workflow
1. **Development → Staging**: Code promotion with synthetic data refresh
2. **Staging → Production**: Validated code deployment with production data
3. **Rollback**: Immediate rollback capability for all environments

## Seed Data Scripts

### Primary Setup Script
- **Location**: server/tools/setup-test-accounts.ts
- **Purpose**: Create complete test account ecosystem
- **Usage**: `npx tsx server/tools/setup-test-accounts.ts`
- **Output**: 5 test personas with complete data

### Cleanup Script
- **Location**: scripts/cleanup-test-data.ts
- **Purpose**: Remove all test data safely
- **Usage**: `npx tsx scripts/cleanup-test-data.ts`
- **Safety**: Production data protection

### Sanitization Script
- **Location**: scripts/sanitize-db-dump.ts
- **Purpose**: Sanitize production data dumps
- **Usage**: `npx tsx scripts/sanitize-db-dump.ts <dump-file>`
- **Output**: Sanitized dump suitable for non-production use

## Faker.js Integration

### Installation
```bash
npm install --save-dev @faker-js/faker
```

### Usage Patterns
```typescript
import { faker } from '@faker-js/faker';

// Deterministic seed for reproducible data
faker.seed(12345);

// User generation
const testUser = {
  name: faker.name.fullName(),
  email: faker.internet.email(),
  company: faker.company.name(),
  phone: faker.phone.number('555-###-####')
};
```

### Data Categories
- **Personal**: Names, emails, phones (synthetic only)
- **Company**: Company names, addresses, industry types
- **Assessment**: Facility names, equipment types, processes
- **Compliance**: Certification numbers, audit dates, findings

## Security Considerations

### Data Protection
- **Encryption**: All test data encrypted at rest
- **Access Control**: Role-based access to test environments
- **Monitoring**: Test data access logging and monitoring
- **Compliance**: GDPR/CCPA compliance for synthetic data

### Production Isolation
- **Network Separation**: Test environments isolated from production
- **Database Isolation**: Separate database instances
- **API Isolation**: Different API endpoints and keys
- **Monitoring Separation**: Separate observability stacks

## Quality Assurance

### Data Quality Metrics
- **Completeness**: All required fields populated
- **Consistency**: Data relationships maintained
- **Realism**: Data patterns match production patterns
- **Volume**: Sufficient data volume for performance testing

### Validation Procedures
- **Automated Tests**: Data quality validation in CI/CD
- **Manual Review**: Monthly data quality review
- **Performance Impact**: Data volume performance testing
- **Compliance Check**: Regular PII detection scans

## Compliance & Governance

### Data Governance
- **Data Owner**: QA Lead
- **Data Steward**: Development Team
- **Compliance Officer**: Security Lead
- **Review Cycle**: Quarterly policy review

### Audit Requirements
- **Data Lineage**: Track test data sources and usage
- **Access Logs**: Maintain test data access logs
- **Compliance Reports**: Quarterly compliance reporting
- **Incident Response**: Test data breach response procedures

## Implementation Checklist

### Phase 5.1: Documentation & Policies ✅
- [x] Test data policy documentation
- [x] PII anonymization procedures
- [x] Environment strategy definition
- [x] Test user personas creation

### Phase 5.2: Scripts & Automation
- [ ] Faker.js installation and configuration
- [ ] Test data sanitization script
- [ ] Test data cleanup script
- [ ] Automated test account setup

### Phase 5.3: Environment Setup
- [ ] Development environment test data
- [ ] Staging environment configuration
- [ ] Production data protection validation
- [ ] Environment promotion workflows

### Phase 5.4: Quality & Compliance
- [ ] Data quality validation
- [ ] PII detection automation
- [ ] Compliance audit preparation
- [ ] Performance testing with synthetic data

## Success Metrics

### Completion Targets
- **Documentation**: 100% complete
- **Scripts**: 95% functional
- **Environment Setup**: 90% automated
- **Compliance**: 100% PII-free test environments

### Performance Indicators
- **Setup Time**: < 5 minutes for complete test environment
- **Data Quality**: > 95% realistic data patterns
- **Security**: 0 PII incidents in test environments
- **Maintenance**: < 1 hour weekly maintenance

---

**Document Version**: 1.0  
**Last Updated**: December 22, 2024  
**Next Review**: March 22, 2025  
**Owner**: QA Lead  
**Approved By**: Technical Lead, Security Lead

This policy ensures safe, compliant, and efficient test data management across all environments while maintaining data quality and security standards.
