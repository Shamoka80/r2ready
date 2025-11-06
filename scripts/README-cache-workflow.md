# Cache Clear and Server Verification Workflow

This workflow provides a comprehensive system maintenance script that clears the server cache and verifies the application is running correctly.

## Features

The workflow performs the following steps:

1. **Clear Server Cache** - Clears all in-memory cache entries
2. **Check Queued Tasks** - Verifies and reports on any background job queues
3. **Verify Application** - Performs comprehensive health checks:
   - API health endpoint verification
   - Frontend accessibility check
   - Cache service health status

## Usage

### Basic Usage

Run the workflow script directly:

```bash
npx tsx scripts/clear-cache-and-restart.ts
```

### Verbose Mode

For detailed output including full diagnostics:

```bash
VERBOSE=true npx tsx scripts/clear-cache-and-restart.ts
```

### As a Replit Workflow

You can also run this as a Replit workflow. The script will:
1. Clear the cache
2. Verify the server is running
3. Report detailed health status

## What Gets Cleared

- **Server Cache**: All in-memory cache entries including:
  - User data cache
  - Assessment cache
  - Question cache
  - Answer cache
  - Evidence listings
  - System metrics
  - Audit logs
  - Tenant configurations
  - User permissions

- **Queued Tasks**: This application uses real-time processing without traditional job queues

## Verification Checks

The workflow performs these verification checks:

1. **API Health Check**: Verifies `/api/observability/health` endpoint
2. **Frontend Accessibility**: Ensures frontend is serving correctly
3. **Cache Service Health**: Checks memory usage and cache hit rates

## Exit Codes

- `0` - All steps completed successfully
- `1` - One or more steps failed

## Output Example

```
🚀 Starting Cache Clear and Server Restart Workflow

🧹 Step 1: Clearing server cache...
✅ Cache cleared: 15 entries removed

📋 Step 2: Checking for queued tasks/jobs...
✅ No background job queues to clear

🔍 Step 3: Verifying application...
  ✅ API health check passed
  ✅ Frontend is accessible
  ✅ Cache service is healthy

============================================================
📊 WORKFLOW SUMMARY
============================================================
Result: 3/3 steps completed successfully
============================================================
```

## When to Use

Run this workflow when you need to:

- Clear stale cache data
- Verify system health after changes
- Troubleshoot caching issues
- Prepare for deployment
- After database migrations
- When experiencing memory pressure

## Notes

- The script safely clears cache without data loss (cache is ephemeral)
- All cache will be rebuilt automatically as requests are made
- No server restart is required - cache clearing happens in-place
- Health checks verify the application remains functional after clearing
