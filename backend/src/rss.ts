import { guardedFetch } from "./url-security.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { RssEntry, parseRssXml } from "./rss-parser.js";

export type { RssEntry };

export interface FetchResult {
  entries: RssEntry[];
  error: string | null;
}

export interface FeedFetchStatus {
  feedId: string;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  attemptCount: number;
  successCount: number;
  failureCount: number;
  nextFetchAt: number | null;
}

const SUCCESS_INTERVAL_MS = 15 * 60 * 1000;
const FAILURE_INTERVAL_MS = 5 * 60 * 1000;

const MAX_RETRIES = 2; // 1 initial attempt + 2 retries = 3 total
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 4_000;

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 5 * 60 * 1000;

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailureAt: number | null;
  openedAt: number | null;
}

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(feedId: string): CircuitBreaker {
  let cb = circuitBreakers.get(feedId);
  if (!cb) {
    cb = { state: "closed", failures: 0, lastFailureAt: null, openedAt: null };
    circuitBreakers.set(feedId, cb);
  }
  return cb;
}

function shouldAllow(cb: CircuitBreaker, now = Date.now()): boolean {
  if (cb.state === "closed") return true;
  if (cb.state === "open") {
    if (cb.openedAt && now - cb.openedAt >= CIRCUIT_OPEN_MS) {
      cb.state = "half-open";
      logger.info("circuit breaker half-open", { state: "half-open" });
      return true;
    }
    return false;
  }
  // half-open: allow a single probe request
  return true;
}

function recordCircuitSuccess(cb: CircuitBreaker, feedId: string) {
  if (cb.state !== "closed") {
    logger.info("circuit breaker closed", { feedId });
  }
  cb.state = "closed";
  cb.failures = 0;
  cb.lastFailureAt = null;
  cb.openedAt = null;
}

