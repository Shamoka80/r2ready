
#!/usr/bin/env tsx

/**
 * Comprehensive Mobile Responsiveness Verification Script
 * Tests mobile-first design principles and touch targets
 */

import { readFileSync } from 'fs';
import { glob } from 'glob';

interface ResponsivenessCheck {
  file: string;
  hasMobileFirst: boolean;
  hasTouchTargets: boolean;
  hasProperBreakpoints: boolean;
  hasFlexibleLayout: boolean;
  issues: string[];
}

async function verifyMobileResponsiveness() {
  console.log('🔍 Verifying Mobile Responsiveness Implementation...\n');

  // Get all component files
  const componentFiles = await glob('client/src/**/*.{tsx,jsx}');
  const results: ResponsivenessCheck[] = [];

  for (const file of componentFiles) {
    const content = readFileSync(file, 'utf-8');
    const check: ResponsivenessCheck = {
      file,
      hasMobileFirst: false,
      hasTouchTargets: false,
      hasProperBreakpoints: false,
      hasFlexibleLayout: false,
      issues: []
    };

    // Check for mobile-first design patterns
    check.hasMobileFirst = content.includes('w-full') || 
                          content.includes('max-w-') ||
                          content.includes('min-w-');

    // Check for touch-friendly targets (44px minimum)
    check.hasTouchTargets = content.includes('min-h-[44px]') ||
                           content.includes('min-h-[48px]') ||
                           content.includes('h-[44px]') ||
                           content.includes('touch-target');

    // Check for proper responsive breakpoints
    check.hasProperBreakpoints = content.includes('sm:') &&
                                content.includes('md:') ||
                                content.includes('lg:');

    // Check for flexible layouts
    check.hasFlexibleLayout = content.includes('flex-col') ||
                             content.includes('grid-cols-1') ||
                             content.includes('space-y-');

    // Identify issues
    if (!check.hasMobileFirst) check.issues.push('Missing mobile-first width classes');
    if (!check.hasTouchTargets) check.issues.push('Missing touch-friendly target sizes');
    if (!check.hasProperBreakpoints) check.issues.push('Missing responsive breakpoint classes');
    if (!check.hasFlexibleLayout) check.issues.push('Missing flexible layout patterns');

    // Check for problematic patterns
    if (content.includes('px-') && !content.includes('px-3') && !content.includes('px-4')) {
      check.issues.push('May have inadequate mobile padding');
    }
    
    if (content.includes('text-xs') && !content.includes('sm:text-')) {
      check.issues.push('Small text may not scale for mobile readability');
    }

    results.push(check);
  }

  // Report results
  console.log('📊 Mobile Responsiveness Verification Results:\n');
  
  let allGood = true;
  let totalFiles = results.length;
  let responsiveFiles = 0;

  for (const result of results) {
    const fileName = result.file.replace('client/src/', '');
    const isResponsive = result.issues.length === 0;
    const status = isResponsive ? '✅' : '⚠️';
    
    if (isResponsive) responsiveFiles++;
    else allGood = false;

    // Only show files with issues to reduce noise
    if (!isResponsive) {
      console.log(`${status} ${fileName}`);
      result.issues.forEach(issue => console.log(`   - ${issue}`));
      console.log();
    }
  }

  console.log(`📈 Mobile Responsiveness Score: ${responsiveFiles}/${totalFiles} (${Math.round((responsiveFiles/totalFiles) * 100)}%)\n`);

  if (allGood) {
    console.log('🎉 All components are mobile responsive!');
  } else {
    console.log('⚠️  Some components need mobile responsiveness improvements.');
    console.log('\n📋 Mobile Responsiveness Best Practices:');
    console.log('   1. Use mobile-first width classes (w-full, max-w-)');
    console.log('   2. Implement 44px minimum touch targets');
    console.log('   3. Use responsive breakpoints (sm:, md:, lg:)');
    console.log('   4. Design flexible layouts (flex-col, grid-cols-1)');
    console.log('   5. Ensure adequate mobile padding (px-3, px-4)');
    console.log('   6. Scale text appropriately for mobile');
  }

  return allGood;
}

// Run verification
verifyMobileResponsiveness()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
