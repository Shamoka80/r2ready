#!/bin/bash

# Setup git hooks for UI verification
echo "🎭 Setting up UI verification hooks..."

# Initialize husky
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "npm run ui:verify:quick"

# Create pre-push hook for full verification
npx husky add .husky/pre-push "npm run ui:verify:full"

# Make scripts executable
chmod +x .husky/pre-commit
chmod +x .husky/pre-push

echo "✅ Git hooks setup complete!"
echo "💡 Now run: npm run ui:verify to test the system"