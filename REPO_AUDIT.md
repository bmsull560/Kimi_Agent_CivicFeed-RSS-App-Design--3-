# CivicFeed Repository Health Audit

**Date:** 2026-07-12
**Auditor:** Principal Repository Auditor / Staff Software Architect / Security Reviewer / AI-Agent Governance Engineer
**Branch audited:** `main` (commit `3ea34a9`)
**Repository:** https://github.com/bmsull560/Kimi_Agent_CivicFeed-RSS-App-Design--3-

---

## 1. Executive Summary

**Overall Health Score: 72 / 100 (Grade: C+)**

CivicFeed is a functional, recently-refactored local-first RSS reader with a React SPA frontend and an Express/SQLite backend. The codebase is TypeScript-strict, lint-clean, dependency-audit-clean, and ships with working Docker Compose deployment, backend unit tests, and cross-browser Playwright suites. The most recent work successfully consolidated RSS fetching/parsing into the backend, removed public CORS proxies, and introduced live backend usability tests.

The C+ grade reflects **strong fundamentals undermined by broken CI, missing quality gates, and thin governance**. The highest-leverage next step is to fix the GitHub Actions workflow so that every future PR is actually gated by the checks that already pass locally.

### Top 3 Strengths

1. **Clean type/lint baseline** — `npm run lint`, `npm run type-check`, and `cd backend && npm run type-check` all pass; `npm audit` reports zero vulnerabilities in both workspaces.
2. **Backend test coverage exists and passes** — 71 backend unit tests pass in ~6s, including URL security, migrations, RSS parsing, and API route tests.
3. **Recent architectural consolidation is sound** — RSS fetching, parsing, caching, and health checks now live exclusively in the backend; public CORS proxies and duplicated frontend XML parsing were removed.

### Top 3 Risks

1. **CI is broken** — `.github/workflows/ci.yml` calls `npm run verify:rss-cache`, a script removed in the recent refactor, so every push/PR will fail before it runs any real checks.
2. **Backend is not linted** — `eslint.config.js` explicitly ignores the entire `backend/` directory, so backend code style, unused imports, and unsafe patterns are not enforced in CI.
3. **No API contracts or frontend unit tests** — The REST API is undocumented (no OpenAPI/spec), and the frontend has zero unit/integration tests below the Playwright layer, making refactors risky.

### Most Important Next Step

**Fix and harden CI first** (Sprint 1): remove the stale `verify:rss-cache` reference, add the backend to lint, add a formatting check, and make the existing passing checks actually block merges.

---

## 2. Reconnaissance Summary

### Archetype

**Hybrid full-stack application** — React single-page app frontend + Express REST API backend + SQLite local database, deployed via Docker Compose with nginx.

### Stack

| Layer      | Technology                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Frontend   | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 3, shadcn/ui, React Router (HashRouter), Playwright    |
| Backend    | Express 4, TypeScript 5.9, better-sqlite3, fast-xml-parser, tsx, vitest                               |
| Tooling    | ESLint 9 (flat config), TypeScript project references, npm workspaces via separate package.json files |
| Deployment | Docker Compose (frontend nginx + Node backend + named volume for SQLite)                              |

### Repository Size (source only)

- **Frontend source:** ~84 files, ~7,900 LOC under `src/`
- **Backend source:** ~30 files, ~5,900 LOC under `backend/src/`
- **Tests:** 71 backend unit tests; Playwright E2E suite (~108 test cases across 4 browser projects)

### Entry Points and Public Interfaces

- Frontend entry: `src/main.tsx` → `src/App.tsx`
- Backend entry: `backend/src/server.ts`
- Public API: 17 Express routes under `/api/*` (health, ready, feeds, articles, search, stats, discover, recap, etc.) defined in `backend/src/server.ts:20-389`
- Data store: SQLite (`backend/data/civicfeed.db` default), schema managed by `backend/src/migrations.ts`

### Sampling Strategy

Full inspection of root governance/config files, CI workflow, both package manifests, all backend source files (deep-dive), all frontend hooks/lib/pages (spot-check), and all test files. Generated `node_modules`, `dist`, `.tmp`, and `test-results` were excluded. `src/components/ui/**` (shadcn generated) was noted but not deeply analyzed.

### Assumptions

