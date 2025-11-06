
#!/usr/bin/env tsx

/**
 * Mobile Navigation Verification Script
 * Verifies that all pages have proper mobile-responsive headers
 */

import { readFileSync } from 'fs';
import { glob } from 'glob';

interface NavigationCheck {
  file: string;
  hasSheet: boolean;
  hasMenu: boolean;
  hasCenteredLogo: boolean;
  hasHamburgerButton: boolean;
  issues: string[];
}

async function verifyMobileNavigation() {
  console.log('🔍 Verifying Mobile Navigation Implementation...\n');

  // Get all page files
  const pageFiles = await glob('client/src/pages/*.tsx');
  const results: NavigationCheck[] = [];

  for (const file of pageFiles) {
    const content = readFileSync(file, 'utf-8');
    const check: NavigationCheck = {
      file,
      hasSheet: false,
      hasMenu: false,
      hasCenteredLogo: false,
      hasHamburgerButton: false,
      issues: []
    };

    // Check for Sheet component usage
    check.hasSheet = content.includes('import') && content.includes('Sheet');
    
    // Check for Menu icon
    check.hasMenu = content.includes('Menu') && content.includes('lucide-react');
    
    // Check for centered logo on mobile
    check.hasCenteredLogo = content.includes('absolute left-1/2 transform -translate-x-1/2');
    
    // Check for hamburger button
    check.hasHamburgerButton = content.includes('SheetTrigger') && content.includes('Menu');

    // Identify issues
    if (!check.hasSheet) check.issues.push('Missing Sheet component import');
    if (!check.hasMenu) check.issues.push('Missing Menu icon');
    if (!check.hasCenteredLogo) check.issues.push('Logo not centered on mobile');
    if (!check.hasHamburgerButton) check.issues.push('Missing hamburger menu button');

    results.push(check);
  }

  // Report results
  console.log('📊 Mobile Navigation Verification Results:\n');
  
  let allGood = true;
  for (const result of results) {
    const fileName = result.file.replace('client/src/pages/', '');
    const status = result.issues.length === 0 ? '✅' : '❌';
    
    console.log(`${status} ${fileName}`);
    
    if (result.issues.length > 0) {
      allGood = false;
      result.issues.forEach(issue => console.log(`   - ${issue}`));
    }
    console.log();
  }

  if (allGood) {
    console.log('🎉 All pages have proper mobile navigation!');
  } else {
    console.log('⚠️  Some pages need mobile navigation fixes.');
    console.log('\n📋 Summary of what each page should have:');
    console.log('   1. Sheet component imported and used for mobile menu');
    console.log('   2. Menu icon from lucide-react');
    console.log('   3. Logo centered on mobile with absolute positioning');
    console.log('   4. Hamburger button that opens the Sheet menu');
  }

  return allGood;
}

// Run verification
verifyMobileNavigation()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
