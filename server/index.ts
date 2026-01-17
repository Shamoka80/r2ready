// ============================================================================
// ES MODULES COMPATIBILITY: Define __dirname and __filename
// ============================================================================
// WHY: ES Modules don't provide __dirname/__filename like CommonJS does.
// We must compute them from import.meta.url using the official Node.js pattern.
// This must be at the top so these globals are available throughout the file.
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// LOAD ENVIRONMENT VARIABLES FIRST (CRITICAL - before any other imports)
// ============================================================================
// WHY: VS Code/Cursor may show "terminal environment injection is disabled"
// This warning is editor-specific and does NOT affect runtime. We load .env
// explicitly here to ensure environment variables are ALWAYS available at
// runtime, regardless of editor settings. This makes the app production-safe
// and editor-agnostic.
import { config } from 'dotenv';
import fs from 'fs';

// First, try default dotenv behavior (loads from process.cwd()/.env)
// This covers the most common case and ensures .env is loaded if it exists
const defaultResult = config({ override: false });
let envLoaded = !!defaultResult.parsed;
let envVarCount = defaultResult.parsed ? Object.keys(defaultResult.parsed).length : 0;
let envPath = path.join(process.cwd(), '.env');

// If default didn't load anything, try additional common locations
// This handles cases where the script runs from different directories
if (!envLoaded) {
  const alternatePaths = [
    path.join(__dirname, '.env'),           // server/.env (when compiled)
    path.join(__dirname, '..', '.env'),     // root/.env (when in server/)
  ];
  
  for (const envPathCandidate of alternatePaths) {
    if (fs.existsSync(envPathCandidate)) {
      const result = config({ path: envPathCandidate, override: false });
      if (result.parsed && Object.keys(result.parsed).length > 0) {
        envVarCount = Object.keys(result.parsed).length;
        envLoaded = true;
        envPath = envPathCandidate;
        break;
      }
    }
  }
}

// Log status (only in development to avoid noise in production)
if (process.env.NODE_ENV !== 'production') {
  if (envLoaded && envVarCount > 0) {
    console.log(`✅ Loaded ${envVarCount} environment variable(s) from: ${envPath}`);
  } else {
    console.log('ℹ️  No .env file found - using system environment variables');
  }
}

// ============================================================================
// SENTRY INITIALIZATION
// ============================================================================
// Sentry is initialized here (before other imports) to capture all errors.
// Configuration: Read SENTRY_DSN from environment variables loaded by dotenv.
// If initialization fails, the app continues without error monitoring.
// Docs: https://docs.sentry.io/platforms/javascript/guides/node/
import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
const IS_PRODUCTION = ENVIRONMENT === 'production';

// Track whether Sentry was successfully initialized
let SENTRY_INITIALIZED = false;

// Initialize Sentry if DSN is provided - SDK handles validation
if (SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      
      // Performance monitoring - traces sampling (adjust in production)
      // Lower sample rate in production to reduce overhead
      tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
      
      // Capture console errors
      attachStacktrace: true,
      
      // Send release information (helpful for debugging)
      release: process.env.npm_package_version || undefined,
      
      // Filter out health check noise
      ignoreErrors: [
        'Request timeout',
        'ECONNRESET',
        'ECONNREFUSED',
      ],
      
      // Error filtering before sending to Sentry
      beforeSend(event: any, hint: any) {
        return event;
      },
    } as any); // Type assertion to fix build error - captureUnhandledRejections is enabled by default
    
    // Mark Sentry as initialized - Express middleware setup happens in createApp()
    // Express-specific handlers (requestHandler, errorHandler) are only available
    // when Express is imported, so middleware integration is handled separately
    SENTRY_INITIALIZED = true;
    if (!IS_PRODUCTION) {
      console.log('✅ Sentry initialized for error monitoring');
    }
  } catch (error) {
    // Sentry initialization failed - log error but continue server startup
    // Sentry SDK handles DSN validation and will throw if invalid
    console.error('❌ Sentry initialization failed:', error instanceof Error ? error.message : String(error));
    console.warn('⚠️  Continuing server startup without Sentry error monitoring');
    SENTRY_INITIALIZED = false;
  }
}

