# 📚 PhishNet Development Documentation

## 🎯 Overview
This document provides information about the PhishNet cybersecurity platform development setup and processes.

---

## 🔥 Development Workflow

PhishNet uses a simplified development approach without automated CI/CD pipelines. All testing, building, and deployment is handled manually using npm scripts.
## 🔒 Manual Development Process

### Local Development
- All code changes are tested locally before committing
- Security scanning can be run manually via npm scripts
- Build processes use standard npm commands
- Database migrations are applied manually

## 🚀 Deployment Process

All deployments are handled manually:
- Build the application using `npm run build`
- Test the build locally before deployment
- Deploy using manual processes appropriate for your environment

## 🔒 Security Notes

- Security scans can be run locally via npm scripts  
- Code quality checks should be performed before commits
- All changes should be reviewed before merging to main branch

## 🧹 Simplified Approach

This project uses a streamlined development approach:
- No automated CI/CD pipelines
- Manual testing and deployment processes
- Focus on core functionality rather than automation overhead---

*Last Updated: October 2025*
*Status: Manual development workflow - no automated CI/CD*
