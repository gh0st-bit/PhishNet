#!/bin/bash
# 🎣 PhishNet Universal Linux/macOS Deployment
# Auto-detects environment and installs all dependencies
# Native-only deployment script (containers removed)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# Help message
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "PhishNet Universal Deployment Script"
    echo "Usage: ./deploy.sh [--production] [--skip-deps] [--help]"
    echo "  --production   Deploy for production"
    echo "  --skip-deps    Skip dependency installation"
    echo "  --help         Show this help"
    exit 0
fi

# Parse arguments
PRODUCTION=false
SKIP_DEPS=false
FROM_ENV=false
CI_SECRETS_ENABLED=true
for arg in "$@"; do
    case $arg in
        --production) PRODUCTION=true ;;
        --skip-deps) SKIP_DEPS=true ;;
        --from-env|--env|--secrets) FROM_ENV=true ;;
        --no-ci-secrets) CI_SECRETS_ENABLED=false ;;
    esac
done

# Banner
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}🎣 PhishNet Universal Deployment 🎣${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}🚀 Auto-installs all dependencies${NC}"
echo -e "${BLUE}🔧 Configures services automatically${NC}"
echo -e "${BLUE}Environment: native services (PostgreSQL, Node.js)${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Verify we're in the right directory
if [[ ! -f "package.json" ]]; then
    error "package.json not found. Please run from PhishNet directory."
    exit 1
fi

