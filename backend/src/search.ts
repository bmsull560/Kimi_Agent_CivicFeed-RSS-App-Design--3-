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

  const stmt = db.prepare(`
    SELECT
      ac.entry_id,
      ac.feed_id,
      ac.title,
      ac.link,
      ac.description,
      ac.pub_date,
      ac.author,
      f.name as feed_name,
      ac.fetched_at,
      rank
    FROM article_search AS s
    JOIN article_cache AS ac ON s.entry_id = ac.entry_id
    JOIN feeds AS f ON ac.feed_id = f.id
    WHERE article_search MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  const rows = stmt.all(`"${safeQuery}"*`, limit) as any[];

  // Fetch enrichment for each result
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
      rank: r.rank,
      aiSummary: sumRow?.summary,
      aiTags: tagRows.map((t) => t.tag),
    };
  });
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
