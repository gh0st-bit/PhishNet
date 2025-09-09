
#!/bin/bash

# PhishNet Production Startup Script
echo "🎣 Starting PhishNet Production Environment..."

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: package.json not found. Please run this script from the PhishNet root directory."
    exit 1
fi

# Start Redis if not running
echo "🔧 Starting Redis..."
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis 2>/dev/null || sudo redis-server --daemonize yes
else
    sudo redis-server --daemonize yes
fi

# Start PostgreSQL if not running
echo "🔧 Starting PostgreSQL..."
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql
else
    sudo service postgresql start
fi

# Build if needed
if [[ ! -d "dist" ]]; then
    echo "🔨 Building application..."
    npm run build
fi

echo ""
echo "======================================"
echo "🎣 PhishNet Production Server 🎣"
echo "======================================"
echo "🌐 URL: http://localhost:3000"
echo "📧 Email: admin@phishnet.local"
echo "🔑 Password: admin123"
echo "======================================"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Start production server
if command -v pm2 >/dev/null 2>&1 && [[ -f "ecosystem.config.js" ]]; then
    echo "🚀 Starting with PM2..."
    pm2 start ecosystem.config.js --env production
else
    echo "🚀 Starting with Node.js..."
    NODE_ENV=production npx tsx server/index.ts
fi
