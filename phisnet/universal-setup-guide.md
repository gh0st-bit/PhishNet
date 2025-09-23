# PhishNet Universal Setup Guide

This document explains how to use the universal setup scripts for easy deployment and startup of PhishNet on Windows systems.

## 🌟 Universal Setup Scripts

We've created an intelligent setup system that combines deployment and startup in a single interface, while automatically handling common issues like PowerShell execution policies.

### Available Scripts

| Script | For | Description |
|--------|-----|-------------|
| `universal-setup.bat` | Command Prompt | Batch file version for CMD users |
| `universal-setup.ps1` | PowerShell | PowerShell version with same functionality |

Both scripts provide identical functionality and can be used interchangeably based on your preference.

## 🚀 Quick Start

### From Command Prompt:

```cmd
universal-setup.bat --all
```

### From PowerShell:

```powershell
.\universal-setup.ps1 -All
```

This will deploy PhishNet and start it immediately after successful deployment.

## 🎮 Command Options

Both scripts accept the same command-line options:

| Option | Batch Version | PowerShell Version | Description |
|--------|---------------|-------------------|-------------|
| Deploy | `--deploy` or `-d` | `-Deploy` | Deploy PhishNet (default) |
| Start | `--start` or `-s` | `-Start` | Start PhishNet |
| All | `--all` or `-a` | `-All` | Deploy and then start PhishNet |
| Production | `--production` or `-p` | `-Production` | Use production mode |
| Help | `--help` or `-h` | `-Help` | Show help message |

## 📋 Examples

### Deploy in Development Mode (Default)

```cmd
universal-setup.bat
```
or
```powershell
.\universal-setup.ps1
```

### Start the Application After Deployment

```cmd
universal-setup.bat --all
```
or
```powershell
.\universal-setup.ps1 -All
```

### Deploy in Production Mode

```cmd
universal-setup.bat --production
```
or
```powershell
.\universal-setup.ps1 -Production
```

### Start the Application in Production Mode

```cmd
universal-setup.bat --start --production
```
or
```powershell
.\universal-setup.ps1 -Start -Production
```

## 🔧 How It Works

The universal setup scripts provide several advanced features:

1. **Automatic Execution Policy Handling**
   - Bypasses PowerShell execution policy restrictions
   - No need to run manual bypass commands

2. **Intelligent Error Recovery**
   - If deployment fails, tries alternative methods
   - Uses fixed scripts when available
   - Provides useful error messages and troubleshooting tips

3. **Unified Interface**
   - Single command for both deployment and startup
   - Works from both Command Prompt and PowerShell
   - Consistent parameter handling

4. **Production Support**
   - Easily switch between development and production modes
   - Same interface for both environments

5. **Administrator Detection**
   - Detects if running with Administrator privileges
   - Warns if Administrator rights might be needed

## 🛠️ Troubleshooting

If you encounter issues with the universal setup:

1. **Run as Administrator**
   - Right-click Command Prompt or PowerShell
   - Select "Run as Administrator"

2. **Check Dependencies**
   - Ensure Node.js is installed
   - Verify PostgreSQL and Redis services are running

3. **Port Conflicts**
   - If port 3000 is already in use:
     ```cmd
     netstat -ano | findstr :3000
     taskkill /PID <PID> /F
     ```

4. **Database Issues**
   - Ensure PostgreSQL service is running
   - Check if database exists: `psql -U postgres -c "\l"`

5. **View Detailed Logs**
   - For detailed output, redirect to a log file:
     ```cmd
     universal-setup.bat --all > setup-log.txt 2>&1
     ```

## 📝 Additional Notes

- The scripts are designed to work on all modern Windows versions (Windows 10/11)
- Administrator privileges are recommended but not always required
- The scripts are completely safe and make no permanent system changes
- They automatically adapt to your environment and available tools

For more detailed troubleshooting, see `POWERSHELL-EXECUTION-FIX.md`.
