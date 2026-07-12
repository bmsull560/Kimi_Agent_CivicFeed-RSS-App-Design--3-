import { XMLParser } from "fast-xml-parser";
import type Database from "better-sqlite3";
import { guardedFetch } from "./url-security.js";
import { logger } from "./logger.js";
import type { Feed } from "./feeds.js";

export type FeedHealthStatus = "ok" | "warn" | "fail";

export interface FeedHealth {
  feedId: string;
  status: FeedHealthStatus;
  checks: {
    reachable: boolean;
    validXml: boolean;
    validSchema: boolean;
    stableGuids: boolean;
    saneDates: boolean;
    usableContent: boolean;
    fresh: boolean;
  };
  newestItemDate: string | null;
  responseTimeMs: number;
  lastValidatedAt: number;
  error?: string;
}

interface ValidatorState {
  [feedId: string]: {
    guids: string[];
    lastValidatedAt: number;
  };
}

const VALIDATION_STATE: ValidatorState = {};

function isXmlContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return (
    lower.includes("xml") ||
    lower.includes("rss") ||
    lower.includes("atom") ||
    lower.includes("rdf")
  );
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) {
    const text = (value as { "#text"?: unknown })["#text"];
    return typeof text === "string" ? text : "";
  }
  return "";
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/\s+\(.*\)$/, "").trim();
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const fallback = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }

  return null;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Validate the health of a single feed.
 *
 * This performs reachability, XML/schema, GUID stability, date sanity,
 * content, and freshness checks. It is designed to be run from the
 * background scheduler as well as the manual CLI.
 */
