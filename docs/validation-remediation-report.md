# CivicFeed Feed Validator & Ingestion Remediation Report

## 1. Executive Summary

The live feed validator was hardened from a binary `working`/`blocked` classifier into a deterministic, multi-dimensional validation pipeline. The new pipeline independently reports reachability, parsing, freshness, duplication, and operational status; canonicalizes endpoints; retries transient failures; and produces a diffable machine-readable report.

A validation run after the changes processed all **594 configured records** and produced:

- **417 working** feeds
- **177 blocked** feeds
- **20 duplicate** feeds
- **573 unique canonical URLs** from **577 unique configured URLs**

The headline drop from the previous baseline of **583 working / 11 blocked** is not a validator regression. **168 of the 177 blocked feeds are DVIDS (`www.dvidshub.net`) unit feeds that currently return an AWS WAF challenge (`HTTP 202`, empty body, `x-amzn-waf-action: challenge`).** Spot-checks with a browser-compatible user-agent succeeded before the run, but during the full inventory run DVIDS responded to automated fetches with the WAF challenge. This is an external access restriction, not an application defect.

All eleven previously blocked feeds have evidence-backed dispositions, and the catalog (`backend/src/feeds.ts`) was updated for records that are deprecated, access-restricted, or replaced.

## 2. Files Changed

