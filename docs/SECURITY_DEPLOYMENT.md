# Deploy the October 2026 registration fix

These changes are local source edits. They do not alter the running server, its database, uploaded files, or firewall.

## Before deployment

Preserve the PM2 logs, Nginx access.log.3.gz and database evidence with restricted permissions before cleanup. Do not publish these logs: old signup entries contain plaintext passwords.

The backend now returns 404 for anonymous signup, even when called directly over loopback. Existing admin-created tenants and invitation acceptance continue to use their existing routes. Users whose database status is not ACTIVE cannot log in, refresh tokens, or use existing access tokens. Suspending/deleting a user through the status endpoint also clears their refresh token.

Audio uploads require FFmpeg on the server PATH. Install the OS-maintained package and verify it before restarting:

```bash
sudo apt-get update
sudo apt-get install ffmpeg
ffmpeg -version
```

Uploads accept WAV/MP3 input up to 10 MiB and five minutes, decode to mono 16 kHz PCM WAV, discard metadata, and generate random filenames. Processing has a 30-second timeout. Invalid inputs are rejected; missing FFmpeg returns 503. Existing audio files are unchanged. Test a real greeting after deployment.

## Backend and frontend

Transfer the changed source to the corresponding application checkout under /opt/pbx. Use the existing dependency installation; no new npm dependency is introduced.

```bash
cd /opt/pbx/backend
./node_modules/.bin/prisma generate
npm run build
pm2 restart pbx-backend --update-env
cd /opt/pbx/frontend
npm run build
ss -lntp | grep ':3000'
```

Expected listener: **127.0.0.1:3000**. The bind is enforced by code, so an old HOST environment setting cannot re-expose it. Nginx remains on public port 443 and continues to proxy to loopback.

## Sub-billing

Deploy src/server.js to the checkout used by PM2's sub-billing-whitelable process. Set BIND_HOST=127.0.0.1 in that service's .env and restart it. If PBX SUB_BILLING_API_URL currently uses 10.30.0.61:5005, change it to http://127.0.0.1:5005/api before restarting PBX. Retain the current PORT=5005.

If a different host requires sub-billing, explicitly set BIND_HOST=10.30.0.61 and retain narrow source-IP firewall rules. Do not expose its unauthenticated administrative routes through a public Nginx location. This patch does not add service authentication to sub-billing.

## Nginx

The supplied wlabel/nginx-security.conf defines a query-free audit format and per-IP auth rate limit. Copy it to /etc/nginx/conf.d/pbx-security.conf. The supplied wlabel/pbxwl.balatrix.com.conf mirrors the provided SSL paths and /opt/pbx/frontend/dist root. Back up the existing site, review differences, then install it as /etc/nginx/sites-available/pbxwl.balatrix.com.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The regex signup block also catches a trailing slash and letter-case variants. The backend remains the authoritative block for every virtual host, including wlabel.balatrix.com. Apply the same audit logging and auth limit to any other public PBX virtual host after reviewing its full configuration. Login/reset requests exceeding the burst return 429. Users sharing a NAT IP also share this budget; adjust it if required.

The dedicated logs use *.log names so Ubuntu's normal Nginx logrotate pattern normally includes them; verify /etc/logrotate.d/nginx. Nginx error logs can still contain request details, so restrict their access and retention too.

## Existing incident accounts

In the super-admin portal, suspend the four accounts associated with DD DemoWl, DD PbxWl, and the two Pentest4 Co tenants. Verify the exact emails from the preserved logs before acting. Block the corresponding tenants' services and review their telecom resources; suspending a web user alone does not disable SIP credentials or existing calls.

Preserve and quarantine, rather than execute, these files on the server:

- /opt/ivr_audio/1ad29564-3b76-483f-a5d6-09242b36e87e/1791653258824_p.php
- /opt/ivr_audio/1707e68f-1956-4bda-81b0-2bd997ae4432/1791653262204_p.php

Remove their AudioFile records through the application after evidence preservation. Rotate any real account password recorded in old signup logs. Do not destroy incident evidence by clearing all logs.

## Acceptance checks

```bash
# Must return 404 without creating a tenant, even with a valid signup-shaped body.
curl -i -X POST http://127.0.0.1:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"deployment-check@example.invalid","password":"dummy-only-password","companyName":"Deployment check"}'
curl -i -X POST https://pbxwl.balatrix.com/api/auth/signup
ss -lntp | grep -E ':3000|:5005'
```

From another machine, confirm TCP/3000 cannot connect. Confirm ordinary login, the dashboard, invitation acceptance, and one real WAV/MP3 greeting work. Confirm a renamed text file cannot upload as audio. Confirm a suspended dummy user's existing bearer token returns 401.

After proving loopback binding, the INPUT jump for tcp/3000 to TRUSTED_IPS can be removed; the INPUT DROP policy still protects that port. Keep loopback ACCEPT. Persist the resulting firewall using the existing server mechanism. Do not flush the firewall. Apply equivalent checks to IPv6 and any Docker/NAT rules before assuming they are covered by the IPv4 listing.

## Remaining server hardening

Move PM2 apps off root using a dedicated service account and targeted permissions for audio/recording directories. Review remote dependencies before changing PostgreSQL, Next/WebRTC or Python bind addresses. Bind PostgreSQL only to loopback/private addresses as required. Keep /opt/ivr_audio outside web roots and without executable web handlers. These operations need the running server configuration and are not performed by this source patch.
