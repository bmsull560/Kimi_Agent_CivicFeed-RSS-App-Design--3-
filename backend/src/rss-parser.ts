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

type XmlNode = Record<string, unknown>;

export function generateEntryId(link: string, title: string, pubDate: string): string {
  const str = `${link}::${title}::${pubDate}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
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

function getTextVal(v: unknown): string {
  if (typeof v === "string") return v;
  const text = v && typeof v === "object" ? (v as XmlNode)["#text"] : undefined;
  return typeof text === "string" ? text : "";
}

function parseRssItems(items: unknown[], feedId: string, feedName: string): RssEntry[] {
  const entries: RssEntry[] = [];
  const now = Date.now();
  for (const raw of items) {
    const item = raw as XmlNode;
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
        const t = typeof c === "string" ? c.trim() : getTextVal(c).trim();
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

function parseAtomEntries(entries: unknown[], feedId: string, feedName: string): RssEntry[] {
  const result: RssEntry[] = [];
  const now = Date.now();
  for (const raw of entries) {
    const entry = raw as XmlNode;
    const title = (getTextVal(entry.title) || "").trim();
    let link = "";
    if (entry.link) {
      const links = Array.isArray(entry.link) ? entry.link : [entry.link];
      for (const l of links) {
        const rel = typeof l === "string" ? undefined : (l as XmlNode)["@_rel"];
        if (!rel || rel === "alternate") {
          link = typeof l === "string" ? l : getTextVal((l as XmlNode)["@_href"]);
          break;
        }
      }
    }
    const summary = getTextVal(entry.summary) || getTextVal(entry.content);
    const pubRaw = getTextVal(entry.published) || getTextVal(entry.updated);
    const id = (getTextVal(entry.id) || "").trim();
    let author: string | undefined;
    if (entry.author) {
      const a = Array.isArray(entry.author) ? entry.author[0] : entry.author;
      author = typeof a === "string" ? a : getTextVal((a as XmlNode).name);
    }
    const cats: string[] = [];
    if (entry.category) {
      const raw = Array.isArray(entry.category) ? entry.category : [entry.category];
      for (const c of raw) {
        const t =
          typeof c === "string"
            ? c.trim()
            : (getTextVal((c as XmlNode)["@_term"]) || getTextVal(c)).trim();
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

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlText);
  } catch {
    return [];
  }

  if (!parsed) return [];

  const doc = parsed as XmlNode;

  // RSS 2.0
  const rss = doc.rss as XmlNode | undefined;
  const rssChannel = rss?.channel as XmlNode | undefined;
  if (rssChannel?.item) {
    const rawItems = rssChannel.item;
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];
    return parseRssItems(items, feedId, feedName);
  }

  // Atom
  const feed = doc.feed as XmlNode | undefined;
  if (feed?.entry) {
    const rawEntries = feed.entry;
    const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
    return parseAtomEntries(entries, feedId, feedName);
  }

  // RDF
  const rdf = (doc["rdf:RDF"] || doc.RDF) as XmlNode | undefined;
  const rdfItems = rdf?.item;
  if (rdfItems) {
    const items = Array.isArray(rdfItems) ? rdfItems : [rdfItems];
    return parseRssItems(items, feedId, feedName);
  }

  return [];
}
