# SMB pilot implementation register

Update 12 November 2026: [the investor demonstration release](investor-release-2026-11-12.md) records the subsequent UI, reporting, archive/restore and achievement fixes. Earlier findings below are retained as historical evidence.
Latest follow-up: [button and role audit](button-audit-2026-11-10.md). It records additional repaired controls, the reproduced badge-awarding failure, remaining badge feedback/retention gaps, and an intermittent mobile startup observation. Use that assessment alongside this release register.

This register separates locally verified work, integration work needing an external environment, and remaining roadmap items. It supersedes older readiness notes where they describe features as absent that are now implemented. This release is not a claim that every item in the full roadmap or a four-week customer pilot is complete.

## Implemented in this release

| Area | Behavior | Evidence |
| --- | --- | --- |
| Setup | Resumable configuration checklist, mapped CSV preview, row errors, duplicate detection, saved import drafts, explicitly requested invitations | `qa-pilot.mjs`, desktop/mobile setup browser checks |
| Accurate data | Legacy training totals use saved progress; points awards have idempotent events; unavailable historical earning dates remain unavailable | Foundation tests and API lesson completion/retry |
| Demo separation | Overview/CSV and Reports use an explicit all/customer/demo campaign filter; new local-lab campaigns are marked demo | API filter reconciliation; local campaign creation remains paused |
| Team permissions | OrgAdmins assign teams; Managers see assigned people and exports, with no campaign/user/SMTP management access | Two-team/two-tenant API negatives; manager browser page |
| Follow-up | Manager reminders for lessons and paths, once per 24 hours, with completed/out-of-scope requests rejected | API follow-up checks |
| Learning | Working lesson Start/Continue navigation, transcript/video playback, saved direct-video position, acknowledgement and completion | Browser path flow and API progress checks |
| Learning paths | Ordered lessons, articles, decks and supported untimed quizzes; frozen assignment content; prerequisites, server grading, attempts and duplicate-completion protection | API path scenarios and full learner UI cycle |
| Starter content | Six original English lessons and twelve reusable draft scenarios; repeatable installation does not create campaigns | API installation/reinstallation and campaign-count assertion |
| Content history | Versions of modules, articles, quizzes, decks, templates and landing pages; question/card edits record parent versions | Migration triggers and API history checks |
| Campaign stability | Launch snapshots preserve content/audience; landing rendering uses captured policy; unsupported template variables fail preflight | Foundation snapshot/password-off and template tests |
| Reporting | Accepted-delivery definitions, positive reporting, dataset filtering and recipient event timeline | API filtering; prior report/export regression coverage |
| Privacy | Employee leaderboard is opt-in and enforced by the API; default forms do not retain passwords; unmatched reports do not inflate outcomes | API privacy/report checks and foundation capture tests |
| Microsoft connection | Encrypted Microsoft SMTP OAuth configuration and explicit authentication verification; external delivery switch | Save/control code and disabled-network guard; live tenant verification pending |
| Outlook reporting | Read-message task pane and HTTPS manifest renderer; browser authentication/review handoff; explicit report confirmation | Browser Office.js fixture; tenant sideload/client validation pending |
| Encryption | Versioned key rotation, legacy decryption, retained prior keys, transactional batches, failed-job resume | Disposable-record rotation, rollback and recovery foundation test |
| Recovery | AES-GCM backup of database, local assets and recovery keys; isolated restore with checksums/counts | Backup integrity tests and `logs/pilot/restore-drill.json` |
| Deployment | Separate migration/runtime database roles in Compose; delivery/rotation switches default off; pilot CI and alert-rule candidates | Local build; Linux/container/remote CI acceptance pending |

## Review the release

- **Organization admin:** `http://192.168.100.20:5000/org-admin/setup`, using `qa.owner@review.test`.
- **Manager:** `/manager`, using `qa.manager@review.test`. The retained **QA Review Pilot Team** contains `qa.employee@review.test` only. Other users are excluded unless the administrator assigns them.
- **Employee:** `/employee/learning-paths`, using `qa.employee@review.test`. **QA Starter Awareness Path** contains the six starter lessons and is left incomplete for manual review.
- These QA accounts use the existing `QaReview2026!` password. Original supplied Admin credentials were not changed. Full account/role context remains in [the earlier role review](qa-role-review-2026-11-10.md).
- Retained team/path/content IDs are in `logs/pilot/review-fixtures.json`. Temporary test learners, teams, modules, quizzes and paths are cleaned up. Starter lessons/templates and the review team/path are intentionally retained.

