# CivicFeed Remediation Roadmap

**Derived from:** `REPO_AUDIT.md` (2026-07-12)
**Planning assumptions:**

- 3 engineers at ~60% remediation capacity
- 2-week sprints
- ~18 remediation person-days per sprint
- Total roadmap effort: ~60-65 person-days → **N = 4 sprints**
- Capacity sensitivity: N = 5 sprints at 2 engineers; N = 6 sprints at 1 engineer

---

## Roadmap Summary Table

| Sprint | Theme                        | Key Deliverables                                                                    | Gates Added                                            | Docs Landed                                                                 | Major Findings Addressed                                  | Projected Score Impact |
| ------ | ---------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------- |
| 1      | Safety & Governance          | Fix CI, lint backend, add Prettier, governance files, agent rules                   | Backend lint, format check, audit, required CI         | `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, PR template, `AGENTS.md` v1 | CICD-001, CICD-002, CICD-003, DOC-001, AGENT-001, SEC-001 | +8 to +10 points       |
| 2      | Testing & Contracts          | Frontend unit tests, coverage thresholds, OpenAPI spec, contract tests              | Coverage threshold, unit-test gate, contract-test gate | `TESTING.md`, OpenAPI spec                                                  | TEST-001, CICD-004, COR-001, TEST-002                     | +10 to +12 points      |
| 3      | Architecture & Quality       | Refactor large backend files, reduce `any`, strict module boundaries, rate limiting | Lint rule banning new `any`, migration validation gate | `ARCHITECTURE.md`, ADRs for major refactor                                  | ARCH-001, B-001, COR-001                                  | +6 to +8 points        |
| 4      | Reliability, Operations & DX | Rate limiting, metrics, scheduler tuning, dependency refresh, runbook               | SLO/health dashboard, dependency-review gate           | `RUNBOOK.md`, `CHANGELOG.md`, remaining ADRs                                | REL-001, REL-002, DX-001                                  | +5 to +7 points        |

**Projected post-roadmap score: 72 → 87-89 (B+)**

_Note: Projections are conservative and conditional on verified implementation, not just file creation._

---

## Sprint 1 — Safety, CI, and Governance

### Business Rationale

A broken CI pipeline is the highest-leverage risk: it blocks automated quality enforcement and trains the team to ignore red checks. Fixing it first ensures every subsequent improvement is actually gated.

### Objectives (mapped to findings)

- CICD-001: Remove stale `verify:rss-cache` reference from CI.
- CICD-002: Include backend in ESLint and make it pass.
- CICD-003: Add Prettier formatting check.
- DOC-001: Add core governance files.
- AGENT-001: Publish `AGENTS.md` v1 with setup/test/prohibited-action rules.
- SEC-001: Add `SECURITY.md` and basic rate-limiting plan.

### Implementation Deliverables

1. **CI fix:** Update `.github/workflows/ci.yml` to remove `verify:rss-cache`; add `npm run format:check`; add backend lint step; ensure `npm run lint` covers `backend/`.
2. **Lint/Format:** Add Prettier config and `format:check`/`format:write` scripts; fix all formatting violations.
3. **Governance docs:** Create `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, and `.github/ISSUE_TEMPLATE/bug_report.md`.
4. **Agent rules:** Expand `AGENTS.md` with setup commands, validation commands, prohibited actions, and per-area conventions.
5. **License:** Add `LICENSE` file (e.g., MIT or Apache-2.0 as appropriate).

### Tests Added or Improved

- Existing CI steps now actually execute and block merges.
- No new product tests in this sprint.

### Quality Gates Added

| Gate             | Command / Config                  | Blocking?      | Owner |
| ---------------- | --------------------------------- | -------------- | ----- |
| Backend lint     | `npm run lint` (includes backend) | Yes            | CI    |
| Format check     | `npm run format:check`            | Yes            | CI    |
| Dependency audit | `npm audit --audit-level=low`     | Yes (existing) | CI    |
| Type check       | `npm run type-check` + backend    | Yes (existing) | CI    |

