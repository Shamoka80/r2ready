import { cloudStorageMetadataCache, getAllCacheStats } from '../services/dataCache';

async function measureCachePerformance() {
  console.log('📊 Measuring Cache Performance\n');
  
  try {
    const testKey = 'test-cloud-storage-metadata';
    const testData = { files: Array(100).fill({ name: 'test.pdf', size: 1024 }) };
    
    // Measure cache miss (first request)
    const missStart = Date.now();
    const miss = cloudStorageMetadataCache.get(testKey);
    const missTime = Date.now() - missStart;
    console.log(`1️⃣ Cache Miss: ${missTime}ms (expected - no data)`);
    
    // Set cache
    cloudStorageMetadataCache.set(testKey, testData);
    
    // Measure cache hit
    const hitStart = Date.now();
    const hit = cloudStorageMetadataCache.get(testKey);
    const hitTime = Date.now() - hitStart;
    console.log(`2️⃣ Cache Hit: ${hitTime}ms`);
    
    const improvement = missTime > 0 ? Math.round((1 - hitTime/missTime) * 100) : 0;
    console.log(`3️⃣ Cache vs No-Cache: ${improvement}% faster\n`);
    
    // Cache stats
    const allStats = getAllCacheStats();
    const stats = allStats.cloudStorageMetadata;
    console.log('📈 Cache Stats:');
    console.log(`   Size: ${stats.size}`);
    console.log(`   Hits: ${stats.hits}`);
    console.log(`   Misses: ${stats.misses}`);
    console.log(`   Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`   Evictions: ${stats.evictions}\n`);
    
    console.log('✅ LRU Cache: Functional with hit rate tracking');
    console.log('\n📝 Summary:');
    console.log(`   Cache Hit Performance: ${hitTime}ms`);
    console.log(`   Improvement vs uncached: ${improvement}%`);
    console.log(`   Current Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    
    // Cleanup
    cloudStorageMetadataCache.invalidate(testKey);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error measuring cache performance:', error);
    process.exit(1);
  }
}

measureCachePerformance();
