#!/bin/bash
# =============================================================================
# AI Career Platform - Backup Script
# =============================================================================
# This script creates comprehensive backups of:
# - PostgreSQL database
# - Redis data
# - Docker volumes
# - Environment configuration
# - Application code
#
# Usage:
#   bash backup.sh [options]
#
# Options:
#   --output-dir    Backup directory (default: /var/backups/ai-career)
#   --keep-days     Days to keep backups (default: 30)
#   --no-compress   Don't compress backup files
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
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-career}"
KEEP_DAYS="${KEEP_DAYS:-30}"
COMPRESS=true
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --keep-days)
            KEEP_DAYS="$2"
            shift 2
            ;;
        --no-compress)
            COMPRESS=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}AI Career Platform - Backup${NC}"
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

# Create backup directory
print_step "Step 1: Preparing backup directory"
mkdir -p "$BACKUP_DIR"
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
mkdir -p "$BACKUP_PATH"
print_info "Backup location: $BACKUP_PATH"

# Load environment variables
cd "$DEPLOY_DIR"
export $(grep -v '^#' .env | xargs)

# Step 2: Backup PostgreSQL database
print_step "Step 2: Backing up PostgreSQL database"
POSTGRES_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q postgres)

if [ -z "$POSTGRES_CONTAINER" ]; then
    print_error "PostgreSQL container not found"
    exit 1
fi

print_info "Dumping database..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "${POSTGRES_USER:-postgres}" -Fc "${POSTGRES_DB:-ai_career_platform}" > "$BACKUP_PATH/database.dump"

# Verify backup
if [ -f "$BACKUP_PATH/database.dump" ] && [ -s "$BACKUP_PATH/database.dump" ]; then
    DB_SIZE=$(du -h "$BACKUP_PATH/database.dump" | cut -f1)
    print_info "✓ Database backup complete: $DB_SIZE"
else
    print_error "✗ Database backup failed or empty"
    exit 1
fi

# Create human-readable SQL export as well
print_info "Creating SQL export..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-ai_career_platform}" > "$BACKUP_PATH/database.sql"
SQL_SIZE=$(du -h "$BACKUP_PATH/database.sql" | cut -f1)
print_info "✓ SQL export complete: $SQL_SIZE"

# Step 3: Backup Redis data
print_step "Step 3: Backing up Redis data"
REDIS_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q redis)

if [ -z "$REDIS_CONTAINER" ]; then
    print_warn "Redis container not found, skipping"
else
    print_info "Saving Redis data..."
    docker exec "$REDIS_CONTAINER" redis-cli SAVE
    docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$BACKUP_PATH/redis.rdb"
    
    if [ -f "$BACKUP_PATH/redis.rdb" ]; then
        REDIS_SIZE=$(du -h "$BACKUP_PATH/redis.rdb" | cut -f1)
        print_info "✓ Redis backup complete: $REDIS_SIZE"
    else
        print_warn "✗ Redis backup failed"
    fi
fi

# Step 4: Backup Docker volumes
print_step "Step 4: Backing up Docker volumes"
VOLUMES_DIR="$BACKUP_PATH/volumes"
mkdir -p "$VOLUMES_DIR"

# Backup postgres volume
print_info "Backing up postgres volume..."
docker run --rm \
    -v ai-career-postgres-data:/data \
    -v "$VOLUMES_DIR":/backup \
    alpine tar czf /backup/postgres_data.tar.gz -C /data .
print_info "✓ Postgres volume backup complete"

# Backup redis volume
print_info "Backing up redis volume..."
docker run --rm \
    -v ai-career-redis-data:/data \
    -v "$VOLUMES_DIR":/backup \
    alpine tar czf /backup/redis_data.tar.gz -C /data .
print_info "✓ Redis volume backup complete"

# Step 5: Backup environment configuration
print_step "Step 5: Backing up configuration"
cp "$DEPLOY_DIR/.env" "$BACKUP_PATH/env.backup"
print_info "✓ Environment configuration backed up"

# Backup nginx config if modified
if [ -f /etc/nginx/sites-available/ai-career-web ]; then
    mkdir -p "$BACKUP_PATH/nginx"
    cp /etc/nginx/sites-available/ai-career-web "$BACKUP_PATH/nginx/"
    cp /etc/nginx/sites-available/ai-career-api "$BACKUP_PATH/nginx/"
    print_info "✓ Nginx configuration backed up"
fi

# Step 6: Backup application code state
print_step "Step 6: Backing up application state"
cd "$DEPLOY_DIR"
git rev-parse HEAD > "$BACKUP_PATH/git-commit.txt"
git status --short > "$BACKUP_PATH/git-status.txt"
git diff > "$BACKUP_PATH/git-diff.patch" || true
print_info "✓ Git state backed up"

# Create metadata file
cat > "$BACKUP_PATH/backup-info.txt" << EOF
AI Career Platform Backup
=========================
Timestamp: $(date)
Git Commit: $(git rev-parse HEAD)
Git Branch: $(git branch --show-current)
Docker Compose Version: $(docker compose version)
System: $(uname -a)

