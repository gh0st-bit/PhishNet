# PhishNet investor demonstration release

This implements the first release of the accepted research/UI plan. Later Microsoft 365, adaptive learning, content reassessment, deployment and expansion milestones remain separate work; they are not presented as shipped integrations or certified production readiness.

## What changed

| Area | Delivered behavior |
| --- | --- |
| Navigation | Dashboard first; People, Campaigns, Learning, Reports and Settings groups; platform administration separated; manager/employee navigation remains restricted. Existing per-user sidebar expansion and scroll are retained. |
| Setup | Five resumable sections for organization, people/teams, delivery, content and readiness. Saved organization configuration and imports remain the source of truth; choosing a step sends no mail. |
| Content | Searchable, type-filtered active/archive library; sandboxed previews; archive/restore for lessons, articles, assessments, decks, email templates and landing pages. Archive excludes content from new learning paths, manual lesson assignments and campaign launch. Frozen existing assignments remain readable. |
| Outcomes | Accepted-message terminology, weekly cohorts, repeat-click observations, report timing with exclusions/sample counts, current module/path completion and overdue counts. Cards open their supporting records; filters are retained per user in the current tab. |
| Executive view | Summary, CSV, printable overview, trend table and earliest/latest cohort observations. Exports use the same saved-record calculations and carry data provenance. Comparisons are unadjusted observations, not causal effectiveness or a validated risk score. |
| Demonstration | Separate fictional organization, 12 employees, one manager assigned to eight employees, three historical completed campaigns, an original lesson and a frozen learning path. Explicit Sample data banner and walkthrough. Server rejects campaign sending for the sample organization. |
| Achievements | Shared validated criteria for create/edit, award and list/detail progress; legacy aliases supported; points, UTC activity streak, quiz, distinct quiz count, lesson/count, perfect-score and manual criteria. Employee catalog access remains SELECT-only. Per-user and per-badge advisory locks serialize duplicate awards and catalog changes. |
| Achievement retention | DELETE now archives; restore returns a draft. Earned names/descriptions/icons/rarity are captured at award time and remain visible after archive or later edits. Existing awards receive a snapshot of their current metadata; unavailable historical metadata is not reconstructed. |
| Feedback/accessibility | Visible badge mutation errors preserve entered values; manual award requires an employee email and recorded reason. Labels connected for badge selects, shared keyboard focus and coarse-pointer control targets, breadcrumbs, existing 500ms hover/focus tooltips retained. This is not a complete WCAG conformance audit. |
| Mobile diagnostics | Render boundary records exception, component stack, path, viewport and diagnostic ID to the console and tab session storage. Repeated mobile/tablet checks are recorded; the old intermittent startup error's original cause remains unconfirmed. |

The navigation retains existing routes. Existing content editors remain available; the library is the new archive/search interface. Frozen path versions are not rewritten when catalog content changes. Archiving is reversible; legacy permanent-delete endpoints for other content types have not been converted into a universal retention policy.

## Run and demonstrate

From PowerShell in this directory:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
$env:WORKER_DELIVERY_PAUSED='true'
.\start-local-lab.ps1 -Lan
```

The launcher applies additive runtime migrations and prints the current LAN URL on port 5000. Keep the launcher open. Local use is `http://localhost:5000`. No firewall or router settings were changed.

Prepare the sample organization once, if not already present:

```powershell
node scripts/run-audit.mjs investor-demo
```

**Before every demonstration**, re-anchor the sample dates to today (the history is otherwise fixed to the day it was prepared, so campaigns age out of the 30-day view and pending lessons become overdue):

```powershell
node scripts/run-audit.mjs investor-demo-refresh
```

It shifts only the sample organization's timestamps (preserving every interval), backfills opens for older fixtures and awards the standard 50 points per completed lesson. It is idempotent, changes no credentials and sends nothing. Demonstration workspaces also default the dashboard period to **All time**.

The guarded importer requires the audit database, sink transport and a paused worker. It imports fictional historical rows directly; it never dispatches email or invokes simulation tracking endpoints. Repeating it preserves the existing sample workspace and credentials.

| Account | Role and expected access |
| --- | --- |
| `orgadmin@demo.phishnet.test` | Organization dashboard, campaigns, content, reports and setup for Sample Company only. |
| `manager@demo.phishnet.test` | Assigned-team dashboard with eight employees; no organization-wide overview, campaign management or content-library API. |
| `employee@demo.phishnet.test` | Employee dashboard, assigned learning, inbox, reporting and achievements; no management APIs. |

The randomly generated shared local sample password is in **`.env.investor-demo.accounts`**, which is ignored by Git. It is not a production default. Do not publish the file. Remaining fictional employee addresses and IDs are recorded in `logs/investor-release/demo-fixture.json` without the password.

Open `/walkthrough` as the sample organization administrator. Follow organization outcomes → a completed sample campaign → sign out and review employee learning → sign out and review the manager → return to the organization account and print/export. Use **All time** if demonstrating after the original sample dates have aged out of the selected window. No campaign launch or inbox simulation action is necessary.

Expected sample figures across all three campaigns: **36 accepted, 27 opened, 12 clicked, 18 reported, four repeat clickers, 18 timing samples, median report time 600 seconds**. Learning begins with 12 module assignments plus one path assignment, eight completed modules and two overdue module assignments. These are assignment counts, not unique people. Completing sample learning intentionally changes its learning figures; use the untouched fixture for the deterministic regression.

## Verification and issue register

