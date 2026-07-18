# CivicFeed Feed Validator & Ingestion Hardening Design

## 1. Problem Statement

The current live validator (`scripts/validate-live-feeds.mjs`) collapses several independent dimensions into a single `working` / `blocked` classification. A feed that is reachable, valid, and legitimately empty is marked `blocked`. A feed that responds slowly but is healthy is marked `blocked`. A feed that is a duplicate of another feed is marked independently. Freshness is not considered, so archival or low-frequency feeds are indistinguishable from broken ones.

The latest run reports 583 working and 11 blocked out of 594 feeds. Direct inspection shows that several of the 11 are actually empty, slow, or recoverable, and that the catalog contains duplicate configured URLs that inflate work and confuse metrics.

## 2. Goals

1. Separate validation dimensions so reachability, parsing, freshness, duplication, and operational eligibility are independently observable.
2. Canonicalize feed endpoints by final redirect URL and report duplicate configured/canonical URLs without deleting records.
3. Fetch each unique canonical endpoint only once per run.
4. Triage the 11 currently blocked feeds with evidence-backed dispositions and update the catalog where a verified replacement or status change is justified.
5. Add feed-aware freshness classification that does not penalize archive, event, or low-frequency feeds.
6. Improve request reliability with bounded retries, jitter, per-host concurrency, redirect/size limits, conditional requests, and a clear user-agent policy.
7. Add deterministic unit/fixture tests covering all major failure classes.
8. Produce a deterministic, machine-readable report with the required metrics and a baseline comparison.

## 3. Non-Goals

- No UI or frontend redesign.
- No inventory-wide feed discovery; discovery is allowed only for a specific unresolved feed during triage.
- No deletion of source records; duplicates are reported and aliased, not removed.
- No bypassing of legitimate anti-bot or access controls.
- No source-specific parser hacks in shared code unless isolated, documented, and tested.

## 4. Proposed Approach

Create a new TypeScript library module, `backend/src/feed-validator.ts`, that encapsulates all validation logic. Create `backend/src/feed-validator-cli.ts` as the CLI entry point that imports the library and writes the report. `scripts/validate-live-feeds.mjs` becomes a thin wrapper that executes the CLI via `tsx`, preserving the existing command-line invocation path. This keeps the work testable under the backend Vitest suite and reuses the existing `guardedFetch` SSRF/redirect/size protections in `backend/src/url-security.ts`.

### 4.1 Validation Result Model

Each feed produces a `FeedValidationResult` containing:

| Field                                                                      | Meaning                                                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `id`, `name`, `category`, `rssUrl`                                         | Source catalog identity                                                                      |
| `transportStatus`                                                          | `ok`, `timeout`, `network_error`, `blocked`, `not_found`, `too_many_redirects`, `unsafe_url` |
| `httpStatus`                                                               | HTTP status code, or `null`                                                                  |
| `contentType`                                                              | Response `Content-Type`, or `null`                                                           |
| `parseStatus`                                                              | `ok`, `empty`, `unparseable`, `unsupported_format`, `schema_error`                           |
| `entryCount`                                                               | Number of entries returned by `parseRssXml`                                                  |
| `freshnessStatus`                                                          | `current`, `stale`, `archive`, `low_frequency`, `future_event`, `unknown`                    |
| `newestItemDate`                                                           | ISO date of newest item, or `null`                                                           |
| `canonicalUrl`                                                             | Final redirect URL normalized                                                                |
| `duplicateOf`                                                              | ID of the canonical representative when this feed is an alias, or `null`                     |
| `operationalStatus`                                                        | `healthy`, `empty`, `stale`, `archive`, `duplicate`, `blocked`, `unsupported`                |
| `failureReason`                                                            | Human-readable disposition                                                                   |
| `responseTimeMs`, `attempts`, `finalUrl`, `format`, `etag`, `lastModified` | Observability fields                                                                         |

`status` is retained for backward compatibility as a derived field mapping `operationalStatus` to `working` or `blocked`.

### 4.2 Canonical URL Deduplication

- Normalize the configured URL: lowercase hostname, strip trailing slash, preserve path/query.
- Fetch each unique configured URL exactly once per run with `redirect: manual`, tracking each redirect and revalidating safety at every hop via `assertSafeUrl`. There is no separate HEAD pass: the GET response's final URL is the `canonicalUrl` (revised post-implementation — the original HEAD-then-GET design deterministically requested every endpoint twice and HEAD is unreliable against CDN bot rules).
- After validation, group feeds by `canonicalUrl`. The first feed in catalog order becomes the representative; all others are marked `duplicateOf` that representative.
- Identical configured URLs share a single fetch and are also reported as duplicates.

### 4.3 Request Reliability

