# =========================================
# PhishNet Complete Installation Script for Windows
# With Automated Software Installation
# =========================================

#Requires -RunAsAdministrator

# Set execution policy
Set-ExecutionPolicy Bypass -Scope Process -Force

# Colors
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }
function Write-Warning { param($msg) Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Write-Info { param($msg) Write-Host "→ $msg" -ForegroundColor Cyan }
function Write-Header { param($msg) Write-Host "`n$msg" -ForegroundColor Cyan -BackgroundColor Black }

# Clear screen
Clear-Host

# Banner
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "║       ██████╗ ██╗  ██╗██╗███████╗██╗  ██╗          ║" -ForegroundColor Magenta
Write-Host "║       ██╔══██╗██║  ██║██║██╔════╝██║  ██║          ║" -ForegroundColor Magenta
Write-Host "║       ██████╔╝███████║██║███████╗███████║          ║" -ForegroundColor Magenta
Write-Host "║       ██╔═══╝ ██╔══██║██║╚════██║██╔══██║          ║" -ForegroundColor Magenta
Write-Host "║       ██║     ██║  ██║██║███████║██║  ██║          ║" -ForegroundColor Magenta
Write-Host "║       ╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝          ║" -ForegroundColor Magenta
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "║          Automated Installation Script                ║" -ForegroundColor Green
Write-Host "║            v1.0.0 - Windows Edition                   ║" -ForegroundColor Yellow
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will install and configure PhishNet" -ForegroundColor Blue
Write-Host "Including automatic installation of missing prerequisites" -ForegroundColor Blue
Write-Host ""
$continue = Read-Host "Press Enter to continue or Ctrl+C to cancel"

# =========================================
# Step 0: Install Chocolatey (if needed)
# =========================================
Write-Header "━━━ Step 0/9: Package Manager Setup ━━━"

if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Warning "Chocolatey not found. Installing..."
    
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    
    try {
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Chocolatey installed successfully"
    } catch {
        Write-Error "Failed to install Chocolatey"
        Write-Warning "Please install manually from: https://chocolatey.org/install"
        exit 1
    }
} else {
    Write-Success "Chocolatey already installed"
}

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Step 1: Check and Install Prerequisites
# =========================================
Write-Header "━━━ Step 1/9: Checking System Requirements ━━━"

Write-Info "Detected OS: Windows $(([System.Environment]::OSVersion.Version).Major)"
Write-Host ""

# Check/Install Node.js
Write-Info "Checking Node.js..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warning "Node.js not found. Installing Node.js 20 LTS..."
    
    try {
        choco install nodejs-lts -y --force
        
        # Refresh environment
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Node.js installed successfully"
    } catch {
        Write-Error "Failed to install Node.js automatically"
        Write-Warning "Please install manually from: https://nodejs.org/"
        exit 1
    }
} else {
    $nodeVersion = (node -v).Substring(1).Split('.')[0]
    if ([int]$nodeVersion -lt 18) {
        Write-Warning "Node.js version $nodeVersion is too old. Upgrading to LTS..."
        choco upgrade nodejs-lts -y
    } else {
        Write-Success "Node.js $(node -v) installed"
    }
}

# Check/Install npm
Write-Info "Checking npm..."
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm not found (should come with Node.js)"
    exit 1
}
Write-Success "npm $(npm -v) installed"

# Check/Install PostgreSQL
Write-Info "Checking PostgreSQL..."
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Warning "PostgreSQL not found. Installing PostgreSQL 15..."
    
    try {
        choco install postgresql15 --params '/Password:postgres' -y --force
        
        # Refresh environment
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Wait for PostgreSQL service to start
        Write-Info "Waiting for PostgreSQL service to start..."
        Start-Sleep -Seconds 10
        
        # Start PostgreSQL service
        $pgService = Get-Service -Name postgresql* -ErrorAction SilentlyContinue
        if ($pgService) {
            if ($pgService.Status -ne 'Running') {
                Start-Service $pgService.Name
                Start-Sleep -Seconds 5
            }
            Write-Success "PostgreSQL installed and service started"
        }
    } catch {
        Write-Error "Failed to install PostgreSQL automatically"
        Write-Warning "Please install manually from: https://www.postgresql.org/download/windows/"
        Write-Warning "Then re-run this script"
        exit 1
    }
} else {
    Write-Success "PostgreSQL installed"
}

