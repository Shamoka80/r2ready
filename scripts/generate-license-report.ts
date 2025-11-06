
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import chalk from 'chalk';
import path from 'path';

interface LicenseInfo {
  name: string;
  version: string;
  license: string;
  repository?: string;
  author?: string;
  path: string;
  licenseFile?: string;
}

interface LicenseReport {
  generated: string;
  projectName: string;
  version: string;
  totalDependencies: number;
  licenseBreakdown: Record<string, number>;
  dependencies: LicenseInfo[];
  violations: LicenseInfo[];
  warnings: LicenseInfo[];
}

class LicenseReportGenerator {
  private approvedLicenses = [
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
    'Unlicense'
  ];

  private conditionalLicenses = [
    'LGPL-2.1',
    'LGPL-3.0',
    'MPL-2.0',
    'CDDL-1.0',
    'CDDL-1.1'
  ];

  private prohibitedLicenses = [
    'GPL-2.0',
    'GPL-3.0',
    'AGPL-3.0',
    'SSPL-1.0',
    'BUSL-1.1'
  ];

  async generateReport(): Promise<void> {
    console.log(chalk.blue('📋 Generating License Compliance Report...\n'));

    const report: LicenseReport = {
      generated: new Date().toISOString(),
      projectName: 'RUR2 Application',
      version: this.getProjectVersion(),
      totalDependencies: 0,
      licenseBreakdown: {},
      dependencies: [],
      violations: [],
      warnings: []
    };

    // Scan root dependencies
    await this.scanDependencies('.', report);
    
    // Scan server dependencies
    if (existsSync('server/package.json')) {
      await this.scanDependencies('server', report);
    }

    // Scan client dependencies
    if (existsSync('client/package.json')) {
      await this.scanDependencies('client', report);
    }

    // Generate breakdown
    this.generateBreakdown(report);

    // Identify violations and warnings
    this.identifyIssues(report);

    // Write reports
    await this.writeReports(report);

    // Display summary
    this.displaySummary(report);
  }

