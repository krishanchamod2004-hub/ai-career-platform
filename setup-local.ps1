# =============================================================================
# AI Career Platform - Local Development Setup Script (Windows)
# =============================================================================
# This script sets up and runs the local development environment
#
# Usage:
#   .\setup-local.ps1              # Interactive setup
#   .\setup-local.ps1 -SkipEnv     # Skip environment file setup
#   .\setup-local.ps1 -SkipDocker  # Skip Docker Compose setup
# =============================================================================

param(
    [switch]$SkipEnv = $false,
    [switch]$SkipDocker = $false,
    [switch]$SkipInstall = $false
)

$ErrorActionPreference = "Stop"

Write-Host "`n===================================================================" -ForegroundColor Cyan
Write-Host "  AI Career Platform - Local Development Setup" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

# --- Check Prerequisites -----------------------------------------------------
Write-Host "`n[1/7] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js not found. Please install Node.js 20+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check pnpm
$pnpmVersion = pnpm --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ pnpm: v$pnpmVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ pnpm not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host "  ✓ pnpm installed" -ForegroundColor Green
}

# Check Docker
if (-not $SkipDocker) {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
        exit 1
    }

    # Check Docker Compose
    $composeVersion = docker compose version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker Compose: $composeVersion" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Docker Compose not found. Please update Docker Desktop." -ForegroundColor Red
        exit 1
    }
}

# --- Install Dependencies ----------------------------------------------------
if (-not $SkipInstall) {
    Write-Host "`n[2/7] Installing dependencies..." -ForegroundColor Yellow
    Write-Host "  This may take a few minutes on first run..." -ForegroundColor Gray
    
    pnpm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n[2/7] Skipping dependency installation..." -ForegroundColor Gray
}

# --- Build Shared Package ----------------------------------------------------
Write-Host "`n[3/7] Building shared package..." -ForegroundColor Yellow

pnpm --filter=@ai-career/shared run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Shared package built" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to build shared package" -ForegroundColor Red
    exit 1
}

# --- Setup Environment Files -------------------------------------------------
if (-not $SkipEnv) {
    Write-Host "`n[4/7] Setting up environment files..." -ForegroundColor Yellow

    # Setup API .env
    if (-not (Test-Path "apps/api/.env")) {
        if (Test-Path "apps/api/.env.local") {
            Write-Host "  Creating apps/api/.env from .env.local template..." -ForegroundColor Gray
            Copy-Item "apps/api/.env.local" "apps/api/.env"
            
            # Generate JWT secret
            $jwtSecret = -join ((1..64) | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 126) })
            
            # Replace placeholder in .env
            $envContent = Get-Content "apps/api/.env" -Raw
            $envContent = $envContent -replace '<CHANGE_ME_TO_LONG_RANDOM_STRING>', $jwtSecret
            Set-Content "apps/api/.env" $envContent
            
            Write-Host "  ✓ Created apps/api/.env with generated JWT secret" -ForegroundColor Green
        } else {
            Write-Host "  Copying apps/api/.env.example to apps/api/.env..." -ForegroundColor Gray
            Copy-Item "apps/api/.env.example" "apps/api/.env"
            Write-Host "  ⚠ Please edit apps/api/.env and set JWT_ACCESS_SECRET" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✓ apps/api/.env already exists" -ForegroundColor Green
    }

    # Setup Web .env.local
    if (-not (Test-Path "apps/web/.env.local")) {
        if (Test-Path "apps/web/.env.local.template") {
            Write-Host "  Creating apps/web/.env.local from template..." -ForegroundColor Gray
            Copy-Item "apps/web/.env.local.template" "apps/web/.env.local"
            Write-Host "  ✓ Created apps/web/.env.local" -ForegroundColor Green
        } else {
            Write-Host "  Copying apps/web/.env.example to apps/web/.env.local..." -ForegroundColor Gray
            Copy-Item "apps/web/.env.example" "apps/web/.env.local"
            Write-Host "  ✓ Created apps/web/.env.local" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✓ apps/web/.env.local already exists" -ForegroundColor Green
    }
} else {
    Write-Host "`n[4/7] Skipping environment file setup..." -ForegroundColor Gray
}

# --- Start Docker Infrastructure ---------------------------------------------
if (-not $SkipDocker) {
    Write-Host "`n[5/7] Starting Docker infrastructure..." -ForegroundColor Yellow
    Write-Host "  Starting PostgreSQL, Redis, and JobSpy..." -ForegroundColor Gray

    docker compose -f docker-compose.local.yml up -d

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker services started" -ForegroundColor Green
        
        # Wait for services to be healthy
        Write-Host "  Waiting for services to be ready..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
        
        $status = docker compose -f docker-compose.local.yml ps --format json | ConvertFrom-Json
        Write-Host "  ✓ Services are running" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to start Docker services" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n[5/7] Skipping Docker setup..." -ForegroundColor Gray
}

# --- Run Database Migrations -------------------------------------------------
Write-Host "`n[6/7] Running database migrations..." -ForegroundColor Yellow
Write-Host "  This will create all database tables..." -ForegroundColor Gray

# Wait a bit more for PostgreSQL to be fully ready
Start-Sleep -Seconds 3

Push-Location apps/api
pnpm prisma:migrate:deploy
$migrateResult = $LASTEXITCODE
Pop-Location

if ($migrateResult -eq 0) {
    Write-Host "  ✓ Database migrations completed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to run migrations" -ForegroundColor Red
    Write-Host "  Check if PostgreSQL is running: docker compose -f docker-compose.local.yml ps" -ForegroundColor Yellow
    exit 1
}

# --- Seed Database -----------------------------------------------------------
Write-Host "`n[7/7] Seeding database with demo data..." -ForegroundColor Yellow

Push-Location apps/api
pnpm prisma:seed
$seedResult = $LASTEXITCODE
Pop-Location

if ($seedResult -eq 0) {
    Write-Host "  ✓ Database seeded with demo users and jobs" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Failed to seed database (this is optional)" -ForegroundColor Yellow
}

# --- Setup Complete ----------------------------------------------------------
Write-Host "`n===================================================================" -ForegroundColor Cyan
Write-Host "  Setup Complete! 🎉" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Cyan

Write-Host "`nDemo Login Credentials:" -ForegroundColor Yellow
Write-Host "  Regular User:  demo@aicareer.dev / Password123!" -ForegroundColor White
Write-Host "  Admin User:    admin@aicareer.dev / Password123!" -ForegroundColor White

Write-Host "`n▶ To start development:" -ForegroundColor Cyan
Write-Host "  1. Start API:   pnpm --filter=@ai-career/api run dev" -ForegroundColor White
Write-Host "  2. Start Web:   pnpm --filter=@ai-career/web run dev" -ForegroundColor White
Write-Host "     (in a separate terminal)" -ForegroundColor Gray

Write-Host "`n▶ Quick start (parallel):" -ForegroundColor Cyan
Write-Host "  pnpm dev        # Starts both API and Web" -ForegroundColor White

Write-Host "`n▶ Access URLs:" -ForegroundColor Cyan
Write-Host "  Web App:        http://localhost:3000" -ForegroundColor White
Write-Host "  API:            http://localhost:4000/api" -ForegroundColor White
Write-Host "  API Docs:       http://localhost:4000/api/docs" -ForegroundColor White

Write-Host "`n▶ Stop infrastructure:" -ForegroundColor Cyan
Write-Host "  docker compose -f docker-compose.local.yml down" -ForegroundColor White

Write-Host "`n===================================================================" -ForegroundColor Cyan
Write-Host ""
