import { PaginationUtils } from '../utils/pagination';

interface TestItem {
  id: string;
  createdAt: Date;
  name: string;
}

function createTestItems(count: number): TestItem[] {
  const items: TestItem[] = [];
  const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
  
  for (let i = 0; i < count; i++) {
    items.push({
      id: `item-${i}`,
      createdAt: new Date(baseTime + i * 1000),
      name: `Item ${i}`,
    });
  }
  
  return items.reverse(); // Simulate DESC order from DB
}

function runTest(name: string, items: TestItem[], limit: number, direction: 'forward' | 'backward', hasPreviousPage: boolean) {
  console.log(`\n🧪 Test: ${name}`);
  console.log(`   Items: ${items.length}, Limit: ${limit}, Direction: ${direction}, hasPreviousPage: ${hasPreviousPage}`);
  
  const result = PaginationUtils.buildResponse(
    items,
    limit,
    direction,
    ['createdAt', 'id'],
    hasPreviousPage
  );
  
  console.log(`   ✅ Returned: ${result.data.length} items`);
  console.log(`   📊 hasMore: ${result.pagination.hasMore}`);
  console.log(`   🔄 nextCursor: ${result.pagination.nextCursor ? 'present' : 'null'}`);
  console.log(`   🔙 prevCursor: ${result.pagination.prevCursor ? 'present' : 'null'}`);
  
  if (result.data.length > 0) {
    const first = result.data[0];
    const last = result.data[result.data.length - 1];
    console.log(`   📍 First item: ${first.name} (${first.createdAt.toISOString()})`);
    console.log(`   📍 Last item: ${last.name} (${last.createdAt.toISOString()})`);
    
    // Verify descending order
    let isDescending = true;
    for (let i = 0; i < result.data.length - 1; i++) {
      if (result.data[i].createdAt < result.data[i + 1].createdAt) {
        isDescending = false;
        break;
      }
    }
    
    if (isDescending) {
      console.log(`   ✅ Order: DESCENDING (newest → oldest) ✓`);
    } else {
      console.log(`   ❌ Order: ASCENDING (oldest → newest) - WRONG!`);
      throw new Error(`Test failed: ${name} - Items not in descending order`);
    }
  }
  
  return result;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  PAGINATION EDGE CASE TESTING                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // Test 1: Forward pagination, full page
    const items1 = createTestItems(25);
    runTest('Forward pagination - full page', items1, 20, 'forward', false);
    
    // Test 2: Forward pagination, partial page (final page)
    const items2 = createTestItems(15);
    runTest('Forward pagination - partial page (final)', items2, 20, 'forward', false);
    
    // Test 3: Backward pagination, full page (hasMore = true)
    // Simulate: Query ASC, got 21 items, limit 20, so hasMore=true
    const items3 = createTestItems(21).reverse(); // Reverse because backward queries ASC
    runTest('Backward pagination - full page (hasMore)', items3, 20, 'backward', true);
    
    // Test 4: Backward pagination, partial page (final page, hasMore = false)
    // Simulate: Query ASC, got 15 items, limit 20, so hasMore=false
    const items4 = createTestItems(15).reverse(); // Reverse because backward queries ASC
    runTest('Backward pagination - partial page (final)', items4, 20, 'backward', true);
    
    // Test 5: Backward pagination, single item
    const items5 = createTestItems(1).reverse();
    runTest('Backward pagination - single item', items5, 20, 'backward', true);
    
    // Test 6: Forward pagination, single item
    const items6 = createTestItems(1);
    runTest('Forward pagination - single item', items6, 20, 'forward', false);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ALL TESTS PASSED                                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
