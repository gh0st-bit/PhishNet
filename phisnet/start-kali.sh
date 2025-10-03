#!/bin/bash

# PhishNet Quick Start Script for Kali Linux
echo "🎣 Starting PhishNet services..."

# Start PostgreSQL if not running
sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start

# Start PhishNet
echo "🚀 Launching PhishNet..."
echo "🌐 Access at: http://localhost:3000"
echo "📧 Login: admin@phishnet.local / admin123"
echo ""

# Run PhishNet
npm run start:prod
