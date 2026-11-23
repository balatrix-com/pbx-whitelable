# Whitelabel voicemail rollout

## What is in the repositories

- `pbx-whitelable/backend`: tenant feature settings, mailbox and message Prisma models, migrations, authenticated mailbox/inbox API, Audio Library greeting conversion, and FreeSWITCH XML generation.
- `pbx-whitelable/frontend`: Super Admin feature control, tenant voicemail inbox, extension switch, and voicemail destinations for number, IVR, and schedule routing.
- `t2-kam-whitlable/t_2002.py`: checks the mailbox and tenant feature on every voicemail XML-CURL lookup, even when the generated XML is cached. This is the source for the deployed `/opt/pbx_app/t_2002.py` process.
- `cdr-whitelabel/voicemail_ingester`: separate ESL recording completion worker, WAV normalization, message ingestion, 20-message mailbox retention, and optional email notification. It leaves JSON CDR, live-call Redis, and call recording services alone.

Whitelabel's existing `Plan.allowVoicemail` field remains separate from the Super Admin tenant feature switch. The feature switch controls access to mailboxes and the portal. New tenants receive an enabled company mailbox and disabled extension mailboxes. Existing tenants must be enabled in Feature Controller after the migration.

## Server preparation

1. Ensure the same PostgreSQL database is configured in `pbx-whitelable/backend` (`DATABASE_URL`), `t_2002.py` (`ROUTING_DB_*`), and the ingester (`VOICEMAIL_DATABASE_URL`). The example name is `subtest`; use the actual whitelabel PBX database on the host.
2. Run `npx prisma migrate status`, then `npx prisma migrate deploy` from the deployed `pbx-whitelable/backend` directory. Do not use `prisma db push`. Run `npx prisma generate` and `npm run build` after deploying the migration. Build the frontend separately.
3. Install `ffmpeg` and `ffprobe`, and install `cdr-whitelabel/voicemail_ingester/requirements.txt` in its virtual environment. Set ESL credentials in its environment file. Install the supplied systemd unit after adjusting its service account and paths.
4. Create a shared `pbx-voicemail` group for FreeSWITCH, the backend process, and the ingester. Configure its numeric GID as `VOICEMAIL_SHARED_GID` in the backend environment. Keep `/var/lib/pbx-voicemail` private and accessible to the three services. Follow the directory setup and permission checks in `cdr-whitelabel/voicemail_ingester/README.md`.
5. Place a spoken default greeting at `/opt/ivr_audio/system/voicemail_default.wav` and a storage-full prompt at `/opt/ivr_audio/system/voicemail_full.wav`. The beep can use the default FreeSWITCH tone or a WAV configured with `VOICEMAIL_BEEP`. FreeSWITCH must be able to read each file.
6. Deploy `t2-kam-whitlable/t_2002.py` to the path shown by `pm2 describe fscurl` (previously `/opt/pbx_app/t_2002.py`) and restart `fscurl`. Restart the backend after its migration and build. Start the voicemail ingester only after the shared storage and database are ready.

The later `20261123000000_voicemail_greeting_source` migration records which Audio Library item supplied each selected greeting. Existing custom greeting copies remain playable; select their source item once more if you want its name shown in the mailbox and selected in the dropdown.

## Verification

1. In Super Admin Feature Controller, enable Voicemail for an existing test tenant. Set an active mailbox quota and storage quota if required.
2. As the tenant Admin, open Voicemail. Confirm a company mailbox appears and extension mailboxes are initially off. Upload one greeting to Audio Library and select it for two boxes. Play back each greeting.
3. Enable an extension mailbox in that extension's settings. Test an unanswered call and a direct DID/TFN voicemail route. Test an IVR key and timeout/invalid fallback. Confirm one READY `voicemail_messages` row per deposit and a playable WAV in the inbox.
4. Turn the feature off and confirm the menu and selectors disappear and a call to an old voicemail destination is refused. Confirm a different tenant cannot access the message API or audio.
5. Confirm the ordinary JSON CDR and call recording paths still work. Test the 21st message in one mailbox: the oldest of that mailbox should be removed while other boxes are unaffected.

The code was built and unit tested locally. The migrations have not been applied to the live server, the ingester has not been started there, and a real FreeSWITCH voicemail call has not yet been verified.
