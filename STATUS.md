# Status

Current implementation state, known blockers, completed work, and next actions for CivicFeed.

**Last updated**: 2026-07-18
**Audit baseline**: `REPO_AUDIT.md` (2026-07-12) — Score: 72/100 (C+)

## Overall Health

| Area                                    | Score | Status                                                  |
| --------------------------------------- | ----- | ------------------------------------------------------- |
| Architecture & Code Structure           | 75    | Good — sound consolidation, but large modules remain    |
| Code Quality & Maintainability          | 78    | Good — lint-clean, strict TS, Prettier added            |
| Correctness, Data Integrity & Contracts | 72    | Fair — no API contract or validation middleware         |
| Testing & Verification                  | 65    | Fair — backend tests strong, frontend has no unit tests |
| Security & Supply Chain                 | 82    | Good — SSRF guard, zero vulns, but no rate limiting     |
| CI/CD & Quality Gates                   | 55    | Weak — CI was broken, now fixed but gates incomplete    |
| Reliability, Observability & Operations | 76    | Fair — circuit breaker + scheduler, but no metrics      |
| Documentation, Decisions & Knowledge    | 70    | Fair — governance docs added, ADRs missing              |
| AI-Agent Readiness, Rules & Skills      | 60    | Fair — AGENTS.md exists, skills partial                 |
| Developer Experience & Velocity         | 75    | Good — Prettier, clear commands, but no frontend tests  |

## Completed Work

### Sprint 1 — Safety, CI, and Governance (mostly complete)

- [x] CI pipeline fixed — removed stale `verify:rss-cache` reference
- [x] Backend included in ESLint and passing
- [x] Prettier formatting check added (`format:check`)
- [x] `AGENTS.md` published with workflow, scope, commands, conventions, prohibited actions
- [x] `CONTRIBUTING.md` created with setup, workflow, quality expectations
- [x] `SECURITY.md` created with vulnerability reporting and security practices
- [x] `CODEOWNERS` created with ownership routing
- [x] Dependency audit clean in both workspaces (zero vulnerabilities)
- [ ] `LICENSE` file — pending (this PR)

### Architectural Consolidation (pre-audit)

- [x] RSS fetching, parsing, caching consolidated into backend
- [x] Public CORS proxies removed (allorigins, corsproxy, codetabs)
- [x] Frontend XML parsing removed — frontend consumes API only
- [x] Feed catalog is single source of truth in `backend/src/feeds.ts` (590+ feeds)
- [x] SQLite FTS5 full-text search with trigger-based sync
- [x] AI enrichment queue (async, background processing)
- [x] Feed health validation (7 checks: reachability, XML, schema, GUIDs, dates, content, freshness)
- [x] Circuit breaker + retry with backoff/jitter on RSS fetches
- [x] SSRF guard on all outbound HTTP (private IPs, blocked ports, redirect validation)
- [x] Docker Compose deployment (nginx frontend + Node backend + SQLite volume)
- [x] Structured JSON logging with configurable levels
- [x] Graceful shutdown (SIGTERM/SIGINT)
- [x] 71 backend unit tests (Vitest)
- [x] ~108 Playwright E2E test cases across 4 browser projects
- [x] Automated accessibility scans (axe-core)
- [x] Feed discovery via website `<link>` tag parsing
- [x] Weekly recap generation (category grouping, top tags)

## In Progress

- [ ] Repository documentation expansion (ARCHITECTURE, TESTING, STATUS, RUNBOOK, CHANGELOG, API, DATA_MODEL, DEVELOPMENT, DEPLOYMENT, LICENSE)

## Known Blockers

| Blocker                                 | Impact                                 | Roadmap Sprint |
| --------------------------------------- | -------------------------------------- | -------------- |
| No frontend unit tests                  | UI regressions caught only by slow E2E | Sprint 2       |
| No API contract / OpenAPI spec          | Refactoring risk, undocumented API     | Sprint 2       |
| No rate limiting                        | Public endpoints vulnerable to abuse   | Sprint 4       |
| `backend/src/feeds.ts` is 370 KB        | Maintainability drag, slow to review   | Sprint 3       |
| `backend/src/server.ts` not modularized | All routes in one 487-line file        | Sprint 3       |
| No coverage thresholds                  | No enforcement of test coverage        | Sprint 2       |
| No `/api/metrics` endpoint              | No operational observability           | Sprint 4       |
| No formal versioned releases            | `package.json` version is `0.0.0`      | Sprint 4       |

## Next Actions

### Sprint 2 — Frontend Testing and API Contracts

1. Add Vitest + React Testing Library + MSW to root workspace
2. Write unit tests for high-risk hooks and utilities (`useFeeds`, `useRssFeed`, `rss.ts`, `opml.ts`, `userData.ts`)
3. Configure coverage with initial 60% threshold
4. Create OpenAPI 3.1 spec under `docs/api/openapi.yml`
5. Add contract tests verifying backend responses against spec
6. Move live feed validation out of merge-blocking CI path

### Sprint 3 — Architecture, Module Boundaries, and Type Safety

1. Move routes from `server.ts` into `backend/src/routes/` modules
2. Separate `feeds.ts` data from catalog-loading logic
3. Add validation middleware using OpenAPI/Zod contract
4. Add ESLint rule `@typescript-eslint/no-explicit-any` (warn → error)
5. Add migration validation CI job

### Sprint 4 — Reliability, Operations, and Developer Experience

1. Add `express-rate-limit` to public routes
2. Harden scheduler with jitter and exponential backoff for failing feeds
3. Expose `/api/metrics` endpoint (Prometheus format)
4. Create `RUNBOOK.md` with incident scenarios
5. Batch-upgrade non-breaking dependency updates
6. Add ADRs for major architecture decisions

## Dependency Status

| Workspace       | Vulnerabilities  | Notes                               |
| --------------- | ---------------- | ----------------------------------- |
| Frontend (root) | 0 at `low` level | `npm audit --audit-level=low` clean |
| Backend         | 0 at `low` level | `npm audit --audit-level=low` clean |

## Re-Audit Cadence

- **Monthly**: dependency audit review, `npm outdated` triage
- **Per-sprint**: review new `any` additions, coverage trend, CI flake rate
- **Quarterly**: re-run repository health audit; update `ROADMAP.md` and this file
- **Post-incident**: update `RUNBOOK.md` and ADRs with lessons learned
