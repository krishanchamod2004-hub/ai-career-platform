#!/bin/bash
# =============================================================================
# AI Career Platform - Monitoring and Health Check Script
# =============================================================================
# This script monitors the health of all services and reports issues.
# Can be run via cron for automated monitoring.
#
# Usage:
#   bash monitor.sh [options]
#
# Options:
#   --alert-email   Email address for alerts
#   --slack-webhook Slack webhook URL for notifications
#   --quiet         Only output on errors
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
ALERT_EMAIL="${ALERT_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
QUIET=false
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --alert-email)
            ALERT_EMAIL="$2"
            shift 2
            ;;
        --slack-webhook)
            SLACK_WEBHOOK="$2"
            shift 2
            ;;
        --quiet)
            QUIET=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Function to print colored messages
print_info() {
    if [ "$QUIET" = false ]; then
        echo -e "${GREEN}[✓]${NC} $1"
    fi
}

print_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header() {
    if [ "$QUIET" = false ]; then
        echo -e "${BLUE}=== $1 ===${NC}"
    fi
}

# Function to send alert
send_alert() {
    local message="$1"
    local severity="${2:-WARNING}"
    
    # Send email if configured
    if [ -n "$ALERT_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "[$severity] AI Career Platform Alert - $TIMESTAMP" "$ALERT_EMAIL"
    fi
    
    # Send Slack notification if configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        local color="warning"
        [ "$severity" = "ERROR" ] && color="danger"
        [ "$severity" = "OK" ] && color="good"
        
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"[$severity] AI Career Platform\",\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\",\"ts\":$(date +%s)}]}" \
            -s > /dev/null
    fi
}

cd "$DEPLOY_DIR"

# Load environment
export $(grep -v '^#' .env | xargs 2>/dev/null || true)

ERRORS=()
WARNINGS=()

# Check 1: Docker daemon
print_header "Docker Status"
if systemctl is-active --quiet docker; then
    print_info "Docker daemon is running"
else
    print_error "Docker daemon is not running"
    ERRORS+=("Docker daemon is down")
fi

# Check 2: Container status
print_header "Container Status"
CONTAINERS=("ai-career-postgres" "ai-career-redis" "ai-career-jobspy" "ai-career-api" "ai-career-worker" "ai-career-web")

for container in "${CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        STATUS=$(docker inspect --format='{{.State.Status}}' "$container")
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        
        if [ "$STATUS" = "running" ]; then
            if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "none" ]; then
                print_info "$container: running"
            elif [ "$HEALTH" = "starting" ]; then
                print_warn "$container: starting"
                WARNINGS+=("$container is starting")
            else
                print_error "$container: unhealthy"
                ERRORS+=("$container is unhealthy")
            fi
        else
            print_error "$container: $STATUS"
            ERRORS+=("$container is $STATUS")
        fi
    else
        print_error "$container: not found"
        ERRORS+=("$container is not running")
    fi
done

# Check 3: Disk space
print_header "Disk Space"
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
DISK_AVAIL=$(df -h / | tail -1 | awk '{print $4}')

if [ "$DISK_USAGE" -lt 80 ]; then
    print_info "Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    print_warn "Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)"
    WARNINGS+=("Disk usage is at ${DISK_USAGE}%")
else
    print_error "Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)"
    ERRORS+=("Disk usage is critically high: ${DISK_USAGE}%")
fi

# Check 4: Memory usage
print_header "Memory Usage"
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
MEM_AVAIL=$(free -h | grep Mem | awk '{print $7}')

if [ "$MEM_USAGE" -lt 85 ]; then
    print_info "Memory usage: ${MEM_USAGE}% (${MEM_AVAIL} available)"
elif [ "$MEM_USAGE" -lt 95 ]; then
    print_warn "Memory usage: ${MEM_USAGE}% (${MEM_AVAIL} available)"
    WARNINGS+=("Memory usage is at ${MEM_USAGE}%")
else
    print_error "Memory usage: ${MEM_USAGE}% (${MEM_AVAIL} available)"
    ERRORS+=("Memory usage is critically high: ${MEM_USAGE}%")
fi

# Check 5: API health endpoint
print_header "API Health"
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health || echo "000")
if [ "$API_RESPONSE" = "200" ]; then
    print_info "API health check: OK (HTTP 200)"
else
    print_error "API health check: FAILED (HTTP $API_RESPONSE)"
    ERRORS+=("API health check failed")
fi

# Check 6: Web frontend
print_header "Web Frontend"
WEB_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$WEB_RESPONSE" = "200" ]; then
    print_info "Web frontend: OK (HTTP 200)"
