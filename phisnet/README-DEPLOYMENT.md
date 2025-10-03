# 🎣 PhishNet - Advanced Phishing Simulation Platform

![PhishNet Logo](./public/assets/logo.png)

PhishNet is a comprehensive phishing simulation platform designed for cybersecurity training and awareness. It provides organizations with the tools to conduct realistic phishing campaigns, track user responses, and improve security awareness through detailed analytics and reporting.

## 🚀 Quick Start

### Option 1: Manual Deployment (Recommended)

**For Linux/macOS:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**For Windows (PowerShell as Administrator):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\deploy.ps1
```

**For Production:**
```bash
./deploy.sh --production
# or
.\deploy.ps1 -Production
```

### Option 2: Manual Setup

#### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- Git

#### Installation Steps

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd phishnet
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Database Setup**
   ```bash
   # Create PostgreSQL database
   sudo -u postgres psql -c "CREATE DATABASE phishnet_db;"
   sudo -u postgres psql -c "CREATE USER phishnet_user WITH PASSWORD 'secure_password_123';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE phishnet_db TO phishnet_user;"
   
   # Run migrations
   npm run db:migrate
   ```

4. **Start Application**
```bash
npm start
```

## 📁 Project Structure

```
phishnet/
├── client/                 # React frontend
├── server/                 # Node.js backend
│   ├── routes.ts          # API endpoints
│   ├── auth.ts            # Authentication logic
│   ├── storage.ts         # Database operations
│   ├── error-handler.ts   # Runtime error detection & fixing
│   └── services/          # Business logic services
├── shared/                # Shared types and schemas
├── migrations/            # Database migrations
├── uploads/               # File uploads
├── logs/                  # Application logs
├── backups/               # Database backups
├── .env.example          # Environment template
├── deploy.sh             # Linux/macOS deployment script
├── deploy.ps1            # Windows deployment script
└── ecosystem.config.js   # PM2 configuration
```

## 🔧 Features

### Core Functionality
- **Campaign Management**: Create and manage phishing campaigns
- **Email Templates**: Pre-built and custom email templates
- **Landing Pages**: Realistic phishing landing pages
- **Target Management**: Organize targets into groups
- **SMTP Profiles**: Configure email sending settings
- **Real-time Analytics**: Track campaign performance
- **Detailed Reporting**: Export results to CSV/PDF

### Security Features
- **Session Management**: Secure session handling
- **Input Validation**: Comprehensive data validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Content sanitization

### Runtime Error Detection
- **Automatic Error Logging**: Captures and logs all runtime errors
- **Intelligent Error Solutions**: Provides suggested fixes for common issues
- **Error Analytics**: Track error patterns and frequency
- **Debug Dashboard**: Admin interface for error monitoring

## 🛠️ Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://phishnet_user:password@localhost:5432/phishnet_db

<!-- Redis not required; sessions use PostgreSQL store -->

# Security
SESSION_SECRET=your-secure-session-secret-here
JWT_SECRET=your-jwt-secret-here

# SMTP (for sending phishing emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Admin User
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=AdminPassword123!
```

### Database Configuration

PhishNet uses PostgreSQL with Drizzle ORM. The database schema includes:

- **Users**: Application users and admin accounts
- **Campaigns**: Phishing campaign configurations
- **Email Templates**: HTML/text email templates
- **Landing Pages**: Phishing landing page content
- **Targets & Groups**: Target user management
- **Results**: Campaign tracking and analytics

## 📊 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/register` - User registration

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Templates
- `GET /api/email-templates` - List email templates
- `POST /api/email-templates` - Create template
- `PUT /api/email-templates/:id` - Update template

### Analytics
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/metrics` - Campaign metrics
- `GET /api/reports/data` - Detailed reports

### Debug (Admin Only)
- `GET /api/debug/errors` - Error statistics
- `DELETE /api/debug/errors` - Clear error history

## 🚀 Deployment Options

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:migrate   # Run database migrations
npm run test         # Run tests
```

### Production with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

<!-- legacy container deployment removed -->

### Systemd Service (Linux)
```bash
sudo systemctl start phishnet
sudo systemctl enable phishnet
```

## 🔒 Security Considerations

### For Production Deployment:

1. **Change Default Passwords**: Update all default passwords in `.env`
2. **Enable HTTPS**: Use SSL certificates (Let's Encrypt recommended)
3. **Configure Firewall**: Restrict access to necessary ports only
4. **Regular Backups**: Use the included backup script
5. **Monitor Logs**: Check application and error logs regularly
6. **Update Dependencies**: Keep all packages up to date

### SMTP Configuration:

For Gmail:
1. Enable 2-Factor Authentication
2. Generate an App Password
3. Use App Password in `SMTP_PASS`

For Office 365:
1. Create an App Registration
2. Configure SMTP authentication
3. Use OAuth2 or basic authentication

## 📈 Monitoring & Maintenance

### Error Monitoring
PhishNet includes built-in error detection and monitoring:

```bash
# View error statistics
curl http://localhost:3000/api/debug/errors

# Clear error history
curl -X DELETE http://localhost:3000/api/debug/errors
```

### Log Management
```bash
# View application logs
tail -f logs/combined.log

# View error logs  
tail -f logs/err.log

# Rotate logs
logrotate /etc/logrotate.d/phishnet
```

### Backup & Restore
```bash
# Create backup
./backup.sh

# Restore from backup
psql -U phishnet_user -d phishnet_db < backups/db_backup_20240125_143022.sql
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📋 Troubleshooting

### Common Issues:

**Database Connection Error:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U phishnet_user -d phishnet_db -h localhost
```

<!-- Redis troubleshooting removed: not applicable -->

**Port Already in Use:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <process_id>
```

**TypeScript Compilation Errors:**
The application includes automatic error detection and fixing. Check logs for suggested solutions.

**Permission Errors:**
```bash
# Fix file permissions
chmod -R 755 logs uploads backups
chown -R $USER:$USER logs uploads backups
```

### Getting Help

1. **Check Logs**: Look at `logs/err.log` for detailed error information
2. **Error Dashboard**: Access `/api/debug/errors` for error analytics
3. **Documentation**: Review this README and code comments
4. **Debug Mode**: Set `DEBUG=true` in `.env` for verbose logging

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **Demo**: [https://demo.phishnet.com](https://demo.phishnet.com)
- **Documentation**: [https://docs.phishnet.com](https://docs.phishnet.com)
- **Issues**: [https://github.com/yourusername/phishnet/issues](https://github.com/yourusername/phishnet/issues)

---

**⚠️ Important**: This tool is intended for authorized security testing and training purposes only. Ensure you have proper authorization before conducting any phishing simulations.

**🛡️ Security**: Always follow responsible disclosure practices and comply with local laws and regulations regarding cybersecurity testing.
