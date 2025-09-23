@echo off
setlocal enabledelayedexpansion

echo ======================================
echo    PhishNet Universal Windows Setup
echo ======================================
echo [INFO] Intelligent deployment system

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Running with Administrator privileges
    set "IS_ADMIN=true"
) else (
    echo [WARNING] Not running as Administrator. Some features may not work.
    echo [TIP] For full functionality, right-click and "Run as Administrator"
    set "IS_ADMIN=false"
)

REM Parse command line arguments
set "DEPLOY_MODE=dev"
set "ACTION=deploy"

:parse_args
if "%~1"=="" goto end_parse_args
if /i "%~1"=="--production" set "DEPLOY_MODE=production"
if /i "%~1"=="-p" set "DEPLOY_MODE=production"
if /i "%~1"=="--start" set "ACTION=start"
if /i "%~1"=="-s" set "ACTION=start"
if /i "%~1"=="--deploy" set "ACTION=deploy"
if /i "%~1"=="-d" set "ACTION=deploy"
if /i "%~1"=="--all" set "ACTION=all"
if /i "%~1"=="-a" set "ACTION=all"
if /i "%~1"=="--help" (
    call :show_help
    exit /b 0
)
if /i "%~1"=="-h" (
    call :show_help
    exit /b 0
)
shift
goto parse_args
:end_parse_args

REM Check if PowerShell is available
where powershell >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] PowerShell is required but not found.
    echo Please install Windows PowerShell or PowerShell Core.
    exit /b 1
)

REM Check PowerShell execution policy
for /f "tokens=*" %%a in ('powershell -Command "Get-ExecutionPolicy"') do set "POLICY=%%a"
echo [INFO] Current PowerShell execution policy: !POLICY!

if "!ACTION!"=="deploy" (
    call :run_deployment
) else if "!ACTION!"=="start" (
    call :run_start
) else if "!ACTION!"=="all" (
    call :run_deployment
    if !errorlevel! equ 0 (
        echo.
        echo [INFO] Deployment successful, starting PhishNet...
        echo.
        call :run_start
    )
)

exit /b %errorlevel%

:run_deployment
echo.
echo [INFO] Running PhishNet deployment...
echo [INFO] Mode: !DEPLOY_MODE!
echo [INFO] Using execution policy bypass for reliable operation...

REM Attempt to run deployment with execution policy bypass
powershell -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference = 'Stop'; try { if ('!DEPLOY_MODE!' -eq 'production') { ./deploy.ps1 -Production } else { ./deploy.ps1 } } catch { Write-Host \"[ERROR] $_\" -ForegroundColor Red; exit 1 } }"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deployment failed.
    echo.
    echo [INFO] Attempting alternate deployment method...
    
    REM Try to copy fixed script if it exists
    if exist deploy.ps1.fixed (
        echo [INFO] Found fixed deployment script, using it instead...
        powershell -Command "Copy-Item -Path deploy.ps1.fixed -Destination deploy.ps1 -Force"
        
        REM Try again with fixed script
        powershell -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference = 'Stop'; try { if ('!DEPLOY_MODE!' -eq 'production') { ./deploy.ps1 -Production } else { ./deploy.ps1 } } catch { Write-Host \"[ERROR] $_\" -ForegroundColor Red; exit 1 } }"
    )
    
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] All deployment attempts failed. Please check:
        echo  - Internet connection
        echo  - Administrator rights
        echo  - PostgreSQL service status
        echo  - Node.js installation
        echo.
        echo See POWERSHELL-EXECUTION-FIX.md for more troubleshooting steps.
        pause
        exit /b 1
    )
)

echo.
echo [SUCCESS] Deployment completed successfully!
echo.
exit /b 0

:run_start
echo.
echo [INFO] Starting PhishNet application...
echo [INFO] Mode: !DEPLOY_MODE!
echo [INFO] Using execution policy bypass for reliable operation...

REM Start with execution policy bypass
if "!DEPLOY_MODE!"=="production" (
    powershell -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference = 'Stop'; try { ./start.ps1 -Production } catch { Write-Host \"[ERROR] $_\" -ForegroundColor Red; exit 1 } }"
) else (
    powershell -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference = 'Stop'; try { ./start.ps1 } catch { Write-Host \"[ERROR] $_\" -ForegroundColor Red; exit 1 } }"
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start PhishNet. Possible issues:
    echo  - Missing dependencies
    echo  - Database connection problems
    echo  - Port 3000 already in use
    echo.
    echo For port conflicts, run:
    echo   netstat -ano ^| findstr :3000
    echo   taskkill /PID [PID] /F
    echo.
    pause
    exit /b 1
)

exit /b 0

:show_help
echo.
echo PhishNet Universal Windows Setup
echo --------------------------------
echo This script handles both deployment and startup with automatic execution policy bypass.
echo.
echo Usage:
echo   universal-setup.bat [options]
echo.
echo Options:
echo   --deploy, -d       Deploy PhishNet (default)
echo   --start, -s        Start PhishNet
echo   --all, -a          Deploy and then start PhishNet
echo   --production, -p   Use production mode
echo   --help, -h         Show this help message
echo.
echo Examples:
echo   universal-setup.bat                   Deploy in development mode
echo   universal-setup.bat --start           Start in development mode
echo   universal-setup.bat --all --production   Deploy and start in production mode
echo.
exit /b 0
