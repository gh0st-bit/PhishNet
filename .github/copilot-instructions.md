# PhishNet – AI Agent Instructions

This repo hosts PhishNet, a full-stack phishing simulation platform. Use this as the authoritative guide for coding agents working in this codebase.

## Architecture at a Glance
- Frontend: React + Vite + Tailwind (see `phisnet/client/`). Dev server on `5173`.
- Backend: Express + TypeScript (entry `phisnet/server/index.ts`), Vite-assisted SSR/static in dev.
- Database: PostgreSQL via Drizzle ORM (schemas in `phisnet/shared/schema.ts`). Validation: `zod`/`drizzle-zod`.
- Sessions: `express-session` with Postgres (see `server/auth.ts`, `server/db.ts`).
- Notifications: persisted via `notifications` table and `NotificationService` (`server/services/notification-service.ts`).
- Background jobs: schedulers for campaigns and threat feeds (`server/services/campaign-scheduler.ts`, `server/services/threat-intelligence/threat-feed-scheduler.ts`).
- Threat intel: pluggable providers + orchestrator (`server/services/threat-intelligence/*`, central service `threat-intelligence.service.ts`).

## Modular API Routes
- Route modules live in `server/routes/*.ts` and follow `registerXxxRoutes(app)` pattern.
- Central registration: `server/routes/index.ts` (called by `server/routes.ts`). Add imports + call registration here when adding new route modules.
- Auth middlewares: `isAuthenticated`, `isAdmin`, `hasOrganization` from `server/auth.ts`. Apply per-route as in existing modules (e.g., `server/routes/threat-intelligence.ts`).

## Data Model + Validation
- Single source of truth: `phisnet/shared/schema.ts` defines all tables (Drizzle) + exported TS types.
- Prefer using `createInsertSchema(...)`/`zod` validators exported from `shared/schema.ts` (e.g., `insertCampaignSchema`, `insertEmailTemplateSchema`).
- Conventions to note:
  - DB columns are snake_case; API payloads vary. Some routes normalize fields (see email templates mapping in `server/routes.ts`). Preserve existing mapping behavior.
  - Multi-tenant fields are enforced (`organizationId` on most tables). Always verify ownership before mutating.

## Threat Intelligence Pattern
- Providers implement `ThreatFeedProvider` (`server/services/threat-intelligence/threat-feed-base.ts`). Examples: `urlhaus-provider.ts`, `openphish-provider.ts`, `otx-provider.ts`.
- Orchestrator: `ThreatIntelligenceService` does fetch → dedupe → store → stats → notifications. Dedup uses `normalizedIndicator` and time window.
- Scheduler: `threat-feed-scheduler.ts` controls periodic ingestion. Env flags:
  - `THREAT_FEED_ENABLED=true|false`
  - `THREAT_FEED_INTERVAL_HOURS=2` (default)
- Admin endpoints (see `server/routes/threat-intelligence.ts`):
  - `POST /api/threat-intelligence/ingest` (background)
  - `POST /api/threat-intelligence/ingest-now` (awaits)
  - `GET /api/threat-intelligence/scheduler/status`
  - `POST /api/threat-intelligence/scheduler/:action` (`start|stop`)

## Notifications Pattern
- Create notifications via `NotificationService.createNotification(...)` or broadcast helpers; consumers query `/api/notifications*` routes.
- Threat ingestion and campaign events emit per-user notifications (see `threat-intelligence.service.ts` and event routes in `server/routes.ts`).

## Developer Workflows
- Quick start (Windows PowerShell):
  - `phisnet\universal-setup.bat` (handles policy + setup) or `Set-ExecutionPolicy Bypass -Scope Process -Force`
  - `phisnet\deploy.ps1`; then `phisnet\start.ps1`
- Dev servers:
  - Backend only: `npm run backend:dev` (port `5000`)
  - Frontend only: `npm run frontend:dev` (port `5173`)
  - Both (concurrently): `npm run app:preview`
- Build/Start:
  - `npm run build` then `npm run start` (Express from `dist/`)
- Database:
  - `npm run db:migrate` (alias `db:push`)
  - `npm run import-data`
  - Full setup: `npm run setup` (safe migrate + seed + TI dedupe)
- Testing:
  - All: `npm test`
  - Unit: `npm run test:unit`
  - Integration: `npm run test:integration`
  - E2E (Playwright): `npm run test:e2e`

## Adding Features (Examples)
- New API domain:
  1) Create `server/routes/my-domain.ts` exporting `registerMyDomainRoutes(app)`.
  2) Import and register in `server/routes/index.ts`.
  3) Use auth guards and zod schemas from `shared/schema.ts`.
- New threat provider:
  1) Implement `ThreatFeedProvider` in `server/services/threat-intelligence/`.
  2) Add instance to `ThreatIntelligenceService.providers` array.
  3) Include `source` field and set `normalizedIndicator` consistently.
- Scheduler task:
  - Follow `campaign-scheduler.ts`/`threat-feed-scheduler.ts` pattern; expose `start(interval)`/`stop()` and report status.

## Cross-Cutting Conventions
- Logging: use the lightweight request logger in `server/index.ts`; keep API responses concise.
- Error handling: let route handlers return JSON `{ message }`; global error middleware in `server/index.ts` sends status/message.
- Security:
  - Session, auth, and role defaults are seeded at startup in `server/routes.ts` (roles tables + default roles).
  - Public tracking endpoints (`/o/*.gif`, `/c/*`, `/l/*`) must remain unauthenticated and follow existing idempotent update patterns.

## Where to Look First
- End-to-end route examples: `server/routes/*.ts` (users, campaigns, notifications, threats).
- DB + validation: `shared/schema.ts`.
- Background jobs: `server/services/*-scheduler.ts`.
- Threat ingestion: `server/services/threat-intelligence/*.ts`.
- Scripts and npm workflows: `phisnet/package.json` scripts.

Keep changes minimal, follow existing patterns, and preserve multi-tenant checks and field mappings. When in doubt, mirror a close existing module and reuse exported zod schemas and types from `shared/schema.ts`.
