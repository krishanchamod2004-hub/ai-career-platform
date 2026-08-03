#!/bin/bash
# =============================================================================
# Docker Push Script
# Pushes images to container registry
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REGISTRY="${DOCKER_REGISTRY:-your-registry}"
VERSION="${IMAGE_TAG:-latest}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

if [ "$REGISTRY" = "your-registry" ]; then
    log_error "Please configure DOCKER_REGISTRY environment variable"
    exit 1
fi

log_info "Pushing images to $REGISTRY"
echo ""

# Push API
log_info "Pushing API image..."
docker push "$REGISTRY/ai-career-api:$VERSION"
log_success "API image pushed"
echo ""

# Push Web
log_info "Pushing Web image..."
docker push "$REGISTRY/ai-career-web:$VERSION"
log_success "Web image pushed"
echo ""

# Push JobSpy
log_info "Pushing JobSpy image..."
docker push "$REGISTRY/ai-career-jobspy:$VERSION"
log_success "JobSpy image pushed"
echo ""

log_success "All images pushed successfully!"
echo ""
log_info "Images available at:"
log_info "  $REGISTRY/ai-career-api:$VERSION"
log_info "  $REGISTRY/ai-career-web:$VERSION"
log_info "  $REGISTRY/ai-career-jobspy:$VERSION"
echo ""
log_info "Deploy on VPS with:"
log_info "  docker compose -f docker-compose.prod.yml pull"
log_info "  docker compose -f docker-compose.prod.yml up -d"