- Team size: 3 engineers
- Sprint length: 2 weeks
- Remediation capacity: ~60% per engineer (~18 person-days/sprint total)
- Business priority: maintain the local-first, no-auth civic RSS reader; reliability and correctness over scale

### Information Unverified

- Branch protection rules and required status checks in GitHub (no API access to settings)
- Actual CI runtime on GitHub Actions (workflow is currently broken)
- Production deployment history, incident logs, or runtime telemetry

---

## 3. Scorecard

| Area                                      | Weight | Score | Grade | Confidence | Trend Risk | One-Line Diagnosis                                                                                                        |
| ----------------------------------------- | ------ | ----- | ----- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| A. Architecture & Code Structure          | 12%    | 75    | B     | High       | Medium     | Clean SPA/backend split, but monolithic catalog (`feeds.ts`, 670 LOC) and server (`server.ts`, 404 LOC) concentrate risk. |
| B. Code Quality & Maintainability         | 12%    | 78    | B     | High       | Low        | Strict TS, lint passes, but backend is excluded from ESLint, no Prettier, and 40 `any`/`as any` escapes remain.           |
| C. Correctness, Data Integrity, Contracts | 14%    | 72    | B/C   | High       | Medium     | Migrations are formal and transactional; validation exists at trust boundaries; no API contract spec or contract tests.   |
| D. Testing & Verification                 | 14%    | 65    | C     | High       | High       | Backend unit tests solid; zero frontend unit tests; no coverage enforcement; CI is broken.                                |
| E. Security & Supply Chain                | 16%    | 82    | B     | Medium     | Low        | SSRF protection, no leaked secrets, audit clean; no SECURITY.md, rate limiting, auth, or threat model.                    |
| F. CI/CD & Quality Gates                  | 10%    | 55    | D     | High       | High       | Workflow exists but references a removed script; missing formatting, coverage, and backend lint gates.                    |
| G. Reliability, Observability, Operations | 8%     | 76    | B     | Medium     | Medium     | Health/readiness checks, structured logs, retries; scheduler could thunder-herd; no metrics or rate limiting.             |
| H. Documentation, Decisions, Knowledge    | 6%     | 70    | C     | High       | Low        | README is excellent for users/devs; missing CONTRIBUTING, SECURITY, CODEOWNERS, ADRs.                                     |
| I. AI-Agent Readiness, Rules, Skills      | 5%     | 60    | D     | High       | Medium     | `AGENTS.md` exists but only points to a skill; no setup/test commands, no prohibited-actions list, no nested rules.       |
| J. Developer Experience & Velocity        | 3%     | 75    | B     | Medium     | Low        | Docker Compose works, README setup is clear; no Prettier, many outdated deps, no issue/PR templates.                      |

**Weighted Overall: 72 / 100 (C+)**

---

## 4. Findings Register

