// CRITICAL: Load environment variables BEFORE importing route modules
// Route modules import db.ts which requires DATABASE_URL
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file - check both server directory and root directory
const serverEnvPath = path.resolve(__dirname, '.env');
const rootEnvPath = path.resolve(__dirname, '..', '.env');

// Try server directory first, then root directory
const envPath = fs.existsSync(serverEnvPath) ? serverEnvPath : rootEnvPath;
if (fs.existsSync(envPath)) {
  const result = config({ path: envPath });
  if (result.error) {
    console.warn(`⚠️  Error loading .env from ${envPath}:`, result.error);
  } else {
    console.log(`📄 [routes.ts] Loaded environment variables from: ${envPath}`);
  }
} else {
  console.warn(`⚠️  [routes.ts] No .env file found in ${serverEnvPath} or ${rootEnvPath}`);
  // Fallback to default location
  const result = config();
  if (result.error) {
    console.warn(`⚠️  Error loading .env from default location:`, result.error);
  }
}

// Verify DATABASE_URL is loaded (for debugging)
if (!process.env.DATABASE_URL) {
  console.error(`❌ [routes.ts] DATABASE_URL not found after loading .env`);
  console.error(`   Checked paths: ${serverEnvPath}, ${rootEnvPath}`);
} else {
  console.log(`✅ [routes.ts] DATABASE_URL is set`);
}

import express, { Express } from 'express';
import { createServer } from 'http';

// Import all route modules
import authRoutes from './routes/auth.js';
import auth2faRoutes from './routes/auth2fa.js';
import assessmentRoutes from './routes/assessments.js';
import answerRoutes from './routes/answers.js';
import evidenceRoutes from './routes/evidence.js';
import scoringRoutes from './routes/scoring.js';
import exportRoutes from './routes/exports.js';
import intakeFormRoutes from './routes/intakeForms.js'; // Main intake forms with REC mapping
import intakeFacilitiesRoutes from './routes/intake-facilities.js';
import facilitiesRoutes from './routes/facilities.js';
import licensesRoutes from './routes/licenses.js';
import stripeRoutes from './routes/stripe.js';
import onboardingRoutes from './routes/onboarding.js';
import observabilityRoutes from './routes/observability.js';
import rbacRoutes from './routes/rbac.js';
import rbacAdminRoutes from './routes/rbac-admin.js';
import flagsRoutes from './routes/flags.js';
import featureFlagsRoutes from './routes/feature-flags.js';
import consultantFeaturesRoutes from './routes/consultant-features.js';
import clientPortalRoutes from './routes/client-portal.js';
import clientOrganizationsRoutes from './routes/client-organizations.js';
import clientFacilitiesRoutes from './routes/client-facilities.js';
import reviewWorkflowsRoutes from './routes/review-workflows.js';
import trainingCenterRoutes from './routes/training-center.js';
import analyticsRoutes from './routes/analytics.js';
import correctiveActionsRoutes from './routes/corrective-actions.js';
import milestonesRoutes from './routes/milestones.js';
import assessmentTemplatesRoutes from './routes/assessment-templates.js';
import cloudStorageIntegrationRoutes from './routes/cloud-storage-integration.js';
import cloudStorageRoutes from './routes/cloud-storage.js';
import oauthRoutes from './routes/oauth.js';
import dashboardRoutes from './routes/dashboard.js';
import tenantsRoutes from './routes/tenants.js';
import calendarRoutes from './routes/calendar.js';

// Import cache metrics routes
import cacheMetricsRoutes from './routes/cache-metrics.js';

// Import Phase 4: Configuration Layer routes
import configurationRoutes from './routes/configuration.js';

// Import Phase 3 Track 1: Performance Observability routes
import adminPerformanceRoutes from './routes/admin-performance.js';

export async function registerRoutes(app: Express) {
  // Health check endpoint for e2e tests and monitoring
  app.get('/api/health', (req, res) => {
    res.status(200).json({ ok: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  // Kubernetes-style liveness probe (checks if app is running)
  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Kubernetes-style readiness probe (checks if app is ready to serve traffic)
  app.get('/readyz', async (req, res) => {
    try {
      // Check critical dependencies
      const checks: Record<string, boolean> = {
        server: true,
      };

      // Test database connection if available
      if (process.env.DATABASE_URL) {
        try {
          const { testDatabaseConnection } = await import('./db.js');
          checks.database = await testDatabaseConnection();
        } catch (error) {
          checks.database = false;
        }
      }

      const allHealthy = Object.values(checks).every(check => check === true);

      if (allHealthy) {
        res.status(200).json({ 
          status: 'ready', 
          checks,
          timestamp: new Date().toISOString() 
        });
      } else {
        res.status(503).json({ 
          status: 'not ready', 
          checks,
          timestamp: new Date().toISOString() 
        });
      }
    } catch (error) {
      res.status(503).json({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString() 
      });
    }
  });

  // Register all API routes with proper prefixes
  app.use('/api/auth', authRoutes);
  app.use('/api/auth', auth2faRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/answers', answerRoutes);
  app.use('/api/evidence', evidenceRoutes);
  app.use('/api/scoring', scoringRoutes);
  app.use('/api/exports', exportRoutes);
  app.use('/api/intake-forms', intakeFormRoutes);
  app.use('/api/intake-facilities', intakeFacilitiesRoutes);
  app.use('/api/facilities', facilitiesRoutes);
  app.use('/api/licenses', licensesRoutes);
  app.use('/api/stripe', stripeRoutes);
  // NOTE: Stripe webhook route now handled in server/index.ts BEFORE express.json()
  // to preserve raw body buffer for signature verification
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api/observability', observabilityRoutes);
  app.use('/api', observabilityRoutes); // For direct /api/execute-sql access
  app.use('/api/rbac', rbacRoutes);
  app.use('/api/rbac', rbacAdminRoutes);
  app.use('/api/flags', flagsRoutes);
  app.use('/api/feature-flags', featureFlagsRoutes);
  app.use('/api/consultant', consultantFeaturesRoutes);
  app.use('/api/client-portal', clientPortalRoutes);
  app.use('/api/client-organizations', clientOrganizationsRoutes);
  app.use('/api/client-facilities', clientFacilitiesRoutes);
  app.use('/api/review-workflows', reviewWorkflowsRoutes);
  app.use('/api/training-center', trainingCenterRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/corrective-actions', correctiveActionsRoutes);
  app.use('/api/milestones', milestonesRoutes);
  app.use('/api/assessment-templates', assessmentTemplatesRoutes);
  app.use('/api/cloud-storage-integration', cloudStorageIntegrationRoutes);
  app.use('/api/cloud-storage', cloudStorageRoutes);
  app.use('/api/oauth', oauthRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/tenants', tenantsRoutes);
  app.use('/api/calendar', calendarRoutes);

  // Cache metrics and management
  app.use('/api/cache', cacheMetricsRoutes);

  // Phase 4: Configuration Layer (R2v3 Algorithm Enhancement)
  app.use('/api/configuration', configurationRoutes);

  // Phase 3 Track 1: Performance Observability (Admin-only)
  app.use('/api/admin/performance', adminPerformanceRoutes);

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

  // Create and return server instance
  const server = createServer(app);
  return server;
}
