#!/bin/bash
# AWS EC2 deploy script — run this on your EC2 instance (Ubuntu 22.04)
set -e

echo "=== Harrie's Signals — Deploy Script ==="

# 1. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker ubuntu
fi

if ! command -v docker compose &> /dev/null; then
  echo "Installing Docker Compose..."
  sudo apt-get install -y docker-compose-plugin
fi

# 2. Set env vars (fill these in before running)
export TELEGRAM_TOKEN="${TELEGRAM_TOKEN:-8942449178:AAFCI6YpAFtFetd_AfON7UfTRGcgXOYQ9CU}"
export TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:--5101756848}"

# 3. Pull latest code
if [ -d "trading-system" ]; then
  cd trading-system && git pull && cd ..
else
  git clone https://github.com/singhdeepkanwar/harries-signals.git trading-system
  cd trading-system
fi

# 4. Create data dir for SQLite persistence
mkdir -p data

# 5. Build and start
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

echo ""
echo "=== Deployed! ==="
echo "Frontend : http://$(curl -s ifconfig.me)"
echo "Backend  : http://$(curl -s ifconfig.me):8000"
echo ""
echo "Logs: docker compose logs -f"
