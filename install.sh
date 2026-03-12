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
REPO_URL="https://github.com/Yorkian/AKDN.git"

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

# Ensure working directory exists (may be deleted by uninstall)
cd /root 2>/dev/null || cd /tmp

# ---- Detect package manager ----
if command -v apt-get &> /dev/null; then
  PKG_MGR="apt-get"
  PKG_UPDATE="apt-get update -qq"
elif command -v yum &> /dev/null; then
  PKG_MGR="yum"
  PKG_UPDATE="yum makecache -q"
elif command -v dnf &> /dev/null; then
  PKG_MGR="dnf"
  PKG_UPDATE="dnf makecache -q"
else
  echo -e "${RED}Error: No supported package manager found (apt/yum/dnf)${NC}"
  exit 1
fi

echo -e "${CYAN}[1/7] Checking system dependencies...${NC}"

# ---- Update package lists ----
$PKG_UPDATE 2>/dev/null || true

# ---- Install essential packages ----
DEPS_TO_INSTALL=""

# git — required for cloning and updating
if ! command -v git &> /dev/null; then
  DEPS_TO_INSTALL="$DEPS_TO_INSTALL git"
fi

# curl — required for downloading Node.js setup, health checks, provider tests
if ! command -v curl &> /dev/null; then
  DEPS_TO_INSTALL="$DEPS_TO_INSTALL curl"
fi

# build-essential / gcc / make — required if using better-sqlite3 (native module)
if ! command -v gcc &> /dev/null || ! command -v make &> /dev/null; then
  if [ "$PKG_MGR" = "apt-get" ]; then
    DEPS_TO_INSTALL="$DEPS_TO_INSTALL build-essential"
  else
    DEPS_TO_INSTALL="$DEPS_TO_INSTALL gcc gcc-c++ make"
  fi
fi

# python3 — required by node-gyp for native module compilation
if ! command -v python3 &> /dev/null; then
  DEPS_TO_INSTALL="$DEPS_TO_INSTALL python3"
fi

# ca-certificates — required for HTTPS connections
if [ ! -d /etc/ssl/certs ] || [ ! -f /etc/ssl/certs/ca-certificates.crt ]; then
  DEPS_TO_INSTALL="$DEPS_TO_INSTALL ca-certificates"
fi

if [ -n "$DEPS_TO_INSTALL" ]; then
  echo -e "${YELLOW}Installing missing packages:${NC} $DEPS_TO_INSTALL"
  $PKG_MGR install -y $DEPS_TO_INSTALL
else
  echo -e "${GREEN}✓ All system dependencies present${NC}"
fi

# ---- Install Node.js if needed ----
echo -e "${CYAN}[2/7] Checking Node.js...${NC}"

install_nodejs() {
  echo -e "${YELLOW}Installing Node.js 20 LTS...${NC}"
  if [ "$PKG_MGR" = "apt-get" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    $PKG_MGR install -y nodejs
  fi
}

if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]; then
    echo -e "${YELLOW}Node.js v${NODE_VERSION} found, but v${NODE_MIN_VERSION}+ required.${NC}"
    install_nodejs
  else
    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
  fi
else
  install_nodejs
fi

# Verify npm is available
if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm not found after Node.js installation${NC}"
  exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# ---- Install PM2 if needed ----
echo -e "${CYAN}[3/7] Checking PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}Installing PM2...${NC}"
  npm install -g pm2
fi
echo -e "${GREEN}✓ PM2 $(pm2 -v)${NC}"

# ---- Clone or update project ----
echo -e "${CYAN}[4/7] Downloading AKDN...${NC}"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${YELLOW}Existing installation found. Updating...${NC}"
  cd "$INSTALL_DIR"
  git pull
else
  if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Backing up existing ${INSTALL_DIR}...${NC}"
    mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
  fi
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ---- Install dependencies ----
echo -e "${CYAN}[5/7] Installing dependencies...${NC}"
npm install --production=false
cd frontend && npm install && cd ..

# ---- Build ----
echo -e "${CYAN}[6/7] Building...${NC}"
npx tsc
cd frontend && rm -rf dist && npx vite build && cd ..

# ---- Setup .env and start ----
echo -e "${CYAN}[7/7] Starting service...${NC}"
if [ ! -f .env ]; then
  node setup-keys.js
else
  echo -e "${GREEN}✓ .env exists, keeping current configuration${NC}"
fi

pm2 delete akdn 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup 2>/dev/null || true

# ---- Verify ----
sleep 3
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")

if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${AKDN_PORT}/api/auth/status" 2>/dev/null | grep -q "200"; then
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║        ✅ AKDN installed successfully!         ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}Dashboard:${NC}   http://${SERVER_IP}:${AKDN_PORT}"
  echo -e "  ${CYAN}Install dir:${NC} ${INSTALL_DIR}"
  echo -e "  ${CYAN}Manage:${NC}      pm2 status / pm2 logs akdn / pm2 restart akdn"
  echo ""
  echo -e "  ${YELLOW}First visit the dashboard to create your admin account.${NC}"
  echo ""
  echo -e "  ${CYAN}https://github.com/Yorkian/AKDN${NC}"
  echo ""
else
  echo ""
  echo -e "${RED}⚠ Service may not have started correctly.${NC}"
  echo -e "  Check logs: ${CYAN}pm2 logs akdn --lines 20${NC}"
  echo ""
  echo -e "  ${CYAN}https://github.com/Yorkian/AKDN${NC}"
  echo ""
fi