function recordCircuitFailure(cb: CircuitBreaker, feedId: string, now = Date.now()) {
  cb.failures += 1;
  cb.lastFailureAt = now;

  if (cb.state === "half-open") {
    cb.state = "open";
    cb.openedAt = now;
    logger.warn("circuit breaker opened after half-open failure", {
      feedId,
      failures: cb.failures,
    });
    return;
  }

  if (cb.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    cb.state = "open";
    cb.openedAt = now;
    logger.warn("circuit breaker opened", { feedId, failures: cb.failures });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  // Exponential backoff with full jitter: 500ms, 1000ms, 2000ms, capped at 4s.
  const base = RETRY_BASE_MS * 2 ** attempt;
  const capped = Math.min(base, RETRY_MAX_MS);
  return Math.floor(Math.random() * capped);
}

export function recordFeedSuccess(feedId: string, now = Date.now()) {
  const stmt = db.prepare(`
    INSERT INTO feed_fetch_status (feed_id, last_success_at, attempt_count, success_count, next_fetch_at)
    VALUES (?, ?, 1, 1, ?)
    ON CONFLICT(feed_id) DO UPDATE SET
      last_success_at = excluded.last_success_at,
      attempt_count = attempt_count + 1,
      success_count = success_count + 1,
      next_fetch_at = excluded.next_fetch_at,
      last_error_message = NULL
  `);
  stmt.run(feedId, now, now + SUCCESS_INTERVAL_MS);
}

export function recordFeedFailure(feedId: string, errorMessage: string, now = Date.now()) {
  const stmt = db.prepare(`
    INSERT INTO feed_fetch_status (feed_id, last_error_at, last_error_message, attempt_count, failure_count, next_fetch_at)
    VALUES (?, ?, ?, 1, 1, ?)
    ON CONFLICT(feed_id) DO UPDATE SET
      last_error_at = excluded.last_error_at,
      last_error_message = excluded.last_error_message,
      attempt_count = attempt_count + 1,
      failure_count = failure_count + 1,
      next_fetch_at = excluded.next_fetch_at
  `);
  stmt.run(feedId, now, errorMessage, now + FAILURE_INTERVAL_MS);
}

function validateFeedClientSide(entries: RssEntry[], feedId: string) {
  const seenIds = new Set<string>();
  const now = Date.now();
  const issues: string[] = [];

  for (const entry of entries) {
    if (!entry.title || entry.title.trim().length === 0) {
      issues.push(`Entry ${entry.id} has empty title`);
    }
    if (!entry.link || entry.link.trim().length === 0) {
      issues.push(`Entry ${entry.id} has empty link`);
    }
    if (seenIds.has(entry.id)) {
      issues.push(`Duplicate entry id: ${entry.id}`);
    }
    seenIds.add(entry.id);
    const pubTime = new Date(entry.pubDate).getTime();
    if (!isNaN(pubTime) && pubTime > now + 10 * 60 * 1000) {
      issues.push(`Entry ${entry.id} has future date: ${entry.pubDate}`);
    }
  }

  if (issues.length > 0) {
    logger.warn("feed validation issues", { feedId, issues: issues.slice(0, 5) });
  }
}

/**
 * Fetch an RSS/Atom feed with retry, circuit breaker, and structured logging.
 *
 * - Retries transient failures (network errors, 5xx, timeouts) up to MAX_RETRIES
 *   with exponential backoff + jitter.
 * - Opens a circuit breaker after CIRCUIT_FAILURE_THRESHOLD consecutive failures,
 *   short-circuiting subsequent calls for CIRCUIT_OPEN_MS.
 * - Records success/failure in feed_fetch_status for scheduler backoff.
 */
export async function fetchFeed(
  url: string,
  feedId: string,
  feedName: string
): Promise<FetchResult> {
  const cb = getCircuitBreaker(feedId);
  const now = Date.now();

  if (!shouldAllow(cb, now)) {
    const remainingMs = (cb.openedAt ?? now) + CIRCUIT_OPEN_MS - now;
    const message = `Circuit breaker open for feed ${feedId} (${Math.ceil(remainingMs / 1000)}s remaining)`;
    logger.warn("feed fetch circuit breaker open", { feedId, remainingMs });
    recordFeedFailure(feedId, message, now);
    return { entries: [], error: message };
  }

  logger.info("feed fetch attempt", { feedId, url });

  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = backoffMs(attempt - 1);
      logger.info("feed fetch retry", { feedId, attempt, delayMs: delay });
      await sleep(delay);
    }

    const fetchResult = await guardedFetch(url);

    if (fetchResult.ok) {
      const entries = parseRssXml(fetchResult.text, feedId, feedName);
      if (entries.length === 0) {
        const message = "No entries parsed";
        logger.warn("feed fetch returned no entries", { feedId });
        lastError = message;
        continue; // retry in case we got a partial/bad response
      }

      recordFeedSuccess(feedId, now);
      recordCircuitSuccess(cb, feedId);
      validateFeedClientSide(entries, feedId);
      logger.info("feed fetch success", { feedId, entryCount: entries.length });
      return { entries, error: null };
    }

    lastError = fetchResult.error || `HTTP ${fetchResult.status}`;
    const isRetryable =
      fetchResult.status >= 500 ||
      fetchResult.status === 429 ||
      fetchResult.status === 408 ||
      fetchResult.status === 0;

    logger.warn("feed fetch attempt failed", {
      feedId,
      attempt,
      status: fetchResult.status,
      error: lastError,
      retryable: isRetryable,
    });

    if (!isRetryable) {
      break; // client errors are not retryable
    }
  }

  recordFeedFailure(feedId, lastError, now);
  recordCircuitFailure(cb, feedId, now);
  logger.warn("feed fetch failed after retries", {
    feedId,
    error: lastError,
    attempts: MAX_RETRIES + 1,
  });
  return { entries: [], error: lastError };
}

/** Reset circuit-breaker state; useful in tests. */
export function resetCircuitBreaker(feedId: string) {
  circuitBreakers.delete(feedId);
}

/** Export for tests and observability. */
export function getCircuitBreakerState(feedId: string): CircuitBreaker | undefined {
  return circuitBreakers.get(feedId);
}
