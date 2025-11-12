# ===============================================
# PhishNet Docker Setup Script (Windows)
# Version: 1.0
# Created: July 25, 2025
# Description: Complete Docker deployment setup for PhishNet on Windows
# ===============================================

# Enable strict error handling
$ErrorActionPreference = "Stop"

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Purple = "Magenta"
    Cyan = "Cyan"
}

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ProjectName = "phishnet"
$DockerComposeFile = Join-Path $ProjectRoot "docker-compose.yml"

# Function to print colored output
function Write-Header {
    param($Message)
    Write-Host ""
    Write-Host "================================" -ForegroundColor $Colors.Purple
    Write-Host $Message -ForegroundColor $Colors.Purple
    Write-Host "================================" -ForegroundColor $Colors.Purple
    Write-Host ""
}

function Write-Status {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param($Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param($Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error-Custom {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Red
}

# Function to check if command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to check Docker installation
function Test-Docker {
    Write-Status "Checking Docker installation..."
    
    if (-not (Test-Command "docker")) {
        Write-Error-Custom "Docker is not installed. Please install Docker Desktop first."
        Write-Host "Visit: https://docs.docker.com/desktop/windows/"
        exit 1
    }
    
    # Check if Docker daemon is running
    try {
        docker info | Out-Null
    }
    catch {
        Write-Error-Custom "Docker daemon is not running. Please start Docker Desktop first."
        exit 1
    }
    
    # Check Docker Compose
    $composeAvailable = $false
    try {
        docker-compose --version | Out-Null
        $composeAvailable = $true
        $composeCommand = "docker-compose"
    }
    catch {
        try {
            docker compose version | Out-Null
            $composeAvailable = $true
            $composeCommand = "docker compose"
        }
        catch {
            Write-Error-Custom "Docker Compose is not available."
            exit 1
        }
    }
    
    if (-not $composeAvailable) {
        Write-Error-Custom "Docker Compose is not installed or available."
        exit 1
    }
    
    Write-Success "Docker is installed and running"
    Write-Status "Docker version: $(docker --version)"
    
    if ($composeCommand -eq "docker-compose") {
        Write-Status "Docker Compose version: $(docker-compose --version)"
    }
    else {
        Write-Status "Docker Compose plugin: $(docker compose version)"
    }
    
    return $composeCommand
}

# Function to create environment file
function New-EnvironmentFile {
    Write-Status "Creating environment configuration..."
    
    $envFile = Join-Path $ProjectRoot ".env"
    $envTemplate = Join-Path $ProjectRoot ".env.docker"
    
    if (Test-Path $envFile) {
        Write-Warning "Environment file already exists."
        $response = Read-Host "Do you want to overwrite it? (y/N)"
        if ($response -notmatch "^[Yy]$") {
            Write-Status "Using existing environment file"
            return
        }
    }
    
    if (-not (Test-Path $envTemplate)) {
        Write-Error-Custom "Environment template not found at .env.docker"
        exit 1
    }
    
    # Copy template
    Copy-Item $envTemplate $envFile
    Write-Success "Environment file created from template"
    
    # Generate random secrets
    Write-Status "Generating secure secrets..."
    
    $sessionSecret = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()))
    $dbPassword = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString())).Substring(0, 16)
    $redisPassword = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString())).Substring(0, 16)
    
    # Update environment file
    $content = Get-Content $envFile -Raw
    $content = $content -replace "your-very-long-random-session-secret-change-this-in-production-2025", $sessionSecret
    $content = $content -replace "phishnet_secure_password_2025", $dbPassword
    $content = $content -replace "phishnet_redis_password_2025", $redisPassword
    
    Set-Content $envFile $content -NoNewline
    
    Write-Success "Secure secrets generated and configured"
}

# Function to build Docker images
function Build-Images {
    param($ComposeCommand)
    
    Write-Status "Building Docker images..."
    
    Push-Location $ProjectRoot
    try {
        if ($ComposeCommand -eq "docker-compose") {
            & docker-compose build --no-cache
        }
        else {
            & docker compose build --no-cache
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed"
        }
    }
    finally {
        Pop-Location
    }
    
    Write-Success "Docker images built successfully"
}

# Function to start services
function Start-Services {
    param($ComposeCommand)
    
    Write-Status "Starting PhishNet services..."
    
    Push-Location $ProjectRoot
    try {
        if ($ComposeCommand -eq "docker-compose") {
            & docker-compose up -d
        }
        else {
            & docker compose up -d
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to start services"
        }
    }
    finally {
        Pop-Location
    }
    
    Write-Success "Services started successfully"
}

# Function to check service health
function Test-Services {
    param($ComposeCommand)
    
    Write-Status "Checking service health..."
    
    $maxAttempts = 30
    $attempt = 1
    
    Write-Status "Waiting for services to be healthy..."
    
    while ($attempt -le $maxAttempts) {
        try {
            Push-Location $ProjectRoot
            
            if ($ComposeCommand -eq "docker-compose") {
                $services = & docker-compose ps --format json | ConvertFrom-Json
            }
            else {
                $services = & docker compose ps --format json | ConvertFrom-Json
            }
            
            $healthyServices = 0
            $totalServices = 0
            
            foreach ($service in $services) {
                $totalServices++
                if ($service.Health -eq "healthy" -or $service.State -eq "running") {
                    $healthyServices++
                }
            }
            
            if ($healthyServices -eq $totalServices -and $totalServices -gt 0) {
                Write-Success "All services are healthy!"
                return
            }
            
            Write-Status "Attempt $attempt/$maxAttempts`: $healthyServices/$totalServices services healthy, waiting 10 seconds..."
            Start-Sleep 10
            $attempt++
        }
        catch {
            Write-Status "Attempt $attempt/$maxAttempts`: Checking health, waiting 10 seconds..."
            Start-Sleep 10
            $attempt++
        }
        finally {
            Pop-Location
        }
    }
    
    Write-Warning "Some services may not be fully healthy yet. Check logs if needed."
}

