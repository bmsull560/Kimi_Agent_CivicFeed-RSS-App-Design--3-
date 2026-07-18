# Development

Detailed local environment setup and day-to-day development workflow for CivicFeed.

## Prerequisites

- **Node.js**: 20.x or later (required by better-sqlite3 native bindings and React 19)
- **npm**: 10.x or later
- **System dependencies for Playwright**: only needed to run npm test; installed automatically by npm run test:install
- **SQLite** (optional): for manual database inspection via sqlite3 CLI

## Initial Setup

### 1. Clone the repository

```bash
git clone https://github.com/bmsull560/Kimi_Agent_CivicFeed-RSS-App-Design--3-.git
cd Kimi_Agent_CivicFeed-RSS-App-Design--3-
```

### 2. Install frontend dependencies

```bash
npm install
```

Note: npm install may print warnings about allow-scripts for packages with install scripts (esbuild, better-sqlite3). These warnings are informational; the native binaries used by this environment are prebuilt. If your environment blocks install scripts, run npm approve-scripts --allow-scripts-pending to review and allow them.

### 3. Install backend dependencies

```bash
cd backend
npm install
cd ..
```

### 4. (Optional) Install Playwright browsers

Only needed if you plan to run the end-to-end test suite:

```bash
npm run test:install
```

### 5. Seed the database

```bash
cd backend
npm run seed
cd ..
```

This syncs the 590+ feed catalog from feeds.ts into SQLite. The database file is created at backend/data/civicfeed.db by default.

### 6. Copy environment variables (optional)

```bash
cp .env.example .env
```

Edit .env to adjust values as needed. See Environment Variables below.

## Running the App Locally

### Start the backend

```bash
cd backend
npm run dev
```

The backend starts on http://localhost:4000 with tsx watch (auto-reload on file changes). Migrations apply automatically on startup.

### Start the frontend

```bash
npm run dev
```

The Vite dev server starts on http://localhost:3000 and proxies /api/* requests to http://localhost:4000.

### Or start both from root

```bash
npm run dev          # frontend in current terminal
npm run dev:backend  # backend in another terminal
```

## Environment Variables

| Variable                      | Used In  | Default                   | Description                                                                                                                        |
| ----------------------------- | -------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| VITE_API_URL                  | Frontend | ""                        | Base URL for backend API calls. When empty, uses same-origin /api (proxied by Vite/nginx) plus http://localhost:4000 in local dev. |
| PORT                          | Backend  | 4000                      | Port the Express API listens on.                                                                                                   |
| CIVICFEED_DB_PATH             | Backend  | backend/data/civicfeed.db | Path to the SQLite database file.                                                                                                  |
| CIVICFEED_LOG_LEVEL           | Backend  | info                      | Controls backend log verbosity: error, warn, info, or silent.                                                                      |
| CIVICFEED_REFRESH_INTERVAL_MS | Backend  | 60000                     | Milliseconds between background refreshes of due feeds. Set to 0 to disable.                                                       |
| CIVICFEED_DISABLE_SCHEDULER   | Backend  | (unset)                   | Set to "1" to disable the background scheduler entirely.                                                                           |
| CIVICFEED_ALLOW_PRIVATE_URLS  | Backend  | (unset)                   | Set to "1" to disable SSRF private IP checks (local dev only).                                                                     |
| OLLAMA_URL                    | Backend  | http://localhost:11434    | Ollama API URL for AI summaries.                                                                                                   |
| OPENAI_API_KEY                | Backend  | ""                        | OpenAI API key for AI summaries. If empty, falls back to extractive summaries.                                                     |
| OPENAI_MODEL                  | Backend  | gpt-4o-mini               | OpenAI model to use for summaries.                                                                                                 |

## Day-to-Day Commands

