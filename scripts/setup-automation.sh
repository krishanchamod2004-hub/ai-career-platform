#!/bin/bash
# =============================================================================
# Setup Automated Backups and Monitoring
# =============================================================================
# This script configures automated backups and monitoring via cron jobs
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DEPLOY_DIR="${DEPLOY_DIR:-/opt/ai-career-platform}"

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}Setup Automated Backups and Monitoring${NC}"
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root or with sudo"
    exit 1
fi

# Prompt for configuration
echo "This script will setup automated tasks for:"
echo "  1. Daily database backups"
echo "  2. Hourly health monitoring"
echo "  3. Weekly Docker cleanup"
echo ""

read -p "Alert email address (optional, press Enter to skip): " ALERT_EMAIL
read -p "Slack webhook URL (optional, press Enter to skip): " SLACK_WEBHOOK

# Create cron jobs
print_info "Creating cron jobs..."

# Remove old cron jobs if they exist
crontab -l 2>/dev/null | grep -v "ai-career" | crontab - 2>/dev/null || true

# Add new cron jobs
(crontab -l 2>/dev/null || echo ""; cat <<EOF

# AI Career Platform Automated Tasks
# Generated on $(date)

# Daily backup at 2 AM
0 2 * * * cd $DEPLOY_DIR && bash scripts/backup.sh >> /var/log/ai-career-backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * cd $DEPLOY_DIR && bash scripts/monitor.sh --quiet$([ -n "$ALERT_EMAIL" ] && echo " --alert-email $ALERT_EMAIL")$([ -n "$SLACK_WEBHOOK" ] && echo " --slack-webhook '$SLACK_WEBHOOK'") >> /var/log/ai-career-monitor.log 2>&1

# Docker cleanup weekly (Sunday at 3 AM)
0 3 * * 0 docker system prune -af --volumes >> /var/log/ai-career-cleanup.log 2>&1

# Log rotation check daily
0 1 * * * logrotate /etc/logrotate.d/ai-career >> /var/log/logrotate.log 2>&1

EOF
) | crontab -

print_info "✓ Cron jobs created"

# Create log files
print_info "Creating log files..."
touch /var/log/ai-career-backup.log
touch /var/log/ai-career-monitor.log
touch /var/log/ai-career-cleanup.log
chmod 644 /var/log/ai-career-*.log

# Make scripts executable
print_info "Making scripts executable..."
chmod +x "$DEPLOY_DIR/scripts/backup.sh"
chmod +x "$DEPLOY_DIR/scripts/monitor.sh"
chmod +x "$DEPLOY_DIR/scripts/update.sh"

# Create convenience commands
print_info "Creating convenience commands..."

cat > /usr/local/bin/aicareer << EOF
#!/bin/bash
# AI Career Platform management command

case "\$1" in
    status)
        cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml ps
        ;;
    logs)
        cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml logs -f \${@:2}
        ;;
    restart)
        cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml restart \${@:2}
        ;;
    stop)
        cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml stop \${@:2}
        ;;
    start)
        cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml start \${@:2}
        ;;
    backup)
        cd $DEPLOY_DIR && bash scripts/backup.sh \${@:2}
        ;;
    monitor)
        cd $DEPLOY_DIR && bash scripts/monitor.sh \${@:2}
        ;;
    update)
        cd $DEPLOY_DIR && bash scripts/update.sh \${@:2}
        ;;
    shell)
        SERVICE="\${2:-api}"
        cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml exec "\$SERVICE" sh
        ;;
    db)
        cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_career_platform
        ;;
    redis)
        cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml exec redis redis-cli
        ;;
    *)
        echo "AI Career Platform Management"
        echo ""
        echo "Usage: aicareer <command> [options]"
        echo ""
        echo "Commands:"
        echo "  status              Show container status"
        echo "  logs [service]      Show logs (optional: specific service)"
        echo "  restart [service]   Restart services"
        echo "  stop [service]      Stop services"
        echo "  start [service]     Start services"
        echo "  backup              Create backup"
        echo "  monitor             Run health checks"
        echo "  update              Update application"
        echo "  shell [service]     Open shell in container (default: api)"
        echo "  db                  Open PostgreSQL CLI"
        echo "  redis               Open Redis CLI"
        echo ""
        echo "Examples:"
        echo "  aicareer status"
        echo "  aicareer logs api"
        echo "  aicareer restart worker"
        echo "  aicareer shell api"
        ;;
esac
EOF

chmod +x /usr/local/bin/aicareer

# Test monitoring
print_info "Testing monitoring script..."
cd "$DEPLOY_DIR"
bash scripts/monitor.sh || print_warn "Some health checks failed (this is normal on first setup)"

# Summary
echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${GREEN}Automated tasks configured:${NC}"
echo -e "  ✓ Daily backups at 2:00 AM"
echo -e "  ✓ Health monitoring every 5 minutes"
echo -e "  ✓ Weekly Docker cleanup on Sundays at 3:00 AM"
echo ""
echo -e "${GREEN}Log files:${NC}"
echo -e "  • /var/log/ai-career-backup.log"
echo -e "  • /var/log/ai-career-monitor.log"
echo -e "  • /var/log/ai-career-cleanup.log"
echo ""
echo -e "${GREEN}Management command:${NC}"
echo -e "  Use 'aicareer' command for quick access"
echo -e "  Run 'aicareer' without arguments for help"
echo ""
echo -e "${GREEN}View cron jobs:${NC}"
echo -e "  crontab -l"
echo ""
echo -e "${GREEN}Manual execution:${NC}"
echo -e "  Backup: aicareer backup"
echo -e "  Monitor: aicareer monitor"
echo -e "  Status: aicareer status"
echo ""

if [ -n "$ALERT_EMAIL" ]; then
    echo -e "${GREEN}Alerts will be sent to:${NC} $ALERT_EMAIL"
fi

if [ -n "$SLACK_WEBHOOK" ]; then
    echo -e "${GREEN}Slack notifications configured${NC}"
fi

echo ""
print_info "Testing convenience command..."
aicareer status
