
# Data Retention and Deletion Policy

## Overview
This policy establishes mandatory data retention schedules and deletion procedures for the RUR2 application to ensure compliance with legal requirements, business needs, and data protection regulations.

## Retention Framework

### Legal Basis for Retention
1. **Regulatory Compliance**: Environmental regulations (R2v3 certification)
2. **Legal Requirements**: Audit trails, financial records
3. **Business Necessity**: Operational continuity, customer service
4. **Consent-Based**: User-provided data with explicit consent

### Data Lifecycle Stages
1. **Active Use**: Data actively processed for business operations
2. **Archive**: Data retained for compliance but not actively used
3. **Purge Ready**: Data eligible for deletion per retention schedule
4. **Deleted**: Data permanently removed from all systems

## Retention Schedules by Data Type

### 1. User Account Data

#### User Profile Information
- **Data**: Name, email, role, preferences
- **Retention Period**: Account lifetime + 30 days
- **Legal Basis**: Contract performance
- **Deletion Trigger**: Account deletion request + grace period

#### Authentication Data
- **Data**: Password hashes, 2FA secrets, session tokens
- **Retention Period**: Account lifetime + 7 days
- **Legal Basis**: Security necessity
- **Deletion Trigger**: Account deletion or credential reset

#### User Activity Logs
- **Data**: Login history, action logs, access patterns
- **Retention Period**: 2 years
- **Legal Basis**: Security monitoring
- **Archive After**: 90 days of inactivity

```sql
-- User data retention rules
UPDATE users SET 
  deletion_scheduled_at = NOW() + INTERVAL '30 days'
WHERE 
  account_deleted_at IS NOT NULL 
  AND deletion_scheduled_at IS NULL;
```

### 2. Assessment Data

#### Assessment Records
- **Data**: Questions, answers, scores, completion status
- **Retention Period**: Configurable by tenant (default 5 years)
- **Legal Basis**: Business necessity, regulatory compliance
- **Archive After**: Assessment completion + 1 year

#### Assessment Evidence
- **Data**: Uploaded documents, photos, certificates
- **Retention Period**: Same as assessment + 1 year
- **Legal Basis**: Compliance evidence
- **Storage**: Archive to cold storage after 2 years

#### Consultant Reports
- **Data**: Findings, recommendations, compliance assessments
- **Retention Period**: 7 years
- **Legal Basis**: Professional liability, regulatory compliance
- **Archive After**: 2 years

```typescript
interface RetentionPolicy {
  dataType: string;
  retentionPeriod: number; // months
  archivePeriod: number; // months
  tenantConfigurable: boolean;
  legalBasis: string;
}

const assessmentRetentionPolicies: RetentionPolicy[] = [
  {
    dataType: 'assessment_records',
    retentionPeriod: 60, // 5 years default
    archivePeriod: 12, // 1 year
    tenantConfigurable: true,
    legalBasis: 'Business necessity'
  },
  {
    dataType: 'consultant_reports',
    retentionPeriod: 84, // 7 years
    archivePeriod: 24, // 2 years
    tenantConfigurable: false,
    legalBasis: 'Professional liability'
  }
];
```

### 3. Facility and Organization Data

#### Facility Information
- **Data**: Facility details, contacts, operational data
- **Retention Period**: Active relationship + 5 years
- **Legal Basis**: Business relationship, compliance
- **Archive After**: Relationship termination + 1 year

#### Certification Records
- **Data**: R2v3 certificates, audit reports, compliance status
- **Retention Period**: 10 years
- **Legal Basis**: Regulatory requirement
- **Archive After**: Certificate expiration + 3 years

### 4. Audit and Security Data

#### Security Audit Logs
- **Data**: Login attempts, access violations, security events
- **Retention Period**: 7 years
- **Legal Basis**: Security monitoring, incident investigation
- **Archive After**: 1 year

