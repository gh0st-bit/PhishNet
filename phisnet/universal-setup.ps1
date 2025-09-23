# PhishNet Universal Setup Script for Windows
# Handles both deployment and startup with automatic execution policy handling

[CmdletBinding()]
param (
    [Parameter()]
    [switch]$Deploy,
    
    [Parameter()]
    [switch]$Start,
    
    [Parameter()]
    [switch]$All,
    
    [Parameter()]
    [switch]$Production,
    
    [Parameter()]
    [switch]$Help
)

# Script banner
function Show-Banner {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Blue
    Write-Host "🎣 PhishNet Universal Windows Setup 🎣" -ForegroundColor Blue
    Write-Host "=====================================" -ForegroundColor Blue
    Write-Host "Intelligent deployment and startup system" -ForegroundColor Blue
    Write-Host "=====================================" -ForegroundColor Blue
    Write-Host ""
}

# Help information
function Show-Help {
    Write-Host "PhishNet Universal Setup PowerShell Script" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Cyan
    Write-Host "This script handles both deployment and startup with automatic execution policy handling."
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\universal-setup.ps1 [options]"
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Deploy       Deploy PhishNet (default if no options specified)"
    Write-Host "  -Start        Start PhishNet"
    Write-Host "  -All          Deploy and then start PhishNet"
    Write-Host "  -Production   Use production mode"
    Write-Host "  -Help         Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\universal-setup.ps1                     # Deploy in development mode"
    Write-Host "  .\universal-setup.ps1 -Start             # Start in development mode"
    Write-Host "  .\universal-setup.ps1 -All -Production   # Deploy and start in production mode"
    Write-Host ""
}

# Check and fix execution policy
function Ensure-ExecutionPolicy {
    $currentPolicy = Get-ExecutionPolicy
    Write-Host "Current PowerShell execution policy: $currentPolicy" -ForegroundColor Blue
    
    if ($currentPolicy -eq "Restricted" -or $currentPolicy -eq "AllSigned") {
        Write-Host "Attempting to set execution policy to Bypass for this session..." -ForegroundColor Yellow
        try {
            Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
            Write-Host "Successfully set execution policy to Bypass for this session" -ForegroundColor Green
        } catch {
            Write-Host "Warning: Could not change execution policy. Some features might not work." -ForegroundColor Yellow
            Write-Host "You may need to run PowerShell as Administrator to change policy." -ForegroundColor Yellow
        }
    }
}

# Run deployment
function Run-Deployment {
    Write-Host "Running PhishNet deployment..." -ForegroundColor Blue
    
    $deployArgs = @()
    if ($Production) {
        Write-Host "Mode: Production" -ForegroundColor Blue
        $deployArgs += "-Production"
    } else {
        Write-Host "Mode: Development" -ForegroundColor Blue
    }
    
    try {
        # Attempt to run deployment
        & ".\deploy.ps1" @deployArgs
        
        if ($LASTEXITCODE -ne 0) {
            throw "Deployment script returned error code: $LASTEXITCODE"
        }
        
        Write-Host "Deployment completed successfully!" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
        
        # Try to use fixed script if it exists
        if (Test-Path ".\deploy.ps1.fixed") {
            Write-Host "Found fixed deployment script, trying to use it instead..." -ForegroundColor Yellow
            try {
                Copy-Item -Path ".\deploy.ps1.fixed" -Destination ".\deploy.ps1" -Force
                & ".\deploy.ps1" @deployArgs
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Deployment with fixed script completed successfully!" -ForegroundColor Green
                    return $true
                } else {
                    throw "Fixed deployment script returned error code: $LASTEXITCODE"
                }
            } catch {
                Write-Host "All deployment attempts failed: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "Please check:" -ForegroundColor Yellow
                Write-Host " - Internet connection" -ForegroundColor Yellow
                Write-Host " - Administrator privileges" -ForegroundColor Yellow
                Write-Host " - PostgreSQL service status" -ForegroundColor Yellow
                Write-Host " - Node.js installation" -ForegroundColor Yellow
                Write-Host "See POWERSHELL-EXECUTION-FIX.md for more troubleshooting steps." -ForegroundColor Yellow
                return $false
            }
        } else {
            Write-Host "No fixed deployment script found. Deployment failed." -ForegroundColor Red
            return $false
        }
    }
}

# Run application
function Run-Application {
    Write-Host "Starting PhishNet application..." -ForegroundColor Blue
    
    $startArgs = @()
    if ($Production) {
        Write-Host "Mode: Production" -ForegroundColor Blue
        $startArgs += "-Production"
    } else {
        Write-Host "Mode: Development" -ForegroundColor Blue
    }
    
    try {
        # Start the application
        & ".\start.ps1" @startArgs
        
        if ($LASTEXITCODE -ne 0) {
            throw "Start script returned error code: $LASTEXITCODE"
        }
        
        return $true
    } catch {
        Write-Host "Failed to start PhishNet: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Possible issues:" -ForegroundColor Yellow
        Write-Host " - Missing dependencies" -ForegroundColor Yellow
        Write-Host " - Database connection problems" -ForegroundColor Yellow
        Write-Host " - Port 3000 already in use" -ForegroundColor Yellow
        Write-Host "" -ForegroundColor Yellow
        Write-Host "For port conflicts, run:" -ForegroundColor Yellow
        Write-Host "  netstat -ano | findstr :3000" -ForegroundColor Gray
        Write-Host "  taskkill /PID <PID> /F" -ForegroundColor Gray
        return $false
    }
}

# Main execution
Show-Banner

# Show help if requested
if ($Help) {
    Show-Help
    exit 0
}

# Ensure execution policy is set correctly
Ensure-ExecutionPolicy

# Determine what to do based on parameters
$deploymentSuccess = $true

# Default to Deploy if no action specified
if (!$Deploy -and !$Start -and !$All) {
    $Deploy = $true
}

if ($Deploy -or $All) {
    $deploymentSuccess = Run-Deployment
    
    # Exit if deployment failed and we're not trying to do both
    if (!$deploymentSuccess -and !$All) {
        exit 1
    }
}

if (($Start -or $All) -and $deploymentSuccess) {
    $startSuccess = Run-Application
    
    if (!$startSuccess) {
        exit 1
    }
}

exit 0
