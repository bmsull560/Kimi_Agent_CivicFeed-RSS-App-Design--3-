---
name: civicfeed-ingestion-reliability
description: Diagnose, harden, or extend CivicFeed RSS ingestion reliability across fetching, redirects, SSRF checks, XML parsing, normalization, deduplication, cache persistence, scheduling, feed health, retries, circuit breakers, and operational diagnostics. Use for feed failures, stale or duplicate entries, parser compatibility, scheduler throughput, cache correctness, upstream outage handling, ingestion metrics, or systemic catalog quality work. Use civicfeed-feed-intake instead for adding or editing individual catalog feeds.
---

# CivicFeed Ingestion Reliability

Improve the shared ingestion pipeline using reproducible fixtures and operational evidence rather than weakening safeguards for a single feed.

## Triage Workflow

1. Reproduce through the same backend path used in production.
2. Classify the failure before changing code: security rejection, DNS/connectivity, redirect, HTTP policy, size/timeout, XML syntax, schema mapping, normalization, identity/deduplication, cache/database, scheduler, or health reporting.
3. Capture the smallest safe fixture that reproduces parser or normalization failures. Do not make unit tests depend on live upstream services.
4. Trace the attempt through structured logs, fetch status, cache rows, health state, and next schedule time.
5. Fix the shared layer only when the behavior is valid across sources. Use the feed-intake skill for catalog-specific correction.
6. Preserve SSRF controls, bounded redirects, timeouts, response limits, retry eligibility, jitter, and circuit breaking.
7. Add regression tests for the original failure and adjacent cases.
8. Verify on-demand fetch, scheduled refresh, cache hit, stale fallback, and diagnostics where affected.

## Reliability Rules

- Validate every redirect hop and resolved address.
- Retry only transient network failures, 408, 429, and eligible 5xx responses.
- Never retry malformed content or deterministic policy rejection indefinitely.
- Make article identity stable across refreshes; avoid title-only identity when stronger GUID/link data exists.
- Normalize dates and links defensively without inventing missing facts.
- Bound XML work and treat feed markup as untrusted.
- Keep database writes transactional and job processing idempotent.
- Distinguish reachable-empty, stale, archival, low-frequency, unsupported, and broken sources.
- Preserve cached articles when refresh fails and communicate staleness explicitly.
- Emit actionable diagnostics without leaking content, secrets, or sensitive network details.

## Investigation Guide

Read [references/failure-classification.md](references/failure-classification.md) for failure evidence, remediation boundaries, and verification targets.

## Proactive Improvements

Prioritize changes with fleet-wide leverage:

- content-hash or conditional-request support;
- parser fixtures for recurring government CMS variants;
- duplicate/identity audits;
- adaptive scheduling based on observed cadence and failures;
- queue-depth, fetch-latency, cache-hit, freshness, and failure-category metrics;
- bounded dead-letter/retry inspection for enrichment jobs;
- health views that separate upstream failure from local pipeline failure.

Avoid one-off parser branches keyed to an agency unless the source format is truly unique and tested.
