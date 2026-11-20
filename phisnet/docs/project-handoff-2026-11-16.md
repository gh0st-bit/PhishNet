# PhishNet project handoff for the next AI agent

**Prepared:** 16 November 2026  
**Repository:** `C:\Users\gh05t\Downloads\PhishNet\phisnet`  
**Purpose:** Give a new coding/research agent enough product, implementation, QA and operational context to continue work without repeating previous audits or damaging local data.

## 1. Read this first

PhishNet is a locally runnable, multi-tenant phishing-awareness training and simulation product. It includes organization/platform administration, campaigns, learning content and paths, employee and manager dashboards, reporting, notifications, and local-only mail/simulation infrastructure. The current repository contains substantial prior work and many retained QA artifacts.

Before changing code, read these in order:

1. [Investor demonstration release and its exact verification/limitations](investor-release-2026-11-12.md)
2. [Button and role audit](button-audit-2026-11-10.md)
3. [SMB pilot implementation register](smb-pilot-release-2026-11-10.md)
4. [Production readiness tracker](production-readiness.md)
5. [Production deployment plan PDF](../output/pdf/production-deployment-plan-2026-11-13.pdf) (the editable source is [here](production-deployment-plan-2026-11-13.md))
6. [Market comparison and product plan](market-and-product-plan-2026-11-10.md)

The release and audit documents are dated evidence snapshots. They describe what passed in those recorded runs; they do not prove that the app or integrations are currently healthy. Check the current code, environment and runtime before claiming current status.

## 2. Product and implementation overview

- **Product:** PhishNet, an organization-scoped security-awareness and phishing-simulation web application. Current local demonstration is deliberately synthetic and uses a sink/local inbox; it is not a production mail service.
- **Stack:** TypeScript, React/Vite frontend, Express/Node backend, PostgreSQL with Drizzle, session authentication, background worker, Docker Compose deployment scaffolding. See `package.json`, `server/`, `client/`, `shared/`, `database/`, `migrations/`, and `deployment/`.
- **Local development:** PowerShell helper `setup-friend.ps1`; daily LAN lab launcher `start-local-lab.ps1`. Node.js 22+ and local PostgreSQL are expected by the setup helper. Project dependencies are already present in this checkout, but do not assume they are valid for another computer.
- **Runtime safety state documented in latest release:** delivery worker paused, external email disabled, local sink mode, sample demo campaign jobs absent. Never launch campaigns or send simulated messages as part of ordinary QA. The user explicitly said not to run a simulation in prior work.
- **Data:** Prior QA/demo records were intentionally retained and preservation checks found 55 baseline IDs across ten tables in the documented release. Sample/demo dataset is kept separate from customer reporting. Do not reset, seed, clean, import into, or migrate the live local database without inspecting the script and getting an explicit user request where data could be changed.
- **Credentials:** Never copy passwords, secrets, `.env` contents or token material into this handoff, reports, commits or tool output. Local demo credentials are in ignored `.env.investor-demo.accounts`; audit credentials are in ignored `.env.audit.accounts`; `DEMO-LOGINS.private.txt` is also private/ignored. Inspect locally only when needed. These are not production credentials.

## 3. Work history by phase

The following consolidates the user's earlier requests and the repository's release records. Items in the first subsection are the user's reported sequence of work; the detailed evidence for later phases is in the linked files above.

### Initial setup and core bug-fix phases

- Ran the copied project using `setup-friend.ps1`, investigated setup/login issues and created/repaired audit accounts as needed.
- Fixed the login Enter-key flow that had redirected to password reset/recovery instead of submitting credentials.
- Fixed dashboard sidebar behavior so selecting a page did not reset its scroll position; later navigation work retained each user's expansion/scroll state and put Dashboard first.
- Reviewed feature workflows by creating data and exercising user-facing flows; role-specific access and data visibility became a recurring acceptance requirement.
- Corrected separation between the employee dashboard and local inbox: both have distinct purpose/routes and the employee experience belongs in the employee dashboard with sidebar navigation.

### Content, notifications, navigation and role work

- Fixed or audited content creation for MCQs and videos; notifications that opened 404s; campaign, flashcard deck and article links; missing article preview; and other dashboard/sidebar destinations.
- Added/fixed refresh actions across pages, including notifications, and retained the requirement that a refresh actually reloads the relevant saved data rather than appearing clickable only.
- Audited buttons and user roles (platform admin, organization admin, manager and employee), including permissions, role-specific dashboards and cross-tenant boundaries. The button audit includes the individual evidence and caveats.
- Built out a distinct manager dashboard with assigned-team outcomes, learning coverage and follow-up actions. Manager access is team-scoped, not organization-wide campaign/content administration.

### Product maturity, reporting and local demonstration phases

