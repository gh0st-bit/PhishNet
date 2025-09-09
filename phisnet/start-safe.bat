@echo off
echo ======================================
echo    PhishNet Windows Quick Start
echo ======================================

echo [INFO] Starting PhishNet with execution policy bypass...
powershell -ExecutionPolicy Bypass -Command "& {.\start.ps1}"

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start PhishNet. Check the error above.
    echo.
    echo [TIP] Troubleshooting tips:
    echo - Make sure you've run deploy.bat or deploy.ps1 first
    echo - Run as Administrator if needed
    echo - Check if port 3000 is available
    echo - Verify PostgreSQL and Redis services are running
) else (
    echo [SUCCESS] PhishNet started successfully!
)

pause
