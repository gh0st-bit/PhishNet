# PhishNet button and role audit

Update 12 November 2026: [the investor demonstration release](investor-release-2026-11-12.md) records the subsequent UI, reporting, archive/restore and achievement fixes. Earlier findings below are retained as historical evidence.
Audit started 10 November and continued into 11 November 2026. **The application does not receive an “everything works” sign-off.** The checks found real failures beyond page loading. Repairs are listed below, along with the remaining failures and actions that were deliberately not executed.

## Scope and evidence

The audit inventories source control definitions, visits the available pages with four roles, opens tabs/dialogs/menus, checks confirmations/downloads/validation, and exercises actual write workflows with disposable records. The generated [coverage summary](../logs/button-audit/coverage.md) contains final counts and browser statistics. The filterable [control register](../logs/button-audit/control-register.csv) retains individual observations; [source controls](../logs/button-audit/source-controls.json) include file/line references.

Initial coverage: **460 current source control definitions, 87 page/role visits, 890 initial control groups and 129 restricted page visits**. Repeated row actions are grouped with instance counts. Source inventory includes conditionally rendered and legacy/unrouted components; it is not a claim that all definitions appeared in the browser. Follow-up probes cover nested controls and retry ambiguous observations.

Final verification:

| Check | Result |
| --- | --- |
| Named browser cases, after focused retests | **130 passed; 1 expected failure (BA-16); 0 current unexpected failures** across 131 distinct cases |
| Additional mobile repeats | Four passed; together with the focused retest, five fresh mobile runs passed after the initial startup failure |
| Foundation regressions | **52 passed** |
| TypeScript / production build | Passed; upstream Zod annotation and test-runtime deprecation notices remain non-fatal |
| Read-only API sweep | **225 requests; no 5xx or connection failures**. Responses: 127 success, 94 expected permission denials, four validation responses |
| Data preservation | All **55 baseline IDs** remain present |
| Disposable fixture cleanup | Zero remaining across eleven checked resource types; log in `logs/button-audit/cleanup.json` |
| Nested/retry observations | **1,871 probes**. Seventeen historical observations remain inconclusive after data/label changes; listed individually in [inconclusive controls](../logs/button-audit/inconclusive-controls.csv) |

Those seventeen observations are not silently counted as passes or confirmed defects. Read-only probes that prevented writes are also not persistence passes. Actual save/delete/read-back results are established by the named workflow tests. This is a broad cross-role assessment with explicit gaps, not certification of every possible control/input/state combination.

| Role | Account used | Expected scope |
| --- | --- | --- |
| Platform Admin | `qa.admin@review.test`; supplied `admin.1@audit.test` also checked by the regression | Platform operations and organization management; tenant content remains scoped |
| OrgAdmin | `qa.owner@review.test` | Own organization setup, people, campaigns, content and reports |
| Manager | `qa.manager@review.test` | Assigned-team reporting, exports and reminders; personal settings/notifications |
| Employee | `qa.employee@review.test` | Own inbox, learning, progress, profile and notifications |
| Other tenant | `qa.betaowner@review.test` | Negative checks against the first organization's records |

Additional temporary accounts for **each of the four roles** test notifications and every available dashboard/email preference toggle without changing existing users' read/unread state. A disposable invited OrgAdmin checks registration, login, platform-access denial and account deletion. Temporary accounts/resources are cleaned up; inputs/endpoints/statuses are recorded in `logs/button-audit/write-workflows.jsonl`. Existing account details remain in the earlier role review.

## Defects repaired during the audit

