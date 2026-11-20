# User workspace and refresh review - 10 November 2026

## Changes

The employee dashboard now uses the same application layout, header and sidebar as its other pages. Dashboard stays first; My inbox, Training, Quizzes, Articles, Flashcards, Badges, Leaderboard, My profile and Notifications are direct sidebar destinations. This removes the dashboard's separate navigation shell. Mobile uses the same collapsible navigation.

Employees open their inbox at `/employee/inbox` or through the dashboard's **Open my inbox** shortcut. Their old `/local-inbox` URL redirects there. Management keeps its campaign-creation/operator interface at `/local-inbox`; employees cannot see campaign creation or another recipient's mailbox. No permissions were broadened.

Refresh controls now use a common component that waits for completion, prevents duplicate clicks while pending, shows a spinner and reports success or failure. Notifications refresh reloads both the list and unread bell count. Initial loading, empty notifications and fetch failure have distinct states; failure can be retried. Mark-all-read and deletion also invalidate the bell count.

Updated refresh controls cover Notifications, employee Dashboard/Training/Quizzes/Inbox, management overview, Articles, Flashcards, Audit logs, Threat landscape, and both Dashboard/Email notification settings panels. Dashboard refresh reloads all eight backing queries; inbox refresh includes the selected message details. Buttons using the refresh icon for other actions, such as key regeneration or invitation resend, keep their distinct behavior.

Most original buttons already had a fetch/refetch handler. Their background requests lacked clear feedback, and several watched initial loading instead of manual refresh activity. This change makes refresh completion and failures visible and verifies actual requests rather than relying on a click animation.

## Constraints and verification

No simulation was launched, no new campaign was sent, and no recipient open/report/training-link action was performed for this task. Browser fixtures used to demonstrate notification replacement and failure/retry are intercepted responses, not database records. Existing practice messages remain available for the owner to use manually.

Verification suite: `tests/browser/refresh-workspace.spec.ts` checks ten page refresh controls, two settings panels, fresh notification content, failure/retry and unified desktop/mobile navigation. Existing login Enter, sidebar scroll and role page-load checks are also run. TypeScript passes; all 55 baseline records remain present. Source copies are under `backups/dashboard-refresh-2026-11-10`.

Results: **68 distinct browser checks passed** (16 refresh/workspace checks and 52 existing navigation/surface checks). The first combined run passed 66; two workspace assertions initially matched both header and content headings. Scoping those assertions to the main content resolved the test ambiguity, and both reruns passed. Production frontend/backend build also passed, with the existing nonblocking dependency annotation warnings. Desktop/mobile screenshots are `logs/product-maturity/unified-inbox-1280.png` and `unified-inbox-390.png`.

The owner confirmed that the host Wi-Fi URL works from another laptop and Android phone. No network/firewall settings were changed.

## Use it yourself

Open **http://192.168.100.20:5000** on the second device and sign in as `qa.employee@review.test`, password `QaReview2026!`. Open **My inbox** from the sidebar. Existing messages can be previewed without generating tracking activity; the explicit message actions are there for when you choose to run a test.

When you decide to launch a new exercise, sign in separately as `qa.owner@review.test` with the same QA password. In its management sidebar open **Local inbox**, enter a campaign name, choose the employee account and click **Send local simulation**. This is the manual action that creates and queues a campaign; it has not been performed in this task. The employee then opens My inbox and uses its message controls.

The supplied `admin.1@audit.test` account belongs to a different organization from these QA accounts. Use operator and employee accounts from the same organization. The default practice landing page accepts the fake training code `DEMO`; no real password is needed. See [the local simulation guide](local-simulation-guide.md) for the full manual flow.
