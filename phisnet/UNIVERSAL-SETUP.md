# 🌐 PhishNet Universal Setup Guide

PhishNet includes **adaptive setup scripts** that automatically detect your environment and install dependencies accordingly.

## 🚀 Quick Start

### Linux/macOS
```bash
cd phisnet
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Windows
```powershell
cd phisnet
.\scripts\setup.ps1
```

## 🎯 Supported Environments

### Linux Distributions
- **🐉 Kali Linux** - Full support with automatic collation fixes
- **🐧 Ubuntu/Debian** - APT package management
- **🎩 CentOS/RHEL/Rocky/AlmaLinux** - DNF/YUM package management
- **🎁 Fedora** - DNF package management  
- **⚡ Arch/Manjaro** - Pacman package management

### Windows
- **🪟 Windows 10/11** - Automatic package manager detection:
  - Chocolatey (recommended)
  - Winget (built-in)
  - Scoop (lightweight)
  - Manual installation guidance

### macOS
- **🍎 macOS** - Homebrew package management

## ⚙️ Automatic Environment Detection

The setup scripts detect:
- Operating system and distribution
- Available package managers
- Existing software installations
- PostgreSQL versions and configurations
- Service management systems

## ✅ What the Scripts Do

### 1. Environment Detection
- Identifies your OS and distribution
- Locates package managers
- Detects existing installations

### 2. Dependency Installation
- Node.js 18+
- PostgreSQL 15+
- (Redis removed)
- Git
- Build tools

### 3. Service Management
- Starts and enables PostgreSQL
- (Redis removed)
- Configures auto-start

### 4. Database Setup
- Creates database and user
- Applies schema migrations
- Imports sample data
- Configures authentication

### 5. Application Setup
- Installs dependencies
- Builds the application
- Creates environment files
- Generates startup scripts

## 🎨 Environment-Specific Features

### Kali Linux
- Automatic collation version fixes
- Template database conflict resolution
- Authentication configuration
- Service startup optimization

### Windows
- Package manager detection and installation
- Service configuration for different PostgreSQL versions
- Automatic path detection
- Chocolatey auto-installation option

### macOS
- Homebrew integration
- Service management via brew services
- Path detection for Intel/Apple Silicon

## 🔍 Troubleshooting

### PostgreSQL Issues

#### Check Service Status
```bash
# Linux/macOS
sudo systemctl status postgresql

# Windows
Get-Service postgresql*
```

#### Manual Service Start
```bash
# Linux/macOS
sudo systemctl start postgresql

# Windows
Start-Service postgresql-x64-15
```

#### Reset Database
```bash
# Linux/macOS
./reset-db.sh

# Windows
.\reset-db.bat
```

### Permission Issues
- **Linux**: Ensure sudo privileges
- **Windows**: Run PowerShell as Administrator for database setup
- **macOS**: Verify Homebrew permissions

### Package Manager Issues

#### Install Chocolatey (Windows)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

#### Install Homebrew (macOS)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## �️ Manual Dependency Installation

If automatic installation fails, install manually:

### Node.js
- Download from: https://nodejs.org
- Required version: 18+

### PostgreSQL
- Download from: https://www.postgresql.org/download/
- Required version: 15+
- **Important**: Set password to `kali` during installation

### Git
- Download from: https://git-scm.com

<!-- Redis not used by runtime; no installation needed -->

## 🔄 Recovery Steps

### Complete Reset
```bash
# Stop service
sudo systemctl stop postgresql

# Remove existing database
sudo -u postgres dropdb phishnet 2>/dev/null || true
sudo -u postgres dropuser phishnet_user 2>/dev/null || true

# Run setup again
./scripts/setup.sh
```

### Kali Linux Specific Recovery
```bash
# Fix collation warnings
sudo -u postgres psql -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;"
sudo -u postgres psql -c "ALTER DATABASE postgres REFRESH COLLATION VERSION;"

# Reset authentication
sudo sed -i 's/local.*all.*all.*peer/local   all             all                                     md5/' /etc/postgresql/*/main/pg_hba.conf
sudo systemctl restart postgresql
```

### Windows Specific Recovery
```powershell
# Reset PostgreSQL service
Stop-Service postgresql*
Start-Service postgresql*

# Check service status
Get-Service postgresql*
```

## 📊 Verification

After setup completion, verify:

```bash
# Check services
sudo systemctl status postgresql

# Test database connection
export PGPASSWORD="kali"
psql -h localhost -U phishnet_user -d phishnet -c "SELECT COUNT(*) FROM organizations;"
unset PGPASSWORD

# Check application
npm run dev
```

## 🆘 Getting Help

If issues persist:

1. **Check logs**:
   ```bash
   # PostgreSQL logs
   sudo tail -f /var/log/postgresql/postgresql-*-main.log
   
   # Application logs
   npm run dev
   ```

2. **Verify system requirements**:
   - 4GB+ RAM
   - 2GB+ free disk space
   - Internet connection for package installation

3. (Container alternative deprecated — use the native scripts.)

4. **Manual setup**: Follow [INSTALLATION.md](INSTALLATION.md) for step-by-step instructions

## 🎯 Next Steps

After successful setup:

1. **Configure SMTP** in `.env` file
2. **Start development server**: `./start-dev.sh` or `start-dev.bat`
3. **Open browser**: http://localhost:5173
4. **Login with admin credentials**:
   - admin@democorp.com / password123
   - admin@riphah.edu.pk / password123
   - admin@healthsolutions.com / password123

The adaptive setup scripts handle most common scenarios automatically across different environments. For specific issues, refer to the troubleshooting sections above.

```bash
# Check PostgreSQL service
sudo systemctl status postgresql

# Test database connection
PGPASSWORD='kali' psql -h localhost -U phishnet_user -d phishnet

# Check if tables exist
PGPASSWORD='kali' psql -h localhost -U phishnet_user -d phishnet -c "\dt"
```

## 🆘 Still Having Issues?

### Check PostgreSQL Logs
```bash
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Common Solutions

#### Port 5432 Already in Use
```bash
sudo lsof -i :5432
sudo kill -9 <PID>
sudo systemctl restart postgresql
```

#### Permission Denied
```bash
sudo chown -R postgres:postgres /var/lib/postgresql/
sudo systemctl restart postgresql
```

#### Service Won't Start
```bash
sudo systemctl stop postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

## ✅ Success Indicators

You'll know it's working when:
- ✅ PostgreSQL service is active
- ✅ Database connection succeeds
- ✅ No collation warnings
- ✅ Tables are created in phishnet database
- ✅ Application starts without database errors

## 📞 Need Help?

If you're still having issues:
1. Run the fix script with verbose output
2. Check the error messages carefully
3. Ensure you're in the correct directory (`PhishNet/phisnet`)
4. Verify PostgreSQL is installed: `psql --version`

The fix script is designed specifically for Kali Linux PostgreSQL issues and should resolve most common problems automatically.
