# 🪟 PhishNet Windows Deployment Guide

## Quick Start Options

### Option 1: PowerShell (Recommended)
```powershell
# Run as Administrator for best results
.\deploy.ps1
.\start.ps1
```

### Option 2: Batch Files
```cmd
deploy.bat
start.bat
```

<!-- (Container option removed – Windows now uses native services only) -->

## System Requirements

- **Windows 10/11** (Windows 7/8 may work with limitations)
- **PowerShell 5.1+** (built into Windows 10/11)
- **Internet connection** for downloading dependencies

## What Gets Installed

The deployment script will automatically install:

1. **Node.js 18+** - JavaScript runtime
2. **PostgreSQL** - Database server
3. **Git** - Version control
4. (Legacy containerization option removed)

## Installation Methods

The script tries multiple installation methods:

1. **Chocolatey** - Windows package manager (installed automatically)
2. **winget** - Windows Package Manager (if available)
3. **Manual fallback** - Instructions for manual installation

## Troubleshooting

### PowerShell Execution Policy
If you get execution policy errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Administrator Privileges
For full functionality, run PowerShell as Administrator:
1. Right-click PowerShell
2. Select "Run as Administrator"
3. Navigate to PhishNet directory
4. Run `.\deploy.ps1`

### Service Issues

**PostgreSQL not starting:**
```powershell
# Check service status
Get-Service postgresql*

# Start manually
Start-Service postgresql-x64-XX  # Replace XX with version
```

<!-- Redis guidance removed: not required -->

### Common Issues

1. **"Cannot find psql"**: PostgreSQL not in PATH
   - Restart PowerShell/Command Prompt
   - Or add manually: `C:\Program Files\PostgreSQL\XX\bin`

2. **"npm not found"**: Node.js not in PATH
   - Restart PowerShell/Command Prompt
   - Or reinstall Node.js

3. **Port 3000 already in use**:
   ```cmd
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

## Manual Installation

If automatic installation fails:

### Node.js
Download from: https://nodejs.org/
- Choose LTS version
- Include npm and Add to PATH options

### PostgreSQL
Download from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
- Set password to: `postgres`
- Remember port: `5432`

<!-- Redis section removed: not required -->

### Git
Download from: https://git-scm.com/download/win

## Environment Configuration

The `.env` file is created automatically with these defaults:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/phishnet
PORT=3000
NODE_ENV=development
SESSION_SECRET=dev-secret-key-change-in-production
APP_URL=http://localhost:3000
```

## Starting PhishNet

### Development Mode
```powershell
.\start.ps1
# or
start.bat
```

### Production Mode
```powershell
.\start.ps1 -Production
```

<!-- deprecated mode note removed -->

## Accessing PhishNet

Once started, open your browser to:
- **URL**: http://localhost:3000
- **Email**: admin@phishnet.local
- **Password**: admin123

## Windows-Specific Features

- **Service Management**: Automatically starts/stops PostgreSQL service
- **Package Manager**: Uses Chocolatey for easy dependency management
- (legacy integration removed)
- **Path Management**: Automatically adds tools to system PATH
- **Execution Policy**: Handles PowerShell security settings

## Performance Tips

1. **Exclude from Antivirus**: Add PhishNet folder to antivirus exclusions
2. **Windows Defender**: May flag as false positive, add to exclusions
3. **Firewall**: Allow Node.js through Windows Firewall if prompted
4. **WSL**: Consider using WSL2 for better Linux compatibility

## Support

For Windows-specific issues:
1. Check Event Viewer for service errors
2. Verify Windows version compatibility
3. Ensure all prerequisites are installed
4. Run deployment with Administrator privileges
