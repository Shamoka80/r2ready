#!/usr/bin/env tsx

import { spawn, ChildProcess } from 'child_process';
import { watch } from 'fs';
import { debounce } from 'lodash';
import chalk from 'chalk';
import { resolve } from 'path';

interface WatcherConfig {
  paths: string[];
  debounceMs: number;
  ignored: string[];
}

const config: WatcherConfig = {
  paths: ['client/src', 'server', 'shared'],
  debounceMs: 1000,
  ignored: ['node_modules', 'dist', 'build', '.git', 'tests'],
};

class UIVerificationWatcher {
  private currentVerification: ChildProcess | null = null;
  private isRunning = false;

  constructor() {
    console.log(chalk.blue('🎭 UI Verification Watcher Started'));
    console.log(chalk.gray(`Watching: ${config.paths.join(', ')}`));
    this.startWatching();
  }

  private startWatching() {
    const debouncedVerify = debounce(() => this.runVerification(), config.debounceMs);

    config.paths.forEach(watchPath => {
      const fullPath = resolve(watchPath);
      
      watch(fullPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        
        // Skip ignored files/directories
        const shouldIgnore = config.ignored.some(ignored => 
          filename.includes(ignored) || filename.startsWith('.')
        );
        
        if (shouldIgnore) return;
        
        // Only watch relevant file types
        const isRelevantFile = /\.(ts|tsx|js|jsx|json)$/.test(filename);
        if (!isRelevantFile) return;

        console.log(chalk.yellow(`📝 File changed: ${filename}`));
        debouncedVerify();
      });
    });
  }

  private async runVerification() {
    if (this.isRunning) {
      console.log(chalk.blue('⏳ Verification already running, skipping...'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.blue('\n🔍 Running UI verification...'));

    try {
      // Kill any existing verification process
      if (this.currentVerification) {
        this.currentVerification.kill();
      }

      // Run quick verification (smoke tests only)
      this.currentVerification = spawn('npx', ['tsx', 'scripts/verify-ui.ts'], {
        stdio: 'inherit',
        env: { ...process.env, QUICK_MODE: 'true' }
      });

      this.currentVerification.on('exit', (code) => {
        this.isRunning = false;
        
        if (code === 0) {
          console.log(chalk.green('✅ UI verification passed!'));
        } else {
          console.log(chalk.red('❌ UI verification failed!'));
          console.log(chalk.yellow('💡 Run "npm run ui:fix" to auto-fix common issues'));
        }
        
        console.log(chalk.gray('👀 Waiting for changes...\n'));
      });

    } catch (error) {
      console.error(chalk.red('❌ Failed to start verification:'), error);
      this.isRunning = false;
    }
  }

  public stop() {
    if (this.currentVerification) {
      this.currentVerification.kill();
    }
    console.log(chalk.blue('🛑 UI Verification Watcher stopped'));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.blue('\n👋 Shutting down watcher...'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.blue('\n👋 Shutting down watcher...'));
  process.exit(0);
});

// Start the watcher
new UIVerificationWatcher();