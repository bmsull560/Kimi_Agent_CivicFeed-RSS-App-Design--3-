# CivicFeed Change Governance

This document is the canonical policy for deciding whether and how CivicFeed changes proceed. Apply every gate before implementation. Record material decisions with `DECISION_TEMPLATE.md`; record temporary deviations in `EXCEPTIONS.yaml`.

## Authority and Precedence

| Concern                                     | Canonical artifact                       | Derived or supporting representations                  |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Product purpose, outcomes, scope, non-goals | `PRODUCT_VISION.md`                      | README overview, roadmap themes, UI copy               |
| Agent execution and prohibited actions      | `AGENTS.md`                              | Skills and plans                                       |
| Change governance and exceptions            | This document and `EXCEPTIONS.yaml`      | PR checklist, decision records                         |
| Current system boundaries and data flow     | `ARCHITECTURE.md` plus executable code   | API and development documentation                      |
| Static feed catalog                         | `backend/src/feeds.ts`                   | Seeded SQLite `feeds`, `/api/feeds`, UI lists, reports |
| Database schema                             | `backend/src/migrations.ts`              | `DATA_MODEL.md`, runtime SQLite files                  |
| Runtime API behavior                        | Backend routes and their tests           | `API.md`, frontend response types                      |
| Browser user-data normalization             | `src/lib/userData.ts` and `src/types.ts` | Stored localStorage values                             |
| Required verification                       | `AGENTS.md` and CI workflow              | Package-script aliases, completion reports             |

When artifacts conflict, stop. Reconcile the canonical artifact and regenerate or update dependents in the same change. Code is authoritative evidence of current behavior, but it does not silently redefine product intent or governance.

## The Ten Change Gates

### 1. Capability Discovery — Does this functionality already exist?

- Search routes, components, hooks, backend services, migrations, scripts, tests, flags, and documentation.
- Trace behavior end to end; do not infer absence from a missing UI.
- Record reusable capability and the remaining gap in the PR or decision record.

**Pass:** Evidence identifies an existing path to reuse or proves a concrete gap.

### 2. Necessity — Does new code need to be written at all?

Prefer, in order:

1. Existing behavior or configuration.
2. Documentation, data correction, or operational action.
3. Composition or extension of an existing module.
4. New code with an explicit user outcome and owner.

**Pass:** The change explains why configuration, reuse, or removal alone cannot produce the outcome.

### 3. Contract Resolution — Which interfaces and invariants govern this task?

Identify applicable:

- API request/response behavior and validation.
- Feed, article, user-data, queue, and database shapes.
- Accessibility semantics and user-visible states.
- Retry, idempotency, cache, scheduling, and security invariants.
- Backward compatibility and migration expectations.

Update the governing contract before or with consumers. Never resolve drift by weakening validation.

**Pass:** Contracts and invariants are named, tested, and compatible or deliberately migrated.

### 4. Source-of-Truth Control — Which artifact is canonical, and what must be generated?

Use the authority table above. Do not hand-edit generated or seeded copies as the primary change. Regenerate or synchronize dependent artifacts and verify no second canonical copy was introduced.

**Pass:** The canonical artifact changes once; every affected derivative is updated or proven runtime-generated.

### 5. Architecture — Which layers and dependencies are permitted?

- Frontend may call backend `/api/*`; it may not fetch or parse feeds.
- Backend owns external feed I/O, parsing, validation, caching, scheduling, search, and enrichment.
- SQLite access remains behind backend modules and numbered migrations.
- AI work runs asynchronously through the enrichment queue.
- Browser persistence is for user state, not a second feed-data cache.
- Reuse installed libraries and design-system components before adding dependencies.
- No new external provider or proxy without explicit approval.

**Pass:** The dependency direction is preserved and new dependencies have a bounded, documented purpose.

### 6. Security — Which controls must exist initially?

For the first shippable implementation, include as applicable:

- Trust-boundary validation with narrow types or Zod schemas.
- SSRF protection for external URLs and every redirect hop.
- Standard ports/schemes, request timeouts, response-size bounds, redirect limits, and bounded retry with jitter.
- Output sanitization and safe external-link attributes.
- Server-only credentials, redacted structured logs, and no secrets in fixtures.
- Bounded concurrency, batch size, storage growth, and AI usage.
- Prompt-injection resistance and structured output validation for AI features.
- Authentication/authorization analysis if a change introduces shared or remote user data.

Security controls are acceptance criteria, not a later hardening phase.

**Pass:** Threats, controls, and negative tests are present for the initial implementation.

### 7. Scope — What is explicitly outside this change?

Name non-goals, deferred work, untouched modules, migration exclusions, provider exclusions, and operational assumptions. A deferral cannot hide behavior required for the stated user outcome.

**Pass:** Reviewers can distinguish intentional boundaries from missing implementation.

### 8. Drift Control — Which representations could diverge?

Check at minimum:

- Catalog → seeded database → API → frontend.
- Migrations → data-model documentation.
- Backend responses → API docs → frontend types/tests.
- Preferences → normalization → persisted values → UI.
- Prompt/algorithm versions → cached enrichments → UI labels.
- Package scripts → CI → `AGENTS.md`.
- Product vision → README → roadmap → implemented journey.

Prefer generation or executable verification. If generation is unavailable, update representations atomically and add a drift check when recurrence is likely.

**Pass:** Every affected representation is generated, synchronized, or guarded by a test/check.

### 9. Completion — What evidence proves the outcome?

Before completion:

- Map every requirement and gate to direct evidence.
- Run all root and backend commands required by `AGENTS.md`.
- Add focused unit/integration tests and critical-journey Playwright coverage.
- Inspect runtime behavior, persisted state, generated artifacts, logs, or remote CI where required.
- Inspect the final diff for unrelated or untracked work.
- Report commands and outcomes; distinguish skipped or unavailable checks.

**Pass:** Evidence proves the full user outcome and all applicable invariants—not merely absence of detected errors.

### 10. Exception Handling — Who can approve a deviation, and when does it expire?

A deviation requires an entry in `EXCEPTIONS.yaml` before merge.

| Deviation                                               | Required approver                      |
| ------------------------------------------------------- | -------------------------------------- |
| Product purpose, scope, privacy, or non-goal            | Product owner or repository owner      |
| Architecture, contract, migration, or source of truth   | Technical lead or repository owner     |
| Security, credentials, SSRF, validation, or data export | Security owner and repository owner    |
| Test, CI, accessibility, or completion gate             | Technical lead and affected area owner |

Rules:

- Name an accountable owner, approver, rationale, compensating controls, affected artifacts, issue, creation date, and expiry.
- Use ISO dates. Maximum initial lifetime is 90 days.
- Security exceptions require the shortest practical expiry and cannot authorize committed secrets or bypass destructive-action approval.
- Expired exceptions are invalid. Renewals require new evidence and approval.
- Remove the entry when remediated and link the closing change.
- If a named role does not exist, the repository owner assumes it; authors cannot self-approve.

**Pass:** No deviation exists, or a current approved exception covers it exactly.

## Decision Threshold

Create a decision record when a change alters product scope, source-of-truth ownership, public contracts, dependency direction, privacy/security posture, persistence schema, external providers, or rollback strategy. Routine conforming changes use the PR checklist only.
