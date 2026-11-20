# PhishNet

PhishNet is a phishing simulation and security awareness platform with organization management, campaigns, email templates, landing pages, training, quizzes, threat intelligence, and reporting.

## Project layout

The application is a single npm package in `phisnet/`. Run application commands from that directory.

| Location | Purpose |
| --- | --- |
| `phisnet/client/` | React, TypeScript, Vite, Tailwind, and UI components |
| `phisnet/server/` | Express API, authentication, services, and background schedulers |
| `phisnet/shared/` | Drizzle schema, validation, and shared types |
| `phisnet/migrations/` | Database migrations and SQL utilities |
| `phisnet/scripts/` | Database, development, and operational utilities |
| `phisnet/tests/` and `phisnet/e2e/` | Automated tests |
| `phisnet/Exported-DB/` and `phisnet/backups/` | Data exports and backup/restore helpers |
| `phisnet/attached_assets/` and `phisnet/uploads/` | Referenced assets and uploaded content |
| `Documentation/` and `reference-docs/` | Academic reports, presentations, designs, and reference materials |

The root npm manifest is separate from the application manifest. Application commands belong in `phisnet/`.

## Local setup

Prerequisites: Node.js with npm, PostgreSQL, and Git. Existing development configuration targets Node.js 20 and PostgreSQL 15. Sessions use PostgreSQL; Redis is not needed for session storage.

```sh
cd phisnet
npm ci
```

Keep an existing `.env`. For a new checkout, copy `.env.example` to `.env`:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```sh
# Linux/macOS
cp .env.example .env
```

Configure these values for your own PostgreSQL database and credentials:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phishnet
DB_USER=phishnet_user
DB_PASSWORD=replace-with-your-password
DATABASE_URL=postgresql://phishnet_user:replace-with-your-password@localhost:5432/phishnet
SESSION_SECRET=replace-with-a-random-secret
MASTER_ENCRYPTION_KEY=replace-with-a-base64-encoded-32-byte-key
```

The server connects using the individual `DB_*` settings. Drizzle tooling uses `DATABASE_URL`, and startup also requires that variable. Keep both forms consistent; URL-encode special characters in the connection URL. The example environment file contains repeated settings: ensure repeated assignments agree.

Generate independent values for `SESSION_SECRET` and `MASTER_ENCRYPTION_KEY` by running this command twice:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the master encryption key stable for an existing database: organization secrets depend on it. Optional provider keys and email settings are listed in `.env.example`; configure SMTP profiles in the application for campaign delivery.

### Database initialization

Create the PostgreSQL role and database matching your environment first. For a **new, empty development database**, apply the current shared schema:

```sh
npm run db:push
```

For an existing database, back it up and review the applicable migrations before making changes. `npm run db:generate` generates Drizzle migrations and `npm run db:migrate` applies journaled migrations. Additional SQL files in `migrations/` are standalone historical changes, not an instruction to run every SQL file in filename order.

`npm run db:migrate:safe` is a targeted threat-intelligence migration, not a full database initializer. `npm run setup` also runs `import-data`, which truncates tables before importing the JSON snapshots in `Exported-DB/`; use it only when intentionally replacing that data.

### Start development

```sh
npm run dev
```

Open **http://localhost:5000**. The Express entrypoint currently fixes the listener to `localhost:5000`; changing `PORT` in `.env` alone does not change it. Development serves the UI through Vite integration in Express.

Use an account in your configured database. Old setup scripts and exported databases contain different account defaults; there is no universal login guaranteed by this README.

For separate frontend work, `npm run frontend:dev` starts Vite on port 5173 and `npm run app:preview` starts it alongside the backend. `npm run frontend:full` starts the frontend with the mock API, which is separate from the real backend.

## Build and run

```sh
npm run build
npm start
```

The build writes frontend assets to `phisnet/dist/public/` and bundles the backend to `phisnet/dist/index.js`. The runtime still needs the configured PostgreSQL database and environment variables.

Production session cookies expect HTTPS by default. `ALLOW_INSECURE_COOKIES=true` is available for local HTTP testing of a production build. The server's localhost binding requires appropriate hosting/proxy configuration for external access.

Docker, Compose, and devcontainer setup have been removed. Use a local Node.js and PostgreSQL installation with `.env`; `.env.example` is the single onboarding template. Retained installation and deployment scripts are legacy operational tools required by other retained scripts or CI configuration. Their presence is not a guarantee of a working deployment; the direct npm commands above describe the current package structure.

## Commands and tests

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the integrated development application |
| `npm run build` | Build frontend and backend |
| `npm start` | Run the compiled application |
| `npm run check` | TypeScript check |
| `npm test` | Jest tests |
| `npm run test:unit` | Jest unit tests with coverage |
| `npm run test:integration` | Jest integration tests |
| `npm run test:e2e` | Playwright tests |
| `npm run security:scan` | Dependency audit |
| `npm run ti:ingest` | Manually ingest threat feeds; writes to the database |
| `npm run db:dedupe` | Deduplicate threat intelligence; changes database records |

Jest configuration is in `phisnet/jest.config.js`; Playwright configuration is in `phisnet/playwright.config.ts`. Integration and browser tests require their application/database setup. Existing test configuration and TypeScript errors may need separate fixes; cleanup does not change application or test code.

Background campaign, threat-feed, and data-retention schedulers start with the server. For development without automatic feed ingestion or retention processing, set `THREAT_FEED_ENABLED=false` and `DATA_RETENTION_ENABLED=false` in `.env`. Intervals include `THREAT_FEED_INTERVAL_HOURS` and `DATA_RETENTION_INTERVAL_HOURS`.

## Database backup and restore

Keep existing exports and backups. PostgreSQL tools must be on `PATH` for the following examples. Replace the database, role, and filenames with your own values.

```sh
# Create a custom-format backup
pg_dump -h localhost -U phishnet_user -d phishnet -Fc -f phishnet.dump