| ID        | Severity | Confidence | Area | Evidence                                                                                                                                      | Observed Fact                                                                                                                | Inference / Risk                                                                                                                            | Business Impact                                                                          | Recommended Fix                                                                                                                                                        | Effort | Risk of Change | Suggested Owner    | Target Sprint |
| --------- | -------- | ---------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------- | ------------------ | ------------- |
| CICD-001  | Critical | High       | F    | `.github/workflows/ci.yml:51` calls `npm run verify:rss-cache`                                                                                | The script `verify:rss-cache` was removed in commit `dc9b020`; running the workflow fails immediately with `Missing script`. | Every push and PR fails CI before any real validation runs, eroding trust in the pipeline and blocking automated quality enforcement.       | Contributors cannot rely on CI; broken-window effect; merges may proceed without checks. | Remove line 51 from `ci.yml`; optionally replace with `npm run audit:acceptance` or `npm run test:live`.                                                               | S      | Very low       | Platform / CI      | Sprint 1      |
| CICD-002  | High     | High       | F    | `eslint.config.js:9` lists `backend` in `globalIgnores`                                                                                       | The entire backend directory is ignored by ESLint.                                                                           | Backend code style, unused variables, and unsafe TypeScript patterns are not enforced in local dev or CI.                                   | Inconsistent quality, accumulating tech debt, higher review burden.                      | Remove `backend` from `globalIgnores`; add backend-specific rules if needed (e.g., Node globals).                                                                      | S      | Low            | Platform / CI      | Sprint 1      |
| TEST-001  | High     | High       | D    | `find src -name '*.test.*'` returns 0 files; frontend relies solely on Playwright                                                             | No unit or integration tests exist for React components, hooks, or `src/lib/*.ts`.                                           | Frontend regressions are only caught by slow E2E tests; refactorings and bug fixes lack fast feedback.                                      | Slower development, higher regression risk, difficult to reproduce edge cases.           | Add Vitest or Jest + React Testing Library; test hooks (`useFeeds`, `useRssFeed`, `useUserFeeds`) and utilities (`lib/rss.ts`, `lib/opml.ts`).                         | M      | Low            | Frontend           | Sprint 2      |
| DOC-001   | High     | High       | H    | Root governance files search finds only `AGENTS.md` and `README.md`                                                                           | Missing `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, `CHANGELOG.md`, issue/PR templates.                                  | New contributors and security researchers lack guidance; ownership is unclear; incident response is ad-hoc.                                 | Onboarding friction, delayed security disclosures, unclear review authority.             | Create `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, and `.github/ISSUE_TEMPLATE/bug_report.md`.                                 | S      | Very low       | Docs / Governance  | Sprint 1      |
| CICD-003  | Medium   | High       | F    | No `.prettierrc` or `prettier.config.*`; `package.json` has no format script                                                                  | Code formatting is not automated or enforced.                                                                                | Inconsistent formatting increases diff noise and review friction.                                                                           | Wasted review cycles, style debates, harder diffs.                                       | Add Prettier, `npm run format:check`, and run it in CI.                                                                                                                | S      | Very low       | Platform / CI      | Sprint 1      |
| CICD-004  | Medium   | High       | F    | `backend/package.json` and `package.json` have no coverage configuration                                                                      | Test coverage is not measured, reported, or gated.                                                                           | Low-coverage areas can silently regress; there is no objective quality gate.                                                                | Unclear test quality, regressions in untested paths.                                     | Add `coverage` config to Vitest, publish/report coverage in CI, set an initial threshold (e.g., 70%) and ratchet up.                                                   | S      | Low            | Platform / CI      | Sprint 2      |
| COR-001   | Medium   | High       | C    | `backend/src/server.ts` defines 17 routes; no OpenAPI/spec file exists                                                                        | API contract is implicit in code and README prose only.                                                                      | Consumers (including the frontend and any future clients) must infer contracts from implementation; breaking changes are easy to introduce. | Integration bugs, slower onboarding, fragile frontend/backend coupling.                  | Add an OpenAPI 3.x spec (or Zod-based contract) and a basic contract test between frontend types and backend responses.                                                | M      | Low            | Backend + Frontend | Sprint 3      |
| ARCH-001  | Medium   | High       | A    | `backend/src/feeds.ts` = 670 LOC; `backend/src/server.ts` = 404 LOC; `backend/src/validate-feeds.ts` = 425 LOC                                | Several backend modules exceed 300 LOC and mix multiple responsibilities.                                                    | Large files are change hotspots, harder to test, and blur domain boundaries.                                                                | Slower changes, higher defect density, reviewer overload.                                | Split `feeds.ts` into catalog data + loader; split `server.ts` into route modules under `backend/src/routes/`; refactor `validate-feeds.ts` into smaller validators.   | M      | Medium         | Backend            | Sprint 3      |
| AGENT-001 | Medium   | High       | I    | `AGENTS.md` is 7 lines and only references a skill                                                                                            | No setup/test commands, no prohibited actions, no security rules, no nested per-directory guidance.                          | AI agents lack guardrails and must infer conventions from code, increasing the risk of bad edits.                                           | Higher cost of agent-assisted work, more review rework.                                  | Expand `AGENTS.md` with setup, test, lint, prohibited actions, security rules, and per-area conventions; add skill checklists for feed intake, API changes, and tests. | S      | Very low       | AI Governance      | Sprint 1      |
| SEC-001   | Medium   | Medium     | E    | No `SECURITY.md`, threat model, or rate-limiting middleware                                                                                   | Security posture is undocumented and unenforced beyond SSRF URL validation.                                                  | Vulnerability disclosure process is unclear; backend endpoints are unprotected against abuse or accidental overload.                        | Reputational risk, potential abuse, DoS exposure.                                        | Add `SECURITY.md`, basic Express rate limiting, and document threat model for a no-auth local-first app.                                                               | S      | Low            | Security / Backend | Sprint 1      |
| REL-001   | Medium   | Medium     | G    | `backend/src/scheduler.ts:128` starts `setTimeout(tick, 5_000)` then `setInterval(tick, 60_000)`; refreshes up to 50 feeds with concurrency 5 | Background refresh runs unconditionally and fetches real upstream feeds on startup.                                          | On resource-constrained deploys or flaky networks, the scheduler can cause CPU/network spikes and log storms.                               | Degraded performance, noisy logs, unexpected egress costs.                               | Add jitter, configurable batch size/concurrency, and respect `CIVICFEED_DISABLE_SCHEDULER` more visibly; consider exponential backoff for failing feeds.               | S      | Low            | Backend / SRE      | Sprint 4      |
| REL-002   | Medium   | Medium     | G    | No metrics or tracing instrumentation beyond JSON request logs                                                                                | Operational visibility is limited to stdout logs; no request latency percentiles, error rates, or queue depth metrics.       | Incidents are harder to diagnose; capacity planning is guesswork.                                                                           | Longer MTTR, surprise outages.                                                           | Add a lightweight metrics endpoint or structured log fields for feed fetch latency/failure rates; document runbook queries.                                            | M      | Low            | Backend / SRE      | Sprint 4      |
| TEST-002  | Medium   | High       | D    | E2E global setup starts real backend and mock RSS server; live feed validation scripts hit real publishers                                    | Some tests and scripts depend on external network availability.                                                              | Flaky tests due to network/feed changes; CI runtime is non-deterministic.                                                                   | False failures, slower CI, unreliable release signal.                                    | Make E2E setup fully self-contained (it largely is already for `test:live`); isolate live feed validation to a scheduled job, not a merge-blocking gate.               | S      | Low            | QA / CI            | Sprint 2      |
| B-001     | Low      | High       | B    | 40 instances of `any` / `as any` / `ts-ignore` in `src/` and `backend/src/`                                                                   | Type safety is weakened in several places, especially tests and server route handlers.                                       | Reduced compiler protection; refactoring hazards.                                                                                           | Bugs slip through type checking, harder maintenance.                                     | Replace `any` with narrow types or Zod schemas; target zero new `any` additions via lint rule.                                                                         | S      | Low            | Backend + Frontend | Sprint 3      |
| DX-001    | Low      | Medium     | J    | `npm outdated` lists 30+ outdated frontend packages and 5+ backend packages                                                                   | Dependencies are not kept current.                                                                                           | Accumulated upgrade debt, missed bug/security fixes, compatibility drift.                                                                   | Larger future upgrade projects, potential security exposure.                             | Add a monthly dependency-review workflow; batch-upgrade non-breaking updates.                                                                                          | S      | Low            | Platform           | Sprint 5      |

