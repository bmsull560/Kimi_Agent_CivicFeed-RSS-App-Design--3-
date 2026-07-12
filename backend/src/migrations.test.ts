import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applyMigrations, civicfeedMigrations, type Migration } from "./migrations.js";

describe("migrations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
  });

  it("applies all civicfeed migrations on a fresh database", () => {
    applyMigrations(db, civicfeedMigrations);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("feeds");
    expect(tableNames).toContain("article_cache");
    expect(tableNames).toContain("article_summaries");
    expect(tableNames).toContain("article_tags");
    expect(tableNames).toContain("article_search");
    expect(tableNames).toContain("feed_fetch_status");
    expect(tableNames).toContain("migrations");

    const applied = db.prepare("SELECT id FROM migrations ORDER BY id").all() as { id: number }[];
    expect(applied.map((a) => a.id)).toEqual(civicfeedMigrations.map((m) => m.id));
  });

  it("is idempotent", () => {
    applyMigrations(db, civicfeedMigrations);
    applyMigrations(db, civicfeedMigrations);
    applyMigrations(db, civicfeedMigrations);

    const applied = db.prepare("SELECT id FROM migrations ORDER BY id").all() as { id: number }[];
    expect(applied.map((a) => a.id)).toEqual(civicfeedMigrations.map((m) => m.id));
  });

  it("applies new migrations in order", () => {
    const firstMigration: Migration[] = [
      {
        id: 1,
        name: "create_widgets",
        up: (d) => d.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY)"),
      },
    ];
    applyMigrations(db, firstMigration);

    const secondMigration: Migration[] = [
      ...firstMigration,
      {
        id: 2,
        name: "add_widgets_name",
        up: (d) => d.exec("ALTER TABLE widgets ADD COLUMN name TEXT"),
      },
    ];
    applyMigrations(db, secondMigration);

    const cols = db.prepare("PRAGMA table_info(widgets)").all() as { name: string }[];
    expect(cols.some((c) => c.name === "name")).toBe(true);

    const applied = db.prepare("SELECT id FROM migrations ORDER BY id").all() as { id: number }[];
    expect(applied.map((a) => a.id)).toEqual([1, 2]);
  });

  it("refuses to run when the database is ahead of the application code", () => {
    const aheadMigration: Migration[] = [
      {
        id: 1,
        name: "create_widgets",
        up: (d) => d.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY)"),
      },
      {
        id: 2,
        name: "add_widgets_name",
        up: (d) => d.exec("ALTER TABLE widgets ADD COLUMN name TEXT"),
      },
    ];
    applyMigrations(db, aheadMigration);

    const rolledBackMigration: Migration[] = [aheadMigration[0]];
    expect(() => applyMigrations(db, rolledBackMigration)).toThrow(
      /ahead of application code/
    );
  });

  it("logs applied migrations", () => {
    const info = vi.fn();
    const warn = vi.fn();
    applyMigrations(
      db,
      [
        {
          id: 1,
          name: "create_widgets",
          up: (d) => d.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY)"),
        },
      ],
      { info, warn }
    );

    expect(info).toHaveBeenCalledWith("migration applied", { id: 1, name: "create_widgets" });
    expect(info).toHaveBeenCalledWith("migrations up to date", { appliedCount: 1 });
  });

  it("rebuilds a contentless article_search table", () => {
    // Simulate the old broken schema by creating a contentless FTS5 table.
    db.exec(`
      CREATE TABLE article_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        title TEXT NOT NULL,
        link TEXT NOT NULL,
        description TEXT,
        pub_date TEXT NOT NULL,
        author TEXT,
        categories TEXT,
        fetched_at INTEGER NOT NULL
      );
      CREATE VIRTUAL TABLE article_search USING fts5(entry_id, title, description, summary, tags, content='');
    `);

    applyMigrations(db, civicfeedMigrations);

    const tableInfo = db.prepare("PRAGMA table_xinfo(article_search)").all() as { name: string; hidden: number }[];
    expect(tableInfo.some((c) => c.name === "rank")).toBe(true);
  });

  it("populates article_search from existing article_cache", () => {
    applyMigrations(db, civicfeedMigrations);
    db.prepare("INSERT INTO article_cache (feed_id, entry_id, title, link, pub_date, fetched_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "feed-1", "entry-1", "Test Title", "https://example.com", new Date().toISOString(), Date.now()
    );

    const count = (db.prepare("SELECT COUNT(*) as c FROM article_search").get() as { c: number }).c;
    expect(count).toBe(1);
  });
});
