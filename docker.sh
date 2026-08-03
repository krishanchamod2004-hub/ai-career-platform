#!/bin/bash
# =============================================================================
# Docker Management Utility
# Shortcuts for common Docker operations
# =============================================================================

COMPOSE_FILE="docker-compose.prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
    echo "Docker Management Utility"
    echo ""
    echo "Usage: ./docker.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build          Build all images"
    echo "  up             Start all services"
    echo "  down           Stop all services"
    echo "  restart        Restart all services"
    echo "  logs [service] View logs (optional: specify service)"
    echo "  ps             Show service status"
    echo "  health         Check service health"
    echo "  migrate        Run database migrations"
    echo "  seed           Seed database with demo data"
    echo "  backup         Backup database"
    echo "  shell [service] Open shell in service"
    echo "  stats          Show resource usage"
    echo "  clean          Remove stopped containers and unused images"
    echo "  reset          Stop and remove everything (⚠️  DELETES DATA)"
    echo ""
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

cmd_build() {
    log_info "Building all images..."
    docker compose -f "$COMPOSE_FILE" build
    log_success "Build complete"
}

cmd_up() {
    log_info "Starting all services..."
    docker compose -f "$COMPOSE_FILE" up -d
    log_success "Services started"
    log_info "Check status with: ./docker.sh ps"
}

cmd_down() {
    log_info "Stopping all services..."
    docker compose -f "$COMPOSE_FILE" down
    log_success "Services stopped"
}

cmd_restart() {
    if [ -z "$1" ]; then
        log_info "Restarting all services..."
        docker compose -f "$COMPOSE_FILE" restart
        log_success "All services restarted"
    else
        log_info "Restarting $1..."
        docker compose -f "$COMPOSE_FILE" restart "$1"
        log_success "$1 restarted"
    fi
}

cmd_logs() {
    if [ -z "$1" ]; then
        log_info "Following all logs (Ctrl+C to exit)..."
        docker compose -f "$COMPOSE_FILE" logs -f
    else
        log_info "Following logs for $1 (Ctrl+C to exit)..."
        docker compose -f "$COMPOSE_FILE" logs -f "$1"
    fi
}

cmd_ps() {
    log_info "Service status:"
    echo ""
    docker compose -f "$COMPOSE_FILE" ps
}

cmd_health() {
    log_info "Running health checks..."
    ./scripts/verify-docker.sh
}

cmd_migrate() {
    log_info "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" exec api pnpm exec prisma migrate deploy
    log_success "Migrations complete"
}

cmd_seed() {
    log_info "Seeding database..."
    docker compose -f "$COMPOSE_FILE" exec api pnpm exec prisma db seed
    log_success "Seeding complete"
}

cmd_backup() {
    BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
    log_info "Creating database backup: $BACKUP_FILE"
    docker compose -f "$COMPOSE_FILE" exec postgres pg_dump -U postgres ai_career_platform > "$BACKUP_FILE"
    log_success "Backup saved to $BACKUP_FILE"
}

cmd_shell() {
    if [ -z "$1" ]; then
        log_error "Please specify a service: api, web, postgres, redis, worker, jobspy"
        exit 1
    fi
    log_info "Opening shell in $1..."
    docker compose -f "$COMPOSE_FILE" exec "$1" sh
}

cmd_stats() {
    log_info "Resource usage:"
    echo ""
    docker stats --no-stream
}

cmd_clean() {
    log_info "Cleaning up unused Docker resources..."
    docker system prune -f
    log_success "Cleanup complete"
}

cmd_reset() {
    echo -e "${RED}⚠️  WARNING: This will DELETE ALL DATA!${NC}"
    echo "Are you sure? Type 'yes' to confirm:"
    read -r confirmation
    
    if [ "$confirmation" = "yes" ]; then
        log_info "Stopping and removing all containers and volumes..."
        docker compose -f "$COMPOSE_FILE" down -v
        log_success "Reset complete"
    else
        log_info "Reset cancelled"
    fi
}

# Main
case "$1" in
    build)
        cmd_build
        ;;
    up|start)
        cmd_up
        ;;
    down|stop)
        cmd_down
        ;;
    restart)
        cmd_restart "$2"
        ;;
    logs)
        cmd_logs "$2"
        ;;
    ps|status)
        cmd_ps
        ;;
    health|verify)
        cmd_health
        ;;
    migrate)
        cmd_migrate
        ;;
    seed)
        cmd_seed
        ;;
    backup)
        cmd_backup
        ;;
    shell|exec)
        cmd_shell "$2"
        ;;
    stats)
        cmd_stats
        ;;
    clean)
        cmd_clean
        ;;
    reset)
        cmd_reset
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "$1" ]; then
            show_help
        else
            log_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
        fi
        ;;
esac
