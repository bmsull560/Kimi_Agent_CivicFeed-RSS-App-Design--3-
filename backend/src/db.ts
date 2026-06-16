import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { feeds } from "./feeds.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.CIVICFEED_DB_PATH || path.resolve(__dirname, "../data/civicfeed.db");

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

    CREATE TABLE IF NOT EXISTS article_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT NOT NULL,
      feed_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'extractive',
      created_at INTEGER NOT NULL,
      UNIQUE(entry_id)
    );

    CREATE TABLE IF NOT EXISTS article_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT NOT NULL,
      feed_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'rss',
      UNIQUE(entry_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_summaries_entry_id ON article_summaries(entry_id);
    CREATE INDEX IF NOT EXISTS idx_tags_entry_id ON article_tags(entry_id);

    -- Full-text search virtual table (self-contained, not contentless)
    CREATE VIRTUAL TABLE IF NOT EXISTS article_search USING fts5(
      entry_id,
      title,
      description,
      summary,
      tags
    );

    -- Trigger: index on article_cache insert
    CREATE TRIGGER IF NOT EXISTS trg_article_search_insert
    AFTER INSERT ON article_cache
    BEGIN
      INSERT INTO article_search(entry_id, title, description, summary, tags)
      VALUES (
        NEW.entry_id,
        NEW.title,
        COALESCE(NEW.description, ''),
        '',
        COALESCE(NEW.categories, '')
      );
    END;

    -- Trigger: delete from index on article_cache delete
    CREATE TRIGGER IF NOT EXISTS trg_article_search_delete
    AFTER DELETE ON article_cache
    BEGIN
      DELETE FROM article_search WHERE entry_id = OLD.entry_id;
    END;
  `);

  // Migration: drop and recreate if using old contentless schema
  const tableInfo = db.prepare("PRAGMA table_info(article_search)").all() as any[];
  const hasRankCol = tableInfo.some((c) => c.name === "rank");
  if (tableInfo.length > 0 && !hasRankCol) {
    // Old broken contentless table — rebuild
    db.exec(`DROP TABLE IF EXISTS article_search;`);
    db.exec(`
      CREATE VIRTUAL TABLE article_search USING fts5(
        entry_id, title, description, summary, tags
      );
    `);
    console.log("Recreated article_search FTS5 table (was contentless).");
  }

  // Populate FTS index from existing cached articles (one-time)
  const ftsCount = (db.prepare("SELECT COUNT(*) as c FROM article_search").get() as any).c;
  const cacheCount = (db.prepare("SELECT COUNT(*) as c FROM article_cache").get() as any).c;
  if (ftsCount === 0 && cacheCount > 0) {
    const rows = db.prepare("SELECT entry_id, title, description, categories FROM article_cache").all() as any[];
    const insert = db.prepare("INSERT INTO article_search(entry_id, title, description, summary, tags) VALUES (?, ?, ?, ?, ?)");
    db.transaction(() => {
      for (const r of rows) {
        insert.run(r.entry_id, r.title, r.description || '', '', r.categories || '');
      }
    })();
    console.log(`Populated FTS index with ${rows.length} articles.`);
  }
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
