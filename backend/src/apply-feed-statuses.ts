import type { OperationalStatus, ParseStatus, TransportStatus } from "./feed-validator.js";

export type CatalogStatus = "working" | "blocked" | "unverified";

/** The subset of a FeedValidationResult that status application depends on. */
export interface ApplyObservation {
  id: string;
  operationalStatus: OperationalStatus;
  transportStatus: TransportStatus;
  httpStatus: number | null;
  parseStatus: ParseStatus;
  contentType: string | null;
}

export interface ApplyChange {
  id: string;
  from: CatalogStatus;
  to: CatalogStatus;
}

export interface ApplyPreservation {
  id: string;
  reason: string;
}

export interface ApplyPlan {
  considered: number;
  changes: ApplyChange[];
  preserved: ApplyPreservation[];
  ignored: string[];
}

const OPERATIONAL_STATUSES: ReadonlySet<string> = new Set([
  "healthy",
  "empty",
  "stale",
  "archive",
  "low_frequency",
  "duplicate",
  "blocked",
  "unsupported",
]);

/**
 * Validates an untrusted report payload into observations. Fails closed: any
 * result without a valid operationalStatus (e.g. an old-schema report that
 * only carries the derived `status` field) rejects the whole report rather
 * than falling back to the raw observed status.
 */
export function parseReport(report: unknown): ApplyObservation[] {
  if (typeof report !== "object" || report === null) {
    throw new Error("Validation report is not an object");
  }
  const { validatedAt, results } = report as { validatedAt?: unknown; results?: unknown };
  if (typeof validatedAt !== "string" || validatedAt.length === 0) {
    throw new Error("Validation report is missing validatedAt (not a feed-validator report?)");
  }
  if (!Array.isArray(results)) {
    throw new Error("Validation report is missing a results array");
  }
  return results.map((entry, index) => {
    const r = entry as Partial<ApplyObservation> & { status?: unknown };
    if (typeof r?.id !== "string" || r.id.length === 0) {
      throw new Error(`results[${index}] is missing an id`);
    }
    if (typeof r.operationalStatus !== "string" || !OPERATIONAL_STATUSES.has(r.operationalStatus)) {
      throw new Error(
        `results[${index}] (${r.id}) has no valid operationalStatus; refusing to fall back to raw status (old or malformed report)`
      );
    }
    return {
      id: r.id,
      operationalStatus: r.operationalStatus,
      transportStatus: r.transportStatus ?? "network_error",
      httpStatus: typeof r.httpStatus === "number" ? r.httpStatus : null,
      parseStatus: r.parseStatus ?? "not_attempted",
      contentType: typeof r.contentType === "string" ? r.contentType : null,
    };
  });
}

function targetStatus(operationalStatus: OperationalStatus): "working" | "blocked" {
  switch (operationalStatus) {
    case "blocked":
    case "unsupported":
      return "blocked";
    default:
      return "working";
  }
}

/**
 * Returns a human-readable reason when an observation looks like a WAF/bot
 * challenge or a transient failure rather than a genuine permanent outage, or
 * null when the observation is trustworthy. Such observations must never flip
 * a non-blocked feed to blocked.
 *
 * Covers both challenge shapes seen in the wild:
 * - transport "blocked" (HTTP 401/403, e.g. Cloudflare 403), and
 * - transport "ok" with an HTML interstitial that parses as unparseable
 *   (e.g. the DVIDS 202 + text/html challenge page).
 */
export function challengeOrTransientReason(obs: ApplyObservation): string | null {
  if (obs.transportStatus === "blocked") {
    return `HTTP ${obs.httpStatus ?? "401/403"} challenge (likely WAF/bot protection)`;
  }
  if (
    obs.transportStatus === "timeout" ||
    obs.transportStatus === "network_error" ||
    obs.transportStatus === "too_many_redirects"
  ) {
    return `Transient transport failure (${obs.transportStatus})`;
  }
  if (
    obs.transportStatus === "ok" &&
    obs.parseStatus === "unparseable" &&
    obs.contentType !== null &&
    obs.contentType.toLowerCase().includes("html")
  ) {
    return `HTML interstitial instead of feed content (likely WAF challenge, HTTP ${obs.httpStatus ?? "?"})`;
  }
  return null;
}