- Researched comparable products and open-source tools; added a product roadmap and UI improvements grounded in documented market references.
- Added the investor demonstration experience: Dashboard-first navigation, setup/readiness flow, searchable/archiveable content library, safer previews, campaign and learning outcome reporting, traceable records, exports, data provenance, cohort/timing indicators and a separate fictional sample organization.
- Improved achievements/badges: consistent criteria, duplicate-award protection, retention via archive/restore, award-time snapshots, visible validation/errors, keyboard and coarse-pointer handling.
- Improved accessibility feedback/tooltips, breadcrumbs and mobile error diagnostics. Tooltips are supplemental; they do not replace accessible names or visible labels for important actions.
- Preserved the original campaign and role routes while adding library and dashboard flows. Existing frozen learning-path content stays stable when source content changes.
- Created a low-cost production deployment plan and exported it as a PDF at `output/pdf/production-deployment-plan-2026-11-13.pdf`. **Planning only:** no cloud account, production domain, cloud resource or production deployment was created.

## 4. Latest recorded state and verification

The 12 November release document records:

- `npm run check` and production build passed (with non-fatal upstream Zod/Rollup annotation warnings).
- **55 foundation checks** and **39 compiled-frontend browser cases** passed; zero skipped/flaky/unexpected browser results in that run.
- 55 baseline IDs across ten tables were still present. This is an ID-preservation check, not a byte-for-byte database equivalence guarantee.
- Recorded local app URL: `http://192.168.100.20:5000`; sample and admin login were exercised. `logs/investor-release/launch.json` is evidence from that time, not a live health probe.
- Fictional sample organization: 12 employees, one manager assigned to eight, three historical campaigns. Expected sample totals: 36 accepted, 12 clicked, 18 reported, four repeat clickers; 18 report-time samples, median 600 seconds; 12 module assignments plus one path assignment, eight completed modules, two overdue. These are synthetic observations, not customer outcomes.
- The sample importer is designed to be repeatable and does not dispatch email. Its fixture is `logs/investor-release/demo-fixture.json`.
- Prior broader cross-role audit recorded 130 browser cases passed and one expected historical failure, 52 foundation checks, 225 read-only API requests without 5xx/connection failures, and 55 IDs preserved. Consult audit documents for scope; do not merge totals across different suites as if they were one run.

## 5. Open issues and uncompleted work

### Product and QA

1. **BA-23 mobile startup anomaly:** diagnostic logging was added and subsequent mobile/tablet reruns passed, but the original intermittent 390px failure's root cause remains unconfirmed. Keep it open until a recurrence is captured or a credible root-cause investigation closes it.
2. Complete manual accessibility review: keyboard-only navigation, screen readers, focus order, contrast, zoom/reflow, and touch/hover alternatives across current and legacy pages.
3. Complete browser/email-client/media compatibility checks for supported browsers, remote video behavior and real mail clients. YouTube resume behavior is not claimed.
4. Continue true saved-data testing for any feature not covered by the named browser/API workflows; a route loading or button being visible is not proof that the action works.
5. Keep reports explicit about denominator, source dataset and provenance. Current cohort/comparison figures are descriptive and unadjusted, not causal impact or a validated risk score.

### External integrations and production readiness

1. Microsoft 365 test tenant: OAuth consent/scopes, authenticated delivery, failure handling, real Outlook task-pane sideload/client acceptance remain unverified. Current Outlook/reporting support is a handoff foundation, not an integrated reporting mailbox collector.
2. Automated reporting-mailbox collection and unmatched-report operations are not implemented.
3. External identity (SAML/SSO), SCIM, Google Workspace, SCORM, localization, billing and MSP operations are roadmap items, not shipped integrations.
4. Production hosting, domain/DNS, HTTPS, remote CI, alert routing, capacity, privacy/legal/retention review and customer support/incident operations remain open.
5. Off-host backups and actual production recovery objectives are not certified. Local encrypted backup/isolated restore checks are useful evidence only. Reconcile current backup scripts and R2 storage helpers with the deployment plan; complete a genuine off-host restore test before launch.
6. Do not assume Oracle free-tier capacity, current regional availability, prices or eligibility. Recheck provider terms at deployment time. The deployment PDF's Oracle A1 + self-hosted PostgreSQL + Caddy + R2 + Brevo recommendation is a proposal, not an implemented environment. Domain and external email provider are not configured.
7. Validate Linux ARM64 build/container startup, production role bootstrap, migration flow, runtime-vs-control database roles/RLS, worker health and whether the Compose worker inherits app-only settings/health checks as intended.
8. Keep general transactional mail distinct from phishing-simulation delivery. Provider terms must explicitly allow intended testing. No external simulation delivery should be enabled until a designated test environment and explicit user authorization exist.

## 6. Recommended next steps, in order

