# 🔐 PhishNet Development Workflow (Unified)

## 🎯 Overview

PhishNet uses a simple, unified development workflow. All contributors work from the same repository and standard scripts, without workspace segmentation.

## 🏗️ Architecture & Access Control

### Module Structure
```
phishnet/
├── client/          # React Application
├── server/          # Node.js API
├── 🗄️  migrations/      # Database Schema Changes
├── 🔄 shared/          # Cross-module Types & Schemas
├── 📚 docs/            # Documentation
└── 🧪 tests/          # Testing Infrastructure
```

Access is managed via standard GitHub repository permissions and reviews.

## 🌿 Branching Strategy

### Branch Types

```
main (Production)
├── Protected: Requires admin approval
├── Auto-deploy: Production environment
└── Access: Admin approval only

develop (Integration)
├── Protected: Requires admin approval  
├── Auto-deploy: Staging environment
└── Access: All users (with restrictions)

feature/* (Development)
├── Open: Module-specific restrictions
├── Testing: Module CI pipelines
└── Access: Based on module ownership

hotfix/* (Emergency)
├── Emergency: Admin override allowed
├── Fast-track: Reduced approval requirements
└── Access: Admin + Senior developers
```

### Branch Naming Convention

```bash
# Features
feature/campaign-dashboard
feature/user-management-ui
feature/ui/responsive-design
feature/email-service
feature/auth-middleware
feature/api-campaign-endpoints
feature/performance-optimization
feature/audit-logging
feature/api-contracts
feature/type-definitions
hotfix/session-vulnerability
hotfix/database-connection
release/v2.1.0
```

## 🔐 Zero Trust Principles

### 1. **Principle of Least Privilege**
- Developers only access modules they work on
- No blanket repository access
- Time-limited access for integration work

### 2. **Mandatory Peer Review**
- All changes require admin approval
- Security-sensitive code requires admin review

### 3. **Continuous Verification**
- Every commit triggers security scans

### 4. **Audit Everything**
- All access attempts logged
- Change tracking with detailed attribution
- Security events monitored and alerted

## � Manual Security Process

### Security Practices

1. **Pre-commit Practices**
   - Manual secret detection review
   - Code formatting checks
   - Basic lint checks with npm scripts

2. **Code Review Process**
   - Manual access control verification
   - File permission checks
   - Branch protection through GitHub settings

3. **Security Validation**
   - Manual dependency vulnerability scanning with `npm audit`
   - Static code analysis with local tools
   - License compliance checking

4. **Integration Security**
   - API contract validation
   - Manual testing of unified workflow
   - Cross-module security verification

5. **Deployment Security**
   - Manual environment validation
   - Manual deployment approval process
   - Manual rollback capability

## Collaboration

### Example Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-dashboard

# 2. Work only in allowed directories
# ✅ Allowed: client/, shared/types/
# ❌ Forbidden: server/, migrations/

# 3. Commit changes
git add client/src/pages/dashboard/
git commit -m "feat: add campaign dashboard"

# 4. Push and create PR
git push origin feature/new-dashboard

# 5. Request review from admin
# Auto-assigned via CODEOWNERS
```

### Example Backend Workflow

```bash
# 1. Create feature branch
git checkout -b feature/backend/email-service

# 2. Work only in allowed directories  
# ✅ Allowed: server/, shared/schema.ts, shared/types/
# ❌ Forbidden: client/ (except for API contracts)

# 3. Implement with security focus
# - Validate data isolation
# - Implement proper input validation
# - Add comprehensive logging

# 4. Cross-module integration
# For API changes:
# - Update shared/types/ for TypeScript contracts
# - Coordinate with admin for integration
# - Request admin review for API contracts
```

### Database Changes

```bash
# 1. Create migration branch
git checkout -b feature/database/audit-logging

# 2. Work in allowed directories
# ✅ Allowed: migrations/, shared/schema.ts
# ❌ Forbidden: client/, server/ implementation

# 3. Create migration with security focus
# - Add proper indexes for performance
# - Include rollback procedures

# 4. Schema updates
# Update shared/schema.ts
# Coordinate with admin for implementation
```

## 🔧 Development Environment Setup

### Developer Environment

```bash
# 1. Clone with limited scope (if possible)
git clone --filter=blob:none https://github.com/gh0st-bit/PhishNet.git

# 2. Setup module-specific environment
cd PhishNet/phisnet

# Developers
cd client && npm install
npm run dev  # Start development server
cd server && npm install
npm run dev  # Start development server
npm run dev:all  # Full environment (requires approval)
```

### Access Request Process (optional)

```bash
# Request additional module access
git checkout -b access-request/backend-integration
echo "Requesting backend access for API integration" > ACCESS_REQUEST.md
git add ACCESS_REQUEST.md
git commit -m "request: temporary backend access for API integration"
git push origin access-request/backend-integration

# Create PR with justification
# Admin reviews and grants temporary access
# Access automatically revoked after merge
```

## 🚨 Security Incident Response

### Access Violation Detection

```bash
# Manual monitoring for:
# 1. Unauthorized file modifications
# 2. Cross-module access without approval
# 3. Security-sensitive code changes without security review
# 4. Direct pushes to protected branches

# Incident response:
# 1. Manual access revocation
# 2. Manual change rollback if necessary  
# 3. Admin investigation
# 4. Process improvement recommendations
```

### Emergency Procedures

```bash
# Critical security hotfix
git checkout -b hotfix/security/critical-vulnerability

# Manual emergency override process:
# 1. Admin approval required
# 2. Immediate admin notification
# 3. Expedited review process
# 4. Post-incident analysis mandatory
```

## 📊 Monitoring & Metrics

### Access Control Metrics
- Permission violations per week
- Cross-module access requests
- Security scan failure rates
- Deployment success rates by module

### Security Metrics
- Vulnerability detection time
- Time to patch critical issues
- Unified workflow test results
- Failed access attempts

### Performance Metrics
- Module build times
- Integration test execution time
- Deployment pipeline duration
- Code review turnaround time

## 🎓 Training & Onboarding

### New Developer Onboarding

1. **Security Training**
   - Zero Trust principles
   - PhishNet-specific security requirements
   - Unified workflow best practices

2. **Module-Specific Training**
   - Assigned module architecture
   - Development workflow
   - Testing requirements

3. **Integration Training**
   - Cross-module communication patterns
   - API contract management
   - Security considerations

### Ongoing Education

- Monthly security updates
- Quarterly architecture reviews
- Annual Zero Trust policy updates

## 🔄 Continuous Improvement

### Process Evolution
- Regular access control audits
- Developer feedback integration
- Security threat model updates
- Performance optimization

### Tool Improvements
- Enhanced automation
- Better access control granularity
- Improved monitoring capabilities
- Streamlined approval workflows

---

**📧 Questions or Issues?**
- Security concerns: admin@phishnet.dev
- Access requests: admin@phishnet.dev  
- Process improvements: devops@phishnet.dev

**🔒 Remember: Zero Trust means verify everything, trust nothing!**
