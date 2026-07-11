import { XMLParser } from "fast-xml-parser";
import { guardedFetch } from "./url-security.js";
import { db } from "./db.js";
import { logger } from "./logger.js";

export interface RssEntry {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author?: string;
  categories?: string[];
  feedId: string;
  feedName: string;
  fetchedAt: number;
}

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

function generateEntryId(link: string, title: string, pubDate: string): string {
  const str = `${link}::${title}::${pubDate}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `entry-${Math.abs(hash).toString(36)}`;
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const cleaned = dateStr.replace(/\s+\(.*\)$/, "").trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString();
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, m, day, y] = usMatch;
    const dd = new Date(`${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (!isNaN(dd.getTime())) return dd.toISOString();
  }
  return new Date().toISOString();
}

function parseRssItems(items: any[], feedId: string, feedName: string): RssEntry[] {
  const entries: RssEntry[] = [];
  const now = Date.now();
  for (const item of items) {
    const getTextVal = (v: any): string => typeof v === "string" ? v : (v?.["#text"] || "");
    const title = getTextVal(item.title).trim();
    const link = (getTextVal(item.link) || getTextVal(item.guid)).trim();
    const description = getTextVal(item.description) || getTextVal(item["content:encoded"]);
    const pubRaw = getTextVal(item.pubDate) || getTextVal(item["dc:date"]);
    const author = getTextVal(item["dc:creator"]) || getTextVal(item.author) || undefined;
    const guid = getTextVal(item.guid).trim();
    const cats: string[] = [];
    if (item.category) {
      const raw = Array.isArray(item.category) ? item.category : [item.category];
      for (const c of raw) {
        const t = typeof c === "string" ? c.trim() : (c?.["#text"] || "").trim();
        if (t) cats.push(t);
      }
    }
    if (!title && !link) continue;
    entries.push({
      id: guid || generateEntryId(link, title, pubRaw),
      title: title || "Untitled",
      link,
      description,
      pubDate: normalizeDate(pubRaw),
      author: typeof author === "string" ? author : undefined,
      categories: cats.length > 0 ? cats : undefined,
      feedId,
      feedName,
      fetchedAt: now,
    });
  }
  return entries;
}

function parseAtomEntries(entries: any[], feedId: string, feedName: string): RssEntry[] {
  const result: RssEntry[] = [];
  const now = Date.now();
  for (const entry of entries) {
    const title = (entry.title || "").trim();
    let link = "";
    if (entry.link) {
      const links = Array.isArray(entry.link) ? entry.link : [entry.link];
      for (const l of links) {
        const rel = typeof l === "string" ? undefined : l["@_rel"];
        if (!rel || rel === "alternate") {
          link = typeof l === "string" ? l : (l["@_href"] || "");
          break;
        }
      }
    }
    const summary = entry.summary || entry.content || "";
    const pubRaw = entry.published || entry.updated || "";
    const id = (entry.id || "").trim();
    let author: string | undefined;
    if (entry.author) {
      const a = Array.isArray(entry.author) ? entry.author[0] : entry.author;
      author = typeof a === "string" ? a : (a.name || undefined);
    }
    const cats: string[] = [];
    if (entry.category) {
      const raw = Array.isArray(entry.category) ? entry.category : [entry.category];
      for (const c of raw) {
        const t = typeof c === "string" ? c.trim() : (c["@_term"] || c["#text"] || "").trim();
        if (t) cats.push(t);
      }
    }
    if (!title && !link) continue;
    result.push({
      id: id || generateEntryId(link, title, pubRaw),
      title: title || "Untitled",
      link,
      description: summary,
      pubDate: normalizeDate(pubRaw),
      author: typeof author === "string" ? author : undefined,
      categories: cats.length > 0 ? cats : undefined,
      feedId,
      feedName,
      fetchedAt: now,
    });
  }
  return result;
}

export function parseRssXml(xmlText: string, feedId: string, feedName: string): RssEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseTagValue: false,
    trimValues: true,
  });

  let parsed: any;
  try {
    parsed = parser.parse(xmlText);
  } catch (e) {
    return [];
  }

  if (!parsed) return [];

  // RSS 2.0
  const rss = parsed.rss;
  if (rss?.channel?.item) {
    const items = Array.isArray(rss.channel.item) ? rss.channel.item : [rss.channel.item];
    return parseRssItems(items, feedId, feedName);
  }

  // Atom
  const feed = parsed.feed;
  if (feed?.entry) {
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    return parseAtomEntries(entries, feedId, feedName);
  }

  // RDF
  const rdf = parsed["rdf:RDF"] || parsed.RDF;
  if (rdf?.item) {
    const items = Array.isArray(rdf.item) ? rdf.item : [rdf.item];
    return parseRssItems(items, feedId, feedName);
  }

  return [];
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
    console.warn(`[FeedValidator] ${feedId} issues:`, issues.slice(0, 5));
  }
}

export async function fetchFeed(url: string, feedId: string, feedName: string): Promise<FetchResult> {
  const fetchResult = await guardedFetch(url);
  if (!fetchResult.ok) {
    const message = fetchResult.error || "Fetch failed";
    logger.warn("feed fetch failed", { feedId, status: fetchResult.status, error: message });
    recordFeedFailure(feedId, message);
    return { entries: [], error: message };
  }

  const entries = parseRssXml(fetchResult.text, feedId, feedName);
  if (entries.length === 0) {
    logger.warn("feed fetch returned no entries", { feedId });
    recordFeedFailure(feedId, "No entries parsed");
    return { entries: [], error: "No entries parsed" };
  }

  recordFeedSuccess(feedId);
  validateFeedClientSide(entries, feedId);
  return { entries, error: null };
}
