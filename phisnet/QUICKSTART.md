# ⚡ PhishNet Quick Start Guide
## Get Up and Running in 5 Minutes

**Perfect for:** Demo, Testing, Development  
**Time Required:** 5-10 minutes  
**Difficulty:** Beginner

---

## 🎯 Choose Your Setup Method

### 🪟 Windows (PowerShell/Batch)

The easiest way to deploy on Windows:

```powershell
# 1. Clone the repository
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet/phisnet

# 2. Run deployment (automatically installs all dependencies)
.\deploy.ps1

# 3. Start PhishNet
.\start.ps1
```

**Alternative using Batch files:**
```cmd
deploy.bat
start.bat
```

**📋 What gets installed:** Node.js, PostgreSQL, Git  
**🔐 Database Credentials:** `postgres` / `postgres`

### 🐧 Linux/macOS (Universal)

Works on Ubuntu, Debian, CentOS, Fedora, Arch, macOS:

```bash
# 1. Clone the repository
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet/phisnet

# 2. Run universal deployment
chmod +x deploy.sh
./deploy.sh

# 3. Start PhishNet
./start.sh
```

### 🐉 Kali Linux (Special Instructions)

If you're using Kali Linux, the universal script includes built-in fixes:

```bash
# 1. Clone the repository  
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet/phisnet

# 2. Run deployment (includes Kali-specific fixes)
chmod +x deploy.sh
./deploy.sh

# 3. Start PhishNet
./start.sh
```

**🔐 Database Credentials:** `postgres` / `postgres` (standardized across all platforms)

### ⚙️ Option 1: Manual Setup  
**Best for:** Development, Custom Configuration

```bash
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet/phisnet
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 🪟 Option 2: Windows
**For Windows PowerShell:**

```powershell
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet\phisnet
.\scripts\setup.ps1
```

---

## 🚀 What Happens During Setup

### Automated Setup Process:
1. ✅ **System Check** - Verifies requirements
2. ✅ **Database Setup** - Creates PostgreSQL database with sample data
3. ✅ **Dependencies** - Installs all required packages
4. ✅ **Configuration** - Generates secure environment settings
5. ✅ **Application Build** - Compiles and optimizes the application
6. ✅ **Service Start** - Launches all services with health checks

### Sample Data Included:
- **Users:** Pre-populated test accounts
- **Email Templates:** Professional phishing templates
- **Landing Pages:** Credential harvesting pages
- **Admin Access:** Ready-to-use administrative account

---

## 🔐 Default Access Credentials

### Main Admin Account
- **URL:** `http://localhost`
- **Email:** `admin@phishnet.local`
- **Password:** `admin123`
- **Role:** Super Administrator

### Additional Sample Accounts (optional)
- Additional demo users may be included for testing different views.

**⚠️ IMPORTANT:** Change all default passwords immediately after first login!

---

## 🎯 First Steps After Installation

### 1. Access the Application (2 minutes)
```bash
# Open your browser and navigate to:
http://localhost

# Login with default admin credentials
# Email: admin@phishnet.local
# Password: admin123
```

### 2. Change Admin Password (1 minute)
1. Click your profile icon (top right)
2. Select "Account Settings"  
3. Change password to something secure
4. Save changes

### 3. Configure Email Settings (2 minutes)
1. Go to **Settings** → **Email Configuration**
2. Enter your SMTP details:
   ```
   SMTP Host: smtp.gmail.com
   Port: 587
   Username: your-email@gmail.com
   Password: your-app-password
   ```
3. Click **Test Connection**
4. Save settings

### 4. Test the System (3 minutes)
1. Navigate to **Campaigns** → **Create Campaign**
2. Select a template (e.g., "Business Email Compromise")
3. Add your email as a test target
4. Set to send immediately
5. Launch campaign and check your email

### 5. Explore Sample Data (5 minutes)
- **Dashboard:** View analytics and metrics
- **Users:** Browse sample users
- **Templates:** Explore pre-built phishing templates
- **Reports:** Check sample campaign results

---

## 🛠️ Quick Commands Reference

### Manual Installation
```bash
# Start application
npm start

# Development mode (hot reload)
npm run dev

# View logs
npm run logs

# Run tests
npm test

# Build for production
npm run build
```

### Health Checks
```bash
# Application health
curl http://localhost/health

# Database health
curl http://localhost/api/health/database

# Full system status
curl http://localhost/api/health/all
```

---

## 📊 Quick Demo Scenarios

### Scenario 1: Basic Phishing Test (5 minutes)
1. **Login** as admin
2. **Create Campaign:**
   - Template: "Password Reset Request"
   - Target: Your email address
   - Schedule: Send immediately
3. **Launch** and check your inbox
4. **Click** the phishing link (safe in test mode)
5. **View Results** in the dashboard

