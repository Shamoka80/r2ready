
# Alert Runbook & Response Procedures

**Created**: October 1, 2025  
**Version**: 1.0  
**Owner**: DevOps & SRE Team  

## Alert Severity Levels

### P0 - Critical (Immediate Response)
- **Response Time**: 5 minutes
- **Escalation**: Immediate
- **Impact**: Service outage or data loss

### P1 - High (15-minute Response)
- **Response Time**: 15 minutes
- **Escalation**: 30 minutes if unresolved
- **Impact**: Significant performance degradation

### P2 - Medium (1-hour Response)
- **Response Time**: 1 hour
- **Escalation**: 4 hours if unresolved
- **Impact**: Minor performance issues

### P3 - Low (Next Business Day)
- **Response Time**: Next business day
- **Escalation**: Weekly review
- **Impact**: Informational or minor issues

## Critical Alert Procedures

### API Error Rate > 5%
**Severity**: P0  
**Description**: High error rate across API endpoints

**Immediate Actions**:
1. Check system health dashboard
2. Review recent deployments
3. Check database connectivity
4. Verify external service status

**Investigation Steps**:
```bash
# Check error logs
grep "ERROR" /var/log/app.log | tail -100

# Check system resources
top
df -h
free -m

# Check database connections
psql -h $DB_HOST -c "SELECT count(*) FROM pg_stat_activity;"
```

**Resolution**:
- If deployment-related: Consider rollback
- If resource-related: Scale up resources
- If database-related: Check connection pool
- If external service: Implement circuit breaker

**Communication Template**:
```
ALERT: High API Error Rate Detected
Status: INVESTIGATING
Impact: Users may experience service errors
ETA: Investigating, updates in 15 minutes
```

### Database Connection Failures
**Severity**: P0  
**Description**: Unable to connect to database

**Immediate Actions**:
1. Check database server status
2. Verify connection credentials
3. Check network connectivity
4. Review connection pool settings

**Investigation Steps**:
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check database server logs
tail -f /var/log/postgresql/postgresql.log

# Verify DNS resolution
nslookup $DB_HOST

# Check connection pool
grep "connection" /var/log/app.log | tail -20
```

**Resolution**:
- Restart database if unresponsive
- Increase connection pool if exhausted
- Fix network issues if connectivity problem
- Update credentials if authentication failed

### Authentication Service Down
**Severity**: P0  
**Description**: Users cannot log in or authenticate

**Immediate Actions**:
1. Check authentication service health
2. Verify JWT service status
3. Test login functionality
4. Check external auth providers

**Investigation Steps**:
```bash
# Test auth endpoint
curl -I https://app.example.com/api/auth/health

# Check auth logs
grep "auth" /var/log/app.log | tail -50

# Test JWT functionality
node -e "console.log(require('jsonwebtoken').verify(token, secret))"
```

**Resolution**:
- Restart authentication service
- Verify JWT configuration
- Check external provider status
- Implement fallback authentication

### Memory Usage > 95%
**Severity**: P0  
**Description**: System running out of memory

**Immediate Actions**:
1. Check memory usage by process
2. Identify memory leaks
3. Restart high-memory processes
4. Scale up if needed

**Investigation Steps**:
```bash
# Check memory usage
free -m
ps aux --sort=-%mem | head -20

# Check for memory leaks
valgrind --leak-check=full node app.js

# Monitor memory over time
watch -n 1 'free -m'
```

**Resolution**:
- Kill high-memory processes
- Restart application if memory leak
- Scale up server resources
- Optimize application memory usage

## Performance Alert Procedures

### API Response Time > 1000ms (P95)
**Severity**: P1  
**Description**: API responses are slow

**Investigation Steps**:
1. Check database query performance
2. Review cache hit rates
3. Analyze slow endpoints
4. Check system resources

**Diagnostic Commands**:
```bash
# Check slow queries
grep "duration.*[0-9]{4,}" /var/log/app.log

# Monitor cache performance
redis-cli info stats

# Check system load
uptime
iostat -x 1
```

**Resolution**:
- Optimize slow database queries
- Increase cache TTL for frequently accessed data
- Scale up resources if CPU/IO bound
- Implement query caching

### Cache Miss Rate > 50%
**Severity**: P1  
**Description**: Cache not performing effectively

**Investigation Steps**:
1. Check cache service health
2. Analyze cache hit/miss patterns
3. Review cache configuration
4. Check cache memory usage

**Diagnostic Commands**:
```bash
# Check cache stats
redis-cli info stats
redis-cli info memory

# Monitor cache operations
redis-cli monitor | grep -E "(GET|SET)"
```

**Resolution**:
- Increase cache memory allocation
- Optimize cache key strategies
- Review cache expiration policies
- Restart cache service if corrupted

### High Database Query Time
**Severity**: P1  
**Description**: Database queries taking too long

**Investigation Steps**:
1. Identify slow queries
2. Check database locks
3. Analyze query execution plans
4. Review index usage

**Diagnostic Commands**:
```sql
-- Find slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT GRANTED;

-- Analyze query plan
EXPLAIN ANALYZE SELECT ...;
```

**Resolution**:
- Optimize slow queries
- Add missing indexes
- Kill long-running queries
- Increase database resources

## Security Alert Procedures

### Multiple Failed Login Attempts
**Severity**: P1  
**Description**: Potential brute force attack

**Investigation Steps**:
1. Identify source IP addresses
2. Check login attempt patterns
3. Review user accounts affected
4. Implement rate limiting

**Diagnostic Commands**:
```bash
# Check failed login attempts
grep "failed login" /var/log/app.log | tail -100

