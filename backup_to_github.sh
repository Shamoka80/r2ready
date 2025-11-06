
#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Starting R2Ready application backup to GitHub..."

# Configuration - REPLACE WITH YOUR REPOSITORY
REPO_OWNER="Shamoka80"  # Replace with your GitHub username
REPO_NAME="R2Ready"                # Replace with your repository name
REMOTE_URL="https://github.com/Shamoka80/r2ready.git"

# Set git configuration
git config user.name "${GIT_AUTHOR_NAME:-R2Ready Backup}"
git config user.email "${GIT_AUTHOR_EMAIL:-backup@r2ready.local}"

# Initialize git if needed
if [ ! -d ".git" ]; then
    echo "🎯 Initializing git repository..."
    git init
    git branch -M main
else
    echo "✅ Git repository exists"
    git checkout main 2>/dev/null || git checkout -b main
fi

# Create comprehensive .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
/coverage
/test-results
/playwright-report

# Production builds
/build
/dist
.next/
client/dist/

# Environment files
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

# OS files
.DS_Store
Thumbs.db

# Cache directories
.cache/
.npm/
.yarn-integrity

# Runtime files
.replit_pid*
*.log
logs/
EOF

echo "✅ Created .gitignore"

# Add all files
echo "📦 Adding application files..."
git add -A

# Create commit
if git diff --cached --quiet; then
    echo "ℹ️ No changes to commit"
else
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    FILE_COUNT=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" | wc -l)
    
    git commit -m "feat: complete R2Ready application backup $TIMESTAMP

✅ Full-stack React/Node.js application
✅ Multi-facility assessment workflows
✅ RBAC and 2FA security implementation
✅ Evidence management system
✅ Export capabilities (PDF/Excel/Word)
✅ Comprehensive test suites
✅ CI/CD workflows and documentation
✅ Production-ready configurations

Files: $FILE_COUNT"
    
    echo "✅ Created backup commit"
fi

# Configure remote
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_URL"

# Push to GitHub
echo "🚀 Pushing to GitHub repository..."
if git push -u origin main --force; then
    echo "✅ Successfully pushed to GitHub"
    
    # Create backup tag
    BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"
    git tag -a "$BACKUP_TAG" -m "Complete application backup - $BACKUP_TAG"
    git push origin "$BACKUP_TAG" && echo "✅ Created backup tag: $BACKUP_TAG"
    
    echo ""
    echo "🎉 BACKUP COMPLETED SUCCESSFULLY!"
    echo "📍 Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}"
    echo "🏷️  Tag: $BACKUP_TAG"
    echo "📊 Files backed up: $FILE_COUNT"
    
else
    echo "❌ Push failed. Please check:"
    echo "1. Repository exists at: $REMOTE_URL"
    echo "2. You have push permissions"
    echo "3. Repository URL is correct"
    exit 1
fi
