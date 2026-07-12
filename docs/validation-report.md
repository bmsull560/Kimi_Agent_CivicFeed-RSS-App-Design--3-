# Smart Proxy Validation Report

This report is a reconstructed development snapshot for the `feature/smart-proxy` worktree. It documents how to validate the backend feed catalog after the deleted untracked helper files were rebuilt.

## Current Scope

- Backend catalog source: `backend/src/feeds.ts`
- Backend parser/fetch path: `backend/src/rss.ts`
- Backend article cache: SQLite via `backend/src/db.ts` and `backend/src/cache.ts`
- Backend validator: `backend/src/validate-feeds.ts`
- Backend ingester: `backend/src/ingest.ts`

## Commands

Run from `backend/`:

```bash
npm run build
npm run validate:feeds -- --limit 3
npm run validate:feeds:strict -- --limit 3
npm run ingest -- --limit 3
npm run ingest -- --limit 3 --enrich
```

Use `--limit` for smoke runs and `--feed feed-123` for a single-feed check. Omit `--limit` only when intentionally running the full live catalog.

## Validation Gates

The backend validator follows the same seven-gate model as the static app validator:

| Gate           | Failure level |
| -------------- | ------------- |
| Reachable      | fail          |
| Valid XML      | fail          |
| Valid schema   | fail          |
| Stable GUIDs   | fail          |
| Sane dates     | warn          |
| Usable content | warn          |
| Fresh          | warn          |

Strict mode exits nonzero for any warning, failure, missing result, or partial run mismatch.

## Interpreting Failures

The validator groups non-OK feeds by common causes:

- `404`, `403`, or `rate limited`: upstream server behavior
- `timeout`: feed did not respond within the backend timeout
- `html/non-feed response`: endpoint returned a non-feed page
- `schema`: missing required RSS or Atom fields
- `duplicate GUIDs`: item identity is unstable within a feed
- `stale`, `date issues`, or `content issues`: feed parsed but failed a warning gate

## Known Limitations

- This is a best-effort reconstruction, not the original deleted file contents.
- The backend validator prints results but does not replace the static app's `public/feed-health.json` workflow.
- Live results are time-sensitive because government RSS feeds can block, rate-limit, or change format.
- Enrichment is optional because it may call Ollama or OpenAI depending on environment variables.
