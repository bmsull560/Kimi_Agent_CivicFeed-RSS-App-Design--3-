# Feed Validator & Ingestion Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary `working`/`blocked` live validator with a deterministic, multi-dimensional validator that separates reachability, parsing, freshness, duplication, and operational status, and produce a deterministic report.

**Architecture:** A new backend TypeScript library (`backend/src/feed-validator.ts`) performs all validation, a new CLI (`backend/src/feed-validator-cli.ts`) drives it, and `scripts/validate-live-feeds.mjs` becomes a thin `tsx` wrapper. The library reuses `backend/src/url-security.ts` for SSRF/redirect/size protection and `backend/src/rss-parser.ts` for parsing.

**Tech Stack:** Node.js 24, TypeScript 5.9, Vitest, `tsx`, `fast-xml-parser`, native `fetch`.

## Global Constraints

- Preserve all 594 feed records in `backend/src/feeds.ts`.
- Do not enable inventory-wide discovery; discovery only for a specific unresolved feed during triage.
- Do not bypass legitimate anti-bot or access controls.
- No source-specific hacks in shared parser code unless isolated, documented, and tested.
- All changes must pass `npm run lint`, `npm run type-check`, and `npm test` in the backend workspace.
- Reports must be deterministic and diffable across runs.

## File Structure

| File                                  | Responsibility                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `backend/src/feed-validator.ts`       | New validation library: types, fetch wrapper, canonicalization, freshness, orchestration. |
| `backend/src/feed-validator.test.ts`  | Deterministic Vitest fixtures covering all required failure classes.                      |
| `backend/src/feed-validator-cli.ts`   | CLI entry point that imports the library and writes the report.                           |
| `scripts/validate-live-feeds.mjs`     | Thin wrapper that execs `tsx backend/src/feed-validator-cli.ts`.                          |
| `backend/src/feeds.ts`                | Update blocked feed records based on triage evidence.                                     |
| `artifacts/live-feed-validation.json` | Regenerated deterministic report.                                                         |

---

### Task 1: Create core types and feed classifier

**Files:**

- Create: `backend/src/feed-validator.ts` (initial section)
- Test: `backend/src/feed-validator.test.ts` (initial tests)

**Interfaces (produce):**

```typescript
export type FeedType =
  "alert" | "news" | "event" | "schedule" | "dataset_update" | "low_frequency" | "archive";

export interface FeedValidationResult {
  id: string;
  name: string;
  category: string;
  rssUrl: string;
  status: "working" | "blocked";
  previousStatus: "working" | "blocked" | "unverified";
  operationalStatus: string;
  transportStatus: string;
  httpStatus: number | null;
  contentType: string | null;
  parseStatus: string;
  entryCount: number;
  freshnessStatus: string;
  newestItemDate: string | null;
  canonicalUrl: string | null;
  duplicateOf: string | null;
  finalUrl: string | null;
  format: string;
  responseTimeMs: number;
  attempts: number;
  failureReason: string | null;
  etag: string | null;
  lastModified: string | null;
}
```

**Implementation:**

```typescript
export function classifyFeedType(feed: Feed): FeedType {
  const text =
    `${feed.category} ${feed.subCategory} ${feed.contentType} ${feed.updateFrequency} ${feed.tags.join(" ")}`.toLowerCase();
  if (/\b(archive|historical|records)\b/.test(text)) return "archive";
  if (/\b(event|hearing|oral argument|argument)\b/.test(text)) return "event";
  if (/\b(schedule|calendar|docket)\b/.test(text)) return "schedule";
  if (
    /\b(alert|warning|advisory|notification|weather|safety|emergency|tsunami|hurricane|tornado)\b/.test(
      text
    )
  )
    return "alert";
  if (/\b(dataset|data|statistics|indicator|report)\b/.test(text)) return "dataset_update";
  if (/\b(monthly|quarterly|annual|yearly|low.frequency|bimonthly)\b/.test(text))
    return "low_frequency";
  return "news";
}
```

