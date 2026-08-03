#!/bin/bash
# =============================================================================
# VPS Deployment Script
# Run this on your VPS to deploy the application
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if .env exists
if [ ! -f ".env" ]; then
    log_error ".env file not found!"
    log_info "Please create .env file with required variables"
    exit 1
fi

# Load environment
set -a
source .env
set +a

# Validate required variables
REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "JWT_ACCESS_SECRET"
    "JOBSPY_API_TOKEN"
    "WEB_URL"
    "DOCKER_REGISTRY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required variable $var is not set in .env"
        exit 1
    fi
done

log_info "Starting deployment..."
echo ""

# Pull latest images
log_info "Pulling latest images from registry..."
docker compose -f docker-compose.prod.yml pull
log_success "Images pulled"
echo ""

# Stop existing containers
log_info "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down
log_success "Containers stopped"
echo ""

# Start services
log_info "Starting services..."
docker compose -f docker-compose.prod.yml up -d
echo ""

# Wait for services to be healthy
log_info "Waiting for services to be healthy (30s)..."
sleep 30

# Check service status
log_info "Checking service status..."
docker compose -f docker-compose.prod.yml ps
echo ""

# Run migrations
log_info "Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T api pnpm exec prisma migrate deploy || log_warn "Migration failed (may be normal on first run)"
echo ""

# Check health
log_info "Checking health endpoints..."
API_HEALTH=$(docker compose -f docker-compose.prod.yml exec -T api curl -s http://localhost:4000/api/health || echo "FAIL")
WEB_HEALTH=$(docker compose -f docker-compose.prod.yml exec -T web curl -s http://localhost:3000/ || echo "FAIL")

if [[ "$API_HEALTH" == *"ok"* ]] || [[ "$API_HEALTH" == *"healthy"* ]]; then
    log_success "API is healthy"
else
    log_error "API health check failed"
fi

if [[ "$WEB_HEALTH" != "FAIL" ]]; then
    log_success "Web is healthy"
else
    log_error "Web health check failed"
fi
echo ""

log_success "Deployment complete!"
echo ""
log_info "Services:"
log_info "  Web: $WEB_URL"
log_info "  API: $WEB_URL/api"
log_info "  API Docs: $WEB_URL/api/docs"
echo ""
log_info "View logs: docker compose -f docker-compose.prod.yml logs -f"
