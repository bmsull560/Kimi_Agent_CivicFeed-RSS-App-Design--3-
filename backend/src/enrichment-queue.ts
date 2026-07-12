import { db } from "./db.js";
import { enrichArticle } from "./ai.js";
import { logger } from "./logger.js";

export type EnrichmentJobStatus = "pending" | "running" | "done" | "failed";

export interface EnrichmentJob {
  id: number;
  entryId: string;
  feedId: string;
  title: string;
  description: string;
  status: EnrichmentJobStatus;
  priority: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_CONCURRENCY = 3;

/**
 * Queue an article for asynchronous AI enrichment.
 *
 * The request path should remain fast: articles are returned immediately and
 * enrichment is processed by a background worker. Duplicate jobs for the same
 * entry_id are ignored.
 */
export function enqueueArticleEnrichment(
  entryId: string,
  feedId: string,
  title: string,
  description: string,
  priority = 0
): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO enrichment_jobs
    (entry_id, feed_id, title, description, status, priority, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `);
  stmt.run(entryId, feedId, title, description, priority, Date.now());
}

/**
 * Count pending enrichment jobs.
 */
export function getPendingEnrichmentCount(): number {
  return (db.prepare("SELECT COUNT(*) as c FROM enrichment_jobs WHERE status = 'pending'").get() as { c: number }).c;
}

function claimPendingJobs(batchSize: number): EnrichmentJob[] {
  const select = db.prepare(`
    SELECT id, entry_id, feed_id, title, description, status, priority, created_at, started_at, finished_at, error
    FROM enrichment_jobs
    WHERE status = 'pending'
    ORDER BY priority DESC, created_at ASC
    LIMIT ?
  `);
  const markRunning = db.prepare(`
    UPDATE enrichment_jobs
    SET status = 'running', started_at = ?
    WHERE id = ? AND status = 'pending'
  `);

  const claimed: EnrichmentJob[] = [];
  const candidates = select.all(batchSize) as any[];

  for (const row of candidates) {
    const changes = markRunning.run(Date.now(), row.id).changes;
    if (changes === 0) continue;

    claimed.push({
      id: row.id,
      entryId: row.entry_id,
      feedId: row.feed_id,
      title: row.title,
      description: row.description,
      status: "running",
      priority: row.priority,
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      error: row.error,
    });
  }

  return claimed;
}

function markJobDone(jobId: number): void {
  db.prepare("UPDATE enrichment_jobs SET status = 'done', finished_at = ? WHERE id = ?")
    .run(Date.now(), jobId);
}

function markJobFailed(jobId: number, error: string): void {
  db.prepare("UPDATE enrichment_jobs SET status = 'failed', finished_at = ?, error = ? WHERE id = ?")
    .run(Date.now(), error, jobId);
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

/**
 * Process a batch of pending enrichment jobs.
 *
 * Jobs are claimed in priority order and processed with bounded concurrency.
 * Failures are recorded on the job row so retries can be implemented later if
 * desired.
 */
export async function processEnrichmentBatch(
  batchSize = DEFAULT_BATCH_SIZE,
  concurrency = DEFAULT_CONCURRENCY
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const jobs = claimPendingJobs(batchSize);
  if (jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  await withConcurrency(jobs, concurrency, async (job) => {
    try {
      await enrichArticle(job.entryId, job.feedId, job.title, job.description);
      markJobDone(job.id);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markJobFailed(job.id, message);
      failed++;
      logger.error("enrichment job failed", err, { entryId: job.entryId, feedId: job.feedId });
    }
  });

  logger.info("enrichment batch complete", { processed: jobs.length, succeeded, failed });
  return { processed: jobs.length, succeeded, failed };
}