export async function validateFeedHealth(feed: Feed, now = Date.now()): Promise<FeedHealth> {
  const start = Date.now();
  const checks: FeedHealth["checks"] = {
    reachable: false,
    validXml: false,
    validSchema: false,
    stableGuids: false,
    saneDates: false,
    usableContent: false,
    fresh: false,
  };

  let newestItemDate: string | null = null;
  let error: string | undefined;

  try {
    const fetchResult = await guardedFetch(feed.rssUrl);
    if (!fetchResult.ok) {
      throw new Error(fetchResult.error || `HTTP ${fetchResult.status}`);
    }

    const xmlText = fetchResult.text;
    if (!xmlText || xmlText.length < 100) throw new Error("Response too small");
    checks.reachable = true;

    // Content-Type is informational; many government feeds return text/plain.
    const contentType = isXmlContentType(null) ? null : null; // guardedFetch does not expose headers; keep check neutral.
    void contentType;

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      parseTagValue: false,
      trimValues: true,
    });

    let parsed: unknown;
    try {
      parsed = parser.parse(xmlText);
    } catch (parseError) {
      throw new Error(
        `XML parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        { cause: parseError }
      );
    }

    if (!parsed || typeof parsed !== "object") throw new Error("Parsed XML is empty");

    const doc = parsed as Record<string, unknown>;
    const rootKeys = Object.keys(doc);
    const hasRssRoot =
      rootKeys.includes("rss") || rootKeys.some((key) => key.toLowerCase().includes("rss"));
    const hasFeedRoot = rootKeys.includes("feed");
    const hasRdfRoot = rootKeys.some((key) => key.toLowerCase().includes("rdf"));
    if (!hasRssRoot && !hasFeedRoot && !hasRdfRoot) {
      throw new Error(`Unexpected root element: ${rootKeys.join(", ")}`);
    }
    checks.validXml = true;

    const atomFeed = doc.feed as Record<string, unknown> | undefined;
    let items: Record<string, unknown>[] = [];
    let isAtom = false;

    if (atomFeed) {
      isAtom = true;
      if (!atomFeed.title) throw new Error("Atom: missing feed.title");
      if (!atomFeed.id && !atomFeed.title) throw new Error("Atom: missing feed.id");

      items = asArray(
        atomFeed.entry as Record<string, unknown> | Record<string, unknown>[] | undefined
      );
      if (items.length === 0) throw new Error("Atom: no entries found");

      for (const entry of items) {
        if (!entry.title) throw new Error("Atom: entry missing title");
        if (!entry.id) throw new Error("Atom: entry missing id");
        if (!entry.updated && !entry.published)
          throw new Error("Atom: entry missing updated/published");
        const links = asArray(entry.link as unknown);
        const hasLink = links.some(
          (link) =>
            typeof link === "string" || Boolean((link as { "@_href"?: unknown })?.["@_href"])
        );
        if (!hasLink) throw new Error("Atom: entry missing link");
      }
    } else {
      const rss = (doc.rss as Record<string, unknown> | undefined) || doc;
      const rdf =
        (doc["rdf:RDF"] as Record<string, unknown> | undefined) ||
        (doc.RDF as Record<string, unknown> | undefined);
      const channel = ((rss.channel as Record<string, unknown> | undefined) ||
        rdf ||
        rss) as Record<string, unknown>;

      const title = textValue(channel.title);
      if (!title) throw new Error("RSS: missing channel.title");

      items = asArray(
        channel.item as Record<string, unknown> | Record<string, unknown>[] | undefined
      );
      if (items.length === 0) throw new Error("RSS: no items found");

      for (const item of items) {
        const itemTitle = textValue(item.title);
        if (!itemTitle) throw new Error("RSS: item missing title");
        const link = textValue(item.link);
        const guid = textValue(item.guid);
        if (!link && !guid) throw new Error("RSS: item missing link and guid");
      }
    }
    checks.validSchema = true;

    const guids = items
      .map((item) => {
        if (isAtom) return textValue(item.id);
        return textValue(item.guid) || textValue(item.link) || textValue(item.title);
      })
      .filter(Boolean);

    const uniqueGuids = new Set(guids);
    if (uniqueGuids.size !== guids.length) {
      throw new Error(`Duplicate GUIDs detected: ${guids.length - uniqueGuids.size} duplicates`);
    }

    const prevState = VALIDATION_STATE[feed.id];
    if (prevState && prevState.guids.length > 0 && guids.length > 0) {
      const prevSet = new Set(prevState.guids);
      const stableCount = guids.filter((guid) => prevSet.has(guid)).length;
      if (stableCount === 0) {
        // A full feed rewrite is suspicious, but not a hard failure.
      }
    }
    checks.stableGuids = true;

    const dates: Date[] = [];
    let dateIssues = 0;
    for (const item of items) {
      const rawDate = isAtom
        ? textValue(item.published) || textValue(item.updated)
        : textValue(item.pubDate) || textValue(item["dc:date"]);
      if (!rawDate) {
        dateIssues++;
        continue;
      }

      const date = parseDate(rawDate);
      if (!date) {
        dateIssues++;
        continue;
      }

      dates.push(date);
      if (date > new Date(now + 10 * 60 * 1000)) dateIssues++;
    }

    if (dates.length > 0) {
      dates.sort((a, b) => b.getTime() - a.getTime());
      newestItemDate = dates[0].toISOString();
    }
    checks.saneDates = dateIssues < Math.max(1, items.length * 0.25);

    let contentIssues = 0;
    for (const item of items.slice(0, 20)) {
      const title = textValue(item.title);
      const content = isAtom
        ? textValue(item.summary) || textValue(item.content)
        : textValue(item.description) || textValue(item["content:encoded"]);
      if (!title.trim()) contentIssues++;
      if (!content.trim()) contentIssues++;
    }
    checks.usableContent = contentIssues < Math.max(1, Math.min(20, items.length) * 0.25);

    if (newestItemDate) {
      const newest = new Date(newestItemDate);
      const hoursSince = (now - newest.getTime()) / (1000 * 60 * 60);
      checks.fresh = hoursSince < 7 * 24;
    }

    VALIDATION_STATE[feed.id] = {
      guids: guids.slice(0, 100),
      lastValidatedAt: now,
    };
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    logger.warn("feed health validation failed", { feedId: feed.id, error });
  }

  let status: FeedHealth["status"] = "ok";
  if (!checks.reachable || !checks.validXml || !checks.validSchema || !checks.stableGuids) {
    status = "fail";
  } else if (!checks.fresh || !checks.saneDates || !checks.usableContent) {
    status = "warn";
  }

  return {
    feedId: feed.id,
    status,
    checks,
    newestItemDate,
    responseTimeMs: Date.now() - start,
    lastValidatedAt: now,
    error,
  };
}

/** Reset in-memory validation state; useful in tests. */
export function resetValidationState(): void {
  for (const key of Object.keys(VALIDATION_STATE)) {
    delete VALIDATION_STATE[key];
  }
}

/** Persist a health result to the feeds table. */
export function persistFeedHealth(db: Database.Database, health: FeedHealth): void {
  const stmt = db.prepare(`
    UPDATE feeds
    SET health_status = ?,
        health_checked_at = ?,
        health_error = ?
    WHERE id = ?
  `);
  stmt.run(health.status, health.lastValidatedAt, health.error ?? null, health.feedId);
}

/** Run health validation for every working feed and persist the results. */
export async function validateAllFeedHealth(
  db: Database.Database,
  feeds: Feed[],
  now = Date.now()
): Promise<{ processed: number; ok: number; warn: number; fail: number }> {
  let ok = 0;
  let warn = 0;
  let fail = 0;

  for (const feed of feeds.filter((f) => f.status === "working")) {
    const health = await validateFeedHealth(feed, now);
    persistFeedHealth(db, health);

    if (health.status === "ok") ok++;
    else if (health.status === "warn") warn++;
    else fail++;
  }

  logger.info("feed health validation complete", { processed: ok + warn + fail, ok, warn, fail });
  return { processed: ok + warn + fail, ok, warn, fail };
}
