#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { db } from '../server/db';

class SystemFixer {
  async fixAllSystemErrors(): Promise<void> {
    console.log(chalk.blue('🔧 Starting System Error Resolution\n'));

    await this.fixDatabaseIssues();
    await this.fixRoutingIssues();
    await this.fixImportIssues();
    await this.fixAPIEndpointIssues();
    await this.validateFixes();
  }

  private async fixDatabaseIssues(): Promise<void> {
    console.log(chalk.yellow('📊 Fixing Database Issues...'));

    try {
      // Ensure database is accessible
      await db.execute('SELECT 1');
      console.log(chalk.green('✅ Database connection verified'));
    } catch (error) {
      console.log(chalk.red('❌ Database connection failed, attempting fix...'));

      // Run migrations if needed
      try {
        execSync('cd server && npm run db:migrate', { stdio: 'inherit' });
        console.log(chalk.green('✅ Database migrations applied'));
      } catch (migrationError) {
        console.log(chalk.red('❌ Migration failed:', migrationError));
      }
    }
  }

  private async fixRoutingIssues(): Promise<void> {
    console.log(chalk.yellow('🎯 Fixing Routing Issues...'));

    // Check if routes.ts exists and is properly configured
    const routesPath = 'server/routes.ts';
    if (!existsSync(routesPath)) {
      console.log(chalk.yellow('⚠️ Creating missing routes.ts file'));

      const routesContent = `
import { Router } from 'express';
import authRoutes from './routes/auth';
import assessmentRoutes from './routes/assessments';
import intakeFormRoutes from './routes/intake-forms';
import exportRoutes from './routes/exports';
import onboardingRoutes from './routes/onboarding';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';

const router = Router();

// Health check
router.use('/health', healthRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// Core functionality routes
router.use('/assessments', assessmentRoutes);
router.use('/intake-forms', intakeFormRoutes);
router.use('/exports', exportRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
`;

      writeFileSync(routesPath, routesContent);
      console.log(chalk.green('✅ Routes configuration created'));
    }

    // Ensure server/index.ts uses the routes
    const serverIndexPath = 'server/index.ts';
    if (existsSync(serverIndexPath)) {
      let content = readFileSync(serverIndexPath, 'utf8');
      if (!content.includes('import routes from')) {
        const routeImport = "import routes from './routes';\n";
        const routeUse = "app.use('/api', routes);\n";

        // Add import at the top
        content = routeImport + content;

        // Add route usage before server start
        content = content.replace(
          'app.listen(',
          routeUse + '\napp.listen('
        );

        writeFileSync(serverIndexPath, content);
        console.log(chalk.green('✅ Server routes integration added'));
      }
    }
  }

