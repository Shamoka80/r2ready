
# License Compliance Policy

**Version**: 1.0.0  
**Effective Date**: January 15, 2025  
**Owner**: Legal & Engineering Teams  

## Overview

This document establishes the license compliance policy for all dependencies and third-party components used in the RUR2 application. It ensures legal compliance while minimizing business risk.

## Approved Licenses

### Permissive Licenses (Preferred)
- **MIT License**: Widely compatible, minimal restrictions
- **Apache License 2.0**: Patent protection, widely used
- **BSD 2-Clause**: Simple, permissive license
- **BSD 3-Clause**: Includes non-endorsement clause
- **ISC License**: Functionally equivalent to MIT

### Copyleft Licenses (Conditional Approval)
- **LGPL 2.1/3.0**: Allowed for libraries, not for main application
- **MPL 2.0**: File-level copyleft, generally acceptable
- **CDDL 1.0/1.1**: Similar to MPL, case-by-case approval

## Prohibited Licenses

### Strong Copyleft (Not Permitted)
- **GPL 2.0/3.0**: Requires entire application to be GPL
- **AGPL 3.0**: Network copyleft, high compliance burden
- **SSPL**: Server-side restrictions, business incompatible
- **BUSL**: Business use restrictions

### Commercial/Proprietary
- **Commercial licenses**: Require legal review and budget approval
- **Freeware**: Often unclear terms, avoid for production
- **Unlicensed**: No explicit license, cannot be used

## License Review Process

### Automated Scanning
```bash
# Daily license scanning
npm run license:check
```

### Manual Review Requirements
1. **New Major Dependencies**: Legal team review required
2. **License Changes**: Re-review when dependency changes license
3. **Dual-Licensed**: Choose compatible license option
4. **Custom Licenses**: Legal team approval mandatory

### Approval Workflow
1. Engineering identifies new dependency
2. Automated license scan checks against policy
3. If approved license: proceed with technical review
4. If conditional/prohibited: escalate to legal team
5. Document decision in license registry

## License Registry

### Current Dependencies
```json
{
  "dependencies": {
    "express": {
      "license": "MIT",
      "version": "4.x.x",
      "status": "approved",
      "review_date": "2025-01-15"
    },
    "drizzle-orm": {
      "license": "Apache-2.0",
      "version": "0.x.x",
      "status": "approved",
      "review_date": "2025-01-15"
    }
  }
}
```

### License Compatibility Matrix
| License | MIT | Apache 2.0 | BSD | GPL | LGPL | MPL |
|---------|-----|-----------|-----|-----|------|-----|
| MIT | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| Apache 2.0 | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| BSD | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ |

## Compliance Monitoring

### Automated Tools
- **license-checker**: NPM license scanning
- **FOSSA**: Comprehensive license analysis
- **WhiteSource**: Vulnerability + license scanning
- **Renovate**: Automated dependency updates with license checks

### Reporting Requirements
- **Monthly**: License compliance report
- **Quarterly**: Dependency audit and cleanup
- **Annual**: Complete license policy review
- **Ad-hoc**: New dependency license review

## Violation Response

### Detection
1. Automated scanning alerts
2. Manual review findings
3. External audit findings
4. Community reporting

### Response Process
1. **Immediate**: Stop using violating dependency
2. **24 hours**: Assess impact and alternatives
3. **1 week**: Implement replacement or get approval
4. **30 days**: Complete remediation

### Remediation Options
1. **Replace**: Find compatible alternative
2. **Remove**: Eliminate dependency entirely
3. **Negotiate**: Obtain commercial license
4. **Isolate**: Separate component with different license

## Documentation Requirements

### License Files
- **Root**: LICENSE file for main application
- **Dependencies**: Preserve original license files
- **NOTICE**: Attribution file for Apache dependencies
- **THIRD_PARTY**: Complete third-party license listing

### Code Attribution
```javascript
/**
 * This file incorporates work covered by the following copyright and  
 * permission notice:
 *
 * Copyright (c) 2025 Original Author
 * Licensed under the MIT License
 */
```

## Training and Awareness

### Developer Training
- License basics and implications
- How to check dependency licenses
- When to escalate for legal review
- Proper attribution practices

### Legal Team Training
- Technical dependency analysis
- License compatibility assessment
- Risk evaluation frameworks
- Industry best practices

## Emergency Procedures

### Critical Vulnerability with License Issue
1. **Assess Risk**: Security vs. license risk
2. **Temporary Mitigation**: Isolate or disable feature
3. **Legal Consultation**: Expedited review process
4. **Implementation**: Deploy fix with documentation
5. **Follow-up**: Complete license resolution

### Audit Findings
1. **Immediate Response**: Acknowledge and assess
2. **Investigation**: Identify root cause
3. **Remediation Plan**: Timeline and resources
4. **Implementation**: Execute remediation
5. **Verification**: Confirm compliance restoration

## Contact Information

### Legal Team
- **General Counsel**: legal@rur2.com
- **IP Attorney**: ip@rur2.com
- **Compliance Officer**: compliance@rur2.com

### Engineering Team
- **CTO**: cto@rur2.com
- **Security Lead**: security@rur2.com
- **DevOps Lead**: devops@rur2.com

---

**Last Updated**: January 15, 2025  
**Next Review**: July 15, 2025  
**Approved By**: General Counsel, CTO