# Analyze IP patterns
grep "failed login" /var/log/app.log | awk '{print $5}' | sort | uniq -c | sort -nr
```

**Resolution**:
- Block suspicious IP addresses
- Temporarily lock affected accounts
- Increase rate limiting
- Notify affected users

### Unusual API Activity
**Severity**: P2  
**Description**: Abnormal API usage patterns detected

**Investigation Steps**:
1. Analyze API usage patterns
2. Check for automated requests
3. Review user agent strings
4. Identify source origins

**Diagnostic Commands**:
```bash
# Check API usage by endpoint
grep "GET\|POST" /var/log/app.log | awk '{print $7}' | sort | uniq -c | sort -nr

# Analyze user agents
grep "User-Agent" /var/log/app.log | sort | uniq -c
```

**Resolution**:
- Implement stricter rate limiting
- Block suspicious user agents
- Add CAPTCHA for suspicious activity
- Monitor for continued unusual patterns

## System Health Alert Procedures

### Service Health Check Failed
**Severity**: P1  
**Description**: Health check endpoint returning failures

**Investigation Steps**:
1. Check service status
2. Review service logs
3. Test service functionality
4. Check dependencies

**Diagnostic Commands**:
```bash
# Test health endpoint
curl -v http://localhost:5000/api/health

# Check service logs
journalctl -u app-service -f

# Test service dependencies
ping database-host
telnet cache-host 6379
```

**Resolution**:
- Restart failed services
- Fix dependency issues
- Update health check logic
- Scale up if resource constrained

### Disk Space > 90%
**Severity**: P1  
**Description**: Running out of disk space

**Investigation Steps**:
1. Identify large files and directories
2. Check log file sizes
3. Review temporary files
4. Analyze disk usage trends

**Diagnostic Commands**:
```bash
# Check disk usage
df -h
du -sh /var/log/*
find /tmp -size +100M -type f

# Clean up logs
logrotate -f /etc/logrotate.conf
```

**Resolution**:
- Clean up log files
- Remove temporary files
- Archive old data
- Increase disk space

## Communication Procedures

### Alert Notification Channels
1. **Primary**: Alert dashboard
2. **Secondary**: Email notifications
3. **Escalation**: Phone calls for P0 alerts
4. **Status Page**: Public status updates

### Incident Communication
```
Subject: [P0] Service Outage - Authentication Service Down

INCIDENT SUMMARY:
- Impact: Users cannot log in
- Start Time: 10:30 AM EST
- Status: INVESTIGATING
- Next Update: 10:45 AM EST

ACTIONS TAKEN:
- Identified authentication service failure
- Investigating root cause
- Implementing fallback measures

NEXT STEPS:
- Restart authentication service
- Monitor service recovery
- Investigate root cause

Contact: devops@company.com
```

### Resolution Communication
```
Subject: [RESOLVED] Service Outage - Authentication Service

INCIDENT RESOLVED:
- Issue: Authentication service failure
- Resolution: Service restarted, root cause identified
- Duration: 25 minutes
- Root Cause: Memory leak in auth service

PREVENTIVE MEASURES:
- Increased memory monitoring
- Implemented memory leak detection
- Scheduled regular service restarts

Post-Mortem: Scheduled for tomorrow 2 PM EST
```

## Post-Incident Procedures

### Immediate Post-Incident (Within 2 hours)
1. Verify complete resolution
2. Document timeline and actions
3. Communicate resolution to stakeholders
4. Schedule post-mortem meeting

### Post-Mortem Process (Within 48 hours)
1. **Timeline Review**: Document complete incident timeline
2. **Root Cause Analysis**: Identify underlying causes
3. **Impact Assessment**: Measure business and technical impact
4. **Action Items**: Define preventive measures
5. **Process Improvements**: Update procedures and documentation

### Post-Mortem Template
```markdown
# Incident Post-Mortem: [Date] [Brief Description]

## Summary
- **Incident Date**: [Date and Time]
- **Duration**: [Total Duration]
- **Impact**: [User Impact Description]
- **Root Cause**: [Primary Cause]

## Timeline
- 10:30 AM: Alert triggered
- 10:32 AM: Investigation started
- 10:45 AM: Root cause identified
- 10:55 AM: Resolution implemented
- 11:00 AM: Service fully restored

## Root Cause Analysis
[Detailed analysis of what caused the incident]

## Impact Assessment
- Users affected: [Number]
- Revenue impact: [Amount if applicable]
- Service degradation: [Description]

## Action Items
1. [Action 1] - [Owner] - [Due Date]
2. [Action 2] - [Owner] - [Due Date]
3. [Action 3] - [Owner] - [Due Date]

## Lessons Learned
[Key takeaways and improvements identified]
```

---

**Emergency Contacts**:
- Primary On-call: [Phone Number]
- Secondary On-call: [Phone Number]
- Escalation Manager: [Phone Number]

**Key Resources**:
- Monitoring Dashboard: `/observability`
- Health Check: `/api/health`
- System Logs: `/var/log/app.log`

**Last Updated**: October 1, 2025  
**Next Review**: January 1, 2026  
**Approved By**: DevOps Lead, SRE Team Lead
