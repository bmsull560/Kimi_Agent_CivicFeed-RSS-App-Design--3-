import { XMLParser } from "fast-xml-parser";

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

export function generateEntryId(link: string, title: string, pubDate: string): string {
  const str = `${link}::${title}::${pubDate}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `entry-${Math.abs(hash).toString(36)}`;
}

export function normalizeDate(dateStr: string): string {
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
    const getTextVal = (v: any): string => (typeof v === "string" ? v : v?.["#text"] || "");
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