# Auto chmod function - makes scripts executable
auto_chmod() {
    info "🔧 Setting script permissions..."
    
    # List of scripts that should be executable
    local scripts=(
        "deploy.sh"
        "start.sh" 
    # legacy container fix script removed
    # redis fix script removed
        "reset-db.sh"
        "check-deps.sh"
        "start-dev.sh"
        "start-prod.sh"
        "start-kali.sh"
        "fix-final-errors.sh"
        "create-package.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]]; then
            chmod +x "$script" 2>/dev/null || true
            if [[ -x "$script" ]]; then
                success "Made $script executable"
            else
                warning "Failed to make $script executable"
            fi
        fi
    done
    
    # Also make any .sh files executable
    find . -maxdepth 1 -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    
    # Fix directory permissions if needed
    if [[ ! -w "." ]]; then
        warning "Directory not writable, attempting to fix permissions..."
        chmod 755 . 2>/dev/null || true
    fi
    
    # Make node_modules/.bin executable if it exists
    if [[ -d "node_modules/.bin" ]]; then
        chmod +x node_modules/.bin/* 2>/dev/null || true
    fi
    
    success "Script permissions updated"
}

# Enhanced permission diagnostic
check_permissions() {
    info "🔍 Checking file permissions..."
    
    # Check current directory permissions
    if [[ ! -w "." ]]; then
        warning "Current directory is not writable"
        return 1
    fi
    
    # Check if we can create files
    if ! touch .permission_test 2>/dev/null; then
        warning "Cannot create files in current directory"
        return 1
    else
        rm .permission_test 2>/dev/null || true
        success "Directory permissions OK"
    fi
    
    # Check script executability
    if [[ -f "deploy.sh" && ! -x "deploy.sh" ]]; then
        warning "deploy.sh is not executable"
        chmod +x deploy.sh 2>/dev/null || true
    fi
    
    return 0
}

#

# Run auto chmod at start
check_permissions
auto_chmod

# Create missing essential scripts if they don't exist
create_missing_scripts() {
    info "📝 Checking for missing essential scripts..."
    
    # Create start.sh if missing
    if [[ ! -f "start.sh" ]]; then
        info "Creating start.sh script..."
    cat > start.sh << 'EOF'
#!/bin/bash
# 🎣 PhishNet Universal Startup Script

echo "🚀 Starting PhishNet..."

# Start services
sudo systemctl start postgresql 2>/dev/null || true

# Check .env file
if [[ ! -f ".env" ]]; then
    echo "❌ No .env file found. Run ./deploy.sh first"
    exit 1
fi

# Start application
export NODE_ENV=development
npx tsx server/index.ts
EOF
        chmod +x start.sh
        success "Created start.sh"
    fi
    
    # Create kali-quick-fix.sh if missing
    if [[ ! -f "kali-quick-fix.sh" ]]; then
        info "Creating kali-quick-fix.sh script..."
        cat > kali-quick-fix.sh << 'EOF'
#!/bin/bash
# 🚨 Kali Linux Quick Fix Script
echo "🚨 Running Kali Linux comprehensive fixes..."
echo "(legacy container fix script reference)"
echo ""

# Re-run the deployment with built-in Kali fixes
if [[ -f "deploy.sh" ]]; then
    echo "🔄 Re-running deployment with integrated Kali fixes..."
    ./deploy.sh --skip-deps
else
    echo "❌ deploy.sh not found. Please run from PhishNet directory."
    exit 1
fi
EOF
        chmod +x kali-quick-fix.sh
        success "Created kali-quick-fix.sh"
    fi
    
    # Create reset-db.sh if missing
    if [[ ! -f "reset-db.sh" ]]; then
        info "Creating reset-db.sh script..."
        cat > reset-db.sh << 'EOF'
#!/bin/bash
# 🗄️ PhishNet Database Reset Script

echo "🗄️ Resetting PhishNet database..."

# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS phishnet_db;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE phishnet_db OWNER phishnet_user;" 2>/dev/null || true

# Push schema and import data
npm run db:push
npm run import-data

echo "✅ Database reset complete"
EOF
        chmod +x reset-db.sh
        success "Created reset-db.sh"
    fi
    
    success "Essential scripts verified"
}

# Run script creation
create_missing_scripts

# Detect OS and distribution
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
        DISTRO="macOS"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS="Linux"
        DISTRO="$ID"
    else
        OS="Linux"
        DISTRO="unknown"
    fi
    
    info "📍 Detected: $OS ($DISTRO)"
}

#

# Install dependencies based on OS
install_dependencies() {
    if [[ "$SKIP_DEPS" == true ]]; then
        info "Skipping dependency installation"
        return
    fi
    
    info "📦 Installing dependencies..."
    
    case "$DISTRO" in
        ubuntu|debian|kali)
            sudo apt-get update
            sudo apt-get install -y curl wget git build-essential postgresql postgresql-contrib nodejs npm
            
            #
            
            # Install Node.js 18+ if needed
            if ! node --version | grep -q "v1[89]\|v[2-9][0-9]"; then
                curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                sudo apt-get install -y nodejs
            fi
            ;;
            
        centos|rhel)
            sudo yum update -y
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y curl wget git postgresql-server postgresql-contrib nodejs npm
            
            # Initialize PostgreSQL if needed
            if [[ ! -d "/var/lib/pgsql/data/postgresql.conf" ]]; then
                sudo postgresql-setup initdb
            fi
            ;;
            
        fedora)
            sudo dnf update -y
            sudo dnf groupinstall -y "Development Tools"
            sudo dnf install -y curl wget git postgresql-server postgresql-contrib nodejs npm
            ;;
            
        arch)
            sudo pacman -Syu --noconfirm
            sudo pacman -S --noconfirm base-devel curl wget git postgresql nodejs npm
            ;;
            
        macOS)
            # Install Homebrew if not present
            if ! command -v brew >/dev/null 2>&1; then
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            
            brew update
            brew install postgresql node git
            ;;
            
        *)
            warning "Unknown distribution: $DISTRO. Please install dependencies manually."
            ;;
    esac
    
    success "Dependencies installed"
}

# Kali-specific permission fixes
kali_permission_fixes() {
    if [[ "$DISTRO" == "kali" ]]; then
        info "🐉 Applying Kali-specific permission fixes..."
        
        # Fix common Kali permission issues
        sudo chown -R $USER:$USER . 2>/dev/null || true
        
        # Fix npm global permissions
        if [[ -d "/usr/lib/node_modules" ]]; then
            sudo chown -R $USER:$USER /usr/lib/node_modules 2>/dev/null || true
        fi
        
        # Fix .npm cache permissions
        if [[ -d "$HOME/.npm" ]]; then
            sudo chown -R $USER:$USER $HOME/.npm 2>/dev/null || true
        fi
        
        # Make sure current user owns the project directory
        if [[ "$PWD" != "$HOME"* ]]; then
            warning "Not in home directory, fixing ownership..."
            sudo chown -R $USER:$USER "$PWD" 2>/dev/null || true
        fi
        
    #
        
        success "Kali permission fixes applied"
    fi
}

# Main execution
detect_os

# Apply Kali fixes if needed
kali_permission_fixes

#

# Install other dependencies
install_dependencies

# Setup PostgreSQL
info "🗄️ Setting up PostgreSQL..."
case "$DISTRO" in
    ubuntu|debian|kali)
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        ;;
    centos|rhel|fedora)
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        ;;
    macOS)
        brew services start postgresql
        ;;
esac

# Database setup - Use consistent naming with default postgres user
sudo -u postgres psql -c "DROP DATABASE IF EXISTS phishnet;" 2>/dev/null || true
# Create database with default postgres user (no separate phishnet_user)
sudo -u postgres psql -c "CREATE DATABASE phishnet;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE phishnet TO postgres;" 2>/dev/null || true

# Verify database connection with postgres user
info "🔍 Verifying database connection..."
if sudo -u postgres psql -d phishnet -c "SELECT 1;" >/dev/null 2>&1; then
    success "Database connection verified"
else
    warning "Database connection failed, but continuing..."
fi

success "Database setup complete"

# Environment setup
info "📝 Setting up environment..."
generate_env_from_vars(){
    info "Generating .env from exported environment variables (if present)"
    local keys=(DATABASE_URL DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD SESSION_SECRET JWT_SECRET ENCRYPTION_KEY SENDGRID_API_KEY SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM)
    : > .env.generated
    local found=0
    for k in "${keys[@]}"; do
        if [[ -n "${!k:-}" ]]; then
            echo "$k=${!k}" >> .env.generated
            found=1
        fi
    done
    if [[ $found -eq 0 ]]; then
        rm -f .env.generated
        return 1
    fi
    return 0
}

merge_secrets(){
    # Only merge if CI and enabled
    if [[ -z "${GITHUB_ACTIONS:-}" || "$CI_SECRETS_ENABLED" != true ]]; then
        return 0
    fi
    info "🔐 Merging GitHub Actions secrets into .env"
    generate_env_from_vars || return 0
    touch .env
    while IFS='=' read -r k v; do
        [[ -z "$k" || "$k" =~ ^# ]] && continue
        if grep -q "^${k}=" .env; then
            sed -i "s|^${k}=.*|${k}=${v}|" .env
        else
            echo "${k}=${v}" >> .env
        fi
    done < .env.generated
    rm -f .env.generated
    success "Secrets merged (keys only): $(grep -E '^[A-Za-z0-9_]+=' .env | cut -d'=' -f1 | tr '\n' ' ')"
}

if [[ $FROM_ENV == true ]]; then
    if generate_env_from_vars; then
        mv .env.generated .env
        success ".env created from environment variables"
    else
        warning "--from-env specified but no recognized variables found"
    fi
fi

if [[ ! -f ".env" ]]; then
    cat > .env << EOF
# PhishNet Auto-Generated Environment Configuration
# Generated: $(date)

# Application Settings
NODE_ENV=development
PORT=3000
APP_NAME=PhishNet
APP_VERSION=1.0.0
APP_URL=http://localhost:3000

# Database Configuration (Auto-configured)
DATABASE_URL=postgresql://postgres@localhost:5432/phishnet
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phishnet
DB_USER=postgres
DB_PASSWORD=

# Security Settings (Change in production!)
SESSION_SECRET=phishnet-dev-secret-$(date +%s)
JWT_SECRET=phishnet-jwt-secret-$(date +%s)
ENCRYPTION_KEY=phishnet-encrypt-$(date +%s | sha256sum | head -c 32)

# Email Configuration (Optional - for sending phishing emails)
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@phishnet.local

# Upload Configuration
UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR=./uploads

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/phishnet.log

# Features Configuration
ENABLE_REGISTRATION=false
ENABLE_API=true
ENABLE_SWAGGER_DOCS=true
ENABLE_METRICS=true

# Default Admin Account (Auto-created)
DEFAULT_ADMIN_EMAIL=admin@phishnet.local
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_NAME=PhishNet Administrator
EOF
    success "Environment file created with full configuration"
fi

# Merge CI secrets if present
merge_secrets || true

# Verify .env file
if [[ -f ".env" ]]; then
    info "📋 Environment file contents:"
    cat .env | sed 's/PASSWORD=.*/PASSWORD=***/' | sed 's/SECRET=.*/SECRET=***/' | sed 's/KEY=.*/KEY=***/' # Hide secrets in output
    success "Environment verified"
else
    error "Failed to create .env file"
    exit 1
fi

# Create necessary directories
info "📁 Creating required directories..."
mkdir -p logs uploads temp exports backups 2>/dev/null
chmod 755 logs uploads temp exports backups 2>/dev/null
success "Required directories created"

# Install npm dependencies with Node/esbuild compatibility guard
info "🚀 Setting up PhishNet application..."

# Detect unsupported newer Node majors for some build tools
NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/v([0-9]+).*/\1/' || echo 0)
if [[ $NODE_MAJOR -gt 20 ]]; then
    warning "Detected Node major $NODE_MAJOR. Recommended Node 20 LTS to avoid esbuild binary mismatch (see contributor error)."
    warning "If install fails, install Node 20 (e.g. nvm install 20 && nvm use 20) then re-run deploy.sh"
fi

# Attempt install with retry focusing on esbuild if mismatch occurs
if ! npm install; then
    warning "npm install failed – attempting esbuild version alignment and retry..."
    EXPECTED_ESBUILD=$(node -p "(require('./package.json').devDependencies||{}).esbuild || ''" 2>/dev/null)
    if [[ -n "$EXPECTED_ESBUILD" ]]; then
        npm install -D esbuild@"$EXPECTED_ESBUILD" || true
    fi
    npm install || error "Final npm install attempt failed. Resolve manually (often due to Node version)."
fi

# Database schema and data setup
info "🗄️ Setting up database schema..."
npm run db:push 2>/dev/null || {
    warning "Database schema setup had issues, trying manual SQL import..."
    if [[ -f "migrations/00_phishnet_schema.sql" ]]; then
        sudo -u postgres psql -d phishnet -f migrations/00_phishnet_schema.sql 2>/dev/null || warning "Manual schema import failed"
    fi
}

# Sample data import
info "📊 Importing sample data and creating admin user..."
npm run import-data 2>/dev/null || {
    warning "Sample data import had issues, trying manual SQL import..."
    if [[ -f "migrations/01_sample_data.sql" ]]; then
        sudo -u postgres psql -d phishnet -f migrations/01_sample_data.sql 2>/dev/null || warning "Manual data import failed"
    fi
}

# Verify database setup
info "🔍 Verifying database setup..."
if sudo -u postgres psql -d phishnet -c "\dt" >/dev/null 2>&1; then
    TABLE_COUNT=$(sudo -u postgres psql -d phishnet -c "\dt" 2>/dev/null | grep -c "public |" || echo "0")
    success "Database verified - $TABLE_COUNT tables found"
else
    warning "Database verification failed"
fi

# Production build
if [[ "$PRODUCTION" == true ]]; then
    info "🔨 Building for production..."
    npm run build
fi

# Completion
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}🎉 PhishNet Deployment Complete! 🎉${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "🌐 URL: http://localhost:3000"
echo -e "📧 Email: admin@phishnet.local"
echo -e "🔑 Password: admin123"
#

# Kali-specific instructions
#

echo -e "${GREEN}======================================${NC}"
echo ""

if [[ "$PRODUCTION" != true ]]; then
    if [[ -n "${GITHUB_ACTIONS:-}" || ! -t 0 ]]; then
        info "CI / non-interactive shell detected – skipping dev server auto-start prompt."
    else
        read -p "🚀 Start PhishNet development server now? (Y/n): " start_choice
        if [[ "$start_choice" != "n" && "$start_choice" != "N" ]]; then
            info "Starting PhishNet..."
            export NODE_ENV=development
            npx tsx server/index.ts
        else
            info "To start later: ./start.sh"
        fi
    fi
fi

# Create friend deployment package automatically
create_friend_package() {
    info "🎁 Creating friend deployment package..."
    
    # Check if package already exists from create-package.sh
    EXISTING_PACKAGE=$(find . -maxdepth 1 -name "PhishNet-Package-*" -type d 2>/dev/null | head -1)
    
    if [[ -n "$EXISTING_PACKAGE" ]]; then
        info "Found existing package: $EXISTING_PACKAGE"
        PACKAGE_DIR="$EXISTING_PACKAGE"
    else
        # Create new package directory
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        PACKAGE_DIR="PhishNet-Package-Linux-$TIMESTAMP"
        mkdir -p "$PACKAGE_DIR"
        info "Created new package: $PACKAGE_DIR"
    fi
    
    # Essential files for friend deployment
    ESSENTIAL_FILES=(
        "deploy.sh"
        "start.sh"
        "deploy.ps1"
        "deploy.bat"
        "start.ps1" 
        "start.bat"
        "test-deployment.ps1"
        "QUICK-FRIEND-SETUP.md"
        "FRIEND-DEPLOYMENT-GUIDE.md"
        "WINDOWS-SETUP.md"
        "UNIVERSAL-SETUP.md"
        "package.json"
        ".env.example"
    )
    
    info "📋 Adding essential files to package..."
    for file in "${ESSENTIAL_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            cp "$file" "$PACKAGE_DIR/" 2>/dev/null || true
            success "Added: $file"
        fi
    done
    
    # Copy source directories
    SOURCE_DIRS=("client" "server" "shared" "migrations" "docs")
    for dir in "${SOURCE_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            cp -r "$dir" "$PACKAGE_DIR/" 2>/dev/null || true
            success "Added directory: $dir"
        fi
    done
    
    # Copy configuration files
    CONFIG_FILES=("tsconfig.json" "tailwind.config.ts" "vite.config.ts" "drizzle.config.ts" "components.json")
    for file in "${CONFIG_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            cp "$file" "$PACKAGE_DIR/" 2>/dev/null || true
            success "Added config: $file"
        fi
    done
    
    # Create universal README for the package
    cat > "$PACKAGE_DIR/README.md" << 'EOF'
# 🎣 PhishNet Universal Deployment Package

## Quick Setup Guide

### For Windows Users (Recommended)
1. Extract to `C:\PhishNet\`
2. Open **PowerShell as Administrator**
3. Navigate: `cd C:\PhishNet\phishnet`
4. Deploy: `.\deploy.ps1`
5. Start: `.\start.ps1`
6. Access: http://localhost:3000

### For Linux/macOS Users
1. Extract package: `unzip PhishNet-Package-*.zip`
2. Navigate: `cd PhishNet-Package-*/`
3. Deploy: `chmod +x deploy.sh && ./deploy.sh`
4. Start: `./start.sh`
5. Access: http://localhost:3000

## Default Login Credentials
- **URL**: http://localhost:3000
- **Email**: admin@phishnet.local
- **Password**: admin123

## What Gets Auto-Installed
✅ Node.js 18+ (JavaScript runtime)
✅ PostgreSQL (Database)
✅ Git (Version control)
#

## Deployment Features
- **Auto-Detection**: Automatically detects your operating system
- **Smart Installation**: Uses system package managers (apt, brew, choco, etc.)
- **Error Handling**: Comprehensive error detection and fixes
- **Multi-Platform**: Works on Windows, Linux, macOS
- **Zero Configuration**: Everything pre-configured and ready to go

## Quick Troubleshooting

### Windows Issues
```powershell
# Execution policy error
Set-ExecutionPolicy Bypass -Scope Process -Force

# Port 3000 busy
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Run as Administrator
Right-click PowerShell → "Run as Administrator"
```

### Linux/macOS Issues
```bash
# Permission issues
chmod +x *.sh

# Service issues  
sudo systemctl status postgresql

# Restart deployment
./deploy.sh
```

### Universal Issues
- **Internet connection required** for downloading dependencies
- **Administrator/sudo privileges needed** for installing software
- **Wait 2-3 minutes** after deployment before starting
- **Check firewall settings** if can't access localhost:3000

## Advanced Options

### Production Deployment
```bash
# Linux/macOS
./deploy.sh --production

# Windows
.\deploy.ps1 -Production
```

### Skip Dependencies (if already installed)
```bash
# Linux/macOS
./deploy.sh --skip-deps

# Windows  
.\deploy.ps1 -SkipDeps
```

### Test Deployment
```bash
# Windows only
.\test-deployment.ps1
```

## Package Contents
- ✅ Complete PhishNet source code
- ✅ Automated deployment scripts (Windows & Linux)
- ✅ Database schema and migrations
#
- ✅ Comprehensive documentation
- ✅ Troubleshooting guides
- ✅ Sample configurations

## Support & Documentation
- **Windows Guide**: `WINDOWS-SETUP.md`
- **Quick Reference**: `QUICK-FRIEND-SETUP.md`
- **Detailed Guide**: `FRIEND-DEPLOYMENT-GUIDE.md`
- **Universal Setup**: `UNIVERSAL-SETUP.md`

**🎯 This package contains everything needed for a complete PhishNet deployment on any operating system!**
EOF
    
    success "Added: README.md"
    
    # Make scripts executable
    chmod +x "$PACKAGE_DIR"/*.sh 2>/dev/null || true
    
    # Try to create ZIP/tar archive
    if command -v zip >/dev/null 2>&1; then
        ZIP_FILE="${PACKAGE_DIR}.zip"
        if [[ -f "$ZIP_FILE" ]]; then
            rm "$ZIP_FILE"
        fi
        
        cd "$PACKAGE_DIR" && zip -r "../$ZIP_FILE" . >/dev/null 2>&1 && cd ..
        if [[ -f "$ZIP_FILE" ]]; then
            FILE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
            echo ""
            echo -e "${GREEN}======================================${NC}"
            echo -e "${GREEN}🎉 Friend Package Created Successfully! 🎉${NC}"
            echo -e "${GREEN}======================================${NC}"
            echo -e "📦 Package: $ZIP_FILE"
            echo -e "📏 Size: $FILE_SIZE"
            echo ""
            echo -e "${BLUE}📤 To share with friends:${NC}"
            echo -e "   1. Send them: $ZIP_FILE"
            echo -e "   2. Windows: Extract → PowerShell Admin → .\\deploy.ps1"
            echo -e "   3. Linux/Mac: Extract → chmod +x deploy.sh → ./deploy.sh"
            echo -e "${GREEN}======================================${NC}"
            echo ""
        fi
    elif command -v tar >/dev/null 2>&1; then
        TAR_FILE="${PACKAGE_DIR}.tar.gz"
        if [[ -f "$TAR_FILE" ]]; then
            rm "$TAR_FILE"
        fi
        
        tar -czf "$TAR_FILE" "$PACKAGE_DIR" >/dev/null 2>&1
        if [[ -f "$TAR_FILE" ]]; then
            FILE_SIZE=$(du -h "$TAR_FILE" | cut -f1)
            echo ""
            echo -e "${GREEN}======================================${NC}"
            echo -e "${GREEN}🎉 Friend Package Created Successfully! 🎉${NC}"
            echo -e "${GREEN}======================================${NC}"
            echo -e "📦 Package: $TAR_FILE"
            echo -e "📏 Size: $FILE_SIZE"
            echo ""
            echo -e "${BLUE}📤 To share with friends:${NC}"
            echo -e "   1. Send them: $TAR_FILE"
            echo -e "   2. Extract: tar -xzf $TAR_FILE"
            echo -e "   3. Deploy: cd $PACKAGE_DIR && ./deploy.sh"
            echo -e "${GREEN}======================================${NC}"
            echo ""
        fi
    else
        warning "zip/tar not available. Package folder ready: $PACKAGE_DIR"
        info "You can manually compress the folder to share with friends"
    fi
    
    return 0
}

# Always create friend package after successful deployment
echo ""
info "🎁 Creating shareable package for friends..."
create_friend_package