else
    print_error "Web frontend: FAILED (HTTP $WEB_RESPONSE)"
    ERRORS+=("Web frontend is down")
fi

# Check 7: Database connectivity
print_header "Database"
POSTGRES_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q postgres 2>/dev/null || echo "")
if [ -n "$POSTGRES_CONTAINER" ]; then
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres > /dev/null 2>&1; then
        print_info "PostgreSQL: accepting connections"
    else
        print_error "PostgreSQL: not accepting connections"
        ERRORS+=("PostgreSQL is not accepting connections")
    fi
else
    print_error "PostgreSQL: container not found"
    ERRORS+=("PostgreSQL container not found")
fi

# Check 8: Redis connectivity
print_header "Redis"
REDIS_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q redis 2>/dev/null || echo "")
if [ -n "$REDIS_CONTAINER" ]; then
    if docker exec "$REDIS_CONTAINER" redis-cli ping > /dev/null 2>&1; then
        print_info "Redis: responding to PING"
    else
        print_error "Redis: not responding"
        ERRORS+=("Redis is not responding")
    fi
else
    print_error "Redis: container not found"
    ERRORS+=("Redis container not found")
fi

# Check 9: SSL certificate expiry
print_header "SSL Certificates"
if [ -f /etc/letsencrypt/live/${DOMAIN:-yourdomain.com}/cert.pem ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/${DOMAIN:-yourdomain.com}/cert.pem | cut -d= -f2)
    DAYS_UNTIL_EXPIRY=$(( ($(date -d "$CERT_EXPIRY" +%s) - $(date +%s)) / 86400 ))
    
    if [ "$DAYS_UNTIL_EXPIRY" -gt 30 ]; then
        print_info "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
    elif [ "$DAYS_UNTIL_EXPIRY" -gt 7 ]; then
        print_warn "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
        WARNINGS+=("SSL certificate expires soon: $DAYS_UNTIL_EXPIRY days")
    else
        print_error "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
        ERRORS+=("SSL certificate expires very soon: $DAYS_UNTIL_EXPIRY days")
    fi
else
    print_warn "SSL certificate not found (may not be configured yet)"
fi

# Check 10: Docker logs for errors
print_header "Recent Errors in Logs"
ERROR_COUNT=$(docker compose -f docker-compose.prod.yml logs --tail=100 2>/dev/null | grep -i "error\|exception\|fatal" | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    print_info "No recent errors in logs"
elif [ "$ERROR_COUNT" -lt 5 ]; then
    print_warn "Found $ERROR_COUNT recent errors in logs"
    WARNINGS+=("$ERROR_COUNT errors found in recent logs")
else
    print_error "Found $ERROR_COUNT recent errors in logs"
    ERRORS+=("$ERROR_COUNT errors found in recent logs")
fi

# Check 11: Nginx status
print_header "Nginx"
if systemctl is-active --quiet nginx; then
    print_info "Nginx is running"
    
    # Check for nginx errors
    NGINX_ERRORS=$(tail -100 /var/log/nginx/ai-career-*-error.log 2>/dev/null | wc -l || echo "0")
    if [ "$NGINX_ERRORS" -gt 10 ]; then
        print_warn "Found $NGINX_ERRORS recent Nginx errors"
        WARNINGS+=("$NGINX_ERRORS Nginx errors in logs")
    fi
else
    print_error "Nginx is not running"
    ERRORS+=("Nginx is down")
fi

# Summary
echo ""
print_header "Summary"
echo -e "Timestamp: $TIMESTAMP"
echo -e "Errors: ${#ERRORS[@]}"
echo -e "Warnings: ${#WARNINGS[@]}"

if [ ${#ERRORS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Errors:${NC}"
    for error in "${ERRORS[@]}"; do
        echo -e "  • $error"
    done
    
    # Send alert
    ERROR_MESSAGE="AI Career Platform has ${#ERRORS[@]} error(s):\n\n$(printf '%s\n' "${ERRORS[@]}")"
    send_alert "$ERROR_MESSAGE" "ERROR"
    
    exit 1
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Warnings:${NC}"
    for warning in "${WARNINGS[@]}"; do
        echo -e "  • $warning"
    done
    
    # Send alert
    WARN_MESSAGE="AI Career Platform has ${#WARNINGS[@]} warning(s):\n\n$(printf '%s\n' "${WARNINGS[@]}")"
    send_alert "$WARN_MESSAGE" "WARNING"
    
    exit 0
fi

if [ "$QUIET" = false ]; then
    echo ""
    echo -e "${GREEN}All checks passed! System is healthy.${NC}"
fi

exit 0
