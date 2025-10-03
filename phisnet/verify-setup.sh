#!/bin/bash

# PhishNet Setup Verification Script
# Verifies that all components are properly installed and configured

echo "🔍 PhishNet Setup Verification"
echo "================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Success/failure functions
success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️ $1${NC}"; }

# Track overall status
ERRORS=0
WARNINGS=0

# Check Node.js
info "Checking Node.js installation..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    success "Node.js installed: $NODE_VERSION"
    if [[ "$NODE_VERSION" < "v18" ]]; then
        warning "Node.js version is below recommended v18+"
        ((WARNINGS++))
    fi
else
    error "Node.js not found"
    ((ERRORS++))
fi

# Check npm
info "Checking npm installation..."
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    success "npm installed: $NPM_VERSION"
else
    error "npm not found"
    ((ERRORS++))
fi

# Check PostgreSQL
info "Checking PostgreSQL installation..."
if command -v psql >/dev/null 2>&1; then
    PSQL_VERSION=$(psql --version | head -n1)
    success "PostgreSQL installed: $PSQL_VERSION"
    
    # Check if PostgreSQL service is running
    if sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
        success "PostgreSQL service is running"
        
        # Check if phishnet database exists
        if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw phishnet; then
            success "PhishNet database exists"
            
            # Check table count
            TABLE_COUNT=$(sudo -u postgres psql -d phishnet -c "\dt" 2>/dev/null | grep -c "public |" || echo "0")
            if [[ "$TABLE_COUNT" -gt 0 ]]; then
                success "Database has $TABLE_COUNT tables"
            else
                warning "Database appears to be empty"
                ((WARNINGS++))
            fi
        else
            error "PhishNet database not found"
            ((ERRORS++))
        fi
    else
        error "PostgreSQL service not running or not accessible"
        ((ERRORS++))
    fi
else
    error "PostgreSQL not found"
    ((ERRORS++))
fi

# Check Redis
info "Skipping Redis check (no longer required)"

# Check Git
info "Checking Git installation..."
if command -v git >/dev/null 2>&1; then
    GIT_VERSION=$(git --version)
    success "Git installed: $GIT_VERSION"
else
    warning "Git not found (needed for updates)"
    ((WARNINGS++))
fi

# (legacy container check removed)

# Check project files
info "Checking PhishNet project files..."
if [[ -f "package.json" ]]; then
    success "package.json found"
else
    error "package.json not found - are you in the PhishNet directory?"
    ((ERRORS++))
fi

if [[ -f ".env" ]]; then
    success ".env file found"
    
    # Check key environment variables
    if grep -q "DATABASE_URL=" .env; then
        success "Database URL configured"
    else
        error "DATABASE_URL not found in .env"
        ((ERRORS++))
    fi
    
    if grep -q "PORT=" .env; then
        PORT=$(grep "PORT=" .env | cut -d= -f2)
        success "Port configured: $PORT"
    else
        warning "PORT not configured"
        ((WARNINGS++))
    fi
else
    error ".env file not found"
    ((ERRORS++))
fi

# Check node_modules
if [[ -d "node_modules" ]]; then
    success "Node modules installed"
else
    warning "Node modules not found - run 'npm install'"
    ((WARNINGS++))
fi

# Check required directories
REQUIRED_DIRS=("logs" "uploads" "temp" "exports" "backups")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        success "Directory $dir exists"
    else
        warning "Directory $dir missing (will be created automatically)"
        ((WARNINGS++))
    fi
done

# Check migrations
if [[ -d "migrations" ]]; then
    success "Migrations directory found"
    
    if [[ -f "migrations/00_phishnet_schema.sql" ]]; then
        success "Database schema file found"
    else
        error "Database schema file missing"
        ((ERRORS++))
    fi
    
    if [[ -f "migrations/01_sample_data.sql" ]]; then
        success "Sample data file found"
    else
        warning "Sample data file missing"
        ((WARNINGS++))
    fi
else
    error "Migrations directory not found"
    ((ERRORS++))
fi

# Test database connection
info "Testing database connection..."
if [[ -f ".env" ]]; then
    DB_URL=$(grep "DATABASE_URL=" .env | cut -d= -f2-)
    if npm run db:push >/dev/null 2>&1; then
        success "Database connection successful"
    else
        error "Database connection failed"
        ((ERRORS++))
    fi
fi

# Final summary
echo ""
echo "================================"
echo "🎯 Verification Summary"
echo "================================"

if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
    success "All checks passed! PhishNet is ready to use."
    echo ""
    info "Start PhishNet with: ./start.sh"
    info "Access at: http://localhost:3000"
    info "Login: admin@phishnet.local / admin123"
elif [[ $ERRORS -eq 0 ]]; then
    warning "$WARNINGS warning(s) found - PhishNet should work but may have issues"
    echo ""
    info "Start PhishNet with: ./start.sh"
    info "Access at: http://localhost:3000"
    info "Login: admin@phishnet.local / admin123"
else
    error "$ERRORS error(s) and $WARNINGS warning(s) found"
    echo ""
    error "Please fix the errors before starting PhishNet"
    echo ""
    info "Run './deploy.sh' to fix most issues automatically"
fi

echo ""
exit $ERRORS
