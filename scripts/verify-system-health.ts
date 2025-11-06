#!/usr/bin/env tsx

import { systemHealthService } from '../server/services/systemHealthService';

async function verifySystemHealth() {
  console.log('🔍 Verifying system health...\n');

  try {
    const healthStatus = await systemHealthService.performHealthCheck();
    
    console.log(`Overall Status: ${healthStatus.overall.toUpperCase()}`);
    console.log(`Health Score: ${healthStatus.score}%`);
    console.log(`Last Check: ${healthStatus.lastCheck}\n`);
    
    console.log('Component Health:');
    Object.entries(healthStatus.components).forEach(([name, health]) => {
      const icon = health.status === 'healthy' ? '✅' : 
                   health.status === 'degraded' ? '⚠️' : '❌';
      console.log(`  ${icon} ${name}: ${health.status} (${health.score}%) - ${health.message}`);
    });
    
    if (healthStatus.recommendations.length > 0) {
      console.log('\nRecommendations:');
      healthStatus.recommendations.forEach(rec => console.log(`  💡 ${rec}`));
    }
    
    if (healthStatus.score >= 95) {
      console.log('\n🎉 System is healthy and ready!');
      process.exit(0);
    } else {
      console.log('\n⚠️  System needs attention before proceeding');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Health verification failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifySystemHealth();
}
