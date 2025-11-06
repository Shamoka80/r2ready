# DATA SANITIZATION PLAN

**Document ID:** DSP-001  
**Facility:** [Facility Name]  
**Revision:** 1.0  
**Date:** [Date]  
**Standard Reference:** R2v3 Core Requirement 7; Appendix B; NIST 800-88

---

## PURPOSE

To ensure all data-bearing devices are securely sanitized or destroyed before reuse, resale, or recycling.

---

## SCOPE

Applies to all equipment containing data storage media including:
- Hard disk drives (HDDs)
- Solid state drives (SSDs)
- Mobile devices (phones, tablets)
- Network equipment (servers, routers, switches)
- USB drives and removable media
- Multifunction printers with hard drives
- Any device with embedded storage

---

## RESPONSIBILITIES

| Role | Responsibility |
|------|----------------|
| Data Protection Representative | Overall sanitization program oversight, policy compliance |
| Data Sanitization Technicians | Execute approved sanitization methods, maintain logs |
| Quality Assurance | Verification sampling, audit compliance |
| Compliance Officer | Regulatory compliance, customer agreement review |

**Data Protection Representative:** [Name]  
**Contact:** [Email/Phone]

---

## DATA RISK ASSESSMENT

### Risk Classification

| Risk Level | Criteria | Sanitization Required |
|------------|----------|----------------------|
| **Very High** | Healthcare, financial, government, classified data | Physical destruction or DOD-level overwrite + verification |
| **High** | Business confidential, personal identifiable information | Multi-pass overwrite or physical destruction |
| **Medium** | General business data, employee information | Single-pass overwrite or crypto erase |
| **Low** | No sensitive data identified | Standard erasure methods |

### Assessment Process
1. Customer provides data sensitivity classification
2. Visual inspection for labels/markings indicating sensitive use
3. Default to "High" if classification unknown
4. Document risk level on sanitization record

---

## SANITIZATION METHODS

### Method 1: Logical Sanitization (Overwriting)

**Applicable Devices:** HDDs, some SSDs (non-encrypted)

| Pass Type | Pattern | Standard |
|-----------|---------|----------|
| Single Pass | Zeros or random data | NIST 800-88 Clear |
| Multi-Pass (3x) | Random data each pass | NIST 800-88 Purge |
| DOD 5220.22-M | 7-pass alternating patterns | High-security applications |

**Approved Software:**
- [Software Name/Version]
- [Software Name/Version]

**Process:**
1. Connect device to sanitization workstation
2. Launch approved software
3. Select appropriate sanitization method based on risk
4. Initiate sanitization process
5. Save completion report with device serial number
6. Log in Data Destruction Log

### Method 2: Cryptographic Erase

**Applicable Devices:** Self-encrypting drives (SEDs), encrypted SSDs

**Process:**
1. Verify device supports secure erase command
2. Execute cryptographic erase via ATA Secure Erase or NVMe Format
3. Verify completion
4. Document in sanitization log

**Time:** Typically seconds to minutes

### Method 3: Physical Destruction

**Applicable Devices:** All media types, required for Very High risk or devices unsuitable for logical sanitization

**Approved Methods:**
- Industrial shredding (particle size ≤2mm for HDDs)
- Crushing/bending (platters permanently deformed)
- Disintegration
- Degaussing + physical destruction (HDDs only)

**Equipment:**
- [Shredder Model]: NSA/CSS EPL listed
- [Crusher Model]
- [Degausser Model] (if used)

**Process:**
1. Remove device from equipment
2. Process through approved destruction equipment
3. Verify destruction completeness
4. Photograph or sample destroyed media (optional)
5. Document in destruction log

---

## VERIFICATION PROCEDURES

### Sampling Requirements

| Sanitization Method | Verification Sample Rate | Verification Method |
|---------------------|-------------------------|---------------------|
| Logical overwrite | 5% minimum per batch | Recovery attempt using forensic tools |
| Cryptographic erase | 5% minimum per batch | Verify data inaccessible |
| Physical destruction | 100% visual inspection | Confirm complete destruction |

### Verification Process
1. Randomly select devices from completed batch
2. Attempt data recovery using approved forensic software
3. Document verification results
4. If data recovered: halt batch, investigate, re-sanitize all devices
5. Quality Assurance signs off on verification

**Forensic Verification Tools:**
- [Tool Name/Version]
- [Tool Name/Version]

---

## DATA SECURITY CONTROLS

### Facility Access
- Data processing area restricted to authorized personnel only
- Access control via [badge system/keypad/other]
- Visitor log maintained
- CCTV coverage: [Yes/No], retention: [60/90 days]

### Device Handling
- Chain of custody maintained from receipt to completion
- Devices stored in secured area when not actively processed
- Devices labeled with tracking ID and risk classification
- No personal electronic devices allowed in processing area

### Authorization Matrix

| Access Level | Authorized Roles | Permitted Actions |
|--------------|------------------|-------------------|
| Full Access | Data Protection Rep, Senior Technicians | All sanitization methods, system administration |
| Standard Access | Data Sanitization Technicians | Execute sanitization, basic logging |
| Read-Only | QA, Auditors | View logs and procedures |
| No Access | All others | Prohibited entry |

