
#!/usr/bin/env tsx

import { existsSync, statSync, readFileSync } from 'fs';
import chalk from 'chalk';

interface CriticalFile {
  path: string;
  description: string;
  minSizeBytes: number;
  requiredContent?: string[];
}

const CRITICAL_FILES: CriticalFile[] = [
  {
    path: 'shared/schema.ts',
    description: 'Database schema definitions - CRITICAL: DO NOT DELETE',
    minSizeBytes: 1000, // Minimum 1KB for a meaningful schema
    requiredContent: ['pgTable', 'users', 'assessments', 'export']
  },
  {
    path: 'server/db.ts',
    description: 'Database connection configuration',
    minSizeBytes: 100,
    requiredContent: ['drizzle', 'database']
  },
  {
    path: 'drizzle.config.ts',
    description: 'Drizzle ORM configuration',
    minSizeBytes: 50,
    requiredContent: ['defineConfig']
  },
  {
    path: 'package.json',
    description: 'Package configuration',
    minSizeBytes: 100,
    requiredContent: ['"name"', '"dependencies"']
  }
];

interface ValidationResult {
  file: CriticalFile;
  exists: boolean;
  hasContent: boolean;
  hasRequiredContent: boolean;
  size: number;
  errors: string[];
}

async function validateCriticalFiles(): Promise<boolean> {
  console.log(chalk.blue('🔍 Validating critical files...'));
  
  const results: ValidationResult[] = [];
  let allValid = true;

  for (const file of CRITICAL_FILES) {
    const result: ValidationResult = {
      file,
      exists: false,
      hasContent: false,
      hasRequiredContent: false,
      size: 0,
      errors: []
    };

    // Check if file exists
    if (!existsSync(file.path)) {
      result.errors.push(`File does not exist: ${file.path}`);
      allValid = false;
    } else {
      result.exists = true;
      
      // Check file size
      const stats = statSync(file.path);
      result.size = stats.size;
      
      if (stats.size === 0) {
        result.errors.push(`File is empty: ${file.path}`);
        allValid = false;
      } else if (stats.size < file.minSizeBytes) {
        result.errors.push(`File is too small (${stats.size} bytes < ${file.minSizeBytes} bytes): ${file.path}`);
        allValid = false;
      } else {
        result.hasContent = true;
      }

      // Check required content
      if (result.hasContent && file.requiredContent) {
        try {
          const content = readFileSync(file.path, 'utf8');
          const missingContent = file.requiredContent.filter(required => 
            !content.includes(required)
          );
          
          if (missingContent.length > 0) {
            result.errors.push(`Missing required content in ${file.path}: ${missingContent.join(', ')}`);
            allValid = false;
          } else {
            result.hasRequiredContent = true;
          }
        } catch (error) {
          result.errors.push(`Cannot read file ${file.path}: ${error}`);
          allValid = false;
        }
      }
    }

    results.push(result);
  }

  // Display results
  console.log(chalk.yellow('\n📋 Critical Files Validation Report:'));
  console.log(chalk.yellow('═'.repeat(60)));

  for (const result of results) {
    const status = result.errors.length === 0 ? chalk.green('✅ VALID') : chalk.red('❌ INVALID');
    console.log(`\n${status} ${result.file.path}`);
    console.log(chalk.gray(`   Description: ${result.file.description}`));
    
    if (result.exists) {
      console.log(chalk.gray(`   Size: ${result.size} bytes`));
    }
    
    if (result.errors.length > 0) {
      result.errors.forEach(error => {
        console.log(chalk.red(`   ❌ ${error}`));
      });
    }
  }

  console.log(chalk.yellow('\n═'.repeat(60)));
  
  if (allValid) {
    console.log(chalk.green('🎉 All critical files are valid!'));
  } else {
    console.log(chalk.red('💥 Critical file validation failed!'));
    console.log(chalk.yellow('\n🔧 To fix these issues:'));
    console.log(chalk.yellow('1. Ensure all critical files exist and have content'));
    console.log(chalk.yellow('2. Run the appropriate generators/setup scripts'));
    console.log(chalk.yellow('3. Check git history if files were accidentally deleted'));
  }

  return allValid;
}

// Run validation if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateCriticalFiles()
    .then(valid => process.exit(valid ? 0 : 1))
    .catch(error => {
      console.error(chalk.red('💥 Validation script failed:'), error);
      process.exit(1);
    });
}

export { validateCriticalFiles, CRITICAL_FILES };