#### System Audit Trails
- **Data**: Data changes, user actions, system events
- **Retention Period**: 7 years
- **Legal Basis**: Compliance auditing
- **Archive After**: 2 years

#### Financial Records
- **Data**: Payment transactions, license purchases, billing
- **Retention Period**: 7 years
- **Legal Basis**: Tax compliance, financial auditing
- **Archive After**: 3 years

### 5. Backup and Archive Data

#### Database Backups
- **Retention Period**: 90 days for operational backups
- **Archive Backups**: 7 years for compliance backups
- **Deletion Process**: Secure overwrite of backup media

#### File System Backups
- **Retention Period**: 90 days
- **Compliance Copies**: Subject to data type retention rules
- **Encryption**: All backups encrypted with current standards

## Tenant-Configurable Retention

### Configurable Data Types
Tenants can configure retention periods for:
1. **Assessment Data**: 3-10 years (default 5)
2. **Evidence Files**: Same as assessment or longer
3. **Facility Records**: 3-10 years (default 5)
4. **User Activity Logs**: 1-3 years (default 2)

### Configuration Constraints
```typescript
interface TenantRetentionConfig {
  tenantId: string;
  dataType: string;
  retentionMonths: number;
  minRetentionMonths: number;
  maxRetentionMonths: number;
  lastUpdated: Date;
  updatedBy: string;
}

const retentionConstraints = {
  assessment_data: { min: 36, max: 120, default: 60 }, // 3-10 years
  evidence_files: { min: 36, max: 120, default: 60 },
  facility_records: { min: 36, max: 120, default: 60 },
  user_activity: { min: 12, max: 36, default: 24 } // 1-3 years
};
```

### Configuration Management
1. **Tenant Admin Access**: Only tenant administrators can modify
2. **Audit Trail**: All changes logged with justification
3. **Compliance Check**: Validate against minimum legal requirements
4. **Notification**: Notify affected users of retention changes

## Deletion Procedures

### Automated Deletion Process

#### Daily Cleanup Jobs
```sql
-- Daily deletion job for expired data
WITH expired_data AS (
  SELECT table_name, record_id, deletion_date
  FROM data_retention_schedule 
  WHERE deletion_date <= CURRENT_DATE
  AND status = 'pending_deletion'
)
-- Process deletions by priority
```

#### Soft Delete Phase (30 days)
1. **Mark for Deletion**: Set deletion flag, maintain data
2. **Access Restriction**: Prevent normal application access
3. **Recovery Window**: Allow authorized recovery if needed
4. **Audit Logging**: Log all deletion activities

#### Hard Delete Phase (After 30 days)
1. **Permanent Removal**: Delete from primary systems
2. **Cascade Deletion**: Remove all related records
3. **Backup Cleanup**: Remove from backup systems
4. **Verification**: Confirm complete removal

### Data Subject Deletion Requests (GDPR)

#### Right to Erasure Process
1. **Request Verification**: Verify identity and authority
2. **Impact Assessment**: Evaluate legal obligations vs. erasure right
3. **Scope Determination**: Identify all data to be deleted
4. **Deletion Execution**: Remove data across all systems
5. **Confirmation**: Provide deletion confirmation to requestor

#### Emergency Deletion
- **Timeline**: 72 hours for urgent requests
- **Process**: Expedited verification and deletion
- **Documentation**: Detailed audit trail required
- **Notification**: Immediate notification to stakeholders

### Secure Deletion Standards

#### Database Records
```typescript
interface SecureDeletionService {
  async secureDelete(tableName: string, recordId: string): Promise<void> {
    // 1. Overwrite sensitive fields with random data
    await this.overwriteFields(tableName, recordId);
    
    // 2. Delete the record
    await this.deleteRecord(tableName, recordId);
    
    // 3. Log the deletion
    await this.logDeletion(tableName, recordId);
    
    // 4. Trigger backup cleanup
    await this.scheduleBackupCleanup(tableName, recordId);
  }
}
```

