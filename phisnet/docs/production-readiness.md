# Production readiness

Updated 12 November 2026. [The investor demonstration release](investor-release-2026-11-12.md) adds current local UI and verification evidence. The current implementation and evidence are tracked in
[the SMB pilot release register](smb-pilot-release-2026-11-10.md), which supersedes
the earlier foundation assessment. Its original source is preserved in
`backups/smb-pilot-2026-11-10/production-readiness.md`.

The local pilot now includes tenant RLS/runtime roles, durable campaign dispatch,
team-scoped Manager reporting, mapped onboarding, frozen learning paths, content
history, privacy controls and encrypted backup/restore. Microsoft SMTP OAuth and
Outlook reporting foundations require live tenant acceptance. Public production
readiness and commercial capacity are not certified.

Use `setup-friend.ps1` for isolated audit setup. The normal `.env` has not been
changed. The LAN review uses `phishnet_audit`, sink transport and paused automatic
worker tasks. Keep delivery paused until an intentional exercise is requested.

See [the operations runbook](smb-pilot-operations.md) for staging, recovery and
integration handoff. Do not use the historical destructive `npm run setup` or
`db:push` against an existing customer database.

Before public release, demonstrate Linux/HTTPS startup, Microsoft authentication
and delivery behavior, Outlook tenant installation, external identity-provider login,
remote CI, deployed alerts, off-host recovery and measured capacity. Complete
manual accessibility/email-client review and the four-week customer pilot. Local
sink tests and configuration save/read tests do not establish those outcomes.