---

## 5. Governance Documentation Gap Matrix

| File                               | Status             | Evidence                                     | Gap                                                                              | Business / Engineering Impact                    | Priority | Target Sprint |
| ---------------------------------- | ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------ | -------- | ------------- |
| `AGENTS.md`                        | PRESENT-INADEQUATE | 7 lines; only references skill               | Missing setup/test commands, prohibited actions, security rules, nested guidance | Agents operate without guardrails                | High     | Sprint 1      |
| `README.md`                        | PRESENT-HEALTHY    | 283 lines; covers setup, stack, security, CI | Could add architecture decision history and contributor onboarding links         | Minor onboarding friction                        | Low      | Sprint 5      |
| `CONTRIBUTING.md`                  | MISSING            | —                                            | No contributor workflow, commit conventions, or PR expectations                  | Onboarding friction, inconsistent PRs            | High     | Sprint 1      |
| `SECURITY.md`                      | MISSING            | —                                            | No vulnerability disclosure policy or security practices                         | Blocks responsible disclosure, audit questions   | High     | Sprint 1      |
| `CODEOWNERS`                       | MISSING            | —                                            | No file/module ownership                                                         | Unclear review authority, bus factor             | High     | Sprint 1      |
| `ARCHITECTURE.md`                  | MISSING            | README has brief overview                    | No detailed component/data-flow/contract docs                                    | Harder for new engineers to reason about changes | Medium   | Sprint 3      |
| `TESTING.md`                       | MISSING            | README lists test commands                   | No testing strategy, mocking guidelines, or coverage expectations                | Inconsistent test quality                        | Medium   | Sprint 2      |
| `RUNBOOK.md`                       | MISSING            | —                                            | No operational playbooks                                                         | Longer incident response                         | Medium   | Sprint 4      |
| `CHANGELOG.md`                     | MISSING            | —                                            | No release history                                                               | Users/operators cannot track changes             | Low      | Sprint 5      |
| `LICENSE`                          | MISSING            | —                                            | Legal status unclear                                                             | Redistribution/compliance risk                   | Medium   | Sprint 1      |
| `DECISIONS.md` / `docs/decisions/` | MISSING            | —                                            | No ADR trail                                                                     | Rationale for major refactor lost                | Medium   | Sprint 5      |
| `.github/PULL_REQUEST_TEMPLATE.md` | MISSING            | —                                            | PR descriptions are inconsistent                                                 | Reviewers lack context                           | Medium   | Sprint 1      |
| `.github/ISSUE_TEMPLATE/*`         | MISSING            | —                                            | Bugs/features not categorized                                                    | Triage friction                                  | Low      | Sprint 1      |

