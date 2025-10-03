#!/bin/bash

# PhishNet Dependency Verification Script
echo "🔍 Verifying PhishNet Dependencies..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MISSING_DEPS=0

check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $1 is installed${NC}"
        if [ "$2" != "" ]; then
            echo "   Version: $($1 $2 2>/dev/null || echo 'Unknown')"
        fi
    else
        echo -e "${RED}❌ $1 is NOT installed${NC}"
        MISSING_DEPS=$((MISSING_DEPS + 1))
    fi
}

check_service() {
    if systemctl is-active --quiet "$1" 2>/dev/null; then
        echo -e "${GREEN}✅ $1 service is running${NC}"
    elif service "$1" status >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $1 service is available${NC}"
    else
        echo -e "${YELLOW}⚠️ $1 service status unknown${NC}"
    fi
}

echo "📦 Checking System Dependencies..."
check_command "node" "--version"
check_command "npm" "--version"
check_command "git" "--version"
check_command "curl" "--version"
check_command "postgresql" "--version"

echo ""
echo "🔧 Checking Build Tools..."
check_command "python3" "--version"
check_command "gcc" "--version"
check_command "make" "--version"

echo ""
echo "🧩 Checking Optional Tools..."
check_command "pm2" "--version"
echo "(Native stack only)"

echo ""
echo "⚙️ Checking Services..."
check_service "postgresql"

echo ""
echo "📊 Checking Node.js Version..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✅ Node.js $NODE_VERSION is compatible${NC}"
    else
        echo -e "${RED}❌ Node.js $NODE_VERSION is too old. Requires 18+${NC}"
        MISSING_DEPS=$((MISSING_DEPS + 1))
    fi
fi

echo ""
echo "� Checking Database Connection..."
if PGPASSWORD="phishnet_password" psql -h localhost -U phishnet_user -d phishnet_db -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${YELLOW}⚠️ Database connection failed (may need setup)${NC}"
fi

echo ""
echo "💾 Checking Disk Space..."
AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
AVAILABLE_GB=$((AVAILABLE_SPACE / 1024 / 1024))

if [ "$AVAILABLE_GB" -ge 5 ]; then
    echo -e "${GREEN}✅ Sufficient disk space: ${AVAILABLE_GB}GB available${NC}"
else
    echo -e "${YELLOW}⚠️ Low disk space: ${AVAILABLE_GB}GB available (5GB+ recommended)${NC}"
fi

echo ""
echo "🧠 Checking Memory..."
if command -v free >/dev/null 2>&1; then
    AVAILABLE_MEM=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$AVAILABLE_MEM" -ge 2048 ]; then
        echo -e "${GREEN}✅ Sufficient memory: ${AVAILABLE_MEM}MB available${NC}"
    else
        echo -e "${YELLOW}⚠️ Low memory: ${AVAILABLE_MEM}MB available (2GB+ recommended)${NC}"
    fi
fi

echo ""
echo "======================================"
if [ "$MISSING_DEPS" -eq 0 ]; then
    echo -e "${GREEN}🎉 All dependencies are satisfied!${NC}"
    echo "You can run PhishNet with: ./start-dev.sh"
else
    echo -e "${RED}❌ $MISSING_DEPS dependencies are missing${NC}"
    echo -e "${YELLOW}💡 Run ./deploy.sh to install missing dependencies${NC}"
fi
echo "======================================"
