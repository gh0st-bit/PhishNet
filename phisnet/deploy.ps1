# 🎣 PhishNet Universal Windows Deployment
# Auto-detects environment and installs all dependencies

param(
    [switch]$Production,
    [switch]$SkipDeps,
    [switch]$Help
)

# Colors and formatting functions
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "⚠️ $msg" -ForegroundColor Yellow }
function Write-Info { param($msg) Write-Host "ℹ️ $msg" -ForegroundColor Blue }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }

# Help message
if ($Help) {
    Write-Host "PhishNet Universal Windows Deployment Script"
    Write-Host "Usage: .\deploy.ps1 [-Production] [-SkipDeps] [-Help]"
    Write-Host "  -Production   Deploy for production"
    Write-Host "  -SkipDeps     Skip dependency installation"
    Write-Host "  -Help         Show this help"
    exit 0
}

# Banner
Write-Host ""
Write-Host "======================================" -ForegroundColor Blue
Write-Host "🎣 PhishNet Windows Deployment 🎣" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host "🚀 Auto-installs all dependencies" -ForegroundColor Blue
Write-Host "🔧 Configures services automatically" -ForegroundColor Blue
Write-Host "Environment: native services (PostgreSQL, Node.js)" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

# Verify we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Error "package.json not found. Please run from PhishNet directory."
    exit 1
}

# Set execution policy for smooth deployment
try {
    $executionPolicy = Get-ExecutionPolicy
    if ($executionPolicy -eq "Restricted" -or $executionPolicy -eq "AllSigned") {
        Write-Warning "PowerShell execution policy is $executionPolicy. Setting to Bypass for deployment..."
        Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force -ErrorAction SilentlyContinue
        Write-Success "Execution policy set to Bypass for this session and RemoteSigned for user"
    }
} catch {
    Write-Info "Attempting to bypass execution policy for this session..."
    try {
        Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
        Write-Success "Execution policy bypassed for this deployment"
    } catch {
        Write-Warning "Could not change execution policy. Deployment may still work."
    }
}

# Admin check
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if ($isAdmin) {
    Write-Success "Running with Administrator privileges"
} else {
    Write-Warning "Not running as Administrator. Some features may not work."
    Write-Info "For full functionality, right-click PowerShell and 'Run as Administrator'"
}

# System info
$osInfo = Get-CimInstance Win32_OperatingSystem
$osVersion = "$($osInfo.Caption) $($osInfo.Version)"
Write-Info "📍 Detected: $osVersion"

# Check for Windows version compatibility
$buildNumber = [System.Environment]::OSVersion.Version.Build
if ($buildNumber -lt 10240) {
    Write-Warning "Windows 10/11 recommended for best compatibility"
}

# Package manager detection
function Test-PackageManager {
    $managers = @()
    
    # Check for Chocolatey
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        $managers += "Chocolatey"
    }
    
    # Check for Scoop
    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        $managers += "Scoop"
    }
    
    # Check for winget
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        $managers += "winget"
    }
    
    return $managers
}

$packageManagers = Test-PackageManager
if ($packageManagers.Count -gt 0) {
    Write-Success "Package managers found: $($packageManagers -join ', ')"
} else {
    Write-Warning "No package managers found. Will attempt manual installation."
}

# Install Chocolatey if needed
function Install-Chocolatey {
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Info "Installing Chocolatey package manager..."
        try {
            Set-ExecutionPolicy Bypass -Scope Process -Force
            [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
            Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
            refreshenv
            Write-Success "Chocolatey installed successfully"
            return $true
        } catch {
            Write-Warning "Failed to install Chocolatey: $($_.Exception.Message)"
            return $false
        }
    } else {
        Write-Success "Chocolatey already installed"
        return $true
    }
}

# Check and install Node.js
function Install-NodeJS {
    Write-Info "🟢 Checking Node.js installation..."
    
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            $versionNumber = [version]($nodeVersion -replace 'v', '')
            if ($versionNumber.Major -ge 18) {
                Write-Success "Node.js is installed (version $nodeVersion)"
                return $true
            } else {
                Write-Warning "Node.js version $nodeVersion is too old (need 18+)"
            }
        }
    } catch {
        Write-Warning "Node.js not found or not working"
    }
    
    Write-Info "Installing Node.js..."
    
    # Try different installation methods
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        try {
            choco install nodejs -y
            refreshenv
            Write-Success "Node.js installed via Chocolatey"
            return $true
        } catch {
            Write-Warning "Chocolatey installation failed"
        }
    }
    
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            winget install OpenJS.NodeJS
            Write-Success "Node.js installed via winget"
            return $true
        } catch {
            Write-Warning "winget installation failed"
        }
    }
    
    Write-Error "Failed to install Node.js automatically"
    Write-Info "Please install Node.js manually from: https://nodejs.org/"
    return $false
}

