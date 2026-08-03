#!/bin/bash
# =============================================================================
# Docker Production Verification Script
# Tests all services and verifies health
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.prod.yml"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

check_service() {
    local service=$1
    local container=$2
    
    log_info "Checking $service..."
    
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        log_success "$service is running"
        return 0
    else
        log_error "$service is not running"
        return 1
    fi
}

check_health() {
    local container=$1
    local service=$2
    
    health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
    
    if [ "$health" = "healthy" ]; then
        log_success "$service is healthy"
        return 0
    elif [ "$health" = "none" ]; then
        log_warn "$service has no health check"
        return 0
    else
        log_error "$service is unhealthy (status: $health)"
        return 1
    fi
}

test_http_endpoint() {
    local name=$1
    local url=$2
    local expected=$3
    
    log_info "Testing $name endpoint..."
    
    response=$(docker compose -f "$COMPOSE_FILE" exec -T api curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected" ]; then
        log_success "$name returned $response"
        return 0
    else
        log_error "$name returned $response (expected $expected)"
        return 1
    fi
}

echo "=========================================="
echo "  Docker Production Verification"
echo "=========================================="
echo ""

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "docker-compose.prod.yml not found!"
    exit 1
fi

# Check if services are running
log_info "Checking running services..."
echo ""

SERVICES=(
    "ai-career-postgres:PostgreSQL"
    "ai-career-redis:Redis"
    "ai-career-jobspy:JobSpy"
    "ai-career-api:API"
    "ai-career-worker:Worker"
    "ai-career-web:Web"
)

ALL_RUNNING=true
for service_pair in "${SERVICES[@]}"; do
    IFS=':' read -r container name <<< "$service_pair"
    if ! check_service "$name" "$container"; then
        ALL_RUNNING=false
    fi
done
echo ""

if [ "$ALL_RUNNING" = false ]; then
    log_error "Not all services are running!"
    log_info "Start services with: docker compose -f $COMPOSE_FILE up -d"
    exit 1
fi

# Check health status
log_info "Checking service health..."
echo ""

HEALTH_SERVICES=(
    "ai-career-postgres:PostgreSQL"
    "ai-career-redis:Redis"
    "ai-career-jobspy:JobSpy"
    "ai-career-api:API"
    "ai-career-web:Web"
)

ALL_HEALTHY=true
for service_pair in "${HEALTH_SERVICES[@]}"; do
    IFS=':' read -r container name <<< "$service_pair"
    if ! check_health "$container" "$name"; then
        ALL_HEALTHY=false
    fi
done
echo ""

if [ "$ALL_HEALTHY" = false ]; then
    log_error "Some services are unhealthy!"
    log_info "Check logs with: docker compose -f $COMPOSE_FILE logs"
    exit 1
fi

# Test API endpoints
log_info "Testing API endpoints..."
echo ""

test_http_endpoint "Health Check" "http://localhost:4000/api/health" "200"
echo ""

# Test Web endpoint
log_info "Testing Web endpoint..."
echo ""

response=$(docker compose -f "$COMPOSE_FILE" exec -T web curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/" 2>/dev/null || echo "000")
if [ "$response" = "200" ]; then
    log_success "Web frontend returned 200"
else
    log_error "Web frontend returned $response (expected 200)"
fi
echo ""

# Check database connection
log_info "Testing database connection..."
echo ""

if docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d ai_career_platform -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Database connection successful"
else
    log_error "Database connection failed"
    ALL_HEALTHY=false
fi
echo ""

# Check Redis connection
log_info "Testing Redis connection..."
echo ""

if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli PING | grep -q "PONG"; then
    log_success "Redis connection successful"
else
    log_error "Redis connection failed"
    ALL_HEALTHY=false
fi
echo ""

# Check volumes
log_info "Checking persistent volumes..."
echo ""

VOLUMES=(
    "ai-career-postgres-data"
    "ai-career-redis-data"
)

for volume in "${VOLUMES[@]}"; do
    if docker volume inspect "$volume" > /dev/null 2>&1; then
        log_success "Volume $volume exists"
    else
        log_warn "Volume $volume not found"
    fi
done
echo ""

# Check networks
log_info "Checking Docker networks..."
echo ""

if docker network inspect ai-career-network > /dev/null 2>&1; then
    log_success "Network ai-career-network exists"
else
    log_error "Network ai-career-network not found"
    ALL_HEALTHY=false
fi
echo ""

# Resource usage
log_info "Resource usage:"
echo ""
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
    ai-career-postgres ai-career-redis ai-career-jobspy ai-career-api ai-career-worker ai-career-web 2>/dev/null || true
echo ""

# Image sizes
log_info "Image sizes:"
echo ""
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep "ai-career" || true
echo ""

# Summary
echo "=========================================="
if [ "$ALL_HEALTHY" = true ]; then
    log_success "All checks passed! ✓"
    echo ""
    log_info "Your deployment is healthy and ready."
    log_info ""
    log_info "Access points:"
    log_info "  - Web: http://localhost:3000"
    log_info "  - API: http://localhost:4000/api"
    log_info "  - API Docs: http://localhost:4000/api/docs"
    echo ""
    exit 0
else
    log_error "Some checks failed!"
    echo ""
    log_info "Debug commands:"
    log_info "  - View logs: docker compose -f $COMPOSE_FILE logs -f"
    log_info "  - Check status: docker compose -f $COMPOSE_FILE ps"
    log_info "  - Restart: docker compose -f $COMPOSE_FILE restart"
    echo ""
    exit 1
fi
