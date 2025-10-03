# 📋 PhishNet Setup Instructions
## Complete Installation & Configuration Guide

**Version:** 2.0  
**Last Updated:** July 25, 2025  
**Target Audience:** System Administrators, Developers, Security Teams

---

## 🎯 Overview

This guide provides step-by-step instructions for setting up PhishNet in various environments. Choose the deployment method that best fits your needs:

- **⚙️ Manual Installation** - Full control, development environments
- **☁️ Cloud Deployment** - Scalable, enterprise-grade

---

## 📋 Pre-Installation Checklist

### System Requirements

#### Minimum Requirements
- [ ] **Operating System:** Linux, macOS, or Windows 10+
- [ ] **CPU:** 2 cores (x86_64 architecture)
- [ ] **RAM:** 4GB available memory
- [ ] **Storage:** 10GB free disk space
- [ ] **Network:** Internet connection for downloads

#### Recommended for Production
- [ ] **Operating System:** Ubuntu 20.04+ or CentOS 8+
- [ ] **CPU:** 4+ cores
- [ ] **RAM:** 8GB+ available memory
- [ ] **Storage:** 50GB+ SSD storage
- [ ] **Network:** Dedicated IP, SSL certificate
- [ ] **Backup:** Automated backup solution

### Software Prerequisites

<!-- legacy container deployment removed -->

#### For Manual Installation
- [ ] **Node.js:** Version 18.0 or newer
- [ ] **npm:** Version 8.0 or newer (comes with Node.js)
- [ ] **PostgreSQL:** Version 15 or newer
- [ ] Redis: Not required (sessions use PostgreSQL)
- [ ] **Git:** Any recent version

### Network Requirements
- [ ] **Outbound Internet:** Required for package downloads
- [ ] **SMTP Access:** For sending phishing emails
- [ ] **Port Availability:** 
  - 80 (HTTP)
  - 443 (HTTPS)
  - 3001 (Application)
  - 5432 (PostgreSQL)
   - (Redis removed)

---

## 🚀 Installation Methods

## Method 1: Manual Installation

### Step 1: Install System Dependencies

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Redis not required

# Install Git
sudo apt install -y git

# Install build tools
sudo apt install -y build-essential python3
```

#### CentOS/RHEL
```bash
# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL 15
sudo yum install -y postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Redis not required

# Install Git
sudo yum install -y git

# Install development tools
sudo yum groupinstall -y "Development Tools"
```

#### macOS
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node@18 postgresql@15 git

# Start services
brew services start postgresql@15
# Redis not required
```

#### Windows
```powershell
# Install using Chocolatey
choco install nodejs postgresql git

# Or install manually:
# Node.js: https://nodejs.org/
# PostgreSQL: https://www.postgresql.org/download/windows/
# Redis: https://github.com/microsoftarchive/redis/releases
# Git: https://git-scm.com/download/win
```

### Step 2: Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE phishnet;
CREATE USER phishnet_user WITH PASSWORD 'secure_password_2025';
GRANT ALL PRIVILEGES ON DATABASE phishnet TO phishnet_user;
ALTER USER phishnet_user CREATEDB;
\q

# Update PostgreSQL configuration (if needed)
# Edit /etc/postgresql/15/main/postgresql.conf
# Edit /etc/postgresql/15/main/pg_hba.conf
```

#### Windows PostgreSQL Setup
```sql
-- Open pgAdmin or psql command line
CREATE DATABASE phishnet;
CREATE USER phishnet_user WITH PASSWORD 'secure_password_2025';
GRANT ALL PRIVILEGES ON DATABASE phishnet TO phishnet_user;
ALTER USER phishnet_user CREATEDB;
```

<!-- Redis configuration removed: not required -->

### Step 4: Clone and Setup Application

```bash
# Clone repository
git clone https://github.com/gh0st-bit/PhishNet.git
cd PhishNet/phisnet

# Run automated setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

#### Manual Setup (Alternative)

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install server dependencies
cd server
npm install
cd ..

# Create environment file
cp .env.example .env

# Edit environment file with your settings
nano .env
```

### Step 5: Configure Environment Variables

Edit the `.env` file with your specific settings:

```bash
# Database Configuration
DATABASE_URL="postgresql://phishnet_user:secure_password_2025@localhost:5432/phishnet"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="phishnet"
DB_USER="phishnet_user"
DB_PASSWORD="secure_password_2025"

# Server Configuration
PORT="3001"
NODE_ENV="production"
SESSION_SECRET="generate-a-very-long-random-string-here"

# SMTP Configuration (UPDATE WITH YOUR SETTINGS)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_SECURE="false"

<!-- Redis environment removed: not required -->

# Security Settings
BCRYPT_ROUNDS="12"
SESSION_MAX_AGE="86400000"
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="900000"

# File Upload Settings
UPLOAD_MAX_SIZE="10485760"
UPLOAD_ALLOWED_TYPES="image/jpeg,image/png,image/gif,text/csv"

