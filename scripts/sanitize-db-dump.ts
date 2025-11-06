
#!/usr/bin/env tsx

import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import crypto from 'crypto';

interface SanitizationConfig {
  inputFile: string;
  outputFile: string;
  seed?: number;
  preserveStructure: boolean;
}

class DatabaseSanitizer {
  private config: SanitizationConfig;
  private emailMap: Map<string, string> = new Map();
  private nameMap: Map<string, string> = new Map();
  private phoneMap: Map<string, string> = new Map();
  private companyMap: Map<string, string> = new Map();

  constructor(config: SanitizationConfig) {
    this.config = config;
    if (config.seed) {
      faker.seed(config.seed);
    }
  }

  async sanitize(): Promise<void> {
    console.log(chalk.blue('🔒 Starting Database Dump Sanitization\n'));

    if (!fs.existsSync(this.config.inputFile)) {
      throw new Error(`Input file not found: ${this.config.inputFile}`);
    }

    console.log(`📂 Input: ${this.config.inputFile}`);
    console.log(`📂 Output: ${this.config.outputFile}\n`);

    const content = await fs.promises.readFile(this.config.inputFile, 'utf-8');
    let sanitizedContent = content;

    // Sanitize different data types
    sanitizedContent = this.sanitizeEmails(sanitizedContent);
    sanitizedContent = this.sanitizeNames(sanitizedContent);
    sanitizedContent = this.sanitizePhones(sanitizedContent);
    sanitizedContent = this.sanitizeSSNs(sanitizedContent);
    sanitizedContent = this.sanitizeAddresses(sanitizedContent);
    sanitizedContent = this.sanitizeCompanies(sanitizedContent);
    sanitizedContent = this.sanitizeCreditCards(sanitizedContent);
    sanitizedContent = this.sanitizePasswords(sanitizedContent);

    // Write sanitized content
    await fs.promises.writeFile(this.config.outputFile, sanitizedContent);

    console.log(chalk.green('✅ Database dump sanitization complete!\n'));
    this.generateReport();
  }

  private sanitizeEmails(content: string): string {
    console.log(chalk.yellow('📧 Sanitizing email addresses...'));
    
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    let count = 0;

    return content.replace(emailRegex, (match) => {
      if (this.emailMap.has(match)) {
        return this.emailMap.get(match)!;
      }

      // Create consistent hash-based email
      const hash = crypto.createHash('md5').update(match).digest('hex').substring(0, 8);
      const sanitized = `test-${hash}@sanitized-test.local`;
      this.emailMap.set(match, sanitized);
      count++;
      return sanitized;
    });
  }

