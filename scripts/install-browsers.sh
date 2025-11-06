
#!/bin/bash

echo "🎭 Installing Playwright browsers and dependencies..."

# Install system dependencies
echo "📦 Installing system dependencies..."
apt-get update > /dev/null 2>&1
apt-get install -y \
  libglib2.0-0 libgobject-2.0-0 libnspr4 libnss3 libnssutil3 libsmime3 \
  libgio-2.0-0 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libexpat1 libxcb1 libxkbcommon0 libatspi2.0-0 libx11-6 libxcomposite1 \
  libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libcairo2 \
  libpango-1.0-0 libudev1 libasound2 > /dev/null 2>&1

# Install Playwright browsers
echo "🌐 Installing Playwright Chromium browser..."
npx playwright install chromium

echo "✅ Playwright browsers installed!"
echo "💡 Run 'npm run test:smoke' to test the setup"
