import type { Feed } from "./feeds.js";
import { parseRssXml, type RssEntry } from "./rss-parser.js";
import { guardedFetch, type GuardedFetchResult } from "./url-security.js";

export type FeedType =
  "alert" | "news" | "event" | "schedule" | "dataset_update" | "low_frequency" | "archive";

export type TransportStatus =
  | "ok"
  | "timeout"
  | "network_error"
  | "blocked"
  | "not_found"
  | "too_many_redirects"
  | "unsafe_url";

export type ParseStatus =
  "ok" | "empty" | "unparseable" | "unsupported_format" | "schema_error" | "not_attempted";

export type FreshnessStatus =
  "current" | "stale" | "archive" | "low_frequency" | "future_event" | "unknown";

export type OperationalStatus =
  | "healthy"
  | "empty"
  | "stale"
  | "archive"
  | "low_frequency"
  | "duplicate"
  | "blocked"
  | "unsupported";

export interface FeedValidationResult {
  id: string;
  name: string;
  category: string;
  rssUrl: string;
  status: "working" | "blocked";
  previousStatus: "working" | "blocked" | "unverified";
  operationalStatus: OperationalStatus;
  transportStatus: TransportStatus;
  httpStatus: number | null;
  contentType: string | null;
  parseStatus: ParseStatus;
  entryCount: number;
  freshnessStatus: FreshnessStatus;
  newestItemDate: string | null;
  canonicalUrl: string | null;
  duplicateOf: string | null;
  finalUrl: string | null;
  format: string;
  responseTimeMs: number;
  attempts: number;
  failureReason: string | null;
  error: string | null;
  etag: string | null;
  lastModified: string | null;
}

export interface ValidationOptions {
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  perHostConcurrency: number;
  globalConcurrency: number;
  previousReport?: ValidationReport;
}

export interface ValidationReport {
  validatedAt: string;
  selected: number;
  totalConfigured: number;
  uniqueConfiguredUrls: number;
  uniqueCanonicalUrls: number;
  working: number;
  blocked: number;
  transport: Record<string, number>;
  parse: Record<string, number>;
  freshness: Record<string, number>;
  operational: Record<string, number>;
  blockedByReason: Record<string, number>;
  duplicateGroups: Array<{ canonicalUrl: string; ids: string[] }>;
  newlyBlocked: string[];
  recovered: string[];
  redirectChanges: Array<{ id: string; old: string | null; new: string | null }>;
  formatChanges: Array<{ id: string; old: string | null; new: string | null }>;
  freshnessRegressions: string[];
  slowest: Array<{ id: string; responseTimeMs: number }>;
  byHost: Record<string, number>;
  byCategory: Record<string, number>;
  results: FeedValidationResult[];
}

export interface FetchOutcome {
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
  notModified: boolean;
  responseTimeMs: number;
}