| ID | Problem | Repair and verification |
| --- | --- | --- |
| BA-01 | Audit Logs View had no handler | Opens the selected row's actual detail dialog; browser open/close check |
| BA-02 | Daily Goal Start was inert | Opens the due lesson, or the training list; actual navigation check |
| BA-03 | Dashboard lesson Start/Continue/Review buttons were inert | Opens the selected lesson; removed the misleading whole-card pointer |
| BA-04 | Dashboard quiz Start/Retake buttons were inert | Opens the selected assessment; a zero score is still an attempt eligible for Retake |
| BA-05 | Badge tiles looked clickable but had no destination; “Certificates” opened badges | Tiles are detail links; quick action accurately says Achievements/View earned badges |
| BA-06 | Account-menu Organization link led non-admin roles to an inaccessible page | OrgAdmin uses tenant settings; Manager/Employee are not offered the link; all four account menus tested |
| BA-07 | OrgAdmin template Create New Campaign shortcut used the platform route | Opens the organization campaign wizard |
| BA-08 | Reports View Details discarded the selected campaign and OrgAdmin route | Opens the selected campaign's detail dialog on the correct role route |
| BA-09 | Template Test Mail only displayed a fake “sent” success | Replaced with a real sandboxed local Preview Email; explicitly says no email was sent; import/export/save/preview tests |
| BA-10 | Update Target called a missing endpoint and returned 404 | Added group-scoped update with role, tenant, membership and field allowlist checks; recipient CRUD/import and cross-role/tenant negatives |
| BA-11 | Campaign editor substituted resource ID 1 and showed an empty template selector | Uses persisted IDs and normalizes the API template list shape |
| BA-12 | Campaign edits rejected blank dates, shifted local times, reused stale detail cache and could reset advanced options | Nullable unset dates; local/UTC round-trip; cache invalidation; merge saved settings before validation; draft-only save/edit/read-back tests |
| BA-13 | Copy Invite Link constructed a token from the stored hash; clipboard use failed on HTTP/LAN | Copy only freshly issued valid URLs, never hashes. After reload, Resend generates a new link. Clipboard fallback and honest error messages added; create/copy/resend/revoke tested in sink mode |
| BA-14 | Public Create Account redirected to login before submitting the invite | Public acceptance is exempt from authenticated-session redirects; invited OrgAdmin lifecycle check |
| BA-15 | Badge creation sent the wrong fields and missed required category; point/publish edits were not retained | Corrected category/points/published payloads, response mapping and update persistence; badge CRUD browser cycle |
| BA-17 | Explicit icon-button titles were overridden; vertical menu buttons lacked labels | Preserve explicit names and label vertical menus More actions; recipient edit/delete and menus exercised |
| BA-18 | Reset/invitation password labels pointed to wrappers instead of inputs | Connected labels to actual inputs; public form and acceptance checks |
| BA-19 | Platform Admin could open a Manager-only page that returned permission errors | Redirect to the platform home; Manager retains the assigned-team page |
| BA-20 | Schedule rows only showed recipient counts, making similar schedules indistinguishable | Show recipient addresses and label each enable switch; create/edit/toggle/delete tested without sending reports |

## Confirmed failures still open

### BA-16 — automatic badge earning and progress disagree with the admin criteria

**Reproduced:** a disposable learner completes an assigned lesson and receives **50 points**. A published badge configured as `points_earned` with threshold **1** remains unearned, and its detail page reports **0%**. Proof: `logs/button-audit/badge-gap.json`.

The admin form emits `points_earned`, `streak_days`, `quiz_pass`, `training_complete` and `quizzes_passed`; the award service handles only the legacy points/streak variants. Progress calculation uses another partial set and shows zero for streak progress. The award query also needs to honor published status. Custom/manual criteria have no demonstrated awarding workflow.

**Solution:** use one validated criterion model and evaluator for creation, unlocks and displayed progress; support the advertised criteria; filter unpublished badges; make awards idempotent under concurrent completions. Add threshold, quiz/training, streak and concurrency regressions before closing this issue. The browser suite explicitly marks this scenario as an expected failure; it is not counted as a working feature.

### BA-21 — badge mutation errors lack user-visible feedback

The badge form's create/update/delete mutations lack error handlers. The original valid-looking Create request returned HTTP 400 while the form stayed open without explaining the failure. The payload mismatch is repaired, but a future rejected request or network error can still leave the user without clear feedback.

**Solution:** add visible mutation-error messages and retry behavior, with tests that reject a save/delete and then recover successfully. This is separate from the repaired create/update payload.

### BA-22 — badge deletion confirmation contradicts retention behavior

