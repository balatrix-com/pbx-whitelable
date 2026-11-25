#!/bin/bash

# ==============================================================================
# White-Label PBX & Billing System - Code Deployment & PM2 Hosting Script
# ==============================================================================
# This script pulls/clones application repositories into /opt/, builds the
# portal, and runs services under PM2/systemd. Use --voicemail-only on an
# existing host to avoid restarting unrelated billing and WebRTC services.
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
echo -e "${GREEN}      Starting White-Label PBX Repository Deployment & PM2 Hosting${NC}"
echo -e "${BLUE}======================================================================${NC}"

# 1. Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root or using sudo.${NC}"
  exit 1
fi
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--voicemail-only" ]; }; then
  echo "Usage: $0 [--voicemail-only]" >&2
  exit 2
fi
VOICEMAIL_ONLY=0
[ "${1:-}" = "--voicemail-only" ] && VOICEMAIL_ONLY=1

# SSH Key Check warning
echo -e "${YELLOW}Note: This script uses SSH (git@github.com) to clone/pull repositories.${NC}"
echo -e "${YELLOW}Please ensure your server's root user SSH key is added to GitHub.${NC}\n"

# Define target opt directory
TARGET_DIR="/opt"
mkdir -p "$TARGET_DIR"

# Define Python virtualenv path
VENV_PYTHON="/opt/venv/bin/python"
VENV_PIP="/opt/venv/bin/pip"
VENV_ACTIVATE="/opt/venv/bin/activate"

# Verify virtualenv exists
if [ ! -f "$VENV_PYTHON" ]; then
  echo -e "${RED}Error: Python virtual environment not found at /opt/venv.${NC}"
  echo -e "${RED}Please run setup_everything.sh first to configure system dependencies.${NC}"
  exit 1
fi

# ==============================================================================
# Helper Function: Clone or Pull Git Repositories
# ==============================================================================
deploy_repo() {
  local repo_url=$1
  local folder_name=$2
  local branch=${3:-}  # optional branch
  local dest_path="${TARGET_DIR}/${folder_name}"

  echo -e "${BLUE}----------------------------------------------------------------------${NC}"
  if [ -e "$dest_path/.git" ]; then
    echo -e "${YELLOW}Updating repository: $folder_name in $dest_path...${NC}"
    git -C "$dest_path" pull --ff-only
  elif [ -e "$dest_path" ]; then
    echo -e "${RED}Error: $dest_path exists but is not a Git checkout.${NC}" >&2
    exit 1
  else
    echo -e "${GREEN}Cloning repository: $folder_name into $dest_path...${NC}"
    cd "$TARGET_DIR"
    if [ -n "$branch" ]; then
      git clone -b "$branch" "$repo_url" "$folder_name" || {
        echo -e "${RED}Error: Failed to clone $repo_url (branch: $branch). Ensure SSH keys are configured.${NC}"
        exit 1
      }
    else
      git clone "$repo_url" "$folder_name" || {
        echo -e "${RED}Error: Failed to clone $repo_url. Ensure SSH keys are configured.${NC}"
        exit 1
      }
    fi
  fi
}

