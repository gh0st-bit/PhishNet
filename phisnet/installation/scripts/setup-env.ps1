# =========================================
# PhishNet Environment Configuration Script (Windows)
# =========================================

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   PhishNet Environment Setup           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if .env already exists
if (Test-Path .env) {
    Write-Host "⚠️  Warning: .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit 0
    }
}

Write-Host "🔐 Let's configure your PhishNet environment..." -ForegroundColor Blue
Write-Host ""

# =========================================
# Database Configuration
# =========================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Database Configuration" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$dbHost = Read-Host "PostgreSQL Host [localhost]"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "PostgreSQL Port [5432]"
if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }

$dbName = Read-Host "Database Name [phishnet]"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "phishnet" }

$dbUser = Read-Host "PostgreSQL Username [postgres]"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }

$dbPassSecure = Read-Host "PostgreSQL Password" -AsSecureString
$dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassSecure))

# =========================================
# Server Configuration
# =========================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Server Configuration" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$port = Read-Host "Server Port [5000]"
if ([string]::IsNullOrWhiteSpace($port)) { $port = "5000" }

$nodeEnv = Read-Host "Environment (development/production) [development]"
if ([string]::IsNullOrWhiteSpace($nodeEnv)) { $nodeEnv = "development" }

# Generate secure session secret
Write-Host "⚙️  Generating secure session secret..." -ForegroundColor Yellow
$sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "✓ Session secret generated" -ForegroundColor Green

# =========================================
# Email Configuration (Optional)
# =========================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Email Configuration (Optional)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📧 Configure SMTP for sending phishing simulation emails" -ForegroundColor Yellow
Write-Host "   Press Enter to skip if not needed now" -ForegroundColor Yellow
Write-Host ""

$smtpHost = Read-Host "SMTP Host (e.g., smtp.gmail.com)"
if (-not [string]::IsNullOrWhiteSpace($smtpHost)) {
    $smtpPort = Read-Host "SMTP Port [587]"
    if ([string]::IsNullOrWhiteSpace($smtpPort)) { $smtpPort = "587" }
    
    $smtpUser = Read-Host "SMTP Username"
    $smtpPassSecure = Read-Host "SMTP Password" -AsSecureString
    $smtpPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($smtpPassSecure))
    
    $smtpFrom = Read-Host "From Email Address [noreply@phishnet.local]"
    if ([string]::IsNullOrWhiteSpace($smtpFrom)) { $smtpFrom = "noreply@phishnet.local" }
} else {
    $smtpPort = "587"
    $smtpUser = ""
    $smtpPass = ""
    $smtpFrom = "noreply@phishnet.local"
}

# =========================================
# API Keys (Optional)
# =========================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  API Keys (Optional)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔑 These enhance PhishNet's features but are optional" -ForegroundColor Yellow
Write-Host ""

$otxApiKey = Read-Host "AlienVault OTX API Key (threat intelligence)"
$geminiApiKey = Read-Host "Google Gemini API Key (AI features)"

# =========================================
# Write .env file
# =========================================
Write-Host ""
Write-Host "📝 Writing configuration to .env..." -ForegroundColor Yellow

$envContent = @"
# =========================================
# PhishNet Environment Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# =========================================

# =========================================
# Database Configuration
# =========================================
DATABASE_URL=postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}

DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}

# =========================================
# Server Configuration
# =========================================
PORT=${port}
NODE_ENV=${nodeEnv}

# =========================================
# Session Configuration
# =========================================
SESSION_SECRET=${sessionSecret}
SESSION_MAX_AGE=1800000

# =========================================
# Email Configuration
# =========================================
SMTP_HOST=${smtpHost}
SMTP_PORT=${smtpPort}
SMTP_SECURE=false
SMTP_USER=${smtpUser}
SMTP_PASS=${smtpPass}
SMTP_FROM=${smtpFrom}

# =========================================
# Threat Intelligence API Keys
# =========================================
OTX_API_KEY=${otxApiKey}

# =========================================
# AI/ML Configuration
# =========================================
GEMINI_API_KEY=${geminiApiKey}

# =========================================
# Application URLs
# =========================================
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:${port}

# =========================================
# File Upload Configuration
# =========================================
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# =========================================
# Security Settings
# =========================================
CORS_ORIGIN=http://localhost:5173,http://localhost:${port}
ALLOW_REGISTRATION=true

# =========================================
# Logging Configuration
# =========================================
LOG_LEVEL=info
LOG_FILE=./logs/phishnet.log
DEBUG=false
SQL_LOGGING=false
"@

$envContent | Out-File -FilePath .env -Encoding utf8 -NoNewline

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     Configuration Complete! ✓          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📄 Configuration saved to: .env" -ForegroundColor Cyan
Write-Host "⚠️  Keep this file secure and never commit it to git!" -ForegroundColor Yellow
Write-Host ""