# Check and install Git
function Install-Git {
    Write-Info "📚 Checking Git installation..."
    
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $gitVersion = git --version
        Write-Success "Git is installed ($gitVersion)"
        return $true
    }
    
    Write-Info "Installing Git..."
    
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        try {
            choco install git -y
            refreshenv
            Write-Success "Git installed via Chocolatey"
            return $true
        } catch {
            Write-Warning "Chocolatey installation failed"
        }
    }
    
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            winget install Git.Git
            Write-Success "Git installed via winget"
            return $true
        } catch {
            Write-Warning "winget installation failed"
        }
    }
    
    Write-Warning "Failed to install Git automatically"
    Write-Info "Please install Git manually from: https://git-scm.com/"
    return $false
}

# Check and install PostgreSQL
function Install-PostgreSQL {
    Write-Info "🗄️ Checking PostgreSQL installation..."
    
    # Check if PostgreSQL service exists
    $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if ($pgService) {
        Write-Success "PostgreSQL service found: $($pgService.Name)"
        
        # Try to start the service
        try {
            if ($pgService.Status -ne "Running") {
                Write-Info "Starting PostgreSQL service..."
                Start-Service $pgService.Name -ErrorAction Stop
            }
            Write-Success "PostgreSQL is running"
            return $true
        } catch {
            Write-Warning "PostgreSQL service exists but failed to start: $($_.Exception.Message)"
        }
    }
    
    # Check if psql command is available
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        Write-Success "PostgreSQL client tools found"
        return $true
    }
    
    Write-Info "Installing PostgreSQL..."
    
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        try {
            choco install postgresql -y --params "/Password:postgres"
            refreshenv
            Write-Success "PostgreSQL installed via Chocolatey"
            
            # Start the service
            Start-Sleep 5
            $newPgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
            if ($newPgService) {
                Start-Service $newPgService.Name
                Write-Success "PostgreSQL service started"
            }
            return $true
        } catch {
            Write-Warning "Chocolatey installation failed: $($_.Exception.Message)"
        }
    }
    
    Write-Warning "Failed to install PostgreSQL automatically"
    Write-Info "Please install PostgreSQL manually from: https://www.postgresql.org/download/windows/"
    Write-Info "Or use the installer: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads"
    return $false
}

# Check and install Redis
## Redis removed (no longer required)

# Main dependency installation
function Install-Dependencies {
    if ($SkipDeps) {
        Write-Info "Skipping dependency installation"
        return
    }
    
    Write-Info "📦 Installing dependencies..."
    
    # Install Chocolatey first if we need it and don't have other package managers
    if ($packageManagers.Count -eq 0) {
        Install-Chocolatey | Out-Null
    }
    
    # Install core dependencies
    $success = @()
    $failed = @()
    
    if (Install-NodeJS) { $success += "Node.js" } else { $failed += "Node.js" }
    if (Install-Git) { $success += "Git" } else { $failed += "Git" }
    if (Install-PostgreSQL) { $success += "PostgreSQL" } else { $failed += "PostgreSQL" }
    
    # Summary
    if ($success.Count -gt 0) {
        Write-Success "Successfully installed/verified: $($success -join ', ')"
    }
    if ($failed.Count -gt 0) {
        Write-Warning "Failed to install: $($failed -join ', ')"
        Write-Info "You may need to install these manually"
    }
}

