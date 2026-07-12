import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { fetchFeed } from "./rss.js";
import { getCachedArticles, saveArticles } from "./cache.js";
import { getCachedEnrichment } from "./ai.js";
import { enqueueArticleEnrichment } from "./enrichment-queue.js";
import { searchArticles, getRecentArticles, parseTags } from "./search.js";
import { generateRecap } from "./recap.js";
import { logger } from "./logger.js";
import { startFeedRefreshScheduler } from "./scheduler.js";
import { discoverFeeds } from "./discovery.js";
import { validateFeedHealth, type FeedHealth } from "./feed-health.js";
import { feeds, type Feed } from "./feeds.js";

export const app = express();
const PORT = process.env.PORT || 4000;
const startTime = Date.now();

app.use(cors());
app.use(express.json());

// Structured request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userAgent: req.get("user-agent"),
    });
  });
  next();
});

// Health check
app.get("/api/health", (_req, res) => {
  let dbHealthy = false;
  let feedsCount = 0;
  try {
    feedsCount = (db.prepare("SELECT COUNT(*) as c FROM feeds").get() as any).c;
    dbHealthy = true;
  } catch (error) {
    logger.error("health check database query failed", error);
  }

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: dbHealthy,
      feedsCount,
    },
  });
});

// Readiness check
app.get("/api/ready", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ready: true, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error("readiness check failed", error);
    res.status(503).json({ ready: false, timestamp: new Date().toISOString() });
  }
});

// List all feeds
app.get("/api/feeds", (_req, res) => {
  const rows = db.prepare("SELECT * FROM feeds ORDER BY name").all() as any[];
  const feeds = rows.map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.short_name,
    agency: r.agency,
    description: r.description,
    rssUrl: r.rss_url,
    website: r.website,
    department: r.department,
    category: r.category,
    subCategory: r.sub_category,
    contentType: r.content_type,
    updateFrequency: r.update_frequency,
    status: r.status,
    tags: JSON.parse(r.tags),
    healthStatus: r.health_status,
    healthCheckedAt: r.health_checked_at,
    healthError: r.health_error,
  }));

  const categories = new Set<string>();
  for (const feed of feeds) categories.add(feed.category);
  const categoryList = [...categories].sort();

  const totalFeeds = feeds.length;
  const workingFeeds = feeds.filter((f) => f.status === "working").length;
  const feedStats = { total: totalFeeds, working: workingFeeds, categories: categoryList.length };

  res.json({ feeds, categoryList, feedStats });
});

// Get single feed
app.get("/api/feeds/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM feeds WHERE id = ?").get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Feed not found" });
  res.json({
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    agency: row.agency,
    description: row.description,
    rssUrl: row.rss_url,
    website: row.website,
    department: row.department,
    category: row.category,
    subCategory: row.sub_category,
    contentType: row.content_type,
    updateFrequency: row.update_frequency,
    status: row.status,
    tags: JSON.parse(row.tags),
    healthStatus: row.health_status,
    healthCheckedAt: row.health_checked_at,
    healthError: row.health_error,
  });
});

// Get feed fetch status
app.get("/api/feeds/:id/status", (req, res) => {
  const feedId = req.params.id;
  const feed = db.prepare("SELECT id FROM feeds WHERE id = ?").get(feedId) as any;
  if (!feed) return res.status(404).json({ error: "Feed not found" });

  const row = db.prepare("SELECT * FROM feed_fetch_status WHERE feed_id = ?").get(feedId) as any;
  const status = row
    ? {
        feedId: row.feed_id,
        lastSuccessAt: row.last_success_at,
        lastErrorAt: row.last_error_at,
        lastErrorMessage: row.last_error_message,
        attemptCount: row.attempt_count,
        successCount: row.success_count,
        failureCount: row.failure_count,
        nextFetchAt: row.next_fetch_at,
      }
    : {
        feedId,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        attemptCount: 0,
        successCount: 0,
        failureCount: 0,
        nextFetchAt: null,
      };

  res.json(status);
});

// Get feed health
app.get("/api/feeds/:id/health", async (req, res) => {
  const feedId = req.params.id;
  const feedRow = db.prepare("SELECT * FROM feeds WHERE id = ?").get(feedId) as any;
  if (!feedRow) return res.status(404).json({ error: "Feed not found" });

  const feed: Feed = {
    id: feedRow.id,
    name: feedRow.name,
    shortName: feedRow.short_name,
    agency: feedRow.agency,
    description: feedRow.description,
    rssUrl: feedRow.rss_url,
    website: feedRow.website,
    department: feedRow.department,
    category: feedRow.category,
    subCategory: feedRow.sub_category,
    contentType: feedRow.content_type,
    updateFrequency: feedRow.update_frequency,
    status: feedRow.status,
    tags: JSON.parse(feedRow.tags),
  };

  const health = await validateFeedHealth(feed);
  res.json(health);
});

