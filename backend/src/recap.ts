import { db } from "./db.js";

export interface RecapEntry {
  entryId: string;
  feedId: string;
  feedName: string;
  feedCategory: string;
  title: string;
  link: string;
  pubDate: string;
  author: string | null;
  aiSummary?: string;
  aiTags?: string[];
}

export interface RecapGroup {
  category: string;
  entries: RecapEntry[];
}

export interface WeeklyRecap {
  startDate: string;
  endDate: string;
  totalArticles: number;
  categories: RecapGroup[];
  topTags: { tag: string; count: number }[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function generateRecap(daysBack: number = 7): WeeklyRecap {
  const now = Date.now();
  const cutoff = now - daysBack * MS_PER_DAY;

  const stmt = db.prepare(`
    SELECT
      ac.entry_id,
      ac.feed_id,
      ac.title,
      ac.link,
      ac.pub_date,
      ac.author,
      f.name as feed_name,
      f.category as feed_category
    FROM article_cache AS ac
    JOIN feeds AS f ON ac.feed_id = f.id
    WHERE ac.fetched_at > ?
    ORDER BY ac.pub_date DESC
  `);

  const rows = stmt.all(cutoff) as any[];

  const summaryStmt = db.prepare("SELECT summary FROM article_summaries WHERE entry_id = ?");
  const tagStmt = db.prepare("SELECT tag FROM article_tags WHERE entry_id = ?");

  const entries: RecapEntry[] = rows.map((r) => {
    const sumRow = summaryStmt.get(r.entry_id) as any;
    const tagRows = tagStmt.all(r.entry_id) as any[];
    return {
      entryId: r.entry_id,
      feedId: r.feed_id,
      feedName: r.feed_name,
      feedCategory: r.feed_category,
      title: r.title,
      link: r.link,
      pubDate: r.pub_date,
      author: r.author,
      aiSummary: sumRow?.summary,
      aiTags: tagRows.map((t: any) => t.tag),
    };
  });

  const byCategory = new Map<string, RecapEntry[]>();
  for (const e of entries) {
    const list = byCategory.get(e.feedCategory) || [];
    list.push(e);
    byCategory.set(e.feedCategory, list);
  }

  const categories: RecapGroup[] = [...byCategory.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, entries]) => ({ category, entries }));

  const tagFreq = new Map<string, number>();
  for (const e of entries) {
    for (const tag of e.aiTags || []) {
      tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
    }
  }
  const topTags = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    startDate: new Date(cutoff).toISOString(),
    endDate: new Date(now).toISOString(),
    totalArticles: entries.length,
    categories,
    topTags,
  };
}