- **User-Agent:** Use a single policy-compliant string that identifies CivicFeed as the requester, e.g. `CivicFeed-FeedValidator/1.0 (+https://civicfeed.local/validator)`.
- **Retries:** Bounded retries (up to 3 total attempts) only for transient errors: network failures, 408, 429, 502, 503, 504. No retries for 404.
- **Backoff:** Exponential backoff with full jitter between retries.
- **Per-host concurrency:** A host-level semaphore (default 2 concurrent) prevents overwhelming a single publisher.
- **Global concurrency:** Retained at 8, now composed over the host limiter.
- **Timeouts:** Connection + total request timeout, default 15 s (compatible with `guardedFetch`).
- **Redirect limit:** Reuse `MAX_REDIRECTS = 5` from `url-security.ts`.
- **Response size:** Reuse `MAX_RESPONSE_BYTES = 10 MB`.
- **Conditional requests:** If a previous `etag`/`lastModified` is supplied via an optional state object, send `If-None-Match` / `If-Modified-Since`; record returned values for the next run.
- **Compression:** Node `fetch` handles `Accept-Encoding` automatically.

### 4.4 Feed-Aware Freshness

A classifier maps each feed to a `FeedType`:

| FeedType         | Identification                                                                    | Freshness threshold | Future dates     |
| ---------------- | --------------------------------------------------------------------------------- | ------------------- | ---------------- |
| `alert`          | Category/tags include alert/weather/safety, or `contentType` contains "alert"     | 7 days              | Flag if future   |
| `news`           | Default for press releases, articles                                              | 30 days             | Flag if future   |
| `event`          | Subcategory/contentType includes "event", "hearing", "oral argument"              | N/A                 | Allowed          |
| `schedule`       | Subcategory/contentType includes "schedule", "calendar", "docket"                 | N/A                 | Allowed          |
| `dataset_update` | ContentType includes "dataset", "data", "statistics"                              | 90 days             | Flag if future   |
| `low_frequency`  | `updateFrequency` explicitly says monthly/quarterly/annual or category is archive | 1 year              | Allowed if event |
| `archive`        | ContentType/category explicitly "archive", "historical", "records"                | 5 years             | Allowed          |

If `newestItemDate` exceeds the threshold, `freshnessStatus` becomes `stale`. If the feed type is `archive`, it becomes `archive`; if `low_frequency`, `low_frequency`.

### 4.5 Triaging the 11 Blocked Feeds

Each blocked feed will be inspected with the same fetch/parse path used by the validator. Based on direct evidence the disposition is one of:

- `empty` — reachable and parseable but contains zero items (e.g., 1st Circuit oral arguments, NRC event feed).
- `working` — reachable and parseable, previously misclassified due to timeout/response-size (e.g., District of Arizona if a longer timeout or retry succeeds).
- `replaced` — a verified new endpoint is found and the catalog `rssUrl` is updated.
- `temporarily_unavailable` — timeout/network failure with no evidence of a permanent change (e.g., TRICARE).
- `access_restricted` — 403/Cloudflare challenge that cannot be safely bypassed (e.g., FBI, NIH, Army, CDC).
- `deprecated` — 404 and no replacement found after targeted discovery (e.g., Space Weather, HHS OIG).

### 4.6 Testing Strategy

Add `backend/src/feed-validator.test.ts` using Vitest and mocked `fetch`. Fixtures cover:

- Valid RSS, Atom, RDF RSS.
- Redirected feed and two aliases resolving to one canonical URL.
- HTTP 200 with HTML.
- HTTP 200 with no entries.
- Malformed XML.
- HTTP 403, 404, timeout, connection failure.
- Stale news feed, valid archive feed, valid future event, invalid future-dated news item.
- Duplicate endpoint across categories.
- Retry and per-host concurrency behavior.

Tests mock the global `fetch` so they do not depend on live external services.

### 4.7 Reporting

The validator writes a deterministic JSON report sorted by feed ID. It includes:

- Total configured, unique configured URLs, unique canonical URLs.
- Counts by `transportStatus`, `parseStatus`, `freshnessStatus`, `operationalStatus`.
- Duplicate groups.
- Blocked breakdown by failure class.
- Newly blocked and recovered feeds (when a previous report path is supplied).
- Redirect changes and format changes.
- Freshness regressions.
- Slowest 20 feeds.
- Counts by publisher host and category.

## 5. Risks

- Some feeds (FBI, NIH, CDC, Army) are blocked by Cloudflare/Akamai bot mitigation. We will not bypass these; they will be classified as access restricted.
- A longer timeout or retry may shift a timeout failure to success, but it also increases runtime. The default will remain conservative (15 s).
- Changing the canonical URL or `rssUrl` for a feed affects downstream consumers. We will only update URLs when a verified replacement is found.

## 6. Files to Change

- `backend/src/feed-validator.ts` — new validation library.
- `backend/src/feed-validator-cli.ts` — new CLI entry point.
- `backend/src/feed-validator.test.ts` — new tests and fixtures.
- `scripts/validate-live-feeds.mjs` — rewrite to delegate to `feed-validator.ts` and emit the new report.
- `backend/src/feeds.ts` — update blocked feed records based on triage evidence; optionally add `feedType` to a small set of representative feeds if needed for tests.
- `backend/src/url-security.ts` — minor additions only if needed for conditional-request header exposure.
- `artifacts/live-feed-validation.json` — regenerated report.
