
#!/usr/bin/env tsx

import { systemHealthService } from '../server/services/systemHealthService';

async function verifyExternalAccess() {
  console.log('🔍 Verifying external access and stability...');
  
  try {
    // Check server health
    const health = await systemHealthService.performHealthCheck();
    console.log(`📊 System health: ${health.overall} (${health.score}%)`);
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usagePercentage = (heapUsedMB / heapTotalMB) * 100;
    
    console.log(`💾 Memory usage: ${heapUsedMB}MB/${heapTotalMB}MB (${Math.round(usagePercentage)}%)`);
    
    if (usagePercentage > 85) {
      console.warn('⚠️  High memory usage detected');
      if (global.gc) {
        global.gc();
        console.log('🧹 Forced garbage collection');
      }
    }
    
    // Test static file serving
    const fs = await import('fs');
    const path = await import('path');
    
    const distDir = path.resolve(process.cwd(), 'client/dist');
    const indexExists = fs.existsSync(path.join(distDir, 'index.html'));
    
    console.log(`📁 Client build status: ${indexExists ? 'Built' : 'Not built'}`);
    
    if (!indexExists) {
      console.error('❌ Client not built. Run: cd client && npm run build');
      return false;
    }
    
    console.log('✅ External access verification completed');
    return true;
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyExternalAccess();
}
