# 90‑Day Roadmap (World‑Class Simulator Track)

## 0–30 Days (Foundation)
- Real‑Time: Socket.IO backend + live campaign widget (opens/clicks/submits).
- Eventing: Publisher abstraction; emit events from tracking routes.
- Identity: SAML/OIDC SSO; audit logs schema; admin audit endpoints.
- Reporting: Scheduled CSV/PDF exports MVP with email delivery.
- Hardening: Rate limiting on public tracking; basic WAF rules; secrets posture.

Acceptance
- Connect as an org user and see live campaign events in dashboard.
- Audit entries for admin actions (login, role change, campaign launch).

## 31–60 Days (Channels & Analytics)
- Channels: SMS + QRishing flows; safe credential capture with contextual microlearning.
- Analytics: Cohort/funnel views; department heatmaps; org/industry benchmarks.
- Integrations: SIEM forwarder (Splunk/Sentinel); Outlook “Report Phish” add‑in stub.
- Governance: SCIM provisioning; RBAC/ABAC policy model.

Acceptance
- Launch SMS/QR campaigns and view unified analytics.
- SIEM receives normalized security events; add‑in posts to backend.

## 61–90 Days (Adaptive & Enterprise)
- Adaptive training: Risk scores per user; targeted microlearning; difficulty ramp.
- Integrations: Teams/Slack bots; calendar invite and OAuth consent simulations.
- Data: OLAP store for analytics (ClickHouse or DuckDB) via CDC; scheduled reports v2.
- Observability: OpenTelemetry traces/metrics/logs; SLOs & dashboards.

Acceptance
- Risk score trends drive campaign and training personalization.
- Exec/board‑ready exports scheduled and consistent across tenants.