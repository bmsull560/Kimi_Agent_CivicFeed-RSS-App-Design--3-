import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { feeds } from "./feeds.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data/civicfeed.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      agency TEXT NOT NULL,
      description TEXT,
      rss_url TEXT NOT NULL,
      website TEXT NOT NULL,
      department TEXT,
      category TEXT NOT NULL,
      sub_category TEXT,
      content_type TEXT,
      update_frequency TEXT,
      status TEXT NOT NULL,
      tags TEXT -- JSON array
    );

    CREATE TABLE IF NOT EXISTS article_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      description TEXT,
      pub_date TEXT NOT NULL,
      author TEXT,
      categories TEXT, -- JSON array
      fetched_at INTEGER NOT NULL,
      UNIQUE(feed_id, entry_id)
    );

    CREATE INDEX IF NOT EXISTS idx_article_cache_feed_id ON article_cache(feed_id);
    CREATE INDEX IF NOT EXISTS idx_article_cache_fetched_at ON article_cache(fetched_at);
  `);
}

function seedFeeds() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO feeds
    (id, name, short_name, agency, description, rss_url, website, department, category, sub_category, content_type, update_frequency, status, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const feed of feeds) {
    insert.run(
      feed.id,
      feed.name,
      feed.shortName,
      feed.agency,
      feed.description,
      feed.rssUrl,
      feed.website,
      feed.department,
      feed.category,
      feed.subCategory,
      feed.contentType,
      feed.updateFrequency,
      feed.status,
      JSON.stringify(feed.tags)
    );
  }

  console.log(`Seeded ${feeds.length} feeds.`);
}

initSchema();

// Auto-seed if running directly or if --seed flag passed
if (process.argv.includes("--seed") || import.meta.url === `file://${process.argv[1]}`) {
  seedFeeds();
}

export { seedFeeds };