Backup Contents:
- database.dump (PostgreSQL custom format)
- database.sql (Plain SQL)
- redis.rdb (Redis dump)
- volumes/postgres_data.tar.gz (Postgres volume)
- volumes/redis_data.tar.gz (Redis volume)
- env.backup (Environment configuration)
- nginx/ (Nginx configurations)
- git-commit.txt, git-status.txt, git-diff.patch (Git state)

Restore Instructions:
1. Stop services: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml down
2. Restore database: docker compose -f docker-compose.prod.yml up -d postgres
3. Copy database: docker cp database.dump CONTAINER:/tmp/
4. Restore: docker exec CONTAINER pg_restore -U postgres -d ai_career_platform -c /tmp/database.dump
5. Restore volumes: docker run --rm -v VOLUME:/data -v /path/to/backup:/backup alpine tar xzf /backup/volume.tar.gz -C /data
6. Restore .env: cp env.backup $DEPLOY_DIR/.env
7. Start services: docker compose -f docker-compose.prod.yml up -d
EOF

print_info "✓ Metadata file created"

# Step 7: Compress backup
if [ "$COMPRESS" = true ]; then
    print_step "Step 7: Compressing backup"
    cd "$BACKUP_DIR"
    ARCHIVE_NAME="backup_$TIMESTAMP.tar.gz"
    tar czf "$ARCHIVE_NAME" "backup_$TIMESTAMP"
    
    ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
    print_info "✓ Backup compressed: $ARCHIVE_SIZE"
    
    # Remove uncompressed backup
    rm -rf "$BACKUP_PATH"
    FINAL_BACKUP="$BACKUP_DIR/$ARCHIVE_NAME"
else
    FINAL_BACKUP="$BACKUP_PATH"
fi

# Step 8: Cleanup old backups
print_step "Step 8: Cleaning up old backups"
print_info "Removing backups older than $KEEP_DAYS days..."
find "$BACKUP_DIR" -name "backup_*" -type f -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name "backup_*" -type d -mtime +$KEEP_DAYS -exec rm -rf {} + 2>/dev/null || true

REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "backup_*" | wc -l)
print_info "Remaining backups: $REMAINING_BACKUPS"

# Step 9: Calculate total backup size
print_step "Step 9: Backup summary"
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Backup Complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${GREEN}Backup Location:${NC} $FINAL_BACKUP"
echo -e "${GREEN}Total Backup Size:${NC} $TOTAL_SIZE"
echo -e "${GREEN}Backups Retained:${NC} $REMAINING_BACKUPS (keeping last $KEEP_DAYS days)"
echo ""
echo -e "${GREEN}Backup Contents:${NC}"
echo -e "  ✓ PostgreSQL database (dump + SQL)"
echo -e "  ✓ Redis data"
echo -e "  ✓ Docker volumes"
echo -e "  ✓ Environment configuration"
echo -e "  ✓ Application state"
echo ""
echo -e "${GREEN}To restore from this backup:${NC}"
echo -e "  1. Extract: tar xzf $FINAL_BACKUP"
echo -e "  2. Follow instructions in backup-info.txt"
echo ""
echo -e "${YELLOW}Recommendation:${NC}"
echo -e "  - Copy backups to remote storage (S3, another server, etc.)"
echo -e "  - Test restore procedure regularly"
echo -e "  - Keep backups in multiple locations"
echo ""

# Create restore script
cat > "$BACKUP_DIR/restore_$TIMESTAMP.sh" << 'RESTORE_SCRIPT'
#!/bin/bash
# Quick restore script - USE WITH CAUTION
set -e

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <backup-archive.tar.gz>"
    exit 1
fi

BACKUP_ARCHIVE="$1"
DEPLOY_DIR="/opt/ai-career-platform"

echo "WARNING: This will restore from backup and overwrite current data!"
echo "Backup: $BACKUP_ARCHIVE"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted"
    exit 0
fi

# Extract backup
EXTRACT_DIR="/tmp/restore_$(date +%s)"
mkdir -p "$EXTRACT_DIR"
tar xzf "$BACKUP_ARCHIVE" -C "$EXTRACT_DIR"
BACKUP_DIR=$(find "$EXTRACT_DIR" -name "backup_*" -type d)

cd "$DEPLOY_DIR"

# Stop services
echo "Stopping services..."
docker compose -f docker-compose.prod.yml down

# Restore environment
echo "Restoring environment..."
cp "$BACKUP_DIR/env.backup" .env

# Start database only
echo "Starting database..."
docker compose -f docker-compose.prod.yml up -d postgres redis
sleep 10

# Restore database
echo "Restoring database..."
POSTGRES_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q postgres)
docker cp "$BACKUP_DIR/database.dump" "$POSTGRES_CONTAINER:/tmp/restore.dump"
docker exec "$POSTGRES_CONTAINER" pg_restore -U postgres -d ai_career_platform -c /tmp/restore.dump || true

# Start all services
echo "Starting all services..."
docker compose -f docker-compose.prod.yml up -d

echo "Restore complete! Check logs: docker compose -f docker-compose.prod.yml logs -f"
RESTORE_SCRIPT

chmod +x "$BACKUP_DIR/restore_$TIMESTAMP.sh"
print_info "✓ Restore script created: $BACKUP_DIR/restore_$TIMESTAMP.sh"
