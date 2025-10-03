# PhishNet Setup Verification Script for Windows PowerShell
# Verifies that all components are properly installed and configured

Write-Host "PhishNet Setup Verification" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Color functions
function Write-Success { param($msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Warning { param($msg) Write-Host "[WARNING] $msg" -ForegroundColor Yellow }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Blue }

# Track overall status
$script:Errors = 0
$script:Warnings = 0

function Add-Error { $script:Errors++ }
function Add-Warning { $script:Warnings++ }

# Check Node.js
Write-Info "Checking Node.js installation..."
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Success "Node.js installed: $nodeVersion"
        $versionNumber = [version]($nodeVersion -replace 'v')
        if ($versionNumber.Major -lt 18) {
            Write-Warning "Node.js version is below recommended v18+"
            Add-Warning
        }
    } else {
        Write-Error "Node.js not found"
        Add-Error
    }
} catch {
    Write-Error "Node.js not found"
    Add-Error
}

# Check npm
Write-Info "Checking npm installation..."
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Success "npm installed: $npmVersion"
    } else {
        Write-Error "npm not found"
        Add-Error
    }
} catch {
    Write-Error "npm not found"
    Add-Error
}

# Check PostgreSQL
Write-Info "Checking PostgreSQL installation..."
try {
    $psqlVersion = psql --version 2>$null | Select-Object -First 1
    if ($psqlVersion) {
        Write-Success "PostgreSQL installed: $psqlVersion"
        
        # Check if PostgreSQL service is running
        try {
            $testConn = psql -U postgres -d postgres -c "SELECT 1;" 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "PostgreSQL service is running"
                
                # Check if phishnet database exists
                $dbExists = psql -U postgres -d postgres -c "\l" 2>$null | Select-String "phishnet"
                if ($dbExists) {
                    Write-Success "PhishNet database exists"
                    
                    # Check table count
                    $tables = psql -U postgres -d phishnet -c "\dt" 2>$null | Select-String "public |"
                    $tableCount = ($tables | Measure-Object).Count
                    if ($tableCount -gt 0) {
                        Write-Success "Database has $tableCount tables"
                    } else {
                        Write-Warning "Database appears to be empty"
                        Add-Warning
                    }
                } else {
                    Write-Error "PhishNet database not found"
                    Add-Error
                }
            } else {
                Write-Error "PostgreSQL service not running or not accessible"
                Add-Error
            }
        } catch {
            Write-Error "Cannot connect to PostgreSQL"
            Add-Error
        }
    } else {
        Write-Error "PostgreSQL not found"
        Add-Error
    }
} catch {
    Write-Error "PostgreSQL not found"
    Add-Error
}

# Skip Redis checks (not required)
Write-Info "Skipping Redis verification (no longer required)"

# Check Git
Write-Info "Checking Git installation..."
try {
    $gitVersion = git --version 2>$null
    if ($gitVersion) {
        Write-Success "Git installed: $gitVersion"
    } else {
        Write-Warning "Git not found (needed for updates)"
        Add-Warning
    }
} catch {
    Write-Warning "Git not found (needed for updates)"
    Add-Warning
}

# (legacy container verification removed)

# Check project files
Write-Info "Checking PhishNet project files..."
if (Test-Path "package.json") {
    Write-Success "package.json found"
} else {
    Write-Error "package.json not found - are you in the PhishNet directory?"
    Add-Error
}

if (Test-Path ".env") {
    Write-Success ".env file found"
    
    # Check key environment variables
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "DATABASE_URL=") {
        Write-Success "Database URL configured"
    } else {
        Write-Error "DATABASE_URL not found in .env"
        Add-Error
    }
    
    if ($envContent -match "PORT=(\d+)") {
        $port = $matches[1]
        Write-Success "Port configured: $port"
    } else {
        Write-Warning "PORT not configured"
        Add-Warning
    }
} else {
    Write-Error ".env file not found"
    Add-Error
}

# Check node_modules
if (Test-Path "node_modules") {
    Write-Success "Node modules installed"
} else {
    Write-Warning "Node modules not found - run 'npm install'"
    Add-Warning
}

# Check required directories
$requiredDirs = @("logs", "uploads", "temp", "exports", "backups")
foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Success "Directory $dir exists"
    } else {
        Write-Warning "Directory $dir missing (will be created automatically)"
        Add-Warning
    }
}

# Check migrations
if (Test-Path "migrations") {
    Write-Success "Migrations directory found"
    
    if (Test-Path "migrations\00_phishnet_schema.sql") {
        Write-Success "Database schema file found"
    } else {
        Write-Error "Database schema file missing"
        Add-Error
    }
    
    if (Test-Path "migrations\01_sample_data.sql") {
        Write-Success "Sample data file found"
    } else {
        Write-Warning "Sample data file missing"
        Add-Warning
    }
} else {
    Write-Error "Migrations directory not found"
    Add-Error
}

# Test database connection
Write-Info "Testing database connection..."
if (Test-Path ".env") {
    try {
        npm run db:push >$null 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database connection successful"
        } else {
            Write-Error "Database connection failed"
            Add-Error
        }
    } catch {
        Write-Error "Database connection test failed"
        Add-Error
    }
}

# Final summary
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "[SUMMARY] Verification Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

if ($script:Errors -eq 0 -and $script:Warnings -eq 0) {
    Write-Success "All checks passed! PhishNet is ready to use."
    Write-Host ""
    Write-Info "Start PhishNet with: .\start.ps1"
    Write-Info "Access at: http://localhost:3000"
    Write-Info "Login: admin@phishnet.local / admin123"
} elseif ($script:Errors -eq 0) {
    Write-Warning "$($script:Warnings) warning(s) found - PhishNet should work but may have issues"
    Write-Host ""
    Write-Info "Start PhishNet with: .\start.ps1"
    Write-Info "Access at: http://localhost:3000"
    Write-Info "Login: admin@phishnet.local / admin123"
} else {
    Write-Error "$($script:Errors) error(s) and $($script:Warnings) warning(s) found"
    Write-Host ""
    Write-Error "Please fix the errors before starting PhishNet"
    Write-Host ""
    Write-Info "Run '.\deploy.ps1' to fix most issues automatically"
}

Write-Host ""
exit $script:Errors