import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { Socket } from 'net';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { registerRoutes } from "./routes.js";
import { testDatabaseConnection } from "./db.js";
import { performanceMonitor } from './middleware/performanceMonitoringMiddleware.js';
import { observabilityMiddleware } from './middleware/observabilityMiddleware.js';
import { corsOptions, devCorsOptions, handleCorsPreflightMiddleware, securityHeadersMiddleware } from './middleware/corsMiddleware.js';
import { validateSchemaConsistency, SchemaValidationError } from './utils/schemaValidator.js';
import { db } from './db.js';
import { questionMapping, questions, recMapping } from '../shared/schema.js';
import { sql } from 'drizzle-orm';
// Import routes
import authRoutes from './routes/auth';
import serviceDirectoryRoutes from './routes/service-directory';
import jobRoutes from './routes/jobs.js';
import teamRoutes from './routes/team.js';
import Stripe from 'stripe';
import { handleStripeWebhook } from './routes/stripe-webhooks.js';
import { jobWorker } from './workers/jobWorker.js';
import { jobQueueService } from './services/jobQueue.js';
import { QueryMonitoringService } from './services/queryMonitoring.js';
import { emailService } from './services/emailService.js';

export async function createApp() {
  const app = express();

  // Initialize Sentry Express middleware (must be before all other middleware)
  // This captures request context for error tracking
  // Note: Handlers are Express-specific, so they're only set up here where Express is available
  if (SENTRY_INITIALIZED && (Sentry as any).Handlers) {
    try {
      const handlers = (Sentry as any).Handlers;
      if (typeof handlers.requestHandler === 'function') {
        app.use(handlers.requestHandler());
      }
      if (typeof handlers.tracingHandler === 'function') {
        app.use(handlers.tracingHandler());
      }
    } catch (error) {
      // If handler setup fails, log but continue - app should still work
      // Error monitoring for unhandled exceptions still works without Express middleware
      console.warn('⚠️  Failed to set up Sentry Express middleware:', error instanceof Error ? error.message : String(error));
      console.warn('   Error monitoring will still work for unhandled exceptions');
    }
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  app.use(cors(isDevelopment ? devCorsOptions : corsOptions));
  app.use(handleCorsPreflightMiddleware);
  app.use(securityHeadersMiddleware);

  // CRITICAL: Stripe webhook endpoint MUST be defined BEFORE express.json()
  // Stripe's signature verification requires the RAW body buffer, not parsed JSON
  const stripeSecretKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
    apiVersion: '2025-08-27.basil',
  }) : null;

  app.post(
    '/webhook/stripe/stripe-webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        console.error('STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).send('Webhook configuration error');
      }

      if (!sig) {
        console.error('Missing stripe-signature header');
        return res.status(400).send('Missing stripe-signature header');
      }

      if (!stripe) {
        console.error('Stripe not initialized - missing API key');
        return res.status(500).send('Stripe configuration error');
      }

      let event: Stripe.Event;

      try {
        // Verify webhook signature with RAW body buffer
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      try {
        // Delegate to event handler
        await handleStripeWebhook(event);
        res.json({ received: true });
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Webhook processing failed');
      }
    }
  );

  // NOW apply express.json() for all other routes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  if (!isTest) {
    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.path;
      let capturedJsonResponse: Record<string, any> | undefined = undefined;

      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
          let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
          if (capturedJsonResponse && res.statusCode >= 400) {
            logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
          }

          if (logLine.length > 120) {
            logLine = logLine.slice(0, 119) + "…";
          }

          console.log(`[express] ${logLine}`);
        }
      });

      next();
    });
  }

  await registerRoutes(app);

  // Sentry error handler (must be before final error handler, but after all routes)
  // This captures Express route exceptions and sends them to Sentry with full context
  // Email alerts are triggered by Sentry based on alert rules configured in dashboard
  // Note: This is Express-specific middleware - unhandled exceptions are captured globally
  if (SENTRY_INITIALIZED && (Sentry as any).Handlers) {
    try {
      const handlers = (Sentry as any).Handlers;
      if (typeof handlers.errorHandler === 'function') {
        app.use(handlers.errorHandler());
      }
    } catch (error) {
      // If error handler setup fails, log but continue - app should still work
      // Error monitoring for unhandled exceptions still works without Express middleware
      console.warn('⚠️  Failed to set up Sentry Express error handler:', error instanceof Error ? error.message : String(error));
      console.warn('   Error monitoring will still work for unhandled exceptions');
    }
  }

  app.use((err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Capture error in Sentry (when successfully initialized)
    // Sentry will automatically send email notifications based on alert rules
    // Configure alerts at: https://sentry.io/settings/[org]/[project]/alerts/
    // SAFETY: Only capture if Sentry was successfully initialized
    if (SENTRY_INITIALIZED && status >= 500) {
      try {
        Sentry.captureException(err, {
          tags: {
            route: req.path,
            method: req.method,
            statusCode: status.toString(),
          },
          extra: {
            url: req.url,
            headers: req.headers,
            // Note: Don't include sensitive user data here
          },
          level: 'error',
        });
        console.error(`[ERROR] ${req.method} ${req.path} - ${status} (reported to Sentry)`);
      } catch (sentryError) {
        // If Sentry capture fails, log the original error normally
        console.error(`[ERROR] ${req.method} ${req.path} - ${status} (Sentry capture failed)`);
        if (!isTest) {
          console.error('Error details:', err.message);
        }
      }
    } else {
      // Log error details server-side (never send stack traces to client)
      if (!isTest) {
        console.error(`[ERROR] ${req.method} ${req.path} - ${status}`);
        if (!isProduction) {
          console.error('Error details:', err.message);
          console.error('Error stack:', err.stack);
        }
      }
    }

    // Send generic error in production, detailed errors in development
    res.status(status).json({
      message: isProduction && status === 500 ? 'Internal server error' : err.message,
      path: req.path,
      timestamp: new Date().toISOString()
      // NEVER include: stack, user data, internal paths, or sensitive details
    });
  });

  return app;
}

