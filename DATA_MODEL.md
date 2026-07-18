# Data Model

Entities, relationships, schemas, indexes, migrations, and retention rules for the CivicFeed SQLite database.

## Database

- **Engine**: SQLite via better-sqlite3 (synchronous, native binding)
- **Journal mode**: WAL (Write-Ahead Logging) — set in db.ts on connection
- **Path**: Configured via CIVICFEED_DB_PATH (default: backend/data/civicfeed.db)
- **Test mode**: In-memory (:memory:) — set in vitest.config.ts

## Entity Relationships

```
feeds (1) ──────── (N) article_cache
  │                      │
  │                      ├── (1:1) article_summaries
  │                      ├── (N) article_tags
  │                      └── (1:1) article_search (FTS5, via triggers)
  │
  ├── (1:1) feed_fetch_status
  └── (N) enrichment_jobs

migrations (standalone tracking table)
```

## Tables

### feeds

The feed catalog. Seeded from backend/src/feeds.ts on startup or via npm run seed.

| Column            | Type    | Constraints               | Description                            |
| ----------------- | ------- | ------------------------- | -------------------------------------- |
| id                | TEXT    | PRIMARY KEY               | Unique feed identifier                 |
| name              | TEXT    | NOT NULL                  | Full feed name                         |
| short_name        | TEXT    | NOT NULL                  | Abbreviated name                       |
| agency            | TEXT    | NOT NULL                  | Publishing agency                      |
| description       | TEXT    |                           | Feed description                       |
| rss_url           | TEXT    | NOT NULL                  | RSS/Atom feed URL                      |
| website           | TEXT    | NOT NULL                  | Publisher website                      |
| department        | TEXT    |                           | Government department                  |
| category          | TEXT    | NOT NULL                  | Primary category                       |
| sub_category      | TEXT    |                           | Sub-category                           |
| content_type      | TEXT    |                           | Content type                           |
| update_frequency  | TEXT    |                           | Expected update frequency              |
| status            | TEXT    | NOT NULL                  | "working", "blocked", or "unverified"  |
| tags              | TEXT    |                           | JSON array of tags                     |
| health_status     | TEXT    | CHECK in (ok, warn, fail) | Feed health status (migration 4)       |
| health_checked_at | INTEGER |                           | Last health check timestamp (epoch ms) |
| health_error      | TEXT    |                           | Last health check error message        |

**Seeding**: Upsert with ON CONFLICT(id) DO UPDATE. Orphaned feeds (not in feeds.ts) are deleted in the same transaction.

### article_cache

Cached articles from RSS feeds. 15-minute TTL enforced on read and save.

| Column      | Type    | Constraints               | Description                                   |
| ----------- | ------- | ------------------------- | --------------------------------------------- |
| id          | INTEGER | PRIMARY KEY AUTOINCREMENT | Row ID                                        |
| feed_id     | TEXT    | NOT NULL, FK to feeds.id  | Source feed                                   |
| entry_id    | TEXT    | NOT NULL                  | Entry identifier (hash of link+title+pubDate) |
| title       | TEXT    | NOT NULL                  | Article title                                 |
| link        | TEXT    | NOT NULL                  | Article URL                                   |
| description | TEXT    |                           | Article description                           |
| pub_date    | TEXT    | NOT NULL                  | Publication date (ISO 8601)                   |
| author      | TEXT    |                           | Author if available                           |
| categories  | TEXT    |                           | JSON array of categories                      |
| fetched_at  | INTEGER | NOT NULL                  | Fetch timestamp (epoch ms)                    |

**Constraints**: UNIQUE(feed_id, entry_id) — prevents duplicate entries per feed.

**Indexes**:

- idx_article_cache_feed_id on feed_id
- idx_article_cache_fetched_at on fetched_at

**Retention**: Entries older than 2x TTL (30 minutes) are pruned on each saveArticles call.

### article_summaries

