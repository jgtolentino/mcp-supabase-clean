#!/bin/bash

echo "🚀 MCP Bridge Extension Setup"
echo "============================"

# Create icon placeholders
echo "📦 Creating icon placeholders..."
mkdir -p icons

# Create simple colored square icons using ImageMagick if available
if command -v convert &> /dev/null; then
    echo "✅ Creating icons with ImageMagick..."
    convert -size 16x16 xc:'#1a1a1a' icons/icon-16.png
    convert -size 48x48 xc:'#1a1a1a' icons/icon-48.png
    convert -size 128x128 xc:'#1a1a1a' icons/icon-128.png
else
    echo "⚠️  ImageMagick not found. Creating placeholder files..."
    touch icons/icon-16.png
    touch icons/icon-48.png
    touch icons/icon-128.png
fi

echo ""
echo "✅ Extension files ready!"
echo ""
echo "📋 Next steps:"
echo "1. Open Chrome/Edge and go to: chrome://extensions/"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select this folder: $(pwd)"
echo ""
echo "🔧 Configuration:"
echo "1. Make sure MCP server is running at localhost:8000"
echo "2. Click the extension icon and set your auth token"
echo "3. Go to claude.ai and try: :help"
echo ""
echo "Happy coding! 🎉"