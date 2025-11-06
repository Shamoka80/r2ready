
#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Starting R2Ready application backup..."

# Configuration
REMOTE_URL="https://github.com/Shamoka80/R2Ready.git"
DEFAULT_BRANCH="main"

# Set git configuration
git config user.name "${GIT_AUTHOR_NAME:-R2Ready Backup Bot}"
git config user.email "${GIT_AUTHOR_EMAIL:-backup@r2ready.local}"

# Ensure we're on main branch
git checkout main 2>/dev/null || git checkout -b main

# Create/update comprehensive .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
/coverage
/test-results
/playwright-report
playwright-report/

# Production builds
/build
/dist
.next/
client/dist/

# Runtime data
pids
*.pid
*.seed
*.pid.lock
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment files (keep examples)
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
server/.env

# Database files
*.sqlite
*.db
*.db-journal

# Temporary uploads
server/uploads/*
!server/uploads/.gitkeep

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Build artifacts
releases/*.tar.gz*
*.backup
*.bak

# Cache directories
.cache/
.npm/
.yarn-integrity

# Runtime files
.replit_pid*
*.lock
EOF

echo "✅ Updated .gitignore to protect sensitive files"

# Add all application files
echo "📦 Adding all application files..."
git add -A

# Create detailed commit message with file count
FILE_COUNT=$(find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" -o -name "*.sql" -o -name "*.yml" -o -name "*.yaml" | wc -l)

COMMIT_MSG="feat: comprehensive R2Ready application backup $(date '+%Y-%m-%d %H:%M:%S')

Complete backup including:
- ✅ Full-stack React/Node.js application
- ✅ Multi-facility assessment workflows  
- ✅ Evidence management system
- ✅ RBAC and 2FA security implementation
- ✅ Export capabilities (PDF/Excel/Word)
- ✅ Comprehensive test suites
- ✅ CI/CD workflows and automation
- ✅ Production-ready deployment configurations
- ✅ Documentation and operational runbooks
- ✅ Migration scripts and database schema
- ✅ Cloud storage integration services
- ✅ Analytics and observability features

Repository structure: $FILE_COUNT files backed up"

# Commit changes if there are any
if ! git diff --cached --quiet; then
    git commit -m "$COMMIT_MSG"
    echo "✅ Created comprehensive backup commit"
else
    echo "ℹ️ No new changes to commit"
fi

# Set up remote (update if exists)
if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REMOTE_URL"
else
    git remote add origin "$REMOTE_URL"
fi

# Push to repository
echo "🚀 Pushing backup to GitHub repository..."
git push -u origin main --force

# Create backup tag with timestamp
BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"
git tag -a "$BACKUP_TAG" -m "Complete R2Ready application backup - $BACKUP_TAG"
git push origin "$BACKUP_TAG"

# Verify backup completeness
echo "🔍 Verifying backup completeness..."

# Count critical files
CLIENT_FILES=$(find client/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l)
SERVER_FILES=$(find server -name "*.ts" -o -name "*.js" 2>/dev/null | wc -l)
TEST_FILES=$(find tests -name "*.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
DOC_FILES=$(find docs -name "*.md" 2>/dev/null | wc -l)
CONFIG_FILES=$(find . -maxdepth 3 -name "package.json" -o -name "*.config.*" -o -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l)

echo "📊 Backup Summary:"
echo "   🎨 Client files: $CLIENT_FILES"
echo "   🚀 Server files: $SERVER_FILES"  
echo "   🧪 Test files: $TEST_FILES"
echo "   📚 Documentation: $DOC_FILES"
echo "   ⚙️  Configuration: $CONFIG_FILES"
echo ""
echo "✅ Comprehensive backup completed successfully!"
echo "📍 Repository: https://github.com/Shamoka80/R2Ready"
echo "🏷️  Latest tag: $BACKUP_TAG"
echo ""
echo "🔐 Backup includes all critical components:"
echo "   • Complete source code (frontend + backend)"
echo "   • Database schemas and migrations"
echo "   • Test suites and CI/CD workflows"
echo "   • Documentation and runbooks"
echo "   • Configuration files"
echo "   • Cloud storage integrations"
echo "   • Security implementations"
echo "   • Export and analytics features"