deploy_voicemail() {
  local backend_dir="${TARGET_DIR}/pbx-whitelable/backend"
  local frontend_dir="${TARGET_DIR}/pbx-whitelable/frontend"
  local worker_dir="${TARGET_DIR}/cdr-whitelabel/voicemail_ingester"
  local worker_env="/etc/pbx-voicemail-ingester.env"
  local routing_env="/opt/pbx_app/.env"
  local shared_gid

  # The generic deployment must not overwrite the existing JSON-CDR process
  # definitions. Only the voicemail worker is installed from this checkout.
  if [ "$VOICEMAIL_ONLY" -eq 1 ]; then
    deploy_repo "git@github.com:balatrix-com/pbx-whitelable.git" "pbx-whitelable"
  fi
  deploy_repo "git@github.com:balatrix-com/cdr-whitelabel.git" "cdr-whitelabel"
  deploy_repo "git@github.com:balatrix-com/t2-kam-whitlable.git" "t2-kam-whitlable"

  [ -f "$backend_dir/.env" ] || { echo "Configure $backend_dir/.env before deployment" >&2; return 1; }
  [ -f "$routing_env" ] || { echo "Configure $routing_env before deployment" >&2; return 1; }
  shared_gid=$(getent group pbx-voicemail | cut -d: -f3)
  [ -n "$shared_gid" ] && id pbx-voicemail >/dev/null 2>&1 || {
    echo "Run setup_everything.sh --voicemail-only to create the shared group and worker account" >&2
    return 1
  }
  [ -d /var/lib/pbx-voicemail/incoming ] || { echo "Voicemail storage is missing" >&2; return 1; }
  command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || {
    echo "Run install_dependencies.sh --voicemail-only to install ffmpeg/ffprobe" >&2
    return 1
  }
  for prompt in voicemail_default.wav voicemail_full.wav voicemail_beep.wav; do
    runuser -u freeswitch -- test -r "/opt/ivr_audio/system/$prompt" || {
      echo "FreeSWITCH cannot read /opt/ivr_audio/system/$prompt" >&2
      return 1
    }
  done
  node --env-file="$backend_dir/.env" -e '
    if (process.env.VOICEMAIL_STORAGE_ROOT && process.env.VOICEMAIL_STORAGE_ROOT !== "/var/lib/pbx-voicemail") {
      console.error("Backend VOICEMAIL_STORAGE_ROOT differs from the deployed shared path"); process.exit(1);
    }
    if (process.env.VOICEMAIL_GREETING_ROOT && process.env.VOICEMAIL_GREETING_ROOT !== "/opt/ivr_audio") {
      console.error("Backend VOICEMAIL_GREETING_ROOT differs from the deployed audio path"); process.exit(1);
    }
  '

  if [ ! -f "$worker_env" ]; then
    install -o root -g root -m 0600 "$worker_dir/.env.example" "$worker_env"
    echo "Created $worker_env. Set the real ESL and PBX database credentials, then rerun." >&2
    return 1
  fi
  chown root:root "$worker_env"
  chmod 0600 "$worker_env"
  node --env-file="$worker_env" -e '
    if (process.env.VOICEMAIL_STORAGE_ROOT && process.env.VOICEMAIL_STORAGE_ROOT !== "/var/lib/pbx-voicemail") {
      console.error("Worker VOICEMAIL_STORAGE_ROOT differs from the deployed shared path"); process.exit(1);
    }
  '
  node --env-file="$backend_dir/.env" --env-file="$worker_env" --env-file="$routing_env" -e '
    const fail = message => { console.error(message); process.exit(1); };
    if (!process.env.DATABASE_URL || !process.env.VOICEMAIL_DATABASE_URL) fail("PBX and voicemail database URLs are required");
    if (!process.env.FS_ESL_PASSWORD || process.env.FS_ESL_PASSWORD === "change-me") fail("Set FS_ESL_PASSWORD in the voicemail worker environment");
    if (process.env.VOICEMAIL_DATABASE_URL.includes("change-me")) fail("Set the real VOICEMAIL_DATABASE_URL");
    const pbxDb = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1));
    const workerDb = decodeURIComponent(new URL(process.env.VOICEMAIL_DATABASE_URL).pathname.slice(1));
    if (pbxDb !== workerDb || pbxDb !== process.env.ROUTING_DB_NAME) fail("PBX, XML-CURL, and voicemail worker database names must match");
    if (!process.env.ROUTING_DB_PASSWORD) fail("Set ROUTING_DB_PASSWORD for XML-CURL");
  '

  # FreeSWITCH's -u user -g group combination deliberately clears supplementary
  # groups. It must start with -u freeswitch and no -g for this shared group.
  # Never restart it automatically while calls may be active.
  local fs_pid
  fs_pid=$(systemctl show freeswitch -p MainPID --value 2>/dev/null || true)
  if [ -n "$fs_pid" ] && [ "$fs_pid" != 0 ] && [ -r "/proc/$fs_pid/status" ] && \
     [ "$(awk '/^Uid:/ { print $2 }' "/proc/$fs_pid/status")" != 0 ]; then
    if ! awk -v gid="$shared_gid" '/^Gid:/ { if ($2 == gid) found=1 } /^Groups:/ { for (i=2; i<=NF; i++) if ($i == gid) found=1 } END { exit !found }' "/proc/$fs_pid/status"; then
      echo "FreeSWITCH lacks pbx-voicemail group. Remove -g from its ExecStart (keep -u freeswitch), restart when calls are idle, then rerun." >&2
      return 1
    fi
  fi

  local fscurl_path
  fscurl_path=$(pm2 jlist | node -e 'const a=JSON.parse(require("fs").readFileSync(0,"utf8")).find(x=>x.name==="fscurl"); console.log(a?.pm2_env?.pm_exec_path||"")')
  if [ -n "$fscurl_path" ] && [ "$fscurl_path" != "/opt/pbx_app/t_2002.py" ]; then
    echo "fscurl runs $fscurl_path; refusing to replace a different script" >&2
    return 1
  fi

  if [ ! -x "$worker_dir/.venv/bin/python" ]; then
    python3 -m venv "$worker_dir/.venv"
  fi
  "$worker_dir/.venv/bin/pip" install -r "$worker_dir/requirements.txt"
  "$VENV_PIP" install python-dotenv
  "$VENV_PYTHON" -m py_compile "${TARGET_DIR}/t2-kam-whitlable/t_2002.py"

  # Keep the actual numeric group ID in the PBX environment, without changing
  # database credentials or replacing other local settings.
  if grep -q '^VOICEMAIL_SHARED_GID=' "$backend_dir/.env"; then
    sed -i "s/^VOICEMAIL_SHARED_GID=.*/VOICEMAIL_SHARED_GID=$shared_gid/" "$backend_dir/.env"
  else
    printf '\nVOICEMAIL_SHARED_GID=%s\n' "$shared_gid" >> "$backend_dir/.env"
  fi

  cd "$backend_dir"
  npm ci
  npx prisma migrate deploy
  npx prisma migrate status
  npx prisma generate
  npm run build
  cd "$frontend_dir"
  npm ci
  npm run build

  # PM2 fscurl executes this deployed path, not the Git checkout directly.
  install -o root -g root -m 0644 "${TARGET_DIR}/t2-kam-whitlable/t_2002.py" /opt/pbx_app/t_2002.py

  if pm2 describe fscurl >/dev/null 2>&1; then
    pm2 restart fscurl --update-env
  else
    pm2 start /opt/pbx_app/t_2002.py --name fscurl --interpreter "$VENV_PYTHON" --cwd /opt/pbx_app
  fi
  if pm2 describe pbx-backend >/dev/null 2>&1; then
    pm2 restart pbx-backend --update-env
  else
    cd "$backend_dir"
    pm2 start dist/src/main.js --name pbx-backend
  fi

  install -o root -g root -m 0644 "$worker_dir/voicemail-ingester.service.example" /etc/systemd/system/voicemail-ingester.service
  systemctl daemon-reload
  systemctl enable voicemail-ingester
  systemctl restart voicemail-ingester
  systemctl is-active --quiet voicemail-ingester || { journalctl -u voicemail-ingester -n 30 --no-pager; return 1; }

  echo "Voicemail deployed. If older greetings lack names, preview matches with:"
  echo "  cd $backend_dir && node --env-file=.env scripts/reconcile-voicemail-greetings.js"
  echo "Review the output before rerunning that command with --apply."
}

