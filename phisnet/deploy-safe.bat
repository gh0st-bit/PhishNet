@echo off
echo ======================================
echo    PhishNet Windows Quick Setup
echo ======================================
echo [INFO] Detected: Windows %OS%

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Running with Administrator privileges
) else (
    echo [WARNING] Not running as Administrator. Some features may not work.
    echo [TIP] For full functionality, right-click and "Run as Administrator"
)

echo [INFO] PowerShell found, launching deployment script...
echo.
echo [INFO] Setting PowerShell execution policy for smooth deployment...
echo [INFO] This ensures the PowerShell scripts can run properly...

REM Use ExecutionPolicy Bypass to ensure the script can run regardless of system policy
powershell -ExecutionPolicy Bypass -Command "& {.\deploy.ps1}"

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Deployment failed. Check the output above for errors.
    echo.
    echo [TIP] Troubleshooting tips:
    echo - Ensure you have internet connection
    echo - Run as Administrator
    echo - Check if PostgreSQL service is running
    echo - Verify Node.js is installed
    echo - Try running: powershell -ExecutionPolicy Bypass -File deploy.ps1
) else (
    echo [SUCCESS] Deployment completed!
    echo [INFO] You can now start PhishNet with: .\start.ps1
)

pause