# Database setup function
function Setup-Database {
    Write-Info "🗄️ Setting up PostgreSQL database..."
    
    # Wait for PostgreSQL to be ready
    $retries = 0
    $maxRetries = 30
    while ($retries -lt $maxRetries) {
        try {
            # Try to connect with postgres user (default superuser)
            $env:PGPASSWORD = "postgres"
            $result = psql -U postgres -d postgres -c "SELECT 1;" 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "PostgreSQL connection established"
                break
            }
        } catch {
            # Continue to retry
        }
        
        $retries++
        if ($retries -eq $maxRetries) {
            Write-Warning "Could not connect to PostgreSQL after $maxRetries attempts"
            Write-Info "Please ensure PostgreSQL is running and postgres user password is 'postgres'"
            Write-Info "Or update the database URL in .env file with correct credentials"
            return $false
        }
        
        Write-Info "Waiting for PostgreSQL to be ready... ($retries/$maxRetries)"
        Start-Sleep 2
    }
    
    # Database setup with consistent naming
    try {
        Write-Info "Creating PhishNet database..."
        
        # Drop existing database if it exists
        $env:PGPASSWORD = "postgres"
        psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS phishnet;" 2>$null | Out-Null
        
        # Create database with postgres user ownership
        psql -U postgres -d postgres -c "CREATE DATABASE phishnet;" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database 'phishnet' created successfully"
        } else {
            Write-Warning "Failed to create database, but continuing..."
        }
        
        # Grant privileges
        psql -U postgres -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE phishnet TO postgres;" 2>$null | Out-Null
        
        # Verify database connection
        $testResult = psql -U postgres -d phishnet -c "SELECT 1;" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database connection verified"
            return $true
        } else {
            Write-Warning "Database connection verification failed"
            return $false
        }
    } catch {
        Write-Warning "Database setup encountered issues: $($_.Exception.Message)"
        return $false
    }
}

# Environment setup
function Setup-Environment {
    Write-Info "📝 Setting up environment..."
    
    if (!(Test-Path ".env")) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $envContent = @"
# PhishNet Auto-Generated Environment Configuration
# Generated: $timestamp

# Application Settings
NODE_ENV=development
PORT=3000
APP_NAME=PhishNet
APP_VERSION=1.0.0
APP_URL=http://localhost:3000

# Database Configuration (Auto-configured)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/phishnet
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phishnet
DB_USER=postgres
DB_PASSWORD=postgres

## Redis removed (sessions use PostgreSQL store)

# Security Settings (Change in production!)
SESSION_SECRET=phishnet-dev-secret-$((Get-Date).Ticks)
JWT_SECRET=phishnet-jwt-secret-$((Get-Date).Ticks)
ENCRYPTION_KEY=phishnet-encrypt-$((Get-Date).Ticks.ToString().Substring(0,32))

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
"@
        Set-Content -Path ".env" -Value $envContent -Encoding UTF8
        Write-Success "Environment file created with full configuration"
    } else {
        Write-Success "Environment file already exists"
    }
    
    # Verify .env file
    if (Test-Path ".env") {
        Write-Info "📋 Environment file contents:"
        Get-Content ".env" | ForEach-Object {
            if ($_ -match "(PASSWORD|SECRET|KEY)=") {
                Write-Host ($_ -replace "(PASSWORD|SECRET|KEY)=.*", '$1=***')
            } else {
                Write-Host $_
            }
        }
        Write-Success "Environment verified"
        
        # Create necessary directories
        Write-Info "📁 Creating required directories..."
        $directories = @("logs", "uploads", "temp", "exports", "backups")
        foreach ($dir in $directories) {
            if (!(Test-Path $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
        }
        Write-Success "Required directories created"
        
        return $true
    } else {
        Write-Error "Failed to create .env file"
        return $false
    }
}

# Application setup
function Setup-Application {
    Write-Info "🚀 Setting up PhishNet application..."
    
    # Generate package-lock.json if missing
    if (!(Test-Path "package-lock.json")) {
        Write-Info "Generating package-lock.json for better dependency management..."
        try {
            npm install --package-lock-only 2>$null
            if (Test-Path "package-lock.json") {
                Write-Success "package-lock.json generated"
            }
        } catch {
            Write-Warning "Could not generate package-lock.json - continuing with npm install"
        }
    }
    
    # Install npm dependencies
    Write-Info "Installing npm dependencies..."
    try {
        # Toolchain guard: warn on Node >20 and attempt esbuild alignment if install fails
        $nodeVer = (node --version) 2>$null
        if ($nodeVer -and $nodeVer -match 'v([0-9]+)') { $nMajor=[int]$Matches[1]; if ($nMajor -gt 20) { Write-Warning "Detected Node $nMajor. Recommended Node 20 LTS to avoid potential esbuild binary mismatch." } }

        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Initial npm install failed. Attempting esbuild version alignment and retry..."
            try {
                $pkgJson = Get-Content package.json -Raw | ConvertFrom-Json
                $expectedEsbuild = $pkgJson.devDependencies.esbuild
                if ($expectedEsbuild) {
                    Write-Info "Ensuring esbuild@$expectedEsbuild is installed..."
                    npm install esbuild@$expectedEsbuild --save-dev
                }
            } catch { Write-Warning "Could not parse package.json for esbuild version: $($_.Exception.Message)" }
            npm install
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Success "npm dependencies installed"
        } else {
            Write-Warning "npm install had issues but continuing"
        }
    } catch {
        Write-Warning "npm install failed: $($_.Exception.Message)"
        return $false
    }
    
    # Database schema setup
    Write-Info "🗄️ Setting up database schema..."
    try {
        npm run db:push 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database schema applied"
        } else {
            Write-Warning "Database schema setup had issues, trying manual SQL import..."
            if (Test-Path "migrations\00_phishnet_schema.sql") {
                try {
                    psql -U postgres -d phishnet -f "migrations\00_phishnet_schema.sql" 2>$null
                    Write-Success "Manual schema import completed"
                } catch {
                    Write-Warning "Manual schema import failed"
                }
            }
        }
    } catch {
        Write-Warning "Database schema setup failed"
    }
    
    # Import sample data
    Write-Info "📊 Importing sample data and creating admin user..."
    try {
        npm run import-data 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Sample data imported"
        } else {
            Write-Warning "Sample data import had issues, trying manual SQL import..."
            if (Test-Path "migrations\01_sample_data.sql") {
                try {
                    psql -U postgres -d phishnet -f "migrations\01_sample_data.sql" 2>$null
                    Write-Success "Manual data import completed"
                } catch {
                    Write-Warning "Manual data import failed"
                }
            }
        }
    } catch {
        Write-Warning "Sample data import failed"
    }
    
    # Verify database setup
    Write-Info "🔍 Verifying database setup..."
    try {
        $tables = psql -U postgres -d phishnet -c "\dt" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $tableCount = ($tables | Select-String "public |").Count
            Write-Success "Database verified - $tableCount tables found"
        } else {
            Write-Warning "Database verification failed"
        }
    } catch {
        Write-Warning "Could not verify database setup"
    }
    
    # Production build if requested
    if ($Production) {
        Write-Info "🔨 Building for production..."
        try {
            npm run build
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Production build completed"
            } else {
                Write-Warning "Production build had issues"
            }
        } catch {
            Write-Warning "Production build failed: $($_.Exception.Message)"
        }
    }
    
    return $true
}

