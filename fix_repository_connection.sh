
#!/usr/bin/env bash
set -euo pipefail

echo "🔧 R2Ready Repository Reconnection Script"
echo "=========================================="

REPO_OWNER="Shamoka80"
REPO_NAME="R2Ready"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"

echo "1. Checking repository accessibility..."
if curl -s -f "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}" >/dev/null 2>&1; then
    echo "✅ Repository exists and is accessible"
    REPO_EXISTS=true
else
    echo "❌ Repository not accessible or doesn't exist"
    REPO_EXISTS=false
fi

echo ""
echo "2. Checking current git configuration..."
git config --list | grep -E "(user\.name|user\.email|remote\.origin\.url)" || echo "No git config found"

echo ""
echo "3. Cleaning up existing remotes..."
git remote remove origin 2>/dev/null || echo "No origin remote to remove"
git remote remove backup 2>/dev/null || echo "No backup remote to remove"

echo ""
echo "4. Setting up fresh remote connection..."
git remote add origin "$REPO_URL"

echo ""
echo "5. Configuring git user (if not set)..."
git config user.name "${GIT_AUTHOR_NAME:-R2Ready Bot}" 2>/dev/null || git config user.name "R2Ready Bot"
git config user.email "${GIT_AUTHOR_EMAIL:-bot@r2ready.local}" 2>/dev/null || git config user.email "bot@r2ready.local"

echo ""
echo "6. Checking commit status..."
COMMITS_AHEAD=$(git rev-list --count HEAD ^origin/main 2>/dev/null || echo "unknown")
echo "Local commits ahead: $COMMITS_AHEAD"

echo ""
echo "7. Attempting to push repository..."
if git push -u origin main --force 2>/dev/null; then
    echo "✅ Successfully pushed to repository"
    
    echo ""
    echo "8. Creating backup tag..."
    BACKUP_TAG="reconnect-$(date +%Y%m%d-%H%M%S)"
    git tag -a "$BACKUP_TAG" -m "Repository reconnection backup - $BACKUP_TAG"
    git push origin "$BACKUP_TAG" 2>/dev/null && echo "✅ Backup tag created: $BACKUP_TAG" || echo "⚠️ Tag creation failed"
    
else
    echo "❌ Push failed. Checking repository status..."
    
    if [ "$REPO_EXISTS" = false ]; then
        echo ""
        echo "📋 MANUAL ACTION REQUIRED:"
        echo "1. Go to https://github.com/new"
        echo "2. Create repository: $REPO_NAME"
        echo "3. Set as Private (recommended)"
        echo "4. Do NOT initialize with README"
        echo "5. Run this script again"
        echo ""
        echo "Or create via GitHub CLI:"
        echo "gh repo create $REPO_NAME --private --source . --push"
    else
        echo ""
        echo "📋 TROUBLESHOOTING:"
        echo "1. Check GitHub permissions"
        echo "2. Verify repository access"
        echo "3. Try manual push: git push -u origin main --force"
    fi
fi

echo ""
echo "9. Final verification..."
git remote -v
git status
echo ""
echo "🎯 Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo "📊 Total files: $(git ls-files | wc -l)"
echo "✅ Repository reconnection complete!"