1. Read the linked release/audit/deployment evidence and inspect `git status --short`. This checkout has a broad pre-existing changed/untracked tree; preserve it. Never use `git reset --hard`, `git clean`, broad restore, or destructive DB cleanup to make the working tree look tidy.
2. Check the local runtime without sending mail or launching a campaign: inspect relevant process/health and environment settings without printing secrets; verify database connectivity and worker pause state. Keep demo fixtures intact.
3. Re-run only the focused, non-sending checks needed for the proposed change. The latest documented commands/evidence live in the release register and `scripts/run-audit.mjs` workflows. Do not add/run tests just as a ritual; for a code change, run its relevant existing type/build/regression checks and report exact results.
4. Investigate BA-23 using the recorded viewport/session diagnostics and narrow, repeatable reproduction. Avoid treating another pass as proof the original exception is fixed.
5. Close core product QA gaps: accessibility, remaining high-value role-specific write flows, mail-client/media compatibility. Update the audit/register with evidence and residual scope.
6. Build an operational readiness checklist for a fresh Linux ARM64 deployment: bootstrap, migrations, secrets, role separation, TLS, mail, observability, off-host backup and restore. Validate Compose/workers and backup path in an isolated staging environment first.
7. Prioritize a real Microsoft 365 integration pilot and reporting-mailbox collector only when test tenant, HTTPS hostname, scoped credentials and designated test mailboxes are available.
8. Define measurable pilot acceptance criteria (setup time, activation, delivery acceptance, completion/reporting, role isolation, support response and restore timings). Label synthetic demo metrics clearly; do not state customer adoption, efficacy, compliance certification or global scale without independent evidence.

## 7. Local run and safe demo notes

From PowerShell in the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
$env:WORKER_DELIVERY_PAUSED = 'true'
.\start-local-lab.ps1 -Lan
```

The launcher applies additive audit runtime migrations and prints a private-LAN address on port 5000. Keep its terminal open. Use `http://localhost:5000` on the host PC, or the printed LAN address from a second device on the same Wi-Fi. Do not expose the port through router forwarding. If setup/audit DB provisioning is needed on a newly copied computer, inspect `.env` and the script's localhost-only safeguards first; `setup-friend.ps1` checks Node.js 22+, local PostgreSQL and dependencies. Do not paste generated credentials into chat or commit them.

The sample dataset can be imported using `node scripts/run-audit.mjs investor-demo` only if needed. It requires the isolated audit database, sink transport and paused worker. It imports historical fictional records and does not send or simulate mail. Check first whether the sample is already present; avoid unnecessary writes. The documented sample account names and expected roles are in the release report. Password remains only in the ignored private account file.

## 8. Product and security invariants for future work

- Enforce role and tenant boundaries in backend APIs, not only by hiding sidebar links. Test positive access and cross-role/cross-tenant denial.
- Employee dashboards show that employee's own information; managers see assigned teams only; OrgAdmins see their own organization; platform administration remains a separate role/surface.
- Keep customer and demo datasets explicitly separated in dashboards, reports and exports. Preserve the visible synthetic-data banner and sample-organization sending block.
- Keep simulations and external delivery disabled by default. Never send real external mail, launch a campaign, submit credentials into a phishing page, or invoke simulation tracking as a test without explicit authorization and an approved isolated test plan.
- Never collect or retain real passwords from simulated landing pages. Keep audit trails useful but redact credentials, secrets, tokens and personal data not required for the action.
- Use additive migrations where possible; retain campaign snapshots and frozen learning assignment content; preserve earned-achievement history as specified by award snapshots/archive behavior.
- Give buttons clear names, visible feedback and keyboard/touch alternatives. Hover tooltips are useful supplementary help for icon-only controls when they also work on keyboard focus, but essential action labels should be visible or exposed accessibly without waiting.
- Preserve existing data and the current broad working tree. Before any migration/seed/cleanup, inspect what the command changes and which database it targets.

## 9. Key files and evidence map

| Purpose | Location |
| --- | --- |
| Latest investor/demo release | `docs/investor-release-2026-11-12.md` |
| Cross-role control audit | `docs/button-audit-2026-11-10.md`; detailed evidence in `logs/button-audit/` |
| Earlier pilot implementation register | `docs/smb-pilot-release-2026-11-10.md` |
| Product maturity review | `docs/product-maturity-2026-11-10.md` |
| Funding/demo claims and guardrails | `docs/funding-pilot-brief.md` |
| Market research and roadmap | `docs/market-and-product-plan-2026-11-10.md` |
| Deployment proposal source/PDF | `docs/production-deployment-plan-2026-11-13.md`; `output/pdf/production-deployment-plan-2026-11-13.pdf` |
| Latest verification, launch and fixture records | `logs/investor-release/verification.json`, `launch.json`, `demo-fixture.json` |
| Local setup and run | `setup-friend.ps1`, `start-local-lab.ps1`, `scripts/run-audit.mjs` |
| Runtime/app entry points | `server/index.ts`, `server/worker.ts`, `client/`, `shared/`, `database/`, `migrations/` |
| Container/deployment scaffolding | `deployment/`, `.dockerignore`, `package.json` |

## 10. Handoff reporting format

When continuing, report briefly but precisely:

1. What changed, with file paths.
2. What exact existing checks were run and their outcome (or say none were run).
3. Data and runtime state observed; do not expose secrets.
4. Defects found, distinguishing reproduced defects, open questions and unverified integrations.
5. Remaining risks/blockers and the next concrete step.

Do not claim that “everything works” or “production ready” from a local build or synthetic demo. Keep this handoff current when material work is completed, while preserving prior dated QA evidence.
