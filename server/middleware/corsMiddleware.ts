import { Request, Response, NextFunction } from 'express';

// Production-ready CORS configuration
export const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://0.0.0.0:5173',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://0.0.0.0:5000',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'https://*.replit.dev',
      'https://*.repl.co',
      'https://rur2ready.replit.app',
      'https://*.replit.app',
      process.env.CLIENT_URL,
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Check if origin matches any allowed patterns
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin?.includes('*')) {
        const pattern = allowedOrigin.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowedOrigin === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Tenant-ID',
    'X-Facility-ID'
  ],
  credentials: true,
  optionsSuccessStatus: 200, // For legacy browser support
  maxAge: 86400 // 24 hours
};

// Development CORS (more permissive)
export const devCorsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Tenant-ID',
    'X-Facility-ID'
  ],
  credentials: true
};

// CORS preflight handler
export const handleCorsPreflightMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-API-Key,X-Tenant-ID,X-Facility-ID');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.sendStatus(200);
  }
  next();
};

// Enhanced security headers middleware with production-ready settings
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Prevent clickjacking (SAMEORIGIN allows Replit webview to display the app)
  res.header('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME type sniffing
  res.header('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.header('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HTTP Strict Transport Security (HSTS) - force HTTPS in production
  if (isProduction) {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Permissions Policy - restrict dangerous browser features
  res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // Content Security Policy (Tightened for security, Stripe-compatible)
  if (!res.get('Content-Security-Policy')) {
    // In development, allow ws:// for Vite HMR WebSocket connections
    const connectSrc = isDevelopment
      ? "'self' ws: wss: ws://localhost:* wss://localhost:* https: https://api.stripe.com https://m.stripe.com"
      : "'self' https: wss: https://api.stripe.com https://m.stripe.com wss://*.replit.dev wss://*.repl.co";
    
    // Removed 'unsafe-eval' for better security (kept 'unsafe-inline' for Stripe compatibility)
    res.header('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://js.stripe.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      `connect-src ${connectSrc}; ` +
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com; " +
      "worker-src 'self' blob:; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'; " +
      "frame-ancestors 'self';"
    );
  }

  next();
};