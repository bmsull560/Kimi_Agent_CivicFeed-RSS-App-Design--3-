# Architecture

System structure, service boundaries, data flow, and reliability patterns for CivicFeed.

## System Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   React SPA │──────▶│  Vite dev /  │──────▶│  Express API    │
│  (src/)     │      │  nginx prod  │      │  (backend/src)  │
└─────────────┘      └──────────────┘      └─────────────────┘
                                                   │
                                                   ▼
                                           ┌─────────────────┐
                                           │  better-sqlite3 │
                                           │  article cache  │
                                           └─────────────────┘
```

- **Frontend**: React 19 + TypeScript, Vite 7, Tailwind CSS v3, shadcn/ui, React Router (HashRouter)
- **Backend**: Express 4 + TypeScript + better-sqlite3 (WAL mode)
- **Deployment**: Docker Compose — nginx frontend (port 8080) proxies `/api/` to Node backend (port 4000)

## Service Boundaries

### Frontend (`src/`)

The frontend is a single-page application that consumes the backend API exclusively. It does **not** perform client-side RSS fetching, XML parsing, or use public CORS proxies.

| Directory         | Responsibility                                                                    |
| ----------------- | --------------------------------------------------------------------------------- |
| `src/pages/`      | Route-level page components (10 pages)                                            |
| `src/hooks/`      | Data-fetching and state hooks (5 hooks)                                           |
| `src/lib/`        | Utilities: API client (`rss.ts`), OPML import/export, user data persistence, hubs |
| `src/components/` | Shared UI components + shadcn/ui primitives (64 items)                            |
| `src/types.ts`    | Shared TypeScript interfaces for API responses and domain models                  |

**Frontend routes** (defined in `src/App.tsx`):

| Path                      | Page           |
| ------------------------- | -------------- |
| `/`                       | Dashboard      |
| `/feeds`                  | Feed Directory |
| `/feed/:id`               | Feed Detail    |
| `/reading`                | Reading Stream |
| `/entry/:feedId/:entryId` | Entry Detail   |
| `/bookmarks`              | Bookmarks      |
| `/archive`                | Archive        |
| `/search`                 | Search Results |
| `/recap`                  | Weekly Recap   |
| `*`                       | Not Found      |

**User state** persists in browser `localStorage` only — bookmarks, read/unread state, archived articles, user-added feeds, and display preferences. No authentication or cloud sync.

### Backend (`backend/src/`)

The backend owns RSS fetching, XML parsing, caching, search, AI enrichment, feed health, scheduling, and the feed catalog.

| Module                | Responsibility                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `server.ts`           | Express app, route definitions (14 endpoints), request logging, graceful shutdown                                                      |
| `feeds.ts`            | Feed catalog — single source of truth (590+ feeds across 18 categories)                                                                |
| `rss.ts`              | Feed fetching with retry, circuit breaker, and fetch-status recording                                                                  |
| `rss-parser.ts`       | XML parsing (fast-xml-parser), entry ID generation, date normalization                                                                 |
| `cache.ts`            | Article cache (SQLite, 15-minute TTL), save and retrieve cached articles                                                               |
| `search.ts`           | FTS5 full-text search and recent-articles queries                                                                                      |
| `ai.ts`               | AI enrichment — Ollama/OpenAI summaries with extractive fallback, keyword extraction                                                   |
| `enrichment-queue.ts` | Async job queue for background AI enrichment (pending → running → done/failed)                                                         |
| `scheduler.ts`        | Background scheduler — refreshes due feeds, processes enrichment batches, validates feed health                                        |
| `feed-health.ts`      | Feed health validation — reachability, XML/schema validity, GUID stability, date sanity, freshness                                     |
| `discovery.ts`        | Website-to-feed discovery via `<link rel="alternate">` tag parsing                                                                     |
| `url-security.ts`     | SSRF guard — blocks private/reserved IPs, cloud metadata, non-standard ports; enforces timeouts, redirect limits, response size limits |
| `migrations.ts`       | Numbered, transactional, idempotent SQLite migrations with schema-drift detection                                                      |
| `db.ts`               | Database connection, WAL mode, auto-migration, feed seeding                                                                            |
| `logger.ts`           | Structured JSON logger with configurable levels (error, warn, info, silent)                                                            |
| `recap.ts`            | Weekly recap generation — groups articles by category, aggregates top tags                                                             |

### Data Layer

SQLite database (`better-sqlite3`) with WAL journal mode. Path configured via `CIVICFEED_DB_PATH` (default: `backend/data/civicfeed.db`). Schema managed by 5 numbered migrations (see `DATA_MODEL.md` for full schema).

## Data Flow

### Feed Catalog → Database

1. Feed catalog is hardcoded in `backend/src/feeds.ts` (590+ feeds)
2. On startup or `npm run seed`, `db.ts` syncs feeds into SQLite via upsert + delete-orphan transaction
3. Docker entrypoint (`docker-entrypoint.sh`) runs `node dist/db.js --seed` before starting the server

### Article Fetch (on-demand)

```
Client GET /api/feeds/:id/articles
  → Check SQLite cache (15-min TTL)
  → Cache hit? Return cached entries + attach AI enrichments
  → Cache miss? fetchFeed() → parseRssXml() → saveArticles() → return
  → Enqueue missing enrichments for background processing
