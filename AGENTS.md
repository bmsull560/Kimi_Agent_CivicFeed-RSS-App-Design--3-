# Agent Instructions — CivicFeed RSS App

## Project overview

CivicFeed is a React + TypeScript frontend backed by a Node.js/Express + SQLite service. The backend owns the feed catalog, RSS fetching/parsing/caching, search, scheduling, and AI enrichment. The frontend consumes the backend via `/api/*` and does **not** perform client-side RSS fetches or use public CORS proxies.

Repository archetype: **monorepo-like full-stack application** with a root frontend workspace and a `backend/` service workspace.

## Product and change governance

- Read `PRODUCT_VISION.md` before changing product behavior or scope.
- Resolve all applicable gates in `docs/governance/CHANGE_GATES.md` before implementation.
- Use `docs/governance/DECISION_TEMPLATE.md` at the policy's decision threshold.
- Do not proceed under a deviation unless `docs/governance/EXCEPTIONS.yaml` contains an approved, unexpired entry covering it exactly.

## Required commands

Run these before declaring any change complete:

```bash
# Root (frontend) workspace
npm run lint
npm run format:check
npm run type-check
npm run build

# Backend workspace
cd backend
npm run lint
npm run type-check
npm test
```

For a full local verification run (slow because of Playwright):

```bash
npm run lint && npm run format:check && npm run type-check && npm run build && cd backend && npm run lint && npm run type-check && npm test
```

## Scope and boundaries

### In scope for routine changes

- Frontend React components, hooks, pages, and types under `src/`
- Backend modules under `backend/src/`
- Validation/operational scripts under `scripts/`
- CI/CD configuration under `.github/workflows/`
- Tests under `tests/` and `backend/tests/`
- Documentation and governance files at the root

### Out of scope / require explicit approval

- Production deployments, secrets, or infrastructure
- Database migrations that alter existing tables without a rollback plan
- Destructive Git operations (force-push, history rewrite, branch deletion)
- Changes to `backend/src/feeds.ts` that remove or rename feeds without validating replacements
- Adding new external AI providers or proxy services
- Modifying `SECURITY.md`, `CODEOWNERS`, or this `AGENTS.md` without stating why

## Architectural constraints

1. **Single source of truth for feeds**: the backend catalog (`backend/src/feeds.ts`) is the source of truth. The frontend fetches `/api/feeds`; do not reintroduce a static frontend catalog.
2. **Backend owns RSS**: all RSS fetching, XML parsing, and caching happen in `backend/src/rss.ts`, `backend/src/rss-parser.ts`, and `backend/src/cache.ts`. The frontend must only call `/api/feeds/:id/articles`.
3. **No public CORS proxies**: do not add or re-enable fallbacks to `allorigins.win`, `corsproxy.io`, `codetabs.com`, or similar services.
4. **Async enrichment**: AI summarization runs in `backend/src/enrichment-queue.ts`, not synchronously in the article request path.
5. **No double caching**: prefer HTTP cache headers over custom localStorage caching for feed data.

## Coding conventions

- Strict TypeScript everywhere; avoid `any`. Use `unknown` + narrowing when types are opaque.
- Use conventional commit messages (`feat:`, `fix:`, `ci:`, `docs:`, `refactor:`, `test:`).
- Format all files with Prettier (`npm run format`).
- Keep changes minimal and reviewable; do not mix unrelated refactors into a feature PR.
- Prefer explicit error handling with structured logging (`backend/src/logger.ts`) over silent catches.
- Express route handlers must validate inputs at trust boundaries; reuse existing Zod schemas where present.

## Testing expectations

- Add or update unit tests for new backend behavior in `backend/src/*.test.ts`.
- Add or update Playwright specs for new critical user journeys in `tests/e2e/`.
- Do not weaken tests or skip assertions to make a failing suite pass.
- Mock external RSS/AI services in unit tests; use the mock RSS server (`tests/e2e/mock-rss-server.mjs`) for E2E setup.

## Security and reliability

- Never commit secrets, API keys, or credentials.
- Do not weaken authentication, authorization, validation, logging, or rate limiting simply to reduce effort.
- External HTTP calls must use timeouts, bounded retries with jitter, and circuit-breaking where applicable.
- Re-thrown errors should preserve the original cause (`throw new Error(..., { cause: err })`).

## Review standards

- All changes must pass the required commands listed above.
- CI must be green before merging.
- Use squash merge for focused PRs unless repository policy says otherwise.
- Delete feature branches after merging.

## Skills and rules

- For feed intake, discovery, validation, or modification tasks, invoke the project skill:
  - **civicfeed-feed-intake** — `.kimi-code/skills/civicfeed-feed-intake/SKILL.md`
- For cross-cutting features, architecture changes, schema work, or proactive roadmap evolution, invoke:
  - **civicfeed-architecture-evolution** — `.kimi-code/skills/civicfeed-architecture-evolution/SKILL.md`
- For summaries, tags, ranking, clustering, recaps, retrieval, or other AI enrichment work, invoke:
  - **civicfeed-ai-enrichment** — `.kimi-code/skills/civicfeed-ai-enrichment/SKILL.md`
- For systemic fetch, parser, cache, scheduler, feed-health, or ingestion diagnostics, invoke:
  - **civicfeed-ingestion-reliability** — `.kimi-code/skills/civicfeed-ingestion-reliability/SKILL.md`
- For multi-step implementation planning, use the Superpowers planning skill.
- For bug fixes, use the Superpowers systematic-debugging skill first.

## Escalation

Stop and ask the user before proceeding if:

- A change would expose, rotate, or revoke credentials.
- A required check cannot be made green without violating a scope boundary.
- The change is destructive or irreversible (e.g., dropping tables, force-pushing).
- Repository instructions conflict and cannot be reconciled.
