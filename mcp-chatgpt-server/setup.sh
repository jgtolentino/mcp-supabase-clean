#!/bin/bash

echo "🚀 Setting up MCP ChatGPT Server..."

# Create necessary directories
mkdir -p workspace chroma sqlite auth

# Copy env file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file - please update with your settings"
fi

# Generate a secure token if not set
if grep -q "your-secret-token-here" .env; then
    NEW_TOKEN=$(openssl rand -hex 32)
    sed -i.bak "s/your-secret-token-here/$NEW_TOKEN/g" .env
    echo "🔐 Generated secure token: $NEW_TOKEN"
fi

# Check Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker found"
    
    # Start services
    echo "🐳 Starting PostgreSQL and MCP server..."
    docker-compose up -d
    
    # Wait for PostgreSQL
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
    
    echo "✅ Services started!"
    echo "📍 MCP Server: http://localhost:8000"
    echo "📍 PostgreSQL: localhost:5432"
else
    echo "⚠️  Docker not found. Running locally..."
    
    # Check PostgreSQL
    if command -v psql &> /dev/null; then
        echo "✅ PostgreSQL found"
    else
        echo "❌ PostgreSQL not found. Please install PostgreSQL first."
        exit 1
    fi
    
    # Install Python dependencies
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
    
    echo "✅ Setup complete!"
    echo "Run with: uvicorn main:app --reload"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Update .env with your PostgreSQL credentials"
echo "2. Run: ngrok http 8000 (to expose to ChatGPT)"
echo "3. Import openapi.yaml into ChatGPT Custom GPT"
echo "4. Set Authorization header with your token"

# Make script executable
chmod +x setup.sh