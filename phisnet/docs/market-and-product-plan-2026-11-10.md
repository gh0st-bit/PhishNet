# PhishNet market comparison and product decisions

Update 12 November 2026: [the investor demonstration release](investor-release-2026-11-12.md) records the subsequent UI, reporting, archive/restore and achievement fixes. Earlier findings below are retained as historical evidence.
Implementation update: [the SMB pilot release register](smb-pilot-release-2026-11-10.md)
records subsequent delivery. Historical gaps below now have partial implementations:
team-scoped managers, mapped onboarding, learning paths, versioned rotation,
encrypted restore and Outlook task-pane foundations. External integration gates
and remaining product work are explicitly listed in that register.

Research date: 10 November 2026. Sources are vendors' own documentation. This is a capability comparison, not a pricing or procurement recommendation; marketing claims are not independent benchmarks.

| Reference product | Relevant documented capability | PhishNet assessment and action |
| --- | --- | --- |
| [KnowBe4 advanced reporting](https://www.knowbe4.com/advanced-reporting) | Executive reporting and combined phishing/training insights | Added a real-data management overview, period selection and CSV. Board-ready recurring narrative reports and benchmarking remain future work. |
| [Hoxhunt manager reports](https://support.hoxhunt.com/hc/en-us/articles/28470407466268-Getting-Started-with-Hoxhunt-Reports-as-a-Manager) | Manager visibility into reportees, simulations, learning and performance, filtering and CSV | Added a dedicated Manager home with campaign, audience, reporting and learning metrics. Current permissions are organization-wide; reporting-line/team delegation is still a gap. |
| [usecure uPhish](https://help.usecure.io/en/articles/3210551-understanding-uphish-the-basics) | Repeated simulations, custom content, inline training and tracking | Existing campaign/template/landing/automation foundations retained. Added a guided local simulation flow that creates its own resources and produces observable results. Adaptive personalized programs are not implemented. |
| [Gophish email reporting](https://docs.getgophish.com/user-guide/documentation/email-reporting) | Recording suspicious-message reporting as a positive behavior | Added an authenticated local inbox Report action with idempotent recipient statistics. Outlook/Gmail add-ins and IMAP collection remain unimplemented. |
| [Microsoft Attack Simulation Training insights](https://learn.microsoft.com/en-us/defender-office-365/attack-simulation-training-insights) | Simulation outcomes and training coverage/completion insights | Added management outcomes and current learning completion/overdue counts. Longitudinal effectiveness, cohort comparisons and recommendations need further product work. |

The comparison suggests three practical priorities: make setup easier, show defensible outcomes, and give managers actionable visibility. It does not establish a commercial moat or prove demand.

## Implemented in this increment

- Dedicated `/manager` home; organization dashboard uses the same scoped metrics. Platform home also includes the overview.
- Campaign date windows (7/30/90/all), recent campaign links, audience results, setup checklist, current learning and CSV export.
- Positive reporting counts/rates in overview, campaign detail and Reports. Accepted deliveries are the denominator; unsent recipients no longer inflate report delivery counts.
- Icon-only shared buttons gain inferred accessible labels and hover/focus tooltips where their icon is recognized; explicit `help` supports context-specific wording. Existing visible labels stay visible. Delete was tested with hover, keyboard focus and Escape.
- Isolated browser inbox, guided two-recipient demonstration, signed landing link, fake-code form and harmless text attachment, using the actual delivery queue and tracking endpoints.
- Fixed same-origin API handling in lab mode and a Reports timestamp comparison that excluded fresh campaigns on the local database timezone.

[W3C guidance for hover/focus content](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html) informed the tooltip interaction. A 500 ms delay is this product's choice, not a WCAG requirement. Tooltips supplement labels; touch users still need accessible names and clear visible primary actions. This is not a complete accessibility audit of every custom control.

## Prioritized next work

1. **Pilot gate:** backup/restore rehearsal, documented recovery objectives, HTTPS deployment, real-device LAN confirmation, external SMTP/provider acceptance and failure tests in a separately authorized staging environment.
2. **Customer workflow:** team/reporting hierarchy and delegated managers; enrollment/import onboarding; localization; reviewed templates; retention/deletion controls and accessibility review.
3. **Enterprise integrations:** SSO/SCIM deployment proof, Outlook/Gmail reporting add-ins, delivery-domain configuration and provider bounce/report reconciliation. Existing code/configuration is not equivalent to verified integration.
4. **Outcome depth:** cohort trends, time to report, repeat behavior, remediation impact and consistent report narratives. Attachment download is not evidence of execution.
5. **Operational maturity:** production capacity tests, alerts/runbooks, security review, atomic key rotation, dependency/license inventory and infrastructure review. Key rotation remains deliberately blocked pending a safe implementation.

Global availability requires these deployment, privacy, support and operational decisions. This increment establishes a stronger local pilot and demonstrable outcomes; it does not certify a global production release.