  private getProjectVersion(): string {
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private async scanDependencies(directory: string, report: LicenseReport): Promise<void> {
    try {
      console.log(chalk.yellow(`Scanning dependencies in ${directory}...`));
      
      const licenseOutput = execSync(
        'npx license-checker --json --production',
        { 
          cwd: directory,
          encoding: 'utf8',
          stdio: 'pipe'
        }
      );

      const licenses = JSON.parse(licenseOutput);

      for (const [packageName, info] of Object.entries(licenses as Record<string, any>)) {
        const licenseInfo: LicenseInfo = {
          name: packageName,
          version: info.version || 'unknown',
          license: this.normalizeLicense(info.license || info.licenses || 'Unknown'),
          repository: info.repository,
          author: info.author,
          path: directory,
          licenseFile: info.licenseFile
        };

        report.dependencies.push(licenseInfo);
        report.totalDependencies++;
      }

    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not scan ${directory} - ${error}`));
    }
  }

  private normalizeLicense(license: string): string {
    // Handle various license format variations
    if (typeof license !== 'string') {
      return 'Unknown';
    }

    // Remove common prefixes/suffixes
    license = license.replace(/^License:\s*/i, '');
    license = license.replace(/\s*License$/i, '');
    
    // Handle multiple licenses (take the first one for now)
    if (license.includes(' OR ')) {
      license = license.split(' OR ')[0];
    }
    
    if (license.includes(' AND ')) {
      license = license.split(' AND ')[0];
    }

    // Common normalizations
    const normalizations: Record<string, string> = {
      'MIT License': 'MIT',
      'Apache License 2.0': 'Apache-2.0',
      'Apache 2.0': 'Apache-2.0',
      'BSD': 'BSD-3-Clause',
      'BSD License': 'BSD-3-Clause',
      'ISC License': 'ISC',
      'Mozilla Public License 2.0': 'MPL-2.0'
    };

    return normalizations[license] || license;
  }

  private generateBreakdown(report: LicenseReport): void {
    report.licenseBreakdown = {};
    
    for (const dep of report.dependencies) {
      const license = dep.license;
      report.licenseBreakdown[license] = (report.licenseBreakdown[license] || 0) + 1;
    }
  }

  private identifyIssues(report: LicenseReport): void {
    for (const dep of report.dependencies) {
      const license = dep.license;

      if (this.prohibitedLicenses.includes(license) || license === 'Unknown') {
        report.violations.push(dep);
      } else if (this.conditionalLicenses.includes(license)) {
        report.warnings.push(dep);
      }
    }
  }

  private async writeReports(report: LicenseReport): Promise<void> {
    // JSON report
    writeFileSync(
      'reports/license-report.json',
      JSON.stringify(report, null, 2)
    );

    // CSV report
    const csvContent = this.generateCSV(report);
    writeFileSync('reports/license-report.csv', csvContent);

    // HTML report
    const htmlContent = this.generateHTML(report);
    writeFileSync('reports/license-report.html', htmlContent);

    // SPDX format
    const spdxContent = this.generateSPDX(report);
    writeFileSync('reports/license-report.spdx', spdxContent);

    console.log(chalk.green('📄 Reports generated in reports/ directory'));
  }

  private generateCSV(report: LicenseReport): string {
    const headers = ['Package', 'Version', 'License', 'Repository', 'Author', 'Path', 'Status'];
    const rows = [headers.join(',')];

    for (const dep of report.dependencies) {
      const status = this.getLicenseStatus(dep.license);
      const row = [
        `"${dep.name}"`,
        `"${dep.version}"`,
        `"${dep.license}"`,
        `"${dep.repository || ''}"`,
        `"${dep.author || ''}"`,
        `"${dep.path}"`,
        `"${status}"`
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private generateHTML(report: LicenseReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>License Compliance Report - ${report.projectName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; margin-bottom: 20px; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .metric { background: #e3f2fd; padding: 15px; border-radius: 5px; text-align: center; }
        .violations { background: #ffebee; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .warnings { background: #fff3e0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .violation { background-color: #ffcdd2; }
        .warning { background-color: #ffe0b2; }
        .approved { background-color: #c8e6c9; }
    </style>
</head>
<body>
    <div class="header">
        <h1>License Compliance Report</h1>
        <p>Generated: ${report.generated}</p>
        <p>Project: ${report.projectName} v${report.version}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>${report.totalDependencies}</h3>
            <p>Total Dependencies</p>
        </div>
        <div class="metric">
            <h3>${report.violations.length}</h3>
            <p>Violations</p>
        </div>
        <div class="metric">
            <h3>${report.warnings.length}</h3>
            <p>Warnings</p>
        </div>
    </div>

    ${report.violations.length > 0 ? `
    <div class="violations">
        <h3>🚨 License Violations</h3>
        <p>The following dependencies have prohibited or unknown licenses:</p>
        <ul>
            ${report.violations.map(dep => `<li><strong>${dep.name}</strong> (${dep.license})</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${report.warnings.length > 0 ? `
    <div class="warnings">
        <h3>⚠️ License Warnings</h3>
        <p>The following dependencies require legal review:</p>
        <ul>
            ${report.warnings.map(dep => `<li><strong>${dep.name}</strong> (${dep.license})</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <h3>License Breakdown</h3>
    <table>
        <thead>
            <tr>
                <th>License</th>
                <th>Count</th>
                <th>Percentage</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${Object.entries(report.licenseBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([license, count]) => {
                const percentage = ((count / report.totalDependencies) * 100).toFixed(1);
                const status = this.getLicenseStatus(license);
                const cssClass = status === 'Violation' ? 'violation' : 
                               status === 'Warning' ? 'warning' : 'approved';
                return `<tr class="${cssClass}">
                    <td>${license}</td>
                    <td>${count}</td>
                    <td>${percentage}%</td>
                    <td>${status}</td>
                </tr>`;
              }).join('')}
        </tbody>
    </table>

    <h3>All Dependencies</h3>
    <table>
        <thead>
            <tr>
                <th>Package</th>
                <th>Version</th>
                <th>License</th>
                <th>Repository</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${report.dependencies.map(dep => {
              const status = this.getLicenseStatus(dep.license);
              const cssClass = status === 'Violation' ? 'violation' : 
                             status === 'Warning' ? 'warning' : 'approved';
              return `<tr class="${cssClass}">
                  <td>${dep.name}</td>
                  <td>${dep.version}</td>
                  <td>${dep.license}</td>
                  <td>${dep.repository || ''}</td>
                  <td>${status}</td>
              </tr>`;
            }).join('')}
        </tbody>
    </table>
</body>
</html>`;
  }

  private generateSPDX(report: LicenseReport): string {
    const spdx = [
      'SPDXVersion: SPDX-2.2',
      'DataLicense: CC0-1.0',
      'SPDXID: SPDXRef-DOCUMENT',
      `Name: ${report.projectName}`,
      `DocumentNamespace: https://rur2.com/spdx/${report.version}`,
      `Creator: Tool: license-report-generator`,
      `Created: ${report.generated}`,
      '',
      '# Package Information',
      `PackageName: ${report.projectName}`,
      'SPDXID: SPDXRef-Package',
      `PackageVersion: ${report.version}`,
      'PackageSupplier: Organization: RUR2 Inc.',
      'PackageDownloadLocation: NOASSERTION',
      'FilesAnalyzed: false',
      'PackageLicenseConcluded: NOASSERTION',
      'PackageLicenseDeclared: NOASSERTION',
      'PackageCopyrightText: NOASSERTION',
      ''
    ];

    // Add dependency information
    spdx.push('# Dependency Information');
    for (const dep of report.dependencies) {
      spdx.push('');
      spdx.push(`PackageName: ${dep.name}`);
      spdx.push(`SPDXID: SPDXRef-${dep.name.replace(/[^a-zA-Z0-9]/g, '-')}`);
      spdx.push(`PackageVersion: ${dep.version}`);
      spdx.push(`PackageLicenseConcluded: ${dep.license}`);
      spdx.push(`PackageLicenseDeclared: ${dep.license}`);
      spdx.push('PackageCopyrightText: NOASSERTION');
      if (dep.repository) {
        spdx.push(`PackageDownloadLocation: ${dep.repository}`);
      } else {
        spdx.push('PackageDownloadLocation: NOASSERTION');
      }
    }

    return spdx.join('\n');
  }

  private getLicenseStatus(license: string): string {
    if (this.prohibitedLicenses.includes(license) || license === 'Unknown') {
      return 'Violation';
    } else if (this.conditionalLicenses.includes(license)) {
      return 'Warning';
    } else if (this.approvedLicenses.includes(license)) {
      return 'Approved';
    } else {
      return 'Review Required';
    }
  }

  private displaySummary(report: LicenseReport): void {
    console.log(chalk.blue('\n📊 License Compliance Summary\n'));
    console.log(`Total Dependencies: ${chalk.cyan(report.totalDependencies)}`);
    console.log(`Violations: ${chalk.red(report.violations.length)}`);
    console.log(`Warnings: ${chalk.yellow(report.warnings.length)}`);
    
    if (report.violations.length > 0) {
      console.log(chalk.red('\n🚨 Critical Issues Found:'));
      report.violations.forEach(dep => {
        console.log(`  • ${dep.name} (${dep.license})`);
      });
    }

    if (report.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️ Review Required:'));
      report.warnings.forEach(dep => {
        console.log(`  • ${dep.name} (${dep.license})`);
      });
    }

    const complianceScore = ((report.totalDependencies - report.violations.length) / report.totalDependencies) * 100;
    
    if (complianceScore === 100) {
      console.log(chalk.green('\n✅ Full License Compliance Achieved!'));
    } else if (complianceScore >= 95) {
      console.log(chalk.yellow(`\n⚠️ License Compliance: ${complianceScore.toFixed(1)}% - Minor issues`));
    } else {
      console.log(chalk.red(`\n❌ License Compliance: ${complianceScore.toFixed(1)}% - Action required`));
    }
  }
}

// Ensure reports directory exists
if (!existsSync('reports')) {
  execSync('mkdir -p reports');
}

// Generate the report
const generator = new LicenseReportGenerator();
generator.generateReport().catch(console.error);