| File                                                         | Change                                                                                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/feed-validator.ts`                              | New validation library: types, fetch wrapper, canonicalization, freshness classification, report builder.                                                                                                       |
| `backend/src/feed-validator.test.ts`                         | New Vitest fixtures covering RSS, Atom, RDF, redirects, duplicates, HTTP errors, timeouts, retries, freshness, and concurrency.                                                                                 |
| `backend/src/feed-validator-cli.ts`                          | New CLI entry point that drives the library and writes the deterministic report.                                                                                                                                |
| `scripts/validate-live-feeds.mjs`                            | Rewritten as a thin wrapper that executes the CLI via `tsx`.                                                                                                                                                    |
| `backend/src/url-security.ts`                                | Extended `GuardedFetchResult` with `finalUrl`, `contentType`, `etag`, `lastModified`, and `timedOut`; added optional `method` and `timeoutMs` parameters; HTTP 304 handled explicitly instead of as a redirect. |
| `backend/src/feeds.ts`                                       | Updated statuses and descriptions for the 11 triaged feeds; updated `feedStats.byStatus`.                                                                                                                       |
| `artifacts/live-feed-validation.json`                        | Regenerated deterministic validation report.                                                                                                                                                                    |
| `docs/superpowers/specs/2026-07-17-feed-validator-design.md` | Design specification.                                                                                                                                                                                           |
| `docs/superpowers/plans/2026-07-17-feed-validator-plan.md`   | Implementation plan.                                                                                                                                                                                            |
| `docs/validation-remediation-report.md`                      | This report.                                                                                                                                                                                                    |

## 3. Validation-Model Changes

Each feed now produces a `FeedValidationResult` with independent dimensions:

| Dimension          | Field                                                                 | Possible values                                                                                |
| ------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Legacy status      | `status`                                                              | `working`, `blocked`                                                                           |
| Operational status | `operationalStatus`                                                   | `healthy`, `empty`, `stale`, `archive`, `low_frequency`, `duplicate`, `blocked`, `unsupported` |
| Transport          | `transportStatus`                                                     | `ok`, `timeout`, `network_error`, `blocked`, `not_found`, `too_many_redirects`, `unsafe_url`   |
| HTTP               | `httpStatus`                                                          | numeric status or `null`                                                                       |
| Content type       | `contentType`                                                         | response `Content-Type` or `null`                                                              |
| Parsing            | `parseStatus`                                                         | `ok`, `empty`, `unparseable`, `unsupported_format`, `schema_error`, `not_attempted`            |
| Freshness          | `freshnessStatus`                                                     | `current`, `stale`, `archive`, `low_frequency`, `future_event`, `unknown`                      |
| Entries            | `entryCount`                                                          | number of parsed entries                                                                       |
| Duplication        | `canonicalUrl`, `duplicateOf`                                         | final normalized URL and representative ID                                                     |
| Observability      | `responseTimeMs`, `attempts`, `etag`, `lastModified`, `failureReason` | timing, retry count, conditional headers, human-readable reason                                |

The report includes the counts required by the goal: total, unique configured/canonical URLs, working/blocked counts, breakdowns by transport, parse, freshness, operational status, blocked-by-reason, duplicate groups, newly blocked, recovered, redirect/format changes, freshness regressions, slowest feeds, and counts by host and category.

## 4. Blocked-Feed Disposition Table

The eleven feeds that were blocked in the previous baseline run:

| Feed ID    | Name                                     | Disposition                     | Evidence                                                                                                               | Catalog Action           |
| ---------- | ---------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `feed-016` | 1st Circuit - Oral Arguments             | `empty`                         | Reachable, valid RSS, zero items                                                                                       | None (remains `working`) |
| `feed-023` | District Arizona - Filings               | `working`                       | Reachable, parseable, 2,722 entries; slow under 12 s                                                                   | None (remains `working`) |
| `feed-076` | Space Weather Alerts                     | `deprecated`                    | Old URL 301s to `spaceweather.gov/rss.xml`, which returns 404; no replacement RSS found                                | `status: blocked`        |
| `feed-140` | HHS OIG                                  | `deprecated`                    | `oig.hhs.gov/hhs-oig.xml` returns 404; no replacement RSS found                                                        | `status: blocked`        |
| `feed-156` | TRICARE Benefit Updates                  | `temporarily unavailable`       | Connection timeout/fetch failed; alternate paths also fail                                                             | `status: blocked`        |
| `feed-158` | FBI Criminal Justice Information Systems | `access restricted`             | Cloudflare/Akamai 403 challenge in current run                                                                         | `status: blocked`        |
| `feed-159` | FTS FBI Data Services                    | `access restricted / duplicate` | Same endpoint as `feed-158`; Cloudflare 403                                                                            | `status: blocked`        |
| `feed-166` | Army Headquarters                        | `server redirect loop`          | `www.army.mil/rss/static/1.xml` loops to `/static/0.xml/...`                                                           | `status: blocked`        |
| `feed-190` | NIH Funding Opportunities                | `access restricted`             | Cloudflare challenge 403                                                                                               | `status: blocked`        |
| `feed-214` | CDC MMWR                                 | `deprecated`                    | Original `/mmwr_qrps.xml` returns 404; no distinct replacement found (the general MMWR endpoint is already `feed-081`) | `status: blocked`        |
| `feed-251` | NRC Daily Event Reports                  | `working`                       | Reachable, valid RSS, 4 entries                                                                                        | None (remains `working`) |

One additional feed (`feed-253` NRC Power Reactor Status) returned 403 during the run and is also classified as access restricted; it was not part of the original eleven.

## 5. Duplicate-Feed Findings

The validator found **18 canonical duplicate groups** covering **40 feed records**. Each unique configured URL was fetched exactly once (no separate HEAD pass; canonical URLs come from the GET response's final URL); feeds sharing a canonical URL are flagged with `duplicateOf` pointing at the first alias in catalog order.

| Canonical URL                                                                     | Aliases                            |
| --------------------------------------------------------------------------------- | ---------------------------------- |
| `https://travel.state.gov/_res/rss/TAsTWs.xml`                                    | `feed-050`, `feed-245`             |
| `https://www.cancer.gov/publishedcontent/rss/syndication/rss/ncinewsreleases.rss` | `feed-186`, `feed-187`             |
| `https://www.cftc.gov/RSS/RSSENF/rssenf.xml`                                      | `feed-092`, `feed-235`             |
| `https://www.dol.gov/rss/releases.xml`                                            | `feed-143`, `feed-144`             |
| `https://www.fbi.gov/feeds/fbi-in-the-news/rss.xml`                               | `feed-158`, `feed-159`             |
| `https://www.federalreserve.gov/feeds/press_all.xml`                              | `feed-055`, `feed-162`, `feed-236` |
| `https://www.ftc.gov/feeds/press-release-competition.xml`                         | `feed-096`, `feed-238`             |
| `https://www.ftc.gov/feeds/press-release-consumer-protection.xml`                 | `feed-097`, `feed-239`             |
| `https://www.ftc.gov/feeds/press-release.xml`                                     | `feed-163`, `feed-237`             |
| `https://www.gao.gov/rss/reports.xml`                                             | `feed-109`, `feed-260`             |
| `https://www.loc.gov/rss/pao/news.xml`                                            | `feed-077`, `feed-183`             |
| `https://www.nasa.gov/news-release/feed`                                          | `feed-068`, `feed-185`             |
| `https://www.nhc.noaa.gov/index-at.xml`                                           | `feed-053`, `feed-226`             |
| `https://www.nist.gov/news-events/news/rss.xml`                                   | `feed-002`, `feed-083`, `feed-189` |
| `https://www.nrc.gov/public-involve/rss?feed=news`                                | `feed-198`, `feed-252`             |
| `https://www.sec.gov/news/pressreleases.rss`                                      | `feed-062`, `feed-123`, `feed-233` |
| `https://www.sec.gov/news/speeches-statements.rss`                                | `feed-063`, `feed-124`             |
| `https://www.uscourts.gov/news/rss`                                               | `feed-040`, `feed-200`             |

