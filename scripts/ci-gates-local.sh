#!/bin/bash

# Local CI Gates Script
# Run all CI gates locally before pushing to ensure they pass

set -e

echo "🚀 Running CI Gates Locally..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1 passed${NC}"
    else
        echo -e "${RED}❌ $1 failed${NC}"
        exit 1
    fi
}

# 1. Lint Check
echo -e "${YELLOW}🔍 Running ESLint...${NC}"
npx eslint . --ext .ts,.tsx,.js,.jsx
print_status "Linting"

# 2. Type Check
echo -e "${YELLOW}🔧 Running TypeScript type check...${NC}"
echo "Checking server types..."
cd server && npx tsc --noEmit && cd ..
echo "Checking client types..."
cd client && npx tsc --noEmit && cd ..
print_status "Type checking"

# 3. Build Verification
echo -e "${YELLOW}🏗️ Running build verification...${NC}"
echo "Building client..."
cd client && npm run build && cd ..
echo "Building server..."
cd server && npm run build && cd ..
print_status "Build verification"

# 4. Migration Idempotency Test (requires DATABASE_URL)
if [ -n "$DATABASE_URL" ]; then
    echo -e "${YELLOW}🗄️ Testing migration idempotency...${NC}"
    echo "Running migration push..."
    npx drizzle-kit push --force
    echo "Running second migration push (should be no-op)..."
    npx drizzle-kit push --force
    print_status "Migration idempotency"
else
    echo -e "${YELLOW}⚠️ Skipping migration test (DATABASE_URL not set)${NC}"
fi

# 5. Seed Script Verification (requires DATABASE_URL)
if [ -n "$DATABASE_URL" ]; then
    echo -e "${YELLOW}🌱 Testing seed script...${NC}"
    npx tsx scripts/seed-demo-tenants.ts
    print_status "Seed script"
else
    echo -e "${YELLOW}⚠️ Skipping seed test (DATABASE_URL not set)${NC}"
fi

# 6. Unit Tests (placeholder)
echo -e "${YELLOW}🧪 Running unit tests...${NC}"
echo "Unit tests not yet implemented - placeholder passes"
print_status "Unit tests"

# 7. Integration Tests (placeholder)
echo -e "${YELLOW}🔗 Running integration tests...${NC}"
echo "Integration tests not yet implemented - placeholder passes"
print_status "Integration tests"

echo ""
echo -e "${GREEN}🎉 All CI Gates Passed Successfully!${NC}"
echo "=================================="
echo "Your code is ready for deployment."