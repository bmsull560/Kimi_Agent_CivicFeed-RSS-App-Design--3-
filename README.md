# CivicFeed

A single-page web application for discovering, organizing, and reading U.S. government and public-interest RSS feeds. CivicFeed aggregates feeds from federal agencies, Congress, courts, public health bodies, journalism outlets, and other civic sources into one searchable, personalizable reading experience.

## Current Feature Set

- **Dashboard** — Category overview, priority feeds, and recent cached entries
- **Feed Directory** — Searchable, filterable directory of 590+ verified government and public-interest RSS feeds across 18 categories
- **Feed Curation** — Add, edit, enable/disable, and remove RSS/Atom feeds with URL validation, duplicate detection, and website-to-feed discovery
- **OPML Import / Export** — Bring your own subscriptions in and back them up
- **Unified Reading Stream** — Read latest entries from any feed with client-side caching, refresh status, and error recovery
- **Frontend Search & Filtering** — Search cached articles by keyword and filter by source, category, or read state
- **Reading State** — Bookmark, mark as read, and archive articles; state persists in the browser
- **Responsive & Accessible** — Works on desktop and mobile; keyboard navigable, visible focus states, semantic HTML, and reduced-motion support
- **Optional Backend API** — SQLite-backed article cache, FTS5 search, AI summaries, and recap generation when the backend is running

## Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   React SPA │──────▶│  Vite dev /  │──────▶│  Express API    │
│  (src/)     │      │  nginx prod  │      │  (backend/src)  │
└─────────────┘      └──────────────┘      └─────────────────┘
       │                                            │
       │                                            ▼
       ▼                                    ┌─────────────────┐
