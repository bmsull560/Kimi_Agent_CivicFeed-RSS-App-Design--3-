---
name: civicfeed-architecture-evolution
description: Architect, plan, implement, or review cross-cutting CivicFeed features while preserving its React/Express/SQLite boundaries, backend-owned RSS pipeline, asynchronous enrichment, security controls, persistence model, and verification gates. Use for new routes, data flows, schema changes, major frontend-backend features, architectural refactors, proactive roadmap work, or design decisions spanning multiple CivicFeed modules. Do not use for feed catalog intake alone.
---

# CivicFeed Architecture Evolution

Evolve CivicFeed through evidence-backed vertical slices without weakening established system boundaries.

## Workflow

1. Read the root `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, and relevant decision records.
2. Trace the current behavior end to end before proposing a design. Locate route, hook, API handler, persistence, background job, tests, and operational signals.
3. State the user outcome, invariants, trust boundaries, failure modes, rollout needs, and proof required for completion.
4. Select the smallest coherent vertical slice that reaches the requested end state. Do not substitute a narrower behavior merely because it is easier to test.
5. Update contracts before consumers when request or response shapes change. Validate external input with existing Zod patterns.
6. Keep slow or optional work out of request latency. Route enrichment and batch work through durable background processing.
7. Add focused tests at the lowest useful layer plus Playwright coverage for critical journeys.
8. Run every command required by `AGENTS.md`. Treat passing checks as evidence only after confirming they cover the change.
9. Record a decision only when behavior, boundaries, data ownership, or rollback strategy materially changes.

## Non-Negotiable Boundaries

- Keep `backend/src/feeds.ts` as the catalog source of truth.
- Keep RSS fetching, XML parsing, retries, caching, and feed health in the backend.
- Never add public CORS proxies or browser-side feed parsing.
- Keep AI enrichment asynchronous through `backend/src/enrichment-queue.ts`.
- Prefer HTTP caching for feed data; reserve browser persistence for user state.
- Preserve SSRF validation, timeouts, bounded retries, redirect limits, and response-size limits.
- Add numbered transactional migrations for schema changes. Include a rollback or compatibility plan before altering existing data.
- Use strict TypeScript and preserve original error causes.

## Design Review Questions

Use [references/architecture-checklist.md](references/architecture-checklist.md) for cross-cutting work. Answer at minimum:

- Who owns the data and which copy is authoritative?
- What happens when the backend, upstream feed, AI provider, or browser storage fails?
- Which operation is synchronous, queued, cached, retried, or idempotent?
- How is stale, partial, pending, or unavailable state communicated?
- What prevents unbounded cost, concurrency, storage, payloads, or retries?
- Which evidence proves accessibility, responsiveness, correctness, and operability?

## Scope Control

Reuse existing modules and component patterns. Avoid provider additions, broad rewrites, speculative abstractions, or database migrations unless required by the user outcome. Stop for approval at boundaries named in `AGENTS.md`.
