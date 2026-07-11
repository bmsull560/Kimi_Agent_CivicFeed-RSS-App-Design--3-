import { XMLParser } from "fast-xml-parser";
import type { RssEntry, FetchResult, FeedFetchStatus, FeedStats, DiscoveredFeed } from "../types";

const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

const API_BASE = import.meta.env?.VITE_API_URL || "";

function getApiBaseCandidates(): string[] {
  const candidates = new Set<string>();
  candidates.add(API_BASE);

  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    candidates.add("http://localhost:4000");
  }

  return [...candidates];
}

export async function fetchFeed(url: string, feedId: string, feedName: string): Promise<FetchResult> {
  // Try backend API first
  for (const apiBase of getApiBaseCandidates()) {
    try {
      const res = await fetch(`${apiBase}/api/feeds/${feedId}/articles`, { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const data = await res.json();
        if (data.entries && data.entries.length > 0) {
          return { entries: data.entries, error: null };
        }
        if (data.error) {
          console.warn(`[Backend] Feed ${feedId} error:`, data.error);
        }
      } else if (res.status !== 404) {
        console.warn(`[Backend] Feed ${feedId} request failed with HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`[Backend] ${apiBase || "same-origin"} unreachable, trying next source:`, e);
    }
  }

  // Fallback: direct fetch with CORS proxies
  return fetchFeedDirect(url, feedId, feedName);
}

export async function fetchFeedStatus(feedId: string): Promise<FeedFetchStatus | null> {
  for (const apiBase of getApiBaseCandidates()) {
    try {
      const res = await fetch(`${apiBase}/api/feeds/${feedId}/status`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return (await res.json()) as FeedFetchStatus;
      }
    } catch {
      // Candidate unreachable; try the next one.
    }
  }
  return null;
}

export async function fetchFeedStats(): Promise<FeedStats | null> {
  for (const apiBase of getApiBaseCandidates()) {
    try {
      const res = await fetch(`${apiBase}/api/stats/feeds`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return (await res.json()) as FeedStats;
      }
    } catch {
      // Candidate unreachable; try the next one.
    }
  }
  return null;
}

export async function discoverFeeds(inputUrl: string): Promise<DiscoveredFeed[]> {
  for (const apiBase of getApiBaseCandidates()) {
    try {
      const res = await fetch(
        `${apiBase}/api/discover?url=${encodeURIComponent(inputUrl)}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { feeds?: DiscoveredFeed[] };
        return data.feeds || [];
      }
    } catch {
      // Candidate unreachable; try the next one.
    }
  }
  return [];
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

function resolveUrl(rawUrl: string, baseUrl?: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed || !baseUrl) return trimmed;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const cleaned = dateStr.replace(/\s+\(.*\)$/, "").trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString();
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const m = usMatch[1] ?? "";
    const d = usMatch[2] ?? "";
    const y = usMatch[3] ?? "";
    const dd = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!isNaN(dd.getTime())) return dd.toISOString();
  }
  return new Date().toISOString();
}

type XmlNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function isXmlNode(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null;
}

function textValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (!isXmlNode(value)) return "";
  return textValue(value["#text"]) || textValue(value.__cdata);
}

function attrValue(value: unknown, attrName: string): string {
  if (!isXmlNode(value)) return "";
  return textValue(value[`@_${attrName}`]);
}

