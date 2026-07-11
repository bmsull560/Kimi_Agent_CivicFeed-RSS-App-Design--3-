import type Database from "better-sqlite3";
import { fetchFeed } from "./rss.js";
import { saveArticles } from "./cache.js";
import { logger } from "./logger.js";

interface DueFeed {
  id: string;
  rss_url: string;
  name: string;
}

interface RefreshSummary {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (true) {
          const item = queue.shift();
          if (!item) return;
          await fn(item);
        }
      })()
    );
  }

  await Promise.all(workers);
}

export async function refreshDueFeeds(
  db: Database.Database,
  now = Date.now(),
  batchSize = 50,
  concurrency = 5
): Promise<RefreshSummary> {
  const dueFeeds = db.prepare(`
    SELECT f.id, f.rss_url, f.name
    FROM feeds f
    LEFT JOIN feed_fetch_status s ON f.id = s.feed_id
    WHERE f.status = 'working'
      AND (
        s.feed_id IS NULL
        OR s.next_fetch_at IS NULL
        OR s.next_fetch_at <= ?
      )
    ORDER BY COALESCE(s.next_fetch_at, 0) ASC
    LIMIT ?
  `).all(now, batchSize) as DueFeed[];

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  await withConcurrency(dueFeeds, concurrency, async (feed) => {
    try {
      const result = await fetchFeed(feed.rss_url, feed.id, feed.name);
      if (result.error) {
        failed += 1;
        errors.push(`${feed.id}: ${result.error}`);
      } else {
        saveArticles(feed.id, result.entries);
        succeeded += 1;
      }
    } catch (err) {
      failed += 1;
      errors.push(`${feed.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  logger.info("refresh due feeds complete", {
    processed: dueFeeds.length,
    succeeded,
    failed,
  });

  return { processed: dueFeeds.length, succeeded, failed, errors };
}

export function startFeedRefreshScheduler(
  db: Database.Database,
  intervalMs = 60_000
): () => void {
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      await refreshDueFeeds(db);
    } catch (err) {
      logger.error("scheduled refresh failed", err);
    }
  }

  const initial = setTimeout(tick, 5_000);
  const interval = setInterval(tick, intervalMs);

  return () => {
    stopped = true;
    clearTimeout(initial);
    clearInterval(interval);
  };
}
