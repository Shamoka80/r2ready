#!/usr/bin/env node
/**
 * Build wrapper that ensures clean exit after Vite build
 * Fixes Windows hanging issue where Vite build completes but process doesn't exit
 */

import { build } from 'vite';
import viteConfig from './vite.config.js';

// Set production mode
process.env.NODE_ENV = 'production';

try {
  // Run the build using Vite's build API
  await build(viteConfig);
  
  // Build completed successfully - force exit immediately
  // This ensures the process exits even if Vite leaves handles open
  process.exit(0);
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}

