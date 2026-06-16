# Smart Proxy Superpowers

This folder documents the reconstructed durable capabilities for the `feature/smart-proxy` backend.

## RSS Proxy And Cache

The Express backend fetches feeds server-side through `backend/src/rss.ts`, normalizes RSS/Atom/RDF entries, and persists articles in SQLite through `backend/src/cache.ts`. This avoids browser-only CORS constraints and gives the app a durable article cache.

## Feed Ingestion

`backend/src/ingest.ts` seeds the feed catalog, fetches working feeds, and saves parsed articles. Use bounded smoke runs while developing:

```bash
npm run ingest -- --limit 3
```

Add `--enrich` only when local AI dependencies or API keys are intentionally available.

## Article Search

SQLite FTS5 indexing is defined in `backend/src/db.ts`, and query helpers live in `backend/src/search.ts`. Cached articles are searchable by title, description, generated summaries, and tags.

## AI Summaries And Tags

`backend/src/ai.ts` generates extractive summaries by default and can use Ollama or OpenAI when configured. Enrichment results are cached in `article_summaries` and `article_tags`.

## Weekly Recaps

`backend/src/recap.ts` groups recent cached articles by feed category and summarizes top tags for recap-style views.

## Feed Validation

`backend/src/validate-feeds.ts` provides backend-local RSS validation with grouped issue reporting and strict mode:

```bash
npm run validate:feeds -- --limit 3
npm run validate:feeds:strict -- --limit 3
```

The static app validator remains the source of truth for `public/feed-health.json`; the backend validator is for smart-proxy development and smoke testing.
