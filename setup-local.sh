#!/bin/bash
# =============================================================================
# AI Career Platform - Local Development Setup Script (Linux/Mac)
# =============================================================================
# This script sets up and runs the local development environment
#
# Usage:
#   ./setup-local.sh              # Interactive setup
#   ./setup-local.sh --skip-env   # Skip environment file setup
#   ./setup-local.sh --skip-docker # Skip Docker Compose setup
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

SKIP_ENV=false
SKIP_DOCKER=false
SKIP_INSTALL=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --skip-env) SKIP_ENV=true ;;
        --skip-docker) SKIP_DOCKER=true ;;
        --skip-install) SKIP_INSTALL=true ;;
    esac
done

echo -e "\n${CYAN}===================================================================${NC}"
echo -e "${CYAN}  AI Career Platform - Local Development Setup${NC}"
echo -e "${CYAN}===================================================================${NC}"

# --- Check Prerequisites -----------------------------------------------------
echo -e "\n${YELLOW}[1/7] Checking prerequisites...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}  ✓ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}  ✗ Node.js not found. Please install Node.js 20+ from https://nodejs.org/${NC}"
    exit 1
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo -e "${GREEN}  ✓ pnpm: v$PNPM_VERSION${NC}"
else
    echo -e "${YELLOW}  ✗ pnpm not found. Installing...${NC}"
    npm install -g pnpm
    echo -e "${GREEN}  ✓ pnpm installed${NC}"
fi

# Check Docker
if [ "$SKIP_DOCKER" = false ]; then
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        echo -e "${GREEN}  ✓ Docker: $DOCKER_VERSION${NC}"
    else
        echo -e "${RED}  ✗ Docker not found. Please install Docker from https://docs.docker.com/get-docker/${NC}"
        exit 1
    fi

    # Check Docker Compose
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
        echo -e "${GREEN}  ✓ Docker Compose: $COMPOSE_VERSION${NC}"
    else
        echo -e "${RED}  ✗ Docker Compose not found. Please update Docker.${NC}"
        exit 1
    fi
fi

# --- Install Dependencies ----------------------------------------------------
if [ "$SKIP_INSTALL" = false ]; then
    echo -e "\n${YELLOW}[2/7] Installing dependencies...${NC}"
    echo -e "${GRAY}  This may take a few minutes on first run...${NC}"
    
    pnpm install
    
    echo -e "${GREEN}  ✓ Dependencies installed${NC}"
else
    echo -e "\n${GRAY}[2/7] Skipping dependency installation...${NC}"
fi

# --- Build Shared Package ----------------------------------------------------
echo -e "\n${YELLOW}[3/7] Building shared package...${NC}"

pnpm --filter=@ai-career/shared run build

echo -e "${GREEN}  ✓ Shared package built${NC}"

# --- Setup Environment Files -------------------------------------------------
if [ "$SKIP_ENV" = false ]; then
    echo -e "\n${YELLOW}[4/7] Setting up environment files...${NC}"

    # Setup API .env
    if [ ! -f "apps/api/.env" ]; then
        if [ -f "apps/api/.env.local" ]; then
            echo -e "${GRAY}  Creating apps/api/.env from .env.local template...${NC}"
            cp apps/api/.env.local apps/api/.env
            
            # Generate JWT secret
            JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
            
            # Replace placeholder in .env (works on both Linux and macOS)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/<CHANGE_ME_TO_LONG_RANDOM_STRING>/$JWT_SECRET/" apps/api/.env
            else
                sed -i "s/<CHANGE_ME_TO_LONG_RANDOM_STRING>/$JWT_SECRET/" apps/api/.env
            fi
            
            echo -e "${GREEN}  ✓ Created apps/api/.env with generated JWT secret${NC}"
        else
            echo -e "${GRAY}  Copying apps/api/.env.example to apps/api/.env...${NC}"
            cp apps/api/.env.example apps/api/.env
            echo -e "${YELLOW}  ⚠ Please edit apps/api/.env and set JWT_ACCESS_SECRET${NC}"
        fi
    else
        echo -e "${GREEN}  ✓ apps/api/.env already exists${NC}"
    fi

    # Setup Web .env.local
    if [ ! -f "apps/web/.env.local" ]; then
        if [ -f "apps/web/.env.local.template" ]; then
            echo -e "${GRAY}  Creating apps/web/.env.local from template...${NC}"
            cp apps/web/.env.local.template apps/web/.env.local
            echo -e "${GREEN}  ✓ Created apps/web/.env.local${NC}"
        else
            echo -e "${GRAY}  Copying apps/web/.env.example to apps/web/.env.local...${NC}"
            cp apps/web/.env.example apps/web/.env.local
            echo -e "${GREEN}  ✓ Created apps/web/.env.local${NC}"
        fi
    else
        echo -e "${GREEN}  ✓ apps/web/.env.local already exists${NC}"
    fi
