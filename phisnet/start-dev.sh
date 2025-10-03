#!/bin/bash

# PhishNet Development Startup Script
echo "🎣 Starting PhishNet Development Environment..."

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: package.json not found. Please run this script from the PhishNet root directory."
    exit 1
fi

# Start PostgreSQL if not running
echo "🔧 Checking PostgreSQL..."
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start
else
    sudo service postgresql start 2>/dev/null || true
fi

# Ensure environment file exists
if [[ ! -f .env ]]; then
    echo "📝 Creating environment file..."
    cat > .env << 'EOF'
DATABASE_URL=postgresql://phishnet_user:phishnet_password@localhost:5432/phishnet_db
PORT=3000
NODE_ENV=development
SESSION_SECRET=dev-secret-key-change-in-production
APP_URL=http://localhost:3000
EOF
fi

# Install dependencies if node_modules doesn't exist
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Setup database if needed
echo "🗄️ Setting up database..."
npm run db:push >/dev/null 2>&1 || echo "⚠️ Database schema setup had issues, but continuing..."

# Import sample data if needed
npm run import-data >/dev/null 2>&1 || echo "⚠️ Sample data import had issues, but continuing..."

echo ""
echo "======================================"
echo "🎣 PhishNet Development Server 🎣"
echo "======================================"
echo "🌐 URL: http://localhost:3000"
echo "📧 Email: admin@phishnet.local"
echo "🔑 Password: admin123"
echo "🔧 Debug: http://localhost:3000/debug"
echo "======================================"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Start development server
if [[ "$(uname)" == "Darwin" ]] || [[ "$(uname)" == Linux* ]]; then
    NODE_ENV=development npx tsx server/index.ts
else
    npm run dev
fi