### Definition of Done

- [ ] `npm run verify:rss-cache` no longer appears in CI.
- [ ] `npm run lint` passes with backend included.
- [ ] `npm run format:check` passes.
- [ ] All new governance files are merged.
- [ ] A test PR demonstrates CI blocking on lint/format failure.

### Verification Evidence

- CI run on a test PR shows all jobs green.
- `npm run lint`, `npm run type-check`, `npm run format:check`, `npm run build`, `npm run verify:*` pass locally.

### Risks and Dependencies

- Risk: Backend lint fixes could require non-trivial code changes. Mitigation: fix in small batches and run backend tests after each batch.
- Dependency: Repository owner must approve `CODEOWNERS` assignments.

### Suggested Ownership Split

- Platform/CI engineer: CI, lint, Prettier
- Tech lead: governance docs, CODEOWNERS, LICENSE
- Senior engineer: AGENTS.md expansion, prohibited-action rules

---

## Sprint 2 — Frontend Testing and API Contracts

### Business Rationale

The frontend currently has no unit-test safety net; all regressions are caught by slow E2E tests. Adding fast, deterministic unit tests and formal API contracts reduces the cost of future UI and backend changes.

### Objectives (mapped to findings)

- TEST-001: Introduce frontend unit/integration tests.
- CICD-004: Add coverage measurement and threshold.
- COR-001: Define and enforce API contract.
- TEST-002: Isolate E2E from external network where possible.

### Implementation Deliverables

1. **Frontend test harness:** Add Vitest + React Testing Library + MSW (Mock Service Worker) to the root workspace.
2. **Unit tests:** Cover high-risk hooks and utilities first:
   - `src/hooks/useFeeds.ts`
   - `src/hooks/useRssFeed.ts`
   - `src/lib/rss.ts`
   - `src/lib/opml.ts`
   - `src/lib/userData.ts`
3. **Coverage:** Configure Vitest coverage with an initial threshold (e.g., 60% lines, ratchet up 5% per sprint).
4. **API contract:** Add an OpenAPI 3.1 spec under `docs/api/openapi.yml`; generate TypeScript types shared between frontend and backend (or use Zod schemas in both).
5. **Contract tests:** Add tests that verify backend responses against the spec for all `/api/feeds/:id/*`, `/api/search`, and `/api/discover` routes.
6. **E2E reliability:** Move live feed validation scripts out of the merge-blocking path; keep `test:live` as an optional/nightly job.

### Tests Added or Improved

- ~30-50 new frontend unit tests.
- Coverage report in CI.
- Contract tests for all public API routes.

### Quality Gates Added

| Gate                | Command / Config             | Blocking? | Owner |
| ------------------- | ---------------------------- | --------- | ----- |
| Frontend unit tests | `npm run test:unit`          | Yes       | CI    |
| Coverage threshold  | Vitest `coverage.thresholds` | Yes       | CI    |
| Contract tests      | `npm run test:contract`      | Yes       | CI    |

### Definition of Done

- [ ] `npm run test:unit` passes with >60% coverage.
- [ ] OpenAPI spec is valid and matches backend behavior.
- [ ] Contract tests pass against spec.
- [ ] E2E tests do not depend on live external feeds in merge-blocking CI.

### Verification Evidence

- `npm run test:unit -- --run`
- `npm run test:contract`
- Coverage report artifact in CI

### Risks and Dependencies

- Risk: Mocking backend in frontend tests can hide real contract drift. Mitigation: combine with contract tests and keep live E2E as secondary signal.
- Dependency: OpenAPI tooling choice (e.g., `openapi-typescript`, `zod-openapi`) should align with team preference.

### Suggested Ownership Split