#### File System Data
1. **Overwrite**: Multiple pass secure overwrite (DOD 5220.22-M)
2. **Verification**: Confirm data unrecoverable
3. **Certificate**: Generate deletion certificate
4. **Audit**: Log all file deletion activities

## Implementation Architecture

### Retention Management System

#### Retention Scheduler
```typescript
class RetentionScheduler {
  private policies: Map<string, RetentionPolicy>;
  
  async scheduleDataForDeletion(
    dataType: string, 
    recordId: string, 
    createdAt: Date
  ): Promise<void> {
    const policy = this.policies.get(dataType);
    if (!policy) throw new Error(`No policy for ${dataType}`);
    
    const deletionDate = new Date(createdAt);
    deletionDate.setMonth(deletionDate.getMonth() + policy.retentionPeriod);
    
    await this.dataRetentionSchedule.create({
      dataType,
      recordId,
      createdAt,
      deletionDate,
      status: 'scheduled',
      policyVersion: policy.version
    });
  }
}
```

#### Deletion Executor
```typescript
class DeletionExecutor {
  async processDeletions(): Promise<void> {
    const pendingDeletions = await this.getPendingDeletions();
    
    for (const deletion of pendingDeletions) {
      try {
        await this.executeDeletion(deletion);
        await this.logDeletionCompletion(deletion);
      } catch (error) {
        await this.handleDeletionError(deletion, error);
      }
    }
  }
}
```

### Monitoring and Reporting

#### Retention Compliance Dashboard
1. **Data Inventory**: Current data volumes by type and age
2. **Retention Status**: Compliance with retention schedules
3. **Deletion Progress**: Pending and completed deletions
4. **Risk Indicators**: Overdue deletions or retention violations

#### Audit Reports
```typescript
interface RetentionAuditReport {
  reportPeriod: { start: Date; end: Date };
  dataTypesSummary: {
    dataType: string;
    totalRecords: number;
    scheduledForDeletion: number;
    deletedCount: number;
    complianceRate: number;
  }[];
  violations: {
    dataType: string;
    recordId: string;
    retentionDate: Date;
    daysOverdue: number;
  }[];
  deletionRequests: {
    requestId: string;
    requestType: 'automatic' | 'user_request' | 'legal_hold';
    status: 'pending' | 'completed' | 'failed';
    completionDate?: Date;
  }[];
}
```

## Legal Hold Procedures

### Legal Hold Implementation
1. **Hold Notification**: Immediate suspension of deletion schedules
2. **Scope Documentation**: Clear definition of held data
3. **Access Restriction**: Limited access during hold period
4. **Hold Management**: Regular review of hold necessity

### Hold Release Process
1. **Authorization**: Legal team approval required
2. **Scope Verification**: Confirm complete hold coverage
3. **Deletion Resumption**: Restart normal retention schedules
4. **Documentation**: Maintain complete hold records

## Compliance and Governance

### Regulatory Alignment
- **GDPR**: Right to erasure, data minimization
- **CCPA**: Right to delete personal information
- **Industry Standards**: R2v3 certification requirements
- **Financial Regulations**: SOX compliance for financial data

### Policy Review and Updates
- **Annual Review**: Complete policy assessment
- **Regulatory Updates**: Immediate updates for legal changes
- **Business Changes**: Updates for new data types or requirements
- **Incident Response**: Policy updates after retention incidents

### Training and Awareness
1. **Staff Training**: Annual retention policy training
2. **Process Documentation**: Clear procedures for all stakeholders
3. **Escalation Procedures**: Clear escalation paths for issues
4. **Regular Communication**: Updates on policy changes

---

**Document Version**: 1.0  
**Effective Date**: October 1, 2025  
**Next Review**: October 1, 2026  
**Owner**: Data Protection Officer  
**Approved By**: Chief Legal Officer, Chief Security Officer

**Retention Schedule**: This document itself retained for 10 years
