
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import { ObservabilityService } from '../server/services/observabilityService.js';

async function runPhase1HealthCheck() {
  console.log('🔍 Phase 1: Critical Infrastructure Health Check');
  console.log('='.repeat(50));

  const checks = {
    database: false,
    systemLogSchema: false,
    performanceMetricSchema: false,
    observabilityService: false,
    evidenceManagement: false
  };

  try {
    // 1. Database connectivity
    console.log('1. Testing database connectivity...');
    await db.execute(sql`SELECT 1 as test`);
    checks.database = true;
    console.log('   ✅ Database connection successful');

    // 2. SystemLog schema validation
    console.log('2. Validating SystemLog schema...');
    await db.execute(sql`SELECT level, message, service, duration FROM "SystemLog" LIMIT 1`);
    checks.systemLogSchema = true;
    console.log('   ✅ SystemLog schema complete (duration column exists)');

    // 3. PerformanceMetric schema validation
    console.log('3. Validating PerformanceMetric schema...');
    await db.execute(sql`SELECT metricName, value, tags FROM "PerformanceMetric" LIMIT 1`);
    checks.performanceMetricSchema = true;
    console.log('   ✅ PerformanceMetric schema complete (tags column exists)');

    // 4. ObservabilityService functionality
    console.log('4. Testing ObservabilityService...');
    await ObservabilityService.log('INFO', 'Phase 1 health check test', {
      service: 'health-check',
      operation: 'phase1-validation',
      duration: 100
    });
    await ObservabilityService.recordMetric('health_check_test', 1, 'count', {
      service: 'health-check',
      tags: { phase: '1', test: 'schema-validation' }
    });
    checks.observabilityService = true;
    console.log('   ✅ ObservabilityService working correctly');

    // 5. Evidence management directories
    console.log('5. Checking evidence management structure...');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const evidenceDir = path.join(process.cwd(), 'server', 'uploads', 'evidence');
    const quarantineDir = path.join(process.cwd(), 'server', 'uploads', 'quarantine');
    const tempDir = path.join(process.cwd(), 'server', 'uploads', 'temp');
    
    await fs.mkdir(evidenceDir, { recursive: true });
    await fs.mkdir(quarantineDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    
    checks.evidenceManagement = true;
    console.log('   ✅ Evidence management directories created');

  } catch (error) {
    console.error('❌ Health check failed:', error);
    throw error;
  }

  // Summary
  console.log('\n📊 Phase 1 Health Check Summary:');
  console.log('='.repeat(35));
  
  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  
  Object.entries(checks).forEach(([check, status]) => {
    console.log(`   ${status ? '✅' : '❌'} ${check}`);
  });
  
  console.log(`\n🎯 Phase 1 Status: ${passed}/${total} checks passed`);
  
  if (passed === total) {
    console.log('🚀 Phase 1: Critical Infrastructure - COMPLETE!');
    console.log('✅ Ready to proceed to Phase 2: Assessment & Scoring');
    return true;
  } else {
    console.log('⚠️  Phase 1: Critical Infrastructure - INCOMPLETE');
    console.log('🔧 Please resolve the failed checks before proceeding');
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase1HealthCheck()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Phase 1 health check failed:', error);
      process.exit(1);
    });
}

export default runPhase1HealthCheck;
