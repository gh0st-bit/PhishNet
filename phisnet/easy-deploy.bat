@echo off
echo ======================================
echo    PhishNet Windows Easy Setup
echo ======================================
echo [INFO] Setting up execution policy and running deployment...

powershell -ExecutionPolicy Bypass -Command "& {Write-Host 'Running deploy.ps1 with execution policy bypass...' -ForegroundColor Green; ./deploy.ps1.fixed}"

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Deployment encountered an issue. See output above.
    echo.
    echo [TIP] Try running as Administrator if you haven't already.
    echo       Right-click on PowerShell and select "Run as Administrator"
    pause
    exit /b 1
)

echo [SUCCESS] Deployment completed successfully!
echo.
echo To start PhishNet: .\start.ps1 or .\start.bat
pause
