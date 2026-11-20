# Product maturity implementation and QA - 10 November 2026

## Delivered

Researched KnowBe4, Hoxhunt, usecure, Gophish and Microsoft Attack Simulation Training using primary documentation. [Comparison and prioritized roadmap](market-and-product-plan-2026-11-10.md) distinguish implemented capabilities from remaining gaps. [Funding pilot brief](funding-pilot-brief.md) supplies a demonstration narrative without invented commercial claims.

Added a dedicated Manager dashboard at `/manager`, scoped to the manager's organization under the existing permission model. It shows campaign counts, accepted deliveries, observed clicks, positive reporting, current learning completion/overdue counts, audience results, recent campaigns, setup links, date selection and CSV export. Organization administrators share this overview; the platform dashboard includes it. This does not introduce reportee-only/team delegation.

Shared icon buttons now support accessible labels and 500 ms hover/focus tooltips for recognized icons; explicit `help` allows contextual descriptions. Delete hover, keyboard focus, Escape dismissal and absence of accidental deletion were verified. This addresses the requested first-use affordance; a complete accessibility review of custom controls remains a pilot task.

Added local-only simulation delivery to an authenticated browser inbox, a guided campaign creator, signed tracking links, a fake-code landing form, positive reporting, and harmless text attachment downloads. Normal dispatch acceptance and tracking feed actual persisted campaign/report counts. Operator preview cannot impersonate another recipient's behavior. The lab worker only processes local-inbox sender profiles.

Fixed Reports date filtering against the local database timezone and corrected report sent totals that previously counted unsent recipients. Lab frontend API requests now follow the current host origin, fixing LAN session/login behavior. Additive migrations `0012` and `0013` preserve existing records and add reporting/mailbox fields and the local sender mode. A failed initial sender-mode constraint test was fixed and rerun successfully.

## Verification

| Check performed in this increment | Result |
| --- | --- |
| Browser regression suite, including supplied Admin login, notification destinations, content controls, sidebar scroll, login Enter, role pages, mobile wizard and new local flow | 74 passed |
| Foundation suite, including tenant RLS, dispatch behavior, secrets, reporting exports, MFA, local-lab network/runtime guards | 43 passed |
| Create/read/edit/use/delete feature cycles, including training, quizzes, articles, decks, users, campaigns and reports | 62 passed |
| Adversarial role changes, revocation and tenant boundaries | 8 passed |
| Governance: registration/verification, recovery, SSO configuration, protected key rotation, enrollment | 5 passed |
| Read-only API sweep across three roles | 195 probes; no 5xx or connection failures; denied/invalid requests remain denied |
| TypeScript | Passed |
| Frontend and backend production build | Passed; dependency comment annotations emitted nonblocking warnings |

The browser suite exercises real UI and APIs; the broader feature cycles use a mixture of API operations and browser checks. Page-load checks alone do not certify every feature or external integration.

Baseline IDs from ten tables were saved before changes in `logs/product-maturity/baseline.json`. Every recorded ID remained present: **55 records**, rechecked after the regression/data-cycle cleanup. Manager campaign totals matched the database, and its saved QA campaign remained visible while the other organization's campaign did not. Preservation proof: `logs/product-maturity/preservation.json` and `final-preservation.json`; repeat with `node scripts/verify-product-preservation.mjs`. This verifies existence and selected display behavior, not a field-by-field audit or a database backup.

## Reproducible result retained for review

Campaign **32**, `QA local outcome proof 1794255653672`, belongs to QA Review Alpha (organization 8). The successful flow delivered to `qa.owner@review.test` and `qa.employee@review.test`:

| Observed campaign outcome | Count |
| --- | --- |
| Accepted into local inbox | 2 |
| Opened recipients | 1 |
| Clicked recipients | 1 |
| Submitted training code | 1 |
| Reported suspicious | 1 |

The harmless attachment download succeeded. Duplicate reporting did not increase the count. Attempts by another organization to read a message returned 404; an employee's campaign-creation request and an operator's attempt to record another recipient's open returned 403. Campaign details, overview and Reports reflected these outcomes.

Evidence: `logs/product-maturity/local-outcome-proof.json`, `local-campaign-results.png`, `tooltip.png`; existing role/input records remain under `logs/role-review`. Earlier interrupted test campaigns 30 and 31 are retained as test history rather than silently removed. New demo records are labeled with QA names. Feature-cycle disposable records were cleaned up by their script.

## Running and remaining work

The current server and delivery worker run in isolated lab mode. Host URL: **http://192.168.100.20:5000/local-inbox**. [Startup and two-PC demonstration instructions](local-simulation-guide.md) include accounts, actions and expected results. Both host-local and LAN-address sessions passed on this PC; a physical second PC was not available. Windows currently classifies WirelessNet as Public. Network/firewall settings have not been changed pending confirmation that it is trusted.

This is a stronger local pilot, not a certified global production release. Remaining work includes real-device network confirmation, external SMTP/inbox integrations, manager reporting hierarchy, longitudinal training effectiveness, deployment/backup/security review, accessibility coverage and safe atomic key rotation. Legacy timestamp-without-timezone display conventions also need a deliberate data migration before multi-timezone deployment; the report filtering fix avoids rewriting existing dates.

Source snapshots of the initial fourteen core files are under `backups/product-maturity-2026-11-10`; new files and additional report/dispatch changes are described here. These snapshots are not a complete repository or database backup. Original normal `.env` settings were retained. Local inbox delivery is not external SMTP acceptance, attachment download is not execution, and observed clicks are not proof of compromise.
