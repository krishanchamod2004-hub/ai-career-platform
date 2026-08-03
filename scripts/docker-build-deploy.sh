#!/bin/bash
# =============================================================================
# Docker Production Build and Deploy Script
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    log_error ".env.production file not found!"
    log_info "Please create .env.production from .env.production.example"
    exit 1
fi

# Load environment variables
set -a
source .env.production
set +a

# Validate required environment variables
REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "JWT_ACCESS_SECRET"
    "JOBSPY_API_TOKEN"
    "WEB_URL"
    "NEXT_PUBLIC_API_URL"
    "NEXT_PUBLIC_SITE_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required environment variable $var is not set in .env.production"
        exit 1
    fi
done

log_info "Environment variables validated"

# Build images
log_info "Building Docker images..."

# Build API/Worker image
log_info "Building API image..."
docker build \
    --file apps/api/Dockerfile \
    --tag ai-career/api:latest \
    --tag ai-career/api:$(date +%Y%m%d-%H%M%S) \
    .

# Build Web image
log_info "Building Web image..."
docker build \
    --file apps/web/Dockerfile \
    --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
    --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
    --tag ai-career/web:latest \
    --tag ai-career/web:$(date +%Y%m%d-%H%M%S) \
    .

# Build JobSpy image
log_info "Building JobSpy image..."
docker build \
    --file services/jobspy/Dockerfile \
    --tag ai-career/jobspy:latest \
    --tag ai-career/jobspy:$(date +%Y%m%d-%H%M%S) \
    services/jobspy

log_info "All images built successfully"

# Deploy
log_info "Deploying with docker compose..."

docker compose -f docker-compose.prod.yml down

docker compose -f docker-compose.prod.yml up -d

log_info "Waiting for services to be healthy..."
sleep 10

# Check service status
log_info "Checking service health..."
docker compose -f docker-compose.prod.yml ps

log_info "Deployment complete!"
log_info "Web: http://localhost:3000"
log_info "API: http://localhost:4000/api"
log_info "API Docs: http://localhost:4000/api/docs"

log_info "View logs with: docker compose -f docker-compose.prod.yml logs -f"
