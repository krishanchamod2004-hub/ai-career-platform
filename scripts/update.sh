#!/bin/bash
# =============================================================================
# AI Career Platform - Update Script
# =============================================================================
# This script safely updates the AI Career Platform in production with
# minimal downtime.
#
# Usage:
#   bash update.sh [options]
#
# Options:
#   --no-build    Skip rebuilding Docker images (use existing images)
#   --no-migrate  Skip database migrations
#   --no-backup   Skip automatic backup (not recommended)
#   --branch      Specify git branch to pull (default: main)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/opt/ai-career-platform}"
BRANCH="${BRANCH:-main}"
BUILD_IMAGES=true
RUN_MIGRATIONS=true
CREATE_BACKUP=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-build)
            BUILD_IMAGES=false
            shift
            ;;
        --no-migrate)
            RUN_MIGRATIONS=false
            shift
            ;;
        --no-backup)
            CREATE_BACKUP=false
            shift
            ;;
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}AI Career Platform - Update${NC}"
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

# Change to deploy directory
cd "$DEPLOY_DIR"

# Step 1: Pre-update checks
print_step "Step 1: Pre-update checks"

# Check if containers are running
print_info "Checking running containers..."
if ! docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    print_error "No containers are running. Start services first with:"
    print_error "cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml up -d"
    exit 1
fi

# Check disk space
AVAILABLE_SPACE=$(df --output=avail -B 1G / | tail -1 | xargs)
if [ "$AVAILABLE_SPACE" -lt 5 ]; then
    print_error "Low disk space: ${AVAILABLE_SPACE}GB available. Need at least 5GB for safe update."
    exit 1
fi
print_info "Disk space OK: ${AVAILABLE_SPACE}GB available"

# Step 2: Create backup
if [ "$CREATE_BACKUP" = true ]; then
    print_step "Step 2: Creating backup"
    bash scripts/backup.sh || {
        print_error "Backup failed. Aborting update."
        exit 1
    }
else
    print_warn "Skipping backup (--no-backup flag set)"
fi

# Step 3: Pull latest code
print_step "Step 3: Pulling latest code from Git"
print_info "Current branch: $(git branch --show-current)"
print_info "Pulling branch: $BRANCH"

# Stash any local changes
if ! git diff-index --quiet HEAD --; then
    print_warn "Local changes detected. Stashing..."
    git stash save "Auto-stash before update $(date +%Y%m%d_%H%M%S)"
fi

# Pull latest changes
git fetch --all
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Show what changed
COMMITS_SINCE_LAST=$(git log --oneline -5)
print_info "Recent commits:"
echo "$COMMITS_SINCE_LAST"

# Step 4: Update environment if needed
print_step "Step 4: Checking environment configuration"
if [ -f .env.production.example ]; then
    # Check for new variables in example file
    print_info "Checking for new environment variables..."
    
    # Compare .env with .env.production.example
    # Note: This is a simple check - manual review recommended
    NEW_VARS=$(comm -13 <(grep -v '^#' .env | grep '=' | cut -d= -f1 | sort) \
                        <(grep -v '^#' .env.production.example | grep '=' | cut -d= -f1 | sort) || true)
    
    if [ -n "$NEW_VARS" ]; then
        print_warn "New environment variables found:"
        echo "$NEW_VARS"
        print_warn "Please review .env.production.example and update .env accordingly"
        print_warn "Press Enter to continue or Ctrl+C to abort..."
        read
    else
        print_info "No new environment variables detected"
    fi
fi

# Step 5: Build new images
if [ "$BUILD_IMAGES" = true ]; then
    print_step "Step 5: Building new Docker images"
    print_info "This may take 10-15 minutes..."
    
    # Build with build args from .env
    export $(grep -v '^#' .env | xargs)
    docker compose -f docker-compose.prod.yml build
else
    print_warn "Skipping image build (--no-build flag set)"
fi

# Step 6: Stop services gracefully
print_step "Step 6: Stopping services gracefully"
print_info "Allowing in-flight requests to complete..."

# Send SIGTERM to containers
docker compose -f docker-compose.prod.yml stop -t 30

# Step 7: Database migrations
if [ "$RUN_MIGRATIONS" = true ]; then
    print_step "Step 7: Running database migrations"
    
    # Start only the database and dependencies for migrations
    docker compose -f docker-compose.prod.yml up -d postgres redis
    
    # Wait for database to be ready
    print_info "Waiting for database..."
    sleep 10
    
    # Run migrations
    docker compose -f docker-compose.prod.yml run --rm -e DATABASE_URL="$DATABASE_URL" api \
        pnpm --filter=@ai-career/api run prisma:migrate:deploy || {
        print_error "Migration failed. Rolling back..."
        docker compose -f docker-compose.prod.yml down
        print_error "Update failed. Restore from backup if needed."
        exit 1
    }
else
    print_warn "Skipping database migrations (--no-migrate flag set)"
fi

# Step 8: Start updated services
print_step "Step 8: Starting updated services"
docker compose -f docker-compose.prod.yml up -d

# Step 9: Health checks
print_step "Step 9: Running health checks"
print_info "Waiting for services to start..."
sleep 20

# Check API health
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health || echo "000")
if [ "$API_HEALTH" = "200" ]; then
    print_info "✓ API health check passed"
else
    print_error "✗ API health check failed (HTTP $API_HEALTH)"
    print_error "Check logs: docker compose -f docker-compose.prod.yml logs api"
fi

# Check Web health
WEB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$WEB_HEALTH" = "200" ]; then
    print_info "✓ Web health check passed"
else
    print_error "✗ Web health check failed (HTTP $WEB_HEALTH)"
    print_error "Check logs: docker compose -f docker-compose.prod.yml logs web"
fi

# Step 10: Verify containers are running
print_step "Step 10: Verifying container status"
docker compose -f docker-compose.prod.yml ps

# Count healthy containers
HEALTHY_COUNT=$(docker compose -f docker-compose.prod.yml ps | grep -c "(healthy)" || echo "0")
print_info "Healthy containers: $HEALTHY_COUNT"

# Step 11: Cleanup old images
print_step "Step 11: Cleaning up old Docker images"
print_info "Removing dangling images..."
docker image prune -f

# Show disk usage
print_info "Docker disk usage:"
docker system df

# Completion message
echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Update Complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${GREEN}Status:${NC}"
docker compose -f docker-compose.prod.yml ps
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo -e "  1. Verify application: https://$(grep WEB_URL .env | cut -d= -f2)"
echo -e "  2. Check logs: docker compose -f docker-compose.prod.yml logs -f"
echo -e "  3. Monitor for errors: tail -f /var/log/nginx/ai-career-*-error.log"
echo -e "  4. Test key functionality (login, job search, etc.)"
echo ""

if [ "$API_HEALTH" != "200" ] || [ "$WEB_HEALTH" != "200" ]; then
    echo -e "${YELLOW}WARNING: Some health checks failed. Review logs and consider rollback if needed.${NC}"
    echo -e "${YELLOW}Rollback command: docker compose -f docker-compose.prod.yml down && restore from backup${NC}"
    echo ""
fi

echo -e "${GREEN}Update completed at: $(date)${NC}"
