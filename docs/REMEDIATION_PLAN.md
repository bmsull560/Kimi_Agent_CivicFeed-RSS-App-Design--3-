# CivicFeed Remediation Plan

This plan captures the findings from the Phase 1 foundation audit and the remaining work required to make CivicFeed a complete, production-ready civic news platform.

## Phase 1 Status: COMPLETE

Phase 1 focused on establishing a clean baseline: installation, build, lint, type-check, existing tests, and documentation.

### What was fixed

- Added `npm test`, `npm run test:install`, and `npm run type-check` scripts so the validation suite is runnable from a clean checkout.
- Added `npm run type-check` to the backend package for explicit type checking separate from build.
- Fixed the stale-cache end-to-end test by aborting CORS proxy requests deterministically, preventing the test from timing out while waiting for external proxies.
- Rewrote `README.md` with architecture overview, prerequisites, exact setup commands, environment variables, development/test/production commands, security considerations, deployment instructions, and known limitations.
- Verified the full local validation pipeline passes:
  - `npm install` (root and backend)
  - `npm run lint`
  - `npm run build`
  - `npm test`
  - `npm run verify:feeds`, `verify:rss-cache`, `verify:routes`, `verify:dist`
  - `cd backend && npm run build`

### Known P0/P1 blockers resolved

- Missing test runner and type-check scripts.
- Failing stale-cache browser test.
- Undocumented backend seeding and test setup steps.

## Remaining Work (P1 — Product Completeness)

### 1. Feed Management

The app currently ships a static, read-only catalog. Users cannot curate their own collection.

- [ ] Add a feed from an RSS/Atom URL with live validation and feed discovery from a website URL.
- [ ] Edit feed metadata (title, category, tags).
- [ ] Enable/disable feeds without deleting them.
- [ ] Delete user-added feeds.
- [ ] Detect duplicate feeds by URL or canonical URL.
- [ ] Organize feeds into categories/tags/folders (user-defined and catalog-derived).
- [ ] OPML import and export.
- [ ] Show last-successful-refresh time and clear feed-level error reporting.

### 2. Feed Ingestion Pipeline

The current client-side fetch is resilient but ad-hoc. A dependable pipeline is needed.

- [ ] Move scheduled ingestion to the backend with a configurable refresh interval.
- [ ] Robust RSS/Atom/RDF parsing with consistent field normalization.
- [ ] Sanitize feed-provided HTML before storage and rendering.
- [ ] Resolve relative URLs against feed and item base URLs.
- [ ] Extract title, source, author, publication date, summary, canonical URL, and image where available.
- [ ] Deduplicate articles using stable GUIDs and canonical URLs.
- [ ] Add request timeouts, bounded retries, and exponential backoff.
- [ ] Isolate feed failures so one unreachable source does not block others.
- [ ] Record fetch status and diagnostics (HTTP status, parse errors, latency) without leaking secrets.

### 3. Unified Reading Experience

The current experience is feed-centric; a true unified reading stream is missing.

- [ ] Chronological unified article feed across all enabled sources.
- [ ] Pagination or stable infinite scrolling.
- [ ] Source, category, date, and read-status filters.
- [ ] Keyword search (frontend localStorage fallback when backend is unavailable).
- [ ] Read/unread state and bookmarks.
- [ ] Archive/hide action.
- [ ] Article detail view (currently links open the source site directly).
- [ ] Reflect filter/search state in the URL for shareable views.
- [ ] Loading, empty, offline, stale-data, and failure states.

### 4. Personalization and Persistence

Today only the frontend feed cache persists. User state and preferences need durable storage.

- [ ] Persist user-added feeds, categories, bookmarks, read status, archived articles.
- [ ] Store display preferences and refresh preferences.
- [ ] Decide storage strategy: localStorage for single-device use, backend + SQLite for multi-device/multi-user future.

### 5. Design and Accessibility

The UI is functional but has not been systematically audited for accessibility.

- [ ] Responsive layout audit across mobile, tablet, and desktop widths.
- [ ] Keyboard navigation and visible focus states for all interactive controls.
- [ ] Semantic HTML, proper labels, and accessible names.
- [ ] Color contrast audit and reduced-motion support.
- [ ] Ensure no important action is available only on hover.
- [ ] Fix any clipped text, overflow, or overlapping controls.
- [ ] Target WCAG 2.2 AA for core journeys.

### 6. Security and Privacy

- [ ] Add SSRF protection in backend feed fetching (block private, loopback, link-local, metadata-service, and other unsafe targets).
- [ ] Apply request size, timeout, and redirect limits on backend fetch.
- [ ] Validate external URLs before fetch and before rendering links.
- [ ] Confirm no secrets are bundled into the client build.
- [ ] Add dependency audit and static-analysis checks to CI.
- [ ] Document what user data is stored and where.

### 7. Reliability and Observability

- [ ] Structured application errors with actionable messages.
- [ ] Feed-fetch logging without secret leakage.
- [ ] Backend health and readiness checks (basic `/api/health` exists).
- [ ] Refresh metrics and status reporting.
- [ ] Deterministic database migrations (currently schema is created inline).
- [ ] Idempotent seed/demo data.

### 8. Engineering Quality Gates

- [ ] Add a CI pipeline (GitHub Actions or similar) that runs the same gates used locally: install, lint, type-check, build, backend build, and browser tests.
- [ ] Add unit/integration tests for feed parsing, caching, and ingestion.
- [ ] Resolve or document npm dependency vulnerabilities.
- [ ] Pin runtime and package-manager versions explicitly.
- [ ] Add `.env.example` files.
- [ ] Ensure no build output, secrets, or machine-specific files are committed.

## Recommended Phase Order

1. **Phase 2 — Feed Curation**: user-added feeds, edit/delete/enable/disable, categories, OPML import/export, duplicate detection.
2. **Phase 3 — Unified Reader**: unified article stream, read/unread, bookmarks, archive, filters, URL state, article detail view.
3. **Phase 4 — Backend Ingestion**: scheduled ingestion, retries, deduplication, SSRF protection, migrations, search/recap robustness.
4. **Phase 5 — Accessibility, Polish, and CI**: a11y audit, responsive fixes, dependency/security audit, CI pipeline, expanded test coverage.

## Stop Rules for Future Phases

- If a phase requires a fundamental architecture change (e.g., switching from SQLite to Postgres, adding authentication), stop and confirm the decision with the user before proceeding.
- If an external service required for testing is persistently unavailable, document the blocker and move on rather than weakening checks.
- Do not skip or mock failing tests to make the pipeline green; fix the underlying behavior or adjust the test environment deterministically.