- Final result: **39 compiled-frontend browser cases passed; 55 foundation checks passed; zero skipped, flaky or unexpected browser results.** Type checking and the production build passed. Consolidated evidence is in `logs/investor-release/verification.json`.
- The normal LAN app was restarted and verified at **http://192.168.100.20:5000**. `logs/investor-release/launch.json` records successful sample login, new reporting endpoints, paused worker and local-only mail. An older launcher using the previous `192.168.0.12` URL occupied port 5000; it was identified and replaced. Temporary review servers on 5001/5002 were closed.
- `npm.cmd run check` and the production build pass. Build emits the existing upstream Zod/Rollup annotation warnings; compilation succeeds.
- Foundation checks run against the isolated audit/test environment, including actual employee-restricted award evaluation. Disposable low-level protocol fixtures use a sink/local dummy server; no retained customer campaign or external email was sent.
- Compiled-frontend browser results are in `logs/investor-release/browser-built.json`. They cover badge errors/manual awards/retention, outcome reconciliation and printing, scoped manager/employee access, repeated 390px/768px screens, content lifecycle, setup, login Enter behavior, sidebar state and existing refresh controls.
- `logs/product-maturity/final-preservation.json` verifies all **55 baseline IDs across ten tables**. This checks record preservation, not byte-identical database contents or every legacy dashboard aggregation.
- The sample organization has no dispatch jobs. Its campaigns are historical fixtures, never launched.
- Disposable test employees and lessons are deleted. Disposable badge definitions are archived under the new retention contract; their IDs and results are recorded in badge-gap/manual-award proof JSON. Prior QA review accounts and content remain available.

| Issue | Result |
| --- | --- |
| BA-16 criteria/award/progress mismatch | Fixed and tested through an employee completion and concurrent restricted-role awards. |
| BA-21 silent badge errors | Fixed; browser-injected HTTP 503 leaves values intact and displays the server's message with a retryable save. |
| BA-22 deletion contradicts earned-history retention | Fixed through archive/restore and award-time snapshots; browser verifies an earned name remains after editing and archiving its definition. |
| BA-23 intermittent mobile startup error | Open investigation. Added diagnostics; current repeated compiled-asset checks pass, but do not establish the original root cause. |
| Archive/restore stale cache | Found during this release; fixed by invalidating active and archived lists and path-resource choices. |
| Restricted-role badge locking | Found during this release; replaced row locks requiring catalog UPDATE access with advisory locks, preserving read-only employee permissions. |
| Initial sample-import schema mismatches | Two attempts rolled back completely; corrected delivery mode and lesson fields match the actual database, then import succeeded. |

## Interfaces and migration notes

- Additive migrations `0019_investor_release.sql` and `0020_content_archive.sql`; no baseline rows are deleted. Run the migration task before loading the new backend. The normal `.env` is unchanged.
- `GET /api/workspace`: authenticated workspace name and sample marker for all roles.
- Existing overview JSON/CSV gain provenance, trends, repeated-click and timing fields. Default dataset is customer; the sample UI selects demonstration records. Zero-denominator overview rates are `null`/unavailable.
- `GET /api/dashboard/overview/records`: organization-admin/platform-admin only; period, dataset, event and page select supporting records. Current learning remains outside the campaign period filter, consistently with its cards.
- `/api/content-library`: organization-scoped list/preview and archive/restore. Type is validated against an explicit six-table allowlist.
- Badge create/update normalize criteria to the shared canonical model. Existing DELETE archives; POST restore returns an unpublished draft. Manual award is platform-admin only, limited to an active employee in that administrator's organization; reason and actor are retained in the award snapshot.
- Organization preference edits merge supported settings while preserving the server-owned sample marker. Changing branding does not remove the sample label or sending block.
- Tab-local list preferences store filters only, never passwords or connection secrets.

## Research basis and remaining milestones

| Reference | Applied here | Still later |
| --- | --- | --- |
| [KnowBe4 reporting](https://www.knowbe4.com/advanced-reporting) | Combined phishing/learning overview, traceable figures and executive summary. | Independently validated benchmarks and customer outcome evidence. |
| [Hoxhunt learning journeys](https://support.hoxhunt.com/hc/en-us/articles/4416176737938-How-Hoxhunt-builds-a-unique-training-path-for-you) | Clearer existing learning-path access and demonstration. | Transparent recommendation rules and administrator-approved assignments. |
| [Microsoft insights](https://learn.microsoft.com/en-us/defender-office-365/attack-simulation-training-insights) | Reporting and training coverage presented together. | Live tenant consent, delivery/authentication failures, Outlook supported-client acceptance. |
| [usecure uPhish](https://help.usecure.io/en/articles/3210551-understanding-uphish-the-basics) | Existing recurring campaign/remediation foundations retained and made easier to navigate. | Difficulty-adjusted learning/behavior cohorts. |
| [Gophish reporting](https://docs.getgophish.com/user-guide/documentation/email-reporting) | Existing employee reporting and authenticated Outlook handoff retained. | Monitored reporting-mailbox collector and unmatched-report operations. |
| [GOV.UK review pattern](https://design-system.service.gov.uk/patterns/check-answers/) and [W3C guidance](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html) | Setup/readiness review, existing campaign review, supplementary tooltips and visible feedback. | Full keyboard/screen-reader/contrast audit across legacy forms and media/email clients. |

Remaining release sequence: Microsoft 365 collector/client pilot → explainable learning recommendations → reassignment/reassessment and reviewed content metadata → HTTPS/off-host restore/alerts/capacity acceptance → demand-led Google/SCIM/SCORM/localization/MSP work. No tenant credentials, public HTTPS hostname, off-host restore destination or external identity provider was supplied; these integrations and deployment outcomes are not verified by local configuration or sample data.

Funding claims should distinguish implemented software and reproducible synthetic evidence from customer adoption, measured behavior change, revenue, capacity and compliance claims. The latter require independent pilot evidence.
