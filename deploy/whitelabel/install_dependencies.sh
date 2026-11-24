#!/bin/bash

# ==============================================================================
# White-Label PBX & Billing System - Dependencies Installation Script
# ==============================================================================
# This script installs Kamailio, FreeSWITCH, PostgreSQL (v18), RTPEngine, Redis 8.x,
# Node.js (v24), and PM2 on Debian 12 / Ubuntu 22.04+.
# ==============================================================================

# Exit on error
set -e

# Colored output utilities
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;0m' # No Color

echo -e "${BLUE}======================================================================${NC}"
echo -e "${GREEN}      Starting White-Label PBX Dependencies Installation${NC}"
echo -e "${BLUE}======================================================================${NC}"

# 1. Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root or using sudo.${NC}"
  exit 1
fi

# On an existing PBX host, install only the packages voicemail needs. The full
# installer also upgrades PostgreSQL, Redis, FreeSWITCH and other services.
if [ "${1:-}" = "--voicemail-only" ]; then
  apt-get update
  apt-get install -y ffmpeg sox python3 python3-pip python3-venv acl
  command -v ffprobe >/dev/null || { echo "ffprobe is required for voicemail" >&2; exit 1; }
  echo "Voicemail media and Python dependencies are installed. Next: setup_everything.sh --voicemail-only"
  exit 0
fi
if [ "$#" -ne 0 ]; then
  echo "Usage: $0 [--voicemail-only]" >&2
  exit 2
fi
if [ -z "${FREESWITCH_PACKAGE_TOKEN:-}" ]; then
  echo "Set FREESWITCH_PACKAGE_TOKEN for a fresh FreeSWITCH installation" >&2
  exit 1
fi

# 2. Detect OS details
OS_NAME=$(lsb_release -si 2>/dev/null || cat /etc/os-release | grep -E '^ID=' | cut -d= -f2 | tr -d '"' | sed 's/./\u&/')
OS_CODENAME=$(lsb_release -sc 2>/dev/null || cat /etc/os-release | grep -E '^VERSION_CODENAME=' | cut -d= -f2 | tr -d '"')

echo -e "${YELLOW}Detected OS:${NC} $OS_NAME ($OS_CODENAME)"

if [ "$OS_NAME" != "Debian" ] && [ "$OS_NAME" != "Ubuntu" ]; then
  echo -e "${RED}Error: This script is only supported on Debian and Ubuntu systems.${NC}"
  exit 1
fi

# 3. Base Updates, System Utilities & Audio/Media Tools
echo -e "\n${YELLOW}[Step 1/10] Installing system utility tools & media dependencies...${NC}"
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git gnupg2 lsb-release ca-certificates apt-transport-https \
                   build-essential ufw fail2ban jq software-properties-common gpg sudo \
                   ffmpeg sox libsox-fmt-all acl zip unzip
command -v ffprobe >/dev/null || { echo "ffprobe is required for voicemail" >&2; exit 1; }

# 4. Node.js v24 & PM2
echo -e "\n${YELLOW}[Step 2/10] Installing Node.js v24 & PM2...${NC}"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
npm install -g pm2@7.0.1

# 5. PostgreSQL 18
echo -e "\n${YELLOW}[Step 3/10] Adding PostgreSQL 18 repository...${NC}"
install -d /etc/apt/keyrings
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt ${OS_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update
apt-get install -y postgresql-18 postgresql-contrib-18

# 6. Redis 8.x
echo -e "\n${YELLOW}[Step 4/10] Installing Redis 8.x from official repo...${NC}"
curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" > /etc/apt/sources.list.d/redis.list
apt-get update
apt-get install -y redis

# 7. RTPEngine (dfx.at)
echo -e "\n${YELLOW}[Step 5/10] Installing RTPEngine from dfx.at...${NC}"
RTP_CODENAME=$OS_CODENAME
if [ "$OS_NAME" = "Ubuntu" ] && [ "$OS_CODENAME" = "noble" ]; then
  RTP_CODENAME="jammy"
fi

wget -qO /tmp/rtpengine-dfx-repo-keyring_1.0_all.deb https://rtpengine.dfx.at/latest/pool/main/r/rtpengine-dfx-repo-keyring/rtpengine-dfx-repo-keyring_1.0_all.deb
dpkg -i /tmp/rtpengine-dfx-repo-keyring_1.0_all.deb || true
apt-get install -f -y

echo "deb [signed-by=/usr/share/keyrings/dfx.at-rtpengine-archive-keyring.gpg] https://rtpengine.dfx.at/latest ${RTP_CODENAME} main" | tee /etc/apt/sources.list.d/dfx.at-rtpengine.list
apt-get update
apt-get install -y linux-headers-$(uname -r) || echo -e "${YELLOW}Warning: Kernel headers not found, proceeding with user-space RTPEngine only${NC}"
apt-get install -y rtpengine rtpengine-daemon

# 8. Kamailio & Modules
echo -e "\n${YELLOW}[Step 6/10] Installing Kamailio & required modules...${NC}"
apt-get install -y kamailio \
                   kamailio-postgres-modules \
                   kamailio-tls-modules \
                   kamailio-websocket-modules \
                   kamailio-utils-modules \
                   kamailio-extra-modules
systemctl enable kamailio

# 9. FreeSWITCH via fsget
echo -e "\n${YELLOW}[Step 7/10] Installing FreeSWITCH via official script...${NC}"
curl -sSL https://freeswitch.org/fsget | bash -s "$FREESWITCH_PACKAGE_TOKEN" release install
systemctl enable freeswitch

# 10. Python 3 & Virtualenv
echo -e "\n${YELLOW}[Step 8/10] Installing Python 3 and virtualenv dependencies...${NC}"
apt-get install -y python3 python3-pip python3-venv python3-dev libpq-dev

# 11. Nginx & Certbot
echo -e "\n${YELLOW}[Step 9/10] Installing Nginx & Certbot...${NC}"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx

# 12. Enable services
echo -e "\n${YELLOW}[Step 10/10] Enabling core services...${NC}"
systemctl enable redis-server postgresql

echo -e "\n${BLUE}======================================================================${NC}"
echo -e "${GREEN}   All packages and dependencies have been installed successfully!${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "Run the setup configuration script to configure databases, Redis,"
echo -e "virtual environments, and PM2/Nginx vhosts."
echo -e "${BLUE}======================================================================${NC}"
