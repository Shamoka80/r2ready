
import path from 'path';
import fs from 'fs';
import { TemplateValidator } from '../services/templateValidator';

async function main() {
  console.log('🔍 R2v3 Template Validation System');
  console.log('===================================\n');
  
  try {
    // Try multiple possible paths to find templates directory
    const possiblePaths = [
      path.resolve(__dirname, '../../Fixes/reports'),
      path.resolve(process.cwd(), 'Fixes/reports'),
      path.resolve(process.cwd(), './Fixes/reports'),
      path.resolve(__dirname, '../../../Fixes/reports')
    ];
    
    let templatesPath: string | null = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        templatesPath = testPath;
        break;
      }
    }
    
    if (!templatesPath) {
      throw new Error(`Templates directory not found. Searched paths: ${possiblePaths.join(', ')}`);
    }
    
    console.log(`Using templates path: ${templatesPath}`);
    const validator = new TemplateValidator(templatesPath);
    
    // Validate all templates
    const results = await validator.validateAllTemplates();
    
    console.log('Template Validation Results:');
    console.log('----------------------------');
    
    let allValid = true;
    for (const result of results) {
      const status = result.isValid ? '✅' : '❌';
      console.log(`${status} ${result.templateName}`);
      
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
        allValid = false;
      }
      
      if (result.warnings.length > 0) {
        console.log(`   Warnings: ${result.warnings.join(', ')}`);
      }
      
      console.log(`   Checksum: ${result.checksum.substring(0, 12)}...`);
      console.log(`   Modified: ${result.lastModified.toISOString()}\n`);
    }
    
    // Generate integrity report
    console.log('Template Integrity Report:');
    console.log('-------------------------');
    console.log(validator.generateValidationReport());
    
    if (allValid) {
      console.log('🎉 All templates validated successfully!');
      console.log('💫 System ready for production exports.');
      
      // Auto-lock templates if validation passes
      console.log('\n🔒 Locking template versions...');
      for (const result of results) {
        if (result.isValid) {
          await validator.lockTemplateVersion(result.templateName);
          console.log(`✅ Locked ${result.templateName}`);
        }
      }
      
      process.exit(0);
    } else {
      console.log('⚠️  Some templates failed validation.');
      console.log('❌ Fix template issues before proceeding to production.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Template validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
