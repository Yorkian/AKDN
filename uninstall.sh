#!/bin/bash

# ============================================================================
#  AKDN — Uninstall Script
#  https://github.com/Yorkian/AKDN
# ============================================================================

INSTALL_DIR="/opt/akdn"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}AKDN — Uninstaller${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run as root (sudo)${NC}"
  exit 1
fi

# Move out of install dir before deleting it
cd /root 2>/dev/null || cd /tmp

read -p "$(echo -e ${YELLOW}This will completely remove AKDN. Continue? [y/N] ${NC})" confirm < /dev/tty
if [[ ! "$confirm" =~ ^[yY]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Stop and remove PM2 process
if command -v pm2 &> /dev/null; then
  echo -e "${CYAN}Stopping AKDN service...${NC}"
  pm2 delete akdn 2>/dev/null && echo -e "${GREEN}✓ PM2 process removed${NC}" || echo -e "${YELLOW}  PM2 process not found, skipping${NC}"
  pm2 save 2>/dev/null
fi

# Remove project directory
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo -e "${GREEN}✓ Removed ${INSTALL_DIR}${NC}"
else
  echo -e "${YELLOW}  ${INSTALL_DIR} not found, skipping${NC}"
fi

echo ""
echo -e "${GREEN}✅ AKDN has been removed.${NC}"
echo ""
echo -e "  ${CYAN}Note:${NC} Node.js and PM2 were not removed."
echo -e "  To remove them manually:"
echo -e "    npm uninstall -g pm2"
echo -e "    pm2 unstartup"
echo ""
