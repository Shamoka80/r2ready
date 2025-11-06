
#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Starting R2Ready application backup (Fixed)..."

# Configuration
REMOTE_URL="https://github.com/Shamoka80/R2Ready.git"
DEFAULT_BRANCH="main"

# Ensure we're in the right directory
cd "$(dirname "$0")"

echo "📍 Current directory: $(pwd)"
echo "📋 Files in directory: $(ls -la | wc -l) items"

# Set git configuration
git config user.name "${GIT_AUTHOR_NAME:-R2Ready Backup Bot}"
git config user.email "${GIT_AUTHOR_EMAIL:-backup@r2ready.local}"

# Initialize git repository if needed
if [ ! -d ".git" ]; then
    echo "🎯 Initializing new git repository..."
    git init
    git branch -M main
else
    echo "✅ Git repository already exists"
fi

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

echo "✅ Updated .gitignore"

# Add all application files
echo "📦 Adding all application files..."
git add -A

# Check if there are any changes to commit
if git diff --cached --quiet; then
    echo "ℹ️ No new changes to commit"
else
    # Create commit with current timestamp
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    FILE_COUNT=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" -o -name "*.sql" -o -name "*.yml" -o -name "*.yaml" | wc -l)
    
    COMMIT_MSG="feat: R2Ready application backup $TIMESTAMP

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

Total files: $FILE_COUNT"

    git commit -m "$COMMIT_MSG"
    echo "✅ Created backup commit"
fi

# Configure remote (remove if exists, then add fresh)
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_URL"

echo "🚀 Pushing backup to GitHub repository..."

# Try multiple push strategies
PUSH_SUCCESS=false

# Strategy 1: Standard push
if git push -u origin main --force-with-lease 2>/dev/null; then
    PUSH_SUCCESS=true
    echo "✅ Standard push succeeded"
fi

# Strategy 2: Force push if standard failed
if [ "$PUSH_SUCCESS" = false ]; then
    echo "⚠️ Standard push failed, trying force push..."
    if git push -u origin main --force 2>/dev/null; then
        PUSH_SUCCESS=true
        echo "✅ Force push succeeded"
    fi
fi

# Strategy 3: Alternative approach with explicit credentials
if [ "$PUSH_SUCCESS" = false ]; then
    echo "⚠️ Force push failed, checking repository status..."
    
    # Test if we can reach the repository
    if curl -s -f "$REMOTE_URL" >/dev/null 2>&1; then
        echo "✅ Repository is accessible"
        
        # Try one more time with verbose output
        echo "🔄 Attempting final push with verbose output..."
        if git push -u origin main --force --verbose; then
            PUSH_SUCCESS=true
            echo "✅ Verbose push succeeded"
        fi
    else
        echo "❌ Repository may not exist or is not accessible"
        echo "📋 Please ensure:"
        echo "   1. Repository exists at: $REMOTE_URL"
        echo "   2. You have push permissions"
        echo "   3. Repository is not private or you have access"
    fi
fi

if [ "$PUSH_SUCCESS" = true ]; then
    # Create and push backup tag
    BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"
    git tag -a "$BACKUP_TAG" -m "Complete R2Ready application backup - $BACKUP_TAG"
    
    if git push origin "$BACKUP_TAG" 2>/dev/null; then
        echo "✅ Backup tag created: $BACKUP_TAG"
    else
        echo "⚠️ Tag creation failed but main backup succeeded"
    fi
    
    # Final verification
    echo ""
    echo "🎯 BACKUP COMPLETION: SUCCESS"
    echo "📍 Repository: $REMOTE_URL"
    echo "🏷️  Latest tag: $BACKUP_TAG"
    echo ""
    echo "✅ R2Ready application successfully backed up to GitHub!"
else
    echo ""
    echo "❌ BACKUP FAILED"
    echo "📋 Manual steps to complete backup:"
    echo "   1. Verify repository exists: $REMOTE_URL"
    echo "   2. Check GitHub permissions"
    echo "   3. Try manual push: git push -u origin main --force"
    echo ""
    exit 1
fi

# Count and display backed up files
CLIENT_FILES=$(find client/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l)
SERVER_FILES=$(find server -name "*.ts" -o -name "*.js" 2>/dev/null | wc -l)
DOC_FILES=$(find docs -name "*.md" 2>/dev/null | wc -l)

echo ""
echo "📊 Backup Summary:"
echo "   🎨 Client files: $CLIENT_FILES"
echo "   🚀 Server files: $SERVER_FILES"
echo "   📚 Documentation: $DOC_FILES"
echo "   📦 Total committed files: $(git ls-files | wc -l)"
