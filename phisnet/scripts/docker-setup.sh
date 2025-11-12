#!/bin/bash

# ===============================================
# PhishNet Docker Setup Script
# Version: 1.0
# Created: July 25, 2025
# Description: Complete Docker deployment setup for PhishNet
# ===============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="phishnet"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Function to print colored output
print_header() {
    echo ""
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo ""
}

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Docker installation
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not installed or available."
        echo "Please install Docker Compose or use a newer version of Docker with compose plugin."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is installed and running"
    print_status "Docker version: $(docker --version)"
    
    if command_exists docker-compose; then
        print_status "Docker Compose version: $(docker-compose --version)"
    else
        print_status "Docker Compose plugin: $(docker compose version)"
    fi
}

# Function to create environment file
create_env_file() {
    print_status "Creating environment configuration..."
    
    local env_file="$PROJECT_ROOT/.env"
    
    if [ -f "$env_file" ]; then
        print_warning "Environment file already exists."
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Using existing environment file"
            return 0
        fi
    fi
    
    # Copy Docker environment template
    if [ -f "$PROJECT_ROOT/.env.docker" ]; then
        cp "$PROJECT_ROOT/.env.docker" "$env_file"
        print_success "Environment file created from template"
    else
        print_error "Environment template not found at .env.docker"
        exit 1
    fi
    
    # Generate random secrets
    print_status "Generating secure secrets..."
    
    local session_secret=$(openssl rand -base64 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
    local db_password=$(openssl rand -base64 16 2>/dev/null || date +%s | sha256sum | base64 | head -c 16)
    local redis_password=$(openssl rand -base64 16 2>/dev/null || date +%s | sha256sum | base64 | head -c 16)
    
    # Update environment file with generated secrets
    sed -i.bak "s/your-very-long-random-session-secret-change-this-in-production-2025/$session_secret/g" "$env_file"
    sed -i.bak "s/phishnet_secure_password_2025/$db_password/g" "$env_file"
    sed -i.bak "s/phishnet_redis_password_2025/$redis_password/g" "$env_file"
    
    # Remove backup file
    rm -f "$env_file.bak"
    
    print_success "Secure secrets generated and configured"
}

# Function to build Docker images
build_images() {
    print_status "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    if command_exists docker-compose; then
        docker-compose build --no-cache
    else
        docker compose build --no-cache
    fi
    
    print_success "Docker images built successfully"
}

# Function to start services
start_services() {
    print_status "Starting PhishNet services..."
    
    cd "$PROJECT_ROOT"
    
    if command_exists docker-compose; then
        docker-compose up -d
    else
        docker compose up -d
    fi
    
    print_success "Services started successfully"
}

# Function to check service health
check_services() {
    print_status "Checking service health..."
    
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for services to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        local healthy_services=0
        local total_services=0
        
        if command_exists docker-compose; then
            # Count healthy services
            while IFS= read -r line; do
                total_services=$((total_services + 1))
                if echo "$line" | grep -q "healthy"; then
                    healthy_services=$((healthy_services + 1))
                fi
            done < <(docker-compose ps --services | xargs -I {} docker-compose ps {})
        else
            # For newer Docker Compose plugin
            while IFS= read -r line; do
                total_services=$((total_services + 1))
                if echo "$line" | grep -q "healthy"; then
                    healthy_services=$((healthy_services + 1))
                fi
            done < <(docker compose ps --format "table {{.Name}}\t{{.Status}}" | grep -v "NAME")
        fi
        
        if [ $healthy_services -eq $total_services ] && [ $total_services -gt 0 ]; then
            print_success "All services are healthy!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts: $healthy_services/$total_services services healthy, waiting 10 seconds..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    print_warning "Some services may not be fully healthy yet. Check logs if needed."
}

# Function to show service status
show_status() {
    print_header "Service Status"
    
    cd "$PROJECT_ROOT"
    
    if command_exists docker-compose; then
        docker-compose ps
    else
        docker compose ps
    fi
}

# Function to show access information
show_access_info() {
    print_header "Access Information"
    
    echo -e "${CYAN}PhishNet Application:${NC}"
    echo "  • URL: http://localhost"
    echo "  • Admin Panel: http://localhost/admin"
    echo ""
    
    echo -e "${CYAN}Database Access:${NC}"
    echo "  • Host: localhost"
    echo "  • Port: 5432"
    echo "  • Database: phishnet"
    echo "  • Username: phishnet_user"
    echo "  • Password: (check .env file)"
    echo ""
    
    echo -e "${CYAN}Redis Access:${NC}"
    echo "  • Host: localhost"
    echo "  • Port: 6379"
    echo "  • Password: (check .env file)"
    echo ""
    
    echo -e "${CYAN}Default Admin Account:${NC}"
    echo "  • Email: admin@phishnet.local"
    echo "  • Password: admin123"
    echo "  • Organization: PhishNet Admin"
    echo ""
    
    echo -e "${YELLOW}Note: Please change the default admin password after first login!${NC}"
}

# Function to show useful commands
show_commands() {
    print_header "Useful Commands"
    
    echo -e "${CYAN}Start services:${NC}"
    if command_exists docker-compose; then
        echo "  docker-compose up -d"
    else
        echo "  docker compose up -d"
    fi
    echo ""
    
    echo -e "${CYAN}Stop services:${NC}"
    if command_exists docker-compose; then
        echo "  docker-compose down"
    else
        echo "  docker compose down"
    fi
    echo ""
    
    echo -e "${CYAN}View logs:${NC}"
    if command_exists docker-compose; then
        echo "  docker-compose logs -f [service-name]"
    else
        echo "  docker compose logs -f [service-name]"
    fi
    echo ""
    
    echo -e "${CYAN}Restart services:${NC}"
    if command_exists docker-compose; then
        echo "  docker-compose restart"
    else
        echo "  docker compose restart"
    fi
    echo ""
    
    echo -e "${CYAN}Update application:${NC}"
    if command_exists docker-compose; then
        echo "  docker-compose pull && docker-compose up -d"
    else
        echo "  docker compose pull && docker compose up -d"
    fi
}

# Function to cleanup on failure
cleanup_on_failure() {
    print_error "Setup failed. Cleaning up..."
    
    cd "$PROJECT_ROOT"
    
    if command_exists docker-compose; then
        docker-compose down --volumes 2>/dev/null || true
    else
        docker compose down --volumes 2>/dev/null || true
    fi
}

# Main setup function
main() {
    print_header "PhishNet Docker Setup"
    
    echo -e "${CYAN}This script will set up PhishNet using Docker containers.${NC}"
    echo -e "${CYAN}The following services will be deployed:${NC}"
    echo "  • PostgreSQL Database"
    echo "  • Redis Cache"
    echo "  • PhishNet Application"
    echo "  • Nginx Reverse Proxy"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_error "docker-compose.yml not found in $PROJECT_ROOT"
        print_error "Please run this script from the PhishNet project directory"
        exit 1
    fi
    
    # Check Docker installation
    check_docker
    
    # Create environment file
    create_env_file
    
    # Build and start services
    print_header "Building and Starting Services"
    
    # Set trap for cleanup on failure
    trap cleanup_on_failure ERR
    
    build_images
    start_services
    check_services
    
    # Show status and access information
    show_status
    show_access_info
    show_commands
    
    print_header "Setup Complete!"
    print_success "PhishNet has been successfully deployed with Docker!"
    print_status "You can now access the application at http://localhost"
}

# Run main function
main "$@"