// Get articles for a feed (backend cache + async AI enrichment queue)
app.get("/api/feeds/:id/articles", async (req, res) => {
  const feedId = req.params.id;

  const feedRow = db.prepare("SELECT * FROM feeds WHERE id = ?").get(feedId) as any;
  if (!feedRow) return res.status(404).json({ error: "Feed not found" });

  let entries: any[];
  let fromCache = false;

  // Try cache first
  const cached = getCachedArticles(feedId);
  if (cached && cached.length > 0) {
    entries = cached.map((a) => ({
      id: a.entryId,
      title: a.title,
      link: a.link,
      description: a.description,
      pubDate: a.pubDate,
      author: a.author || undefined,
      categories: a.categories || undefined,
      feedId: a.feedId,
      feedName: feedRow.name,
      fetchedAt: a.fetchedAt,
    }));
    fromCache = true;
  } else {
    // Fetch fresh
    const result = await fetchFeed(feedRow.rss_url, feedId, feedRow.name);
    if (result.error) {
      return res.status(502).json({ entries: [], cached: false, error: result.error });
    }
    entries = result.entries;
    saveArticles(feedId, result.entries);
  }

  // Attach cached enrichments and queue missing ones for background processing.
  const enrichedEntries = entries.map((entry) => {
    const enrichment = getCachedEnrichment(entry.id);
    if (!enrichment) {
      enqueueArticleEnrichment(entry.id, feedId, entry.title, entry.description);
    }
    return {
      ...entry,
      aiSummary: enrichment?.summary,
      aiSummarySource: enrichment?.summarySource,
      aiTags: enrichment?.tags,
    };
  });

  const etag = `"feed-${feedId}-${entries[0]?.fetchedAt ?? 0}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, must-revalidate, max-age=60");

  res.json({
    entries: enrichedEntries,
    cached: fromCache,
    error: null,
  });
});

// Search articles
app.get("/api/search", (req, res) => {
  const q = (req.query.q as string) || "";
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  if (!q.trim()) {
    const recent = getRecentArticles(limit);
    return res.json({ query: "", results: recent, total: recent.length });
  }
  const results = searchArticles(q, limit);
  res.json({ query: q, results, total: results.length });
});

// Recent articles (optionally filtered by source feed)
app.get("/api/articles/recent", (req, res) => {
  const source = (req.query.source as string) || "";
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  let results = getRecentArticles(limit);
  if (source) {
    results = results.filter((r) => r.feedId === source);
  }
  res.json({ results });
});

// Fetch cached articles by entry id (used for bookmarks/archive)
app.post("/api/articles/by-ids", express.json(), (req, res) => {
  const ids = req.body?.ids as string[] | undefined;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.json({ results: [] });
  }
  const cappedIds = ids.slice(0, 500);
  const placeholders = cappedIds.map(() => "?").join(",");

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
    WHERE ac.entry_id IN (${placeholders})
  `);

  const rows = stmt.all(...cappedIds) as any[];
  const results = rows.map((r) => ({
    entryId: r.entry_id,
    feedId: r.feed_id,
    title: r.title,
    link: r.link,
    description: r.description,
    pubDate: r.pub_date,
    author: r.author,
    feedName: r.feed_name,
    aiSummary: r.ai_summary,
    aiTags: parseTags(r.ai_tags),
  }));

  res.json({ results });
});

// Weekly recap
app.get("/api/recap", (_req, res) => {
  const days = Math.min(parseInt(_req.query.days as string) || 7, 30);
  const recap = generateRecap(days);
  res.json(recap);
});

// Cache stats
app.get("/api/stats/cache", (_req, res) => {
  const totalArticles = (db.prepare("SELECT COUNT(*) as c FROM article_cache").get() as any).c;
  const cachedFeeds = (db.prepare("SELECT COUNT(DISTINCT feed_id) as c FROM article_cache").get() as any).c;
  res.json({ totalArticles, cachedFeeds });
});

// Feed stats
app.get("/api/stats/feeds", (_req, res) => {
  const totalFeeds = (db.prepare("SELECT COUNT(*) as c FROM feeds").get() as any).c;
  const workingFeeds = (db.prepare("SELECT COUNT(*) as c FROM feeds WHERE status = 'working'").get() as any).c;
  const feedsWithStatus = (db.prepare("SELECT COUNT(*) as c FROM feed_fetch_status").get() as any).c;
  const feedsWithRecentError = (db.prepare(`
    SELECT COUNT(DISTINCT feed_id) as c FROM feed_fetch_status
    WHERE last_error_at IS NOT NULL
      AND (last_success_at IS NULL OR last_error_at > last_success_at)
  `).get() as any).c;
  const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;
  const staleFeeds = (db.prepare(`
    SELECT COUNT(*) as c FROM feed_fetch_status
    WHERE last_success_at IS NOT NULL AND last_success_at < ?
  `).get(staleThreshold) as any).c;

  res.json({
    totalFeeds,
    workingFeeds,
    feedsWithStatus,
    feedsWithRecentError,
    staleFeeds,
  });
});

// Feed discovery
app.get("/api/discover", async (req, res) => {
  const url = (req.query.url as string) || "";
  const isValidHttpUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  if (!url || !isValidHttpUrl(url)) {
    return res.status(400).json({ error: "A valid HTTP/HTTPS URL is required" });
  }

  try {
    const feeds = await discoverFeeds(url);
    res.json({ feeds });
  } catch (error) {
    logger.error("feed discovery failed", error);
    res.status(502).json({ feeds: [], error: "Discovery failed" });
  }
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("unhandled request error", err);
  res.status(500).json({ error: "Internal server error" });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const refreshIntervalMs = Number(process.env.CIVICFEED_REFRESH_INTERVAL_MS) || 60_000;
  const disableScheduler = process.env.CIVICFEED_DISABLE_SCHEDULER === "1";
  const server = app.listen(PORT, () => {
    logger.info("server started", { port: PORT, refreshIntervalMs, schedulerDisabled: disableScheduler });
  });

  const stopScheduler = disableScheduler ? () => {} : startFeedRefreshScheduler(db, refreshIntervalMs);

  const shutdown = () => {
    stopScheduler();
    server.close(() => {
      logger.info("server stopped");
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