function parseXmlDocument(xmlText: string): XmlNode | null {
  try {
    const parsed = xmlParser.parse(xmlText);
    return isXmlNode(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractHtmlItems(xmlText: string): XmlNode[] {
  const itemBlocks = xmlText.match(/<item\b[\s\S]*?<\/item>/gi);
  if (!itemBlocks?.length) return [];
  const parsed = parseXmlDocument(`<rss><channel>${itemBlocks.join("")}</channel></rss>`);
  const channel = isXmlNode(parsed?.rss) ? parsed.rss.channel : undefined;
  return isXmlNode(channel) ? asArray(channel.item).filter(isXmlNode) : [];
}

function parseRssItems(items: XmlNode[], feedId: string, feedName: string, baseUrl?: string): RssEntry[] {
  const entries: RssEntry[] = [];
  const now = Date.now();
  for (const item of items) {
    const getText = (tag: string) => textValue(item[tag]);
    const title = getText("title").trim();
    const rawLink = getText("link").trim() || getText("guid").trim();
    const link = resolveUrl(rawLink, baseUrl);
    const description = getText("description") || getText("content:encoded") || "";
    const pubRaw = getText("pubDate") || getText("dc:date");
    const author = getText("dc:creator") || getText("author") || undefined;
    const guid = getText("guid").trim();
    const cats = asArray(item.category).map(textValue).map(t => t.trim()).filter(Boolean);
    if (!title && !link) continue;
    entries.push({
      id: guid || generateEntryId(link, title, pubRaw),
      title: title || "Untitled",
      link,
      description,
      pubDate: normalizeDate(pubRaw),
      author,
      categories: cats.length > 0 ? cats : undefined,
      feedId,
      feedName,
      fetchedAt: now,
    });
  }
  return entries;
}

function parseAtomEntries(entries: XmlNode[], feedId: string, feedName: string, baseUrl?: string): RssEntry[] {
  const result: RssEntry[] = [];
  const now = Date.now();
  for (const entry of entries) {
    const getText = (tag: string) => textValue(entry[tag]);
    const title = getText("title").trim();
    let link = "";
    const links = asArray(entry.link);
    for (const atomLink of links) {
      const rel = attrValue(atomLink, "rel");
      if (!rel || rel === "alternate") {
        link = resolveUrl(attrValue(atomLink, "href") || textValue(atomLink), baseUrl);
        break;
      }
    }
    const summary = getText("summary") || getText("content") || "";
    const pubRaw = getText("published") || getText("updated");
    const id = getText("id").trim();
    let author: string | undefined;
    if (isXmlNode(entry.author)) {
      author = textValue(entry.author.name) || textValue(entry.author) || undefined;
    }
    const cats = asArray(entry.category)
      .map(category => attrValue(category, "term") || textValue(category))
      .map(t => t.trim())
      .filter(Boolean);
    if (!title && !link) continue;
    result.push({
      id: id || generateEntryId(link, title, pubRaw),
      title: title || "Untitled",
      link,
      description: summary,
      pubDate: normalizeDate(pubRaw),
      author,
      categories: cats.length > 0 ? cats : undefined,
      feedId,
      feedName,
      fetchedAt: now,
    });
  }
  return result;
}

export function parseRssXml(xmlText: string, feedId: string, feedName: string, baseUrl?: string): RssEntry[] {
  const doc = parseXmlDocument(xmlText);
  const rss = isXmlNode(doc?.rss) ? doc.rss : undefined;
  const channel = isXmlNode(rss) && isXmlNode(rss.channel) ? rss.channel : undefined;
  const rssItems = channel ? asArray(channel.item).filter(isXmlNode) : [];
  if (rssItems.length > 0) return parseRssItems(rssItems, feedId, feedName, baseUrl);

  const rdf = isXmlNode(doc?.["rdf:RDF"]) ? doc["rdf:RDF"] : undefined;
  const rdfItems = isXmlNode(rdf) ? asArray(rdf.item).filter(isXmlNode) : [];
  if (rdfItems.length > 0) return parseRssItems(rdfItems, feedId, feedName, baseUrl);

  const atomFeed = isXmlNode(doc?.feed) ? doc.feed : undefined;
  const atomEntries = isXmlNode(atomFeed) ? asArray(atomFeed.entry).filter(isXmlNode) : [];
  if (atomEntries.length > 0) return parseAtomEntries(atomEntries, feedId, feedName, baseUrl);

  const htmlItems = extractHtmlItems(xmlText);
  return htmlItems.length > 0 ? parseRssItems(htmlItems, feedId, feedName, baseUrl) : [];
}

function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    fetch(url, { signal: controller.signal, ...init })
      .then(response => { clearTimeout(timer); resolve(response); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

async function fetchFeedDirect(url: string, feedId: string, feedName: string): Promise<FetchResult> {
  const errors: string[] = [];
  try {
    const res = await fetchWithTimeout(url, 12000, {
      headers: {
        "User-Agent": "Feedly/1.0 (+http://www.feedly.com/fetcher.html)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    if (res.ok) {
      const xml = await res.text();
      const entries = parseRssXml(xml, feedId, feedName, url);
      if (entries.length > 0) return { entries, error: null };
    }
  } catch (e) {
    errors.push(`direct: ${e instanceof Error ? e.message : String(e)}`);
  }
  for (const proxyFn of PROXIES) {
    const proxyUrl = proxyFn(url);
    try {
      const res = await fetchWithTimeout(proxyUrl, 18000);
      if (!res.ok) { errors.push(`proxy: HTTP ${res.status}`); continue; }
      const xml = await res.text();
      if (!xml || xml.length < 50) { errors.push(`proxy: Empty response`); continue; }
      const entries = parseRssXml(xml, feedId, feedName, url);
      if (entries.length > 0) return { entries, error: null };
      errors.push(`proxy: No entries parsed`);
    } catch (e) {
      errors.push(`proxy: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return {
    entries: [],
    error: `Failed after ${errors.length} attempts: ${errors.slice(0, 3).join("; ")}`,
  };
}
