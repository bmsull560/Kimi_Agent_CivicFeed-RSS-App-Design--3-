import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { fetchFeed } from "./rss.js";
import { getCachedArticles, saveArticles } from "./cache.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
  }));
  res.json({ feeds });
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
  });
});

// Get articles for a feed (with caching)
app.get("/api/feeds/:id/articles", async (req, res) => {
  const feedId = req.params.id;

  const feedRow = db.prepare("SELECT * FROM feeds WHERE id = ?").get(feedId) as any;
  if (!feedRow) return res.status(404).json({ error: "Feed not found" });

  // Try cache first
  const cached = getCachedArticles(feedId);
  if (cached && cached.length > 0) {
    return res.json({
      entries: cached.map((a) => ({
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
      })),
      cached: true,
      error: null,
    });
  }

  // Fetch fresh
  const result = await fetchFeed(feedRow.rss_url, feedId, feedRow.name);
  if (result.error) {
    return res.status(502).json({ entries: [], cached: false, error: result.error });
  }

  saveArticles(feedId, result.entries);

  res.json({
    entries: result.entries,
    cached: false,
    error: null,
  });
});

// Cache stats
app.get("/api/stats/cache", (_req, res) => {
  const totalArticles = (db.prepare("SELECT COUNT(*) as c FROM article_cache").get() as any).c;
  const cachedFeeds = (db.prepare("SELECT COUNT(DISTINCT feed_id) as c FROM article_cache").get() as any).c;
  res.json({ totalArticles, cachedFeeds });
});

app.listen(PORT, () => {
  console.log(`CivicFeed backend listening on http://localhost:${PORT}`);
});
