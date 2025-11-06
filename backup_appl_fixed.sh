#!/bin/bash

echo "🔄 Starting R2Ready application backup (Fixed)..."

# Set working directory
WORKDIR=$(pwd)
echo "📍 Current directory: $WORKDIR"

# Count files
FILECOUNT=$(ls -1 | wc -l)
echo "📋 Files in directory: $FILECOUNT items"

# Initialize Git repo if needed
if [ ! -d ".git" ]; then
  git init
  echo "✅ Initialized new Git repository"
else
  echo "✅ Git repository already exists"
fi

# Clean up stale lock file if it exists
if [ -f ".git/config.lock" ]; then
  echo "⚠️ Removing stale Git config lock"
  rm .git/config.lock
fi

# Update .gitignore safely
GITIGNORE_CONTENT=$'# Ignore backup artifacts\n*.bak\n*.tmp\nnode_modules/\n.env'
echo "$GITIGNORE_CONTENT" >> .gitignore
sort -u .gitignore -o .gitignore
echo "✅ Updated .gitignore"

# Stage all files
git add .
echo "📦 Adding all application files..."

# Commit only if there are changes
if git diff --cached --quiet; then
  echo "ℹ️ No new changes to commit"
else
  git commit -m "Automated backup commit"
  echo "✅ Committed changes"
fi

# Set up remote safely
REMOTE_NAME="origin"
REMOTE_URL="https://github.com/Shamoka80/r2ready"

if git remote | grep -q "^$REMOTE_NAME$"; then
  echo "✅ Remote '$REMOTE_NAME' already exists"
else
  git remote add "$REMOTE_NAME" "$REMOTE_URL" && echo "✅ Added remote '$REMOTE_NAME'"
fi

# Done
echo "🎉 Backup script completed successfully"