# CORS Settings
CORS_ORIGIN="http://localhost"
```

### Step 6: Initialize Database

```bash
# Run database migrations
npm run db:migrate

# Or manually run SQL files
psql -h localhost -U phishnet_user -d phishnet -f migrations/00_phishnet_schema.sql
psql -h localhost -U phishnet_user -d phishnet -f migrations/01_sample_data.sql
```

### Step 7: Build and Start Application

```bash
# Build the application
npm run build

# Start the application
npm start

# Or for development with hot reload
npm run dev
```

---

## Method 3: Cloud Deployment

### AWS Deployment

#### Using EC2
```bash
# Launch EC2 instance (Ubuntu 20.04+)
# Configure security groups (ports 80, 443, 22)
# SSH into instance

# Update system
sudo apt update && sudo apt upgrade -y

# Run installation script
curl -fsSL https://raw.githubusercontent.com/gh0st-bit/PhishNet/main/scripts/cloud-setup.sh | bash
```

<!-- legacy ECS deployment snippet removed -->

### Google Cloud Platform

```bash
# Using Google Cloud Run
gcloud run deploy phishnet \
  --image=gcr.io/PROJECT_ID/phishnet \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated
```

### Microsoft Azure

```bash
# Using Azure Container Instances
az container create \
  --resource-group myResourceGroup \
  --name phishnet \
  --image phishnet:latest \
  --dns-name-label phishnet-app \
  --ports 80
```

---

## 🔧 Post-Installation Configuration

### Step 1: Initial Access

1. **Open your web browser**
2. **Navigate to:** `http://localhost` (or your server IP)
3. **Login with default credentials:**
   - Email: `admin@phishnet.local`
   - Password: `admin123`

### Step 2: Change Default Password

1. **Click on user profile** (top right)
2. **Select "Account Settings"**
3. **Update password** to a strong, unique password
4. **Save changes**

### Step 3: Configure SMTP Settings

1. **Navigate to Settings** → **Email Configuration**
2. **Enter your SMTP details:**
   - **Host:** Your SMTP server
   - **Port:** Usually 587 or 465
   - **Username:** Your email address
   - **Password:** Your email password or app password
   - **Security:** Enable TLS/SSL

3. **Test configuration** by sending a test email

### Step 4: Create Your Organization

1. **Go to Organizations** → **Add New Organization**
2. **Fill in organization details:**
   - Name
   - Domain
   - Contact information
   - Settings preferences

3. **Save organization**

### Step 5: Add Users

1. **Navigate to Users** → **Add User**
2. **Enter user information:**
   - Email address
   - First and last name
   - Role (Admin, Manager, User)
   - Organization assignment

3. **Send invitation** or provide login credentials

### Step 6: Configure Templates

1. **Go to Templates** → **Email Templates**
2. **Review and customize** existing templates
3. **Create new templates** for your organization
4. **Test templates** with safe recipients

---

## 🔒 Security Configuration

### SSL/HTTPS Setup

#### Option 1: Let's Encrypt (Free SSL)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Option 2: Custom SSL Certificate
```bash
# Place your certificates
mkdir ssl
cp your-certificate.crt ssl/
cp your-private-key.key ssl/

# Update nginx configuration
# Edit nginx/default.conf to enable SSL
```

### Firewall Configuration

#### Ubuntu (UFW)
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3001/tcp  # Block direct app access
sudo ufw deny 5432/tcp  # Block direct DB access
```

#### CentOS (firewalld)
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

### Database Security

```sql
-- Create read-only user for backups
CREATE USER phishnet_backup WITH PASSWORD 'backup_password';
GRANT CONNECT ON DATABASE phishnet TO phishnet_backup;
GRANT USAGE ON SCHEMA public TO phishnet_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO phishnet_backup;

-- Revoke unnecessary permissions
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

---

## 🔍 Verification & Testing

### Health Checks

```bash
# Check application health
curl http://localhost/health

# Check database connection
curl http://localhost/api/health/database

<!-- Redis health check removed -->
```

### Service Status

(legacy log/stat commands removed – use journalctl, systemctl status, or app logs)

#### Manual Installation
```bash
# Check Node.js process
ps aux | grep node

# Check PostgreSQL
sudo systemctl status postgresql

<!-- Redis service status removed -->

# Check ports
netstat -tulpn | grep -E '(3001|5432)'
```

### Functional Testing

1. **Login Test**
   - Access application at `http://localhost`
   - Login with admin credentials
   - Verify dashboard loads

2. **Email Test**
   - Go to Settings → Email Configuration
   - Send test email
   - Verify email delivery

3. **Campaign Test**
   - Create a test campaign
   - Send to a safe email address
   - Verify email reception and tracking

4. **Database Test**
   - Create a new user
   - Verify user appears in database
   - Test user login

---

## 🛠️ Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
npm run logs
# or
(legacy log command removed)

# Common causes:
# 1. Port already in use
sudo lsof -i :3001
sudo kill -9 <PID>