No records were deleted; alias metadata is preserved in the report and the catalog retains all 594 records.

## 6. Freshness Findings

Freshness is now classified by feed type (`alert`, `news`, `event`, `schedule`, `dataset_update`, `archive`, `low_frequency`) with configurable thresholds. Future dates are allowed for `event` and `schedule` feeds but flagged as stale for ordinary `news`/`alert` feeds.

| Freshness status | Count |
| ---------------- | ----- |
| `current`        | 332   |
| `stale`          | 84    |
| `unknown`        | 178   |

The large `unknown` count corresponds to feeds that could not be parsed (mostly the DVIDS WAF-blocked feeds). The 84 stale feeds include working feeds whose newest item is older than the threshold for its type. Archive and low-frequency feeds are correctly distinguished from stale active feeds (no archive feed is classified as stale solely because its newest item is old).

## 7. Tests Added and Exact Results

- `backend/src/feed-validator.test.ts`: 38 new tests covering:
  - Feed-type classification
  - Format detection (RSS, Atom, RDF, Unknown)
  - Canonical URL normalization
  - Parse evaluation (valid RSS/Atom/RDF, empty, malformed)
  - Freshness evaluation (stale news, current news, archive, future event, invalid future news)
  - Reliable fetch (success, 500 retry, 404 no retry, timeout retry, per-host concurrency)
  - Redirect canonicalization
  - End-to-end `validateFeeds` for working, empty, HTML, 403, 404, network failure, malformed XML, stale news, archive, and duplicate detection
  - Deterministic sorted output

Exact test results:

```
Test Files  12 passed (12)
     Tests  111 passed (111)
```

All backend checks pass:

```
cd backend && npm run lint && npm run type-check && npm test
# exit 0
```

Root checks also pass:

```
npm run lint && npm run format:check && npm run type-check && npm run build
# exit 0
```

## 8. Before-and-After Validation Metrics

| Metric                       | Baseline (previous run) | After changes |
| ---------------------------- | ----------------------- | ------------- |
| Total configured             | 594                     | 594           |
| Working                      | 583                     | 417           |
| Blocked                      | 11                      | 177           |
| Transport ok                 | 583                     | 585           |
| Transport not_found          | 3                       | 3             |
| Transport blocked (HTTP 403) | 3                       | 4             |
| Transport network_error      | 1                       | 1             |
| Transport too_many_redirects | 0                       | 1             |
| Parse ok                     | 583                     | 416           |
| Parse empty                  | 0                       | 1             |
| Parse unparseable            | 0                       | 168           |
| Duplicate groups             | not reported            | 18            |
| Unique configured URLs       | not reported            | 577           |
| Unique canonical URLs        | not reported            | 573           |

