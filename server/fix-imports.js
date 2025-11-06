#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fixImportsInFile(filePath, distPath) {
  const originalContent = readFileSync(filePath, 'utf-8');
  let content = originalContent;
  
  // Calculate depth from dist root
  const relativePath = relative(distPath, dirname(filePath));
  const depth = relativePath === '' ? 0 : relativePath.split(sep).length;
  
  // Fix @shared/* path alias imports: @shared/schema → ../shared/schema (or ../../shared/schema depending on depth)
  const aliasPattern = /from\s+['"]@shared\/([^'"]+)['"]/g;
  content = content.replace(aliasPattern, (match, rest) => {
    const correctPath = depth === 0 ? './shared/' : '../'.repeat(depth) + 'shared/';
    const fullPath = correctPath + rest;
    // Add .js if not already there
    if (!fullPath.endsWith('.js') && !fullPath.endsWith('.json')) {
      return `from '${fullPath}.js'`;
    }
    return `from '${fullPath}'`;
  });
  
  // Fix @shared imports: TypeScript paths like @shared/* compiled to relative paths
  // From dist/: ../shared/ → ./shared/
  // From dist/routes/: ../../shared/ → ../shared/
  // From dist/routes/subfolder/: ../../../shared/ → ../../shared/
  const sharedPattern = new RegExp(`from\\s+['"](\\.\\.\\/){${depth + 1}}shared\\/([^'"]+)['"]`, 'g');
  content = content.replace(sharedPattern, (match, dots, rest) => {
    const correctPath = depth === 0 ? './shared/' : '../'.repeat(depth) + 'shared/';
    const fullPath = correctPath + rest;
    // Add .js if not already there
    if (!fullPath.endsWith('.js') && !fullPath.endsWith('.json')) {
      return `from '${fullPath}.js'`;
    }
    return `from '${fullPath}'`;
  });
  
  // Fix relative imports to add .js extension
  // Matches: from "./something" or from './something'
  // Replaces with: from "./something.js" or from './something.js'
  content = content.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, importPath) => {
    // Only add .js if it doesn't already have an extension
    if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
      return `from '${importPath}.js'`;
    }
    return match;
  });
  
  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

function processDirectory(dirPath, distPath) {
  let fixedCount = 0;
  const items = readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = join(dirPath, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      fixedCount += processDirectory(fullPath, distPath);
    } else if (item.endsWith('.js')) {
      if (fixImportsInFile(fullPath, distPath)) {
        fixedCount++;
      }
    }
  }
  
  return fixedCount;
}

try {
  const distPath = join(__dirname, 'dist');
  const fixedCount = processDirectory(distPath, distPath);
  console.log(`✅ Fixed imports in ${fixedCount} file(s)`);
} catch (error) {
  console.error('❌ Failed to fix imports:', error.message);
  process.exit(1);
}
