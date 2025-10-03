# 🎁 Quick Setup Guide for Your Friend
## PhishNet Package Deployment

### 📦 What You're Getting
- Complete PhishNet phishing simulation platform
- All campaigns, templates, and data from the original setup
- Database backup with existing users and results
- Automated setup scripts for easy deployment

---

## 🚀 Super Quick Setup (Choose One Method)

### Method 1: Windows (Easiest)

1. **Extract the package** to `C:\PhishNet\`
2. **Open PowerShell as Administrator** (Right-click → "Run as Administrator")
3. **Navigate to the folder:**
   ```powershell
   cd C:\PhishNet\phishnet
   ```
4. **Run the deployment:**
   ```powershell
   .\deploy.ps1
   ```
5. **Start PhishNet:**
   ```powershell
   .\start.ps1
   ```

### Method 2: Linux/macOS

1. **Extract the package** and navigate:
   ```bash
   unzip PhishNet-Package-*.zip
   cd PhishNet-Package-*/
   ```
2. **Run automated setup:**
   ```bash
   chmod +x setup-from-package.sh
   ./setup-from-package.sh
   ```

<!-- legacy container method removed -->

---

## 🌐 Access PhishNet

Once setup is complete, open your web browser and go to:

**URL:** http://localhost:3000

**Login Credentials:**
- **Email:** admin@phishnet.local  
- **Password:** admin123

---

## ✅ What You'll Have Access To

- **Dashboard:** Overview of all phishing campaigns
- **Campaigns:** All existing campaigns and their results
- **Templates:** All email templates that were created
- **Users:** All user accounts and their training progress
- **Reports:** Detailed analytics and reporting
- **Settings:** Full administrative control

---

## 🔧 If Something Goes Wrong

### Windows Issues:
```powershell
# If PowerShell policy error:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# If port 3000 is busy:
netstat -ano | findstr :3000
# Kill the process using that port

# Restart services:
.\deploy.ps1
```

### Linux/macOS Issues:
```bash
# Make scripts executable:
chmod +x *.sh

# Restart deployment:
./deploy.sh

# Check if services are running:
sudo systemctl status postgresql
```

### Universal Troubleshooting:
1. **Check your internet connection** (needed for downloading dependencies)
2. **Run as Administrator/sudo** (needed for installing software)
3. **Wait 2-3 minutes** after deployment before starting
4. **Restart your computer** if services don't start

---

## 🧪 Test Everything Works

After setup, try these to confirm everything is working:

1. ✅ **Login** with admin credentials
2. ✅ **View Dashboard** - should show existing data
3. ✅ **Check Campaigns** - should see previous campaigns
4. ✅ **View Templates** - should see all email templates
5. ✅ **Send a test email** - try the email functionality

---

## 🔒 Important Security Notes

1. **Change the admin password** after first login
2. **Update the admin email** to your own
3. **Review existing user accounts** - delete or modify as needed
4. **This contains all original data** - campaigns, results, user information

---

## 📞 Need Help?

If you run into issues:

1. **Check the setup logs** - look for error messages
2. **Try running the deployment again** - many issues resolve automatically
3. **Contact the person who sent you this package** - they can help troubleshoot
4. **Check the documentation** in the `docs/` folder

---

## 🎯 Quick Reference

| Task | Windows Command | Linux/Mac Command |
|------|----------------|-------------------|
| Deploy | `.\deploy.ps1` | `./deploy.sh` |
| Start | `.\start.ps1` | `./start.sh` |
| Test | `.\test-deployment.ps1` | `./deploy.sh --help` |
| (legacy) | (removed) | (removed) |

**🎉 That's it! You should now have a fully working PhishNet installation with all the original data and settings.**