```

### Background Scheduler

Runs every `CIVICFEED_REFRESH_INTERVAL_MS` (default 60s) with a 5-second initial delay:

1. **Refresh due feeds**: selects up to 50 feeds where `next_fetch_at <= now`, fetches with concurrency 5, saves articles to cache
2. **Process enrichment batch**: claims up to 20 pending jobs, processes with concurrency 3
3. **Validate feed health**: runs every hour (separate interval), validates all feeds

### Search

FTS5 virtual table (`article_search`) is kept in sync via triggers on `article_cache` (insert/delete). Search queries join FTS5 results with `article_cache` and `feeds` to resolve full article data, summaries, and tags in a single query.

## Reliability Patterns

### Circuit Breaker (`rss.ts`)

- Per-feed circuit breaker with three states: closed, open, half-open
- Opens after 5 consecutive failures (`CIRCUIT_FAILURE_THRESHOLD`)
- Stays open for 5 minutes (`CIRCUIT_OPEN_MS`), then transitions to half-open
- Half-open allows a single probe request; success closes, failure re-opens

### Retry with Backoff + Jitter (`rss.ts`)

- Up to 3 total attempts (1 initial + 2 retries)
- Exponential backoff: 500ms, 1000ms, 2000ms, capped at 4s
- Full jitter: `random(0, min(base * 2^attempt, max))`
- Only retries on 5xx, 429, 408, and network errors (status 0)

### SSRF Guard (`url-security.ts`)

- Blocks private/reserved IPs: 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x (cloud metadata), 0.x, 224+ multicast
- Blocks IPv6 loopback (`::1`)
- Blocks non-standard ports (22, 25, 53, 110, 143, 3306, 5432, 6379, etc.)
- Enforces: 15s request timeout, max 5 redirects (each hop re-validated), 10 MB response size limit
- Only `http:` and `https:` schemes allowed
- `CIVICFEED_ALLOW_PRIVATE_URLS=1` disables IP checks (for local dev only)

### Cache TTL (`cache.ts`)

- Article cache: 15-minute TTL (`CACHE_TTL_MS`)
- Old entries pruned on save (entries older than 2× TTL)
- HTTP headers: `ETag` + `Cache-Control: private, must-revalidate, max-age=60` on articles endpoint

### Feed Fetch Status Tracking (`rss.ts`)

- Success: next fetch scheduled in 15 minutes
- Failure: next fetch scheduled in 5 minutes
- Recorded in `feed_fetch_status` table: last success/error timestamps, attempt/success/failure counts, error messages

## Architectural Constraints

1. **Single source of truth for feeds**: `backend/src/feeds.ts` — frontend fetches `/api/feeds`
2. **Backend owns RSS**: all fetching, parsing, caching in backend; frontend only calls API
3. **No public CORS proxies**: no `allorigins.win`, `corsproxy.io`, `codetabs.com`, or similar
4. **Async enrichment**: AI summarization runs in background queue, not in request path
5. **No double caching**: HTTP cache headers over custom localStorage caching for feed data
