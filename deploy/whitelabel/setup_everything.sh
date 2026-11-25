#!/bin/bash

# ==============================================================================
# White-Label PBX & Billing System - System Configuration Setup Script
# ==============================================================================
# This script configures PostgreSQL, Redis, Python venv, soxuser/IVR audio,
# and restores databases from dump files.
# Kamailio, FreeSWITCH, and RTPEngine are installed but configured manually.
# ==============================================================================

# Exit on error
set -e

# Colored output utilities
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;0m' # No Color

# Default values (can be overridden via environment variables)
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

echo -e "${BLUE}======================================================================${NC}"
echo -e "${GREEN}      Starting White-Label PBX System Configuration & Setup${NC}"
echo -e "${BLUE}======================================================================${NC}"

# 1. Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root or using sudo.${NC}"
  exit 1
fi

setup_voicemail() {
  local backend_user="${PBX_BACKEND_USER:-root}"
  local storage_root="/var/lib/pbx-voicemail"
  local beep="/opt/ivr_audio/system/voicemail_beep.wav"

  id "$backend_user" >/dev/null 2>&1 || { echo "PBX backend user $backend_user does not exist" >&2; return 1; }
  id freeswitch >/dev/null 2>&1 || { echo "FreeSWITCH account does not exist" >&2; return 1; }
  id soxuser >/dev/null 2>&1 || { echo "Audio Library account soxuser does not exist" >&2; return 1; }
  for target in "$storage_root" "$storage_root/incoming" /opt/ivr_audio/system; do
    [ ! -L "$target" ] || { echo "Refusing symlinked voicemail path: $target" >&2; return 1; }
  done

  getent group freeswitch >/dev/null || { echo "FreeSWITCH group does not exist" >&2; return 1; }
  if ! id pbx-voicemail >/dev/null 2>&1; then
    useradd --system --gid freeswitch --home-dir "$storage_root" \
      --no-create-home --shell /usr/sbin/nologin pbx-voicemail
  fi
  usermod -aG freeswitch pbx-voicemail
  usermod -aG freeswitch soxuser
  usermod -aG freeswitch "$backend_user"

  install -d -o "$backend_user" -g freeswitch -m 2770 "$storage_root" "$storage_root/incoming"
  install -d -o soxuser -g freeswitch -m 2775 /opt/ivr_audio/system
  if [ ! -e "$beep" ]; then
    sox -n -r 16000 -c 1 -b 16 -e signed-integer "$beep" synth 0.25 sine 1000
    chown soxuser:freeswitch "$beep"
    chmod 0644 "$beep"
  fi

  echo "Voicemail uses FreeSWITCH's primary group: $(id -g freeswitch)"
  for prompt in voicemail_default.wav voicemail_full.wav; do
    if [ ! -r "/opt/ivr_audio/system/$prompt" ]; then
      echo "Add a spoken /opt/ivr_audio/system/$prompt before deploying voicemail." >&2
    fi
  done
  echo "FreeSWITCH can keep its existing -u freeswitch -g freeswitch service command."
  echo "If existing voicemail files have older permissions, follow cdr-whitelabel/voicemail_ingester/README.md before starting the worker."
}

if [ "${1:-}" = "--voicemail-only" ]; then
  [ "$#" -eq 1 ] || { echo "Usage: $0 [--voicemail-only]" >&2; exit 2; }
  setup_voicemail
  exit 0
fi
if [ "$#" -ne 0 ]; then
  echo "Usage: $0 [--voicemail-only]" >&2
  exit 2
fi
if [ -z "$REDIS_PASSWORD" ] || [ -z "${SOXUSER_PASSWORD:-}" ]; then
  echo "Set REDIS_PASSWORD and SOXUSER_PASSWORD for a fresh system setup" >&2
  exit 1
fi