AI-generated summaries for cached articles.

| Column     | Type    | Constraints                   | Description                         |
| ---------- | ------- | ----------------------------- | ----------------------------------- |
| id         | INTEGER | PRIMARY KEY AUTOINCREMENT     | Row ID                              |
| entry_id   | TEXT    | NOT NULL, UNIQUE              | Entry identifier                    |
| feed_id    | TEXT    | NOT NULL                      | Source feed                         |
| summary    | TEXT    | NOT NULL                      | Summary text                        |
| source     | TEXT    | NOT NULL DEFAULT 'extractive' | "ollama", "openai", or "extractive" |
| created_at | INTEGER | NOT NULL                      | Creation timestamp (epoch ms)       |

**Indexes**: idx_summaries_entry_id on entry_id

### article_tags

AI-generated and RSS-category tags for cached articles.

| Column   | Type    | Constraints               | Description      |
| -------- | ------- | ------------------------- | ---------------- |
| id       | INTEGER | PRIMARY KEY AUTOINCREMENT | Row ID           |
| entry_id | TEXT    | NOT NULL                  | Entry identifier |
| feed_id  | TEXT    | NOT NULL                  | Source feed      |
| tag      | TEXT    | NOT NULL                  | Tag text         |
| source   | TEXT    | NOT NULL DEFAULT 'rss'    | "rss" or "nlp"   |

**Constraints**: UNIQUE(entry_id, tag) — prevents duplicate tags per entry.

**Indexes**: idx_tags_entry_id on entry_id

### article_search

FTS5 virtual table for full-text search. Kept in sync via triggers on article_cache.

| Column      | Type | Description                   |
| ----------- | ---- | ----------------------------- |
| entry_id    | TEXT | Entry identifier (indexed)    |
| title       | TEXT | Article title (indexed)       |
| description | TEXT | Article description (indexed) |
| summary     | TEXT | AI summary (indexed)          |
| tags        | TEXT | Tags (indexed)                |

**Triggers**:

- trg_article_search_insert: AFTER INSERT on article_cache, inserts into article_search
- trg_article_search_delete: AFTER DELETE on article_cache, deletes from article_search

**Population**: On migration, existing article_cache rows are backfilled into article_search if the FTS table is empty.

### feed_fetch_status

Per-feed fetch diagnostics for the scheduler.

| Column             | Type    | Constraints                 | Description                       |
| ------------------ | ------- | --------------------------- | --------------------------------- |
| feed_id            | TEXT    | PRIMARY KEY, FK to feeds.id | Feed identifier                   |
| last_success_at    | INTEGER |                             | Epoch ms of last successful fetch |
| last_error_at      | INTEGER |                             | Epoch ms of last failed fetch     |
| last_error_message | TEXT    |                             | Last error message                |
| attempt_count      | INTEGER | NOT NULL DEFAULT 0          | Total fetch attempts              |
| success_count      | INTEGER | NOT NULL DEFAULT 0          | Successful fetches                |
| failure_count      | INTEGER | NOT NULL DEFAULT 0          | Failed fetches                    |
| next_fetch_at      | INTEGER |                             | Epoch ms of next scheduled fetch  |

**Indexes**: idx_feed_fetch_status_next_fetch_at on next_fetch_at

**Scheduling logic**:

- Success: next_fetch_at = now + 15 minutes (SUCCESS_INTERVAL_MS)
- Failure: next_fetch_at = now + 5 minutes (FAILURE_INTERVAL_MS)

### enrichment_jobs

Queue for asynchronous AI enrichment processing.

