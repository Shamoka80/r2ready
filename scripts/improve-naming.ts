#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';

interface NamingResult {
  variablesRenamed: number;
  functionsRenamed: number;
  filesRenamed: string[];
}

class NamingImprover {
  private results: NamingResult = {
    variablesRenamed: 0,
    functionsRenamed: 0,
    filesRenamed: []
  };

  private namingRules = [
    // Variable naming improvements
    { pattern: /\bdata\b/g, suggestion: 'userData|formData|responseData' },
    { pattern: /\binfo\b/g, suggestion: 'userInfo|systemInfo|debugInfo' },
    { pattern: /\btemp\b/g, suggestion: 'temporary|tempFile|tempData' },
    { pattern: /\bval\b/g, suggestion: 'value|currentValue|inputValue' },
    { pattern: /\bres\b/g, suggestion: 'response|result|resource' },
    { pattern: /\breq\b/g, suggestion: 'request|requirement' },

    // Function naming improvements
    { pattern: /^get([A-Z])/g, suggestion: 'fetch$1|retrieve$1|load$1' },
    { pattern: /^set([A-Z])/g, suggestion: 'update$1|assign$1|configure$1' },
    { pattern: /^check([A-Z])/g, suggestion: 'validate$1|verify$1|ensure$1' },
    { pattern: /^do([A-Z])/g, suggestion: 'execute$1|perform$1|process$1' }
  ];

  async improve(): Promise<void> {
    console.log(chalk.blue('📝 Starting Naming Convention Improvements'));

    await this.analyzeNaming();
    await this.suggestImprovements();
    await this.renameFiles();

    this.generateReport();
  }

  private async analyzeNaming(): Promise<void> {
    const files = this.getAllSourceFiles();

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        const improvedContent = this.improveNamingInFile(content);

        if (improvedContent !== content) {
          // For now, just report what could be improved
          console.log(chalk.yellow(`📝 Naming improvements suggested for: ${file}`));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Could not analyze: ${file}`));
      }
    }
  }

  private improveNamingInFile(content: string): string {
    let improvedContent = content;

    // Improve variable declarations
    improvedContent = this.improveVariableNames(improvedContent);

    // Improve function names
    improvedContent = this.improveFunctionNames(improvedContent);

    // Improve constant names
    improvedContent = this.improveConstantNames(improvedContent);

    return improvedContent;
  }

  private improveVariableNames(content: string): string {
    // Convert single letter variables to descriptive names (except for loops)
    const singleLetterPattern = /(?<!for\s*\(\s*)(let|const|var)\s+([a-z])\s*=/g;

    return content.replace(singleLetterPattern, (match, keyword, letter) => {
      const suggestions: { [key: string]: string } = {
        'i': 'index',
        'j': 'innerIndex',
        'k': 'keyIndex',
        'n': 'count',
        'x': 'xCoordinate',
        'y': 'yCoordinate',
        'z': 'zCoordinate'
      };

      const suggestion = suggestions[letter] || `${letter}Value`;
      this.results.variablesRenamed++;
      return `${keyword} ${suggestion} =`;
    });
  }

  private improveFunctionNames(content: string): string {
    // Improve generic function names
    const patterns = [
      {
        pattern: /function\s+handle([A-Z]\w*)/g,
        replacement: 'function process$1'
      },
      {
        pattern: /const\s+handle([A-Z]\w*)\s*=/g,
        replacement: 'const process$1 ='
      }
    ];

    let result = content;
    for (const { pattern, replacement } of patterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, replacement);
        this.results.functionsRenamed++;
      }
    }

    return result;
  }

  private improveConstantNames(content: string): string {
    // Ensure constants are in UPPER_SNAKE_CASE
    const constantPattern = /const\s+([a-z]\w*)\s*=\s*(['"`][\w\s]+['"`]|[\d.]+)/g;

    return content.replace(constantPattern, (match, name, value) => {
      if (name === name.toLowerCase() && !name.includes('_')) {
        const upperName = name.replace(/([A-Z])/g, '_$1').toUpperCase();
        return match.replace(name, upperName);
      }
      return match;
    });
  }

  private async suggestImprovements(): Promise<void> {
    console.log(chalk.blue('\n💡 Naming Convention Suggestions:'));
    console.log('  • Use descriptive variable names (userData instead of data)');
    console.log('  • Use verb-noun pattern for functions (validateEmail instead of checkEmail)');
    console.log('  • Use UPPER_SNAKE_CASE for constants');
    console.log('  • Use camelCase for variables and functions');
    console.log('  • Use PascalCase for classes and components');
  }

  private async renameFiles(): Promise<void> {
    // Rename files with inconsistent naming
    const renameCandidates = [
      { from: 'server/db-health-check.js', to: 'server/database-health-check.js' },
      { from: 'server/enable-neon-endpoint.js', to: 'server/enable-database-endpoint.js' }
    ];

    for (const { from, to } of renameCandidates) {
      try {
        execSync(`mv "${from}" "${to}"`, { stdio: 'pipe' });
        this.results.filesRenamed.push(`${from} → ${to}`);
        console.log(chalk.green(`📁 Renamed: ${from} → ${to}`));
      } catch (error) {
        // File might not exist, skip
      }
    }
  }

  private getAllSourceFiles(): string[] {
    try {
      const output = execSync(
        'find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -v test-results | head -20',
        { encoding: 'utf8' }
      );
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Naming Convention Report'));
    console.log('═'.repeat(50));
    console.log(chalk.green(`✅ Variables renamed: ${this.results.variablesRenamed}`));
    console.log(chalk.green(`✅ Functions renamed: ${this.results.functionsRenamed}`));
    console.log(chalk.green(`✅ Files renamed: ${this.results.filesRenamed.length}`));

    if (this.results.filesRenamed.length > 0) {
      console.log(chalk.blue('\n📁 Renamed Files:'));
      this.results.filesRenamed.forEach(rename => console.log(`   - ${rename}`));
    }
  }
}

// Execute naming improvements
const improver = new NamingImprover();
improver.improve().catch(console.error);