  private async fixImportIssues(): Promise<void> {
    console.log(chalk.yellow('📦 Fixing Import Issues...'));

    try {
      // Check TypeScript compilation
      execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
      console.log(chalk.green('✅ No TypeScript import errors'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ TypeScript errors found, attempting auto-fix...'));

      // Common fixes for import issues
      await this.fixCommonImportErrors();
    }
  }

  private async fixCommonImportErrors(): Promise<void> {
    const commonFixes = [
      {
        file: 'server/services/exportService.ts',
        fix: () => this.ensureExportServiceImports()
      },
      {
        file: 'client/src/pages/ExportCenter.tsx', 
        fix: () => this.ensureExportCenterImports()
      },
      {
        file: 'server/routes/exports.ts',
        fix: () => this.ensureExportsRouteImports()
      }
    ];

    for (const fix of commonFixes) {
      if (existsSync(fix.file)) {
        try {
          await fix.fix();
          console.log(chalk.green(`✅ Fixed imports in ${fix.file}`));
        } catch (error) {
          console.log(chalk.yellow(`⚠️ Could not auto-fix ${fix.file}: ${error}`));
        }
      }
    }
  }

  private ensureExportServiceImports(): void {
    const path = 'server/services/exportService.ts';
    let content = readFileSync(path, 'utf8');

    // Ensure PDFKit import
    if (!content.includes("import PDFDocument from 'pdfkit'")) {
      content = "import PDFDocument from 'pdfkit';\n" + content;
    }

    // Ensure ExcelJS import  
    if (!content.includes("import ExcelJS from 'exceljs'")) {
      content = "import ExcelJS from 'exceljs';\n" + content;
    }

    // Ensure docx import
    if (!content.includes("import { Document, Packer")) {
      content = "import { Document, Packer, Paragraph, TextRun } from 'docx';\n" + content;
    }

    writeFileSync(path, content);
  }

  private ensureExportCenterImports(): void {
    const path = 'client/src/pages/ExportCenter.tsx';
    let content = readFileSync(path, 'utf8');

    // Ensure all required UI imports are present
    const requiredImports = [
      "import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';",
      "import { Button } from '../components/ui/button';",
      "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';"
    ];

    for (const importLine of requiredImports) {
      if (!content.includes(importLine)) {
        content = importLine + '\n' + content;
      }
    }

    writeFileSync(path, content);
  }

  private ensureExportsRouteImports(): void {
    const path = 'server/routes/exports.ts';
    let content = readFileSync(path, 'utf8');

    // Ensure required imports
    const requiredImports = [
      "import express, { Response } from 'express';",
      "import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';",
      "import { ExportService } from '../services/exportService';"
    ];

    for (const importLine of requiredImports) {
      const importName = importLine.split(' from ')[0];
      if (!content.includes(importName)) {
        content = importLine + '\n' + content;
      }
    }

    writeFileSync(path, content);
  }

  private async fixAPIEndpointIssues(): Promise<void> {
    console.log(chalk.yellow('🌐 Fixing API Endpoint Issues...'));

    // Test critical endpoints and create missing ones
    const endpoints = [
      { path: '/api/health', handler: 'health' },
      { path: '/api/exports/templates', handler: 'exports' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://0.0.0.0:5000${endpoint.path}`);
        if (!response.ok && response.status !== 401) {
          console.log(chalk.yellow(`⚠️ Endpoint ${endpoint.path} not working properly`));
          await this.createMissingEndpoint(endpoint);
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Endpoint ${endpoint.path} unreachable: ${error}`));
      }
    }
  }

  private async createMissingEndpoint(endpoint: { path: string; handler: string }): Promise<void> {
    if (endpoint.handler === 'health') {
      const healthPath = 'server/routes/health.ts';
      if (!existsSync(healthPath)) {
        const healthRoute = `
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
`;
        writeFileSync(healthPath, healthRoute);
        console.log(chalk.green('✅ Created health endpoint'));
      }
    }
  }

  private async validateFixes(): Promise<void> {
    console.log(chalk.yellow('🔍 Validating System Fixes...'));

    try {
      // Test TypeScript compilation
      execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
      console.log(chalk.green('✅ TypeScript compilation successful'));
    } catch (error) {
      console.log(chalk.red('❌ TypeScript errors remain after fixes'));
    }

    // Test server health
    try {
      const response = await fetch('http://0.0.0.0:5000/api/health');
      if (response.ok) {
        console.log(chalk.green('✅ Server health check successful'));
      } else {
        console.log(chalk.yellow('⚠️ Server health check returned:', response.status));
      }
    } catch (error) {
      console.log(chalk.red('❌ Server health check failed:', error));
    }

    // Test database
    try {
      await db.execute('SELECT 1');
      console.log(chalk.green('✅ Database connection validated'));
    } catch (error) {
      console.log(chalk.red('❌ Database connection still failing:', error));
    }

    console.log(chalk.blue('\n🎯 System fixes completed. Ready for E2E testing!'));
  }
}

async function main() {
  const fixer = new SystemFixer();
  await fixer.fixAllSystemErrors();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}