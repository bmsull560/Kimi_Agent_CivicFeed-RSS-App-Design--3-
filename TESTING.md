# Testing

Test strategy, layers, required gates, fixtures, and commands for CivicFeed.

## Test Layers

| Layer                | Tool                         | Scope                                                                                                                      | Location                           |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Backend unit tests   | Vitest 4                     | API routes, RSS parsing, caching, search, migrations, URL security, scheduler, AI enrichment, feed health, feed validation | `backend/src/*.test.ts`            |
| Frontend E2E         | Playwright 1.61              | User journeys, smoke tests, accessibility                                                                                  | `tests/e2e/`                       |
| Live feed validation | Playwright (separate config) | Real feed reachability                                                                                                     | `tests/e2e/civicfeed-live.spec.ts` |

## Backend Unit Tests

**Runner**: Vitest 4 with `environment: node`, `globals: false`
**Database**: In-memory SQLite (`CIVICFEED_DB_PATH=:memory:`) — isolated per test run
**Log level**: Silent (`CIVICFEED_LOG_LEVEL=silent`)

### Test Files

| File                          | Tests                                                                          | Coverage                 |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------ |
| `server.test.ts`              | API route tests — health, feeds, articles, search, stats, discover             | All 14 endpoints         |
| `rss.test.ts`                 | Feed fetching, retry, circuit breaker, status recording                        | `rss.ts`                 |
| `cache.test.ts`               | Article caching, TTL expiry, save/retrieve                                     | `cache.ts`               |
| `search.test.ts`              | FTS5 search, recent articles, tag parsing                                      | `search.ts`              |
| `migrations.test.ts`          | Migration application, idempotency, schema-drift detection                     | `migrations.ts`          |
| `url-security.test.ts`        | SSRF guard — private IPs, blocked ports, redirect validation                   | `url-security.ts`        |
| `scheduler.test.ts`           | Due-feed refresh, concurrency, enrichment batch processing                     | `scheduler.ts`           |
| `ai.test.ts`                  | AI enrichment — Ollama/OpenAI fallback, extractive summary, keyword extraction | `ai.ts`                  |
| `feed-validator.test.ts`      | Feed validation logic — schema, GUIDs, dates, content checks                   | `feed-validator.ts`      |
| `apply-feed-statuses.test.ts` | Feed status application from validation results                                | `apply-feed-statuses.ts` |
| `discovery.test.ts`           | Feed discovery via HTML link tag parsing                                       | `discovery.ts`           |
| `recap.test.ts`               | Weekly recap generation, category grouping, tag aggregation                    | `recap.ts`               |
| `logger.test.ts`              | Structured logging, level filtering                                            | `logger.ts`              |

**Total**: 71 backend unit tests, run in ~6 seconds.

### Backend E2E Test Helper

| File                                  | Purpose                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `backend/tests/e2e/seed-test-feed.ts` | Seeds a test feed into the database for E2E test setup |

## Frontend E2E Tests

**Runner**: Playwright 1.61
**Base URL**: `http://127.0.0.1:4173` (Vite preview)
**Timeout**: 60s per test, 10s for assertions
**Parallelism**: Sequential (`fullyParallel: false`)

### Browser Projects

| Project            | Device          |
| ------------------ | --------------- |
| `chromium-desktop` | Desktop Chrome  |
| `firefox-desktop`  | Desktop Firefox |
| `webkit-desktop`   | Desktop Safari  |
| `mobile-chromium`  | Pixel 5         |

### Test Files

| File                              | Purpose                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `civicfeed-smoke.spec.ts`         | Basic page load, navigation, API connectivity                                  |
| `civicfeed-journeys.spec.ts`      | Full user journeys — feed browsing, reading, search, bookmarks, archive, recap |
| `civicfeed-accessibility.spec.ts` | Automated accessibility scans with @axe-core/playwright                        |
| `civicfeed-live.spec.ts`          | Live feed validation (excluded from default CI run)                            |

### E2E Fixtures

