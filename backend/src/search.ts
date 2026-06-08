import { db } from "./db.js";

export interface SearchResult {
  entryId: string;
  feedId: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author: string | null;
  feedName: string;
  rank: number;
  aiSummary?: string;
  aiTags?: string[];
}

export function searchArticles(query: string, limit: number = 20): SearchResult[] {
  if (!query || query.trim().length < 2) return [];

  // Escape FTS5 special chars
  const safeQuery = query
    .replace(/"/g, '""')
    .trim();

  // Step 1: Get matching entry_ids from FTS5 ordered by rank
  const ftsStmt = db.prepare(`
    SELECT entry_id, rank
    FROM article_search
    WHERE article_search MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  const ftsRows = ftsStmt.all(`"${safeQuery}"*`, limit) as any[];
  if (ftsRows.length === 0) return [];

  // Step 2: Look up full article data for each match
  const entryIds = ftsRows.map((r) => r.entry_id);
  const placeholders = entryIds.map(() => "?").join(",");

  const articleStmt = db.prepare(`
    SELECT
      ac.entry_id,
      ac.feed_id,
      ac.title,
      ac.link,
      ac.description,
      ac.pub_date,
      ac.author,
      f.name as feed_name
    FROM article_cache AS ac
    JOIN feeds AS f ON ac.feed_id = f.id
    WHERE ac.entry_id IN (${placeholders})
  `);

  const articleRows = articleStmt.all(...entryIds) as any[];

  // Build a map for quick lookup
  const articleMap = new Map<string, any>();
  for (const r of articleRows) articleMap.set(r.entry_id, r);

  // Fetch enrichment
  const summaryStmt = db.prepare("SELECT summary FROM article_summaries WHERE entry_id = ?");
  const tagStmt = db.prepare("SELECT tag FROM article_tags WHERE entry_id = ?");

  return ftsRows.map((ftsRow) => {
    const r = articleMap.get(ftsRow.entry_id);
    if (!r) return null;
    const sumRow = summaryStmt.get(r.entry_id) as any;
    const tagRows = tagStmt.all(r.entry_id) as any[];
    return {
      entryId: r.entry_id,
      feedId: r.feed_id,
      title: r.title,
      link: r.link,
      description: r.description,
      pubDate: r.pub_date,
      author: r.author,
      feedName: r.feed_name,
      rank: ftsRow.rank,
      aiSummary: sumRow?.summary,
      aiTags: tagRows.map((t) => t.tag),
    };
  }).filter((x): x is SearchResult => x !== null);
}

export function getRecentArticles(limit: number = 50): SearchResult[] {
  const stmt = db.prepare(`
    SELECT
      ac.entry_id,
      ac.feed_id,
      ac.title,
      ac.link,
      ac.description,
      ac.pub_date,
      ac.author,
      f.name as feed_name
    FROM article_cache AS ac
    JOIN feeds AS f ON ac.feed_id = f.id
    ORDER BY ac.pub_date DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];

  const summaryStmt = db.prepare("SELECT summary FROM article_summaries WHERE entry_id = ?");
  const tagStmt = db.prepare("SELECT tag FROM article_tags WHERE entry_id = ?");

  return rows.map((r) => {
    const sumRow = summaryStmt.get(r.entry_id) as any;
    const tagRows = tagStmt.all(r.entry_id) as any[];
    return {
      entryId: r.entry_id,
      feedId: r.feed_id,
      title: r.title,
      link: r.link,
      description: r.description,
      pubDate: r.pub_date,
      author: r.author,
      feedName: r.feed_name,
      rank: 0,
      aiSummary: sumRow?.summary,
      aiTags: tagRows.map((t) => t.tag),
    };
  });
}
