# Elasticity Testing Playbook

**Version**: 1.0  
**Last Updated**: November 11, 2025  
**Owner**: Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [Connection Pool Scaling](#connection-pool-scaling)
3. [Cache Size Adjustment](#cache-size-adjustment)
4. [Read Replica Testing](#read-replica-testing)
5. [Scaling Thresholds](#scaling-thresholds)
6. [Testing Procedures](#testing-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This playbook provides step-by-step procedures for testing and validating database elasticity under varying load conditions. It covers connection pool scaling, cache configuration, and read replica strategies.

**Prerequisites**:
- Access to database configuration (environment variables)
- Monitoring tools configured (see `OBSERVABILITY_SETUP.md`)
- Staging or test environment for non-destructive testing

**Safety Notice**: Always test scaling changes in a non-production environment first. Monitor closely after applying changes to production.

---

## Connection Pool Scaling

### Overview

PostgreSQL connection pooling limits the number of concurrent database connections. Proper sizing prevents connection exhaustion while avoiding resource waste.

### Current Configuration

The application uses connection pooling configured via environment variables:

```bash
# Default configuration (adjust based on load)
DATABASE_POOL_MIN=10          # Minimum connections to maintain
DATABASE_POOL_MAX=50          # Maximum concurrent connections
DATABASE_POOL_IDLE_TIMEOUT=30000  # Idle timeout in ms
```

**Neon-specific**: Neon free tier allows up to 100 connections. Paid tiers support more.

### Scaling Test Scenarios

#### Scenario 1: Normal Load (10 connections)

**When to Use**: Low traffic periods, development environments

**Configuration**:
```bash
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=10
```

**Expected Metrics**:
- Connection utilization: 30-50%
- Query latency p95: <50ms
- No connection timeout errors

**Validation**:
```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# Check connection pool utilization (via monitoring dashboard)
# Target: <70% utilization
```

#### Scenario 2: Moderate Load (50 connections)

**When to Use**: Normal business hours, expected traffic

**Configuration**:
```bash
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
```

**Expected Metrics**:
- Connection utilization: 40-60%
- Query latency p95: <100ms
- Cache hit ratio: >50%

**Validation**:
```bash
# Monitor during peak hours
# Check for connection wait times in application logs
# Validate no "too many connections" errors
```

#### Scenario 3: High Load (100 connections)

**When to Use**: Peak traffic, Black Friday, major events

**Configuration**:
```bash
DATABASE_POOL_MIN=20
DATABASE_POOL_MAX=100
```

**Expected Metrics**:
- Connection utilization: 60-80%
- Query latency p95: <200ms
- Active connections: 60-80

**Warning**: Neon free tier maxes at 100 connections. Paid tiers required for higher limits.

**Validation**:
```bash
# Load test with workload simulator
npx tsx server/tools/workload-simulator.ts peak

# Monitor connection pool metrics
# Check database CPU and memory utilization
```

### How to Adjust Connection Pool

**Step 1**: Update environment variables in `.env` file:

```bash
# Edit .env file
DATABASE_POOL_MIN=20
DATABASE_POOL_MAX=100
```

**Step 2**: Restart the application to apply changes:

```bash
# Development
npm run dev

# Production (via deployment platform)
# Changes applied on next deployment
```

**Step 3**: Monitor for 24-48 hours:

- Watch connection utilization in observability dashboard
- Check for connection timeout errors in logs
- Validate query latency remains within SLOs

### Decision Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Connection Utilization | >70% | Increase `DATABASE_POOL_MAX` by 50% |
| Connection Utilization | >85% | **URGENT**: Increase pool immediately |
| Connection Wait Time | >100ms | Increase pool or optimize queries |
| Idle Connections | >50% | Decrease `DATABASE_POOL_MIN` |

**Recommended Scaling Strategy**:
- Start conservative (50 connections)
- Increase by 50% when hitting 70% utilization
- Monitor for 24-48 hours after each change
- Never exceed database provider's connection limit

---

## Cache Size Adjustment

### Overview

In-memory caching reduces database load by storing frequently accessed data. Proper cache sizing balances memory usage and cache hit rate.

### Current Configuration

The application uses an LRU (Least Recently Used) cache:

```typescript
// server/services/cachingService.ts
const cache = new LRUCache({
  max: 1000,        // Maximum number of items
  ttl: 1000 * 60 * 60,  // 1 hour TTL
  updateAgeOnGet: true,
});
```

### Cache Sizing Test Scenarios

#### Scenario 1: Small Cache (500 items)

**When to Use**: Memory-constrained environments, low traffic

**Configuration**:
```typescript
const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 30, // 30 min TTL
});
```

**Expected Metrics**:
- Cache hit ratio: 30-40%
- Memory usage: ~50MB
- Cache evictions: Frequent

#### Scenario 2: Medium Cache (1000 items)

**When to Use**: Normal production traffic (default)

**Configuration**:
```typescript
const cache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour TTL
});
```

**Expected Metrics**:
- Cache hit ratio: 50-60%
- Memory usage: ~100MB
- Cache evictions: Moderate

#### Scenario 3: Large Cache (5000 items)

**When to Use**: High traffic, read-heavy workloads

**Configuration**:
```typescript
const cache = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 60 * 2, // 2 hour TTL
});
```

**Expected Metrics**:
- Cache hit ratio: 70-80%
- Memory usage: ~500MB
- Cache evictions: Rare

### How to Adjust Cache Size

**Step 1**: Edit cache configuration in `server/services/cachingService.ts`:

```typescript
const cache = new LRUCache({
  max: 5000,  // Increase from 1000 to 5000
  ttl: 1000 * 60 * 60 * 2,  // Increase TTL for longer retention
  updateAgeOnGet: true,
});
```

**Step 2**: Restart application

**Step 3**: Monitor cache metrics:

```bash
# Check cache hit rate via API
curl http://localhost:5000/api/admin/cache-metrics

# Expected response:
# {
#   "hitRate": 0.65,
#   "totalRequests": 10000,
#   "cacheHits": 6500,
#   "cacheMisses": 3500
# }
```

### Decision Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Cache Hit Rate | <50% | Increase cache size by 2x |
| Cache Hit Rate | <30% | **URGENT**: Increase cache or review caching strategy |
| Memory Usage | >80% of available | Decrease cache size or add memory |
| Cache Evictions | >1000/min | Increase cache size or reduce TTL |

**Recommended Cache Sizing**:
- **Small deployments** (<1000 users): 500-1000 items
- **Medium deployments** (1000-10k users): 1000-5000 items
- **Large deployments** (>10k users): 5000-10000 items

---

## Read Replica Testing

### Overview

Read replicas distribute read traffic across multiple database instances, reducing load on the primary database. Neon supports read replicas on paid tiers.

**Note**: This section is conceptual guidance. Actual implementation depends on Neon tier and configuration.

### Read Replica Architecture

```
┌─────────────────┐
│  Application    │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼──────┐   │
│ Primary  │   │ (All writes, some reads)
│ Database │   │
└──────────┘   │
               │
        ┌──────▼──────┐
        │ Read Replica│ (Read-only queries)
        └─────────────┘
```

### When to Add Read Replicas

Add read replicas when:
- Primary database CPU >70% consistently
- Read queries dominate (>80% of total queries)
- Query latency p95 >200ms for read operations
- Traffic expected to grow 2x+ in next 6 months

### Query Routing Strategy

**Route to Primary**:
- All INSERT, UPDATE, DELETE operations
- SELECT queries requiring strong consistency (user authentication, financial data)
- Transactional queries requiring ACID guarantees

**Route to Replica**:
- Dashboard queries (analytics, reporting)
- Assessment list views
- Evidence file listings
- Public/cached data queries

**Implementation Example** (conceptual):

```typescript
// server/db.ts
import { neon } from '@neondatabase/serverless';

// Primary connection (read-write)
export const dbPrimary = neon(process.env.DATABASE_URL!);

// Read replica connection (read-only)
export const dbReplica = process.env.DATABASE_REPLICA_URL
  ? neon(process.env.DATABASE_REPLICA_URL)
  : dbPrimary; // Fallback to primary if no replica

// Usage in services
const assessments = await dbReplica`SELECT * FROM "Assessment"`;  // Read from replica
await dbPrimary`INSERT INTO "Assessment" (...)`;  // Write to primary
```

### How to Add Read Replica (Neon)

**Step 1**: Enable read replica in Neon dashboard

1. Navigate to Neon console: https://console.neon.tech
2. Select your project
3. Go to "Branches" or "Read Replicas" section
4. Click "Create Read Replica"
5. Choose replica region (same as primary for lowest latency)
6. Copy the read replica connection string

**Step 2**: Configure application

```bash
# Add to .env
DATABASE_REPLICA_URL=postgresql://...  # Read replica connection string
```

**Step 3**: Update database client configuration

```typescript
// Modify queries to use replica for reads
// See implementation example above
```

**Step 4**: Monitor replication lag

```sql
-- Check replication lag (if available)
SELECT 
  application_name,
  state,
  sync_state,
  replay_lag
FROM pg_stat_replication;
```

**Step 5**: Validate performance improvement

- Measure query latency before and after
- Monitor primary database CPU utilization
- Check for replication lag (<1 second acceptable)

### Expected Benefits

- **Primary DB Load**: 30-50% reduction in CPU/memory
- **Read Query Latency**: 20-40% improvement
- **Throughput**: 2-3x more concurrent read queries
- **Availability**: Failover capability if primary fails

### Limitations

- **Replication Lag**: Replicas may be 100ms-1s behind primary
- **Eventual Consistency**: Read-after-write may not reflect immediately
- **Cost**: Additional database instance cost
- **Complexity**: Application logic must handle routing

---

## Scaling Thresholds

### Summary Table

| Metric | Warning Threshold | Critical Threshold | Recommended Action |
|--------|-------------------|--------------------|--------------------|
| **Connection Pool Utilization** | >70% | >85% | Increase `DATABASE_POOL_MAX` by 50% |
| **Cache Hit Rate** | <50% | <30% | Increase cache size by 2x or review caching strategy |
| **Query Latency (p95)** | >200ms | >500ms | Add indexes, optimize queries, or add read replicas |
| **Database Size** | >1GB | >5GB | Consider partitioning or archival strategy |
| **Active Connections** | >70 | >90 | Scale connection pool or add read replicas |
| **Slow Queries (>1s)** | >10/hour | >50/hour | Optimize queries, add indexes |
| **Error Rate** | >1% | >5% | Investigate and fix root cause |
| **Database CPU** | >70% | >90% | Optimize queries, add read replicas, or upgrade tier |

### Escalation Procedure

**Warning Threshold Reached**:
1. Monitor for 1-2 hours to confirm trend
2. Review observability dashboard for root cause
3. Plan scaling action within 24 hours
4. Document issue in incident log

**Critical Threshold Reached**:
1. **Immediate action required** (within 1 hour)
2. Notify on-call engineer via alert system
3. Apply emergency scaling (increase pool, add replicas)
4. Conduct post-incident review within 24 hours

---

## Testing Procedures

### Pre-Test Checklist

- [ ] Confirm testing in non-production environment
- [ ] Baseline metrics captured (use `measure-capacity-baseline.ts`)
- [ ] Monitoring dashboards configured and accessible
- [ ] Rollback plan documented
- [ ] Stakeholders notified of test window

### Test Execution

**Step 1**: Run baseline measurement

```bash
npx tsx server/tools/measure-capacity-baseline.ts --save-json
```

**Step 2**: Apply scaling change (e.g., increase connection pool)

```bash
# Update .env
DATABASE_POOL_MAX=100

# Restart application
npm run dev
```

**Step 3**: Run load test

```bash
# Normal load
npx tsx server/tools/workload-simulator.ts normal --save-report

# Peak load
npx tsx server/tools/workload-simulator.ts peak --save-report

# Stress test
npx tsx server/tools/workload-simulator.ts stress --save-report
```

**Step 4**: Measure post-test metrics

```bash
npx tsx server/tools/measure-capacity-baseline.ts --save-json
```

**Step 5**: Compare results

- Query latency (p50, p95, p99)
- Connection utilization
- Cache hit rate
- Error rates
- Throughput (requests/second)

**Step 6**: Document findings

Create a test report:

```markdown
# Elasticity Test Report

**Date**: 2025-11-11
**Test**: Connection pool scaling (50 → 100 connections)
**Environment**: Staging

## Results

- Query latency p95: 150ms → 120ms (20% improvement)
- Connection utilization: 85% → 60% (reduced congestion)
- Error rate: 2% → 0.1% (99% reduction in timeouts)
- Throughput: 100 req/s → 150 req/s (50% increase)

## Recommendation

Apply to production during low-traffic window (2-5 AM UTC).
```

### Post-Test Actions

- [ ] Review test report with team
- [ ] Decide on production rollout
- [ ] Schedule production deployment (if approved)
- [ ] Update configuration documentation
- [ ] Archive test results for future reference

---

## Troubleshooting

### High Connection Utilization (>85%)

**Symptoms**:
- "Too many connections" errors in logs
- Slow query performance
- Request timeouts

**Diagnosis**:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Check long-running queries
SELECT pid, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state = 'active' AND now() - query_start > interval '1 minute';
```

**Solutions**:
1. Increase `DATABASE_POOL_MAX` immediately
2. Kill long-running queries: `SELECT pg_terminate_backend(<pid>)`
3. Optimize slow queries (add indexes, rewrite queries)
4. Consider adding read replicas

### Low Cache Hit Rate (<30%)

**Symptoms**:
- High database load despite low traffic
- Slow response times for frequently accessed data

**Diagnosis**:
```bash
# Check cache metrics
curl http://localhost:5000/api/admin/cache-metrics
```

**Solutions**:
1. Increase cache size (`max` parameter)
2. Increase TTL for stable data
3. Review caching strategy (are the right things being cached?)
4. Consider warming cache on startup

### Replication Lag >5 seconds

**Symptoms**:
- Stale data visible to users
- Inconsistent query results

**Diagnosis**:
```sql
SELECT replay_lag FROM pg_stat_replication;
```

**Solutions**:
1. Check replica instance performance (CPU, memory)
2. Reduce write load on primary (batch writes)
3. Upgrade replica instance size
4. Route critical reads to primary temporarily

### Query Latency Spike

**Symptoms**:
- p95 latency >500ms
- Dashboard slow to load

**Diagnosis**:
```bash
# Check slowest queries
curl http://localhost:5000/api/admin/performance-metrics
```

**Solutions**:
1. Identify slow queries in monitoring dashboard
2. Run `EXPLAIN ANALYZE` on slow queries
3. Add missing indexes
4. Optimize query logic (avoid N+1 queries)
5. Consider materialized views for complex aggregations

---

## Additional Resources

- **Neon Documentation**: https://neon.tech/docs/
- **PostgreSQL Connection Pooling**: https://www.postgresql.org/docs/current/runtime-config-connection.html
- **Performance Monitoring**: See `docs/OBSERVABILITY_SETUP.md`
- **Capacity Planning**: Run `server/tools/measure-capacity-baseline.ts`
- **Load Testing**: Run `server/tools/workload-simulator.ts`

---

**Document Control**:
- **Version**: 1.0
- **Last Updated**: November 11, 2025
- **Next Review**: Quarterly or after major scaling events
- **Owner**: Engineering Team
