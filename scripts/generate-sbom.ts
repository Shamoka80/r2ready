
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import chalk from 'chalk';
import { createHash } from 'crypto';

interface SBOMComponent {
  type: string;
  'bom-ref': string;
  name: string;
  version: string;
  scope: string;
  hashes?: Array<{ alg: string; content: string }>;
  licenses?: Array<{ license: { id?: string; name?: string } }>;
  purl?: string;
  externalReferences?: Array<{ type: string; url: string }>;
}

interface SBOM {
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: Array<{ vendor: string; name: string; version: string }>;
    component: {
      type: string;
      'bom-ref': string;
      name: string;
      version: string;
      description: string;
    };
  };
  components: SBOMComponent[];
}

class SBOMGenerator {
  private projectInfo = {
    name: 'RUR2 Application',
    version: '1.0.0',
    description: 'R2v3 Compliance Assessment Platform'
  };

  async generateSBOM(): Promise<void> {
    console.log(chalk.blue('📋 Generating Software Bill of Materials (SBOM)...\n'));

    const sbom: SBOM = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      serialNumber: `urn:uuid:${this.generateUUID()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [
          {
            vendor: 'RUR2',
            name: 'sbom-generator',
            version: '1.0.0'
          }
        ],
        component: {
          type: 'application',
          'bom-ref': 'rur2-application',
          name: this.projectInfo.name,
          version: this.getProjectVersion(),
          description: this.projectInfo.description
        }
      },
      components: []
    };

    // Collect components from different package.json files
    await this.collectComponents('.', sbom, 'required');
    
    if (existsSync('server/package.json')) {
      await this.collectComponents('server', sbom, 'required');
    }
    
    if (existsSync('client/package.json')) {
      await this.collectComponents('client', sbom, 'required');
    }

    // Generate different formats
    await this.writeSBOMFiles(sbom);

    // Display summary
    this.displaySummary(sbom);
  }

  private getProjectVersion(): string {
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async collectComponents(directory: string, sbom: SBOM, scope: string): Promise<void> {
    try {
      console.log(chalk.yellow(`Collecting components from ${directory}...`));

      // Get package.json
      const packageJsonPath = `${directory}/package.json`;
      if (!existsSync(packageJsonPath)) return;

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Get detailed package info
      const packageLockPath = `${directory}/package-lock.json`;
      let lockData: any = {};
      
      if (existsSync(packageLockPath)) {
        lockData = JSON.parse(readFileSync(packageLockPath, 'utf8'));
      }

      for (const [name, version] of Object.entries(dependencies)) {
        const component = await this.createComponent(
          name, 
          version as string, 
          scope, 
          directory,
          lockData
        );
        
        if (component) {
          sbom.components.push(component);
        }
      }

    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not collect components from ${directory} - ${error}`));
    }
  }

  private async createComponent(
    name: string, 
    version: string, 
    scope: string,
    directory: string,
    lockData: any
  ): Promise<SBOMComponent | null> {
    try {
      const bomRef = `${name}@${version}`;
      
      // Get package info from lock file
      const packageKey = `node_modules/${name}`;
      const packageInfo = lockData.packages?.[packageKey] || lockData.dependencies?.[name];

      const component: SBOMComponent = {
        type: 'library',
        'bom-ref': bomRef,
        name,
        version: this.normalizeVersion(version),
        scope
      };

      // Add package URL (purl)
      component.purl = `pkg:npm/${name}@${component.version}`;

      // Add integrity hash if available
      if (packageInfo?.integrity) {
        const [algorithm, hash] = packageInfo.integrity.split('-');
        component.hashes = [{
          alg: algorithm.toUpperCase(),
          content: hash
        }];
      }

      // Add license information
      if (packageInfo?.license) {
        component.licenses = [{
          license: { id: packageInfo.license }
        }];
      }

      // Add external references
      component.externalReferences = [];
      
      if (packageInfo?.resolved) {
        component.externalReferences.push({
          type: 'distribution',
          url: packageInfo.resolved
        });
      }

      // Try to get repository info
      try {
        const packageInfoOutput = execSync(
          `npm view ${name} repository.url homepage --json`,
          { 
            cwd: directory,
            encoding: 'utf8',
            stdio: 'pipe'
          }
        );
        
        const npmInfo = JSON.parse(packageInfoOutput);
        
        if (npmInfo.repository?.url) {
          component.externalReferences.push({
            type: 'vcs',
            url: npmInfo.repository.url
          });
        }
        
        if (npmInfo.homepage) {
          component.externalReferences.push({
            type: 'website',
            url: npmInfo.homepage
          });
        }

      } catch (error) {
        // Ignore npm view errors
      }

      return component;

    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not create component for ${name} - ${error}`));
      return null;
    }
  }

  private normalizeVersion(version: string): string {
    // Remove version prefixes like ^, ~, >=, etc.
    return version.replace(/^[\^~>=<]+/, '');
  }

  private async writeSBOMFiles(sbom: SBOM): Promise<void> {
    // Ensure releases directory exists
    if (!existsSync('releases')) {
      execSync('mkdir -p releases');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const version = sbom.metadata.component.version;

    // CycloneDX JSON format
    const jsonFilename = `releases/sbom-cyclonedx-${version}-${timestamp}.json`;
    writeFileSync(jsonFilename, JSON.stringify(sbom, null, 2));

    // SPDX format
    const spdxContent = this.convertToSPDX(sbom);
    const spdxFilename = `releases/sbom-spdx-${version}-${timestamp}.spdx`;
    writeFileSync(spdxFilename, spdxContent);

    // Human-readable format
    const readableContent = this.generateHumanReadable(sbom);
    const readableFilename = `releases/sbom-readable-${version}-${timestamp}.txt`;
    writeFileSync(readableFilename, readableContent);

    // CSV format for spreadsheet analysis
    const csvContent = this.generateCSV(sbom);
    const csvFilename = `releases/sbom-${version}-${timestamp}.csv`;
    writeFileSync(csvFilename, csvContent);

    // Create latest symlinks
    writeFileSync('releases/sbom-latest.json', JSON.stringify(sbom, null, 2));
    writeFileSync('releases/sbom-latest.spdx', spdxContent);
    writeFileSync('releases/sbom-latest.txt', readableContent);
    writeFileSync('releases/sbom-latest.csv', csvContent);

    console.log(chalk.green('📄 SBOM files generated:'));
    console.log(`  • ${jsonFilename}`);
    console.log(`  • ${spdxFilename}`);
    console.log(`  • ${readableFilename}`);
    console.log(`  • ${csvFilename}`);
  }

  private convertToSPDX(sbom: SBOM): string {
    const spdxLines = [
      'SPDXVersion: SPDX-2.2',
      'DataLicense: CC0-1.0',
      'SPDXID: SPDXRef-DOCUMENT',
      `Name: ${sbom.metadata.component.name} SBOM`,
      `DocumentNamespace: https://rur2.com/spdx/${sbom.metadata.component.version}/${sbom.serialNumber}`,
      `Creator: Tool: sbom-generator-1.0.0`,
      `Created: ${sbom.metadata.timestamp}`,
      '',
      '# Package Information',
      `PackageName: ${sbom.metadata.component.name}`,
      'SPDXID: SPDXRef-Package',
      `PackageVersion: ${sbom.metadata.component.version}`,
      'PackageSupplier: Organization: RUR2 Inc.',
      'PackageDownloadLocation: NOASSERTION',
      'FilesAnalyzed: false',
      'PackageLicenseConcluded: NOASSERTION',
      'PackageLicenseDeclared: NOASSERTION',
      'PackageCopyrightText: NOASSERTION'
    ];

    // Add components
    for (const component of sbom.components) {
      spdxLines.push('');
      spdxLines.push(`PackageName: ${component.name}`);
      spdxLines.push(`SPDXID: SPDXRef-${component.name.replace(/[^a-zA-Z0-9]/g, '-')}`);
      spdxLines.push(`PackageVersion: ${component.version}`);
      
      if (component.licenses?.[0]?.license?.id) {
        spdxLines.push(`PackageLicenseConcluded: ${component.licenses[0].license.id}`);
        spdxLines.push(`PackageLicenseDeclared: ${component.licenses[0].license.id}`);
      } else {
        spdxLines.push('PackageLicenseConcluded: NOASSERTION');
        spdxLines.push('PackageLicenseDeclared: NOASSERTION');
      }
      
      spdxLines.push('PackageCopyrightText: NOASSERTION');
      
      const distRef = component.externalReferences?.find(ref => ref.type === 'distribution');
      if (distRef) {
        spdxLines.push(`PackageDownloadLocation: ${distRef.url}`);
      } else {
        spdxLines.push('PackageDownloadLocation: NOASSERTION');
      }

      if (component.hashes?.[0]) {
        spdxLines.push(`PackageChecksum: ${component.hashes[0].alg}: ${component.hashes[0].content}`);
      }
    }

    return spdxLines.join('\n');
  }

  private generateHumanReadable(sbom: SBOM): string {
    const lines = [
      `Software Bill of Materials`,
      `${'='.repeat(50)}`,
      ``,
      `Project: ${sbom.metadata.component.name}`,
      `Version: ${sbom.metadata.component.version}`,
      `Description: ${sbom.metadata.component.description}`,
      `Generated: ${sbom.metadata.timestamp}`,
      `Format: ${sbom.bomFormat} ${sbom.specVersion}`,
      `Serial Number: ${sbom.serialNumber}`,
      ``,
      `Components: ${sbom.components.length}`,
      ``,
      `Component Details:`,
      `${'='.repeat(50)}`
    ];

    // Group by scope
    const byScope = sbom.components.reduce((acc, comp) => {
      const scope = comp.scope || 'unknown';
      if (!acc[scope]) acc[scope] = [];
      acc[scope].push(comp);
      return acc;
    }, {} as Record<string, SBOMComponent[]>);

    for (const [scope, components] of Object.entries(byScope)) {
      lines.push(`\n${scope.toUpperCase()} DEPENDENCIES (${components.length}):`);
      lines.push('-'.repeat(30));
      
      components.sort((a, b) => a.name.localeCompare(b.name));
      
      for (const comp of components) {
        lines.push(`\n• ${comp.name} v${comp.version}`);
        
        if (comp.licenses?.[0]?.license?.id) {
          lines.push(`  License: ${comp.licenses[0].license.id}`);
        }
        
        if (comp.purl) {
          lines.push(`  PURL: ${comp.purl}`);
        }
        
        const vcsRef = comp.externalReferences?.find(ref => ref.type === 'vcs');
        if (vcsRef) {
          lines.push(`  Repository: ${vcsRef.url}`);
        }
      }
    }

    return lines.join('\n');
  }

  private generateCSV(sbom: SBOM): string {
    const headers = [
      'Component Name',
      'Version', 
      'Type',
      'Scope',
      'License',
      'PURL',
      'Repository',
      'Distribution URL',
      'Hash Algorithm',
      'Hash Value'
    ];

    const rows = [headers.join(',')];

    for (const comp of sbom.components) {
      const license = comp.licenses?.[0]?.license?.id || '';
      const vcsRef = comp.externalReferences?.find(ref => ref.type === 'vcs');
      const distRef = comp.externalReferences?.find(ref => ref.type === 'distribution');
      const hash = comp.hashes?.[0];

      const row = [
        `"${comp.name}"`,
        `"${comp.version}"`,
        `"${comp.type}"`,
        `"${comp.scope}"`,
        `"${license}"`,
        `"${comp.purl || ''}"`,
        `"${vcsRef?.url || ''}"`,
        `"${distRef?.url || ''}"`,
        `"${hash?.alg || ''}"`,
        `"${hash?.content || ''}"`
      ];

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private displaySummary(sbom: SBOM): void {
    console.log(chalk.blue('\n📊 SBOM Generation Summary\n'));
    
    console.log(`Project: ${chalk.cyan(sbom.metadata.component.name)}`);
    console.log(`Version: ${chalk.cyan(sbom.metadata.component.version)}`);
    console.log(`Total Components: ${chalk.cyan(sbom.components.length)}`);
    
    // Count by scope
    const scopeCounts = sbom.components.reduce((acc, comp) => {
      const scope = comp.scope || 'unknown';
      acc[scope] = (acc[scope] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nComponent Breakdown:');
    for (const [scope, count] of Object.entries(scopeCounts)) {
      console.log(`  ${scope}: ${chalk.yellow(count)}`);
    }

    // License breakdown
    const licenses = sbom.components
      .map(comp => comp.licenses?.[0]?.license?.id)
      .filter(Boolean);
    
    const uniqueLicenses = [...new Set(licenses)];
    console.log(`\nUnique Licenses: ${chalk.cyan(uniqueLicenses.length)}`);
    
    if (uniqueLicenses.length > 0) {
      uniqueLicenses.slice(0, 5).forEach(license => {
        const count = licenses.filter(l => l === license).length;
        console.log(`  ${license}: ${chalk.yellow(count)}`);
      });
      
      if (uniqueLicenses.length > 5) {
        console.log(`  ... and ${uniqueLicenses.length - 5} more`);
      }
    }

    console.log(chalk.green('\n✅ SBOM Generation Complete!'));
  }
}

// Generate the SBOM
const generator = new SBOMGenerator();
generator.generateSBOM().catch(console.error);