┌─────────────┐                             │  better-sqlite3 │
│ localStorage│                             │  article cache  │
│ feed cache  │                             └─────────────────┘
└─────────────┘
```

- **Frontend**: React 19 + TypeScript, Vite, Tailwind CSS v3, shadcn/ui, React Router HashRouter
- **Backend**: Express + TypeScript + better-sqlite3
- **Data**: Feed catalog lives in `src/data/feeds.ts` and is mirrored in `backend/src/feeds.ts`; verification scripts keep them in sync
- **Caching**: Browser `localStorage` for frontend feed entries and user state; SQLite for backend article cache and search index
- **Deployment**: Docker Compose with nginx frontend and Node backend

## Technology Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS v3
- shadcn/ui components
- React Router (HashRouter)
- Express 4
- better-sqlite3
- Playwright (end-to-end tests)

## Prerequisites

- **Node.js**: 20.x or later (required by `better-sqlite3` native bindings and React 19)
- **npm**: 10.x or later
- **System dependencies for Playwright**: only needed to run `npm test`; installed automatically by `npm run test:install`

## Setup

### 1. Install dependencies

```bash
npm install
cd backend && npm install
```

> **Note:** `npm install` may print warnings about `allow-scripts` for packages with install scripts (e.g., `esbuild`, `better-sqlite3`). These warnings are informational; the native binaries used by this environment are prebuilt. If your environment blocks install scripts, run `npm approve-scripts --allow-scripts-pending` to review and allow them.

### 2. (Optional) Install Playwright browsers for tests

Only needed if you plan to run the end-to-end test suite:

```bash
npm run test:install
```

### 3. Run the frontend

```bash
npm run dev
```

The dev server runs on http://localhost:3000.

The frontend works standalone for browsing feeds; it falls back to direct fetches and CORS proxies when the backend is not running.

### 4. (Optional) Run the backend

The backend enables server-side article search, weekly recap, and persistent server-side caching. When the backend is not running, search falls back to the local browser cache and the Weekly Recap page explains that the backend is required.

```bash
cd backend
npm run seed      # one-time: syncs feed catalog into SQLite
npm run dev       # starts API on http://localhost:4000
```

When the frontend dev server is running, Vite proxies `/api/*` requests to `http://localhost:4000`.

### 5. Build for production

```bash
npm run build
```

Static output is written to `dist/`.

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Used In | Default | Description |
|----------|---------|---------|-------------|
| `VITE_API_URL` | Frontend | `""` | Base URL for backend API calls. When empty, the frontend uses same-origin `/api` (proxied by Vite/nginx) plus `http://localhost:4000` in local dev. |
| `PORT` | Backend | `4000` | Port the Express API listens on. |
| `CIVICFEED_DB_PATH` | Backend | `backend/data/civicfeed.db` | Path to the SQLite database file. |
| `CIVICFEED_LOG_LEVEL` | Backend | `info` | Controls backend log verbosity: `error`, `warn`, `info`, or `silent`. |
| `CIVICFEED_REFRESH_INTERVAL_MS` | Backend | `60000` | Milliseconds between background refreshes of due feeds. Set to `0` to disable scheduled refreshes. |

## Data Storage & Privacy

CivicFeed is designed as a local-first application with no authentication or cloud sync.

| Data | Location | Lifetime | Notes |
|------|----------|----------|-------|
| Feed catalog (default sources) | `src/data/feeds.ts` / `backend/src/feeds.ts` | Shipped with the app | Public, curated list of civic RSS/Atom feeds. Kept in sync by verification scripts. |
| User-added feeds, categories, bookmarks, read/unread state, archived articles, display preferences | Browser `localStorage` | Per-browser, until cleared | Tied to the origin (`localhost:3000`, `localhost:8080`, or the deployed domain). No encryption at rest. |
| Cached article entries (frontend) | Browser `localStorage` | Per-browser, until cleared | Fetched feed entries used for offline viewing and fast reloads. |
| Article cache, search index, feed fetch status | Backend SQLite (`backend/data/civicfeed.db`) | Per-deployment | Stored on the server running the backend. No personal accounts; shared across all users of the same deployed instance. |

No analytics, tracking, or third-party telemetry are included. External URLs open in a new tab with `rel="noopener noreferrer"`. Feed content is fetched from the publisher directly or through user-configured feeds; the application does not proxy content except for the optional backend fetch path in a self-hosted deployment.

## Development Commands

```bash
npm run dev          # start frontend dev server
npm run dev:backend  # start backend dev server (from root)
npm run type-check   # TypeScript type checking (frontend)
cd backend && npm run type-check  # backend type checking
npm run build        # production build of frontend
npm run lint         # ESLint
npm run preview      # preview production build locally
```

## Test Commands

```bash
npm run test:install # install Playwright browsers and OS dependencies (run once)
npm test             # run the Playwright end-to-end suite
cd backend && npm test  # run backend unit tests
npm run type-check   # run TypeScript type checking (frontend)
cd backend && npm run type-check  # backend type checking
npm run verify       # run the full verification pipeline: lint, feed checks, cache check, route render, build, dist check, and browser tests
```

## Security / Dependency Commands

```bash
npm audit --audit-level=low          # audit frontend dependencies
cd backend && npm audit --audit-level=low  # audit backend dependencies
npm audit fix                         # auto-fix frontend vulnerabilities where possible
cd backend && npm audit fix           # auto-fix backend vulnerabilities where possible
```

The CI workflow runs `npm audit --audit-level=low` for both the root and backend workspaces. As of the latest dependency refresh, both workspaces report **zero vulnerabilities** at `low` severity or higher. Re-run the audit commands above after any dependency change; if `npm audit fix` cannot resolve a finding, document it here with the advisory ID and justification for acceptance.

The verification pipeline also includes feed-catalog checks:

```bash
npm run verify:feeds      # validate frontend and backend feed catalogs are in sync
npm run verify:rss-cache  # validate RSS/cache scripts
npm run verify:routes     # verify all routes render without errors
npm run verify:dist       # verify production build artifacts
npm run verify:browser    # run Playwright browser tests
npm run verify:accessibility  # run automated accessibility scans (requires Playwright browsers)
```

Backend validation:

```bash
cd backend
npm run validate:feeds        # live validation of all feeds in the catalog
npm run validate:feeds:strict # live validation that fails on any unreachable feed
```

## Feed Ingestion Behavior

- The frontend tries the backend API first, then falls back to direct feed fetches and public CORS proxies.
- Fetched entries are cached in browser `localStorage` for quick revisits.
- Stale cache (older than 15 minutes) is shown immediately while a background refresh is attempted.
- The backend ingests feeds on demand when `/api/feeds/:id/articles` is requested and stores them in SQLite with FTS5 indexing.
- Every backend fetch attempt is recorded in the `feed_fetch_status` table, including the last success and error timestamps, attempt/success/failure counts, the last error message, and the next scheduled fetch time.
  - `GET /api/feeds/:id/status` returns fetch diagnostics for a single feed.
  - `GET /api/stats/feeds` returns aggregate feed health counts (total, working, with status, with recent error, stale).
- The backend also runs a lightweight scheduler that refreshes due feeds in the background every `CIVICFEED_REFRESH_INTERVAL_MS` milliseconds (default 60 seconds). It processes up to 50 due feeds per tick with a concurrency limit of 5, records fetch status, and caches articles for search. Set `CIVICFEED_REFRESH_INTERVAL_MS=0` to disable scheduled refreshes.
- The Add Feed dialog supports feed discovery: enter a website URL and click **Discover** to query `/api/discover?url=...` for linked RSS/Atom feeds. The endpoint parses `<link rel="alternate">` tags, resolves relative URLs, and returns up to 10 candidate feeds.
- User-added feeds, bookmarks, read/unread state, archived articles, and display preferences are persisted in `localStorage`.

## Database Migrations

The backend uses a numbered, transactional migration system (`backend/src/migrations.ts`). On startup it applies pending migrations in order and records each one in the `migrations` table.

- Migrations are idempotent: running them twice has no extra effect.
- New schema changes must be added as a new numbered migration with an `up` function.
- Migration 001 creates the core tables (`feeds`, `article_cache`, `article_summaries`, `article_tags`).
- Migration 002 creates the self-contained FTS5 `article_search` virtual table, rebuilds it if an old contentless version is detected, and populates it from existing cached articles.
- Migration 003 creates the `feed_fetch_status` table to record per-feed fetch outcomes, attempt/success/failure counts, last error messages, and the next scheduled fetch time.

To inspect applied migrations:

```bash
cd backend
sqlite3 data/civicfeed.db "SELECT id, name, applied_at FROM migrations ORDER BY id;"
```

## Security Considerations

- Feed-provided HTML is sanitized to plain text before rendering in article cards and detail views.
- The backend fetches feeds directly without CORS proxying; deploy it only in environments where outbound HTTP is acceptable.
- Backend feed fetching is guarded against SSRF: private/reserved IPs, loopback, link-local, IPv6 site-local, and cloud metadata endpoints are rejected; only `http:` and `https:` URLs on standard ports are allowed.
- Manual redirect handling validates every hop with the same SSRF rules and enforces a maximum redirect count.
- Fetched responses are bounded by a size limit and a request timeout to prevent abuse or runaway transfers.
- External URLs are opened with `rel="noopener noreferrer"`.
- No authentication or user accounts are implemented; all data is per-browser `localStorage` or per-deployment SQLite.

## Docker Deployment

Run the full stack (frontend + backend API + seeded SQLite database) with Docker Compose:

```bash
docker compose up --build
```

- Frontend: http://localhost:8080
- API health: http://localhost:8080/api/health
- API readiness: http://localhost:8080/api/ready
- Feed status: http://localhost:8080/api/feeds/:id/status
- Feed stats: http://localhost:8080/api/stats/feeds
- Feed discovery: http://localhost:8080/api/discover?url=...

The backend emits structured JSON request logs to stdout/stderr. Set `CIVICFEED_LOG_LEVEL` to `error`, `warn`, `info` (default), or `silent` to control verbosity.

The backend seeds its database on first run and persists it in the `civicfeed-data` volume. To stop and remove the containers:

```bash
docker compose down
```

The frontend image builds the Vite SPA and serves it via nginx, which also proxies `/api/` requests to the backend service.

## Continuous Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the full quality suite on every push and pull request:

- Frontend lint, type-check, build, feed-catalog verification, RSS/cache verification, route rendering, dist verification, cross-browser Playwright tests, and automated accessibility scans.
- Backend type-check, unit tests, and dependency audit.

You can run the same gates locally:

```bash
npm run lint
npm run type-check
npm run build
npm run verify:feeds
npm run verify:rss-cache
npm run verify:routes
npm run verify:dist
cd backend && npm run type-check
cd backend && npm test
npm run verify:browser         # requires Playwright browsers: npm run test:install
npm run verify:accessibility   # requires Playwright browsers
```

## Known Limitations

- Server-side search, Weekly Recap, and website-to-feed discovery require the backend to be running. The frontend provides local search over cached entries and direct RSS fetching when the backend is unavailable.
- Feed fetching in standalone frontend mode relies on public CORS proxies or the publisher's CORS headers; some networks or feeds may block these proxies.
- The backend does not implement authentication or multi-user isolation. Do not deploy it in an untrusted multi-user environment without adding access controls.
- Real-world feed availability varies; the catalog validation script reports stale, blocked, or malformed feeds as warnings rather than hard failures.
- Persistence is local to the browser and the deployed backend SQLite file; there is no cloud sync or cross-device state.
- OPML import/export is processed client-side in the browser, so very large subscription lists may hit browser `localStorage` size limits.

## Screenshots

Representative screenshots are not yet included in the repository. They will be added to `docs/screenshots/` once the UI stabilizes.