- Frontend engineer: test harness, hook/lib tests
- Backend engineer: OpenAPI spec, contract tests
- QA engineer: E2E reliability improvements

---

## Sprint 3 — Architecture, Module Boundaries, and Type Safety

### Business Rationale

Large modules and type escapes are the primary maintainability drag. Splitting them and enforcing stricter types makes future features safer and reviews faster.

### Objectives (mapped to findings)

- ARCH-001: Refactor oversized backend modules.
- B-001: Eliminate or justify all `any` / `as any` / `ts-ignore`.
- COR-001: Enforce API contract at runtime (validation middleware).

### Implementation Deliverables

1. **Route modularization:** Move routes from `backend/src/server.ts` into `backend/src/routes/` (e.g., `feeds.ts`, `articles.ts`, `search.ts`, `discover.ts`).
2. **Catalog split:** Separate `backend/src/feeds.ts` data from catalog-loading/validation logic.
3. **Validation middleware:** Use the OpenAPI/Zod contract to validate request params/query/body at trust boundaries.
4. **Type strictness:** Add ESLint rule `@typescript-eslint/no-explicit-any` (warn → error over two sprints); replace existing `any` with narrow types or generated schemas.
5. **Frontend boundaries:** Document and enforce that `src/lib/rss.ts` is the only frontend module that talks to RSS-related API endpoints.
6. **Migration validation:** Add a CI job that applies migrations to an ephemeral SQLite DB and asserts the resulting schema.

### Tests Added or Improved

- Unit tests for new route modules.
- Schema/validation tests for request/response contracts.
- Migration validation test.

### Quality Gates Added

| Gate                 | Command / Config                            | Blocking?                       | Owner |
| -------------------- | ------------------------------------------- | ------------------------------- | ----- |
| No new `any`         | ESLint `@typescript-eslint/no-explicit-any` | Warning this sprint, error next | CI    |
| Migration validation | CI job: seed ephemeral DB, assert schema    | Yes                             | CI    |
| Contract validation  | Request/response middleware tests           | Yes                             | CI    |

### Definition of Done

- [ ] `backend/src/server.ts` is under 200 LOC.
- [ ] `backend/src/feeds.ts` data is separated from loader logic.
- [ ] All route handlers validate inputs against the contract.
- [ ] `any` count reduced by at least 50%.

### Verification Evidence

- `npm run lint` with new rule passes.
- `npm run test` (backend) passes after refactor.
- Migration CI job output.

### Risks and Dependencies

- Risk: Refactoring routes can subtly change API behavior. Mitigation: keep existing server tests green; add contract tests first.
- Dependency: OpenAPI/Zod contract from Sprint 2 must be stable.

### Suggested Ownership Split

- Backend architect: route modularization, catalog split
- Type-safety champion: `any` remediation, validation middleware
- DevOps engineer: migration validation CI job

---

## Sprint 4 — Reliability, Operations, and Developer Experience

### Business Rationale

Once the codebase is tested and modular, the focus shifts to production behavior: preventing abuse, observing failures, and keeping dependencies healthy.

### Objectives (mapped to findings)

- REL-001: Make background scheduler well-behaved under load.
- REL-002: Add operational metrics and runbooks.
- SEC-001: Implement rate limiting.
- DX-001: Refresh dependencies and improve onboarding.

### Implementation Deliverables

1. **Rate limiting:** Add `express-rate-limit` to public routes (especially `/api/discover`, `/api/feeds/:id/articles`, `/api/search`).
2. **Scheduler hardening:** Add jitter, exponential backoff for failing feeds, and respect batch/concurrency limits more defensively.
3. **Metrics:** Expose a `/api/metrics` endpoint (Prometheus text format) or structured log fields for feed fetch latency, failure rate, queue depth, and API response times.
4. **Runbook:** Create `RUNBOOK.md` with common failure scenarios (feed unreachable, DB locked, scheduler stuck, high memory).
5. **Dependency refresh:** Batch-upgrade non-breaking updates; document any held-back packages.
6. **Remaining docs:** `CHANGELOG.md`, ADRs for major architecture decisions (backend-centric refactor, migration system, contract strategy).
7. **Issue templates:** Add feature-request template.

