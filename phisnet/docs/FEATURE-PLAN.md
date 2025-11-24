# Themed Feature Set (Prioritized)

## Simulation
- P1: Multi-channel phishing (SMS, QR, voice IVR, calendar invites, Teams/Slack, OAuth consent screen, MFA fatigue simulations).
- P1: Safe credential capture with device fingerprint, geo/time, dwell-time capture.
- P2: Attachment simulations (macro-like safe payloads), browser/device targeting, localization and RTL.
- P2: Template marketplace + A/B testing + auto-personalization by role/department and live TI.

## Monitoring & Analytics
- P1: Real-time dashboard (opens, clicks, submissions) via websockets; TTI, time-to-click.
- P1: Event stream + replay for analytics; campaign drilldowns and trends.
- P2: Cohort/funnel analysis, department heatmaps, industry benchmarks, ROI metrics.
- P2: Scheduled exports (PDF/CSV/XLSX) with branding and theming.

## Training & Behavior
- P1: Just-in-time microlearning on landing pages (contextual tips, remediation links).
- P2: Risk scoring per user/department; adaptive difficulty campaigns and training paths.
- P2: LMS-lite (SCORM/xAPI import), completions/certificates, quizzes.

## Enterprise & Governance
- P1: SAML/OIDC SSO; audit logs; admin console; role-based access (RBAC/ABAC).
- P1: Data retention policies; export/delete tooling (privacy) and tenant isolation (RLS).
- P2: SCIM provisioning; data residency configuration.

## Integrations
- P1: SIEM forwarders (Splunk, Sentinel); Outlook/Gmail Report-Phish add-ins; Slack/Teams bots.
- P2: Email gateways (M365/Google), mail providers (SES/SendGrid/Postmark), ticketing (Jira/ServiceNow), SOAR hooks.

## Security & Observability
- P1: OpenTelemetry traces/metrics/logs; centralized logging; basic WAF & rate limits.
- P1: Secrets management, per-tenant key strategy; idempotency for public endpoints.
- P2: SLO dashboards; anomaly detection on events.