/**
 * Plans catalog status transitions from validated observations. Keys off
 * operationalStatus only; challenge/transient observations preserve the
 * existing catalog status instead of blocking.
 */
export function planStatusUpdates(
  observations: ApplyObservation[],
  currentStatuses: Map<string, CatalogStatus>
): ApplyPlan {
  const changes: ApplyChange[] = [];
  const preserved: ApplyPreservation[] = [];
  const ignored: string[] = [];

  for (const obs of [...observations].sort((a, b) => a.id.localeCompare(b.id))) {
    const current = currentStatuses.get(obs.id);
    if (!current) {
      ignored.push(obs.id);
      continue;
    }
    const target = targetStatus(obs.operationalStatus);
    if (target === current) continue;
    if (target === "blocked" && current !== "blocked") {
      const reason = challengeOrTransientReason(obs);
      if (reason) {
        preserved.push({ id: obs.id, reason });
        continue;
      }
    }
    changes.push({ id: obs.id, from: current, to: target });
  }

  return { considered: observations.length, changes, preserved, ignored };
}

/**
 * Mass-change safeguard: returns true when the number of working-to-blocked
 * transitions is anomalously large for the catalog size (at least 10 feeds
 * and at least 5% of considered results). Callers must require an explicit
 * override before applying such a plan.
 */
export function exceedsMassChangeGuard(blockedTransitions: number, considered: number): boolean {
  const threshold = Math.max(10, Math.ceil(considered * 0.05));
  return blockedTransitions >= threshold;
}

export function summarizePlan(plan: ApplyPlan): {
  considered: number;
  toBlocked: number;
  toWorking: number;
  preserved: number;
  unchanged: number;
  ignored: number;
} {
  const toBlocked = plan.changes.filter((c) => c.to === "blocked").length;
  const toWorking = plan.changes.filter((c) => c.to === "working").length;
  return {
    considered: plan.considered,
    toBlocked,
    toWorking,
    preserved: plan.preserved.length,
    unchanged: plan.considered - plan.changes.length - plan.preserved.length - plan.ignored.length,
    ignored: plan.ignored.length,
  };
}

/** Matches a single feed literal in feeds.ts (feed objects contain no nested braces). */
const FEED_LITERAL_PATTERN = /\{[^{}]*?id:\s*"(feed-\d{3})"[^{}]*?\}/g;
const STATUS_FIELD_PATTERN = /status:\s*"(?:working|blocked|unverified)" as const/;
const STATUS_COUNT_PATTERN = /status:\s*"(working|blocked|unverified)" as const/g;

/** Applies a plan to the feeds.ts source text and recomputes feedStats.byStatus. */
export function applyPlanToSource(
  source: string,
  plan: ApplyPlan
): { source: string; changed: number } {
  const changeById = new Map(plan.changes.map((c) => [c.id, c.to]));
  if (changeById.size === 0) {
    return { source, changed: 0 };
  }

  let changed = 0;
  let updated = source.replace(FEED_LITERAL_PATTERN, (feedLiteral, id: string) => {
    const nextStatus = changeById.get(id);
    if (!nextStatus) return feedLiteral;
    const replaced = feedLiteral.replace(STATUS_FIELD_PATTERN, `status: "${nextStatus}" as const`);
    if (replaced !== feedLiteral) changed += 1;
    return replaced;
  });

  const statusCounts = { unverified: 0, working: 0, blocked: 0 };
  for (const match of updated.matchAll(STATUS_COUNT_PATTERN)) {
    statusCounts[match[1] as keyof typeof statusCounts] += 1;
  }
  updated = updated.replace(
    /byStatus:\s*\{\s*unverified:\s*\d+,\s*working:\s*\d+,\s*blocked:\s*\d+\s*\}/,
    `byStatus: { unverified: ${statusCounts.unverified}, working: ${statusCounts.working}, blocked: ${statusCounts.blocked} }`
  );

  return { source: updated, changed };
}
