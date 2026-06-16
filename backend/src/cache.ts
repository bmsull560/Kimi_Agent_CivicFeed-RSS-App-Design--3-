import { db } from "./db.js";
import type { RssEntry } from "./rss.js";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface CachedArticle {
  id: number;
  feedId: string;
  entryId: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author: string | null;
  categories: string[] | null;
  fetchedAt: number;
}

export function getCachedArticles(feedId: string): CachedArticle[] | null {
  const stmt = db.prepare(`
    SELECT * FROM article_cache
    WHERE feed_id = ? AND fetched_at > ?
    ORDER BY pub_date DESC
  `);
  const minTime = Date.now() - CACHE_TTL_MS;
  const rows = stmt.all(feedId, minTime) as any[];

  if (rows.length === 0) return null;

  return rows.map((r) => ({
    id: r.id,
    feedId: r.feed_id,
    entryId: r.entry_id,
    title: r.title,
    link: r.link,
    description: r.description,
    pubDate: r.pub_date,
    author: r.author,
    categories: r.categories ? JSON.parse(r.categories) : null,
    fetchedAt: r.fetched_at,
  }));
}

export function saveArticles(feedId: string, entries: RssEntry[]) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO article_cache
    (feed_id, entry_id, title, link, description, pub_date, author, categories, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const clearOld = db.prepare(`
    DELETE FROM article_cache WHERE feed_id = ? AND fetched_at < ?
  `);

  db.transaction(() => {
    for (const entry of entries) {
      insert.run(
        feedId,
        entry.id,
        entry.title,
        entry.link,
        entry.description,
        entry.pubDate,
        entry.author || null,
        entry.categories ? JSON.stringify(entry.categories) : null,
        entry.fetchedAt
      );
    }
    clearOld.run(feedId, Date.now() - CACHE_TTL_MS * 2);
  })();
}

export function cacheStats(): { total: number; feeds: number } {
  const total = (db.prepare("SELECT COUNT(*) as c FROM article_cache").get() as any).c;
  const feeds = (db.prepare("SELECT COUNT(DISTINCT feed_id) as c FROM article_cache").get() as any).c;
  return { total, feeds };
}
