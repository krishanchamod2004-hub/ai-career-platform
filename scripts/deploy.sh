#!/bin/bash
# =============================================================================
# AI Career Platform - Production Deployment Script
# =============================================================================
# This script automates the initial deployment of the AI Career Platform
# on a fresh Ubuntu VPS.
#
# Prerequisites:
# - Ubuntu 20.04 or later
# - Root or sudo access
# - Domain DNS configured to point to server IP
# - Git installed
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="${REPO_URL:-https://github.com/yourusername/ai-career-platform.git}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/ai-career-platform}"
DOMAIN="${DOMAIN:-yourdomain.com}"
API_DOMAIN="${API_DOMAIN:-api.yourdomain.com}"
EMAIL="${EMAIL:-admin@yourdomain.com}"

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}AI Career Platform - Production Deployment${NC}"
echo -e "${BLUE}==============================================================================${NC}"
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

print_step() {
    echo ""
    echo -e "${BLUE}==>${NC} ${BLUE}$1${NC}"
    echo ""
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root or with sudo"
    exit 1
fi

# Step 1: Update system
print_step "Step 1: Updating system packages"
apt-get update
apt-get upgrade -y

# Step 2: Install required packages
print_step "Step 2: Installing required packages"
apt-get install -y \
    curl \
    wget \
    git \
    ufw \
    htop \
    vim \
    ca-certificates \
    gnupg \
    lsb-release

# Step 3: Install Docker
print_step "Step 3: Installing Docker"
if ! command -v docker &> /dev/null; then
    print_info "Adding Docker repository..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    print_info "Docker installed successfully"
else
    print_info "Docker is already installed"
fi

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Step 4: Configure firewall
print_step "Step 4: Configuring firewall"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
print_info "Firewall configured (ports 22, 80, 443 open)"

# Step 5: Clone or update repository
print_step "Step 5: Setting up application code"
if [ -d "$DEPLOY_DIR" ]; then
    print_warn "Deploy directory already exists. Backing up..."
    mv "$DEPLOY_DIR" "${DEPLOY_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi

print_info "Cloning repository..."
git clone "$REPO_URL" "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Step 6: Configure environment
print_step "Step 6: Configuring environment variables"
if [ ! -f .env ]; then
    print_info "Creating .env file from template..."
    cp .env.production.example .env
    
    # Generate secrets
    print_info "Generating secure secrets..."
    JWT_SECRET=$(openssl rand -hex 64)
    POSTGRES_PASSWORD=$(openssl rand -base64 32)
    JOBSPY_TOKEN=$(openssl rand -hex 32)
    
    # Update .env file
    sed -i "s|JWT_ACCESS_SECRET=|JWT_ACCESS_SECRET=$JWT_SECRET|" .env
    sed -i "s|POSTGRES_PASSWORD=|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" .env
    sed -i "s|JOBSPY_API_TOKEN=|JOBSPY_API_TOKEN=$JOBSPY_TOKEN|" .env
    sed -i "s|WEB_URL=https://yourdomain.com|WEB_URL=https://$DOMAIN|" .env
    sed -i "s|NEXT_PUBLIC_SITE_URL=https://yourdomain.com|NEXT_PUBLIC_SITE_URL=https://$DOMAIN|" .env
    sed -i "s|NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api|NEXT_PUBLIC_API_URL=https://$API_DOMAIN/api|" .env
    sed -i "s|GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback|GOOGLE_CALLBACK_URL=https://$API_DOMAIN/api/auth/google/callback|" .env
    
    print_warn "IMPORTANT: Edit .env and add your Google OAuth credentials if needed"
    print_warn "File location: $DEPLOY_DIR/.env"
else
    print_info ".env file already exists"
fi

# Step 7: Build Docker images
print_step "Step 7: Building Docker images"
print_info "This may take 10-15 minutes..."
docker compose -f docker-compose.prod.yml build --no-cache

# Step 8: Setup Nginx
print_step "Step 8: Setting up Nginx reverse proxy"
export DOMAIN="$DOMAIN"
export API_DOMAIN="$API_DOMAIN"
cd nginx
bash setup-nginx.sh
cd ..

# Step 9: Start containers
print_step "Step 9: Starting Docker containers"
docker compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
print_info "Waiting for services to start (this may take a minute)..."
sleep 30

# Check container status
print_info "Container status:"
docker compose -f docker-compose.prod.yml ps

# Step 10: Run database migrations and seed
print_step "Step 10: Setting up database"
print_info "Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T api pnpm --filter=@ai-career/api run prisma:migrate:deploy

print_info "Seeding database with demo data..."
docker compose -f docker-compose.prod.yml exec -T api pnpm --filter=@ai-career/api run prisma:seed || true

# Step 11: Setup SSL
print_step "Step 11: Setting up SSL certificates"
export EMAIL="$EMAIL"
cd nginx
bash setup-ssl.sh
cd ..

# Step 12: Create systemd service (optional)
print_step "Step 12: Creating systemd service"
cat > /etc/systemd/system/ai-career.service << EOF
[Unit]
Description=AI Career Platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ai-career.service

# Step 13: Setup log rotation
print_step "Step 13: Configuring log rotation"
cat > /etc/logrotate.d/ai-career << 'EOF'
/var/log/nginx/ai-career-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
EOF

# Step 14: Create monitoring script
print_step "Step 14: Setting up monitoring"
cat > /usr/local/bin/ai-career-status.sh << 'EOF'
#!/bin/bash
echo "=== AI Career Platform Status ==="
echo ""
echo "Docker Containers:"
docker ps --filter "name=ai-career" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Disk Usage:"
df -h / | tail -1
echo ""
echo "Memory Usage:"
free -h | grep Mem
echo ""
echo "Recent Logs (last 20 lines):"
docker compose -f /opt/ai-career-platform/docker-compose.prod.yml logs --tail=20
EOF

chmod +x /usr/local/bin/ai-career-status.sh

# Completion message
echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo -e "  Frontend: https://$DOMAIN"
echo -e "  API: https://$API_DOMAIN/api/health"
echo -e "  API Docs: https://$API_DOMAIN/api/docs"
echo ""
echo -e "${GREEN}Demo Users:${NC}"
echo -e "  Regular: demo@aicareer.dev / Password123!"
echo -e "  Admin: admin@aicareer.dev / Password123!"
echo ""
echo -e "${GREEN}Management Commands:${NC}"
echo -e "  Status: ai-career-status.sh"
echo -e "  View logs: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml logs -f"
echo -e "  Restart: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml restart"
echo -e "  Stop: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml stop"
echo -e "  Start: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml start"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo -e "  1. Verify HTTPS access: https://$DOMAIN"
echo -e "  2. Login with demo credentials"
echo -e "  3. Configure Google OAuth (edit $DEPLOY_DIR/.env and restart)"
echo -e "  4. Setup automated backups: cd $DEPLOY_DIR/scripts && bash setup-backups.sh"
echo -e "  5. Monitor logs and performance"
echo ""
echo -e "${YELLOW}Security Reminders:${NC}"
echo -e "  - Change demo user passwords immediately"
echo -e "  - Review firewall rules: ufw status"
echo -e "  - Setup monitoring and alerts"
echo -e "  - Configure automated backups"
echo -e "  - Keep system and Docker images updated"
echo ""
