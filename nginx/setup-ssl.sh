#!/bin/bash
# =============================================================================
# SSL Certificate Setup with Let's Encrypt Certbot
# =============================================================================
# This script sets up SSL certificates for the AI Career Platform domains
# using Let's Encrypt and Certbot.
#
# Prerequisites:
# - Nginx installed and running
# - Domains pointing to this server's IP address
# - Ports 80 and 443 open in firewall
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
EMAIL="${EMAIL:-admin@yourdomain.com}"
CERTBOT_DIR="/var/www/certbot"

echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}SSL Certificate Setup for AI Career Platform${NC}"
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

# Install Certbot if not already installed
if ! command -v certbot &> /dev/null; then
    print_info "Installing Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Create certbot directory
print_info "Creating certbot directory..."
mkdir -p "$CERTBOT_DIR"
chown -R www-data:www-data "$CERTBOT_DIR"

# Generate Diffie-Hellman parameters if they don't exist
if [ ! -f /etc/nginx/dhparam.pem ]; then
    print_info "Generating Diffie-Hellman parameters (this may take a few minutes)..."
    openssl dhparam -out /etc/nginx/dhparam.pem 2048
fi

# Test Nginx configuration
print_info "Testing Nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    print_error "Nginx configuration test failed. Please fix the errors and try again."
    exit 1
fi

# Obtain SSL certificate for main domain
print_info "Obtaining SSL certificate for $DOMAIN and www.$DOMAIN..."
certbot certonly \
    --nginx \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$DOMAIN,www.$DOMAIN" \
    --webroot \
    --webroot-path "$CERTBOT_DIR"

if [ $? -ne 0 ]; then
    print_error "Failed to obtain certificate for $DOMAIN"
    exit 1
fi

# Obtain SSL certificate for API subdomain
print_info "Obtaining SSL certificate for $API_DOMAIN..."
certbot certonly \
    --nginx \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$API_DOMAIN" \
    --webroot \
    --webroot-path "$CERTBOT_DIR"

if [ $? -ne 0 ]; then
    print_error "Failed to obtain certificate for $API_DOMAIN"
    exit 1
fi

# Test Nginx configuration again
print_info "Testing Nginx configuration with SSL..."
nginx -t

if [ $? -ne 0 ]; then
    print_error "Nginx configuration test failed after SSL setup."
    exit 1
fi

# Reload Nginx
print_info "Reloading Nginx..."
systemctl reload nginx

# Setup automatic renewal
print_info "Setting up automatic certificate renewal..."
# Certbot installs a systemd timer by default, let's verify it's enabled
systemctl enable certbot.timer
systemctl start certbot.timer

# Test renewal process
print_info "Testing certificate renewal (dry run)..."
certbot renew --dry-run

if [ $? -ne 0 ]; then
    print_warn "Certificate renewal test failed. Please check the configuration."
else
    print_info "Certificate renewal test passed!"
fi

echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}SSL Setup Complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${GREEN}Certificates obtained for:${NC}"
echo -e "  - $DOMAIN"
echo -e "  - www.$DOMAIN"
echo -e "  - $API_DOMAIN"
echo ""
echo -e "${GREEN}Certificate locations:${NC}"
echo -e "  - /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo -e "  - /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo -e "  - /etc/letsencrypt/live/$API_DOMAIN/fullchain.pem"
echo -e "  - /etc/letsencrypt/live/$API_DOMAIN/privkey.pem"
echo ""
echo -e "${GREEN}Auto-renewal:${NC}"
echo -e "  - Certbot timer is enabled and will renew certificates automatically"
echo -e "  - Check status: systemctl status certbot.timer"
echo -e "  - Manual renewal: certbot renew"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "  1. Verify HTTPS access: https://$DOMAIN"
echo -e "  2. Verify API HTTPS access: https://$API_DOMAIN/api/health"
echo -e "  3. Check SSL rating: https://www.ssllabs.com/ssltest/"
echo ""
