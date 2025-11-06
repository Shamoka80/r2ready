
#!/usr/bin/env tsx

import { systemHealthService } from '../server/services/systemHealthService';
import { cacheService } from '../server/services/cachingService';
import { queryOptimizationService } from '../server/services/queryOptimizationService';

async function performHealthRecovery() {
  console.log('🔧 Starting health recovery process...');
  
  try {
    // Clear cache to free up memory
    const clearedCount = await cacheService.clear();
    console.log(`✅ Cleared ${clearedCount} cache entries`);
    
    // Clean old query metrics
    const removedMetrics = await queryOptimizationService.clearOldMetrics(3600000); // 1 hour
    console.log(`✅ Removed ${removedMetrics} old metrics`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('✅ Forced garbage collection');
    }
    
    // Wait a moment for cleanup to take effect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run health check
    const healthStatus = await systemHealthService.performHealthCheck();
    console.log(`📊 System health: ${healthStatus.overall} (${healthStatus.score}%)`);
    
    if (healthStatus.score >= 95) {
      console.log('🎉 Health recovery successful!');
    } else {
      console.log('⚠️  Health still needs attention');
      console.log('Recommendations:');
      healthStatus.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    
  } catch (error) {
    console.error('❌ Health recovery failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  performHealthRecovery();
}