# Main execution
Write-Info "🔧 Starting PhishNet deployment..."

# Install dependencies
Install-Dependencies

# Setup database
Setup-Database | Out-Null

# Setup environment
Setup-Environment | Out-Null

# Setup application
Setup-Application | Out-Null

# Final status check
Write-Info "🔍 Final system check..."

$services = @()
$issues = @()

# Check Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    $services += "Node.js ($nodeVersion)"
} else {
    $issues += "Node.js not found"
}

# Check PostgreSQL
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    $services += "PostgreSQL (Running)"
} else {
    $issues += "PostgreSQL not running"
}

# Redis check removed

# Completion message
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "🎉 PhishNet Deployment Complete! 🎉" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host "🌐 URL: http://localhost:3000" -ForegroundColor White
Write-Host "📧 Email: admin@phishnet.local" -ForegroundColor White
Write-Host "🔑 Password: admin123" -ForegroundColor White

if ($services.Count -gt 0) {
    Write-Host ""
    Write-Host "✅ Working Services:" -ForegroundColor Green
    $services | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
}

if ($issues.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️ Issues Found:" -ForegroundColor Yellow
    $issues | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
}

Write-Host ""
Write-Host "🚀 To start PhishNet:" -ForegroundColor Blue
Write-Host "   .\start.ps1              (development mode)" -ForegroundColor White
Write-Host "   .\start.ps1 -Production  (production mode)" -ForegroundColor White

Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Ask to start if not in production mode
if (!$Production) {
    $startChoice = Read-Host "🚀 Start PhishNet development server now? (Y/n)"
    if ($startChoice -ne "n" -and $startChoice -ne "N") {
        Write-Info "Starting PhishNet..."
        $env:NODE_ENV = "development"
        npx tsx server/index.ts
    } else {
        Write-Info "To start later: .\start.ps1"
    }
}

