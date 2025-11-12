#!/bin/bash
# =========================================
# PhishNet Complete Installation Script
# Linux / macOS
# =========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Clear screen
clear

# Banner
echo -e "${CYAN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                       ║${NC}"
echo -e "${CYAN}║       ${MAGENTA}██████╗ ██╗  ██╗██╗███████╗██╗  ██╗${CYAN}          ║${NC}"
echo -e "${CYAN}║       ${MAGENTA}██╔══██╗██║  ██║██║██╔════╝██║  ██║${CYAN}          ║${NC}"
echo -e "${CYAN}║       ${MAGENTA}██████╔╝███████║██║███████╗███████║${CYAN}          ║${NC}"
echo -e "${CYAN}║       ${MAGENTA}██╔═══╝ ██╔══██║██║╚════██║██╔══██║${CYAN}          ║${NC}"
echo -e "${CYAN}║       ${MAGENTA}██║     ██║  ██║██║███████║██║  ██║${CYAN}          ║${NC}"
echo -e "${CYAN}║       ${MAGENTA}╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝${CYAN}          ║${NC}"
echo -e "${CYAN}║                                                       ║${NC}"
echo -e "${CYAN}║          ${GREEN}Automated Installation Script${CYAN}              ║${NC}"
echo -e "${CYAN}║              ${YELLOW}v1.0.0 - October 2025${CYAN}                ║${NC}"
echo -e "${CYAN}║                                                       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}This script will install and configure PhishNet${NC}"
echo -e "${BLUE}Please ensure you have sudo privileges if needed${NC}"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# =========================================
# Step 1: System Requirements Check
# =========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Step 1/8: Checking System Requirements${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check OS
OS="$(uname -s)"
echo -e "${CYAN}→ Detected OS: ${OS}${NC}"

