#!/usr/bin/env tsx

import { readdir, stat, unlink, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

async function cleanupTests() {
  console.log(chalk.blue('🧹 Cleaning up and consolidating tests...'));

  const testDirs = [
    'server/tests',
    'tests',
    'client/src/tests'
  ];

  let cleanedFiles = 0;
  let consolidatedTests = 0;

  for (const testDir of testDirs) {
    try {
      const dirStat = await stat(testDir);
      if (!dirStat.isDirectory()) continue;

      const files = await readdir(testDir, { recursive: true });

      for (const file of files) {
        const filePath = join(testDir, file.toString());

        try {
          const fileContent = await readFile(filePath, 'utf-8');

          // Remove placeholder tests
          if (fileContent.includes('placeholder') ||
              fileContent.includes('not yet implemented') ||
              fileContent.includes('TODO:') ||
              fileContent.length < 100) {

            console.log(chalk.yellow(`🗑️ Removing placeholder test: ${filePath}`));
            await unlink(filePath);
            cleanedFiles++;
          }

          // Convert old test patterns to modern ones
          if (fileContent.includes('describe.skip') || fileContent.includes('test.skip')) {
            const updatedContent = fileContent
              .replace(/describe\.skip/g, 'describe')
              .replace(/test\.skip/g, 'test')
              .replace(/it\.skip/g, 'it');

            await writeFile(filePath, updatedContent);
            consolidatedTests++;
            console.log(chalk.green(`✅ Updated test: ${filePath}`));
          }

        } catch (readError) {
          // Skip files that can't be read as text
        }
      }
    } catch (dirError) {
      // Skip directories that don't exist
    }
  }

  console.log(chalk.green(`✅ Test cleanup complete:`));
  console.log(chalk.green(`   - Removed ${cleanedFiles} placeholder tests`));
  console.log(chalk.green(`   - Updated ${consolidatedTests} test files`));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupTests();
}