# Restore into an already-created, separate empty database
pg_restore -h localhost -U phishnet_user -d phishnet_restored --no-owner phishnet.dump

# Restore a plain SQL backup into a separate empty database
psql -h localhost -U phishnet_user -d phishnet_restored -f backup.sql

# Check restored data
psql -h localhost -U phishnet_user -d phishnet_restored -c "SELECT COUNT(*) FROM users;"
```

Additional backup and restore helpers remain in `phisnet/Exported-DB/`. Update both `DB_NAME` and `DATABASE_URL` before connecting the application to a restored database. Preserve the associated encryption keys when restoring existing organization data.

## Architecture and troubleshooting

The UI uses React, Wouter, TanStack Query, and React Hook Form with Zod. Express registers API routes through `server/routes.ts` and `server/routes/index.ts`; authentication is in `server/auth.ts`. PostgreSQL access is configured in `server/db.ts`, with models in `shared/schema.ts`. API routes generally live under `/api`; protected routes require a session and enforce roles and organization membership. Socket.IO supports realtime updates.

- **Missing database configuration:** check all five `DB_*` values and confirm PostgreSQL is running and accepts the configured role.
- **Migration connection differs from the app:** make `DATABASE_URL` match the individual `DB_*` values.
- **Login does not persist on local production HTTP:** check the secure-cookie setting described above.
- **Missing frontend build:** run `npm run build` before `npm start`.
- **Address already in use:** check port 5000; the entrypoint currently fixes that port.
- **Encrypted settings cannot be read after a restore:** verify the original master key and organization encryption keys were retained.

Agent instructions and third-party documentation remain with their respective tools and datasets. Historical implementation reports and duplicate setup guides have been consolidated into this README.

## Production modernization

See [implementation status and release gates](phisnet/docs/production-readiness.md) for the isolated audit environment, durable campaign worker, new runtime migrations, verification commands, staging deployment candidate, and outstanding production blockers. The existing production deployment scripts are not the release source of truth.