# Check Node.js
echo -e "${CYAN}→ Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo -e "${YELLOW}Please install Node.js 18 or higher from: https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version must be 18 or higher (found: v${NODE_VERSION})${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"

# Check npm
echo -e "${CYAN}→ Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v) installed${NC}"

# Check PostgreSQL
echo -e "${CYAN}→ Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}✗ PostgreSQL not found${NC}"
    echo -e "${YELLOW}Please install PostgreSQL 14 or higher from: https://www.postgresql.org/download/${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL installed${NC}"

# Check Git
echo -e "${CYAN}→ Checking Git...${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠ Git not found (optional but recommended)${NC}"
else
    echo -e "${GREEN}✓ Git $(git --version | cut -d' ' -f3) installed${NC}"
fi

echo ""
echo -e "${GREEN}✓ All prerequisites met!${NC}"
echo ""
sleep 1

# =========================================
# Step 2: Environment Configuration
# =========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Step 2/8: Environment Configuration${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ! -f .env ]; then
    echo -e "${CYAN}→ Creating environment configuration...${NC}"
    bash installation/scripts/setup-env.sh
else
    echo -e "${GREEN}✓ Environment configuration already exists${NC}"
fi

# Load environment variables
source .env
echo ""
sleep 1

# =========================================
# Step 3: Database Setup
# =========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Step 3/8: Database Setup${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}→ Checking if database exists...${NC}"

# Set PostgreSQL password env variable
export PGPASSWORD=$DB_PASSWORD

# Check if database exists
DB_EXISTS=$(psql -U $DB_USER -h $DB_HOST -lqt | cut -d \| -f 1 | grep -qw $DB_NAME && echo "yes" || echo "no")

if [ "$DB_EXISTS" = "yes" ]; then
    echo -e "${YELLOW}⚠ Database '${DB_NAME}' already exists${NC}"
    read -p "Drop and recreate? This will DELETE ALL DATA! (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}→ Dropping existing database...${NC}"
        psql -U $DB_USER -h $DB_HOST -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
        psql -U $DB_USER -h $DB_HOST -c "CREATE DATABASE $DB_NAME;"
        echo -e "${GREEN}✓ Database recreated${NC}"
    else
        echo -e "${YELLOW}⚠ Using existing database${NC}"
    fi
else
    echo -e "${CYAN}→ Creating database '${DB_NAME}'...${NC}"
    psql -U $DB_USER -h $DB_HOST -c "CREATE DATABASE $DB_NAME;"
    echo -e "${GREEN}✓ Database created${NC}"
fi

# Import schema
if [ -f server/db/schema.sql ]; then
    echo -e "${CYAN}→ Importing database schema...${NC}"
    psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f server/db/schema.sql > /dev/null 2>&1
    echo -e "${GREEN}✓ Schema imported${NC}"
else
    echo -e "${YELLOW}⚠ No schema.sql found, skipping schema import${NC}"
fi

# Unset password
unset PGPASSWORD

echo ""
sleep 1

# =========================================
# Step 4: Install Dependencies
# =========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Step 4/8: Installing Dependencies${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}→ Installing Node.js packages (this may take a few minutes)...${NC}"
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
sleep 1

# =========================================
# Step 5: Database Seeding (Optional)
# =========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Step 5/8: Database Seeding (Optional)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f server/db/seed.sql ]; then
    read -p "Import sample data for testing? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${CYAN}→ Importing sample data...${NC}"
        export PGPASSWORD=$DB_PASSWORD
        psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f server/db/seed.sql > /dev/null 2>&1
        unset PGPASSWORD
        echo -e "${GREEN}✓ Sample data imported${NC}"
    else
        echo -e "${YELLOW}⚠ Skipped sample data import${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No seed.sql found, skipping${NC}"
fi

echo ""
sleep 1

# =========================================
# Step 6: Build Application
# =========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Step 6/8: Building Application${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}→ Building client and server...${NC}"
npm run build
echo -e "${GREEN}✓ Application built successfully${NC}"

echo ""
sleep 1

# =========================================
# Step 7: Create Required Directories
# =========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Step 7/8: Creating Required Directories${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

mkdir -p uploads logs temp backups
echo -e "${GREEN}✓ Directories created${NC}"

echo ""
sleep 1

# =========================================
# Step 8: Final Setup
# =========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Step 8/8: Final Setup${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Set permissions
chmod 600 .env
echo -e "${GREEN}✓ Secured environment file${NC}"

# Generate systemd service file (optional)
read -p "Create systemd service for auto-start? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    cat > phishnet.service << EOF
[Unit]
Description=PhishNet Security Awareness Platform
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    echo -e "${GREEN}✓ Service file created: phishnet.service${NC}"
    echo -e "${CYAN}  To install: sudo cp phishnet.service /etc/systemd/system/${NC}"
    echo -e "${CYAN}  Then: sudo systemctl enable phishnet && sudo systemctl start phishnet${NC}"
fi

echo ""
sleep 1

# =========================================
# Installation Complete
# =========================================
clear
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║          ✓ Installation Complete! ✓                  ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📊 Installation Summary:${NC}"
echo -e "   ${GREEN}✓${NC} Prerequisites verified"
echo -e "   ${GREEN}✓${NC} Environment configured"
echo -e "   ${GREEN}✓${NC} Database created and initialized"
echo -e "   ${GREEN}✓${NC} Dependencies installed"
echo -e "   ${GREEN}✓${NC} Application built"
echo -e "   ${GREEN}✓${NC} Directories created"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🚀 Quick Start:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${WHITE}  Development Mode:${NC}"
echo -e "  ${GREEN}npm run dev${NC}"
echo ""
echo -e "${WHITE}  Production Mode:${NC}"
echo -e "  ${GREEN}npm start${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🌐 Access:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${WHITE}Application:${NC} ${CYAN}http://localhost:${PORT}${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔐 Default Credentials:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${WHITE}Email:${NC}    admin@phishnet.local"
echo -e "  ${WHITE}Password:${NC} admin123"
echo ""
echo -e "  ${RED}⚠️  Change these credentials immediately after first login!${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📚 Documentation:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${WHITE}Installation Guide:${NC} installation/docs/INSTALLATION.md"
echo -e "  ${WHITE}User Manual:${NC}        installation/docs/USER-GUIDE.md"
echo -e "  ${WHITE}Troubleshooting:${NC}    installation/docs/TROUBLESHOOTING.md"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}⚠️  Important Notes:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  • Keep your ${YELLOW}.env${NC} file secure"
echo -e "  • Never commit ${YELLOW}.env${NC} to version control"
echo -e "  • Configure SMTP settings for email features"
echo -e "  • Review security settings before production use"
echo -e "  • Enable HTTPS in production environments"
echo ""
echo -e "${GREEN}Thank you for using PhishNet!${NC}"
echo ""
