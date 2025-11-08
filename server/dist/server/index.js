import express from "express";
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from "fs";
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
import authRoutes from './routes/auth.js';
import serviceDirectoryRoutes from './routes/service-directory.js';
import Stripe from 'stripe';
import { handleStripeWebhook } from './routes/stripe-webhooks.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function createApp() {
    const app = express();
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
    app.post('/webhook/stripe/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
        let event;
        try {
            // Verify webhook signature with RAW body buffer
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        }
        catch (err) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
        try {
            // Delegate to event handler
            await handleStripeWebhook(event);
            res.json({ received: true });
        }
        catch (error) {
            console.error('Webhook processing error:', error);
            res.status(500).send('Webhook processing failed');
        }
    });
    // NOW apply express.json() for all other routes
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: false, limit: '10mb' }));
    if (!isTest) {
        app.use((req, res, next) => {
            const start = Date.now();
            const path = req.path;
            let capturedJsonResponse = undefined;
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
    app.use((err, req, res, next) => {
        const status = err.status || err.statusCode || 500;
        const isProduction = process.env.NODE_ENV === 'production';
        // Log error details server-side (never send stack traces to client)
        if (!isTest) {
            console.error(`[ERROR] ${req.method} ${req.path} - ${status}`);
            if (!isProduction) {
                console.error('Error details:', err.message);
                console.error('Error stack:', err.stack);
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
    }
    else if (secret && secret.length < 32) {
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
    }
    else {
        console.log('✅ Configuration validated');
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
        }
        else {
            console.warn('⚠️  Database connection failed - continuing with limited functionality');
        }
    }
    catch (error) {
        console.warn('⚠️  Database error:', error instanceof Error ? error.message : 'Unknown error');
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
    }
    catch (error) {
        if (error instanceof SchemaValidationError) {
            process.exit(1);
        }
        console.warn('⚠️  Schema validation error:', error instanceof Error ? error.message : 'Unknown error');
    }
    // Check for empty QuestionMapping table (data seeding warning)
    try {
        const [mappingCount] = await db.select({ count: sql `count(*)` }).from(questionMapping);
        const [questionCount] = await db.select({ count: sql `count(*)` }).from(questions);
        const [recCount] = await db.select({ count: sql `count(*)` }).from(recMapping);
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
        }
        else if (totalMappings > 0) {
            console.log(`✅ QuestionMapping data ready (${totalMappings} mappings)`);
        }
    }
    catch (error) {
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
    console.log(`🔍 Checking dist directory: ${distDir}`);
    console.log(`📂 Directory exists: ${fs.existsSync(distDir)}`);
    if (fs.existsSync(distDir)) {
        console.log(`📁 Directory contents:`, fs.readdirSync(distDir));
    }
    if (isProduction || fs.existsSync(distDir)) {
        console.log(`📁 Production mode: Serving static files from: ${distDir}`);
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
                }
                else if (filePath.endsWith('.css')) {
                    res.setHeader('Content-Type', 'text/css; charset=utf-8');
                }
                else if (filePath.endsWith('.html')) {
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                }
            }
        }));
        // SPA fallback - must come after static files
        app.get("*", (req, res, next) => {
            if (req.path.startsWith("/api") || req.path.startsWith("/webhook"))
                return next();
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
                }
                catch (error) {
                    console.error('Error serving index.html:', error);
                    res.status(500).send('Internal Server Error');
                }
            }
            else {
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
    }
    else {
        console.log(`🔧 Development mode: Proxying frontend to Vite`);
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
    // Start server
    const port = parseInt(process.env.PORT || '5000', 10);
    server = app.listen(port, "0.0.0.0", () => {
        console.log(`🚀 Server running on port ${port}`);
        console.log(`📊 API available at http://0.0.0.0:${port}/api`);
        if (isProduction || fs.existsSync(distDir)) {
            console.log(`🌐 Production app available at http://0.0.0.0:${port}`);
        }
        else {
            console.log(`🌐 Development app available at http://0.0.0.0:${port} (proxying to Vite)`);
        }
    });
    // Set unlimited listeners to handle proxy and WebSocket connections during HMR
    server.setMaxListeners(0);
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM signal received: closing HTTP server');
        server.close(() => {
            console.log('HTTP server closed');
        });
    });
}
// Start the server
startServer().catch(error => {
    console.error('FATAL ERROR: Failed to start server:', error);
    process.exit(1);
});
