# 📦 PhishNet Dependencies

## ✅ **All Dependencies Are Included in Deployment Scripts**

### 🖥️ **System Dependencies (Auto-Installed)**

#### **Linux (apt/yum/pacman):**
- **Node.js 20 LTS** - JavaScript runtime
- **npm** - Package manager  
- **PostgreSQL** - Database server
- **Git** - Version control
- **Curl/Wget** - HTTP tools
- **Build Tools** - For native modules (build-essential, python3-dev, etc.)
- **SSL Tools** - Security certificates

#### **macOS (Homebrew):**
- **Node.js** - Latest stable
- **PostgreSQL** - Database server
- **Git** - Version control
- **Curl/Wget** - HTTP tools

#### **Windows (Chocolatey/Winget):**
- **Node.js 20** - JavaScript runtime
- **PostgreSQL** - Database server
- **Git** - Version control
- **Visual Studio Build Tools** - For native modules
- **Curl/Wget** - HTTP tools

### 📚 **Node.js Dependencies (Auto-Installed via npm)**

#### **Production Dependencies:**
- **Express** - Web framework
- **PostgreSQL drivers** - Database connectivity
- **Authentication** - Passport, bcrypt, JWT
- **UI Components** - Radix UI, Tailwind CSS
- **File handling** - Multer, file uploads
- **Email** - Nodemailer, SendGrid
- **Security** - CORS, helmet, validation

#### **Development Dependencies:**
- **TypeScript** - Type safety
- **Vite** - Build tool
- **ESBuild** - Fast bundling
- **Drizzle** - Database ORM
- **Testing** - Playwright
- **Cross-env** - Environment variables

### 🔧 **Build Tools (Auto-Installed)**

#### **Linux:**
- **build-essential** - GCC, make, etc.
- **python3-dev** - Python headers
- **libpq-dev** - PostgreSQL development headers

#### **Windows:**
- **Visual Studio Build Tools** - MSVC compiler
- **Windows SDK** - Development headers

#### **macOS:**
- **Xcode Command Line Tools** - Apple's compiler toolchain

### ⚙️ **Services (Auto-Configured)**

- **PostgreSQL Database** - Automatically created
- **Environment Variables** - Auto-generated from `.env.example`
- **Database Schema** - Auto-created with sample data
- **SSL Certificates** - Ready for HTTPS setup

### 🚀 **Verification Scripts**

- **`check-deps.sh`** - Verify all dependencies are installed
- **`start-dev.sh`** - Start development server
- **`start-prod.sh`** - Start production server
- **`reset-db.sh`** - Reset database if needed

## 🎯 **Zero Manual Installation Required**

The deployment scripts handle:
- ✅ **Version checking** (ensures Node.js 18+)
- ✅ **Package manager detection** (apt/yum/brew/choco)
- ✅ **Service configuration** (PostgreSQL)
- ✅ **Database setup** (schema + sample data)
- ✅ **Build tool installation** (native module support)
- ✅ **Security hardening** (SSL, secrets generation)
- ✅ **Cross-platform compatibility** (Linux/macOS/Windows)

## 💡 **If Dependencies Are Missing**

Run the verification script:
```bash
./check-deps.sh
```

If issues are found, re-run deployment:
```bash
./deploy.sh
```

All dependencies are automatically handled - no manual installation needed! 🎉
