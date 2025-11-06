#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface CleanupResult {
  removedFiles: string[];
  removedLines: number;
  refactoredFiles: string[];
}

class DeadCodeCleaner {
  private results: CleanupResult = {
    removedFiles: [],
    removedLines: 0,
    refactoredFiles: []
  };

  async cleanup(): Promise<void> {
    console.log(chalk.blue('🧹 Starting Dead Code Cleanup'));

    await this.removeUnusedFiles();
    await this.removeCommentedCode();
    await this.removeUnusedImports();
    await this.consolidateDuplicateFiles();

    this.generateReport();
  }

  private async removeUnusedFiles(): Promise<void> {
    const filesToRemove = [
      // Backup files
      'backup_20250922_055538',
      'backup_20250929_045236', 
      'backup_20250929_045354',
      // Duplicate or obsolete files
      'server/db-health-check.js',
      'server/routes.js',
      'server/storage.js',
      'server/utils.js',
      'server/index.js',
      'server/db.js',
      'server/temp-check.js',
      'server/temp-count.mjs',
      'server/wake-db.js',
      'shared/schema.js',
      // Test files that are placeholders
      'server/tests/auth-integration.test.js',
      'server/tests/authService.test.js',
      'server/tests/jwt-security.test.js',
      // Disabled files
      'server/tools/db-sanity.ts.disabled',
      'server/tools/db-utils.ts.disabled'
    ];

    for (const file of filesToRemove) {
      if (existsSync(file)) {
        try {
          const stat = statSync(file);
          if (stat.isDirectory()) {
            execSync(`rm -rf "${file}"`, { stdio: 'pipe' });
          } else {
            unlinkSync(file);
          }
          this.results.removedFiles.push(file);
          console.log(chalk.red(`🗑️  Removed: ${file}`));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Could not remove: ${file}`));
        }
      }
    }
  }

  private async removeCommentedCode(): Promise<void> {
    const patterns = [
      /^(\s*)\/\/.*TODO.*$/gm,
      /^(\s*)\/\/.*FIXME.*$/gm,
      /^(\s*)\/\/.*console\.log.*$/gm,
      /^(\s*)\/\*[\s\S]*?\*\/$/gm
    ];

    const files = this.getAllTypeScriptFiles();

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        let newContent = content;
        let removedLines = 0;

        for (const pattern of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            removedLines += matches.length;
            newContent = newContent.replace(pattern, '');
          }
        }

        // Remove empty lines that result from removing comments
        newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n');

        if (newContent !== content) {
          writeFileSync(file, newContent);
          this.results.refactoredFiles.push(file);
          this.results.removedLines += removedLines;
          console.log(chalk.green(`🧹 Cleaned comments in: ${file}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not clean: ${file}`));
      }
    }
  }

  private async removeUnusedImports(): Promise<void> {
    console.log(chalk.yellow('🔍 Removing unused imports...'));

    try {
      execSync('npx ts-unused-exports tsconfig.json --silent', { stdio: 'pipe' });
    } catch (error) {
      // ts-unused-exports not available, skip this step
      console.log(chalk.yellow('⚠️  ts-unused-exports not available, skipping unused import removal'));
    }
  }

  private async consolidateDuplicateFiles(): Promise<void> {
    // Remove duplicate validation files
    const duplicates = [
      ['server/services/templateValidator.js', 'server/services/templateValidator.ts'],
      ['server/tools/populate-intake-questions.js', 'server/tools/populate-intake-questions.ts'],
      ['server/tools/populate-question-mappings.js', 'server/tools/populate-question-mappings.ts']
    ];

    for (const [jsFile, tsFile] of duplicates) {
      if (existsSync(jsFile) && existsSync(tsFile)) {
        unlinkSync(jsFile);
        this.results.removedFiles.push(jsFile);
        console.log(chalk.red(`🗑️  Removed duplicate: ${jsFile} (kept ${tsFile})`));
      }
    }
  }

  private getAllTypeScriptFiles(): string[] {
    try {
      const output = execSync('find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v test-results', { encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Dead Code Cleanup Report'));
    console.log('═'.repeat(50));
    console.log(chalk.green(`✅ Files removed: ${this.results.removedFiles.length}`));
    console.log(chalk.green(`✅ Comment lines removed: ${this.results.removedLines}`));
    console.log(chalk.green(`✅ Files refactored: ${this.results.refactoredFiles.length}`));

    if (this.results.removedFiles.length > 0) {
      console.log(chalk.blue('\n🗑️  Removed Files:'));
      this.results.removedFiles.forEach(file => console.log(`   - ${file}`));
    }
  }
}

// Execute cleanup
const cleaner = new DeadCodeCleaner();
cleaner.cleanup().catch(console.error);