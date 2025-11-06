# Cache Clear & Server Verification Workflow - Quick Reference

## Overview

This workflow clears the server cache, checks for queued tasks, and verifies that your application is running correctly.

## How to Run

### Option 1: Shell Script (Recommended)
```bash
./clear-cache.sh
```

### Option 2: Direct TypeScript Execution
```bash
npx tsx scripts/clear-cache-and-restart.ts
```

### Option 3: With Verbose Output
```bash
VERBOSE=true npx tsx scripts/clear-cache-and-restart.ts
```

## What It Does

### 1. Clears Server Cache ✨
- Removes all cached entries from memory
- Includes user data, assessments, questions, answers, evidence, and system metrics
- Cache rebuilds automatically as requests come in

### 2. Checks Queued Tasks 📋
- Verifies the status of any background job queues
- Reports on pending tasks (this app uses real-time processing)

### 3. Verifies Application Health 🔍
- **API Health Check**: Tests the observability health endpoint
- **Frontend Accessibility**: Ensures the frontend is serving correctly
- **Cache Service**: Monitors cache memory usage and hit rates

## When to Use

Run this workflow when you:
- Need to clear stale or corrupted cache data
- Want to verify system health after making changes
- Experience caching-related issues
- Are preparing for deployment
- Notice high memory usage from caching
- Need to troubleshoot application performance

## Understanding the Output

### Success Indicators
- ✅ Green checkmarks mean steps completed successfully
- All verification checks should pass

### Warning Indicators  
- ⚠️  Yellow warnings indicate non-critical issues
- Cache service may show "warning" status if cache is empty (normal after clearing)

### Error Indicators
- ❌ Red X marks indicate failures
- Check the detailed error messages for troubleshooting

## Restarting the Server

The workflow **does not automatically restart the server**. If you need a full server restart:

1. Go to the Replit workspace
2. Find the "Start application" workflow
3. Click the restart button

## Files Created

- `scripts/clear-cache-and-restart.ts` - Main workflow script
- `clear-cache.sh` - Convenient shell wrapper
- `scripts/README-cache-workflow.md` - Detailed documentation
- `WORKFLOW_GUIDE.md` - This quick reference

## Troubleshooting

### "Server did not respond"
- Ensure the "Start application" workflow is running
- Check that port 5000 is available
- Review server logs for startup errors

### "API health check failed"
- Server may still be starting up
- Check database connection
- Verify all required environment variables are set

### "Cache service warning"
- This is normal immediately after clearing cache
- Cache will rebuild as requests are processed
- Warning will clear once cache has some entries

## Advanced Usage

### Integrating with CI/CD
```bash
# Add to your deployment script
./clear-cache.sh || exit 1
```

### Scheduled Maintenance
You can schedule this workflow to run periodically to keep cache fresh and verify system health.

### Monitoring Cache Health
The workflow provides detailed cache statistics:
- Memory usage percentage
- Cache hit rate
- Total number of cached keys
- Memory consumption in MB

## Need Help?

Refer to `scripts/README-cache-workflow.md` for comprehensive documentation.