  private sanitizeNames(content: string): string {
    console.log(chalk.yellow('👤 Sanitizing personal names...'));
    
    // Common name patterns in database dumps
    const namePatterns = [
      /('firstName'\s*:\s*'([^']+)')/g,
      /('lastName'\s*:\s*'([^']+)')/g,
      /('fullName'\s*:\s*'([^']+)')/g,
      /("firstName"\s*:\s*"([^"]+)")/g,
      /("lastName"\s*:\s*"([^"]+)")/g,
      /("fullName"\s*:\s*"([^"]+)")/g,
    ];

    let sanitized = content;
    namePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match, fullMatch, name) => {
        if (this.nameMap.has(name)) {
          return fullMatch.replace(name, this.nameMap.get(name)!);
        }

        const sanitizedName = faker.person.fullName();
        this.nameMap.set(name, sanitizedName);
        return fullMatch.replace(name, sanitizedName);
      });
    });

    return sanitized;
  }

  private sanitizePhones(content: string): string {
    console.log(chalk.yellow('📞 Sanitizing phone numbers...'));
    
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    
    return content.replace(phoneRegex, (match) => {
      if (this.phoneMap.has(match)) {
        return this.phoneMap.get(match)!;
      }

      const sanitized = faker.phone.number('555-###-####');
      this.phoneMap.set(match, sanitized);
      return sanitized;
    });
  }

  private sanitizeSSNs(content: string): string {
    console.log(chalk.yellow('🆔 Sanitizing SSN/Tax IDs...'));
    
    const ssnRegex = /\b\d{3}-?\d{2}-?\d{4}\b/g;
    
    return content.replace(ssnRegex, () => {
      return '000-00-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    });
  }

  private sanitizeAddresses(content: string): string {
    console.log(chalk.yellow('🏠 Sanitizing addresses...'));
    
    const addressPatterns = [
      /('address'\s*:\s*'([^']+)')/g,
      /('street'\s*:\s*'([^']+)')/g,
      /('city'\s*:\s*'([^']+)')/g,
      /("address"\s*:\s*"([^"]+)")/g,
      /("street"\s*:\s*"([^"]+)")/g,
      /("city"\s*:\s*"([^"]+)")/g,
    ];

    let sanitized = content;
    addressPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match, fullMatch, address) => {
        const sanitizedAddress = faker.location.streetAddress();
        return fullMatch.replace(address, sanitizedAddress);
      });
    });

    return sanitized;
  }

  private sanitizeCompanies(content: string): string {
    console.log(chalk.yellow('🏢 Sanitizing company names...'));
    
    const companyPatterns = [
      /('companyName'\s*:\s*'([^']+)')/g,
      /('organization'\s*:\s*'([^']+)')/g,
      /("companyName"\s*:\s*"([^"]+)")/g,
      /("organization"\s*:\s*"([^"]+)")/g,
    ];

    let sanitized = content;
    companyPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match, fullMatch, company) => {
        if (this.companyMap.has(company)) {
          return fullMatch.replace(company, this.companyMap.get(company)!);
        }

        const sanitizedCompany = faker.company.name() + ' (Test)';
        this.companyMap.set(company, sanitizedCompany);
        return fullMatch.replace(company, sanitizedCompany);
      });
    });

    return sanitized;
  }

  private sanitizeCreditCards(content: string): string {
    console.log(chalk.yellow('💳 Sanitizing credit card numbers...'));
    
    const ccRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
    
    return content.replace(ccRegex, () => {
      return '4242424242424242'; // Stripe test card
    });
  }

  private sanitizePasswords(content: string): string {
    console.log(chalk.yellow('🔐 Sanitizing password hashes...'));
    
    // Hash patterns (bcrypt, argon2, etc.)
    const hashPatterns = [
      /\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}/g, // bcrypt
      /\$argon2[id]\$[^$]+\$[^$]+\$[A-Za-z0-9+/=]+/g, // argon2
    ];

    let sanitized = content;
    hashPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, () => {
        return '$2b$10$TEST.SANITIZED.PASSWORD.HASH.FOR.DEVELOPMENT.USE';
      });
    });

    return sanitized;
  }

  private generateReport(): void {
    console.log(chalk.blue('📊 Sanitization Report:\n'));
    console.log(`📧 Emails sanitized: ${this.emailMap.size}`);
    console.log(`👤 Names sanitized: ${this.nameMap.size}`);
    console.log(`📞 Phones sanitized: ${this.phoneMap.size}`);
    console.log(`🏢 Companies sanitized: ${this.companyMap.size}\n`);

    // Generate mapping file for reference
    const mappingFile = this.config.outputFile.replace(/\.[^.]+$/, '.mapping.json');
    const mapping = {
      timestamp: new Date().toISOString(),
      emails: Object.fromEntries(this.emailMap),
      names: Object.fromEntries(this.nameMap),
      phones: Object.fromEntries(this.phoneMap),
      companies: Object.fromEntries(this.companyMap),
    };

    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2));
    console.log(chalk.green(`📋 Mapping file saved: ${mappingFile}`));
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(chalk.red('❌ Usage: npx tsx scripts/sanitize-db-dump.ts <input-file> [output-file]'));
    console.log('\nExample:');
    console.log('  npx tsx scripts/sanitize-db-dump.ts backup.sql sanitized-backup.sql');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile.replace(/(\.[^.]+)?$/, '.sanitized$1');

  try {
    const sanitizer = new DatabaseSanitizer({
      inputFile,
      outputFile,
      seed: 12345, // Deterministic for testing
      preserveStructure: true
    });

    await sanitizer.sanitize();
    
    console.log(chalk.green('\n🎉 Database sanitization completed successfully!'));
    console.log(chalk.blue('⚠️  Remember: This sanitized dump is for non-production use only.'));
    
  } catch (error) {
    console.error(chalk.red('💥 Sanitization failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseSanitizer };
