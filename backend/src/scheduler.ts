import type Database from "better-sqlite3";
import { fetchFeed } from "./rss.js";
import { saveArticles } from "./cache.js";
import { logger } from "./logger.js";
import { getPendingEnrichmentCount, processEnrichmentBatch } from "./enrichment-queue.js";
import { validateAllFeedHealth } from "./feed-health.js";
import { feeds } from "./feeds.js";

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
  const dueFeeds = db
    .prepare(
      `
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
  `
    )
    .all(now, batchSize) as DueFeed[];

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

export function createNonOverlappingTask(
  taskName: string,
  task: () => Promise<Record<string, unknown> | void>
): () => Promise<void> {
  let running = false;

  return async () => {
    if (running) {
      logger.warn("scheduled task skipped", { task: taskName, reason: "overlap" });
      return;
    }

    running = true;
    const startedAt = Date.now();
    try {
      const summary = await task();
      logger.info("scheduled task complete", {
        task: taskName,
        durationMs: Date.now() - startedAt,
        ...summary,
      });
    } catch (err) {
      logger.error(`scheduled ${taskName} failed`, err);
    } finally {
      running = false;
    }
  };
}

export function startFeedRefreshScheduler(
  db: Database.Database,
  refreshIntervalMs = 60_000,
  healthIntervalMs = 60 * 60 * 1000,
  enrichmentIntervalMs = 30_000
): () => void {
  let stopped = false;

  const refresh = createNonOverlappingTask("feed refresh", async () => {
    const summary = await refreshDueFeeds(db);
    return { batchSize: summary.processed, succeeded: summary.succeeded, failed: summary.failed };
  });
  const enrichment = createNonOverlappingTask("enrichment", async () => {
    const queueDepthBefore = getPendingEnrichmentCount();
    const summary = await processEnrichmentBatch(20, 3);
    return { ...summary, queueDepthBefore, queueDepthAfter: getPendingEnrichmentCount() };
  });
  const health = createNonOverlappingTask("feed health", async () => {
    const results = await validateAllFeedHealth(db, feeds, Date.now());
    return { batchSize: results.processed, ...results };
  });

  const runUnlessStopped = (task: () => Promise<void>) => () => {
    if (!stopped) void task();
  };

  const initialRefresh = setTimeout(runUnlessStopped(refresh), 5_000);
  const initialEnrichment = setTimeout(runUnlessStopped(enrichment), 10_000);
  const initialHealth = setTimeout(runUnlessStopped(health), 15_000);
  const refreshInterval = setInterval(runUnlessStopped(refresh), refreshIntervalMs);
  const enrichmentInterval = setInterval(runUnlessStopped(enrichment), enrichmentIntervalMs);
  const healthInterval = setInterval(runUnlessStopped(health), healthIntervalMs);

  return () => {
    stopped = true;
    clearTimeout(initialRefresh);
    clearTimeout(initialEnrichment);
    clearTimeout(initialHealth);
    clearInterval(refreshInterval);
    clearInterval(enrichmentInterval);
    clearInterval(healthInterval);
  };
}