# 2. Database connection failed
# Check DATABASE_URL in .env
# Verify PostgreSQL is running
sudo systemctl status postgresql

# 3. Missing dependencies
npm install
```

#### Database Connection Error
```bash
# Test database connection
psql -h localhost -U phishnet_user -d phishnet

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Verify user permissions
sudo -u postgres psql
\du  # List users and permissions
```

#### Email Not Sending
```bash
# Check SMTP settings in .env
# Test SMTP connection
telnet smtp.gmail.com 587

# For Gmail, ensure:
# 1. 2-factor authentication enabled
# 2. App password generated
# 3. Less secure app access (if not using app password)
```

#### Permission Denied Errors
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh

# Fix upload directory
sudo mkdir -p uploads
sudo chown -R www-data:www-data uploads
sudo chmod 755 uploads
```

(legacy cleanup/build/run commands removed – native only)

### Log Locations

- **Application Logs:** `logs/phishnet.log`
- **PostgreSQL Logs:** `/var/log/postgresql/`
- **Nginx Logs:** `/var/log/nginx/`
(legacy logs reference removed)
- **System Logs:** `/var/log/syslog`

### Getting Help

1. **Check Documentation:** Review relevant sections
2. **Search Issues:** Check GitHub issues for similar problems
3. **Enable Debug Mode:** Set `NODE_ENV=development` and `LOG_LEVEL=debug`
4. **Collect Information:**
   - Error messages
   - Log files
   - System information
   - Steps to reproduce

---

## 🔄 Maintenance

### Regular Tasks

#### Daily
- [ ] Monitor application logs
- [ ] Check disk space usage
- [ ] Verify backup completion
- [ ] Review security alerts

#### Weekly
- [ ] Update npm packages
- [ ] Review user activity
- [ ] Clean temporary files
- [ ] Test backup restoration

#### Monthly
- [ ] Update system packages
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Security audit
- [ ] Performance review

### Backup Procedures

#### Database Backup
```bash
# Manual backup
pg_dump -h localhost -U phishnet_user phishnet > backup_$(date +%Y%m%d).sql

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U phishnet_user phishnet > /backups/phishnet_$DATE.sql
find /backups -name "phishnet_*.sql" -mtime +7 -delete
```

#### File Backup
```bash
# Backup uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# Full application backup
tar -czf phishnet_backup_$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=logs \
  .
```

#### Automated Backup Cron Job
```bash
# Edit crontab
crontab -e

# Add backup jobs
0 2 * * * /path/to/backup-database.sh
0 3 * * * /path/to/backup-files.sh
0 4 * * 0 /path/to/cleanup-old-backups.sh
```

### Update Procedures

#### Application Updates
```bash
# Backup current installation
./scripts/backup.sh

# Pull latest changes
git pull origin main

# Update dependencies
npm update

# Run migrations
npm run db:migrate

# Rebuild and restart
npm run build
# (legacy restart removed) Use your process/service manager instead
```

#### System Updates
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y

# Reboot if kernel updated
sudo reboot
```

---

## 📞 Support

### Documentation Resources
- **📖 Main Documentation:** [README.md](./README.md)
- **🚀 Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **🔧 API Documentation:** [docs/api/](./docs/api/)
- **👥 User Guide:** [docs/user-guide/](./docs/user-guide/)

### Community Support
- **🐛 Bug Reports:** [GitHub Issues](https://github.com/gh0st-bit/PhishNet/issues)
- **💡 Feature Requests:** [GitHub Discussions](https://github.com/gh0st-bit/PhishNet/discussions)
- **❓ Questions:** [Community Forum](https://community.phishnet.com)

### Professional Support
For enterprise support, custom development, or priority assistance:
- **📧 Email:** support@phishnet.com
- **💼 Enterprise:** enterprise@phishnet.com

---

## ✅ Installation Checklist

### Pre-Installation
- [ ] System requirements verified
- [ ] Software prerequisites installed
- [ ] Network requirements confirmed
- [ ] Backup plan established

### Installation
- [ ] Repository cloned successfully
- [ ] Dependencies installed
- [ ] Database configured and accessible
- [ ] Environment variables configured
- [ ] Application builds without errors

### Post-Installation
- [ ] Application accessible via web browser
- [ ] Default admin password changed
- [ ] SMTP configuration tested
- [ ] SSL certificate installed (production)
- [ ] Firewall configured
- [ ] Backup system operational

### Security
- [ ] Default passwords changed
- [ ] User accounts secured
- [ ] Database permissions configured
- [ ] Audit logging enabled
- [ ] Security headers configured

### Monitoring
- [ ] Health checks operational
- [ ] Log monitoring configured
- [ ] Performance monitoring setup
- [ ] Backup verification automated
- [ ] Update procedures documented

---

**Installation Complete! 🎉**

Your PhishNet installation is now ready for use. Remember to regularly update the system, monitor logs, and maintain security best practices.

**Last Updated:** July 25, 2025
