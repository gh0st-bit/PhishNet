# PowerShell Execution Policy Troubleshooting

This guide will help you solve common PowerShell execution policy issues when deploying PhishNet on Windows.

## Quick Solutions

### Option 1: Use the Universal Setup Script (Recommended)
We've created an all-in-one script that handles everything automatically:

```
universal-setup.bat        # For Command Prompt users
.\universal-setup.ps1      # For PowerShell users
```

This script can:
- Deploy and start PhishNet in one command
- Automatically bypass execution policies
- Handle both development and production modes
- Recover from common errors
- Use fixed scripts when needed

**Options:**
```
universal-setup.bat --help       # Show all options
universal-setup.bat --all        # Deploy and start in one go
universal-setup.bat --production # Use production mode
```

### Option 2: Use the safe batch files
We've included special batch files that automatically bypass execution policies:

```
deploy-safe.bat   # Install everything
start-safe.bat    # Start PhishNet
```

### Option 3: Run a bypass command directly
Open PowerShell as Administrator and run:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
```

This temporarily allows script execution in the current PowerShell session.

### Option 4: Change execution policy for your user account
For a more permanent solution (only if you regularly run scripts):

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

This allows locally created scripts to run without signing.

## Common Errors and Solutions

### Error: "File cannot be loaded because running scripts is disabled"

This happens because of Windows security settings that prevent script execution.

**Solution:**
```powershell
# Method 1: Bypass for current session only
Set-ExecutionPolicy Bypass -Scope Process -Force

# Method 2: Allow local scripts for your user
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# Method 3: Run script directly with bypass
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

### Error: "Unexpected token" or syntax errors in deploy.ps1

If you see syntax errors like "Unexpected token" in the deploy.ps1 file:

**Solution:**
1. Use the fixed script included in this package
2. Run: `Copy-Item -Path deploy.ps1.fixed -Destination deploy.ps1 -Force`
3. Then run the deployment again

### Error: Cannot start services or install dependencies

These usually require administrator privileges:

**Solution:**
1. Right-click on PowerShell
2. Select "Run as administrator"
3. Navigate to the PhishNet directory
4. Run: `.\deploy-safe.bat` or use the bypass command

## Permanent Fix (Advanced Users)

If you're comfortable with PowerShell and want to permanently allow script execution:

```powershell
# As Administrator, allow signed scripts
Set-ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
```

⚠️ Warning: This changes security settings for all users on your machine. Only do this if you understand the security implications.

## Checking Current Policy

To see your current execution policy:

```powershell
Get-ExecutionPolicy -List
```

## Need Help?

If you continue to have issues, please:
1. Run the deployment with detailed logging: `.\deploy-safe.bat > deployment-log.txt 2>&1`
2. Share the log with our support team
3. Try the manual setup steps in README.md
