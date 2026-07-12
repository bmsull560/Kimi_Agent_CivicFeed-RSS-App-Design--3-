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

function parseTags(json: string | null | undefined): string[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as string[];
    return parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export { parseTags };
/**
 * Search articles using the FTS5 index.
 *
 * This query resolves full article data, feed names, summaries, and tags in a
 * single round-trip. Correlated scalar subqueries replace the previous N+1
 * lookups against article_summaries and article_tags.
 */
export function searchArticles(query: string, limit: number = 20): SearchResult[] {
  if (!query || query.trim().length < 2) return [];

  // Escape FTS5 special chars by doubling double-quotes.
  const safeQuery = query.replace(/"/g, '""').trim();

  const stmt = db.prepare(`
    SELECT
      s.entry_id AS entry_id,
      ac.feed_id AS feed_id,
      ac.title AS title,
      ac.link AS link,
      ac.description AS description,
      ac.pub_date AS pub_date,
      ac.author AS author,
      f.name AS feed_name,
      s.rank AS rank,
      (SELECT summary FROM article_summaries WHERE entry_id = ac.entry_id) AS ai_summary,
      (SELECT json_group_array(tag) FROM article_tags WHERE entry_id = ac.entry_id) AS ai_tags
    FROM article_search AS s
    JOIN article_cache AS ac ON s.entry_id = ac.entry_id
    JOIN feeds AS f ON ac.feed_id = f.id
    WHERE article_search MATCH ?
    ORDER BY s.rank
    LIMIT ?
  `);

  const rows = stmt.all(`"${safeQuery}"*`, limit) as any[];

  return rows.map((r) => ({
    entryId: r.entry_id,
    feedId: r.feed_id,
    title: r.title,
    link: r.link,
    description: r.description,
    pubDate: r.pub_date,
    author: r.author,
    feedName: r.feed_name,
    rank: r.rank,
    aiSummary: r.ai_summary,
    aiTags: parseTags(r.ai_tags),
  }));
}

/**
 * Return the most recently cached articles across all feeds.
 *
 * Like searchArticles, this resolves summaries and tags inline so the database
 * is queried exactly once.
 */
export function getRecentArticles(limit: number = 50): SearchResult[] {
  const stmt = db.prepare(`
    SELECT
      ac.entry_id AS entry_id,
      ac.feed_id AS feed_id,
      ac.title AS title,
      ac.link AS link,
      ac.description AS description,
      ac.pub_date AS pub_date,
      ac.author AS author,
      f.name AS feed_name,
      (SELECT summary FROM article_summaries WHERE entry_id = ac.entry_id) AS ai_summary,
      (SELECT json_group_array(tag) FROM article_tags WHERE entry_id = ac.entry_id) AS ai_tags
    FROM article_cache AS ac
    JOIN feeds AS f ON ac.feed_id = f.id
    ORDER BY ac.pub_date DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];

  return rows.map((r) => ({
    entryId: r.entry_id,
    feedId: r.feed_id,
    title: r.title,
    link: r.link,
    description: r.description,
    pubDate: r.pub_date,
    author: r.author,
    feedName: r.feed_name,
    rank: 0,
    aiSummary: r.ai_summary,
    aiTags: parseTags(r.ai_tags),
  }));
}
