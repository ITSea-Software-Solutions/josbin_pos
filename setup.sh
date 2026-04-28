#!/usr/bin/env bash
# Josbin POS — monorepo first-time setup
# Run once after cloning: ./setup.sh
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}[Josbin POS] Starting setup...${NC}"

# ── Backend ──────────────────────────────────────────
echo -e "${YELLOW}[1/4] Setting up Laravel backend...${NC}"
if [ ! -d "backend" ]; then
  composer create-project laravel/laravel:^13.0 backend --prefer-dist
fi

cd backend

# Install required packages
composer require \
  laravel/sanctum \
  laravel/horizon \
  laravel/reverb \
  laravel/fortify \
  laravel/telescope \
  maatwebsite/excel \
  barryvdh/laravel-dompdf \
  spatie/laravel-permission \
  owen-it/laravel-auditing \
  stancl/tenancy \
  --no-interaction

# Dev packages
composer require --dev \
  phpunit/phpunit \
  --no-interaction

# Copy .env
if [ ! -f ".env" ]; then
  cp .env.example .env
  php artisan key:generate
fi

cd ..

# ── Frontend ─────────────────────────────────────────
echo -e "${YELLOW}[2/4] Setting up React + Electron frontend...${NC}"
cd frontend
npm install
cd ..

# ── Docker ───────────────────────────────────────────
echo -e "${YELLOW}[3/4] Building Docker containers...${NC}"
docker compose build --no-cache

# ── Start ────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Starting containers...${NC}"
docker compose up -d

echo ""
echo -e "${GREEN}✓ Josbin POS is running!${NC}"
echo -e "  API:       http://localhost:8080"
echo -e "  Reverb WS: ws://localhost:6001"
echo -e "  Horizon:   http://localhost:8080/horizon"
echo ""
echo -e "Run migrations: docker compose exec app php artisan migrate --seed"
