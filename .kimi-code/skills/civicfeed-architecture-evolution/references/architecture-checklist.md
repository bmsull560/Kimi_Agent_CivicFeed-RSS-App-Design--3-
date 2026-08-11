# Architecture Checklist

## Context

- Read `AGENTS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, and relevant files under `docs/superpowers/`.
- Map frontend route → hook/client → API route → service → database/queue → response state.
- Identify existing user changes in the worktree and preserve unrelated edits.

## Design

- Define user-visible success and degraded behavior.
- Identify authoritative data, cache ownership, and invalidation.
- Separate request-path work from queued or scheduled work.
- Define idempotency and duplicate handling.
- Bound network time, retries, concurrency, batch size, payload size, and storage growth.
- Validate every external identifier, URL, query, body, and model output.
- Preserve compatibility or document migration and rollback.
- Cover loading, empty, stale, offline, partial, and error states.
- Check keyboard use, focus, semantics, contrast, reduced motion, and mobile overflow.

## Proof

- Add backend unit tests for services, routes, queues, and migrations.
- Add frontend or Playwright tests for critical user outcomes and recovery.
- Verify structured logs and health/status surfaces for background behavior.
- Run all root and backend commands required by `AGENTS.md`.
- Inspect the final diff and map each requirement to direct evidence.