---

## 6. AI-Agent Readiness Review

### Current Instruction Files

- `AGENTS.md` (root): 7 lines, references `civicfeed-feed-intake` skill only.
- `.kimi-code/skills/civicfeed-feed-intake/SKILL.md`: Project skill for feed intake/discovery/validation/modification.

### Conflicts / Gaps

- No setup/build/test/lint commands listed for agents.
- No list of prohibited actions (e.g., do not add public CORS proxies, do not reintroduce frontend XML parsing, do not bypass SSRF rules).
- No security rules beyond what is in README prose.
- No nested per-directory instructions (e.g., backend vs. frontend conventions).
- No skill/checklist for API changes, migrations, or test additions.

### Recommended `AGENTS.md` Structure

1. **Project overview** (archetype, stack, boundaries)
2. **Setup and validation commands** (`npm install`, `npm run lint`, `npm run type-check`, `cd backend && npm test`, `npm run verify`)
3. **Prohibited actions** (no client-side RSS fetching, no public proxies, no bypassing URL security, no inline schema edits without migration)
4. **Security rules** (SSRF guard, input validation, no secrets in source)
5. **Testing expectations** (backend unit tests required; frontend changes need E2E or new unit tests)
6. **Skill directory** with explicit triggers

### Agent-Safe Prohibited Actions

- Do not reintroduce client-side RSS fetching or public CORS proxies.
- Do not add `any` or `@ts-ignore` without explicit justification.
- Do not edit `backend/src/migrations.ts` without adding a new numbered migration.
- Do not commit secrets, `.env`, or `dist/` artifacts.
- Do not modify `backend/src/feeds.ts` without running `npm run verify:feeds`.

---

## 7. Quality Gates and Contracts Plan

### Current Gates vs. Target Gates

| Gate                       | Current                            | Target                                                 | Notes              |
| -------------------------- | ---------------------------------- | ------------------------------------------------------ | ------------------ |
| Lint                       | Frontend only; passes              | Frontend + backend; passes                             | CICD-002           |
| Format                     | None                               | Prettier check blocking                                | CICD-003           |
| Type check                 | Frontend + backend; passes         | Keep as-is                                             | Already good       |
| Unit tests                 | Backend 71 tests; no coverage      | Backend + frontend unit tests; coverage threshold      | TEST-001, CICD-004 |
| Integration tests          | None                               | API contract tests                                     | COR-001            |
| E2E tests                  | Playwright (84 passed, 24 skipped) | Keep; make fully self-contained                        | TEST-002           |
| Accessibility              | Playwright + axe scans             | Keep; gate on zero violations                          | —                  |
| Build                      | Vite frontend + tsc backend        | Keep; verify dist artifacts                            | —                  |
| Security audit             | `npm audit` in CI                  | Keep; add secret scan and dependency review            | SEC-001            |
| Contract / breaking-change | None                               | OpenAPI spec + generated types                         | COR-001            |
| Migration validation       | None                               | CI runs migrations on ephemeral DB and verifies schema | COR-001            |

### API / Data Contracts

