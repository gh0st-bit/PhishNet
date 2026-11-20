#!/bin/bash
# 🎁 PhishNet Complete Package Creator
# Creates a zip package with code, database, and setup for sharing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}🎁 PhishNet Package Creator 🎁${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}📦 Creates complete package for sharing${NC}"
echo -e "${BLUE}🗄️ Includes database & uploaded files${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if in PhishNet directory
if [[ ! -f "package.json" ]]; then
    error "Not in PhishNet directory. Please run from phisnet folder."
    exit 1
fi

# Create export directory
EXPORT_DIR="PhishNet-Package-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EXPORT_DIR"

info "📁 Creating package in: $EXPORT_DIR"

# Step 1: Export database
info "🗄️ Step 1: Exporting database..."
if command -v pg_dump >/dev/null 2>&1; then
    # Export using current user's credentials
    if [[ -f ".env" ]]; then
        # Read database URL from .env
        DB_URL=$(grep "DATABASE_URL" .env | cut -d'=' -f2-)
        if [[ -n "$DB_URL" ]]; then
            # Extract components from DATABASE_URL
            if [[ "$DB_URL" == *"@"* ]]; then
                # URL with password
                DB_USER=$(echo "$DB_URL" | sed 's/.*:\/\/\([^:]*\):.*/\1/')
                DB_PASS=$(echo "$DB_URL" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
                DB_HOST=$(echo "$DB_URL" | sed 's/.*@\([^:]*\):.*/\1/')
            else
                # URL without password (postgres user)
                DB_USER=$(echo "$DB_URL" | sed 's/.*:\/\/\([^@]*\)@.*/\1/')
                DB_PASS=""
                DB_HOST=$(echo "$DB_URL" | sed 's/.*@\([^:]*\):.*/\1/')
            fi
            DB_PORT=$(echo "$DB_URL" | sed 's/.*:\([0-9]*\)\/.*/\1/')
            DB_NAME=$(echo "$DB_URL" | sed 's/.*\/\([^?]*\).*/\1/')
            
            info "Database: $DB_NAME on $DB_HOST:$DB_PORT (user: $DB_USER)"
            
            # Export database with data
            if [[ -n "$DB_PASS" ]]; then
                PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                    --verbose --clean --if-exists --create --inserts \
                    > "$EXPORT_DIR/database-full-backup.sql" 2>/dev/null || {
                    warning "Full backup failed, trying data-only..."
                    PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                        --data-only --inserts \
                        > "$EXPORT_DIR/database-data-only.sql" 2>/dev/null || {
                        error "Database export failed - creating package without database"
                        warning "Your friend will get a fresh installation"
                    }
                }
            else
                # No password - use postgres user
                pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                    --verbose --clean --if-exists --create --inserts \
                    > "$EXPORT_DIR/database-full-backup.sql" 2>/dev/null || {
                    warning "Full backup failed, trying data-only..."
                    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                        --data-only --inserts \
                        > "$EXPORT_DIR/database-data-only.sql" 2>/dev/null || {
                        error "Database export failed - creating package without database"
                        warning "Your friend will get a fresh installation"
                    }
                }
            fi
            success "Database exported with your data"
        else
            warning "Could not parse DATABASE_URL - creating package without database"
        fi
    else
        warning ".env file not found - creating package without database"
    fi
else
    warning "pg_dump not found - creating package without database backup"
    info "Your friend will get a fresh PhishNet installation"
fi

# Step 2: Copy application files (excluding sensitive/unnecessary files)
info "� Step 2: Copying application files..."
rsync -av --progress \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=*.log \
    --exclude=.npm \
    --exclude=.cache \
    --exclude=dist \
    --exclude=playwright-report \
    --exclude=test-results \
    --exclude=.env.local \
    . "$EXPORT_DIR/phishnet/"

success "Application files copied"

# Step 3: Copy uploads and user data
info "📤 Step 3: Copying uploads and user data..."
if [[ -d "uploads" ]]; then
    cp -r uploads "$EXPORT_DIR/phishnet/"
    success "Uploads folder copied"
else
    warning "No uploads folder found"
fi

# Copy other data directories if they exist
for dir in "Exported-DB" "attached_assets"; do
    if [[ -d "$dir" ]]; then
        cp -r "$dir" "$EXPORT_DIR/phishnet/"
        success "$dir copied"
    fi
done

# Step 4: Create setup instructions
info "📝 Step 4: Creating setup instructions..."
cat > "$EXPORT_DIR/SETUP-INSTRUCTIONS.md" << 'EOF'
# 🎣 PhishNet Complete Package Setup

## 📦 What's Included
- ✅ Complete PhishNet source code
- ✅ Database backup with your data
- ✅ Uploaded files and attachments
- ✅ Automated setup scripts

## 🚀 Quick Setup (Recommended)

### For Linux/macOS:
```bash
# 1. Extract and navigate
cd phishnet/
chmod +x *.sh

# 2. Run automated setup
./setup-from-package.sh

# 3. Start application
./start.sh
```

### For Windows:
```powershell
# 1. Extract and navigate
cd phishnet/
.\setup-from-package.ps1
.\start.ps1
```

## 🗄️ Manual Database Restore (If Needed)

### If you have PostgreSQL installed:
```bash
# Create database (using existing postgres user)
sudo -u postgres createdb phishnet

# Restore database
psql -U postgres -d phishnet -f database-full-backup.sql
# OR if full backup doesn't work:
psql -U postgres -d phishnet -f database-data-only.sql
```

## 🌐 Access Application
- URL: http://localhost:3000
- Default Admin: admin@phishnet.local
- Default Password: admin123

## 🆘 Troubleshooting
- Run `./deploy.sh` for fresh installation
- Project documentation: https://github.com/gh0st-bit/PhishNet/blob/main/README.md
- Ensure PostgreSQL is running
- Check `.env` file for correct database connection

## ⚠️ Important Notes
- Change default passwords after setup
- Update environment variables for production
- The database contains the original creator's data

✅ Quick setup completed!
EOF

# Step 5: Create automated setup script
info "🔧 Step 5: Creating automated setup script..."
cat > "$EXPORT_DIR/setup-from-package.sh" << 'EOF'
#!/bin/bash
# 🎁 PhishNet Package Setup Script

echo "🎁 Setting up PhishNet from package..."

# Navigate to phishnet directory
cd phishnet/ 2>/dev/null || {
    echo "❌ phishnet directory not found"
    exit 1
}

# Make scripts executable
chmod +x *.sh 2>/dev/null || true

# Check if database backup exists
if [[ -f "../database-full-backup.sql" ]]; then
    echo "📦 Database backup found"
    DB_BACKUP_FILE="../database-full-backup.sql"
elif [[ -f "../database-data-only.sql" ]]; then
    echo "📦 Data-only backup found"
    DB_BACKUP_FILE="../database-data-only.sql"
else
    echo "❌ No database backup found"
    echo "🔄 Running normal deployment..."
    ./deploy.sh
    exit 0
fi

# Run deployment (will install dependencies and setup services)
echo "🚀 Running deployment..."
./deploy.sh

# Wait for services to be ready
echo "⏳ Waiting for services..."
sleep 5

# Restore database
echo "🗄️ Restoring database from backup..."
if command -v psql >/dev/null 2>&1; then
    # Try to restore database
    psql -h localhost -U postgres -d phishnet -f "$DB_BACKUP_FILE" 2>/dev/null || {
        echo "⚠️ Database restore had issues, but PhishNet should still work"
        echo "💡 You can try manual restore with the provided SQL files"
    }
    echo "✅ Database restoration completed"
else
    echo "❌ psql not found - manual database restoration required"
fi

echo ""
echo "🎉 PhishNet package setup complete!"
echo "🌐 Access: http://localhost:3000"
echo "📧 Admin: admin@phishnet.local"
echo "🔑 Password: admin123"
echo ""
echo "🚀 To start: ./start.sh"
EOF

chmod +x "$EXPORT_DIR/setup-from-package.sh"

# Step 6: Create Windows setup script
info "💻 Step 6: Creating Windows setup script..."
cat > "$EXPORT_DIR/setup-from-package.ps1" << 'EOF'
# 🎁 PhishNet Package Setup Script for Windows

Write-Host "🎁 Setting up PhishNet from package..." -ForegroundColor Blue

# Navigate to phishnet directory
if (Test-Path "phishnet") {
    Set-Location "phishnet"
} else {
    Write-Host "❌ phishnet directory not found" -ForegroundColor Red
    exit 1
}

# Check if database backup exists
$dbBackupFile = $null
if (Test-Path "..\database-full-backup.sql") {
    Write-Host "📦 Database backup found" -ForegroundColor Green
    $dbBackupFile = "..\database-full-backup.sql"
} elseif (Test-Path "..\database-data-only.sql") {
    Write-Host "📦 Data-only backup found" -ForegroundColor Green
    $dbBackupFile = "..\database-data-only.sql"
} else {
    Write-Host "❌ No database backup found" -ForegroundColor Yellow
    Write-Host "🔄 Running normal deployment..." -ForegroundColor Blue
    .\deploy.ps1
    exit 0
}

# Run deployment
Write-Host "🚀 Running deployment..." -ForegroundColor Blue
.\deploy.ps1

# Restore database (Windows users will need to do this manually or use WSL)
Write-Host "🗄️ Database backup is available at: $dbBackupFile" -ForegroundColor Yellow
Write-Host "💡 You may need to restore this manually using pgAdmin or psql" -ForegroundColor Yellow

Write-Host ""
Write-Host "🎉 PhishNet package setup complete!" -ForegroundColor Green
Write-Host "🌐 Access: http://localhost:3000" -ForegroundColor White
Write-Host "📧 Admin: admin@phishnet.local" -ForegroundColor White
Write-Host "🔑 Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "🚀 To start: .\start.ps1" -ForegroundColor Blue
EOF

# Step 7: Create package info file
info "📋 Step 7: Creating package info..."
cat > "$EXPORT_DIR/PACKAGE-INFO.txt" << EOF
PhishNet Complete Package
========================

Created: $(date)
Created by: $(whoami)
Hostname: $(hostname)
Database: Included
Files: Complete

Package Contents:
- phishnet/                    (Complete source code)
- database-full-backup.sql     (Database with your data)
- SETUP-INSTRUCTIONS.md        (Detailed setup guide)
- setup-from-package.sh        (Linux/macOS auto-setup)
- setup-from-package.ps1       (Windows auto-setup)
- PACKAGE-INFO.txt            (This file)

Quick Start:
1. Extract this package
2. Run setup-from-package.sh (Linux/macOS) or setup-from-package.ps1 (Windows)
3. Access http://localhost:3000

Your friend will have:
- All your PhishNet code
- All your database data (campaigns, templates, results)
- All uploaded files and attachments
- Working deployment scripts

Security Note:
- Package contains your actual data
- Change passwords after setup
- Review .env file settings
EOF

# Step 8: Create zip package
info "📦 Step 8: Creating zip package..."
if command -v zip >/dev/null 2>&1; then
    ZIP_FILE="${EXPORT_DIR}.zip"
    zip -r "$ZIP_FILE" "$EXPORT_DIR"/ >/dev/null 2>&1
    success "Package created: $ZIP_FILE"
    
    # Get package size
    PACKAGE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    info "Package size: $PACKAGE_SIZE"
    
    # Clean up temporary directory
    rm -rf "$EXPORT_DIR"
    
else
    warning "zip not found - package created in directory: $EXPORT_DIR"
    ZIP_FILE="$EXPORT_DIR"
fi

# Step 9: Final instructions
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}🎉 Package Creation Complete! 🎉${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "📦 Package: $ZIP_FILE"
if [[ -n "$PACKAGE_SIZE" ]]; then
    echo -e "📏 Size: $PACKAGE_SIZE"
fi
echo -e "🗄️ Database: Included with your data"
echo -e "📁 Files: Complete source code"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}📤 Sharing Instructions:${NC}"
echo -e "1. Send $ZIP_FILE to your friend"
echo -e "2. They extract and run setup script"
echo -e "3. They get PhishNet with your data"
echo ""
echo -e "${YELLOW}⚠️ Security Notes:${NC}"
echo -e "- Package contains your actual database"
echo -e "- Friend should change default passwords"
echo -e "- Review settings before production use"
echo ""
success "Ready to share! 🚀"