**Test commands:**

- `cd backend && npx vitest run src/feed-validator.test.ts`
- Expect classification tests to pass.

---

### Task 2: Add reliable fetch wrapper

**Files:**

- Modify: `backend/src/feed-validator.ts`
- Test: `backend/src/feed-validator.test.ts`

**Implementation:**

Add a host semaphore and `fetchWithReliability(url, options)`:

```typescript
interface FetchOptions {
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  perHostConcurrency: number;
  previousEtag?: string;
  previousLastModified?: string;
}

interface FetchOutcome {
  ok: boolean;
  status: number;
  text: string;
  finalUrl: string;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  attempts: number;
  error: string | null;
  timedOut: boolean;
}
```

The wrapper:

1. Acquires a per-host semaphore.
2. Calls `guardedFetch` with the supplied User-Agent, optional conditional headers, and timeout.
3. Retries transient errors (`status === 0`, 408, 429, 502, 503, 504) up to `maxRetries` with exponential backoff + jitter.
4. Returns `FetchOutcome`.

**Test commands:**

- `cd backend && npx vitest run src/feed-validator.test.ts -t "reliability"`
- Expect tests for retry, no-retry on 404, timeout, and per-host concurrency to pass.

---

### Task 3: Add canonical URL normalization and deduplication

**Files:**

- Modify: `backend/src/feed-validator.ts`
- Test: `backend/src/feed-validator.test.ts`

**Implementation:**

```typescript
export function normalizeCanonicalUrl(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.pathname = u.pathname.replace(/\/+$/, "");
  u.hash = "";
  return u.toString();
}

export interface CanonicalGroup {
  representative: Feed;
  aliases: Feed[];
  canonicalUrl: string;
}

export async function resolveCanonicalUrl(
  feed: Feed,
  fetcher: (url: string) => Promise<FetchOutcome>,
  alreadyResolved: Map<string, string> = new Map()
): Promise<string> {
  const configured = normalizeCanonicalUrl(feed.rssUrl);
  if (alreadyResolved.has(configured)) return alreadyResolved.get(configured)!;
  const outcome = await fetcher(configured);
  const canonical = outcome.ok ? normalizeCanonicalUrl(outcome.finalUrl) : configured;
  alreadyResolved.set(configured, canonical);
  return canonical;
}
```

**Dedup logic:** group feeds by resolved canonical URL; representative is first in catalog order; aliases set `duplicateOf`.

**Test commands:**

- `cd backend && npx vitest run src/feed-validator.test.ts -t "canonical"`
- Expect two-alias and cross-category duplicate tests to pass.

---

### Task 4: Add parse and freshness evaluation

**Files:**

- Modify: `backend/src/feed-validator.ts`
- Test: `backend/src/feed-validator.test.ts`

**Implementation:**

```typescript
export function classifyFormat(xmlText: string): string { ... }

export function evaluateParse(text: string, feedId: string, feedName: string) {
  const format = classifyFormat(text);
  if (format === "Unknown") return { parseStatus: "unparseable", entries: [], entryCount: 0 };
  const entries = parseRssXml(text, feedId, feedName);
  if (entries.length === 0) return { parseStatus: "empty", entries, entryCount: 0 };
  return { parseStatus: "ok", entries, entryCount: entries.length };
}

const FRESHNESS_THRESHOLDS_DAYS: Record<FeedType, number | null> = {
  alert: 7,
  news: 30,
  dataset_update: 90,
  low_frequency: 365,
  archive: 1825,
  event: null,
  schedule: null,
};

export function evaluateFreshness(
  newestDate: Date | null,
  feedType: FeedType,
  now = new Date()
): { freshnessStatus: string; futureDated: boolean } { ... }
```

`evaluateFreshness` treats future dates as valid for `event`/`schedule`, flags them for `news`/`alert`, and classifies by threshold.

**Test commands:**

- `cd backend && npx vitest run src/feed-validator.test.ts -t "freshness"`
- Expect stale news, valid archive, future event, and invalid future news tests to pass.