### Scenario 2: Team Training Campaign (10 minutes)
1. **Login** as admin
2. **Create Training Campaign:**
   - Select multiple users
   - Use "Fake Invoice" template
   - Schedule for next hour
3. **Monitor** user interactions
4. **Generate** compliance report

### Scenario 3: Landing Page Test (5 minutes)
1. **Go to** Landing Pages section
2. **Select** "Office 365 Login" template
3. **Customize** with your organization branding
4. **Test** the credential capture functionality
5. **Review** captured data (safely stored)

---

## 🔍 Verification Checklist

After setup, verify these components are working:

### ✅ Core System
- [ ] Application loads at `http://localhost`
- [ ] Admin login successful
- [ ] Dashboard displays sample data
- [ ] Navigation works across all sections

### ✅ Database Integration
- [ ] User accounts visible in Users section
- [ ] Campaign history shows sample campaigns
- [ ] Reports generate successfully

### ✅ Email System
- [ ] SMTP settings save successfully
- [ ] Test email sends without errors
- [ ] Email templates load correctly
- [ ] Campaign emails deliver to targets

### ✅ Security Features
- [ ] Password change works
- [ ] Session timeout functions
- [ ] Audit logs record activities

---

## 🚨 Troubleshooting Quick Fixes

### Kali Linux PostgreSQL Issues

If you see errors like:
- `collation version mismatch`
- `password authentication failed`
- `database "phishnet" does not exist`

**🔧 Quick Fix:**
```bash
# Run the PostgreSQL fix script first
chmod +x scripts/fix-postgresql-kali.sh
./scripts/fix-postgresql-kali.sh

# Then run main setup
./scripts/setup.sh
```

### Wrong Directory Error
```bash
# If you see: cd: no such file or directory: PhishNet/phisnet
# You're already in the right directory, just run:
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Application Won't Load
```bash
# Check if node process is running
ps aux | grep node | grep -v grep

# Check logs for errors
tail -f logs/phishnet.log
```

(legacy restart command removed – use native service manager or restart Node process)
### Database Connection Failed
```bash
# Test database connection
psql -h localhost -U phishnet_user -d phishnet

# Restart PostgreSQL (examples)
sudo systemctl restart postgresql || sudo service postgresql restart
```

### Email Not Sending
1. **Check SMTP settings** in Settings → Email Configuration
2. **For Gmail:** Use app-specific password
3. **Test connection** with the built-in test feature
4. **Check logs** for specific error messages

### Port Already in Use
```bash
# Find process using port 3001
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>

# Or use different port in .env
PORT=3002
```

---

## 🎓 Next Steps

### For Development
1. **Read** [INSTALLATION.md](./INSTALLATION.md) for detailed setup
2. **Explore** the API documentation
3. **Check out** the development guidelines
4. **Run** the test suite: `npm test`

### For Production
1. **Review** [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
2. **Configure** SSL certificates
3. **Set up** automated backups
4. **Configure** monitoring and alerting

### For Learning
1. **Complete** all demo scenarios
2. **Create** your own phishing templates
3. **Test** different attack vectors
4. **Generate** various reports

---

## 📚 Additional Resources

### Documentation
- 📖 [README.md](./README.md) - Complete project overview
- 🔧 [INSTALLATION.md](./INSTALLATION.md) - Detailed installation guide
- 🚀 [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- 📊 [User Guide](./docs/user-guide/) - End-user documentation

### Sample Data Details
- **Organizations:** Pre-configured with realistic settings
- **Users:** Various roles with appropriate permissions
- **Templates:** Industry-standard phishing scenarios
- **Campaigns:** Example phishing test results

### Support
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/gh0st-bit/PhishNet/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/gh0st-bit/PhishNet/discussions)
- 📧 **Support:** support@phishnet.com

---

## ⏱️ Time Estimates

| Task | Time Required |
|------|---------------|
| **Manual Setup** | 10-15 minutes |
| **First Login & Password Change** | 2 minutes |
| **Email Configuration** | 3-5 minutes |
| **First Phishing Test** | 5 minutes |
| **Explore Sample Data** | 10 minutes |
| **Total Getting Started** | 25-40 minutes |

---

## 🎉 You're Ready!

Congratulations! You now have a fully functional PhishNet installation with:

- ✅ **Complete phishing simulation platform**
- ✅ **Sample data for immediate testing**
- ✅ **Multiple user accounts**
- ✅ **Professional email templates**
- ✅ **Analytics and reporting dashboards**
- ✅ **Security best practices implemented**

**Happy Phishing! 🎣**

---

*Need help? Check our [troubleshooting guide](./INSTALLATION.md#troubleshooting) or [open an issue](https://github.com/gh0st-bit/PhishNet/issues).*
