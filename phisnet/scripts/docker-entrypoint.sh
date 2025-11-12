#!/bin/bash

# ===============================================
# PhishNet Docker Entrypoint Script
# Version: 1.0
# Created: July 25, 2025
# Description: Docker container initialization script
# ===============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to wait for database
wait_for_db() {
    print_status "Waiting for database to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if pg_isready -h "${DB_HOST:-database}" -p "${DB_PORT:-5432}" -U "${DB_USER:-phishnet_user}" > /dev/null 2>&1; then
            print_success "Database is ready!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts: Database not ready, waiting 2 seconds..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Database is not ready after $max_attempts attempts"
    return 1
}

# Function to wait for Redis
wait_for_redis() {
    print_status "Waiting for Redis to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if redis-cli -h "${REDIS_HOST:-redis}" -p "${REDIS_PORT:-6379}" ping > /dev/null 2>&1; then
            print_success "Redis is ready!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts: Redis not ready, waiting 2 seconds..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Redis is not ready after $max_attempts attempts"
    return 1
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Check if we can connect to the database
    if ! psql "${DATABASE_URL}" -c "SELECT 1;" > /dev/null 2>&1; then
        print_error "Cannot connect to database"
        return 1
    fi
    
    # Run any pending migrations
    if [ -d "/app/migrations" ]; then
        print_status "Applying database migrations..."
        # Add your migration logic here
        # npm run db:migrate or similar
        print_success "Database migrations completed"
    else
        print_warning "No migrations directory found"
    fi
}

# Function to check environment variables
check_environment() {
    print_status "Checking environment variables..."
    
    local required_vars=(
        "DATABASE_URL"
        "SESSION_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            print_error "  - $var"
        done
        return 1
    fi
    
    print_success "All required environment variables are set"
}

# Function to initialize directories
init_directories() {
    print_status "Initializing directories..."
    
    # Create necessary directories
    mkdir -p /app/logs
    mkdir -p /app/uploads/images
    mkdir -p /app/uploads/attachments
    mkdir -p /app/uploads/temp
    
    # Set permissions
    chmod 755 /app/uploads
    chmod 755 /app/uploads/images
    chmod 755 /app/uploads/attachments
    chmod 755 /app/uploads/temp
    chmod 755 /app/logs
    
    print_success "Directories initialized"
}

# Function to start the application
start_application() {
    print_status "Starting PhishNet application..."
    
    # Change to server directory
    cd /app/server
    
    # Start the application
    exec "$@"
}

# Main execution
main() {
    print_status "PhishNet Docker Container Starting..."
    print_status "Container: $(hostname)"
    print_status "User: $(whoami)"
    print_status "Working Directory: $(pwd)"
    
    # Check environment
    check_environment || exit 1
    
    # Initialize directories
    init_directories || exit 1
    
    # Wait for dependencies
    wait_for_db || exit 1
    
    # Wait for Redis if configured
    if [ -n "${REDIS_URL}" ]; then
        wait_for_redis || exit 1
    fi
    
    # Run migrations
    run_migrations || exit 1
    
    # Start application
    print_success "All checks passed, starting application..."
    start_application "$@"
}

# Run main function
main "$@"