# Check/Install Git (optional but recommended)
Write-Info "Checking Git..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warning "Git not found. Installing Git..."
    
    try {
        choco install git -y --force
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Success "Git installed successfully"
    } catch {
        Write-Warning "Git installation failed (optional)"
    }
} else {
    Write-Success "Git $(git --version) installed"
}

Write-Host ""
Write-Success "All prerequisites met!"
Write-Host ""
Start-Sleep -Seconds 2

# =========================================
# Step 2: Environment Configuration
# =========================================
Write-Header "━━━ Step 2/9: Environment Configuration ━━━"

if (-not (Test-Path .env)) {
    Write-Info "Creating environment configuration..."
    & "$PSScriptRoot\setup-env.ps1"
} else {
    Write-Success "Environment configuration already exists"
}

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Step 3: Database Setup
# =========================================
Write-Header "━━━ Step 3/9: Database Setup ━━━"

Write-Info "Checking database configuration..."

# Load .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Variable -Name $name -Value $value -Scope Script
    }
}

# Set PostgreSQL environment variables
$env:PGPASSWORD = $DB_PASSWORD

# Check if database exists
Write-Info "Checking if database exists..."
$dbExists = & psql -U $DB_USER -h $DB_HOST -lqt 2>$null | Select-String -Pattern "\s$DB_NAME\s"

if ($dbExists) {
    Write-Warning "Database '$DB_NAME' already exists"
    $recreate = Read-Host "Drop and recreate? This will DELETE ALL DATA! (y/N)"
    if ($recreate -eq "y" -or $recreate -eq "Y") {
        Write-Info "Dropping existing database..."
        & psql -U $DB_USER -h $DB_HOST -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>$null
        & psql -U $DB_USER -h $DB_HOST -c "CREATE DATABASE $DB_NAME;"
        Write-Success "Database recreated"
    } else {
        Write-Warning "Using existing database"
    }
} else {
    Write-Info "Creating database '$DB_NAME'..."
    & psql -U $DB_USER -h $DB_HOST -c "CREATE DATABASE $DB_NAME;" 2>$null
    Write-Success "Database created"
}

# Import schema
if (Test-Path "server\db\schema.sql") {
    Write-Info "Importing database schema..."
    & psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f "server\db\schema.sql" 2>$null
    Write-Success "Schema imported"
} else {
    Write-Warning "No schema.sql found, skipping schema import"
}

# Clear password
Remove-Item Env:\PGPASSWORD

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Step 4: Install Dependencies
# =========================================
Write-Header "━━━ Step 4/9: Installing Dependencies ━━━"

Write-Info "Installing Node.js packages (this may take a few minutes)..."
npm install --silent
Write-Success "Dependencies installed"

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Step 5: Database Seeding (Optional)
# =========================================
Write-Header "━━━ Step 5/9: Database Seeding (Optional) ━━━"

if (Test-Path "server\db\seed.sql") {
    $seed = Read-Host "Import sample data for testing? (Y/n)"
    if ($seed -ne "n" -and $seed -ne "N") {
        Write-Info "Importing sample data..."
        $env:PGPASSWORD = $DB_PASSWORD
        & psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f "server\db\seed.sql" 2>$null
        Remove-Item Env:\PGPASSWORD
        Write-Success "Sample data imported"
    } else {
        Write-Warning "Skipped sample data import"
    }
} else {
    Write-Warning "No seed.sql found, skipping"
}

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Step 6: Build Application
# =========================================
Write-Header "━━━ Step 6/9: Building Application ━━━"

Write-Info "Building client and server..."
npm run build
Write-Success "Application built successfully"

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Step 7: Create Required Directories
# =========================================
Write-Header "━━━ Step 7/9: Creating Required Directories ━━━"

$directories = @("uploads", "logs", "temp", "backups")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
Write-Success "Directories created"

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Step 8: Windows Service Setup (Optional)
# =========================================
Write-Header "━━━ Step 8/9: Windows Service Setup (Optional) ━━━"

