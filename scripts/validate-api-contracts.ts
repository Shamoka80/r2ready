
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface APISpecification {
  file: string;
  name: string;
  version: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationSummary {
  totalSpecs: number;
  validSpecs: number;
  invalidSpecs: number;
  overallValid: boolean;
  specifications: APISpecification[];
}

class APIContractValidator {
  private specsDirectory = path.join(process.cwd(), 'Fixes', 'api');
  private results: APISpecification[] = [];

  async validateAllContracts(): Promise<ValidationSummary> {
    console.log(chalk.blue('🔍 Phase 4: API Contract Validation\n'));

    await this.validateSpecificationFiles();
    await this.validateVersioning();
    await this.validateContractRegistry();
    
    return this.generateSummary();
  }

  private async validateSpecificationFiles(): Promise<void> {
    console.log(chalk.yellow('📋 Validating API Specification Files...\n'));

    const specFiles = [
      'openapi_byoc.yaml',
      'openapi_security.yaml', 
      'openapi_credits.yaml'
    ];

    for (const file of specFiles) {
      const filePath = path.join(this.specsDirectory, file);
      await this.validateSpecFile(filePath, file);
    }
  }

  private async validateSpecFile(filePath: string, fileName: string): Promise<void> {
    const spec: APISpecification = {
      file: fileName,
      name: '',
      version: '',
      valid: false,
      errors: [],
      warnings: []
    };

    try {
      if (!fs.existsSync(filePath)) {
        spec.errors.push(`File does not exist: ${filePath}`);
        this.results.push(spec);
        return;
      }

      // Read and parse YAML
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = yaml.load(content) as any;

      if (!parsed) {
        spec.errors.push('Invalid YAML format');
        this.results.push(spec);
        return;
      }

      // Extract basic info
      spec.name = parsed.info?.title || 'Unknown';
      spec.version = parsed.info?.version || 'Unknown';

      // Validate OpenAPI structure
      await this.validateOpenAPIStructure(parsed, spec);

      // Validate versioning
      await this.validateAPIVersion(parsed, spec);

      // Validate required fields
      await this.validateRequiredFields(parsed, spec);

      // Check for breaking change documentation
      await this.validateBreakingChanges(parsed, spec);

      spec.valid = spec.errors.length === 0;

      console.log(`${spec.valid ? '✅' : '❌'} ${spec.name} (${spec.version})`);
      if (spec.errors.length > 0) {
        spec.errors.forEach(error => console.log(`   Error: ${error}`));
      }
      if (spec.warnings.length > 0) {
        spec.warnings.forEach(warning => console.log(`   Warning: ${warning}`));
      }

    } catch (error) {
      spec.errors.push(`Validation error: ${error.message}`);
      console.log(`❌ ${fileName}: ${error.message}`);
    }

    this.results.push(spec);
  }

  private async validateOpenAPIStructure(parsed: any, spec: APISpecification): Promise<void> {
    // Check OpenAPI version
    if (!parsed.openapi) {
      spec.errors.push('Missing openapi version field');
    } else if (!parsed.openapi.startsWith('3.')) {
      spec.errors.push('OpenAPI version must be 3.x');
    }

    // Check info section
    if (!parsed.info) {
      spec.errors.push('Missing info section');
    } else {
      if (!parsed.info.title) spec.errors.push('Missing API title');
      if (!parsed.info.version) spec.errors.push('Missing API version');
      if (!parsed.info.description) spec.warnings.push('Missing API description');
      if (!parsed.info.contact) spec.warnings.push('Missing contact information');
    }

    // Check paths
    if (!parsed.paths || Object.keys(parsed.paths).length === 0) {
      spec.warnings.push('No API paths defined');
    }

    // Check components
    if (parsed.components?.schemas) {
      const schemas = Object.keys(parsed.components.schemas);
      if (schemas.length === 0) {
        spec.warnings.push('No schemas defined in components');
      }
    }
  }

  private async validateAPIVersion(parsed: any, spec: APISpecification): Promise<void> {
    const version = parsed.info?.version;
    
    if (!version) {
      spec.errors.push('API version is required');
      return;
    }

    // Validate semantic versioning format
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    if (!semverRegex.test(version)) {
      spec.errors.push(`Invalid semantic version format: ${version}`);
    }

    // For Phase 4, all APIs should be at least v1.0.0
    const [major] = version.split('.');
    if (parseInt(major) < 1) {
      spec.errors.push(`API version should be 1.0.0 or higher for stable release, got: ${version}`);
    }
  }

  private async validateRequiredFields(parsed: any, spec: APISpecification): Promise<void> {
    // Check for security schemes
    if (!parsed.components?.securitySchemes) {
      spec.warnings.push('No security schemes defined');
    }

    // Check for servers
    if (!parsed.servers || parsed.servers.length === 0) {
      spec.warnings.push('No servers defined');
    }

    // Validate paths have proper HTTP methods
    if (parsed.paths) {
      const validMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
      for (const [path, pathObj] of Object.entries(parsed.paths as any)) {
        const methods = Object.keys(pathObj);
        const invalidMethods = methods.filter(method => !validMethods.includes(method));
        if (invalidMethods.length > 0) {
          spec.errors.push(`Invalid HTTP methods in path ${path}: ${invalidMethods.join(', ')}`);
        }
      }
    }
  }

  private async validateBreakingChanges(parsed: any, spec: APISpecification): Promise<void> {
    const description = parsed.info?.description || '';
    
    // Check for breaking changes documentation
    if (!description.includes('Breaking Changes Policy')) {
      spec.warnings.push('Missing breaking changes policy in description');
    }

    // Check for deprecation policy
    if (!description.includes('deprecation')) {
      spec.warnings.push('Missing deprecation policy documentation');
    }

    // Check for changelog
    if (!description.includes('Changelog')) {
      spec.warnings.push('Missing changelog in API description');
    }
  }

  private async validateVersioning(): Promise<void> {
    console.log(chalk.yellow('\n📊 Validating API Versioning Strategy...\n'));

    const versionCheck = {
      name: 'API Versioning Strategy',
      valid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Check that all APIs have consistent major version
    const versions = this.results.map(spec => spec.version);
    const majorVersions = versions.map(v => v.split('.')[0]);
    const uniqueMajorVersions = [...new Set(majorVersions)];

    if (uniqueMajorVersions.length > 1) {
      versionCheck.warnings.push(`Multiple major versions found: ${uniqueMajorVersions.join(', ')}`);
    }

    // Check for v1.0.0 baseline
    const stableVersions = versions.filter(v => v.startsWith('1.'));
    if (stableVersions.length !== versions.length) {
      versionCheck.errors.push('Not all APIs are at stable v1.x.x versions');
      versionCheck.valid = false;
    }

    console.log(`${versionCheck.valid ? '✅' : '❌'} API Versioning Strategy`);
    versionCheck.errors.forEach(error => console.log(`   Error: ${error}`));
    versionCheck.warnings.forEach(warning => console.log(`   Warning: ${warning}`));
  }

  private async validateContractRegistry(): Promise<void> {
    console.log(chalk.yellow('\n📚 Validating API Contract Registry...\n'));

    const registryCheck = {
      name: 'API Contract Registry',
      valid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Check for contract registry documentation
    const registryPath = path.join(process.cwd(), 'docs', 'API_CONTRACT_REGISTRY.md');
    if (!fs.existsSync(registryPath)) {
      registryCheck.errors.push('API Contract Registry documentation missing');
      registryCheck.valid = false;
    } else {
      const content = fs.readFileSync(registryPath, 'utf8');
      
      // Check for required sections
      const requiredSections = [
        'API Contract Versioning Strategy',
        'Current API Versions',
        'Breaking vs Non-Breaking Changes',
        'Deprecation Policy'
      ];

      for (const section of requiredSections) {
        if (!content.includes(section)) {
          registryCheck.warnings.push(`Missing section: ${section}`);
        }
      }
    }

    // Check for deprecation policy
    const deprecationPath = path.join(process.cwd(), 'docs', 'API_DEPRECATION_POLICY.md');
    if (!fs.existsSync(deprecationPath)) {
      registryCheck.warnings.push('API Deprecation Policy documentation missing');
    }

    console.log(`${registryCheck.valid ? '✅' : '❌'} API Contract Registry`);
    registryCheck.errors.forEach(error => console.log(`   Error: ${error}`));
    registryCheck.warnings.forEach(warning => console.log(`   Warning: ${warning}`));
  }

  private generateSummary(): ValidationSummary {
    const totalSpecs = this.results.length;
    const validSpecs = this.results.filter(spec => spec.valid).length;
    const invalidSpecs = totalSpecs - validSpecs;
    const overallValid = invalidSpecs === 0;

    console.log(chalk.blue('\n📈 Phase 4 Validation Summary:\n'));
    console.log(`Total API Specifications: ${totalSpecs}`);
    console.log(`Valid Specifications: ${chalk.green(validSpecs)}`);
    console.log(`Invalid Specifications: ${chalk.red(invalidSpecs)}`);

    const successRate = totalSpecs > 0 ? (validSpecs / totalSpecs) * 100 : 0;
    console.log(`\n🎯 Phase 4 Success Rate: ${successRate.toFixed(1)}%`);

    if (successRate >= 98) {
      console.log(chalk.green('🚀 Phase 4: EXCELLENT! API Contracts & Versioning complete'));
    } else if (successRate >= 90) {
      console.log(chalk.yellow('⚠️  Phase 4: GOOD - Minor improvements needed'));
    } else {
      console.log(chalk.red('❌ Phase 4: NEEDS WORK - Significant improvements required'));
    }

    return {
      totalSpecs,
      validSpecs,
      invalidSpecs,
      overallValid,
      specifications: this.results
    };
  }
}

// Execute validation if run directly
async function main() {
  try {
    const validator = new APIContractValidator();
    const summary = await validator.validateAllContracts();
    
    process.exit(summary.overallValid ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('❌ Phase 4 validation failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { APIContractValidator };
