import type Database from "better-sqlite3";

export interface Migration {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
}

function ensureMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getAppliedIds(db: Database.Database): number[] {
  ensureMigrationsTable(db);
  const rows = db.prepare("SELECT id FROM migrations ORDER BY id").all() as { id: number }[];
  return rows.map((r) => r.id);
}

/**
 * Apply all unapplied migrations in deterministic order.
 *
 * Safety guards:
 * - Migrations are applied inside a transaction and recorded in the migrations
 *   table atomically.
 * - If the database contains a migration ID higher than any ID in the provided
 *   list, the process throws rather than silently ignoring schema drift. This
 *   prevents an older code version from running against a newer database.
 * - The helper is idempotent: already-applied migrations are skipped.
 */
export function applyMigrations(db: Database.Database, migrations: Migration[], logger?: { info: (msg: string, ctx?: Record<string, unknown>) => void; warn: (msg: string, ctx?: Record<string, unknown>) => void }) {
  ensureMigrationsTable(db);

  const sorted = [...migrations].sort((a, b) => a.id - b.id);
  const applied = getAppliedIds(db);
  const appliedSet = new Set(applied);

  const maxApplied = applied.length > 0 ? Math.max(...applied) : 0;
  const maxKnown = sorted.length > 0 ? sorted[sorted.length - 1].id : 0;
  if (maxApplied > maxKnown) {
    throw new Error(
      `Database schema is ahead of application code: migration ${maxApplied} is applied but not known. ` +
        `Refusing to start until code is upgraded.`
    );
  }

  const insert = db.prepare("INSERT INTO migrations (id, name) VALUES (?, ?)");

  for (const migration of sorted) {
    if (appliedSet.has(migration.id)) continue;

    db.transaction(() => {
      migration.up(db);
      insert.run(migration.id, migration.name);
    })();

    logger?.info("migration applied", { id: migration.id, name: migration.name });
  }

  if (applied.length < sorted.length) {
    logger?.info("migrations up to date", { appliedCount: applied.length + (sorted.length - applied.length) });
  }
}

export const civicfeedMigrations: Migration[] = [
  {
    id: 1,
    name: "initial_schema",
    up: (db) => {
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
          tags TEXT
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
          categories TEXT,
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
      `);
    },
  },
  {
    id: 2,
    name: "fts5_search_index",
    up: (db) => {
      // Ensure we are using the self-contained FTS5 table (not the old contentless schema).
      const tableInfo = db.prepare("PRAGMA table_xinfo(article_search)").all() as { name: string; hidden: number }[];
      const hasRankCol = tableInfo.some((c) => c.name === "rank");
      if (tableInfo.length > 0 && !hasRankCol) {
        db.exec(`DROP TABLE IF EXISTS article_search;`);
      }

      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS article_search USING fts5(
          entry_id, title, description, summary, tags
        );

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

        CREATE TRIGGER IF NOT EXISTS trg_article_search_delete
        AFTER DELETE ON article_cache
        BEGIN
          DELETE FROM article_search WHERE entry_id = OLD.entry_id;
        END;
      `);

      // Populate the FTS index from existing cached articles if it is empty.
      const ftsCount = (db.prepare("SELECT COUNT(*) as c FROM article_search").get() as { c: number }).c;
      const cacheCount = (db.prepare("SELECT COUNT(*) as c FROM article_cache").get() as { c: number }).c;
      if (ftsCount === 0 && cacheCount > 0) {
        const rows = db.prepare("SELECT entry_id, title, description, categories FROM article_cache").all() as {
          entry_id: string;
          title: string;
          description: string | null;
          categories: string | null;
        }[];
        const insert = db.prepare("INSERT INTO article_search(entry_id, title, description, summary, tags) VALUES (?, ?, ?, ?, ?)");
        db.transaction(() => {
          for (const r of rows) {
            insert.run(r.entry_id, r.title, r.description || "", "", r.categories || "");
          }
        })();
      }
    },
  },
  {
    id: 3,
    name: "feed_fetch_status",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS feed_fetch_status (
          feed_id TEXT PRIMARY KEY,
          last_success_at INTEGER,
          last_error_at INTEGER,
          last_error_message TEXT,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          success_count INTEGER NOT NULL DEFAULT 0,
          failure_count INTEGER NOT NULL DEFAULT 0,
          next_fetch_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_feed_fetch_status_next_fetch_at
        ON feed_fetch_status(next_fetch_at);
      `);
    },
  },
  {
    id: 4,
    name: "feed_health_status",
    up: (db) => {
      db.exec(`
        ALTER TABLE feeds ADD COLUMN health_status TEXT CHECK(health_status IN ('ok', 'warn', 'fail'));
        ALTER TABLE feeds ADD COLUMN health_checked_at INTEGER;
        ALTER TABLE feeds ADD COLUMN health_error TEXT;
      `);
    },
  },
  {
    id: 5,
    name: "enrichment_jobs_queue",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS enrichment_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id TEXT NOT NULL,
          feed_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'done', 'failed')),
          priority INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          finished_at INTEGER,
          error TEXT,
          UNIQUE(entry_id)
        );

        CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status_created
        ON enrichment_jobs(status, priority DESC, created_at);
      `);
    },
  },
];