$createService = Read-Host "Create Windows Service for auto-start? (Y/n)"
if ($createService -ne "n" -and $createService -ne "N") {
    Write-Info "Checking NSSM (Non-Sucking Service Manager)..."
    
    if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
        Write-Info "Installing NSSM..."
        choco install nssm -y
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    
    $serviceName = "PhishNet"
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    
    if ($existingService) {
        Write-Warning "Service already exists. Removing old service..."
        nssm stop $serviceName
        nssm remove $serviceName confirm
    }
    
    Write-Info "Creating Windows Service..."
    $nodePath = (Get-Command node).Source
    $appPath = Join-Path $PSScriptRoot "..\..\dist\index.js"
    
    nssm install $serviceName $nodePath $appPath
    nssm set $serviceName AppDirectory (Get-Location).Path
    nssm set $serviceName AppEnvironmentExtra NODE_ENV=production
    nssm set $serviceName DisplayName "PhishNet Security Platform"
    nssm set $serviceName Description "PhishNet Phishing Awareness and Training Platform"
    nssm set $serviceName Start SERVICE_AUTO_START
    
    Write-Success "Service created: $serviceName"
    Write-Info "To start: nssm start $serviceName"
    Write-Info "To stop:  nssm stop $serviceName"
}

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Step 9: Firewall Rules (Optional)
# =========================================
Write-Header "━━━ Step 9/9: Firewall Configuration (Optional) ━━━"

$configureFirewall = Read-Host "Add Windows Firewall rules? (Y/n)"
if ($configureFirewall -ne "n" -and $configureFirewall -ne "N") {
    Write-Info "Configuring Windows Firewall..."
    
    # Remove existing rules
    Remove-NetFirewallRule -DisplayName "PhishNet HTTP" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "PhishNet PostgreSQL" -ErrorAction SilentlyContinue
    
    # Add new rules
    New-NetFirewallRule -DisplayName "PhishNet HTTP" -Direction Inbound -Protocol TCP -LocalPort $PORT -Action Allow | Out-Null
    New-NetFirewallRule -DisplayName "PhishNet PostgreSQL" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow | Out-Null
    
    Write-Success "Firewall rules configured"
}

Write-Host ""
Start-Sleep -Seconds 1

# =========================================
# Installation Complete
# =========================================
Clear-Host
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                       ║" -ForegroundColor Green
Write-Host "║          ✓ Installation Complete! ✓                  ║" -ForegroundColor Green
Write-Host "║                                                       ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Installation Summary:" -ForegroundColor Cyan
Write-Host "   ✓ Prerequisites installed" -ForegroundColor Green
Write-Host "   ✓ Environment configured" -ForegroundColor Green
Write-Host "   ✓ Database created and initialized" -ForegroundColor Green
Write-Host "   ✓ Dependencies installed" -ForegroundColor Green
Write-Host "   ✓ Application built" -ForegroundColor Green
Write-Host "   ✓ Directories created" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "🚀 Quick Start:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Development Mode:" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor Green
Write-Host ""
Write-Host "  Production Mode:" -ForegroundColor White
Write-Host "  npm start" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "🌐 Access:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Application: http://localhost:$PORT" -ForegroundColor Cyan
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "🔐 Default Credentials:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Email:    admin@phishnet.local" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "  ⚠️  Change these credentials immediately after first login!" -ForegroundColor Red
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Installation Guide: installation\docs\INSTALLATION.md" -ForegroundColor White
Write-Host "  User Manual:        installation\docs\USER-GUIDE.md" -ForegroundColor White
Write-Host "  Troubleshooting:    installation\docs\TROUBLESHOOTING.md" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "⚠️  Important Notes:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "  • Keep your .env file secure" -ForegroundColor White
Write-Host "  • Never commit .env to version control" -ForegroundColor White
Write-Host "  • Configure SMTP settings for email features" -ForegroundColor White
Write-Host "  • Review security settings before production use" -ForegroundColor White
Write-Host "  • Enable HTTPS in production environments" -ForegroundColor White
Write-Host ""
Write-Host "Thank you for using PhishNet!" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