// Lightweight configuration validation
function validateConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const warnings = [];

  // Check JWT configuration
  const secret = process.env.JWT_SECRET;
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (!secret && (!privateKey || !publicKey)) {
    warnings.push('JWT configuration missing - authentication features will be limited');
  } else if (secret && secret.length < 32) {
    warnings.push('JWT_SECRET is short - consider using a longer key for security');
  }

  // Check database
  if (!process.env.DATABASE_URL) {
    warnings.push('DATABASE_URL not set - database features will be unavailable');
  }

  // Log warnings if any
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach(w => console.warn(`   - ${w}`));
  } else {
    console.log('✅ Configuration validated');
  }
}

async function scheduleDailyPurgeJob() {
  const SYSTEM_TENANT_ID = 'system';
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  async function enqueuePurgeJob() {
    try {
      const jobId = await jobQueueService.enqueue({
        tenantId: SYSTEM_TENANT_ID,
        type: 'purge_slow_query_logs',
        payload: {},
        priority: 'low',
        maxAttempts: 2,
      });
    } catch (error) {
      console.error('Failed to enqueue purge job:', error);
    }
  }

  await enqueuePurgeJob();

  setInterval(enqueuePurgeJob, ONE_DAY_MS);

  console.log('✅ Daily slow query log purge job scheduled');
}

async function scheduleDailyAnalyzeJobs() {
  const SYSTEM_TENANT_ID = 'system';
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const HOT_TABLES = ['User', 'Assessment', 'Answer', 'EvidenceFile', 'Question'];

  async function enqueueAnalyzeJobs() {
    for (let i = 0; i < HOT_TABLES.length; i++) {
      const tableName = HOT_TABLES[i];
      
      setTimeout(async () => {
        try {
          const jobId = await jobQueueService.enqueue({
            tenantId: SYSTEM_TENANT_ID,
            type: 'analyze_table',
            payload: { tableName },
            priority: 'low',
            maxAttempts: 2,
          });
          console.log(`📊 Scheduled ANALYZE job for ${tableName}: ${jobId}`);
        } catch (error) {
          console.error(`Failed to enqueue ANALYZE job for ${tableName}:`, error);
        }
      }, i * 5000);
    }
  }

  await enqueueAnalyzeJobs();

  setInterval(enqueueAnalyzeJobs, ONE_DAY_MS);

  console.log(`✅ Daily ANALYZE jobs scheduled for ${HOT_TABLES.length} hot tables`);
}

async function scheduleWeeklyVacuumJobs() {
  const SYSTEM_TENANT_ID = 'system';
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const ALL_TABLES = [
    'User', 
    'Assessment', 
    'Answer', 
    'EvidenceFile', 
    'Question',
    'Facility',
    'IntakeForm',
    'License',
    'jobs',
    'slow_query_log'
  ];

  async function enqueueVacuumJobs() {
    for (let i = 0; i < ALL_TABLES.length; i++) {
      const tableName = ALL_TABLES[i];
      
      setTimeout(async () => {
        try {
          const jobId = await jobQueueService.enqueue({
            tenantId: SYSTEM_TENANT_ID,
            type: 'vacuum_table',
            payload: { tableName },
            priority: 'low',
            maxAttempts: 2,
          });
          console.log(`🧹 Scheduled VACUUM job for ${tableName}: ${jobId}`);
        } catch (error) {
          console.error(`Failed to enqueue VACUUM job for ${tableName}:`, error);
        }
      }, i * 10000);
    }
  }

  await enqueueVacuumJobs();

  setInterval(enqueueVacuumJobs, ONE_WEEK_MS);

  console.log(`✅ Weekly VACUUM jobs scheduled for ${ALL_TABLES.length} tables`);
}

