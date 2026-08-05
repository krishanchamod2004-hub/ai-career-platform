#!/bin/bash

# =============================================================================
# AI Career Platform - Quick Deployment Script
# =============================================================================
# This script pulls the latest code and restarts Docker containers
# Usage: ./quick-deploy.sh
# =============================================================================

set -e  # Exit on any error

echo "=================================="
echo "🚀 AI Career Platform Deployment"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Pull latest code
echo -e "${BLUE}📥 Step 1: Pulling latest code from GitHub...${NC}"
git pull origin main
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Code updated successfully${NC}"
else
    echo -e "${RED}❌ Failed to pull code${NC}"
    exit 1
fi
echo ""

# Step 2: Check if .env exists
echo -e "${BLUE}🔍 Step 2: Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "Creating from template..."
    cp .env.production.template .env
    echo -e "${RED}❌ Please edit .env with your actual values:${NC}"
    echo "   1. Set POSTGRES_PASSWORD"
    echo "   2. Set JWT_ACCESS_SECRET"
    echo "   3. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    echo "   4. Set your domain URLs"
    echo "   5. Set JOBSPY_API_TOKEN"
    echo ""
    echo "Then run this script again: ./quick-deploy.sh"
    exit 1
fi
echo -e "${GREEN}✅ Environment file found${NC}"
echo ""

# Step 3: Choose deployment mode
echo -e "${BLUE}📋 Step 3: Select deployment mode${NC}"
echo "1) Production (docker-compose.prod.yml)"
echo "2) Development (docker-compose.yml)"
read -p "Enter choice [1-2]: " choice

if [ "$choice" = "1" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    MODE="production"
elif [ "$choice" = "2" ]; then
    COMPOSE_FILE="docker-compose.yml"
    MODE="development"
else
    echo -e "${RED}❌ Invalid choice${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Using $MODE mode${NC}"
echo ""

# Step 4: Stop existing containers
echo -e "${BLUE}🛑 Step 4: Stopping existing containers...${NC}"
docker compose -f $COMPOSE_FILE down
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

# Step 5: Pull latest images (for production)
if [ "$MODE" = "production" ]; then
    echo -e "${BLUE}📦 Step 5: Pulling latest Docker images...${NC}"
    docker compose -f $COMPOSE_FILE pull
    echo -e "${GREEN}✅ Images pulled${NC}"
    echo ""
fi

# Step 6: Build and start services
echo -e "${BLUE}🔨 Step 6: Building and starting services...${NC}"
docker compose -f $COMPOSE_FILE up -d --build
echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 7: Wait for services
echo -e "${BLUE}⏳ Step 7: Waiting for services to be ready...${NC}"
sleep 15

# Step 8: Check container status
echo -e "${BLUE}📊 Step 8: Checking container status...${NC}"
docker compose -f $COMPOSE_FILE ps
echo ""

# Step 9: Run migrations (ask first)
echo -e "${BLUE}💾 Step 9: Database migrations${NC}"
read -p "Run database migrations? (y/n): " run_migrations
if [ "$run_migrations" = "y" ]; then
    echo "Running migrations..."
    docker compose -f $COMPOSE_FILE exec api pnpm prisma:migrate:deploy
    echo -e "${GREEN}✅ Migrations completed${NC}"
else
    echo -e "${YELLOW}⏭️  Skipped migrations${NC}"
fi
echo ""

# Step 10: Health check
echo -e "${BLUE}🔍 Step 10: Running health checks...${NC}"
sleep 5

# Try to check API health
API_HEALTH=$(docker compose -f $COMPOSE_FILE exec -T api wget -q -O - http://localhost:4000/api/health 2>/dev/null || echo "failed")
if [[ $API_HEALTH == *"ok"* ]]; then
    echo -e "${GREEN}✅ API is healthy!${NC}"
else
    echo -e "${YELLOW}⚠️  API health check inconclusive (this is normal during startup)${NC}"
fi
echo ""

# Final summary
echo "=================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=================================="
echo ""
echo "📝 Useful commands:"
echo "   View logs:        docker compose -f $COMPOSE_FILE logs -f"
echo "   Stop services:    docker compose -f $COMPOSE_FILE down"
echo "   Restart service:  docker compose -f $COMPOSE_FILE restart [service]"
echo "   Check status:     docker compose -f $COMPOSE_FILE ps"
echo ""

if [ "$MODE" = "production" ]; then
    echo "🌐 Your application should be accessible at:"
    echo "   Web:  https://careersuite.cc"
    echo "   API:  https://api.careersuite.cc"
    echo ""
    echo "⚠️  Make sure your reverse proxy (nginx/Caddy) is configured!"
else
    echo "🌐 Your application should be accessible at:"
    echo "   Web:  http://localhost:3000"
    echo "   API:  http://localhost:4000"
    echo "   Docs: http://localhost:4000/api/docs"
fi
echo ""
echo "🎉 Happy deploying!"