# Function to show service status
function Show-Status {
    param($ComposeCommand)
    
    Write-Header "Service Status"
    
    Push-Location $ProjectRoot
    try {
        if ($ComposeCommand -eq "docker-compose") {
            & docker-compose ps
        }
        else {
            & docker compose ps
        }
    }
    finally {
        Pop-Location
    }
}

# Function to show access information
function Show-AccessInfo {
    Write-Header "Access Information"
    
    Write-Host "PhishNet Application:" -ForegroundColor $Colors.Cyan
    Write-Host "  • URL: http://localhost"
    Write-Host "  • Admin Panel: http://localhost/admin"
    Write-Host ""
    
    Write-Host "Database Access:" -ForegroundColor $Colors.Cyan
    Write-Host "  • Host: localhost"
    Write-Host "  • Port: 5432"
    Write-Host "  • Database: phishnet"
    Write-Host "  • Username: phishnet_user"
    Write-Host "  • Password: (check .env file)"
    Write-Host ""
    
    Write-Host "Redis Access:" -ForegroundColor $Colors.Cyan
    Write-Host "  • Host: localhost"
    Write-Host "  • Port: 6379"
    Write-Host "  • Password: (check .env file)"
    Write-Host ""
    
    Write-Host "Default Admin Account:" -ForegroundColor $Colors.Cyan
    Write-Host "  • Email: admin@phishnet.local"
    Write-Host "  • Password: admin123"
    Write-Host "  • Organization: PhishNet Admin"
    Write-Host ""
    
    Write-Host "Note: Please change the default admin password after first login!" -ForegroundColor $Colors.Yellow
}

# Function to show useful commands
function Show-Commands {
    param($ComposeCommand)
    
    Write-Header "Useful Commands"
    
    Write-Host "Start services:" -ForegroundColor $Colors.Cyan
    Write-Host "  $ComposeCommand up -d"
    Write-Host ""
    
    Write-Host "Stop services:" -ForegroundColor $Colors.Cyan
    Write-Host "  $ComposeCommand down"
    Write-Host ""
    
    Write-Host "View logs:" -ForegroundColor $Colors.Cyan
    Write-Host "  $ComposeCommand logs -f [service-name]"
    Write-Host ""
    
    Write-Host "Restart services:" -ForegroundColor $Colors.Cyan
    Write-Host "  $ComposeCommand restart"
    Write-Host ""
    
    Write-Host "Update application:" -ForegroundColor $Colors.Cyan
    Write-Host "  $ComposeCommand pull && $ComposeCommand up -d"
}

# Function to cleanup on failure
function Invoke-Cleanup {
    param($ComposeCommand)
    
    Write-Error-Custom "Setup failed. Cleaning up..."
    
    try {
        Push-Location $ProjectRoot
        
        if ($ComposeCommand -eq "docker-compose") {
            & docker-compose down --volumes 2>$null
        }
        else {
            & docker compose down --volumes 2>$null
        }
    }
    catch {
        # Ignore cleanup errors
    }
    finally {
        Pop-Location
    }
}

# Main setup function
function Invoke-Main {
    Write-Header "PhishNet Docker Setup"
    
    Write-Host "This script will set up PhishNet using Docker containers." -ForegroundColor $Colors.Cyan
    Write-Host "The following services will be deployed:" -ForegroundColor $Colors.Cyan
    Write-Host "  • PostgreSQL Database"
    Write-Host "  • Redis Cache"
    Write-Host "  • PhishNet Application"
    Write-Host "  • Nginx Reverse Proxy"
    Write-Host ""
    
    # Check if we're in the right directory
    if (-not (Test-Path $DockerComposeFile)) {
        Write-Error-Custom "docker-compose.yml not found in $ProjectRoot"
        Write-Error-Custom "Please run this script from the PhishNet project directory"
        exit 1
    }
    
    try {
        # Check Docker installation
        $composeCommand = Test-Docker
        
        # Create environment file
        New-EnvironmentFile
        
        # Build and start services
        Write-Header "Building and Starting Services"
        
        Build-Images $composeCommand
        Start-Services $composeCommand
        Test-Services $composeCommand
        
        # Show status and access information
        Show-Status $composeCommand
        Show-AccessInfo
        Show-Commands $composeCommand
        
        Write-Header "Setup Complete!"
        Write-Success "PhishNet has been successfully deployed with Docker!"
        Write-Status "You can now access the application at http://localhost"
    }
    catch {
        Invoke-Cleanup $composeCommand
        Write-Error-Custom "Setup failed: $($_.Exception.Message)"
        exit 1
    }
}

# Run main function
Invoke-Main
