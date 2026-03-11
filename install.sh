#!/bin/bash
set -e

# ============================================================================
#  AKDN — AI API Key Delivery Network
#  One-click Install Script
#  https://github.com/Yorkian/AKDN
# ============================================================================

INSTALL_DIR="/opt/akdn"
AKDN_PORT=3060
NODE_MIN_VERSION=18

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      AKDN — AI API Key Delivery Network   ║${NC}"
echo -e "${CYAN}║      One-click Installer                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

# ---- Check root ----
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run as root (sudo)${NC}"
  exit 1
fi

# ---- Check OS ----
if [ ! -f /etc/debian_version ] && [ ! -f /etc/lsb-release ]; then
  echo -e "${YELLOW}Warning: This script is designed for Debian/Ubuntu. Proceeding anyway...${NC}"
fi

# ---- Install Node.js if needed ----
install_nodejs() {
  echo -e "${YELLOW}Installing Node.js 20 LTS...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]; then
    echo -e "${YELLOW}Node.js v${NODE_VERSION} found, but v${NODE_MIN_VERSION}+ required.${NC}"
    install_nodejs
  else
    echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"
  fi
else
  install_nodejs
fi

# ---- Install build tools if needed ----
if ! command -v curl &> /dev/null; then
  echo -e "${YELLOW}Installing curl...${NC}"
  apt-get install -y curl
fi

# ---- Install PM2 if needed ----
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}Installing PM2...${NC}"
  npm install -g pm2
fi
echo -e "${GREEN}✓ PM2 $(pm2 -v) detected${NC}"

# ---- Clone or update project ----
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${YELLOW}Existing installation found. Updating...${NC}"
  cd "$INSTALL_DIR"
  git pull
else
  if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory $INSTALL_DIR exists but is not a git repo.${NC}"
    echo -e "${YELLOW}Backing up to ${INSTALL_DIR}.bak...${NC}"
    mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
  fi
  echo -e "${CYAN}Cloning AKDN...${NC}"
  git clone https://github.com/Yorkian/AKDN.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ---- Install dependencies ----
echo -e "${CYAN}Installing backend dependencies...${NC}"
npm install --production=false

echo -e "${CYAN}Installing frontend dependencies...${NC}"
cd frontend && npm install && cd ..

# ---- Build ----
echo -e "${CYAN}Building backend (TypeScript)...${NC}"
npx tsc

echo -e "${CYAN}Building frontend (Vue 3)...${NC}"
cd frontend && npx vite build && cd ..

# ---- Setup .env ----
if [ ! -f .env ]; then
  echo -e "${CYAN}Generating encryption keys...${NC}"
  node setup-keys.js
else
  echo -e "${GREEN}✓ .env already exists, skipping key generation${NC}"
fi

# ---- Setup PM2 ----
echo -e "${CYAN}Starting AKDN with PM2...${NC}"
pm2 delete akdn 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup 2>/dev/null || true

# ---- Verify ----
sleep 2
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${AKDN_PORT}/api/auth/status | grep -q "200"; then
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║      ✅ AKDN installed successfully!       ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}Dashboard:${NC}  http://$(hostname -I | awk '{print $1}'):${AKDN_PORT}"
  echo -e "  ${CYAN}Install dir:${NC} ${INSTALL_DIR}"
  echo -e "  ${CYAN}Manage:${NC}     pm2 status / pm2 logs akdn / pm2 restart akdn"
  echo ""
  echo -e "  ${YELLOW}First visit the dashboard to create your admin account.${NC}"
  echo ""
else
  echo ""
  echo -e "${RED}⚠ Service may not have started correctly.${NC}"
  echo -e "  Check logs: ${CYAN}pm2 logs akdn --lines 20${NC}"
  echo ""
fi
