# Campaign Scheduler Auth Failure (Postgres 28P01) Troubleshooting

## Symptom
Repeated log spam:
```
[Scheduler] Tick error: error: password authentication failed for user "postgres"
code: 28P01
```
Sometimes alternates with:
```
Tick error: Error: read ECONNRESET
```

## Root Cause
The campaign scheduler was starting immediately and attempting queries with invalid database credentials. Continuous failures generated noisy logs. ECONNRESET appears after failed auth retries when the server closes connections.

## Fix Implemented
File: `server/services/campaign-scheduler.ts`
- Added `CAMPAIGN_SCHEDULER_ENABLED` env guard (default `true`).
- Added pre-flight `SELECT 1` auth test before starting interval loop.
- Converted fixed `setInterval` to recursive `setTimeout` to support **exponential backoff**.
- Added consecutive failure counter with `CAMPAIGN_SCHEDULER_MAX_FAILURES` (default 5) after which the scheduler stops to prevent infinite spam.
- Improved error messages distinguishing:
  - `28P01` (invalid password / user mismatch)
  - `ECONNRESET` (connection forcibly closed)
- Provided actionable guidance in logs referencing env vars.

## Required Environment Variables
Ensure these exist in your `.env` file:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phishnet_db        # match your created database
DB_USER=phishnet_user       # or postgres if using default superuser
DB_PASSWORD=secure_password # NOT blank
CAMPAIGN_SCHEDULER_ENABLED=true
CAMPAIGN_SCHEDULER_INTERVAL_MS=60000
CAMPAIGN_SCHEDULER_MAX_FAILURES=5
```
> NOTE: `DB_USER=postgres` requires supplying the actual postgres role password. On some local installs there is **no** password; set one explicitly or create a dedicated least‑privilege role.

## Verification Steps
1. Stop any running dev server.
2. Test raw credentials with `psql`:
   ```bash
   psql -h localhost -U phishnet_user -d phishnet_db -c "SELECT 1;"
   ```
   If using Windows PowerShell:
   ```powershell
   psql -h localhost -U phishnet_user -d phishnet_db -c "SELECT 1;"
   ```
3. If prompted for password and fails, reset role password:
   ```sql
   ALTER ROLE phishnet_user WITH PASSWORD 'secure_password';
   ```
4. Restart app: `npm run dev`.
5. Confirm log shows pre-flight success and no 28P01 spam.

## Creating a Dedicated Role (Recommended)
```sql
CREATE ROLE phishnet_user LOGIN PASSWORD 'secure_password';
CREATE DATABASE phishnet_db OWNER phishnet_user;
GRANT ALL PRIVILEGES ON DATABASE phishnet_db TO phishnet_user;
```

## Common Pitfalls
| Issue | Cause | Resolution |
|-------|-------|------------|
| 28P01 spam | Wrong DB_PASSWORD | Update `.env` & restart server |
| ECONNRESET after auth errors | Server closed bad connections | Fix creds; restart |
| Scheduler still running after disable | Cached state | Set `CAMPAIGN_SCHEDULER_ENABLED=false` then restart (cold start) |
| Using spaces around `=` | Malformed env file | Use `KEY=value` without spaces |

## Disabling Scheduler Temporarily
Set:
```
CAMPAIGN_SCHEDULER_ENABLED=false
```
This prevents start attempt entirely (no pre-flight).

## Adjusting Backoff
Currently backoff = `min(5000ms * failures, 60000ms)`. Customize by adding env var support later if needed.

## Next Hardening Ideas
- Add health endpoint exposing scheduler status & failure count.
- Emit structured logs (JSON) for centralized analysis.
- Integrate with metrics (Prometheus counter for failures).

## Status
Issue mitigated. Further noise should cease after 5 consecutive failures; root credential mismatch must still be corrected by user.

---
_Last updated: 2025-11-22_