**Source-review finding, with live constraint metadata checked:** the confirmation says users who earned the badge will keep it, while the DELETE route removes the badge and the `user_badges.badge_id` foreign key uses `ON DELETE CASCADE`. The constraint definition is recorded in `cleanup.json`. The completed browser deletion test uses an unearned disposable badge; an earned-badge retention cycle is not certified.

**Solution:** define the intended lifecycle, then either archive badges while retaining earned history or accurately warn about permanent removal. Add an earned-badge deletion/retention test before closing this issue.

### BA-23 — one intermittent mobile startup error remains unexplained

The original 130-case run hit the application's “This page could not load” boundary once at a 390px viewport. A fresh targeted run and four additional repeats passed, with no console errors captured in those repeats. Evidence is in `logs/button-audit/mobile-repeat.json`; the original assertion is preserved in `final-browser.json`. Diagnostic logging now records future errors to `mobile-console.jsonl` if they recur. The initial run did not capture the underlying React exception, so its cause is unconfirmed; this is not silently treated as a proven fix.

## Deliberately unverified actions and practical limits

- Campaign Launch, local simulation Send, recipient open/report/submission actions and live delivery were not executed, respecting the instruction to keep simulations paused. Draft creation and preflight checks do not send messages. Worker delivery remains paused and external delivery disabled.
- Network reconnaissance, external DNS/provider verification, live Microsoft OAuth/Outlook installation and external SSO require designated test resources. A disabled/configuration-gated button is not marked as a successful integration test.
- Destructive retention Run now, actual key rotation and account-wide MFA changes were not applied to retained accounts. Existing foundation tests cover isolated rotation/security behavior, which is not a substitute for clicking those actions on a deployed customer instance.
- Arbitrary remote video playback, file-picker operating-system behavior across devices, every browser/assistive-technology combination and every possible input/state are not certified by this audit. Selected mobile layouts are included in the regression.
- The read-only sweep prevented mutation requests. `WRITE_DEFERRED` alone is not proof that a save works. Named browser workflows exercise persistence; `PROBE_ERROR` can mean the earlier localhost/IPv6 connection issue, changed labels/data or a selector problem. Those raw records are retained, rather than misreported as application failures. Employee `/local-inbox` redirecting to `/employee/inbox` is intentional.

## Verification and repeatability

Actual workflow coverage includes shared account navigation/logout, profile save/reload, password mismatch validation, session/theme settings, notification refresh/open/read/delete, every available notification preference toggle, groups/recipients/CSV import, SMTP profile edits without replacing secrets, template HTML import/export/preview/save/edit/delete, landing preview/clone/edit/delete, campaign draft/preflight/edit/delete, report exports in four formats, schedules, badge CRUD and invited organization-admin lifecycle.

Browser suites: `button-workflows`, `button-more-workflows`, `button-resource-workflows`, `button-admin-lifecycle`, `button-notification-workflows`, `button-known-gaps`, plus the existing role/content/navigation/refresh/pilot regression suites. **`logs/button-audit/verification.json` is the consolidated machine-readable result.** The original full run and focused retest remain separately preserved in `final-browser.json` and `final-browser-rerun.json`; historical failures are not erased. The notification retest creates a fresh uniquely titled synthetic notification, avoiding a stale older fixture and duplicate titles in the bell's recent list.

All 55 previously recorded IDs across ten tables are checked again using `scripts/verify-product-preservation.mjs`. Cleanup targets only this audit's exact synthetic name patterns. Original QA accounts and review team/path/content remain available. Database IDs and historical audit/version records can advance during testing; an ID-preservation check does not claim that the database is byte-for-byte unchanged.

The legacy content/role regression intentionally retains synthetic users and content for rechecking, as before. Their inputs and returned IDs are in `logs/role-review/browser-inputs.jsonl`. Logged non-baseline campaign-notification fixtures are classified as demo so they do not become customer reporting data. The cleanup log records these classifications as well as removed disposable records.

Use `scripts/qa-button-audit.mjs` for inventory/probes, `scripts/qa-button-followup.mjs` for nested controls/retries, and `scripts/report-button-audit.mjs` to regenerate the CSV/coverage summary. The standard browser regression must continue to exclude the historical simulation-launch test while delivery is paused.
