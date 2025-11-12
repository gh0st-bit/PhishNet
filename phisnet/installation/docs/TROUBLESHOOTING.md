# PhishNet Troubleshooting Guide

Comprehensive solutions to common installation and runtime issues.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Database Issues](#database-issues)
3. [Server Issues](#server-issues)
4. [Email Issues](#email-issues)
5. [Authentication Issues](#authentication-issues)
6. [UI/Frontend Issues](#uifrontend-issues)
7. [Performance Issues](#performance-issues)
8. [Windows-Specific Issues](#windows-specific-issues)
9. [Linux/macOS-Specific Issues](#linuxmacos-specific-issues)
10. [Network Issues](#network-issues)

---

## Installation Issues

### Script Permission Denied (Linux/macOS)

**Error:**
```
bash: ./install.sh: Permission denied
```

**Solution:**
```bash
chmod +x installation/scripts/install.sh
./installation/scripts/install.sh
```

### PowerShell Execution Policy (Windows)

**Error:**
```
File cannot be loaded because running scripts is disabled on this system
```

**Solution 1 (Recommended):**
```powershell
# Run as Administrator
PowerShell -ExecutionPolicy Bypass -File installation\scripts\install-windows.ps1
```

**Solution 2 (Temporary):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\installation\scripts\install-windows.ps1
```

**Solution 3 (Permanent - Not Recommended):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Chocolatey Installation Fails (Windows)

**Error:**
```
Failed to install Chocolatey package manager
```

**Solution:**

1. **Manual Chocolatey Installation:**
```powershell
# Run as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

2. **Verify Installation:**
```powershell
choco --version
```

3. **Retry PhishNet Installation:**
```powershell
.\installation\scripts\install-windows.ps1
```

### Node.js Installation Fails

**Error:**
```
Failed to install Node.js
```

**Solution (Manual Installation):**

**Windows:**
1. Download from: https://nodejs.org/en/download/
2. Install LTS version (18.x or later)
3. Verify: `node --version`

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS:**
```bash
brew install node@18
```

### PostgreSQL Installation Fails

**Error:**
```
Failed to install PostgreSQL
```

**Solution (Manual Installation):**

**Windows:**
1. Download from: https://www.postgresql.org/download/windows/
2. Install PostgreSQL 15
3. Remember the postgres user password
4. Verify: `psql --version`

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

### npm install Fails

**Error:**
```
npm ERR! code EACCES
npm ERR! permission denied
```

**Solution 1 (Fix npm Permissions):**
```bash
# Linux/macOS
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

**Solution 2 (Use Node Version Manager):**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node via nvm
nvm install 18
nvm use 18
```

**Solution 3 (Clear Cache):**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## Database Issues

### Cannot Connect to PostgreSQL

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution 1 (Check if PostgreSQL is Running):**

**Windows:**
```powershell
# Check status
Get-Service postgresql*

# Start service
Start-Service postgresql-x64-15
```

**Linux:**
```bash
# Check status
sudo systemctl status postgresql

# Start service
sudo systemctl start postgresql
```

**macOS:**
```bash
# Check status
brew services list

# Start service
brew services start postgresql@15
```

**Solution 2 (Check Connection Settings):**

Verify `.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phishnet
DB_USER=phishnet_user
DB_PASSWORD=your_password
```

**Solution 3 (Test Connection Manually):**
```bash
psql -h localhost -p 5432 -U phishnet_user -d phishnet
```

### Authentication Failed for User

**Error:**
```
FATAL: password authentication failed for user "phishnet_user"
```

**Solution:**

1. **Reset Password:**
```bash
# Connect as postgres superuser
psql -U postgres

# Change password
ALTER USER phishnet_user WITH PASSWORD 'new_password';
\q
```

2. **Update .env File:**
```env
DB_PASSWORD=new_password
```

3. **Check pg_hba.conf:**
```bash
# Find config file
# Linux: /etc/postgresql/15/main/pg_hba.conf
# Windows: C:\Program Files\PostgreSQL\15\data\pg_hba.conf
# macOS: /usr/local/var/postgres/pg_hba.conf

# Change md5 to trust temporarily for local connections
# Then restart PostgreSQL
```

### Database Does Not Exist

**Error:**
```
FATAL: database "phishnet" does not exist
```

**Solution:**

1. **Create Database Manually:**
```bash
# Connect as postgres
psql -U postgres

# Create database
CREATE DATABASE phishnet;

# Create user
CREATE USER phishnet_user WITH PASSWORD 'your_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE phishnet TO phishnet_user;
\q
```

2. **Import Schema:**
```bash
psql -U phishnet_user -d phishnet < server/db/schema.sql
```

### Migration/Seed Failures

**Error:**
```
Error running migrations
```

**Solution:**

1. **Check Database Connection:**
```bash
npm run db:test
```

2. **Reset Database:**
```bash
# Backup first if needed
pg_dump -U phishnet_user phishnet > backup.sql

# Drop and recreate
psql -U postgres -c "DROP DATABASE phishnet;"
psql -U postgres -c "CREATE DATABASE phishnet;"

# Reimport
psql -U phishnet_user phishnet < server/db/schema.sql
```

3. **Run Migrations Manually:**
```bash
npm run db:push
npm run db:seed
```

---

## Server Issues

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution 1 (Change Port):**

Edit `.env`:
```env
PORT=3000  # or any available port
```

**Solution 2 (Kill Process Using Port):**

**Windows:**
```powershell
# Find process
netstat -ano | findstr :5000

# Kill process (replace PID)
taskkill /PID 1234 /F
```

**Linux/macOS:**
```bash
# Find and kill process
lsof -ti:5000 | xargs kill -9

# Or use fuser
fuser -k 5000/tcp
```

### Server Crashes on Startup

**Error:**
```
Server crashed: Cannot find module 'xyz'
```

**Solution:**

1. **Reinstall Dependencies:**
```bash
rm -rf node_modules package-lock.json
npm install
```

2. **Check Node Version:**
```bash
node --version  # Should be 18.x or later
```

3. **Rebuild Native Modules:**
```bash
npm rebuild
```

4. **Check for Syntax Errors:**
```bash
npm run lint
```

### Cannot Find Build Files

**Error:**
```
Error: Cannot find 'dist' directory
```

**Solution:**

1. **Build the Application:**
```bash
npm run build
```

2. **Check Build Output:**
```bash
ls -la dist/  # Linux/macOS
dir dist\     # Windows
```

3. **Clean and Rebuild:**
```bash
rm -rf dist
npm run build
```

### Environment Variables Not Loaded

**Error:**
```
Error: Required environment variable 'XYZ' is not defined
```

**Solution:**

1. **Verify .env File Exists:**
```bash
ls -la .env  # Linux/macOS
dir .env     # Windows
```

2. **Check .env Format:**
```env
# Correct format (no spaces around =)
DB_HOST=localhost
PORT=5000

# Incorrect format
DB_HOST = localhost  # ❌ spaces around =
PORT= 5000           # ❌ space after =
```

3. **Restart Server:**
```bash
# Kill all node processes
pkill node  # Linux/macOS
taskkill /IM node.exe /F  # Windows

# Start again
npm run dev
```

---

## Email Issues

### SMTP Connection Failed

**Error:**
```
Error: Connection timeout connecting to smtp.gmail.com
```

**Solution 1 (Gmail Users - Use App Password):**

1. Enable 2FA: https://myaccount.google.com/security
2. Create App Password: https://myaccount.google.com/apppasswords
3. Update `.env`:
```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # 16-character app password
```

**Solution 2 (Check SMTP Settings):**

**Gmail:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Outlook/Office 365:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Solution 3 (Test SMTP Manually):**
```bash
# Install swaks (SMTP test tool)
# Linux:
sudo apt install swaks

# Test connection
swaks --to test@example.com --from your-email@gmail.com --server smtp.gmail.com:587 --tls --auth-user your-email@gmail.com --auth-password your-app-password
```

### Emails Not Sending

**Error:**
```
Email queued but not sent
```

**Solution:**

1. **Check Email Queue:**
```bash
# View logs
tail -f logs/phishnet.log
```

2. **Test Email Functionality:**
```bash
# Use built-in test
npm run test:email
```

3. **Verify SMTP Credentials:**
```bash
# Test login manually
telnet smtp.gmail.com 587
```

### Emails Going to Spam

**Issue:**
Phishing simulation emails landing in spam folders.

**Solution:**

1. **Configure SPF Record** (if using custom domain):
```dns
TXT record: v=spf1 include:_spf.google.com ~all
```

2. **Configure DKIM** (if using custom domain):
Follow your email provider's DKIM setup guide.

3. **Whitelist Sender** (test environments):
Ask recipients to whitelist the sender email address.

4. **Improve Email Content:**
- Avoid spam trigger words
- Include plain text version
- Add proper headers
- Use realistic sender names

---

## Authentication Issues

### Cannot Login with Default Credentials

**Error:**
```
Invalid email or password
```

**Solution:**

1. **Verify Default Credentials:**
```
Email: admin@phishnet.local
Password: admin123
```

2. **Check if Users Were Seeded:**
```bash
psql -U phishnet_user -d phishnet -c "SELECT email, role FROM users;"
```

3. **Reseed Database:**
```bash
npm run db:seed
```

4. **Reset Admin Password Manually:**
```bash
# Generate password hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('newpassword', 10, (err, hash) => console.log(hash));"

# Update database
psql -U phishnet_user -d phishnet -c "UPDATE users SET password_hash = 'HASH_HERE' WHERE email = 'admin@phishnet.local';"
```

### Session Expires Too Quickly

**Issue:**
Getting logged out frequently.

**Solution:**

Edit `.env`:
```env
# Increase session duration (in milliseconds)
SESSION_MAX_AGE=86400000  # 24 hours
SESSION_MAX_AGE=604800000 # 7 days
```

### Forgot Password Not Working

**Error:**
```
Password reset email not received
```

**Solution:**

1. **Check SMTP Configuration:**
Verify email settings work (see [Email Issues](#email-issues))

2. **Check Email Logs:**
```bash
tail -f logs/phishnet.log | grep "password reset"
```

3. **Manual Password Reset:**
```bash
# Use database method from "Cannot Login" section above
```

---

## UI/Frontend Issues

### White Screen / Blank Page

**Error:**
Browser shows white/blank page

**Solution:**

1. **Check Browser Console:**
Press `F12` and check Console tab for errors

2. **Rebuild Frontend:**
```bash
cd client
npm run build
cd ..
npm run build
```

3. **Clear Browser Cache:**
- Press `Ctrl + Shift + Delete`
- Clear cached images and files
- Reload page with `Ctrl + F5`

4. **Check Static Files:**
```bash
# Verify build output exists
ls -la dist/  # Should contain index.html
```

### Theme Not Working / White on White Text

**Issue:**
Light theme shows white text on white background

**Solution:**

This was fixed in the latest update. Update your code:

```bash
git pull origin main
npm install
npm run build
```

If still broken, check `client/src/index.css`:
```css
:root {
  --background: 0 0% 100%;  /* White */
  --foreground: 0 0% 0%;    /* Black */
}
```

### Components Not Displaying

**Error:**
UI elements missing or broken

**Solution:**

1. **Check Component Imports:**
```bash
npm run lint
```

2. **Reinstall Dependencies:**
```bash
cd client
rm -rf node_modules
npm install
cd ..
npm install
```

3. **Check for CSS Issues:**
```bash
# Verify Tailwind is working
npm run build:css
```

### Tabs Not Visible (White on White)

**Issue:**
Active tabs invisible in light theme

**Solution:**

Already fixed in latest version. Update:
```bash
git pull origin main
```

Or manually fix `client/src/components/ui/tabs.tsx`:
```tsx
<TabsTrigger 
  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
  // ... other props
/>
```

---

## Performance Issues

### Slow Page Load Times

**Issue:**
Pages take long to load

**Solution:**

1. **Enable Production Mode:**
```env
NODE_ENV=production
```

2. **Build with Optimizations:**
```bash
npm run build
```

3. **Enable Gzip Compression:**

Add to `server/index.ts`:
```typescript
import compression from 'compression';
app.use(compression());
```

4. **Check Database Indexes:**
```sql
-- Add indexes to frequently queried columns
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaign_results_timestamp ON campaign_results(timestamp);
```

### High Memory Usage

**Issue:**
Node.js process using too much RAM

**Solution:**

1. **Increase Node Memory Limit:**
```bash
# In package.json scripts:
"start": "node --max-old-space-size=2048 dist/index.js"
```

2. **Check for Memory Leaks:**
```bash
# Monitor memory
node --inspect dist/index.js

# Open chrome://inspect in Chrome browser
```

3. **Optimize Database Queries:**
```typescript
// Use pagination
const results = await db.query('SELECT * FROM campaigns LIMIT 100 OFFSET 0');

// Clean up connections
await db.end();
```

### Slow Database Queries

**Issue:**
Operations taking too long

**Solution:**

1. **Analyze Slow Queries:**
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
SELECT pg_reload_conf();

-- Check logs
tail -f /var/log/postgresql/postgresql-15-main.log
```

2. **Add Indexes:**
```sql
-- Identify missing indexes
SELECT * FROM pg_stat_user_tables WHERE schemaname = 'public';

-- Add indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at);
```

3. **Vacuum Database:**
```sql
VACUUM ANALYZE;
```

---

## Windows-Specific Issues

### Windows Defender Blocking

**Issue:**
Antivirus blocking installation or execution

**Solution:**

1. **Add Exclusions:**
- Open Windows Security
- Virus & threat protection settings
- Exclusions → Add exclusion
- Add folder: `C:\...\phisnet`

2. **Allow Through Firewall:**
```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "PhishNet" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
```

### Path Too Long Error

**Error:**
```
ENAMETOOLONG: name too long
```

**Solution:**

1. **Enable Long Paths:**
```powershell
# Run as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

2. **Move Project to Shorter Path:**
```powershell
# Example: Move to C:\PhishNet
Move-Item "C:\Users\...\PhishNet" "C:\PhishNet"
```

### Service Won't Start (NSSM)

**Error:**
```
NSSM service failed to start
```

**Solution:**

1. **Check Service Status:**
```powershell
Get-Service PhishNet
nssm status PhishNet
```

2. **View Service Logs:**
```powershell
nssm get PhishNet AppStdout
nssm get PhishNet AppStderr
```

3. **Reinstall Service:**
```powershell
nssm remove PhishNet confirm
nssm install PhishNet "C:\Program Files\nodejs\node.exe" "C:\PhishNet\dist\index.js"
nssm start PhishNet
```

---

## Linux/macOS-Specific Issues

### systemd Service Won't Start

**Error:**
```
Failed to start phishnet.service
```

**Solution:**

1. **Check Service Status:**
```bash
sudo systemctl status phishnet
```

2. **View Logs:**
```bash
sudo journalctl -u phishnet -n 50 --no-pager
```

3. **Fix Service File:**

Edit `/etc/systemd/system/phishnet.service`:
```ini
[Service]
WorkingDirectory=/path/to/phisnet
ExecStart=/usr/bin/node dist/index.js
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/phisnet/.env
```

4. **Reload and Restart:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart phishnet
```

### Permission Denied Errors

**Error:**
```
EACCES: permission denied
```

**Solution:**

1. **Fix File Permissions:**
```bash
# Make current user owner
sudo chown -R $(whoami):$(whoami) .

# Set proper permissions
chmod -R 755 .
chmod 600 .env  # Protect .env file
```

2. **Fix Port 80/443 Access:**
```bash
# Allow Node to bind to privileged ports
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# Or use port forwarding
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 5000
```

### PostgreSQL Peer Authentication Failed

**Error:**
```
FATAL: Peer authentication failed
```

**Solution:**

Edit `/etc/postgresql/15/main/pg_hba.conf`:
```
# Change from:
local   all   all   peer

# To:
local   all   all   md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

---

## Network Issues

### Cannot Access from Other Devices

**Issue:**
PhishNet only accessible from localhost

**Solution:**

1. **Bind to All Interfaces:**

Edit `.env`:
```env
HOST=0.0.0.0  # Listen on all interfaces
PORT=5000
```

2. **Configure Firewall:**

**Linux (ufw):**
```bash
sudo ufw allow 5000/tcp
sudo ufw reload
```

**Linux (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload
```

**Windows:**
```powershell
New-NetFirewallRule -DisplayName "PhishNet Port 5000" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

**macOS:**
```bash
# Add rule in System Preferences → Security & Privacy → Firewall
```

3. **Check Network Configuration:**
```bash
# Find your IP address
# Linux/macOS:
ip addr show  # or ifconfig

# Windows:
ipconfig

# Access from other device:
http://YOUR_IP:5000
```

### Proxy/Reverse Proxy Issues

**Issue:**
PhishNet behind nginx/Apache not working

**Solution (nginx):**

```nginx
server {
    listen 80;
    server_name phishnet.example.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Solution (Apache):**

```apache
<VirtualHost *:80>
    ServerName phishnet.example.com
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:5000/
    ProxyPassReverse / http://localhost:5000/
</VirtualHost>
```

### SSL/HTTPS Configuration

**Issue:**
Need HTTPS for production

**Solution (with Let's Encrypt):**

```bash
# Install certbot
sudo apt install certbot

# With nginx
sudo certbot --nginx -d phishnet.example.com

# With Apache
sudo certbot --apache -d phishnet.example.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

---

## Diagnostic Commands

### Check System Health

```bash
# Node.js version
node --version

# npm version
npm --version

# PostgreSQL version
psql --version

# Check if PostgreSQL is running
# Linux:
sudo systemctl status postgresql

# Windows:
Get-Service postgresql*

# macOS:
brew services list

# Check disk space
df -h  # Linux/macOS
Get-PSDrive  # Windows

# Check memory
free -h  # Linux
vm_stat  # macOS
systeminfo | findstr /C:"Available Physical Memory"  # Windows
```

### Test Database Connection

```bash
# Direct connection test
psql -h localhost -p 5432 -U phishnet_user -d phishnet -c "SELECT version();"

# Test from Node.js
node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', port: 5432, database: 'phishnet', user: 'phishnet_user', password: 'your_password' }); pool.query('SELECT NOW()', (err, res) => { console.log(err || res.rows); pool.end(); });"
```

### Check Listening Ports

```bash
# Linux/macOS
sudo lsof -i -P -n | grep LISTEN

# Windows
netstat -an | findstr LISTENING
```

### View Application Logs

```bash
# PhishNet logs
tail -f logs/phishnet.log

# With grep filter
tail -f logs/phishnet.log | grep ERROR

# PostgreSQL logs
# Linux:
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Windows:
Get-Content "C:\Program Files\PostgreSQL\15\data\log\*" -Wait

# macOS:
tail -f /usr/local/var/log/postgres.log
```

---

## Still Having Issues?

### Collect Debug Information

Before reporting issues, collect:

1. **System Information:**
```bash
# Linux
uname -a
cat /etc/os-release

# macOS
sw_vers

# Windows
systeminfo
```

2. **Software Versions:**
```bash
node --version
npm --version
psql --version
```

3. **Error Logs:**
```bash
# Last 100 lines
tail -n 100 logs/phishnet.log
```

4. **Environment (sanitized):**
```bash
# Don't share passwords!
cat .env | sed 's/PASSWORD=.*/PASSWORD=***REDACTED***/'
```

### Report an Issue

Create a GitHub issue with:

- **Title**: Brief description of the problem
- **Environment**: OS, Node version, PostgreSQL version
- **Steps to Reproduce**: Exact steps that cause the issue
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Logs**: Relevant error messages (sanitize sensitive data)
- **Screenshots**: If UI-related

### Get Help

- 📖 **Documentation**: Check [INSTALLATION.md](./INSTALLATION.md) and [QUICK-START.md](./QUICK-START.md)
- 🐛 **GitHub Issues**: [Report bugs](https://github.com/your-org/phishnet/issues)
- 💬 **Community**: [GitHub Discussions](https://github.com/your-org/phishnet/discussions)

---

**Last Updated**: 2024
**Version**: 1.0.0

_This troubleshooting guide is regularly updated. If you encounter an issue not covered here, please report it so we can add it!_