if [ "$VOICEMAIL_ONLY" -eq 1 ]; then
  deploy_voicemail
  # Never save an incomplete PM2 list after the old ESL writers were retired.
  pm2 jlist | node -e 'const apps=JSON.parse(require("fs").readFileSync(0,"utf8")); const needed=["cdr-collector","cdr-promoter","live-call-updater"]; const missing=needed.filter(name=>!apps.some(app=>app.name===name&&app.pm2_env?.status==="online")); if(missing.length){console.error("JSON-CDR services not online: "+missing.join(", ")); process.exit(1)}'
  pm2 save
  exit 0
fi

# ==============================================================================
# Step 1: Deploy All Repositories
# ==============================================================================
deploy_repo "git@github.com:balatrix-com/sub-billing-whitelable.git" "sub-billing-whitelable"
deploy_repo "git@github.com:balatrix-com/pbx-whitelable.git" "pbx-whitelable"
deploy_repo "git@github.com:balatrix-com/webrtc.git" "webrtc"
# The cdr-whitelabel checkout is pulled in deploy_voicemail for its worker;
# existing JSON CDR collector/promoter and ESL Redis updater PM2 definitions
# are not replaced by this generic script.
deploy_repo "git@github.com:balatrix-com/bal_analysis.git" "bal_analysis"
deploy_repo "git@github.com:balatrix-com/billing.git" "billing" "billing-whitelable"


# ==============================================================================
# Step 2: Build PBX and deploy voicemail routing/ingestion
# ==============================================================================
echo -e "\n${YELLOW}Configuring PBX White-Label Portal and voicemail...${NC}"
deploy_voicemail

# ==============================================================================
# Step 3: Build and Host Sub-Billing Whitelabel Portal
# ==============================================================================
echo -e "\n${YELLOW}Configuring Sub-Billing Whitelabel Portal...${NC}"
if [ -d "${TARGET_DIR}/sub-billing-whitelable" ]; then
  cd "${TARGET_DIR}/sub-billing-whitelable"
  echo -e "Installing dependencies..."
  npm install

  echo -e "Starting sub-billing under PM2..."
  pm2 delete sub-billing 2>/dev/null || true
  pm2 start src/server.js --name "sub-billing"
