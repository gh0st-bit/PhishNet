# PhishNet Installation Guide

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Installation](#quick-installation)
3. [Manual Installation](#manual-installation)
4. [Configuration](#configuration)
5. [First Run](#first-run)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Prerequisites

### Required Software

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 14 or higher ([Download](https://www.postgresql.org/download/))
- **Git** (optional but recommended) ([Download](https://git-scm.com/downloads))

### System Requirements

- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+, CentOS 8+)
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Disk Space**: Minimum 500MB free space
- **Network**: Internet connection for initial setup

---

## ⚡ Quick Installation

### Option 1: Automated Installation (Recommended)

#### Linux / macOS:
```bash
# Clone or extract the PhishNet repository
cd PhishNet/phisnet

# Run the automated installer
chmod +x installation/scripts/install.sh
./installation/scripts/install.sh
```

#### Windows:
```powershell
# Open PowerShell as Administrator
cd PhishNet\phisnet

# Run the automated installer
PowerShell -ExecutionPolicy Bypass -File installation\scripts\install-windows.ps1
```

The automated installer will:
- ✅ Check and install missing prerequisites (Windows only)
- ✅ Configure environment variables interactively
- ✅ Create and initialize the database
- ✅ Install Node.js dependencies
- ✅ Build the application
- ✅ Set up required directories
- ✅ (Optional) Create system service for auto-start

---

## 📝 Manual Installation

If you prefer manual installation or the automated script fails:

### Step 1: Install Prerequisites

#### Windows:
```powershell
# Install Chocolatey (package manager)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs-lts -y

# Install PostgreSQL
choco install postgresql15 --params '/Password:postgres' -y

# Install Git (optional)
choco install git -y
```

#### Linux (Ubuntu/Debian):
```bash
# Update package list
sudo apt update

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Git
sudo apt install -y git
```

#### macOS:
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@18

# Install PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# Install Git
brew install git
```

### Step 2: Configure Environment

```bash
# Navigate to project directory
cd PhishNet/phisnet

# Run environment setup script
# Linux/macOS:
bash installation/scripts/setup-env.sh

# Windows:
PowerShell -File installation\scripts\setup-env.ps1
```

Alternatively, copy `.env.example` to `.env` and edit manually:
```bash
cp .env.example .env
# Edit .env with your preferred text editor
nano .env  # or vim, code, notepad, etc.
```

### Step 3: Create Database

#### Linux/macOS:
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE phishnet;

# Create user (optional, if using custom credentials)
CREATE USER phishnet_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE phishnet TO phishnet_user;

# Exit psql
\q
```

#### Windows:
```powershell
# Open psql (it will prompt for password if set during installation)
psql -U postgres

# Create database
CREATE DATABASE phishnet;

# Exit
\q
```

### Step 4: Import Database Schema

```bash
# Linux/macOS:
psql -U postgres -d phishnet -f server/db/schema.sql

# Windows:
psql -U postgres -d phishnet -f server\db\schema.sql
```

### Step 5: Install Dependencies

```bash
npm install
```

### Step 6: Build Application

```bash
npm run build
```

### Step 7: Start PhishNet

#### Development Mode:
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

---

## ⚙️ Configuration

### Environment Variables

Key configuration options in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres@localhost:5432/phishnet` |
| `PORT` | Application port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `SESSION_SECRET` | Secret key for sessions | (auto-generated) |
| `SMTP_HOST` | Email server hostname | - |
| `SMTP_USER` | Email server username | - |
| `SMTP_PASS` | Email server password | - |

### Database Configuration

Edit these variables in `.env` to match your PostgreSQL setup:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phishnet
DB_USER=postgres
DB_PASSWORD=your_password
```

### Email Configuration (Optional)

For sending phishing simulation emails:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=PhishNet <noreply@yourcompany.com>
```

**Note**: For Gmail, you need to generate an [App Password](https://support.google.com/accounts/answer/185833).

---

## 🚀 First Run

### 1. Start the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

### 2. Access the Application

Open your web browser and navigate to:
```
http://localhost:5000
```

### 3. Login with Default Credentials

```
Email:    admin@phishnet.local
Password: admin123
```

**⚠️ IMPORTANT**: Change these credentials immediately after first login!

### 4. Initial Setup

1. **Change Admin Password**
   - Go to Settings → Account Security
   - Update your password

2. **Configure Organization**
   - Go to Organization settings
   - Set your company name and details

3. **Configure SMTP** (for email campaigns)
   - Go to Settings → Email Configuration
   - Enter your SMTP server details
   - Test email sending

4. **Create User Groups**
   - Go to Groups
   - Create departments or teams
   - Add employees to groups

5. **Create First Campaign**
   - Go to Campaigns
   - Click "Create Campaign"
   - Set up your first phishing simulation

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error**: `Port 5000 is already in use`

**Solution**: Change the port in `.env`:
```env
PORT=3000
```

Or find and kill the process using port 5000:
```bash
# Linux/macOS:
lsof -ti:5000 | xargs kill -9

# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

#### 2. Database Connection Failed

**Error**: `Connection refused` or `password authentication failed`

**Solutions**:
- Verify PostgreSQL is running:
  ```bash
  # Linux/macOS:
  sudo systemctl status postgresql
  
  # Windows:
  Get-Service -Name postgresql*
  ```

- Check credentials in `.env` match PostgreSQL user
- Ensure database exists:
  ```bash
  psql -U postgres -l
  ```

#### 3. npm install Fails

**Error**: Various npm errors during installation

**Solutions**:
- Clear npm cache:
  ```bash
  npm cache clean --force
  ```

- Delete `node_modules` and `package-lock.json`:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

- Use specific Node version:
  ```bash
  nvm install 18
  nvm use 18
  npm install
  ```

#### 4. Build Errors

**Error**: TypeScript or Vite build errors

**Solutions**:
- Ensure you're using Node.js 18+:
  ```bash
  node -v
  ```

- Clean build and rebuild:
  ```bash
  rm -rf dist
  npm run build
  ```

#### 5. Schema Import Fails

**Error**: SQL errors during schema import

**Solutions**:
- Drop and recreate database:
  ```bash
  psql -U postgres -c "DROP DATABASE IF EXISTS phishnet;"
  psql -U postgres -c "CREATE DATABASE phishnet;"
  psql -U postgres -d phishnet -f server/db/schema.sql
  ```

- Check schema.sql file exists and is not corrupted

### Getting Help

If you encounter issues not covered here:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review application logs: `logs/phishnet.log`
3. Enable debug mode in `.env`:
   ```env
   DEBUG=true
   SQL_LOGGING=true
   ```

4. Create an issue on GitHub with:
   - Operating system and version
   - Node.js version (`node -v`)
   - PostgreSQL version (`psql --version`)
   - Error message and stack trace
   - Steps to reproduce

---

## 📚 Next Steps

After successful installation:

1. Read the [User Guide](./USER-GUIDE.md)
2. Review [Security Best Practices](./SECURITY.md)
3. Learn about [Campaign Management](./CAMPAIGNS.md)
4. Explore [API Documentation](./API.md)

---

## 🔄 Updating PhishNet

To update to the latest version:

```bash
# Pull latest changes (if using Git)
git pull origin main

# Install new dependencies
npm install

# Run database migrations (if any)
npm run db:migrate

# Rebuild application
npm run build

# Restart application
npm start
```

---

## 🗑️ Uninstallation

To completely remove PhishNet:

```bash
# Stop application if running as service
# Linux/macOS:
sudo systemctl stop phishnet
sudo systemctl disable phishnet
sudo rm /etc/systemd/system/phishnet.service

# Windows:
nssm stop PhishNet
nssm remove PhishNet confirm

# Drop database
psql -U postgres -c "DROP DATABASE IF EXISTS phishnet;"

# Remove application files
cd ..
rm -rf phisnet

# (Optional) Uninstall Node.js and PostgreSQL if no longer needed
```

---

## 📞 Support

- **Documentation**: `installation/docs/`
- **GitHub Issues**: [Report a bug](https://github.com/yourusername/PhishNet/issues)
- **Email**: support@phishnet.local

---

**PhishNet** - Empowering organizations with security awareness training.

© 2025 PhishNet. All rights reserved.