Automatic worker work is paused during this development review; external simulation delivery and key rotation activation remain disabled. The server and LAN interface remain available. No live employee simulation or external mail delivery was started. Foundation tests use isolated database fixtures and a local dummy SMTP listener.

## Verification and tracking

Final local verification on 10 November 2026:

| Check | Result |
| --- | --- |
| TypeScript and production build | Passed |
| Foundation regression | 52 passed, 0 failed |
| Pilot API write/permission workflows | 19 passed, 0 failed |
| Selected desktop/mobile browser regression | 94 passed, 0 failed; simulation-launch workflow excluded |
| Read-only API sweep | 225 requests; 127 successful, 94 expected permission denials, 4 validation responses; no 5xx or connection failures |
| Existing data preservation | All 55 recorded IDs across ten tables still present |
| Final encrypted restore drill | 22 table counts, 18 asset hashes and five encrypted SMTP secrets verified in a separate database; source unchanged |

The final backup is `backups/audit-drills/smb-pilot-final-2026-11-10.pnb`.
The restored verification database is `phishnet_restore_check_1794308323881`.
These tests cover the selected workflows and boundaries, not every possible input,
external integration or capacity target. Build output has upstream Zod annotation
warnings; compilation succeeds. Test-runtime deprecation notices do not fail checks.

Repeat the browser regression using installed Chrome on this PC:

```powershell
$env:E2E_BROWSER_CHANNEL='chrome'
node scripts/run-audit.mjs browser tests/browser/content-role-review.spec.ts tests/browser/navigation-regressions.spec.ts tests/browser/roles.spec.ts tests/browser/surface-audit.spec.ts tests/browser/refresh-workspace.spec.ts tests/browser/pilot-workflows.spec.ts tests/browser/product-maturity.spec.ts --grep-invert "local delivery, recipient actions" --workers=1
```

API inputs/responses and check results are recorded in `logs/pilot/api-review.json`, with passwords/secrets redacted. Browser evidence is under `logs/pilot`; the final browser report is generated by Playwright. `scripts/inventory-pilot.mjs` records UI routes and source changes against the starting source snapshot. A route load is not treated as proof of its complete write workflow.

Additive runtime migrations are `0014` through `0018`. Original source copies are under `backups/smb-pilot-2026-11-10`. All 55 baseline IDs remain subject to the repeatable preservation check. Neither source copies nor an ID list replace a database backup.

The initial API review exposed CSV handling and validation-status issues. Browser review exposed a lazy-route initialization error and role-list shape mismatch; those were corrected before the regression release. Quiz fixtures now explicitly publish before path assignment, matching the product workflow. The empty Prettier configuration was repaired so formatting can run normally.

## Integration gates still open

1. Microsoft test-tenant setup, mailbox-scoped OAuth permissions, TLS/authentication verification, delivery acceptance/failure tests, and Outlook sideload validation. No tenant or HTTPS deployment hostname has been supplied for those checks.
2. Automated reporting-mailbox collection and Microsoft's native integrated Report surface are not implemented. This release supplies an authenticated report form and Outlook task-pane handoff. The collector remains a separate integration milestone.
3. Linux Compose startup, HTTPS issuance, remote CI, deployed alert routing and off-host restore must be demonstrated. Local encrypted restore is verified; production recovery objectives are not yet certified.
4. Legacy timestamp conversion needs historical timezone confirmation. Existing data was not rewritten based on an assumption. New pilot tables use timezone-aware timestamps; existing report filtering handles the configured database timezone.
5. Real identity-provider SAML login, production capacity targets and the four-week customer pilot remain acceptance work. Configuration save/read tests do not establish a working external identity integration.

## Remaining product work

- Content archive/restore lifecycle, richer path reassignment/reassessment controls, and timed or legacy matching/scenario assessments inside paths. Existing standalone quiz routes remain available; paths explicitly reject unsupported assessment configurations.
- Full keyboard/screen-reader/manual accessibility review and email-client/media compatibility. Referenced remote videos are not archived; direct-video resume is supported, while YouTube position resume is not claimed.
- A monitored reporting-mailbox collector; Google Workspace, SCIM, SCORM, further languages and techniques; hosted service billing/regional operations; MSP administration.
- Difficulty-adjusted cohort analysis, time-to-report and before/after remediation effectiveness. Current difficulty labels and event timelines are foundations, not a validated risk score or NIST certification.

Implement these as the next register entries after the local release passes regression and the external test environments are available. Funding claims should use verified evidence from this register rather than treating planned capabilities as shipped.
