# SMB pilot operations

See [the release register](smb-pilot-release-2026-11-10.md) for verified capabilities
and open gates. No live employee campaign or external email delivery was launched.

## Current local state

The LAN app uses `phishnet_audit` and sink transport. `WORKER_DELIVERY_PAUSED=true`
stops automatic delivery, reminders and rotation. Manual review remains available.
Do not start another server on port 5000. `start-local-lab.ps1 -Lan` is the normal
foreground launcher for a later requested exercise, after stopping this instance.

## Staging candidate

Copy `deployment/.env.example` to an untracked `deployment/.env` and configure the
hostname and independent database passwords, application keys and metrics token.
Run from `deployment` on the designated Docker host:

```sh
docker compose up -d database
docker compose --profile tools run --rm migrate
docker compose up -d app worker proxy
```

The migration service owns schema changes and provisions runtime roles. Runtime
services receive web/control credentials instead of the owner password. Keep
external delivery, rotation and automatic execution disabled until staging
acceptance. Docker startup and TLS issuance have not been verified here. Back up
database, uploads and recovery keys before upgrading an existing instance.

## Microsoft and Outlook handoff

The SMTP adapter implements client-credential OAuth against the configured tenant
with STARTTLS. Enter tenant/client IDs and secret through the connection UI; do not
commit secrets or paste them in chat. Explicit connection verification authenticates
without sending a message, and is disabled in sink mode. Mailbox permissions,
consent and SMTP policy need verification in the designated Microsoft test tenant.

For a designated HTTPS staging origin, generate the Outlook manifest:

```powershell
node scripts/render-outlook-manifest.mjs --origin https://your-staging-host.example --output deployment/outlook/manifest.xml
```

Validate and sideload in the test tenant. The pane passes an identifier and subject
to authenticated browser review; the user explicitly submits the report. It does
not upload bodies/attachments. Native integrated Report/mobile support and an
automated reporting-mailbox collector remain separate work. Browser Office.js
fixtures do not establish Outlook compatibility.

## Backup and recovery

From the project root, create a unique encrypted audit backup and rehearse recovery:

```powershell
node scripts/backup-pilot.mjs --audit --output backups/audit-drills/my-review.pnb
node scripts/backup-pilot.mjs --audit --verify --output backups/audit-drills/my-review.pnb
node scripts/backup-pilot.mjs --audit --restore-drill --output backups/audit-drills/my-review.pnb
```

The audit backup key is in ignored `.env.audit.backup`; keep a protected independent
copy. Losing it prevents restoration. Production backup requires an independent
`BACKUP_ENCRYPTION_KEY`. Application recovery keys are inside the encrypted backup.
Local uploads are included; S3 backup is rejected pending separate bucket recovery.
The script's size limits and in-memory packaging suit a pilot rather than large deployments.

The drill creates a new verification database and separate asset directory, checking
table counts, asset hashes and available encrypted SMTP secrets. It leaves the
source database intact. Evidence is in `logs/pilot/restore-drill.json`; verification
databases/artifacts are retained for review. This is not a production cutover or
off-host RPO/RTO proof. Production recovery still needs restored roles, keys, asset
mounts, application smoke tests and measured recovery time on an approved host.

## Key rotation and rollback

Rotation is flag-gated and needs an active worker. Transactional batches retain
prior versions, record failures and support explicit resume. Tests use disposable
records; current account secrets were not rotated. A pre-V2 binary cannot read V2
ciphertext. Rollback must keep a compatible binary or restore a coordinated
pre-rotation database/key backup. Do not discard prior keys based only on queue status.

Alert rules and CI definitions are candidates. Test deployed notification routing
and remote CI before treating them as operational controls.
