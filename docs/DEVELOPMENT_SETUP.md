
# RuR2 Development Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database access
- Git
- Code editor (VS Code recommended)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-username/r2v3app.git
cd r2v3app
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install

# Install server dependencies
cd ../server && npm install
```

### 3. Environment Setup

Create `server/.env`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/r2v3app"
JWT_SECRET="your-development-jwt-secret"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=5000
```

### 4. Database Setup

```bash
cd server
npx drizzle-kit push
npx tsx tools/setup-minimal-data.ts
```

### 5. Start Development Server

```bash
# From root directory
npm run dev
```

The application will be available at:
- Client: http://localhost:5173
- Server: http://localhost:5000
- API: http://localhost:5000/api

## Project Structure

```
r2v3app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Utilities
│   │   └── utils/         # Helper functions
│   ├── public/            # Static assets
│   └── package.json
├── server/                # Express backend
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── tools/           # Development tools
│   └── package.json
├── shared/               # Shared types and utilities
├── migrations/           # Database migrations
├── scripts/             # Development scripts
└── docs/               # Documentation
```

## Development Workflow

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### TypeScript

All code should be written in TypeScript with strict mode enabled:

```bash
# Type check
npm run type-check
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```

### Database Operations

```bash
# Generate migration
cd server
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit push

# Reset database
npm run db:reset
```

## Development Tools

### Database Management

1. **Drizzle Studio** (Recommended)
   ```bash
   cd server
   npx drizzle-kit studio
   ```

2. **pgAdmin** or **DBeaver** for PostgreSQL

### API Testing

1. **Thunder Client** (VS Code extension)
2. **Postman**
3. **Insomnia**

Import the API collection from `docs/api-collection.json`

### Code Editor Setup

#### VS Code Extensions

Install these recommended extensions:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "rangav.vscode-thunder-client",
    "ms-playwright.playwright"
  ]
}
```

#### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"]
  ]
}
```

## Environment Variables

### Development (.env)

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/r2v3app_dev"

# Authentication
JWT_SECRET="dev-jwt-secret-change-in-production"
JWT_EXPIRES_IN="24h"

# Application
NODE_ENV="development"
PORT=5000
CORS_ORIGIN="http://localhost:5173"

# Development Features
ENABLE_DEBUG_LOGS="true"
ENABLE_QUERY_LOGGING="true"
```

### Testing (.env.test)

```env
DATABASE_URL="postgresql://username:password@localhost:5432/r2v3app_test"
JWT_SECRET="test-jwt-secret"
NODE_ENV="test"
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create route file in `server/routes/`:

```typescript
// server/routes/example.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/example', authMiddleware, async (req, res) => {
  try {
    // Implementation
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

2. Register route in `server/index.ts`:

```typescript
import exampleRoutes from './routes/example';
app.use('/api/example', exampleRoutes);
```

### Adding a New React Component

1. Create component file:

```typescript
// client/src/components/ExampleComponent.tsx
import React from 'react';

interface ExampleComponentProps {
  title: string;
}

export function ExampleComponent({ title }: ExampleComponentProps) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold">{title}</h2>
    </div>
  );
}
```

2. Export from index file if needed:

```typescript
// client/src/components/index.ts
export { ExampleComponent } from './ExampleComponent';
```

### Database Schema Changes

1. Modify schema in `shared/schema.ts`:

```typescript
export const exampleTable = pgTable('Example', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
});
```

2. Generate migration:

```bash
cd server
npx drizzle-kit generate
```

3. Apply migration:

```bash
npx drizzle-kit push
```

## Debugging

### Server Debugging

1. **Node.js Inspector**:
   ```bash
   cd server
   npm run dev:debug
   ```

2. **VS Code Debugger**:
   Create `.vscode/launch.json`:

   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Debug Server",
         "type": "node",
         "request": "launch",
         "program": "${workspaceFolder}/server/index.ts",
         "env": {
           "NODE_ENV": "development"
         },
         "runtimeArgs": ["-r", "tsx/cjs"]
       }
     ]
   }
   ```

### Client Debugging

1. **React Developer Tools** browser extension
2. **Redux DevTools** for state management
3. Browser developer tools

### Database Debugging

1. **Query Logging**:
   ```typescript
   // In development
   const db = drizzle(pool, { 
     schema, 
     logger: process.env.NODE_ENV === 'development' 
   });
   ```

2. **Query Analysis**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM "Assessment" WHERE "tenantId" = $1;
   ```

## Performance Optimization

### Frontend

1. **Bundle Analysis**:
   ```bash
   cd client
   npm run build:analyze
   ```

2. **React DevTools Profiler**

3. **Lighthouse Audits**

### Backend

1. **Database Query Optimization**:
   ```typescript
   // Use select() for specific fields
   const users = await db
     .select({ id: User.id, email: User.email })
     .from(User)
     .where(eq(User.isActive, true));
   ```

2. **Caching**:
   ```typescript
   // Simple in-memory cache
   const cache = new Map();
   
   app.get('/api/slow-endpoint', async (req, res) => {
     const cacheKey = 'slow-data';
     
     if (cache.has(cacheKey)) {
       return res.json(cache.get(cacheKey));
     }
     
     const data = await getSlowData();
     cache.set(cacheKey, data);
     
     res.json(data);
   });
   ```

## Testing Strategy

### Unit Tests

```typescript
// Example test
import { describe, it, expect } from 'vitest';
import { calculateScore } from '../utils/scoring';

describe('calculateScore', () => {
  it('should calculate score correctly', () => {
    const result = calculateScore([
      { value: 'yes', weight: 1 },
      { value: 'no', weight: 1 }
    ]);
    
    expect(result).toBe(50);
  });
});
```

### Integration Tests

```typescript
// API integration test
import request from 'supertest';
import { app } from '../app';

describe('Authentication API', () => {
  it('should login user with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

### E2E Tests

```typescript
// Playwright E2E test
import { test, expect } from '@playwright/test';

test('user can create assessment', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-button"]');
  
  await expect(page).toHaveURL('/dashboard');
  
  await page.click('[data-testid="new-assessment"]');
  await page.fill('[data-testid="assessment-title"]', 'Test Assessment');
  await page.click('[data-testid="create-assessment"]');
  
  await expect(page.locator('[data-testid="assessment-created"]')).toBeVisible();
});
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**:
   ```bash
   # Kill process on port
   npx kill-port 5000
   ```

2. **Database Connection Issues**:
   ```bash
   # Test connection
   psql $DATABASE_URL -c "SELECT version();"
   ```

3. **Module Resolution Issues**:
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **TypeScript Errors**:
   ```bash
   # Restart TypeScript server in VS Code
   Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"
   ```

### Development Scripts

```bash
# Reset development environment
npm run dev:reset

# Run linting and formatting
npm run lint:fix

# Generate test data
npm run db:seed

# Clear logs
npm run logs:clear
```

## Contributing

1. Create feature branch from `main`
2. Make changes following code style guidelines
3. Add tests for new functionality
4. Update documentation if needed
5. Submit pull request

### Commit Message Format

```
type(scope): description

feat(auth): add two-factor authentication
fix(api): handle null user in profile endpoint
docs(readme): update installation instructions
```

This development setup guide provides everything needed to get started with RuR2 development efficiently.
