#!/usr/bin/env node
/**
 * Production entry point for RUR2 application
 * 
 * This file directly imports and runs the compiled server to avoid
 * child process spawning issues that can cause Replit deployment timeouts.
 * 
 * The server will:
 * - Listen on process.env.PORT (required by Replit)
 * - Bind to 0.0.0.0 (required for external access)
 * - Serve static files from client/dist
 * - Handle SPA routing with catch-all route
 * 
 * IMPORTANT: This file must keep the Node.js process alive.
 * Replit monitors the main process - if it exits, the deployment times out.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set production environment BEFORE any imports
// This ensures all modules see NODE_ENV=production
process.env.NODE_ENV = 'production';

// Resolve the compiled server path
const serverDistPath = join(__dirname, 'server', 'dist', 'server', 'index.js');

console.log('🚀 Starting RUR2 production server...');
console.log('📁 Server entry point:', serverDistPath);
console.log('🌍 Environment:', process.env.NODE_ENV);
console.log('🔌 Port:', process.env.PORT || '5000');

// Verify the server file exists
if (!existsSync(serverDistPath)) {
  console.error('❌ Server file not found:', serverDistPath);
  console.error('💡 Make sure you have run: npm run build');
  process.exit(1);
}

// Dynamically import and run the server
// Using dynamic import ensures the process stays alive
// The server/index.ts file calls startServer() which keeps the process running
import(serverDistPath).catch((error) => {
  console.error('❌ Failed to start server:', error);
  console.error('Error details:', error.message);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  process.exit(1);
});

// Keep the process alive - the server will handle this, but this ensures
// the process doesn't exit before the import completes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the server handle it
});