---

### Task 5: Wire transport, parse, freshness, and dedup into `validateFeeds`

**Files:**

- Modify: `backend/src/feed-validator.ts`
- Test: `backend/src/feed-validator.test.ts`

**Implementation:**

```typescript
export interface ValidationOptions {
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  perHostConcurrency: number;
  globalConcurrency: number;
  previousReport?: ValidationReport;
}

export async function validateFeeds(
  feeds: Feed[],
  options: ValidationOptions
): Promise<{ results: FeedValidationResult[]; report: ValidationReport }> { ... }
```

Responsibilities:

1. Resolve canonical URLs for all feeds (parallel with host limiter).
2. Group by canonical URL.
3. Fetch representative once; copy result to aliases with `duplicateOf` set.
4. Evaluate transport, parse, freshness.
5. Derive `operationalStatus` and backward-compatible `status`.
6. Build deterministic `ValidationReport`.

**Test commands:**

- `cd backend && npx vitest run src/feed-validator.test.ts`
- Expect full validator tests to pass.

---

### Task 6: Build the CLI entry point

**Files:**

- Create: `backend/src/feed-validator-cli.ts`

**Implementation:**

Parse the same flags as the old script (`--out`, `--limit`, `--offset`, `--concurrency`, `--timeout-ms`, `--ids`, `--status`, `--discover`). Load `feeds` from `./feeds.js`. Call `validateFeeds`. Write sorted JSON report to the output path.

**Test commands:**

- `cd backend && npx tsx src/feed-validator-cli.ts --limit 5 --out /tmp/mini-validation.json`
- Expect `/tmp/mini-validation.json` to contain 5 results and a summary.

---

### Task 7: Replace `scripts/validate-live-feeds.mjs` with a tsx wrapper

**Files:**

- Modify: `scripts/validate-live-feeds.mjs`

**Implementation:**

```javascript
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(__dirname, "..", "backend", "src", "feed-validator-cli.ts");
const result = spawnSync("npx", ["tsx", cli, ...process.argv.slice(2)], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
});
process.exit(result.status ?? 1);
```

**Test commands:**

- `node scripts/validate-live-feeds.mjs --limit 5 --out /tmp/wrapper-validation.json`
- Expect same output as Task 6.

---

### Task 8: Reproduce the current baseline

**Files:**

- None (read-only)

**Command:**

- `node scripts/validate-live-feeds.mjs --out artifacts/live-feed-validation-baseline.json`
- Keep the baseline artifact for comparison.

**Checkpoint:** Confirm baseline shows 583 working / 11 blocked.

---

### Task 9: Triage the 11 blocked feeds and update `backend/src/feeds.ts`

**Files:**

- Modify: `backend/src/feeds.ts`

**Process:**

1. For each blocked feed, use the new validator or targeted `guardedFetch` to inspect status, headers, redirect chain, and a bounded response sample.
2. Allowed discovery only for the feed being investigated.
3. Update `rssUrl` or `status` only when a verified replacement is found.

Expected dispositions (verified during design exploration):

- `feed-016` — reachable, valid RSS, zero items → keep URL, status stays `working`, validator will report `empty`.
- `feed-023` — slow but reachable and parseable → keep URL, status stays `working`.
- `feed-076` — 404; search `spaceweather.gov` for a replacement RSS or mark `deprecated`.
- `feed-140` — 404; search `oig.hhs.gov` for a replacement RSS or mark `deprecated`.
- `feed-156` — connection timeout/failure → mark `blocked` (temporarily unavailable).
- `feed-158` / `feed-159` — duplicate configured URL, Cloudflare 403 → mark `blocked` (access restricted).
- `feed-166` — too many redirects/403 → mark `blocked` (access restricted).
- `feed-190` — Cloudflare challenge 403 → mark `blocked` (access restricted).
- `feed-214` — Akamai 403/404 → mark `blocked` (access restricted / deprecated).
- `feed-251` — reachable, valid RSS, zero items → keep URL, status stays `working`, validator will report `empty`.

