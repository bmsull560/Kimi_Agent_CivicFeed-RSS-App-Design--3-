import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "./db.js";
import { refreshDueFeeds, scheduleNonOverlappingTask } from "./scheduler.js";
import { insertTestFeed } from "./test-helpers.js";

const testFeedId = "scheduler-test-feed";

interface FetchStatusRow {
  feed_id: string;
  next_fetch_at: number | null;
  success_count: number;
  attempt_count: number;
  failure_count: number;
}

describe("scheduler", () => {
  beforeEach(() => {
    // Ensure only our test feed is considered due by pushing every other feed
    // into the future. This also creates status rows for feeds that lack them.
    db.prepare(
      `
      INSERT INTO feed_fetch_status (feed_id, next_fetch_at)
      SELECT id, ? FROM feeds
      WHERE id != ?
      ON CONFLICT(feed_id) DO UPDATE SET next_fetch_at = excluded.next_fetch_at
    `
    ).run(Date.now() + 24 * 60 * 60 * 1000, testFeedId);

    // Clean up any leftover test feed data and re-create the feed.
    db.prepare("DELETE FROM article_cache WHERE feed_id = ?").run(testFeedId);
    db.prepare("DELETE FROM article_summaries WHERE feed_id = ?").run(testFeedId);
    db.prepare("DELETE FROM article_tags WHERE feed_id = ?").run(testFeedId);
    db.prepare("DELETE FROM feed_fetch_status WHERE feed_id = ?").run(testFeedId);
    db.prepare("DELETE FROM feeds WHERE id = ?").run(testFeedId);
    insertTestFeed({ id: testFeedId, name: "Scheduler Test Feed", status: "working" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.prepare("DELETE FROM article_cache WHERE feed_id = ?").run(testFeedId);
    db.prepare("DELETE FROM article_summaries WHERE feed_id = ?").run(testFeedId);
    db.prepare("DELETE FROM article_tags WHERE feed_id = ?").run(testFeedId);
    db.prepare("DELETE FROM feed_fetch_status WHERE feed_id = ?").run(testFeedId);
    db.prepare("DELETE FROM feeds WHERE id = ?").run(testFeedId);
  });

  it("refreshes due feeds, records success, and caches articles", async () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Scheduled Entry</title>
      <link>https://example.com/scheduled-entry</link>
      <description>Test.</description>
      <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
      <guid>scheduled-entry-1</guid>
    </item>
  </channel>
</rss>`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml, { status: 200 }))
    );

    const summary = await refreshDueFeeds(db);
    expect(summary.processed).toBeGreaterThanOrEqual(1);
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const status = db
      .prepare("SELECT * FROM feed_fetch_status WHERE feed_id = ?")
      .get(testFeedId) as FetchStatusRow | undefined;
    expect(status).toBeTruthy();
    expect(status!.success_count).toBe(1);
    expect(status!.attempt_count).toBe(1);

    const cached = db
      .prepare("SELECT COUNT(*) as c FROM article_cache WHERE feed_id = ?")
      .get(testFeedId) as { c: number };
    expect(cached.c).toBe(1);
  });

  it("records failures for unreachable feeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Server Error", { status: 500 }))
    );

    const summary = await refreshDueFeeds(db);
    const feedError = summary.errors.find((e) => e.includes(testFeedId));
    expect(feedError).toBeTruthy();

    const status = db
      .prepare("SELECT * FROM feed_fetch_status WHERE feed_id = ?")
      .get(testFeedId) as FetchStatusRow | undefined;
    expect(status!.failure_count).toBe(1);
  });

  it("skips overlapping scheduled executions until the active task settles", async () => {
    vi.useFakeTimers();
    const resolvers: Array<() => void> = [];
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        })
    );
    const stop = scheduleNonOverlappingTask("test batch", task, 1_000, 100);

    await vi.advanceTimersByTimeAsync(100);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(task).toHaveBeenCalledTimes(1);

    resolvers.shift()?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(task).toHaveBeenCalledTimes(2);

    resolvers.shift()?.();
    await Promise.resolve();
    stop();
    vi.useRealTimers();
  });
});