# Auto-detect Public IP
PUBLIC_IP=$(curl -s https://ifconfig.me || curl -s https://api.ipify.org || echo "YOUR_PUBLIC_IP")
echo -e "${YELLOW}Detected Public IP:${NC} $PUBLIC_IP"

# ==============================================================================
# Step 1: PostgreSQL Configuration (localhost only)
# ==============================================================================
echo -e "\n${YELLOW}[Step 1/5] Ensuring PostgreSQL is running (localhost only)...${NC}"

systemctl restart postgresql
systemctl enable postgresql

# ==============================================================================
# Step 2: Restore PostgreSQL Roles and Databases from Dump
# ==============================================================================
echo -e "\n${YELLOW}[Step 2/5] Restoring PostgreSQL roles and databases from /tmp...${NC}"

DUMP_DIR="/tmp"

# Restore roles first
if [ -f "$DUMP_DIR/postgres_roles.sql" ]; then
  echo -e "Restoring database roles from $DUMP_DIR/postgres_roles.sql..."
  sudo -u postgres psql -f "$DUMP_DIR/postgres_roles.sql" || echo -e "${YELLOW}Warning: Some role restoration statements failed or roles already exist.${NC}"
else
  echo -e "${RED}Error: postgres_roles.sql not found in $DUMP_DIR. Skipping role restoration.${NC}"
fi

# Find correct pg_restore binary dynamically
PG_RESTORE_BIN=$(ls /usr/lib/postgresql/*/bin/pg_restore 2>/dev/null | head -n 1)
if [ -z "$PG_RESTORE_BIN" ]; then
  PG_RESTORE_BIN="pg_restore"
fi
echo -e "Using pg_restore binary: $PG_RESTORE_BIN"

# Define database-to-dump-file mapping
declare -A DB_DUMPS=(
  ["freeswitch"]="freeswitch_schema.dump"
  ["bala_billing"]="bala_billing_full.backup"
  ["analytics"]="analytics_schema.dump"
)

# Restore each database
for DB_NAME in "${!DB_DUMPS[@]}"; do
  DUMP_FILE="$DUMP_DIR/${DB_DUMPS[$DB_NAME]}"

  if [ -f "$DUMP_FILE" ]; then
    echo -e "Restoring database $DB_NAME from $DUMP_FILE..."

    # Terminate active connections
    sudo -u postgres psql -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '$DB_NAME'
    AND pid <> pg_backend_pid();
    " || true

    sudo -u postgres dropdb --if-exists "$DB_NAME" || true
    sudo -u postgres createdb "$DB_NAME" || true

    sudo -u postgres "$PG_RESTORE_BIN" \
      -d "$DB_NAME" \
      --verbose \
      "$DUMP_FILE" || echo -e "${YELLOW}Warning: pg_restore for $DB_NAME finished with warnings/errors.${NC}"
  else
    echo -e "${YELLOW}Warning: Dump file for $DB_NAME not found at $DUMP_FILE, skipping.${NC}"
  fi
done

# ==============================================================================
# Step 3: Redis Security Configuration
# ==============================================================================
echo -e "\n${YELLOW}[Step 3/5] Configuring Redis Server security...${NC}"
if [ -f /etc/redis/redis.conf ]; then
  cp /etc/redis/redis.conf /etc/redis/redis.conf.bak
  # Set requirepass configuration
  sed -i "s/#\s*requirepass\s.*/requirepass ${REDIS_PASSWORD}/g" /etc/redis/redis.conf
  sed -i "s/requirepass\s.*/requirepass ${REDIS_PASSWORD}/g" /etc/redis/redis.conf

  # If requirepass is still not set in active lines, append it
  if ! grep -q "^requirepass " /etc/redis/redis.conf; then
    echo -e "\nrequirepass ${REDIS_PASSWORD}" >> /etc/redis/redis.conf
  fi

  systemctl restart redis-server
  systemctl enable redis-server
  echo -e "${GREEN}Redis security configured and restarted successfully.${NC}"
else
  echo -e "${RED}Redis configuration file not found at /etc/redis/redis.conf${NC}"
fi

# ==============================================================================
# Step 4: Python Virtual Environment Configuration
# ==============================================================================
echo -e "\n${YELLOW}[Step 4/5] Setting up dedicated Python Virtual Environment...${NC}"
mkdir -p /opt/venv
python3 -m venv /opt/venv
source /opt/venv/bin/activate
pip install --upgrade pip
# Install standard modules commonly needed for PBX python helpers
pip install psycopg2-binary redis requests uvicorn fastapi gunicorn python-dotenv || echo -e "${YELLOW}Warning: Python packages failed to install. Install manually later.${NC}"
deactivate

# ==============================================================================
# Step 5: Sox User & IVR Directory Configuration
# ==============================================================================
echo -e "\n${YELLOW}[Step 5/5] Configuring soxuser and /opt/ivr_audio folder permissions...${NC}"

# Create soxuser if it does not exist
if ! id "soxuser" &>/dev/null; then
  useradd -m -s /bin/bash soxuser
  printf 'soxuser:%s\n' "$SOXUSER_PASSWORD" | chpasswd
fi

# Ensure freeswitch group exists and add soxuser to it
groupadd -f freeswitch
usermod -aG freeswitch soxuser

# Create audio directories
mkdir -p /opt/ivr_audio/system

# Assign permissions — setgid so new user dirs inherit freeswitch group
chown -R soxuser:freeswitch /opt/ivr_audio
chmod -R 775 /opt/ivr_audio
chmod g+s /opt/ivr_audio
chmod 2775 /opt/ivr_audio/system

# Install and set default ACL so new subdirs get group rwx automatically
apt-get install -y acl 2>/dev/null || true
setfacl -d -m g::rwx /opt/ivr_audio

# Create call recordings directory (/opt/recordings)
mkdir -p /opt/recordings
chown -R freeswitch:freeswitch /opt/recordings
chmod 2775 /opt/recordings
setfacl -d -m u:freeswitch:rwx,g:freeswitch:rwx,o:rx /opt/recordings
setfacl -R -m u:freeswitch:rwx,g:freeswitch:rwx /opt/recordings

# Ensure SSH allows password authentication for soxuser (required for local SFTP uploads)
echo -e "Configuring SSH to allow password authentication for soxuser..."
SSHD_CONFIG="/etc/ssh/sshd_config"
if [ -f "$SSHD_CONFIG" ]; then
  # Remove existing Match User soxuser block if it exists to avoid duplication
  sed -i '/Match User soxuser/,+2d' "$SSHD_CONFIG"

  # Append Match User block to enable password authentication for soxuser
  cat <<EOF >> "$SSHD_CONFIG"

Match User soxuser
    PasswordAuthentication yes
EOF

  # Check if AllowUsers is defined. If it is, append soxuser to AllowUsers
  if grep -q "^AllowUsers" "$SSHD_CONFIG"; then
    if ! grep -E "^AllowUsers.*soxuser" "$SSHD_CONFIG"; then
      sed -i 's/^AllowUsers \(.*\)/AllowUsers \1 soxuser/g' "$SSHD_CONFIG"
    fi
  fi

  # Reload SSH service
  systemctl reload sshd || systemctl reload ssh || echo -e "${YELLOW}Warning: Could not reload SSH service. Please reload manually.${NC}"
fi

echo -e "${GREEN}Audio directory permissions and SSH SFTP settings successfully set for soxuser & freeswitch.${NC}"

# Voicemail uses a private recording store and a shared group. On an existing
# host, run this step with --voicemail-only; never rerun the database restore.
setup_voicemail


# ==============================================================================
# Finish Installation Summary
# ==============================================================================
echo -e "\n${BLUE}======================================================================${NC}"
echo -e "${GREEN}   White-Label PBX & Billing System Setup Completed Successfully!${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo -e "${YELLOW}Server Configuration Summary:${NC}"
echo -e "  * Public IP:             $PUBLIC_IP"
echo -e "  * Redis Password Set:    Yes"
echo -e "  * SFTP System User:      soxuser (password supplied by SOXUSER_PASSWORD)"
echo -e "  * Audio Directory:       /opt/ivr_audio (Writable by soxuser:freeswitch, setgid enabled)"
echo -e "  * Python Virtualenv:     /opt/venv"
echo -e "  * Voicemail Storage:     /var/lib/pbx-voicemail (freeswitch group)"
echo -e "${BLUE}======================================================================${NC}"
echo -e "${YELLOW}Manual Steps Remaining:${NC}"
echo -e "  1. Configure Kamailio (kamailio.cfg, kamctlrc, kamdbctl create)"
echo -e "  2. Configure FreeSWITCH (modules, xml_curl, dialplan)"
echo -e "  3. Configure RTPEngine (/etc/rtpengine/rtpengine.conf)"
echo -e "  4. Deploy application services using deploy_code.sh"
echo -e "  5. Add spoken voicemail_default.wav and voicemail_full.wav prompts before enabling voicemail"
echo -e "${BLUE}======================================================================${NC}"
