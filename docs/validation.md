# Feed Validation

CivicFeed validates all 623 government RSS feeds on a continuous schedule to surface health status in the app.

## Running Locally

```bash
npm run validate:feeds
```

This fetches every feed, runs the 7 validation gates, and writes `public/feed-health.json`.

## Validation Gates

| Gate | Description | Severity |
|------|-------------|----------|
| **Reachable** | HTTP 200, XML content-type, < 10s response, no TLS/cert errors, no redirect loops | FAIL |
| **Valid XML** | Parses without errors, root is `<rss>`, `<feed>`, or `<RDF>`, valid UTF-8 | FAIL |
| **Valid Schema** | RSS 2.0: channel.title/link/description + item.title/link-or-guid/pubDate. Atom: feed.title/id/updated + entry.id/title/updated/link | FAIL |
| **Stable GUIDs** | Every item has a stable ID, no duplicates within feed, GUIDs don't change between runs | FAIL |
| **Sane Dates** | pubDate parses correctly, not > 10 min in future, items roughly newest-first | WARN |
| **Usable Content** | Non-empty titles, non-empty descriptions/content, resolveable links | WARN |
| **Fresh** | Newest item < 7 days old | WARN/FAIL |

## Severity Levels

- **FAIL** — Feed is down, invalid XML, missing required fields, or has duplicate GUIDs
- **WARN** — Feed works but is stale, has date issues, or missing optional content
- **OK** — All gates pass

## CI Schedule

GitHub Actions runs the validator every 6 hours:

```yaml
cron: "0 */6 * * *"
```

Results are committed back to `public/feed-health.json` so the static app ships with current health data.

## Client-Side Enrichment

When a user views a specific feed, the browser fetch path performs lightweight validation (duplicate GUID detection, future-date checks, empty-title checks) and logs warnings to the console. This helps debug CORS-specific issues that the server-side validator may not see.