### Frontend (from repository root)

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| npm run dev          | Start Vite dev server (http://localhost:3000)        |
| npm run build        | Production build (tsc + vite build, output to dist/) |
| npm run lint         | ESLint check                                         |
| npm run format       | Prettier auto-format all files                       |
| npm run format:check | Prettier check (CI gate)                             |
| npm run type-check   | TypeScript type checking                             |
| npm run preview      | Preview production build locally                     |

### Backend (from backend/ directory)

| Command                       | Description                                            |
| ----------------------------- | ------------------------------------------------------ |
| npm run dev                   | Start backend with tsx watch (auto-reload)             |
| npm run build                 | Compile TypeScript to dist/                            |
| npm run start                 | Run compiled backend (node dist/server.js)             |
| npm run seed                  | Sync feed catalog into SQLite                          |
| npm run lint                  | ESLint check                                           |
| npm run type-check            | TypeScript type checking                               |
| npm test                      | Run Vitest unit tests                                  |
| npm run test:watch            | Run Vitest in watch mode                               |
| npm run validate:feeds        | Live validation of all feeds in catalog                |
| npm run validate:feeds:strict | Strict live validation (fails on any unreachable feed) |
| npm run ingest                | Run feed ingestion script                              |

### Testing

| Command                      | Description                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------- |
| npm run test:install         | Install Playwright browsers and OS dependencies                               |
| npm test                     | Run Playwright E2E suite                                                      |
| npm run test:live            | Run live feed validation tests (separate config)                              |
| npm run verify:browser       | Run Playwright browser tests                                                  |
| npm run verify:accessibility | Run accessibility scans (axe-core)                                            |
| npm run verify               | Full verification pipeline (lint, feeds, audit, routes, build, dist, browser) |

### Verification Scripts

| Command                          | Description                               |
| -------------------------------- | ----------------------------------------- |
| npm run verify:feeds             | Validate the backend feed catalog         |
| npm run audit:acceptance         | Validate architectural invariants         |
| npm run verify:routes            | Verify all routes render without errors   |
| npm run verify:dist              | Verify production build artifacts         |
| npm run validate:live-feeds      | Script-based live feed validation         |
| npm run apply:live-feed-statuses | Apply live feed status results to catalog |
| npm run sync:working-feeds       | Sync working feed statuses                |

### Security

| Command                                   | Description                       |
| ----------------------------------------- | --------------------------------- |
| npm audit --audit-level=low               | Audit frontend dependencies       |
| cd backend && npm audit --audit-level=low | Audit backend dependencies        |
| npm audit fix                             | Auto-fix frontend vulnerabilities |

## Frontend Route Map

| Path                    | Page Component | Description                                       |
| ----------------------- | -------------- | ------------------------------------------------- |
| /                       | Dashboard      | Category overview, priority feeds, recent entries |
| /feeds                  | FeedDirectory  | Searchable, filterable feed directory             |
| /feed/:id               | FeedDetail     | Single feed detail with articles                  |
| /reading                | ReadingStream  | Unified reading stream across feeds               |
| /entry/:feedId/:entryId | EntryDetail    | Full article view                                 |
| /bookmarks              | Bookmarks      | Bookmarked articles                               |
| /archive                | Archive        | Archived articles                                 |
| /search                 | SearchResults  | Full-text search results                          |
| /recap                  | Recap          | Weekly recap by category                          |
| *                       | NotFound       | 404 page                                          |

## Backend Module Map

| Module              | Responsibility                                                 |
| ------------------- | -------------------------------------------------------------- |
| server.ts           | Express app, 14 API routes, request logging, graceful shutdown |
| feeds.ts            | Feed catalog (590+ feeds, 370 KB)                              |
| rss.ts              | Feed fetching with circuit breaker and retry                   |
| rss-parser.ts       | XML parsing, entry ID generation, date normalization           |
| cache.ts            | Article cache (15-min TTL)                                     |
| search.ts           | FTS5 search and recent articles                                |
| ai.ts               | AI enrichment (Ollama/OpenAI/extractive)                       |
| enrichment-queue.ts | Async job queue for AI enrichment                              |
| scheduler.ts        | Background scheduler (refresh, enrich, health)                 |
| feed-health.ts      | Feed health validation (7 checks)                              |
| discovery.ts        | Website-to-feed discovery                                      |
| url-security.ts     | SSRF guard for outbound HTTP                                   |
| migrations.ts       | Numbered, transactional SQLite migrations                      |
| db.ts               | Database connection, WAL mode, seeding                         |
| logger.ts           | Structured JSON logger                                         |
| recap.ts            | Weekly recap generation                                        |

## Debugging Tips

### Backend logs

Set CIVICFEED_LOG_LEVEL to control verbosity. Logs are structured JSON to stdout/stderr. Use docker compose logs backend or redirect output to a file for analysis.

### SQLite inspection

```bash
sqlite3 backend/data/civicfeed.db
.tables
.schema feeds
SELECT id, name, status FROM feeds LIMIT 10;
SELECT * FROM feed_fetch_status WHERE failure_count > 0 LIMIT 10;
SELECT COUNT(*) FROM article_cache;
SELECT id, name, applied_at FROM migrations ORDER BY id;
```

### Circuit breaker state

Circuit breaker state is held in memory (not persisted). To inspect, check logs for "circuit breaker opened" or "circuit breaker half-open" messages. Use GET /api/feeds/:id/status to see if failureCount is at or above the threshold (5).

### Vite proxy

The Vite dev server proxies /api/* to http://localhost:4000. If API calls fail in the browser, verify the backend is running. Check the Vite config in vite.config.ts for proxy settings.

## Common Issues

### better-sqlite3 native binding errors

If you see errors about native bindings or node-gyp, ensure you are using Node.js 20+. The package ships prebuilt binaries for common platforms. If your platform is unsupported, you may need to install build tools (python3, make, g++) and run npm rebuild better-sqlite3.

### Playwright browser installation

If browser tests fail with "Executable doesn't exist", run npm run test:install to download browser binaries. This requires OS-level dependencies which Playwright installs automatically with --with-deps.

### Port conflicts

The frontend uses port 3000 (Vite dev) and the backend uses port 4000. If either port is in use, change PORT for the backend or configure Vite's server.port in vite.config.ts.

### Database migration errors

If the backend fails to start with a migration error, see RUNBOOK.md Incident 5 for recovery procedures.