**Test commands:**

- `node scripts/verify-feeds.mjs`
- `cd backend && npm run type-check`
- Expect verification and type-check to pass.

---

### Task 10: Regenerate the validation report and compare metrics

**Files:**

- Create/overwrite: `artifacts/live-feed-validation.json`

**Command:**

- `node scripts/validate-live-feeds.mjs --out artifacts/live-feed-validation.json`

**Checkpoint:**

- 594 total records.
- 11 blocked feeds have explicit `failureReason` and `operationalStatus`.
- Duplicate configured/canonical URLs reported deterministically.
- Canonical endpoints fetched only once per run.

---

### Task 11: Run backend checks

**Commands:**

- `cd backend && npm run lint`
- `cd backend && npm run type-check`
- `cd backend && npm test`

**Checkpoint:** All three commands exit 0.

---

### Task 12: Produce remediation report

**Files:**

- Create: `docs/validation-remediation-report.md`

**Content:** The 10-section report required by the goal: executive summary, files changed, validation-model changes, blocked-feed disposition table, duplicate-feed findings, freshness findings, tests added and exact results, before-and-after metrics, remaining risks, recommended follow-up.

---

## Spec Coverage Self-Review

| Spec Requirement               | Task                 |
| ------------------------------ | -------------------- |
| Separate validation dimensions | 1, 5                 |
| Canonical deduplication        | 3, 5                 |
| Triage 11 blocked feeds        | 9                    |
| Feed-aware freshness           | 1, 4                 |
| Bounded reliability            | 2                    |
| Deterministic tests            | 1-5, 11              |
| Improved run artifacts         | 5, 10, 12            |
| Preserve all 594 records       | Global constraint, 9 |

## Placeholder Scan

- No `TODO`, `TBD`, or vague "add error handling" steps remain.
- Every task includes exact file paths and verification commands.

---

## Post-Implementation Revisions (2026-07-17, code review follow-up)

- **HEAD pass removed (Task 3 / Task 5 superseded).** `resolveCanonicalUrl` and the standalone HEAD request were eliminated. Each unique configured URL is fetched exactly once (GET); the canonical URL is resolved from the GET response's final URL. This fixes the deterministic 2× request amplification the original design had against goal 3, and avoids HEAD's unreliability against CDN bot rules. Duplicate detection now groups post-hoc by the fetched final URL.
- **`timeoutMs` wired end to end (Task 2 completed).** `guardedFetch` accepts an optional `timeoutMs` (defaulting to the single authoritative `REQUEST_TIMEOUT_MS`); `fetchWithReliability` passes `ValidationOptions.timeoutMs` through, and the CLI derives its default from the same constant instead of hardcoding. A regression test proves the configured timeout reaches the abort signal.
- **`unsafe_url` transport classification implemented.** `transportStatusFromOutcome` now maps SSRF/policy rejections (private IPs, disallowed ports, credentials, invalid URLs) to `unsafe_url` instead of `network_error`; covered by a test asserting no fetch is attempted.
- **304 handling fixed in `guardedFetch`.** HTTP 304 is no longer treated as a redirect; conditional-request behavior (If-None-Match/If-Modified-Since, parse-state inheritance) is covered by tests.
- **`scripts/apply-live-feed-statuses.mjs` rewritten.** Logic moved to `backend/src/apply-feed-statuses.ts` (+ CLI, + tests); the `.mjs` is a thin `tsx` wrapper. It applies `operationalStatus` (never raw `status`), fails closed on old/malformed reports, preserves existing catalog statuses on WAF-challenge or transient observations (HTTP 401/403, HTML interstitials such as the DVIDS 202 challenge, timeouts, network errors, redirect loops), drops the obsolete `discoveredUrl` handling, supports `--dry-run`, and refuses anomalously large blocked-transition sets (>= 10 and >= 5% of considered results) unless `--allow-mass-block` is given.