else
    echo -e "\n${GRAY}[4/7] Skipping environment file setup...${NC}"
fi

# --- Start Docker Infrastructure ---------------------------------------------
if [ "$SKIP_DOCKER" = false ]; then
    echo -e "\n${YELLOW}[5/7] Starting Docker infrastructure...${NC}"
    echo -e "${GRAY}  Starting PostgreSQL, Redis, and JobSpy...${NC}"

    docker compose -f docker-compose.local.yml up -d

    echo -e "${GREEN}  ✓ Docker services started${NC}"
    
    # Wait for services to be healthy
    echo -e "${GRAY}  Waiting for services to be ready...${NC}"
    sleep 5
    
    echo -e "${GREEN}  ✓ Services are running${NC}"
else
    echo -e "\n${GRAY}[5/7] Skipping Docker setup...${NC}"
fi

# --- Run Database Migrations -------------------------------------------------
echo -e "\n${YELLOW}[6/7] Running database migrations...${NC}"
echo -e "${GRAY}  This will create all database tables...${NC}"

# Wait a bit more for PostgreSQL to be fully ready
sleep 3

cd apps/api
pnpm prisma:migrate:deploy
cd ../..

echo -e "${GREEN}  ✓ Database migrations completed${NC}"

# --- Seed Database -----------------------------------------------------------
echo -e "\n${YELLOW}[7/7] Seeding database with demo data...${NC}"

cd apps/api
if pnpm prisma:seed; then
    echo -e "${GREEN}  ✓ Database seeded with demo users and jobs${NC}"
else
    echo -e "${YELLOW}  ⚠ Failed to seed database (this is optional)${NC}"
fi
cd ../..

# --- Setup Complete ----------------------------------------------------------
echo -e "\n${CYAN}===================================================================${NC}"
echo -e "${GREEN}  Setup Complete! 🎉${NC}"
echo -e "${CYAN}===================================================================${NC}"

echo -e "\n${YELLOW}Demo Login Credentials:${NC}"
echo -e "  Regular User:  demo@aicareer.dev / Password123!"
echo -e "  Admin User:    admin@aicareer.dev / Password123!"

echo -e "\n${CYAN}▶ To start development:${NC}"
echo -e "  1. Start API:   pnpm --filter=@ai-career/api run dev"
echo -e "  2. Start Web:   pnpm --filter=@ai-career/web run dev"
echo -e "${GRAY}     (in a separate terminal)${NC}"

echo -e "\n${CYAN}▶ Quick start (parallel):${NC}"
echo -e "  pnpm dev        # Starts both API and Web"

echo -e "\n${CYAN}▶ Access URLs:${NC}"
echo -e "  Web App:        http://localhost:3000"
echo -e "  API:            http://localhost:4000/api"
echo -e "  API Docs:       http://localhost:4000/api/docs"

echo -e "\n${CYAN}▶ Stop infrastructure:${NC}"
echo -e "  docker compose -f docker-compose.local.yml down"

echo -e "\n${CYAN}===================================================================${NC}"
echo ""
