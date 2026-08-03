#!/bin/bash
# =============================================================================
# Local Docker Build Script
# Builds all images locally with proper tags
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REGISTRY="${DOCKER_REGISTRY:-your-registry}"  # Change this!
VERSION="${IMAGE_TAG:-latest}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Build arguments for Next.js
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://yourdomain.com/api}"
NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://yourdomain.com}"

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

# Check if registry is configured
if [ "$REGISTRY" = "your-registry" ]; then
    log_error "Please configure DOCKER_REGISTRY environment variable"
    log_info "Examples:"
    log_info "  export DOCKER_REGISTRY=username           # Docker Hub"
    log_info "  export DOCKER_REGISTRY=ghcr.io/username   # GitHub Container Registry"
    log_info "  export DOCKER_REGISTRY=registry.example.com # Private registry"
    exit 1
fi

log_info "Building images with:"
log_info "  Registry: $REGISTRY"
log_info "  Version: $VERSION"
log_info "  Timestamp: $TIMESTAMP"
log_info "  Next.js API URL: $NEXT_PUBLIC_API_URL"
log_info "  Next.js Site URL: $NEXT_PUBLIC_SITE_URL"
echo ""

# Build API image
log_info "Building API image..."
docker build \
    --file apps/api/Dockerfile \
    --tag "$REGISTRY/ai-career-api:$VERSION" \
    --tag "$REGISTRY/ai-career-api:$TIMESTAMP" \
    --platform linux/amd64 \
    .

log_success "API image built"
echo ""

# Build Web image
log_info "Building Web image..."
docker build \
    --file apps/web/Dockerfile \
    --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
    --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
    --tag "$REGISTRY/ai-career-web:$VERSION" \
    --tag "$REGISTRY/ai-career-web:$TIMESTAMP" \
    --platform linux/amd64 \
    .

log_success "Web image built"
echo ""

# Build JobSpy image
log_info "Building JobSpy image..."
docker build \
    --file services/jobspy/Dockerfile \
    --tag "$REGISTRY/ai-career-jobspy:$VERSION" \
    --tag "$REGISTRY/ai-career-jobspy:$TIMESTAMP" \
    --platform linux/amd64 \
    services/jobspy

log_success "JobSpy image built"
echo ""

# Show built images
log_info "Built images:"
docker images | grep "$REGISTRY/ai-career" | head -6
echo ""

log_success "All images built successfully!"
echo ""
log_info "Next steps:"
log_info "  1. Test locally: docker compose -f docker-compose.prod.yml up"
log_info "  2. Push to registry: ./scripts/docker-push.sh"
log_info "  3. Deploy on VPS: ./scripts/docker-deploy-vps.sh"
