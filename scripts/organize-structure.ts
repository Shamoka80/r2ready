#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface StructureResult {
  directoriesCreated: string[];
  filesReorganized: string[];
  duplicatesRemoved: string[];
}

class StructureOrganizer {
  private results: StructureResult = {
    directoriesCreated: [],
    filesReorganized: [],
    duplicatesRemoved: []
  };

  async organize(): Promise<void> {
    console.log(chalk.blue('📁 Starting Project Structure Organization'));

    await this.createMissingDirectories();
    await this.organizeServerFiles();
    await this.organizeClientFiles();
    await this.organizeScripts();
    await this.removeDuplicates();

    this.generateReport();
  }

  private async createMissingDirectories(): Promise<void> {
    const requiredDirs = [
      'server/types',
      'server/constants',
      'server/validators',
      'client/src/types',
      'client/src/constants',
      'client/src/services',
      'shared/types',
      'shared/constants',
      'docs/api',
      'docs/guides'
    ];

    for (const dir of requiredDirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        this.results.directoriesCreated.push(dir);
        console.log(chalk.green(`📁 Created directory: ${dir}`));
      }
    }
  }

  private async organizeServerFiles(): Promise<void> {
    // Move constants to dedicated directory
    const constantsMap = [
      { pattern: /const\s+[A-Z_]+\s*=/, target: 'server/constants/' },
      { pattern: /interface\s+\w+/, target: 'server/types/' },
      { pattern: /type\s+\w+/, target: 'server/types/' }
    ];

    // Group route files by feature
    const routeGroups = {
      'auth': ['auth.ts', 'auth2fa.ts', 'jwt-auth.ts'],
      'assessment': ['assessments.ts', 'answers.ts', 'scoring.ts'],
      'facility': ['facilities.ts', 'client-facilities.ts'],
      'evidence': ['evidence.ts', 'evidence-v2.ts', 'evidence-management.ts'],
      'export': ['exports.ts', 'template-validation-v2.ts'],
      'admin': ['adminImport.ts', 'rbac.ts', 'observability.ts']
    };

    for (const [group, files] of Object.entries(routeGroups)) {
      const groupDir = `server/routes/${group}`;
      if (!existsSync(groupDir)) {
        mkdirSync(groupDir, { recursive: true });
        this.results.directoriesCreated.push(groupDir);
      }

      for (const file of files) {
        const oldPath = `server/routes/${file}`;
        const newPath = `${groupDir}/${file}`;

        if (existsSync(oldPath) && !existsSync(newPath)) {
          try {
            execSync(`mv "${oldPath}" "${newPath}"`, { stdio: 'pipe' });
            this.results.filesReorganized.push(`${oldPath} → ${newPath}`);
            console.log(chalk.green(`📁 Moved: ${oldPath} → ${newPath}`));
          } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not move: ${oldPath}`));
          }
        }
      }
    }
  }

  private async organizeClientFiles(): Promise<void> {
    // Organize React components by feature
    const componentGroups = {
      'auth': ['Login.tsx', 'Register.tsx', 'TwoFactorSetup.tsx', 'TwoFactorVerify.tsx'],
      'dashboard': ['Dashboard.tsx', 'ConsultantDashboard.tsx', 'AnalyticsDashboard.tsx'],
      'assessment': ['AssessmentDetail.tsx', 'NewAssessment.tsx', 'SmartAssessmentForm.tsx'],
      'facility': ['Facilities.tsx', 'ClientFacilities.tsx', 'FacilityUserManagement.tsx'],
      'setup': ['OnboardingV2.tsx', 'OnboardingWizard.tsx', 'Setup2FA.tsx']
    };

    for (const [group, files] of Object.entries(componentGroups)) {
      const groupDir = `client/src/pages/${group}`;
      if (!existsSync(groupDir)) {
        mkdirSync(groupDir, { recursive: true });
        this.results.directoriesCreated.push(groupDir);
      }

      for (const file of files) {
        const oldPath = `client/src/pages/${file}`;
        const newPath = `${groupDir}/${file}`;

        if (existsSync(oldPath) && !existsSync(newPath)) {
          try {
            execSync(`mv "${oldPath}" "${newPath}"`, { stdio: 'pipe' });
            this.results.filesReorganized.push(`${oldPath} → ${newPath}`);
            console.log(chalk.green(`📁 Moved: ${oldPath} → ${newPath}`));
          } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not move: ${oldPath}`));
          }
        }
      }
    }
  }

  private async organizeScripts(): Promise<void> {
    // Group scripts by purpose
    const scriptGroups = {
      'testing': ['comprehensive-testing-suite.ts', 'comprehensive-ui-test.ts', 'run-comprehensive-tests.ts'],
      'verification': ['verify-and-fix.ts', 'verify-infrastructure-reliability.ts', 'verify-performance-monitoring.ts'],
      'performance': ['performance-benchmark.ts', 'performance-optimization.ts'],
      'cleanup': ['cleanup-tests.ts', 'enhanced-quick-fix.ts']
    };

    for (const [group, files] of Object.entries(scriptGroups)) {
      const groupDir = `scripts/${group}`;
      if (!existsSync(groupDir)) {
        mkdirSync(groupDir, { recursive: true });
        this.results.directoriesCreated.push(groupDir);
      }

      for (const file of files) {
        const oldPath = `scripts/${file}`;
        const newPath = `${groupDir}/${file}`;

        if (existsSync(oldPath) && !existsSync(newPath)) {
          try {
            execSync(`mv "${oldPath}" "${newPath}"`, { stdio: 'pipe' });
            this.results.filesReorganized.push(`${oldPath} → ${newPath}`);
            console.log(chalk.green(`📁 Moved: ${oldPath} → ${newPath}`));
          } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not move: ${oldPath}`));
          }
        }
      }
    }
  }

  private async removeDuplicates(): Promise<void> {
    // Remove duplicate/obsolete directories
    const obsoleteDirs = [
      'attached_assets',
      'logs',
      'releases'
    ];

    for (const dir of obsoleteDirs) {
      if (existsSync(dir)) {
        try {
          const files = readdirSync(dir);
          if (files.length === 0) {
            execSync(`rmdir "${dir}"`, { stdio: 'pipe' });
            this.results.duplicatesRemoved.push(dir);
            console.log(chalk.red(`🗑️  Removed empty directory: ${dir}`));
          }
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Could not remove: ${dir}`));
        }
      }
    }
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Project Structure Organization Report'));
    console.log('═'.repeat(50));
    console.log(chalk.green(`✅ Directories created: ${this.results.directoriesCreated.length}`));
    console.log(chalk.green(`✅ Files reorganized: ${this.results.filesReorganized.length}`));
    console.log(chalk.green(`✅ Duplicates removed: ${this.results.duplicatesRemoved.length}`));

    if (this.results.directoriesCreated.length > 0) {
      console.log(chalk.blue('\n📁 New Directories:'));
      this.results.directoriesCreated.forEach(dir => console.log(`   - ${dir}`));
    }
  }
}

// Execute organization
const organizer = new StructureOrganizer();
organizer.organize().catch(console.error);