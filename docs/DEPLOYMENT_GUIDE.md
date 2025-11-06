
# RuR2 Deployment Guide

## Overview

This guide covers deploying the RuR2 application on Replit's platform, including environment setup, database configuration, and production optimization.

## Prerequisites

- Replit account with deployment capabilities
- PostgreSQL database (Neon recommended)
- Stripe account for payment processing (optional)
- Basic understanding of Node.js and React

## Environment Setup

### 1. Clone or Fork Repository

```bash
# Fork the repository in Replit or clone from GitHub
git clone https://github.com/your-username/r2v3app.git
```

### 2. Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# JWT Configuration
JWT_SECRET="your-super-secure-jwt-secret-key-here"
JWT_EXPIRES_IN="7d"

# Application Configuration
NODE_ENV="production"
PORT=5000
CORS_ORIGIN="https://your-repl-name.replit.app"

# Stripe Configuration (Optional)
STRIPE_SECRET_KEY="sk_live_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"

# Email Configuration (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# File Upload Configuration
MAX_FILE_SIZE="10485760"  # 10MB
ALLOWED_FILE_TYPES="pdf,doc,docx,jpg,jpeg,png"

# Rate Limiting
RATE_LIMIT_WINDOW_MS="900000"  # 15 minutes
RATE_LIMIT_MAX_REQUESTS="100"

# Security
BCRYPT_ROUNDS="12"
SESSION_SECRET="your-session-secret"
ENABLE_2FA="true"
```

## Database Setup

### 1. Neon PostgreSQL Setup

1. Create account at [neon.tech](https://neon.tech)
2. Create new project and database
3. Copy connection string to `DATABASE_URL`

### 2. Database Migration

```bash
# Install dependencies
npm install

# Run database migrations
cd server
npx drizzle-kit push
```

### 3. Seed Initial Data

```bash
# Run data seeding script
npx tsx tools/setup-minimal-data.ts
```

## Replit Deployment Configuration

### 1. Update .replit File

```toml
modules = ["nodejs-20"]

[nix]
channel = "stable-24_05"

[[ports]]
localPort = 5000
externalPort = 80

[[ports]]
localPort = 5173
externalPort = 3000

[deployment]
run = ["sh", "-c", "npm install && npm run build && npm start"]
deploymentTarget = "cloudrun"

[env]
NODE_ENV = "production"
```

### 2. Update package.json Scripts

```json
{
  "scripts": {
    "start": "cd server && npm start",
    "build": "npm run build:client && npm run build:server",
    "build:client": "cd client && npm run build",
    "build:server": "cd server && npm run build",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && npm run dev",
    "dev:client": "cd client && npm run dev"
  }
}
```

## Production Optimization

### 1. Client Build Configuration

Update `client/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:5000',
        changeOrigin: true,
      },
    },
  },
});
```

### 2. Server Production Configuration

Update `server/index.ts` for production:

```typescript
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

## Database Migration Strategy

### 1. Migration Files

All migrations are in the `migrations/` directory:

```sql
-- Example migration: 0001_initial_schema.sql
CREATE TABLE IF NOT EXISTS "User" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL,
  "firstName" text,
  "lastName" text,
  "role" text NOT NULL DEFAULT 'user',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
```

### 2. Running Migrations

```bash
# Development
npx drizzle-kit push

# Production
npx drizzle-kit migrate
```

## Performance Optimization

### 1. Caching Strategy

```typescript
// Redis configuration (if available)
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache frequently accessed data
app.get('/api/questions', async (req, res) => {
  const cacheKey = 'questions:all';
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  const questions = await getQuestions();
  await redis.setex(cacheKey, 300, JSON.stringify(questions)); // 5 min cache
  
  res.json(questions);
});
```

### 2. Database Connection Pooling

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Security Configuration

### 1. HTTPS and Security Headers

```typescript
import helmet from 'helmet';
import cors from 'cors';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
```

### 2. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

app.use('/api/', limiter);
```

## Monitoring and Logging

### 1. Application Monitoring

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### 2. Health Check Endpoint

```typescript
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});
```

## Backup Strategy

### 1. Database Backups

```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

### 2. File Backups

```typescript
// Backup uploaded files to cloud storage
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const backupFile = async (filePath: string) => {
  const fileContent = fs.readFileSync(filePath);
  
  const params = {
    Bucket: process.env.S3_BACKUP_BUCKET,
    Key: `backups/${path.basename(filePath)}`,
    Body: fileContent,
  };
  
  await s3.upload(params).promise();
};
```

## Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificate configured
- [ ] Security headers implemented
- [ ] Rate limiting configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented

### Post-deployment
- [ ] Health check endpoints responding
- [ ] Database connections working
- [ ] File uploads functioning
- [ ] Authentication working
- [ ] Performance monitoring active
- [ ] Error tracking enabled
- [ ] Backup systems tested

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check connection string
   echo $DATABASE_URL
   
   # Test connection
   psql $DATABASE_URL -c "SELECT version();"
   ```

2. **Build Failures**
   ```bash
   # Clear cache and rebuild
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

3. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

### Performance Issues

1. **Slow Queries**
   ```sql
   -- Enable query logging
   SET log_statement = 'all';
   SET log_min_duration_statement = 1000;
   ```

2. **High Memory Usage**
   ```typescript
   // Monitor memory usage
   setInterval(() => {
     const usage = process.memoryUsage();
     console.log('Memory usage:', usage);
   }, 60000);
   ```

## Support

For deployment issues:
1. Check Replit deployment logs
2. Verify environment variables
3. Test database connectivity
4. Review application logs
5. Contact support at deploy-help@rur2.com

## Updates and Maintenance

### Rolling Updates
```bash
# Zero-downtime deployment
git pull origin main
npm install
npm run build
pm2 reload all
```

### Database Updates
```bash
# Run new migrations
npx drizzle-kit push
```

### Monitoring Updates
```bash
# Check application health
curl https://your-app.replit.app/health
```

This deployment guide ensures a robust, secure, and scalable deployment of the RuR2 application on Replit's platform.
