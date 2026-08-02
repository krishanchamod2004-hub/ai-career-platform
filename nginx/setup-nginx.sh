#!/bin/bash
# =============================================================================
# Nginx Installation and Configuration Script
# =============================================================================
# This script installs Nginx, configures it for the AI Career Platform,
# and prepares it for SSL setup.
#
# Prerequisites:
# - Ubuntu/Debian server
# - Root or sudo access
# - Domain DNS configured to point to server IP
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-yourdomain.com}"
API_DOMAIN="${API_DOMAIN:-api.yourdomain.com}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Nginx Installation and Configuration${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root or with sudo"
    exit 1
fi

# Update package list
print_info "Updating package list..."
apt-get update

# Install Nginx if not already installed
if ! command -v nginx &> /dev/null; then
    print_info "Installing Nginx..."
    apt-get install -y nginx
else
    print_info "Nginx is already installed"
fi

# Stop Nginx for configuration
print_info "Stopping Nginx..."
systemctl stop nginx

# Backup default configuration
print_info "Backing up default Nginx configuration..."
if [ -f /etc/nginx/nginx.conf ]; then
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
fi

# Remove default site
print_info "Removing default site..."
rm -f /etc/nginx/sites-enabled/default

# Replace placeholders in configuration files
print_info "Configuring Nginx for domains..."
sed -i "s/yourdomain\.com/$DOMAIN/g" "$PROJECT_DIR/nginx/ai-career-web.conf"
sed -i "s/api\.yourdomain\.com/$API_DOMAIN/g" "$PROJECT_DIR/nginx/ai-career-api.conf"

# Copy configuration files
print_info "Copying configuration files..."
cp "$PROJECT_DIR/nginx/ai-career-web.conf" /etc/nginx/sites-available/ai-career-web
cp "$PROJECT_DIR/nginx/ai-career-api.conf" /etc/nginx/sites-available/ai-career-api

# Comment out SSL directives for initial setup (before certificates exist)
print_info "Preparing configurations for initial setup (without SSL)..."
sed -i '/ssl_certificate/s/^/#/' /etc/nginx/sites-available/ai-career-web
sed -i '/ssl_certificate_key/s/^/#/' /etc/nginx/sites-available/ai-career-web
sed -i '/ssl_trusted_certificate/s/^/#/' /etc/nginx/sites-available/ai-career-web
sed -i '/ssl_dhparam/s/^/#/' /etc/nginx/sites-available/ai-career-web

sed -i '/ssl_certificate/s/^/#/' /etc/nginx/sites-available/ai-career-api
sed -i '/ssl_certificate_key/s/^/#/' /etc/nginx/sites-available/ai-career-api
sed -i '/ssl_trusted_certificate/s/^/#/' /etc/nginx/sites-available/ai-career-api
sed -i '/ssl_dhparam/s/^/#/' /etc/nginx/sites-available/ai-career-api

# Create symlinks
print_info "Enabling sites..."
ln -sf /etc/nginx/sites-available/ai-career-web /etc/nginx/sites-enabled/ai-career-web
ln -sf /etc/nginx/sites-available/ai-career-api /etc/nginx/sites-enabled/ai-career-api

# Create certbot directory
print_info "Creating certbot directory..."
mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot

# Optimize Nginx configuration
print_info "Optimizing Nginx configuration..."
cat > /etc/nginx/conf.d/optimization.conf << 'EOF'
# Worker processes
worker_processes auto;
worker_rlimit_nofile 65535;

# Events
events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

# HTTP optimization
http {
    # Hide Nginx version
    server_tokens off;

    # Optimize file handling
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    
    # Timeouts
    keepalive_timeout 65;
    keepalive_requests 100;
    client_body_timeout 12;
    client_header_timeout 12;
    send_timeout 10;
    
    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;
    
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
    
    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
    limit_conn conn_limit 10;
}
EOF

# Test Nginx configuration
print_info "Testing Nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    print_error "Nginx configuration test failed. Please check the errors above."
    exit 1
fi

# Start Nginx
print_info "Starting Nginx..."
systemctl start nginx
systemctl enable nginx

# Configure firewall
print_info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 'Nginx Full'
    ufw allow ssh
    print_info "Firewall configured (UFW)"
else
    print_warn "UFW not found. Please configure firewall manually to allow ports 80 and 443"
fi

# Check Nginx status
print_info "Checking Nginx status..."
systemctl status nginx --no-pager

echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Nginx Installation Complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${GREEN}Configuration:${NC}"
echo -e "  - Frontend: $DOMAIN"
echo -e "  - API: $API_DOMAIN"
echo ""
echo -e "${GREEN}Configuration files:${NC}"
echo -e "  - /etc/nginx/sites-available/ai-career-web"
echo -e "  - /etc/nginx/sites-available/ai-career-api"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "  1. Ensure Docker containers are running:"
echo -e "     docker compose -f docker-compose.prod.yml ps"
echo -e "  2. Test HTTP access (should show content):"
echo -e "     curl http://$DOMAIN"
echo -e "     curl http://$API_DOMAIN/api/health"
echo -e "  3. Setup SSL certificates:"
echo -e "     cd nginx && sudo bash setup-ssl.sh"
echo -e "  4. Uncomment SSL directives in Nginx configs after SSL setup"
echo -e "  5. Reload Nginx: sudo systemctl reload nginx"
echo ""
print_warn "Remember to update the .env file with your actual domain names before building Docker images!"
echo ""
