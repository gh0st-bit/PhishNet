# PhishNet Quick Start Guide

Get PhishNet running in under 5 minutes! ⚡

## Prerequisites Check

Before starting, you need:

| Software | Minimum Version | Check Command |
|----------|----------------|---------------|
| **Node.js** | 18.x or later | `node --version` |
| **PostgreSQL** | 13.x or later | `psql --version` |
| **Git** | Any recent | `git --version` |

**Don't have these?** No problem!
- **Windows**: Our installer will auto-install them! Just skip to [Windows Quick Install](#windows-quick-install).
- **Linux/macOS**: Install prerequisites first (see below).

### Install Prerequisites (Linux/macOS Only)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib git
```

**macOS (with Homebrew):**
```bash
brew install node postgresql git
brew services start postgresql
```

**Fedora/RHEL:**
```bash
sudo dnf install nodejs postgresql-server git
sudo postgresql-setup --initdb
sudo systemctl start postgresql
```

## Windows Quick Install

**Total Time: ~5-10 minutes** (including software downloads)

### Step 1: Open PowerShell as Administrator

1. Press `Win + X`
2. Select "Windows PowerShell (Admin)" or "Terminal (Admin)"

### Step 2: Navigate to Project

```powershell
cd "c:\Users\27668\OneDrive - Riphah International University\Documents\CYB-8-1 Final Year 1\PhishNet\phisnet"
```

### Step 3: Run Installer

```powershell
PowerShell -ExecutionPolicy Bypass -File installation\scripts\install-windows.ps1
```

### Step 4: Follow Prompts

The script will:
1. ✅ Check for Node.js (install if missing)
2. ✅ Check for PostgreSQL (install if missing)
3. ✅ Check for Git (install if missing)
4. ✅ Ask for database password
5. ✅ Ask for email settings (optional)
6. ✅ Install everything automatically

### Step 5: Start PhishNet

```powershell
npm run dev
```

Open your browser: **http://localhost:5000**

**Done! 🎉**

---

## Linux/macOS Quick Install

**Total Time: ~3-5 minutes** (prerequisites must be installed first)

### Step 1: Navigate to Project

```bash
cd ~/path/to/phisnet
```

### Step 2: Make Script Executable

```bash
chmod +x installation/scripts/install.sh
```

### Step 3: Run Installer

```bash
./installation/scripts/install.sh
```

### Step 4: Follow Prompts

Answer questions about:
- Database configuration
- Server port
- Email settings (optional)
- API keys (optional)

### Step 5: Start PhishNet

```bash
npm run dev
```

Open your browser: **http://localhost:5000**

**Done! 🎉**

---

## First Time Login

After installation, log in with default credentials:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@phishnet.local | admin123 |
| **User** | user@phishnet.local | user123 |

⚠️ **Important:** Change these passwords immediately after first login!

### Change Default Passwords

1. Log in as admin
2. Go to **Settings** → **Users**
3. Click on each user
4. Update password
5. Save changes

---

## Quick Feature Tour

### 1. Dashboard

View campaign statistics, recent activity, and system health.

**URL:** http://localhost:5000/dashboard

### 2. Create Your First Campaign

1. Click **Campaigns** in sidebar
2. Click **Create Campaign**
3. Fill in:
   - Campaign name
   - Target group
   - Email template
   - Landing page
4. Click **Launch Campaign**

### 3. Email Templates

Pre-built phishing templates:

- 🔐 Password reset
- 📧 Account verification
- 📦 Package delivery
- 💰 Tax refund
- 🎁 Prize notification

**Location:** **Templates** → **Email Templates**

### 4. Landing Pages

Realistic phishing landing pages:

- Login forms (Gmail, Office 365, etc.)
- Data collection forms
- Educational awareness pages

**Location:** **Landing Pages**

### 5. Results & Analytics

Track campaign performance:

- Email open rates
- Click-through rates
- Data submission rates
- Vulnerable users

**Location:** **Campaigns** → **View Results**

---

## Quick Troubleshooting

### Server Won't Start

**Error: "Port 5000 already in use"**

```bash
# Change port in .env
PORT=3000

# Or kill process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/macOS:
lsof -ti:5000 | xargs kill -9
```

### Can't Connect to Database

**Error: "Connection refused"**

```bash
# Check if PostgreSQL is running

# Windows:
Get-Service postgresql*

# Linux/macOS:
sudo systemctl status postgresql

# Start PostgreSQL if needed

# Windows (as Admin):
Start-Service postgresql-x64-15

# Linux:
sudo systemctl start postgresql

# macOS:
brew services start postgresql
```

### Forgot Admin Password

```bash
# Reset via database
psql -U postgres -d phishnet -c "UPDATE users SET password_hash = '$2b$10$XYZ...' WHERE email = 'admin@phishnet.local';"

# Or use password reset feature in app
```

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## Configuration Tips

### Development vs Production

**Development Mode** (default):
```env
NODE_ENV=development
PORT=5000
```

**Production Mode:**
```env
NODE_ENV=production
PORT=443  # or 80
SESSION_SECRET=<strong-random-secret>
```

### Email Configuration

To send real emails:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@phishnet.local
```

**Gmail Users:** Use [App Passwords](https://support.google.com/accounts/answer/185833)

### Threat Intelligence (Optional)

Get free API keys:

- **AlienVault OTX**: https://otx.alienvault.com/api
- **VirusTotal**: https://www.virustotal.com/gui/join-us
- **URLScan**: https://urlscan.io/user/signup

Add to `.env`:
```env
ALIENVAULT_API_KEY=your-key
VIRUSTOTAL_API_KEY=your-key
URLSCAN_API_KEY=your-key
```

---

## Next Steps

### 1. Secure Your Installation

- [ ] Change default passwords
- [ ] Review `.env` file
- [ ] Enable HTTPS (production)
- [ ] Configure firewall rules
- [ ] Set up regular backups

### 2. Customize Content

- [ ] Add your organization logo
- [ ] Customize email templates
- [ ] Create custom landing pages
- [ ] Set up user groups

### 3. Run Test Campaign

- [ ] Create test user group
- [ ] Select email template
- [ ] Launch campaign
- [ ] Review results
- [ ] Analyze metrics

### 4. Train Your Team

- [ ] Create training materials
- [ ] Schedule awareness sessions
- [ ] Set up reporting workflows
- [ ] Define response procedures

---

## Useful Commands

### Start/Stop Server

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm run start

# Stop server
Ctrl + C
```

### Database Management

```bash
# Open PostgreSQL shell
psql -U phishnet_user -d phishnet

# Backup database
pg_dump -U phishnet_user phishnet > backup.sql

# Restore database
psql -U phishnet_user phishnet < backup.sql

# Reset database
npm run db:reset
```

### Logs

```bash
# View logs
tail -f logs/phishnet.log

# Windows (PowerShell):
Get-Content logs\phishnet.log -Wait
```

### Update PhishNet

```bash
# Pull latest code
git pull origin main

# Update dependencies
npm install

# Rebuild
npm run build

# Restart server
npm run dev
```

---

## Getting Help

### Documentation

- 📖 [Installation Guide](./INSTALLATION.md) - Complete installation instructions
- 🔧 [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- 📚 [Main README](../../README.md) - Project overview and architecture

### Support

- 🐛 **Bug Reports**: Create GitHub issue
- 💬 **Questions**: Check documentation first
- 🔐 **Security Issues**: Report privately to maintainers

### Community

- **GitHub**: [PhishNet Repository](https://github.com/your-org/phishnet)
- **Issues**: [Report Problems](https://github.com/your-org/phishnet/issues)
- **Wiki**: [Community Guides](https://github.com/your-org/phishnet/wiki)

---

## What's Next?

Now that PhishNet is running:

1. **Explore Features**: Navigate through all pages and features
2. **Create Test Campaign**: Run a small test with your team
3. **Customize Templates**: Adapt templates to your organization
4. **Review Security**: Follow security best practices
5. **Train Users**: Educate your team on phishing awareness

**Happy Phishing (Awareness)!** 🎣🛡️

---

**Total Setup Time:**
- ✅ Prerequisites installed: 0-10 minutes
- ✅ PhishNet configured: 2-5 minutes
- ✅ First campaign launched: 2-3 minutes
- **Total: 5-20 minutes** depending on your system

**Questions?** Check [INSTALLATION.md](./INSTALLATION.md) or [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