| File                  | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `global-setup.ts`     | Starts backend, seeds DB, starts Vite preview, configures mock RSS server |
| `mock-rss-server.mjs` | Local HTTP server serving mock RSS/Atom XML for deterministic E2E tests   |

**Total**: ~108 test cases across 4 browser projects.

## Required Quality Gates

These must pass before merging any PR (per `AGENTS.md`):

### Frontend

| Gate                      | Command                        |
| ------------------------- | ------------------------------ |
| Lint                      | `npm run lint`                 |
| Format check              | `npm run format:check`         |
| Type check                | `npm run type-check`           |
| Build                     | `npm run build`                |
| Feed catalog verification | `npm run verify:feeds`         |
| Acceptance audit          | `npm run audit:acceptance`     |
| Route rendering           | `npm run verify:routes`        |
| Dist verification         | `npm run verify:dist`          |
| Browser tests             | `npm run verify:browser`       |
| Accessibility tests       | `npm run verify:accessibility` |

### Backend

| Gate       | Command                            |
| ---------- | ---------------------------------- |
| Lint       | `cd backend && npm run lint`       |
| Type check | `cd backend && npm run type-check` |
| Unit tests | `cd backend && npm test`           |

### Full Local Verification

```bash
npm run lint && npm run format:check && npm run type-check && npm run build && cd backend && npm run lint && npm run type-check && npm test
```

## CI Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR to `main`/`master`:

### Frontend Job

1. `npm ci` — install dependencies
2. `npm audit --audit-level=low` — dependency audit
3. `npm run lint` — ESLint
4. `npm run format:check` — Prettier check
5. `npm run type-check` — TypeScript
6. `npm run build` — Vite production build
7. `npm run verify:feeds` — feed catalog validation
8. `npm run verify:routes` — route rendering
9. `npm run verify:dist` — dist artifact verification
10. `npx playwright install` — browser setup (cached)
11. `npm run verify:browser` — Playwright E2E
12. `npm run verify:accessibility` — axe-core accessibility scans

### Backend Job

1. `npm ci` (in `backend/`)
2. `npm audit --audit-level=low` — dependency audit
3. `npm run type-check` — TypeScript
4. `npm run lint` — ESLint
5. `npm test` — Vitest unit tests

## Additional Verification Commands

| Command                                       | Purpose                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run verify`                              | Full pipeline: lint → feed checks → acceptance audit → route render → build → dist check → browser tests |
| `npm run test:live`                           | Live feed validation (separate Playwright config, not merge-blocking)                                    |
| `npm run validate:live-feeds`                 | Script-based live feed validation                                                                        |
| `npm run apply:live-feed-statuses`            | Apply live feed status results to catalog                                                                |
| `npm run sync:working-feeds`                  | Sync working feed statuses                                                                               |
| `cd backend && npm run validate:feeds`        | Live validation of all feeds in catalog                                                                  |
| `cd backend && npm run validate:feeds:strict` | Strict live validation (fails on any unreachable feed)                                                   |

## Coverage Gaps

Current gaps identified in `REPO_AUDIT.md` and tracked in `ROADMAP.md`:

- **No frontend unit tests**: Zero unit/integration tests below the Playwright E2E layer (ROADMAP Sprint 2)
- **No API contract tests**: REST API is undocumented; no OpenAPI spec or contract tests (ROADMAP Sprint 2)
- **No coverage thresholds**: No coverage measurement or enforcement (ROADMAP Sprint 2)
- **E2E network dependency**: Some E2E tests depend on live external feeds; mock RSS server mitigates this for core journeys

## Testing Conventions

- Mock external RSS and AI services in unit tests; use the mock RSS server (`tests/e2e/mock-rss-server.mjs`) for E2E setup
- Do not weaken tests or skip assertions to make a failing suite pass
- Add or update unit tests for new backend behavior in `backend/src/*.test.ts`
- Add or update Playwright specs for new critical user journeys in `tests/e2e/`
- Use `supertest` for HTTP-level API route tests (already a dev dependency)
