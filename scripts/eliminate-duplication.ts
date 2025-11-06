#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';

interface DuplicationResult {
  duplicatesFound: number;
  duplicatesEliminated: number;
  utilitiesCreated: string[];
}

class DuplicationEliminator {
  private results: DuplicationResult = {
    duplicatesFound: 0,
    duplicatesEliminated: 0,
    utilitiesCreated: []
  };

  async eliminate(): Promise<void> {
    console.log(chalk.blue('🔄 Starting Code Duplication Elimination'));

    await this.findCommonPatterns();
    await this.createUtilities();
    await this.refactorDuplicates();

    this.generateReport();
  }

  private async findCommonPatterns(): Promise<void> {
    // Common patterns that appear multiple times
    const patterns = [
      'res.status(401).json({ error: "Unauthorized" })',
      'res.status(500).json({ error: "Internal server error" })',
      'console.log("Error:", error)',
      'if (!user) { return res.status(404).json({ error: "User not found" }); }'
    ];

    const files = this.getAllSourceFiles();
    let totalDuplicates = 0;

    for (const pattern of patterns) {
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf8');
          const matches = content.split(pattern).length - 1;
          if (matches > 1) {
            totalDuplicates += matches - 1; // -1 because first occurrence is not a duplicate
            console.log(chalk.yellow(`🔍 Found ${matches} occurrences of pattern in ${file}`));
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    this.results.duplicatesFound = totalDuplicates;
  }

  private async createUtilities(): Promise<void> {
    // Create common response utilities
    const responseUtilsContent = `
export const ResponseUtils = {
  unauthorized: (res: any, message = 'Unauthorized') => {
    return res.status(401).json({ error: message });
  },

  forbidden: (res: any, message = 'Forbidden') => {
    return res.status(403).json({ error: message });
  },

  notFound: (res: any, message = 'Resource not found') => {
    return res.status(404).json({ error: message });
  },

  conflict: (res: any, message = 'Conflict') => {
    return res.status(409).json({ error: message });
  },

  validationError: (res: any, details: any) => {
    return res.status(422).json({ error: 'Validation error', details });
  },

  serverError: (res: any, error: any, message = 'Internal server error') => {
    console.error('Server error:', error);
    return res.status(500).json({ error: message });
  },

  success: (res: any, data: any, message?: string) => {
    return res.status(200).json({ success: true, data, message });
  },

  created: (res: any, data: any, message?: string) => {
    return res.status(201).json({ success: true, data, message });
  }
};
`;

    writeFileSync('server/utils/responseUtils.ts', responseUtilsContent);
    this.results.utilitiesCreated.push('server/utils/responseUtils.ts');

    // Create validation utilities
    const validationUtilsContent = `
export const ValidationUtils = {
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  },

  isValidPassword: (password: string): boolean => {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /\\d/.test(password) && 
           /[!@#$%^&*]/.test(password);
  },

  isValidUUID: (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  sanitizeInput: (input: string): string => {
    return input.trim().replace(/[<>]/g, '');
  },

  validateRequiredFields: (data: any, fields: string[]): string[] => {
    const missing = [];
    for (const field of fields) {
      if (!data[field] || data[field] === '') {
        missing.push(field);
      }
    }
    return missing;
  }
};
`;

    writeFileSync('shared/utils/validationUtils.ts', validationUtilsContent);
    this.results.utilitiesCreated.push('shared/utils/validationUtils.ts');

    // Create logging utilities
    const loggingUtilsContent = `
export const LoggingUtils = {
  info: (message: string, data?: any) => {
    console.log(\`[INFO] \${new Date().toISOString()}: \${message}\`, data || '');
  },

  warn: (message: string, data?: any) => {
    console.warn(\`[WARN] \${new Date().toISOString()}: \${message}\`, data || '');
  },

  error: (message: string, error?: any) => {
    console.error(\`[ERROR] \${new Date().toISOString()}: \${message}\`, error || '');
  },

  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(\`[DEBUG] \${new Date().toISOString()}: \${message}\`, data || '');
    }
  }
};
`;

    writeFileSync('shared/utils/loggingUtils.ts', loggingUtilsContent);
    this.results.utilitiesCreated.push('shared/utils/loggingUtils.ts');

    console.log(chalk.green(`✅ Created ${this.results.utilitiesCreated.length} utility modules`));
  }

  private async refactorDuplicates(): Promise<void> {
    const files = this.getAllSourceFiles();

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        let refactoredContent = content;
        let changes = 0;

        // Replace common error responses
        const errorReplacements = [
          {
            pattern: /res\.status\(401\)\.json\(\{\s*error:\s*["']Unauthorized["']\s*\}\)/g,
            replacement: 'ResponseUtils.unauthorized(res)'
          },
          {
            pattern: /res\.status\(404\)\.json\(\{\s*error:\s*["'][^"']*not found[^"']*["']\s*\}\)/gi,
            replacement: 'ResponseUtils.notFound(res)'
          },
          {
            pattern: /res\.status\(500\)\.json\(\{\s*error:\s*["']Internal server error["']\s*\}\)/g,
            replacement: 'ResponseUtils.serverError(res, error)'
          }
        ];

        for (const { pattern, replacement } of errorReplacements) {
          const matches = content.match(pattern);
          if (matches && matches.length > 0) {
            refactoredContent = refactoredContent.replace(pattern, replacement);
            changes += matches.length;
          }
        }

        // Add import if we made changes
        if (changes > 0 && !refactoredContent.includes('ResponseUtils')) {
          refactoredContent = `import { ResponseUtils } from '../utils/responseUtils';\n${refactoredContent}`;
          writeFileSync(file, refactoredContent);
          this.results.duplicatesEliminated += changes;
          console.log(chalk.green(`🔄 Refactored ${changes} duplicates in ${file}`));
        }
      } catch (error) {
        // Skip files that can't be processed
      }
    }
  }

  private getAllSourceFiles(): string[] {
    try {
      const output = execSync(
        'find server -name "*.ts" | grep -v node_modules | grep -v test | head -10',
        { encoding: 'utf8' }
      );
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📊 Code Duplication Elimination Report'));
    console.log('═'.repeat(50));
    console.log(chalk.yellow(`🔍 Duplicates found: ${this.results.duplicatesFound}`));
    console.log(chalk.green(`✅ Duplicates eliminated: ${this.results.duplicatesEliminated}`));
    console.log(chalk.green(`✅ Utilities created: ${this.results.utilitiesCreated.length}`));

    if (this.results.utilitiesCreated.length > 0) {
      console.log(chalk.blue('\n🛠️  New Utility Modules:'));
      this.results.utilitiesCreated.forEach(file => console.log(`   - ${file}`));
    }
  }
}

// Execute duplication elimination
const eliminator = new DuplicationEliminator();
eliminator.eliminate().catch(console.error);