### Tests Added or Improved

- Failure-injection tests for rate limiting.
- Scheduler behavior tests under mocked clock.
- Metrics endpoint tests.

### Quality Gates Added

| Gate                 | Command / Config                | Blocking?          | Owner |
| -------------------- | ------------------------------- | ------------------ | ----- |
| Dependency review    | GitHub Dependency Review action | Yes                | CI    |
| Rate-limit tests     | `npm run test` (backend)        | Yes                | CI    |
| Metrics availability | Health/endpoint test            | No (observability) | CI    |

### Definition of Done

- [ ] Rate limiting is active and tested.
- [ ] `/api/metrics` returns valid Prometheus metrics.
- [ ] `RUNBOOK.md` covers top 5 incident scenarios.
- [ ] `CHANGELOG.md` and ADRs are merged.
- [ ] `npm audit` remains clean after dependency refresh.

### Verification Evidence

- `npm run test` passes.
- Manual `curl` to `/api/metrics` returns expected metrics.
- Load test or simulated failure shows scheduler recovers.

### Risks and Dependencies

- Risk: Rate limiting can break legitimate batch use. Mitigation: configure generous limits and document bypass for local dev.
- Dependency: Operations team must agree on metrics backend (Prometheus, Datadog, etc.).

### Suggested Ownership Split

- Backend/SRE engineer: rate limiting, scheduler, metrics
- Tech writer: runbook, changelog, ADRs
- Platform engineer: dependency refresh, dependency-review gate

---

## Projected Post-Roadmap Scorecard

| Area                                   | Current Score | Projected Score | Main Driver of Improvement                                     | Conditions Required                               |
| -------------------------------------- | ------------- | --------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Architecture & Code Structure          | 75            | 85              | Route modularization, catalog split                            | OpenAPI contract stable; refactor preserves tests |
| Code Quality & Maintainability         | 78            | 88              | Prettier, backend lint, reduced `any`                          | New lint rules adopted without disabling          |
| Correctness, Data Integrity, Contracts | 72            | 88              | OpenAPI spec, validation middleware, migration CI              | Contract kept in sync with code                   |
| Testing & Verification                 | 65            | 85              | Frontend unit tests, coverage gates, contract tests            | Team maintains tests as code changes              |
| Security & Supply Chain                | 82            | 90              | SECURITY.md, rate limiting, dependency review                  | Rate limits tuned for production load             |
| CI/CD & Quality Gates                  | 55            | 90              | Fixed workflow, backend lint, format, coverage, contract gates | Branch protection requires green CI               |
| Reliability, Observability, Operations | 76            | 88              | Metrics, scheduler tuning, runbook                             | Metrics consumed by an observability tool         |
| Documentation, Decisions, Knowledge    | 70            | 88              | CONTRIBUTING, SECURITY, RUNBOOK, ADRs                          | Docs kept current with code                       |
| AI-Agent Readiness, Rules, Skills      | 60            | 85              | Expanded AGENTS.md, skills for common tasks                    | Agents actually follow the rules                  |
| Developer Experience & Velocity        | 75            | 88              | Prettier, dependency refresh, templates                        | Team uses new tooling consistently                |

**Projected overall: 72 → 87-89 (B+)**

---

## Hygiene and Re-Audit Cadence

- **Monthly:** dependency audit review, `npm outdated` triage.
- **Per-sprint:** review new `any` additions, coverage trend, and CI flake rate.
- **Quarterly:** re-run repository health audit against this rubric; update `ROADMAP.md` and `STATUS.md`.
- **Post-incident:** update `RUNBOOK.md` and ADRs with lessons learned.