# Create friend deployment package automatically
function Create-FriendPackage {
    Write-Info "📦 Creating friend deployment package..."
    
    # Check if package directory exists from bash script
    $packageDir = Get-ChildItem -Directory "PhishNet-Package-*" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if (!$packageDir) {
        Write-Info "No existing package found. Creating new package..."
        # Create a simple package directory
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $packageDir = New-Item -ItemType Directory -Name "PhishNet-Package-Windows-$timestamp" -Force
        Write-Info "Created package directory: $($packageDir.Name)"
    }
    
    # Essential files for friend deployment
    $essentialFiles = @(
        "deploy.ps1",
        "deploy.bat", 
        "start.ps1",
        "start.bat",
        "test-deployment.ps1",
        "QUICK-FRIEND-SETUP.md",
        "FRIEND-DEPLOYMENT-GUIDE.md", 
        "WINDOWS-SETUP.md",
        "package.json",
        ".env.example"
    )
    
    Write-Info "Adding essential files to package..."
    foreach ($file in $essentialFiles) {
        if (Test-Path $file) {
            Copy-Item $file "$($packageDir.Name)/" -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Added: $file" -ForegroundColor Green
        }
    }
    
    # Copy source directories
    $sourceDirs = @("client", "server", "shared", "migrations", "docs")
    foreach ($dir in $sourceDirs) {
        if (Test-Path $dir) {
            Copy-Item $dir "$($packageDir.Name)/" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Added directory: $dir" -ForegroundColor Green
        }
    }
    
    # Copy configuration files
    $configFiles = @("tsconfig.json", "tailwind.config.ts", "vite.config.ts", "drizzle.config.ts", "components.json")
    foreach ($file in $configFiles) {
        if (Test-Path $file) {
            Copy-Item $file "$($packageDir.Name)/" -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Added config: $file" -ForegroundColor Green
        }
    }
    
    # Create package README
    $packageReadme = @"
# 🎣 PhishNet Windows Deployment Package

## 🚀 Super Quick Setup for Windows

### Step 1: Extract Package
Extract this package to: ``C:\PhishNet\``

### Step 2: Run PowerShell as Administrator
- Press ``Windows + X``
- Select "Terminal (Admin)" or "PowerShell (Admin)"

### Step 3: Deploy PhishNet
``````powershell
cd C:\PhishNet\phishnet
.\deploy.ps1
``````

### Step 4: Start PhishNet
``````powershell
.\start.ps1
``````

### Step 5: Access PhishNet
- **URL**: http://localhost:3000
- **Email**: admin@phishnet.local
- **Password**: admin123

## 🔧 Alternative Methods

### Option 1: Batch Files (No PowerShell needed)
``````cmd
deploy.bat
start.bat
``````

### Option 2: (second method reserved)
Container deployment deprecated. Use native scripts only.

## 🛠️ What Gets Installed
- Node.js 18+
- PostgreSQL database
- Redis cache
- Git version control

## ⚠️ Troubleshooting

### PowerShell Execution Policy Error
``````powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
``````

### Port 3000 Already in Use
``````powershell
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
``````

### Need Administrator Rights
Right-click PowerShell → "Run as Administrator"

## 📞 Need Help?
- Check ``WINDOWS-SETUP.md`` for detailed Windows guide
- Check ``QUICK-FRIEND-SETUP.md`` for quick reference
- Run ``.\test-deployment.ps1`` to verify everything works

## ✅ Success Indicators
1. No error messages during deployment
2. Can access http://localhost:3000
3. Can login with admin credentials
4. PhishNet dashboard loads properly

**🎯 Ready to use! This package contains everything needed for PhishNet deployment.**
"@
    
    Set-Content -Path "$($packageDir.Name)/README.md" -Value $packageReadme -Encoding UTF8
    Write-Host "  ✓ Added: README.md" -ForegroundColor Green
    
    # Try to create ZIP
    $zipPath = "$($packageDir.Name).zip"
    try {
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Compress-Archive -Path "$($packageDir.Name)/*" -DestinationPath $zipPath -CompressionLevel Optimal
        $zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
        
        Write-Host ""
        Write-Host "======================================" -ForegroundColor Green
        Write-Host "🎉 Friend Package Created Successfully!" -ForegroundColor Green
        Write-Host "======================================" -ForegroundColor Green
        Write-Host "📦 Package: $zipPath" -ForegroundColor White
        Write-Host "📏 Size: $zipSize MB" -ForegroundColor White
        Write-Host ""
        Write-Host "📤 To share with friends:" -ForegroundColor Blue
        Write-Host "   1. Send them the ZIP file: $zipPath" -ForegroundColor White
        Write-Host "   2. Tell them to extract to C:\PhishNet\" -ForegroundColor White
        Write-Host "   3. Run PowerShell as Admin: .\deploy.ps1" -ForegroundColor White
        Write-Host "======================================" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Warning "Could not create ZIP automatically. Package folder ready: $($packageDir.Name)"
        Write-Info "You can manually zip the folder to share with friends"
    }
    
    return $true
}

# Always create friend package after successful deployment
Write-Host ""
Write-Info "🎁 Creating shareable package for friends..."
Create-FriendPackage | Out-Null
