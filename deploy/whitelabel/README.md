# Whitelabel voicemail deployment

The three scripts in this directory are the tracked copies of the whitelabel setup scripts. Use `--voicemail-only` on an existing host. The unqualified `setup_everything.sh` restores database dumps and must only be used for a fresh installation.

For a fresh installation, the full dependency script requires `FREESWITCH_PACKAGE_TOKEN`; the full setup script requires `REDIS_PASSWORD` and `SOXUSER_PASSWORD`. Supply them in the shell environment. These values are intentionally absent from Git.

On the whitelabel server, first pull `pbx-whitelable` into `/opt/pbx-whitelable`. Then run:

```bash
bash /opt/pbx-whitelable/deploy/whitelabel/install_dependencies.sh --voicemail-only
bash /opt/pbx-whitelable/deploy/whitelabel/setup_everything.sh --voicemail-only
```

Place readable spoken prompts at `/opt/ivr_audio/system/voicemail_default.wav` and `/opt/ivr_audio/system/voicemail_full.wav`. The setup script creates `voicemail_beep.wav` if absent. Configure the existing `/opt/pbx-whitelable/backend/.env` and `/opt/pbx_app/.env`. The deploy script clones/pulls `cdr-whitelabel` and `t2-kam-whitlable`; on its first run it creates `/etc/pbx-voicemail-ingester.env` from the worker example and stops. Set the real `FS_ESL_PASSWORD` and `VOICEMAIL_DATABASE_URL` there. The worker must use the same PBX database as the backend and XML-CURL.

FreeSWITCH must be restarted when calls are idle to inherit the `pbx-voicemail` group. If voicemail files already exist, follow `cdr-whitelabel/voicemail_ingester/README.md` to repair their permissions before starting the worker. Then run:

```bash
bash /opt/pbx-whitelable/deploy/whitelabel/deploy_code.sh --voicemail-only
systemctl status voicemail-ingester --no-pager
pm2 status
```

The deployment applies Prisma migrations, regenerates Prisma Client, builds the PBX backend and frontend, updates `/opt/pbx_app/t_2002.py`, restarts `fscurl` and `pbx-backend`, and installs the ingester as a systemd service. It leaves the existing CDR collector, promoter, Redis live-call updater, billing, and WebRTC PM2 definitions intact. It stops if a required migration, build, prompt, or credential is missing.

For older custom greetings whose Audio Library names were not recorded, preview the optional recovery matches after deployment:

```bash
cd /opt/pbx-whitelable/backend
node --env-file=.env scripts/reconcile-voicemail-greetings.js
```

Review the output before rerunning that command with `--apply`. A missing or ambiguous audio source is left unchanged.
