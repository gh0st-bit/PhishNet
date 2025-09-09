# 🎣 PhishNet - Advanced Phishing Simulation Platform

<div align="center">

[![Node.js](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.0.0-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D15-blue)](https://www.postgresql.org/)

**🚀 One-Command Setup** • **🔒 Enterprise Grade**

</div>

---

## 🌟 Overview

PhishNet is a professional phishing simulation platform designed for cybersecurity training and awareness. Features advanced templates, real-time analytics, and enterprise-grade security.

### ✨ Key Features
- 🎣 **Advanced Phishing Campaigns** with professional templates
- 📊 **Real-Time Analytics** and detailed reporting
- 🏢 **Multi-Tenant Support** for organizations
- 🔒 **Role-Based Access Control** and security features

---

## ⚡ Quick Setup

### 🚀 One-Command Deployment

#### Linux/macOS:
```bash
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet/phisnet
chmod +x deploy.sh
./deploy.sh
```

#### Windows PowerShell:
```powershell
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet\phisnet
.\deploy.ps1
```

> Note: Legacy container quick start removed. Use the platform scripts above for local setup.

---

## 🔑 Default Access

- **URL:** `http://localhost:3000`
- **Email:** `admin@phishnet.local`
- **Password:** `admin123`

**⚠️ Change the default password immediately after first login!**

---

## 🛠️ Manual Setup (If Needed)

If automatic deployment fails, you can set up manually:

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis
- Git

### 🗄️ Automatic Database Setup
The deployment scripts automatically handle database creation and setup:

```bash
# 1. Clone repository
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet/phisnet

# 2. Install dependencies
npm install

# 3. Complete Automated Setup (NEW ENHANCED VERSION!)
# The deploy scripts now automatically handle:
# ✅ Database creation with proper user permissions
# ✅ Complete environment configuration with secure defaults
# ✅ Required directory creation (logs, uploads, temp, exports, backups)
# ✅ Database schema application from SQL files
# ✅ Sample data import with admin user creation
# ✅ Fallback to manual SQL import if npm scripts fail
# ✅ Database connection verification and table counting
# ✅ Security settings with auto-generated secrets

# Run the complete setup (everything automated):
npm run setup

# Or run individual steps:
npm run db:push        # Create/update database schema
npm run import-data    # Import sample data and admin user

# 4. Environment Auto-Configuration (NEW!)
# .env file is automatically created with:
# - Database URL (postgresql://postgres@localhost:5432/phishnet)
# - Redis configuration for sessions
# - Auto-generated security secrets
# - Complete application settings
# - Email configuration (optional)
# - Upload and logging settings
# - Feature toggles and admin account details

# 5. Verify Everything Works (NEW!)
./verify-setup.sh      # Linux/macOS
.\verify-setup.ps1     # Windows
# This checks: Node.js, PostgreSQL, Redis, database tables, 
# environment files, project structure, and connections

# 6. Start application
npm run dev
```

### 🔄 Database Management Commands

```bash
# Reset database completely (removes all data)
./reset-db.sh          # Linux/macOS
.\reset-db.ps1         # Windows (if available)

# Or use npm scripts:
npm run db:push        # Update schema only
npm run import-data    # Re-import sample data
npm run setup          # Complete setup (schema + data)

# Check database status
psql -U postgres -d phishnet -c "\dt"  # List tables
```

### 📊 Database Configuration

**Automatic Setup Includes:**
- ✅ Database: `phishnet` 
- ✅ User: `postgres` (default PostgreSQL user)
- ✅ Schema: Complete PhishNet tables and relationships
- ✅ Sample Data: Templates, campaigns, and admin user
- ✅ Extensions: Required PostgreSQL extensions
- ✅ Permissions: Proper access controls

**Default Admin Account:**
- Email: `admin@phishnet.local`
- Password: `admin123`
- Role: Super Administrator

---

## 📦 Package for Friends

Create a complete package with your data for easy sharing:

```bash
./create-package.sh
```

This creates a package containing:
- Complete PhishNet source code
- Your database with campaigns and templates
- Automated setup scripts
- All configuration files

---


## �️ Supported Platforms

### Automatically Detected:
- 🐉 **Kali Linux** (with auto-fixes)
- 🐧 **Ubuntu/Debian**
- 🎩 **CentOS/RHEL/Rocky**
- 🎁 **Fedora**
- ⚡ **Arch/Manjaro**
- 🪟 **Windows 10/11**
- 🍎 **macOS (Intel/ARM)**

### Database Configuration
- 🗄️ **Automatic Database Creation**: Creates `phishnet` database with `postgres` user
- 📊 **Schema Management**: Uses Drizzle ORM with automated migrations
- 🔒 **Secure Setup**: Proper permissions and PostgreSQL extensions
- 📈 **Sample Data**: Pre-loaded templates, campaigns, and admin account
- 🔄 **Easy Reset**: Simple database reset and restoration commands

---

## 📚 Quick Commands

```bash
# Start development server
./start.sh              # Linux/macOS
.\start.ps1             # Windows

# Deploy production
./deploy.sh --production

# Database Management
./reset-db.sh           # Complete database reset
npm run setup           # Schema + sample data
npm run db:push         # Update schema only
npm run import-data     # Import sample data

# Verify Setup (NEW!)
./verify-setup.sh       # Linux/macOS - Check installation
.\verify-setup.ps1      # Windows - Check installation

# Create shareable package
./create-package.sh

# Fix Kali Linux issues
./kali-quick-fix.sh

# Database Troubleshooting
psql -U postgres -d phishnet -c "\l"    # List databases
psql -U postgres -d phishnet -c "\dt"   # List tables
psql -U postgres -d phishnet -c "\du"   # List users
```

---

## 🗄️ Database Details

### Automatic Database Setup
PhishNet automatically creates and configures a complete PostgreSQL database:

**Database Structure:**
- **Database Name**: `phishnet`
- **User**: `postgres` (default system user)
- **Tables**: 15+ tables for campaigns, templates, users, analytics
- **Extensions**: plpgsql, uuid-ossp (auto-installed)
- **Sample Data**: Ready-to-use templates and admin account

**Schema Files:**
- `migrations/00_phishnet_schema.sql` - Complete database schema
- `migrations/01_sample_data.sql` - Sample templates and admin user
- `migrations/create_notifications.sql` - Notification system
- `migrations/fix-missing-columns.sql` - Schema updates

**Database Reset Process:**
```bash
# Automated reset (recommended)
./reset-db.sh

# Manual reset process:
sudo -u postgres psql -c "DROP DATABASE IF EXISTS phishnet;"
sudo -u postgres psql -c "CREATE DATABASE phishnet;"
npm run db:push         # Apply schema
npm run import-data     # Load sample data
```

---

## 🎯 Architecture

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Cache:** Redis for sessions
- **Deployment:** Universal scripts

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ for the cybersecurity community**

[Report Issues](https://github.com/gh0st-bit/PhishNet/issues) • [Documentation](./docs/) • [Support](mailto:support@phishnet.local)

</div>
