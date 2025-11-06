#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_ENV = 'production';

const serverDistPath = join(__dirname, 'server', 'dist', 'server', 'index.js');

console.log('🚀 Starting RUR2 production server...');
console.log('📁 Server entry point:', serverDistPath);

const startServer = spawn('node', [serverDistPath], {
  stdio: 'inherit',
  env: { ...process.env }
});

startServer.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

startServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Server process exited with code ${code}`);
  }
  process.exit(code || 0);
});

process.on('SIGTERM', () => {
  console.log('📛 Received SIGTERM, shutting down gracefully...');
  startServer.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('📛 Received SIGINT, shutting down gracefully...');
  startServer.kill('SIGINT');
});