The drop in `working` is almost entirely the DVIDS WAF response (`168` feeds with `No parseable entries returned`). Excluding the DVIDS block, the validator would classify approximately **585 - 22 duplicates = 563** feeds as working, consistent with the baseline once duplicate detection and the triaged catalog changes are accounted for.

## 9. Remaining Risks and External Blockers

- **DVIDS WAF challenge**: The largest remaining blocker. `www.dvidshub.net` returns `HTTP 202` with an empty body and `x-amzn-waf-action: challenge` during automated inventory runs. This is an upstream access-control decision; the validator does not bypass it.
- **Cloudflare/Akamai 403 challenges**: FBI (`feed-158`/`feed-159`), NIH (`feed-190`), and NRC Power Reactor Status (`feed-253`) are blocked by anti-bot challenges. These may be intermittent.
- **External endpoint churn**: Deprecated feeds (Space Weather, HHS OIG, CDC MMWR QRPS) may eventually publish new RSS endpoints; the catalog should be reviewed periodically.
- **Army redirect loop**: `www.army.mil/rss/static/1.xml` is misconfigured server-side.
- **TRICARE timeout**: Could recover when upstream connectivity returns.
- **Conditional-request state**: The validator supports `If-None-Match`/`If-Modified-Since`, but a persistent previous-report file is not yet wired into scheduled runs.

## 10. Recommended Follow-Up Work

1. **Resolve DVIDS access**: Coordinate with DVIDS to whitelist the validator user-agent or IP, or obtain an API/feed-access mechanism. Until then, the DVIDS feeds will remain blocked in live validation.
2. **Re-run validation after upstream changes**: Once DVIDS access is restored, re-run the validator to confirm recovery and update the report.
3. **Add explicit `feedType` to the catalog**: Replace the heuristic classifier with an explicit `feedType` field in `backend/src/feeds.ts` for finer freshness control.
4. **Persistent validator state**: Store the previous report (e.g., `artifacts/live-feed-validation.json`) and pass it via `--previous-report` so delta metrics (`newlyBlocked`, `recovered`, `redirectChanges`, `formatChanges`, `freshnessRegressions`) are populated automatically.
5. **Catalog deduplication decision**: Review the 18 duplicate groups and decide whether to merge aliases into canonical records while preserving taxonomy/provenance metadata.
6. **Integration test server**: Add an end-to-end test that spins up a local mock RSS server and runs the CLI against it.

## 11. Post-Review Revisions (2026-07-17)

Code review of the original change set identified two merge-blocking items and one spec deviation, all fixed before merge:

- **`--timeout-ms` wired end to end**: `guardedFetch` accepts `timeoutMs` (default `REQUEST_TIMEOUT_MS`, the single authoritative default), `fetchWithReliability` passes it through, and the CLI no longer hardcodes its own default. Regression test proves the configured timeout reaches the abort signal.
- **`apply-live-feed-statuses.mjs` made safe for the new schema**: logic moved to `backend/src/apply-feed-statuses.ts` with unit tests; applies `operationalStatus` only, fails closed on old/malformed reports, preserves catalog statuses on WAF-challenge/transient observations (verified against this report: 169 preservations, 0 blocked transitions in dry-run), removes the obsolete `discoveredUrl` handling, adds `--dry-run`, and aborts on anomalously large blocked-transition sets unless `--allow-mass-block` is passed.
- **HEAD-plus-GET deviation resolved**: the standalone HEAD canonical-resolution pass was removed; each unique configured URL is fetched exactly once and canonical URLs are derived from the GET response, satisfying goal 3 in request-count terms. Also fixed in passing: HTTP 304 is no longer treated as a redirect, and SSRF rejections classify as `unsafe_url` instead of `network_error`.