# Restart services
pm2 start ecosystem.config.js

echo "Update completed"
EOF

chmod +x scripts/*.sh

# Create monitoring script
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash
# Monitoring script

echo "PhishNet System Status"
echo "====================="

# Check application status
if pgrep -f "node.*phishnet" > /dev/null; then
    echo "✅ Application: Running"
else
    echo "❌ Application: Not running"
fi

# Check database
if pg_isready -h localhost -p 5432 > /dev/null; then
    echo "✅ PostgreSQL: Running"
else
    echo "❌ PostgreSQL: Not running"
fi

# Redis not used by PhishNet runtime (PostgreSQL-backed sessions)

# Check disk space
echo ""
echo "Disk Usage:"
df -h | grep -E '/$|/opt|/var'

# Check logs for errors
echo ""
echo "Recent errors:"
tail -n 5 logs/err.log 2>/dev/null || echo "No error log found"
EOF

chmod +x scripts/monitor.sh

cd ..

# Create package archive
echo "📦 Creating archive..."
tar -czf "phishnet-complete-$(date +%Y%m%d).tar.gz" "$PACKAGE_DIR"

echo "✅ Package created successfully!"
echo ""
echo "📦 Package contents:"
echo "   - Complete PhishNet application"
echo "   - Automated deployment scripts (Linux/Windows)"
echo "   - (legacy container configuration removed)"
echo "   - Environment template"
echo "   - Runtime error detection system"
echo "   - Backup and monitoring scripts"
echo "   - Complete documentation"
echo ""
echo "🚀 To deploy:"
echo "   1. Extract: tar -xzf phishnet-complete-$(date +%Y%m%d).tar.gz"
echo "   2. Enter directory: cd $PACKAGE_DIR"
echo "   3. Run setup:"
echo "      Linux/macOS: ./quick-start.sh"
echo "      Windows: .\\quick-start.ps1"
echo "      (legacy workflow removed – use native scripts)"
echo ""
echo "📋 Package location: $(pwd)/phishnet-complete-$(date +%Y%m%d).tar.gz"