| Column      | Type    | Constraints                                                           | Description                         |
| ----------- | ------- | --------------------------------------------------------------------- | ----------------------------------- |
| id          | INTEGER | PRIMARY KEY AUTOINCREMENT                                             | Row ID                              |
| entry_id    | TEXT    | NOT NULL, UNIQUE                                                      | Entry identifier                    |
| feed_id     | TEXT    | NOT NULL                                                              | Source feed                         |
| title       | TEXT    | NOT NULL                                                              | Article title                       |
| description | TEXT    | NOT NULL                                                              | Article description                 |
| status      | TEXT    | NOT NULL DEFAULT 'pending', CHECK in (pending, running, done, failed) | Job status                          |
| priority    | INTEGER | NOT NULL DEFAULT 0                                                    | Priority (higher = processed first) |
| created_at  | INTEGER | NOT NULL                                                              | Creation timestamp (epoch ms)       |
| started_at  | INTEGER |                                                                       | When job was claimed (epoch ms)     |
| finished_at | INTEGER |                                                                       | When job completed (epoch ms)       |
| error       | TEXT    |                                                                       | Error message if failed             |

**Indexes**: idx_enrichment_jobs_status_created on (status, priority DESC, created_at)

**Job lifecycle**: pending -> running (claimed by worker) -> done or failed

### migrations

Migration tracking table.

| Column     | Type    | Constraints                        | Description                |
| ---------- | ------- | ---------------------------------- | -------------------------- |
| id         | INTEGER | PRIMARY KEY                        | Migration number           |
| name       | TEXT    | NOT NULL                           | Migration name             |
| applied_at | TEXT    | NOT NULL DEFAULT CURRENT_TIMESTAMP | When migration was applied |

## Migration System

Migrations are defined in backend/src/migrations.ts. They are:

- **Numbered**: Each migration has a unique integer ID
- **Transactional**: Applied inside a database transaction with the tracking record insert
- **Idempotent**: Already-applied migrations are skipped
- **Schema-drift protected**: If the database has a migration ID higher than any known migration, the process throws and refuses to start

### Applied Migrations

| ID  | Name                  | Description                                                                                                  |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | initial_schema        | Creates feeds, article_cache, article_summaries, article_tags tables with indexes                            |
| 2   | fts5_search_index     | Creates article_search FTS5 virtual table with insert/delete triggers; backfills from existing article_cache |
| 3   | feed_fetch_status     | Creates feed_fetch_status table with index on next_fetch_at                                                  |
| 4   | feed_health_status    | Adds health_status, health_checked_at, health_error columns to feeds table                                   |
| 5   | enrichment_jobs_queue | Creates enrichment_jobs table with index on status and priority                                              |

### Adding a New Migration

1. Add a new object to the civicfeedMigrations array in migrations.ts
2. Use the next sequential ID number
3. Provide a descriptive name
4. Write the up function with CREATE TABLE IF NOT EXISTS / ALTER TABLE statements
5. Test with a fresh database and an existing database

### Inspecting Applied Migrations

```bash
cd backend
sqlite3 data/civicfeed.db "SELECT id, name, applied_at FROM migrations ORDER BY id;"
```

## Data Ownership and Retention

| Data                                               | Location                 | Lifetime         | Notes                                               |
| -------------------------------------------------- | ------------------------ | ---------------- | --------------------------------------------------- |
| Feed catalog                                       | backend/src/feeds.ts     | Shipped with app | Single source of truth, synced to SQLite on startup |
| Article cache                                      | SQLite article_cache     | 15-minute TTL    | Old entries pruned on save (2x TTL threshold)       |
| AI summaries                                       | SQLite article_summaries | Per-deployment   | Persist until database reset                        |
| AI tags                                            | SQLite article_tags      | Per-deployment   | Persist until database reset                        |
| Feed fetch status                                  | SQLite feed_fetch_status | Per-deployment   | Cumulative counters, not pruned                     |
| Enrichment jobs                                    | SQLite enrichment_jobs   | Per-deployment   | Jobs remain in terminal state (done/failed)         |
| User state (bookmarks, read, archive, preferences) | Browser localStorage     | Per-browser      | No encryption at rest, no cloud sync                |
