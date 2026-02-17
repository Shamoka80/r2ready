#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for depth calculations
const depthCache = new Map();

function getDepth(filePath, distPath) {
  if (depthCache.has(filePath)) {
    return depthCache.get(filePath);
  }
  const relativePath = relative(distPath, dirname(filePath));
  const depth = relativePath === '' ? 0 : relativePath.split(sep).length;
  depthCache.set(filePath, depth);
  return depth;
}

function fixImportsInFile(filePath, distPath) {
  // Quick check: if file doesn't contain imports, skip it
  const originalContent = readFileSync(filePath, 'utf-8');
  
  // Early exit if no imports to fix
  if (!originalContent.includes('from ') && !originalContent.includes('import ')) {
    return false;
  }
  
  let content = originalContent;
  const depth = getDepth(filePath, distPath);
  
  // Fix @shared/* path alias imports: @shared/schema → ../shared/schema (or ../../shared/schema depending on depth)
  const aliasPattern = /from\s+['"]@shared\/([^'"]+)['"]/g;
  if (aliasPattern.test(content)) {
    content = content.replace(aliasPattern, (match, rest) => {
      const correctPath = depth === 0 ? './shared/' : '../'.repeat(depth) + 'shared/';
      const fullPath = correctPath + rest;
      // Add .js if not already there
      if (!fullPath.endsWith('.js') && !fullPath.endsWith('.json')) {
        return `from '${fullPath}.js'`;
      }
      return `from '${fullPath}'`;
    });
  }
  
  // Fix @shared imports: TypeScript paths like @shared/* compiled to relative paths
  // From dist/: ../shared/ → ./shared/
  // From dist/routes/: ../../shared/ → ../shared/
  // From dist/routes/subfolder/: ../../../shared/ → ../../shared/
  const sharedPattern = new RegExp(`from\\s+['"](\\.\\.\\/){${depth + 1}}shared\\/([^'"]+)['"]`, 'g');
  if (sharedPattern.test(content)) {
    content = content.replace(sharedPattern, (match, dots, rest) => {
      const correctPath = depth === 0 ? './shared/' : '../'.repeat(depth) + 'shared/';
      const fullPath = correctPath + rest;
      // Add .js if not already there
      if (!fullPath.endsWith('.js') && !fullPath.endsWith('.json')) {
        return `from '${fullPath}.js'`;
      }
      return `from '${fullPath}'`;
    });
  }
  
  // Fix relative imports to add .js extension
  // Matches: from "./something" or from './something'
  // Replaces with: from "./something.js" or from './something.js'
  const relativePattern = /from\s+['"](\.[^'"]+)['"]/g;
  if (relativePattern.test(content)) {
    content = content.replace(relativePattern, (match, importPath) => {
      // Only add .js if it doesn't already have an extension
      if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
        return `from '${importPath}.js'`;
      }
      return match;
    });
  }
  
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
    // Skip hidden files and build info
    if (item.startsWith('.') && item !== '.') {
      continue;
    }
    
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
  
  // Check if dist directory exists
  if (!existsSync(distPath)) {
    console.log('⚠️  No dist directory found, skipping import fixes');
    process.exit(0);
  }
  
  const fixedCount = processDirectory(distPath, distPath);
  if (fixedCount > 0) {
    console.log(`✅ Fixed imports in ${fixedCount} file(s)`);
  } else {
    console.log('✅ No import fixes needed');
  }
} catch (error) {
  console.error('❌ Failed to fix imports:', error.message);
  process.exit(1);
}
