#!/bin/bash
# =========================================
# PhishNet Environment Configuration Script
# =========================================
# This script helps you create a .env file interactively

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   PhishNet Environment Setup           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Setup cancelled.${NC}"
        exit 0
    fi
fi

echo -e "${BLUE}🔐 Let's configure your PhishNet environment...${NC}"
echo ""

# =========================================
# Database Configuration
# =========================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Database Configuration${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "PostgreSQL Host [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "PostgreSQL Port [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database Name [phishnet]: " DB_NAME
DB_NAME=${DB_NAME:-phishnet}

read -p "PostgreSQL Username [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "PostgreSQL Password: " DB_PASSWORD
echo ""

# =========================================
# Server Configuration
# =========================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Server Configuration${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Server Port [5000]: " PORT
PORT=${PORT:-5000}

read -p "Environment (development/production) [development]: " NODE_ENV
NODE_ENV=${NODE_ENV:-development}

# Generate secure session secret
echo -e "${YELLOW}⚙️  Generating secure session secret...${NC}"
if command -v openssl &> /dev/null; then
    SESSION_SECRET=$(openssl rand -base64 32)
else
    SESSION_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
fi
echo -e "${GREEN}✓ Session secret generated${NC}"

# =========================================
# Email Configuration (Optional)
# =========================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Email Configuration (Optional)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📧 Configure SMTP for sending phishing simulation emails${NC}"
echo -e "${YELLOW}   Press Enter to skip if not needed now${NC}"
echo ""

read -p "SMTP Host (e.g., smtp.gmail.com): " SMTP_HOST
if [ ! -z "$SMTP_HOST" ]; then
    read -p "SMTP Port [587]: " SMTP_PORT
    SMTP_PORT=${SMTP_PORT:-587}
    
    read -p "SMTP Username: " SMTP_USER
    read -sp "SMTP Password: " SMTP_PASS
    echo ""
    
    read -p "From Email Address [noreply@phishnet.local]: " SMTP_FROM
    SMTP_FROM=${SMTP_FROM:-noreply@phishnet.local}
else
    SMTP_PORT=587
    SMTP_USER=""
    SMTP_PASS=""
    SMTP_FROM="noreply@phishnet.local"
fi

# =========================================
# API Keys (Optional)
# =========================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  API Keys (Optional)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔑 These enhance PhishNet's features but are optional${NC}"
echo ""

read -p "AlienVault OTX API Key (threat intelligence): " OTX_API_KEY
read -p "Google Gemini API Key (AI features): " GEMINI_API_KEY

# =========================================
# Write .env file
# =========================================
echo ""
echo -e "${YELLOW}📝 Writing configuration to .env...${NC}"

cat > .env << EOF
# =========================================
# PhishNet Environment Configuration
# Generated: $(date)
# =========================================

# =========================================
# Database Configuration
# =========================================
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# =========================================
# Server Configuration
# =========================================
PORT=${PORT}
NODE_ENV=${NODE_ENV}

# =========================================
# Session Configuration
# =========================================
SESSION_SECRET=${SESSION_SECRET}
SESSION_MAX_AGE=1800000

# =========================================
# Email Configuration
# =========================================
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=false
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}

# =========================================
# Threat Intelligence API Keys
# =========================================
OTX_API_KEY=${OTX_API_KEY}

# =========================================
# AI/ML Configuration
# =========================================
GEMINI_API_KEY=${GEMINI_API_KEY}

# =========================================
# Application URLs
# =========================================
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:${PORT}

# =========================================
# File Upload Configuration
# =========================================
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# =========================================
# Security Settings
# =========================================
CORS_ORIGIN=http://localhost:5173,http://localhost:${PORT}
ALLOW_REGISTRATION=true

# =========================================
# Logging Configuration
# =========================================
LOG_LEVEL=info
LOG_FILE=./logs/phishnet.log
DEBUG=false
SQL_LOGGING=false
EOF

# Set secure permissions
chmod 600 .env

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Configuration Complete! ✓          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📄 Configuration saved to: .env${NC}"
echo -e "${YELLOW}⚠️  Keep this file secure and never commit it to git!${NC}"
echo ""