async function enablePgStatStatements() {
  try {
    const result = await QueryMonitoringService.enablePgStatStatements();
    if (result.success) {
      console.log('✅ pg_stat_statements enabled successfully');
    } else {
      console.warn('⚠️  pg_stat_statements not available:', result.message);
    }
  } catch (error) {
    console.warn('⚠️  pg_stat_statements enablement error (expected on Neon free tier)');
  }
}

async function startServer() {
  // Lightweight configuration check
  validateConfig();

  // Test database connection (non-blocking)
  try {
    const dbConnected = await testDatabaseConnection();
    if (dbConnected) {
      console.log('✅ Database connection successful');
    } else {
      console.warn('⚠️  Database connection failed - continuing with limited functionality');
    }
  } catch (error) {
    console.warn('⚠️  Database error:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Initialize email service and check Microsoft 365 SMTP connection
  try {
    await emailService.ensureInitialized();
    await emailService.healthCheck();
  } catch (error) {
    // Email service initialization error - logged by service
  }

  // Validate database schema consistency (fail-fast on critical errors)
  try {
    const schemaValidation = await validateSchemaConsistency();

    if (!schemaValidation.isValid) {
      console.error('\n' + '='.repeat(80));
      console.error('❌ DATABASE SCHEMA VALIDATION FAILED');
      console.error('='.repeat(80));
      console.error('\nThe database schema is out of sync with the application code.');
      console.error('This will cause runtime errors. Please fix the schema issues below:\n');

      schemaValidation.errors.forEach(error => console.error(error));

      if (schemaValidation.warnings.length > 0) {
        console.warn('\nWarnings:');
        schemaValidation.warnings.forEach(warning => console.warn(warning));
      }

      console.error('\n' + '='.repeat(80));
      console.error('💡 To fix schema issues:');
      console.error('   1. Run: npm run db:push --force');
      console.error('   2. Or manually add missing columns using SQL');
      console.error('   3. Ensure shared/schema.ts matches your database structure');
      console.error('='.repeat(80) + '\n');

      throw new SchemaValidationError(schemaValidation);
    }
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      process.exit(1);
    }
    console.warn('⚠️  Schema validation error:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Check for empty QuestionMapping table (data seeding warning)
  try {
    const [mappingCount] = await db.select({ count: sql<number>`count(*)` }).from(questionMapping);
    const [questionCount] = await db.select({ count: sql<number>`count(*)` }).from(questions);
    const [recCount] = await db.select({ count: sql<number>`count(*)` }).from(recMapping);

    const totalMappings = Number(mappingCount?.count || 0);
    const totalQuestions = Number(questionCount?.count || 0);
    const totalRecs = Number(recCount?.count || 0);

    if (totalMappings === 0 && totalQuestions > 0 && totalRecs > 0) {
      console.warn('\n' + '='.repeat(80));
      console.warn('⚠️  WARNING: QuestionMapping table is empty');
      console.warn('='.repeat(80));
      console.warn(`Found ${totalQuestions} questions and ${totalRecs} REC codes, but 0 mappings.`);
      console.warn('This will prevent REC-based question filtering from working.\n');
      console.warn('💡 To fix this, run the mapping seed script:');
      console.warn('   SEED_MODE=merge npm run seed:mappings');
      console.warn('='.repeat(80) + '\n');
    } else if (totalMappings > 0) {
      console.log(`✅ QuestionMapping data ready (${totalMappings} mappings)`);
    }
  } catch (error) {
    console.warn('⚠️  Could not check QuestionMapping status:', error instanceof Error ? error.message : 'Unknown error');
  }

  const app = await createApp();

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.use(performanceMonitor);
    app.use(observabilityMiddleware);
  }

  // Serve uploaded files (logos, evidence, etc.)
  const uploadsDir = path.resolve(__dirname, './uploads');
  if (fs.existsSync(uploadsDir)) {
    app.use('/uploads', express.static(uploadsDir));
    console.log('📂 Serving uploads from:', uploadsDir);
  }

  let server;

  // Fix path resolution - in compiled JS, __dirname points to server/dist/server/
  const distDir = path.resolve(__dirname, "../../../client/dist");

  if (isProduction || fs.existsSync(distDir)) {

    // Serve static assets with proper caching headers and compression
    app.use(express.static(distDir, {
      maxAge: isProduction ? '1d' : '0',
      etag: true,
      dotfiles: 'ignore',
      index: false, // Prevent auto-serving index.html for directories
      setHeaders: (res, filePath) => {
        // Security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Allow same origin for better compatibility
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // CORS headers for static assets
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));

    // SPA fallback - must come after static files
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) return next();

      const indexPath = path.join(distDir, "index.html");
      if (fs.existsSync(indexPath)) {
        try {
          // Add security and CORS headers to HTML response
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'SAMEORIGIN');
          res.setHeader('X-XSS-Protection', '1; mode=block');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');

          // CORS headers for HTML
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

          res.sendFile(indexPath);
        } catch (error) {
          console.error('Error serving index.html:', error);
          res.status(500).send('Internal Server Error');
        }
      } else {
        res.status(503).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Application Building</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Application is building...</h1>
              <p>Please wait while the application is being built. This may take a few minutes.</p>
              <script>
                console.log('Application building, will retry in 5 seconds');
                setTimeout(() => {
                  console.log('Reloading page...');
                  location.reload();
                }, 5000);
              </script>
            </body>
          </html>
        `);
      }
    });
  } else {

    // Create Vite proxy once and reuse it (fixes EventEmitter memory leak)
    const viteProxy = createProxyMiddleware({
      target: 'http://127.0.0.1:5173',
      changeOrigin: true,
      ws: true,
      timeout: 30000
    });

    // Development proxy to Vite
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }

      viteProxy(req, res, next);
    });
  }

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/directory', serviceDirectoryRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/team', teamRoutes);

  // Start server
  const port = parseInt(process.env.PORT || '5000', 10);
  server = app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 API available at http://0.0.0.0:${port}/api`);

    if (isProduction || fs.existsSync(distDir)) {
      console.log(`🌐 Production app available at http://0.0.0.0:${port}`);
    } else {
      console.log(`🌐 Development app available at http://0.0.0.0:${port} (proxying to Vite)`);
    }

    jobWorker.start().catch(error => {
      console.error('❌ Failed to start job worker:', error);
    });

    scheduleDailyPurgeJob().catch(error => {
      console.error('❌ Failed to schedule daily purge job:', error);
    });

    scheduleDailyAnalyzeJobs().catch(error => {
      console.error('❌ Failed to schedule daily ANALYZE jobs:', error);
    });

    scheduleWeeklyVacuumJobs().catch(error => {
      console.error('❌ Failed to schedule weekly VACUUM jobs:', error);
    });

    enablePgStatStatements().catch(error => {
      console.warn('⚠️  pg_stat_statements enablement failed (expected on free tier):', error);
    });
  });

  // Set unlimited listeners to handle proxy and WebSocket connections during HMR
  server.setMaxListeners(0);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await jobWorker.stop();
    server.close(() => {
      console.log('HTTP server closed');
    });
  });
}

// ============================================================================
// UNHANDLED ERROR CAPTURE
// ============================================================================
// Sentry automatically captures unhandled exceptions and unhandled promise rejections
// These errors will trigger email alerts based on Sentry alert rules configured in dashboard

// Start the server
startServer().catch(async (error) => {
  // Capture fatal startup errors in Sentry (if successfully initialized)
  // SAFETY: Only use Sentry APIs if initialization succeeded
  if (SENTRY_INITIALIZED) {
    try {
      Sentry.captureException(error, {
        level: 'fatal',
        tags: {
          errorType: 'server_startup_failure',
        },
      });
      
      // Flush Sentry events before exiting (with timeout)
      try {
        await Sentry.flush(2000);
      } catch (flushError) {
        // Ignore flush errors - we're exiting anyway
        console.warn('⚠️  Sentry flush failed (non-critical):', flushError instanceof Error ? flushError.message : String(flushError));
      }
    } catch (sentryError) {
      // If Sentry capture fails, log warning but continue with normal error handling
      console.warn('⚠️  Failed to capture startup error in Sentry:', sentryError instanceof Error ? sentryError.message : String(sentryError));
    }
  }
  
  console.error('FATAL ERROR: Failed to start server:', error);
  process.exit(1);
});