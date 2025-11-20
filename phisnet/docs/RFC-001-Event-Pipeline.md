# RFC-001: Event Pipeline and Real‑Time Telemetry

## Summary
Introduce a lightweight, extensible event pipeline to capture phishing simulation signals (sent, open, click, submit, report) and stream them to real‑time dashboards and analytics workers.

## Goals
- Real‑time visibility for campaign operators (opens/clicks/submissions as they happen).
- Durable, replayable ingestion for analytics and reports.
- Clear event contracts (producer/consumer decoupling).
- Backwards compatible with existing HTTP tracking endpoints.

## Non‑Goals
- Replace Postgres as OLTP. Analytics OLAP can be evaluated later.
- Build a full SOA/mesh. Start with incremental improvements.

## Architecture
- Ingest: existing Express routes (`/o/:c/:t.gif`, `/c/:c/:t`, `/l/submit`) publish events.
- Bus: start with in‑memory queue or Redis Streams (future: Kafka/Redpanda).
- Workers: background processors for enrichment, notifications, and aggregation.
- Real‑Time: Socket.IO channel broadcasts minimally processed events to dashboards.
- Storage: Postgres (OLTP) remains source of truth for campaign results.

```
Clients → HTTP Tracking → Ingest → Bus → Workers → Postgres
                                 ↘ Socket.IO → Live Dashboards
```

## Event Contracts (v1)
- `campaign.email_sent` { campaignId, targetId, orgId, sentAt }
- `campaign.email_opened` { campaignId, targetId, orgId, openedAt, ua, ip }
- `campaign.link_clicked` { campaignId, targetId, orgId, clickedAt, url }
- `campaign.form_submitted` { campaignId, targetId, orgId, submittedAt, fields }
- `campaign.reported` { campaignId, targetId, orgId, reportedAt, channel }

All events include: `eventId`, `eventType`, `ts`, `requestMeta` (ip, ua), `version`.

## Transport (MVP)
- Phase 1: in‑process publisher + Socket.IO broadcast (namespace: `/campaigns`).
- Phase 2: Redis Streams (`XADD`) with consumer groups for workers.
- Phase 3: Kafka/Redpanda for horizontal scale.

## Security & Multi‑Tenancy
- Include `organizationId` on every event.
- Emit to per‑org rooms `org:{id}` in Socket.IO; gate with session auth.
- Rate limit public tracking endpoints; idempotency keys on writes.

## Observability
- Wrap publisher with OpenTelemetry spans/attributes (future).
- Error budget SLOs: ingest latency p95 < 500ms; event loss ~0.

## Rollout Plan
1. Add Socket.IO server and minimal publisher API.
2. Broadcast `email_opened|link_clicked|form_submitted` in real‑time.
3. Add Redis Streams behind publisher (feature flag).
4. Build dashboard widget to render live counters by campaign.
5. Backfill analytics with batched workers.

## Acceptance Criteria (Phase 1)
- Socket.IO connects and authenticates a logged‑in user.
- Live events received in browser when an open/click/submit occurs for same org.
- No change in existing API behavior or data integrity.