- **Present:** implicit REST contract in `backend/src/server.ts`, README prose.
- **Missing:** OpenAPI spec, generated frontend types, schema validation middleware.
- **Recommended:** Introduce Zod or an OpenAPI spec in Sprint 3; generate TypeScript types shared between frontend and backend.

---

## 8. Quick Wins

| ID   | Finding   | Action                                                                    | Verification                                      | Value                         | Effort | Risk |
| ---- | --------- | ------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------- | ------ | ---- |
| QW-1 | CICD-001  | Remove `npm run verify:rss-cache` from `.github/workflows/ci.yml`         | Run workflow or `npm run` shows no missing script | Unblocks CI                   | <1h    | None |
| QW-2 | CICD-002  | Remove `backend` from `eslint.config.js` ignores; fix any new lint errors | `npm run lint` passes with backend included       | Improves backend code quality | <1h    | Low  |
| QW-3 | CICD-003  | Add Prettier + `format:check` script and CI step                          | `npm run format:check` passes                     | Reduces diff noise            | <1h    | None |
| QW-4 | DOC-001   | Create `CODEOWNERS` assigning backend/frontend/docs to owners             | File exists and GitHub recognizes it              | Clarifies review authority    | <1h    | None |
| QW-5 | AGENT-001 | Expand `AGENTS.md` with setup/test commands and prohibited actions        | File updated                                      | Safer agent work              | <1h    | None |
| QW-6 | SEC-001   | Add `SECURITY.md` with disclosure instructions                            | File exists                                       | Responsible disclosure path   | <1h    | None |

---

## 9. Verification Appendix

### Commands Run

| Command                                        | Result                          | Runtime | Notes                        |
| ---------------------------------------------- | ------------------------------- | ------- | ---------------------------- |
| `git status --short --branch`                  | Clean `main`, up to date        | —       | —                            |
| `npm run lint`                                 | Pass                            | ~3s     | —                            |
| `npm run type-check`                           | Pass                            | ~5s     | —                            |
| `npm run build`                                | Pass                            | ~14s    | —                            |
| `npm run verify:feeds`                         | Pass (594 feeds, 18 categories) | ~2s     | —                            |
| `npm run audit:acceptance`                     | Pass                            | ~1s     | —                            |
| `npm run verify:routes`                        | Pass (4 routes)                 | ~4s     | —                            |
| `npm run verify:dist`                          | Pass                            | ~1s     | —                            |
| `npm run test:live`                            | Pass (4/4)                      | ~44s    | Requires Playwright browsers |
| `npm run verify:browser`                       | Pass (84 passed, 24 skipped)    | ~5m     | Requires Playwright browsers |
| `cd backend && npm run type-check && npm test` | Pass (71/71)                    | ~6s     | —                            |
| `npm audit --audit-level=low`                  | 0 vulnerabilities               | ~3s     | —                            |
| `cd backend && npm audit --audit-level=low`    | 0 vulnerabilities               | ~2s     | —                            |
| `npm run verify:rss-cache`                     | **FAIL** — missing script       | —       | Confirms CICD-001            |

### Files Deep-Inspected

- `AGENTS.md`, `README.md`, `package.json`, `backend/package.json`
- `.github/workflows/ci.yml`, `eslint.config.js`, `tsconfig*.json`
- `docker-compose.yml`, `Dockerfile`, `backend/Dockerfile`, `nginx.conf`
- `backend/src/server.ts`, `backend/src/rss.ts`, `backend/src/rss-parser.ts`, `backend/src/migrations.ts`, `backend/src/scheduler.ts`, `backend/src/search.ts`, `backend/src/url-security.ts`, `backend/src/feed-health.ts`, `backend/src/enrichment-queue.ts`
- `src/hooks/useFeeds.ts`, `src/hooks/useRssFeed.ts`, `src/lib/rss.ts`
- `tests/e2e/civicfeed-live.spec.ts`, `tests/e2e/global-setup.ts`, `playwright.live.config.ts`

### Confidence Levels

- **High:** Lint/type-check/test/build results, file presence/absence, CI config, dependency audit.
- **Medium:** Security posture beyond code inspection (no dynamic testing), runtime reliability under load.
- **Low:** GitHub branch protection settings, production incident history, actual CI behavior on GitHub-hosted runners.

### Did Any Command Modify Local Files?

No. All commands were read-only except the production build, which wrote to `dist/` (an ignored directory).
