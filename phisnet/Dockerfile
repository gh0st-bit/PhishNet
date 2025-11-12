# ===============================================
# PhishNet Dockerfile
# Version: 1.0
# Created: July 25, 2025
# Description: Multi-stage Docker build for PhishNet
# ===============================================

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies (use npm install instead of npm ci for flexibility)
RUN npm install --production --ignore-scripts || npm install --ignore-scripts

# Copy source code
COPY . .

# Build client
WORKDIR /app/client
RUN npm run build

# Build server
WORKDIR /app/server
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S phishnet -u 1001

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    postgresql-client \
    redis

# Copy built application
COPY --from=builder --chown=phishnet:nodejs /app/package*.json ./
COPY --from=builder --chown=phishnet:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=phishnet:nodejs /app/server/dist ./server/dist
COPY --from=builder --chown=phishnet:nodejs /app/client/dist ./client/dist
COPY --from=builder --chown=phishnet:nodejs /app/shared ./shared

# Copy necessary files
COPY --chown=phishnet:nodejs uploads ./uploads
COPY --chown=phishnet:nodejs scripts/health-check.js ./
COPY --chown=phishnet:nodejs scripts/docker-entrypoint.sh ./

# Make scripts executable
RUN chmod +x docker-entrypoint.sh

# Create directories
RUN mkdir -p /app/logs /app/uploads/images /app/uploads/attachments /app/uploads/temp && \
    chown -R phishnet:nodejs /app/logs /app/uploads

# Switch to non-root user
USER phishnet

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node health-check.js

# Start application
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]

# Development stage for Codespaces
FROM node:18-alpine AS development

# Set working directory
WORKDIR /workspaces/PhishNet

# Install development dependencies
RUN apk add --no-cache \
    curl \
    git \
    postgresql-client \
    redis \
    bash \
    vim

# Install global development tools
RUN npm install -g nodemon tsx

# Create non-root user for development
RUN addgroup -g 1001 -S nodejs
RUN adduser -S devuser -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Create necessary directories
RUN mkdir -p /workspaces/PhishNet/uploads /workspaces/PhishNet/logs && \
    chown -R devuser:nodejs /workspaces/PhishNet

# Switch to development user
USER devuser

# Expose development ports
EXPOSE 3001 5432 6379

# Default command for development
CMD ["npm", "run", "dev"]