---

## CUSTOMER AGREEMENTS

All data sanitization services documented via:
- Customer work order specifying sanitization requirements
- Data Security Agreement signed by customer
- Certificate of Destruction/Sanitization issued upon completion

**Certificate Contents:**
- Customer name and contact
- Device descriptions and serial numbers
- Sanitization method used
- Date of sanitization
- Technician and verifier signatures
- Certificate number for tracking

**Template:** [Document ID: CERT-001]

---

## EXCEPTION HANDLING

### Devices That Cannot Be Sanitized

**Scenarios:**
- Physical damage preventing access
- Encryption key unavailable for cryptographic erase
- Device malfunction

**Process:**
1. Document reason sanitization cannot be completed
2. Escalate to Data Protection Representative
3. Default to physical destruction
4. Obtain customer approval for destruction if device intended for reuse
5. Document exception in sanitization log

---

## INCIDENT RESPONSE

### Data Breach Definition
- Unauthorized access to data-bearing devices
- Loss or theft of unsanitized devices
- Sanitization verification failure
- Employee security violation

### Response Protocol
1. Immediate notification to Data Protection Representative
2. Containment action (isolate devices, revoke access, etc.)
3. Investigation within 24 hours
4. Root cause analysis within 5 business days
5. Customer notification as required by law/contract
6. Corrective action plan implemented
7. Document in Incident Response Log (IRL-001)

**Incident Report Template:** [Document ID: INC-001]

---

## TRAINING REQUIREMENTS

All personnel handling data-bearing devices must complete:
- Data security awareness training (annual)
- Sanitization methods and procedures training (initial + annual)
- Equipment-specific operation training
- Incident response training

**Competency Assessment:** Required post-training, minimum 80% score

**Training Records:** Document ID TRN-001, retained 3 years minimum

---

## DOCUMENTATION AND RECORDS

### Required Records

| Record Type | Document ID | Responsible | Retention |
|-------------|-------------|-------------|-----------|
| Data Destruction Log | DDL-001 | Technicians | 3 years |
| Verification Reports | DVR-001 | QA | 3 years |
| Certificates of Destruction | CERT-001 | Admin | 3 years |
| Incident Response Log | IRL-001 | Data Protection Rep | 5 years |
| Customer Data Security Agreements | DSA-001 | Sales/Admin | 3 years + contract term |
| Training Records | TRN-001 | HR/Training | 3 years |

### Data Destruction Log Template

| Date | Device ID | Serial Number | Device Type | Customer | Risk Level | Method | Technician | Verified By | Certificate # |
|------|-----------|---------------|-------------|----------|------------|--------|------------|-------------|---------------|
| [Date] | [ID] | [S/N] | [HDD/SSD/Mobile] | [Customer] | [High/Medium/Low] | [Method] | [Name] | [Name] | [CERT-####] |

---

## EQUIPMENT MAINTENANCE

All sanitization and destruction equipment maintained per manufacturer specifications:

| Equipment | Maintenance Schedule | Last Service | Next Service | Responsible |
|-----------|---------------------|--------------|--------------|-------------|
| [Shredder Model] | Monthly inspection, annual service | [Date] | [Date] | [Technician] |
| [Software License] | Annual renewal | [Date] | [Date] | [IT] |
| [Degausser] | Annual calibration | [Date] | [Date] | [Technician] |

---

## DOWNSTREAM MANAGEMENT

If devices sent to downstream vendors for sanitization:
- Vendor must be R2 certified with Appendix B
- Contract must specify sanitization requirements
- Certificates of destruction required
- Chain of custody maintained
- Vendor audit per Appendix A requirements

**Qualified Vendors:** [Document ID: DVQ-001]

---

## PERFORMANCE METRICS

| Metric | Target | Measurement Frequency |
|--------|--------|----------------------|
| Sanitization completion rate | 100% | Weekly |
| Verification pass rate | 100% | Weekly |
| Incident rate | 0 | Monthly |
| Certificate issuance time | Within 5 business days | Monthly |
| Training compliance | 100% | Quarterly |

**Reports to:** Data Protection Representative and Management

---

## CONTINUOUS IMPROVEMENT

**Annual Review:** This plan reviewed annually and updated for:
- Changes to NIST 800-88 guidelines
- New technology (e.g., new storage media types)
- Audit findings or incidents
- Regulatory changes
- Customer feedback

**Review Date:** [Date]  
**Next Review:** [Date]

---

## DOCUMENT REVISION HISTORY

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | [Date] | Initial issue | [Data Protection Rep] |
|  |  |  |  |

---

## REFERENCES

- NIST Special Publication 800-88 Rev. 1: Guidelines for Media Sanitization
- R2v3 Standard (2020): Core Requirement 7 and Appendix B
- ISO/IEC 27040: Information technology – Security techniques – Storage security
- [State/Federal data privacy laws applicable]

---

**Document Owner:** [Data Protection Representative]  
**Next Review Date:** [Date]