export interface ReliabilityOptions {
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  perHostConcurrency: number;
  previousEtag?: string;
  previousLastModified?: string;
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

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; CivicFeed-FeedValidator/1.0; +https://civicfeed.local/validator)";

export function classifyFeedType(feed: Feed): FeedType {
  const text =
    `${feed.category} ${feed.subCategory} ${feed.contentType} ${feed.updateFrequency} ${feed.tags.join(" ")}`.toLowerCase();
  if (/\b(archive|historical|records)\b/.test(text)) return "archive";
  if (/\b(event|hearing|oral argument|argument)\b/.test(text)) return "event";
  if (/\b(schedule|calendar|docket)\b/.test(text)) return "schedule";
  if (
    /\b(alert|warning|advisory|notification|weather|safety|emergency|tsunami|hurricane|tornado|flood|fire|quake)\b/.test(
      text
    )
  )
    return "alert";
  if (/\b(dataset|data|statistics|indicator|report)\b/.test(text)) return "dataset_update";
  if (/\b(monthly|quarterly|annual|yearly|low.frequency|bimonthly|semiannual)\b/.test(text))
    return "low_frequency";
  return "news";
}

export function classifyFormat(xmlText: string): string {
  const text = xmlText.slice(0, 5000).toLowerCase();
  if (text.includes("<rss")) return "RSS";
  if (text.includes("<feed")) return "Atom";
  if (text.includes("<rdf:rdf")) return "RDF RSS";
  if (text.includes("<alert") && text.includes("<identifier")) return "CAP XML";
  if (text.includes("<item")) return "HTML-embedded RSS";
  return "Unknown";
}

export function normalizeCanonicalUrl(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.pathname = u.pathname.replace(/\/+$/, "");
  u.hash = "";
  return u.toString();
}

export function evaluateParse(text: string, feedId: string, feedName: string) {
  const format = classifyFormat(text);
  if (format === "Unknown") {
    return {
      parseStatus: "unparseable" as ParseStatus,
      entries: [] as RssEntry[],
      entryCount: 0,
      format,
    };
  }
  const entries = parseRssXml(text, feedId, feedName);
  if (entries.length === 0) {
    return {
      parseStatus: "empty" as ParseStatus,
      entries,
      entryCount: 0,
      format,
    };
  }
  return {
    parseStatus: "ok" as ParseStatus,
    entries,
    entryCount: entries.length,
    format,
  };
}

export function evaluateFreshness(
  newestDate: Date | null,
  feedType: FeedType,
  now = new Date()
): { freshnessStatus: FreshnessStatus; futureDated: boolean } {
  if (!newestDate || Number.isNaN(newestDate.getTime())) {
    return { freshnessStatus: "unknown", futureDated: false };
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = (now.getTime() - newestDate.getTime()) / msPerDay;
  const futureDated = daysDiff < -1;

  if (feedType === "event" || feedType === "schedule") {
    return {
      freshnessStatus: futureDated ? "future_event" : "current",
      futureDated,
    };
  }

  if (futureDated) {
    return { freshnessStatus: "stale", futureDated: true };
  }

  const threshold = FRESHNESS_THRESHOLDS_DAYS[feedType];
  if (threshold === null) {
    return { freshnessStatus: "current", futureDated: false };
  }
  if (daysDiff <= threshold) {
    return { freshnessStatus: "current", futureDated: false };
  }
  if (feedType === "archive") {
    return { freshnessStatus: "archive", futureDated: false };
  }
  if (feedType === "low_frequency") {
    return { freshnessStatus: "low_frequency", futureDated: false };
  }
  return { freshnessStatus: "stale", futureDated: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const base = 500 * 2 ** attempt;
  const capped = Math.min(base, 4000);
  return Math.floor(Math.random() * capped);
}

function buildHeaders(options: ReliabilityOptions): HeadersInit {
  const headers = new Headers();
  headers.set("User-Agent", options.userAgent);
  headers.set(
    "Accept",
    "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
  );
  if (options.previousEtag) headers.set("If-None-Match", options.previousEtag);
  if (options.previousLastModified) headers.set("If-Modified-Since", options.previousLastModified);
  return headers;
}

function isRetryable(result: GuardedFetchResult): boolean {
  if (result.timedOut) return true;
  if (result.status >= 500 && result.status < 600) return true;
  if ([408, 429, 502, 503, 504].includes(result.status)) return true;
  if (result.status === 0) {
    const error = result.error || "";
    if (/unsafe|private|invalid|blocked|not allowed|could not resolve/i.test(error)) {
      return false;
    }
    return true;
  }
  return false;
}

function mapToOutcome(
  result: GuardedFetchResult,
  attempts: number,
  responseTimeMs: number
): FetchOutcome {
  return {
    ok: result.ok,
    status: result.status,
    text: result.text,
    finalUrl: result.finalUrl,
    contentType: result.contentType,
    etag: result.etag,
    lastModified: result.lastModified,
    attempts,
    error: result.error || null,
    timedOut: result.timedOut,
    notModified: result.status === 304,
    responseTimeMs,
  };
}

export class HostSemaphore {
  private queues = new Map<string, Array<() => void>>();
  private running = new Map<string, number>();
  constructor(private limit: number) {}

  async acquire(host: string): Promise<() => void> {
    return new Promise((resolve) => {
      const run = () => {
        this.running.set(host, (this.running.get(host) || 0) + 1);
        resolve(() => this.release(host));
      };
      if ((this.running.get(host) || 0) < this.limit) {
        run();
      } else {
        const q = this.queues.get(host) || [];
        q.push(run);
        this.queues.set(host, q);
      }
    });
  }

  private release(host: string) {
    const count = Math.max(0, (this.running.get(host) || 1) - 1);
    this.running.set(host, count);
    const q = this.queues.get(host);
    if (q && q.length > 0) {
      q.shift()!();
    }
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function fetchWithReliability(
  url: string,
  options: ReliabilityOptions,
  hostSemaphore: HostSemaphore
): Promise<FetchOutcome> {
  const host = new URL(url).hostname;
  const release = await hostSemaphore.acquire(host);
  const start = Date.now();
  try {
    let lastResult: GuardedFetchResult | undefined;
    let attempts = 0;
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = backoffMs(attempt - 1);
        await sleep(delay);
      }
      attempts += 1;
      const headers = buildHeaders(options);
      const result = await guardedFetch(url, headers, "GET", options.timeoutMs);
      lastResult = result;
      if (result.ok || result.status === 304) {
        return mapToOutcome(result, attempts, Date.now() - start);
      }
      if (!isRetryable(result)) {
        break;
      }
    }
    return mapToOutcome(lastResult!, attempts, Date.now() - start);
  } finally {
    release();
  }
}

function transportStatusFromOutcome(outcome: FetchOutcome): TransportStatus {
  if (outcome.ok || outcome.notModified) return "ok";
  if (outcome.timedOut) return "timeout";
  if (outcome.status === 404) return "not_found";
  if (outcome.status === 403 || outcome.status === 401) return "blocked";
  if (outcome.status === 0 && /too many redirects/i.test(outcome.error || ""))
    return "too_many_redirects";
  if (outcome.status >= 300 && outcome.status < 400) return "too_many_redirects";
  if (outcome.status === 0 && /unsafe|private|not allowed|invalid url/i.test(outcome.error || ""))
    return "unsafe_url";
  if (outcome.status === 0) return "network_error";
  return "blocked";
}

function deriveOperationalStatus(result: FeedValidationResult): OperationalStatus {
  if (result.duplicateOf) {
    if (result.transportStatus !== "ok") return "blocked";
    if (result.parseStatus !== "ok" && result.parseStatus !== "empty") return "blocked";
    return "duplicate";
  }
  if (result.transportStatus !== "ok") return "blocked";
  if (result.parseStatus === "empty") return "empty";
  if (result.parseStatus !== "ok") return "blocked";
  if (result.freshnessStatus === "stale") return "stale";
  if (result.freshnessStatus === "archive") return "archive";
  if (result.freshnessStatus === "low_frequency") return "low_frequency";
  return "healthy";
}

function deriveLegacyStatus(operationalStatus: OperationalStatus): "working" | "blocked" {
  switch (operationalStatus) {
    case "healthy":
    case "empty":
    case "stale":
    case "archive":
    case "low_frequency":
    case "duplicate":
      return "working";
    default:
      return "blocked";
  }
}

function buildFailureReason(result: FeedValidationResult): string | null {
  if (result.duplicateOf) return `Duplicate of ${result.duplicateOf}`;
  if (result.transportStatus !== "ok") return result.error || `Transport ${result.transportStatus}`;
  if (result.parseStatus === "empty") return "Feed is reachable and valid but contains no entries";
  if (result.parseStatus !== "ok") return "No parseable entries returned";
  if (result.freshnessStatus === "stale") return "Newest item is older than freshness threshold";
  return null;
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function buildReport(
  results: FeedValidationResult[],
  previousReport?: ValidationReport
): ValidationReport {
  const sortedResults = [...results].sort((a, b) => a.id.localeCompare(b.id));
  const configuredUrls = new Set(results.map((r) => r.rssUrl));
  const canonicalUrls = new Set(results.map((r) => r.canonicalUrl).filter(Boolean));

  const previousById = new Map<string, FeedValidationResult>();
  if (previousReport) {
    for (const r of previousReport.results) previousById.set(r.id, r);
  }

  const duplicateGroups: Array<{ canonicalUrl: string; ids: string[] }> = [];
  const byCanonical = new Map<string, string[]>();
  for (const r of sortedResults) {
    if (!r.canonicalUrl) continue;
    const list = byCanonical.get(r.canonicalUrl) || [];
    list.push(r.id);
    byCanonical.set(r.canonicalUrl, list);
  }
  for (const [canonicalUrl, ids] of [...byCanonical.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    if (ids.length > 1) {
      duplicateGroups.push({ canonicalUrl, ids: ids.sort((a, b) => a.localeCompare(b)) });
    }
  }

  const newlyBlocked: string[] = [];
  const recovered: string[] = [];
  const redirectChanges: Array<{ id: string; old: string | null; new: string | null }> = [];
  const formatChanges: Array<{ id: string; old: string | null; new: string | null }> = [];
  const freshnessRegressions: string[] = [];

  for (const r of sortedResults) {
    const prev = previousById.get(r.id);
    if (prev) {
      if (prev.status === "working" && r.status === "blocked") newlyBlocked.push(r.id);
      if (prev.status === "blocked" && r.status === "working") recovered.push(r.id);
      if (prev.finalUrl !== r.finalUrl) {
        redirectChanges.push({ id: r.id, old: prev.finalUrl, new: r.finalUrl });
      }
      if (prev.format !== r.format) {
        formatChanges.push({ id: r.id, old: prev.format, new: r.format });
      }
      if (prev.freshnessStatus === "current" && r.freshnessStatus === "stale") {
        freshnessRegressions.push(r.id);
      }
    } else {
      if (r.previousStatus === "working" && r.status === "blocked") newlyBlocked.push(r.id);
      if (r.previousStatus === "blocked" && r.status === "working") recovered.push(r.id);
    }
  }

  const blockedByReason: Record<string, number> = {};
  for (const r of sortedResults) {
    if (r.status === "blocked" && r.failureReason) {
      blockedByReason[r.failureReason] = (blockedByReason[r.failureReason] || 0) + 1;
    }
  }

  const byHost: Record<string, number> = {};
  for (const r of sortedResults) {
    if (!r.canonicalUrl) continue;
    try {
      const host = new URL(r.canonicalUrl).hostname;
      byHost[host] = (byHost[host] || 0) + 1;
    } catch {
      // ignore malformed URLs
    }
  }

  const byCategory = countBy(sortedResults.map((r) => r.category));

  const slowest = [...sortedResults]
    .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
    .slice(0, 20)
    .map((r) => ({ id: r.id, responseTimeMs: r.responseTimeMs }));

  return {
    validatedAt: new Date().toISOString(),
    selected: sortedResults.length,
    totalConfigured: sortedResults.length,
    uniqueConfiguredUrls: configuredUrls.size,
    uniqueCanonicalUrls: canonicalUrls.size,
    working: sortedResults.filter((r) => r.status === "working").length,
    blocked: sortedResults.filter((r) => r.status === "blocked").length,
    transport: countBy(sortedResults.map((r) => r.transportStatus)),
    parse: countBy(sortedResults.map((r) => r.parseStatus)),
    freshness: countBy(sortedResults.map((r) => r.freshnessStatus)),
    operational: countBy(sortedResults.map((r) => r.operationalStatus)),
    blockedByReason,
    duplicateGroups,
    newlyBlocked: newlyBlocked.sort((a, b) => a.localeCompare(b)),
    recovered: recovered.sort((a, b) => a.localeCompare(b)),
    redirectChanges: redirectChanges.sort((a, b) => a.id.localeCompare(b.id)),
    formatChanges: formatChanges.sort((a, b) => a.id.localeCompare(b.id)),
    freshnessRegressions: freshnessRegressions.sort((a, b) => a.localeCompare(b)),
    slowest,
    byHost,
    byCategory,
    results: sortedResults,
  };
}

export async function validateFeeds(
  feeds: Feed[],
  options: ValidationOptions
): Promise<{ results: FeedValidationResult[]; report: ValidationReport }> {
  const hostSemaphore = new HostSemaphore(options.perHostConcurrency);
  const previousById = new Map<string, FeedValidationResult>();
  if (options.previousReport) {
    for (const r of options.previousReport.results) previousById.set(r.id, r);
  }

  // Fetch each unique configured URL exactly once. Canonical URLs are resolved
  // from the GET response's final URL, so no separate HEAD pass is needed.
  const uniqueUrls = [...new Set(feeds.map((feed) => feed.rssUrl))];
  const outcomeByUrl = new Map<string, FetchOutcome>();
  await runWithConcurrency(uniqueUrls, options.globalConcurrency, async (url) => {
    const feed = feeds.find((f) => f.rssUrl === url)!;
    const prev = previousById.get(feed.id);
    const outcome = await fetchWithReliability(
      url,
      {
        userAgent: options.userAgent,
        timeoutMs: options.timeoutMs,
        maxRetries: options.maxRetries,
        perHostConcurrency: options.perHostConcurrency,
        previousEtag: prev?.etag ?? undefined,
        previousLastModified: prev?.lastModified ?? undefined,
      },
      hostSemaphore
    );
    outcomeByUrl.set(url, outcome);
  });

  const feedToCanonical = new Map<string, string>();
  const groups = new Map<string, Feed[]>();
  for (const feed of feeds) {
    const outcome = outcomeByUrl.get(feed.rssUrl)!;
    const canonical = normalizeCanonicalUrl(outcome.finalUrl || feed.rssUrl);
    feedToCanonical.set(feed.id, canonical);
    if (!groups.has(canonical)) groups.set(canonical, []);
    groups.get(canonical)!.push(feed);
  }

  const representativeByCanonical = new Map<string, Feed>();
  for (const feed of feeds) {
    const canonical = feedToCanonical.get(feed.id)!;
    if (!representativeByCanonical.has(canonical)) {
      representativeByCanonical.set(canonical, feed);
    }
  }

  const results: FeedValidationResult[] = [];
  const now = new Date();

  for (const feed of feeds) {
    const canonical = feedToCanonical.get(feed.id)!;
    const rep = representativeByCanonical.get(canonical)!;
    const outcome = outcomeByUrl.get(feed.rssUrl)!;
    const isRepresentative = feed.id === rep.id;
    const previousResult = previousById.get(feed.id);

    const transportStatus = transportStatusFromOutcome(outcome);
    const httpStatus = outcome.status;
    const contentType = outcome.contentType;
    const finalUrl = outcome.finalUrl;
    const attempts = outcome.attempts;
    const error = outcome.error;
    const etag = outcome.etag;
    const lastModified = outcome.lastModified;

    let parseStatus: ParseStatus = "not_attempted";
    let entryCount = 0;
    let format = "Unknown";
    let newestItemDate: string | null = null;

    if (outcome.notModified && previousResult) {
      parseStatus = previousResult.parseStatus;
      entryCount = previousResult.entryCount;
      format = previousResult.format;
      newestItemDate = previousResult.newestItemDate;
    } else if (outcome.ok) {
      const parsed = evaluateParse(outcome.text, feed.id, feed.shortName);
      parseStatus = parsed.parseStatus;
      entryCount = parsed.entryCount;
      format = parsed.format;
      if (parsed.entries.length > 0) {
        const dates = parsed.entries
          .map((e) => new Date(e.pubDate))
          .filter((d) => !Number.isNaN(d.getTime()));
        if (dates.length > 0) {
          dates.sort((a, b) => b.getTime() - a.getTime());
          newestItemDate = dates[0]!.toISOString();
        }
      }
    }

    const feedType = classifyFeedType(feed);
    const freshness = evaluateFreshness(
      newestItemDate ? new Date(newestItemDate) : null,
      feedType,
      now
    );

    const base: FeedValidationResult = {
      id: feed.id,
      name: feed.name,
      category: feed.category,
      rssUrl: feed.rssUrl,
      previousStatus: feed.status,
      transportStatus,
      httpStatus,
      contentType,
      parseStatus,
      entryCount,
      freshnessStatus: freshness.freshnessStatus,
      newestItemDate,
      canonicalUrl: canonical,
      duplicateOf: isRepresentative ? null : rep.id,
      finalUrl,
      format,
      responseTimeMs: outcome.responseTimeMs,
      attempts,
      failureReason: null,
      error,
      etag,
      lastModified,
      operationalStatus: "healthy",
      status: "working",
    };

    base.operationalStatus = deriveOperationalStatus(base);
    base.status = deriveLegacyStatus(base.operationalStatus);
    base.failureReason = buildFailureReason(base);
    results.push(base);
  }

  const sortedResults = results.sort((a, b) => a.id.localeCompare(b.id));
  const report = buildReport(sortedResults, options.previousReport);
  return { results: sortedResults, report };
}
