# Decision: <short title>

- **Status:** proposed
- **Date:** YYYY-MM-DD
- **Owners:** <accountable owner>
- **Approvers:** <required roles>
- **Related issue/PR:** <link or identifier>
- **Supersedes:** none
- **Review date:** YYYY-MM-DD or not applicable

## User Outcome

Describe the complete user or operational outcome and how it advances `PRODUCT_VISION.md`.

## 1. Capability Discovery

What already exists? Cite routes, modules, schemas, tests, documentation, configuration, and observed runtime behavior. State the exact gap.

## 2. Necessity

Why are configuration, documentation, data correction, composition, deletion, or reuse insufficient? What is the minimum coherent change?

## 3. Contract Resolution

List governing interfaces and invariants. Include compatibility, validation, accessibility, idempotency, caching, scheduling, and migration requirements where applicable.

## 4. Source-of-Truth Control

Name each canonical artifact and every generated, seeded, cached, documented, or client-side representation that must follow it.

## 5. Architecture

Describe permitted layers, dependencies, synchronous and asynchronous paths, data flow, failure behavior, and rollback. Include a small diagram only if relationships are otherwise unclear.

## 6. Security

List threats, initial controls, negative tests, credential handling, network bounds, concurrency/cost bounds, and logging/redaction requirements.

## 7. Scope

### In scope

- <item>

### Out of scope

- <item>

## 8. Drift Control

List representations that could diverge and the generation, synchronization, contract test, or CI check that prevents each divergence.

## 9. Completion Evidence

Map each requirement to authoritative proof: tests, commands, runtime observations, migrations, generated artifacts, logs, accessibility scans, or CI state.

## 10. Exception Handling

State “none” or list the exact `EXCEPTIONS.yaml` IDs required. A proposed exception is not approval.

## Options Considered

Include “do nothing/reuse existing capability.” Compare benefits, costs, risks, reversibility, and operational burden.

## Decision

State the chosen option and why it best satisfies the user outcome and governance gates.

## Consequences and Follow-up

Record accepted tradeoffs, monitoring, rollout, rollback trigger, owners, and dated follow-up work.