fi

# ==============================================================================
# Step 4: Build and Host WebRTC Phone Portal
# ==============================================================================
echo -e "\n${YELLOW}Configuring WebRTC Phone Portal...${NC}"
if [ -d "${TARGET_DIR}/webrtc" ]; then
  # Determine if next-app subfolder exists
  if [ -d "${TARGET_DIR}/webrtc/next-app" ]; then
    cd "${TARGET_DIR}/webrtc/next-app"
  else
    cd "${TARGET_DIR}/webrtc"
  fi

  echo -e "Installing Next.js dependencies..."
  npm install

  echo -e "Building Next.js application..."
  npm run build || true

  echo -e "Starting webrtc-app under PM2 (Port 3001)...${NC}"
  pm2 delete webrtc-app 2>/dev/null || true
  pm2 start node_modules/next/dist/bin/next --name "webrtc-app" -- start -p 3001
fi

# ==============================================================================
# Step 5: Retire legacy ESL CDR writer from PM2 startup
# ==============================================================================
pm2 delete monitor 2>/dev/null || true

# ==============================================================================
# Step 6: Host Python Billing Engine (billing repository)
# ==============================================================================
echo -e "\n${YELLOW}Configuring Billing Engine (billing)...${NC}"
if [ -d "${TARGET_DIR}/billing" ]; then
  cd "${TARGET_DIR}/billing"

  if [ -f "requirements.txt" ]; then
    echo -e "Installing Python packages for billing..."
    "$VENV_PIP" install -r requirements.txt || true
  fi

  # Start Main loop engine
  if [ -f "src/main.py" ]; then
    echo -e "Starting billing-engine main loop under PM2..."
    pm2 delete billing-engine 2>/dev/null || true
    pm2 start src/main.py --name "billing-engine" --interpreter "$VENV_PYTHON"
  fi

  # Start FastAPI Endpoint server
  if [ -f "src/api_server.py" ]; then
    echo -e "Starting billing-api server under PM2 (Port 8005)..."
    pm2 delete billing-api 2>/dev/null || true
    pm2 start "$VENV_PYTHON -m uvicorn src.api_server:app --host 127.0.0.1 --port 8005" --name "billing-api"
  fi
fi

# ==============================================================================
# Step 7: Retire legacy final-CDR writer from PM2 startup
# ==============================================================================
pm2 delete livecalls-to-cdr 2>/dev/null || true
# Keep the already-cut-over cdr-collector, cdr-promoter and live-call-updater
# process definitions. Their private env files and cutover fence are managed
# by cdr-whitelable/deploy/cutover-checklist.md, not this generic script.

# ==============================================================================
# Step 8: Host Billing Analysis API
# ==============================================================================
echo -e "\n${YELLOW}[Step 8/9] Configuring Analytics engine (bal_analysis)...${NC}"
if [ -d "${TARGET_DIR}/bal_analysis" ]; then
  cd "${TARGET_DIR}/bal_analysis"

  if [ -f "requirements.txt" ]; then
    "$VENV_PIP" install -r requirements.txt || true
  fi

  if [ -f "main.py" ]; then
    echo -e "Starting billing-analysis loop under PM2..."
    pm2 delete billing-analysis 2>/dev/null || true
    pm2 start main.py --name "billing-analysis" --interpreter "$VENV_PYTHON"
  fi
fi

# ==============================================================================
# Step 9: Persist PM2 Processes across reboots
# ==============================================================================
echo -e "\n${YELLOW}[Step 9/9] Persisting PM2 services and configuring startup...${NC}"
# Do not persist a process list without the active JSON-CDR path after removing
# legacy writers. This script deliberately leaves the new process env untouched.
if ! pm2 jlist | node -e 'const apps=JSON.parse(require("fs").readFileSync(0,"utf8")); const needed=["cdr-collector","cdr-promoter","live-call-updater"]; const missing=needed.filter(name=>!apps.some(app=>app.name===name&&app.pm2_env?.status==="online")); if(missing.length){console.error("JSON-CDR services not online: "+missing.join(", ")); process.exit(1)}'; then
  echo -e "${RED}Refusing to save PM2 startup without the active JSON-CDR services.${NC}"
  exit 1
fi
pm2 startup systemd -u root --hp /root || echo "PM2 startup command already registered"
pm2 save

echo -e "\n${BLUE}======================================================================${NC}"
echo -e "${GREEN}   All Repositories Successfully Deployed and Hosted under PM2!${NC}"
echo -e "${BLUE}======================================================================${NC}"
pm2 list
echo -e "${BLUE}======================================================================${NC}"
