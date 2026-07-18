# API Reference

REST API conventions, endpoints, error formats, and response examples for the CivicFeed backend.

## Conventions

- **Base URL**: Same-origin /api (proxied by nginx in production, Vite in dev) or http://localhost:4000 in local development
- **Authentication**: None — all endpoints are public
- **Content-Type**: application/json for all responses and request bodies
- **Error format**: { "error": "message" } with appropriate HTTP status code
- **Pagination**: limit and offset query parameters where applicable (no Link headers)
- **CORS**: Enabled globally via express cors middleware
- **Caching**: Articles endpoint returns ETag and Cache-Control: private, must-revalidate, max-age=60

## Error Codes

| Status | Meaning               | Example                                                              |
| ------ | --------------------- | -------------------------------------------------------------------- |
| 200    | Success               | Normal response                                                      |
| 400    | Bad request           | Invalid URL for discovery, empty search query returns recent instead |
| 404    | Not found             | Feed ID does not exist                                               |
| 500    | Internal server error | Unhandled exception                                                  |
| 502    | Bad gateway           | RSS fetch failed, feed discovery failed                              |

## Endpoints

### GET /api/health

Health check — verifies database connectivity and returns feed count.

**Response 200** (database healthy):

| Field             | Type    | Description              |
| ----------------- | ------- | ------------------------ |
| status            | string  | "ok" or "degraded"       |
| timestamp         | string  | ISO 8601 timestamp       |
| uptimeSeconds     | number  | Server uptime in seconds |
| checks.database   | boolean | Database connectivity    |
| checks.feedsCount | number  | Total feeds in catalog   |

**Response 503** (database unhealthy): same shape with status "degraded" and database false.

### GET /api/ready

Readiness probe — lightweight database ping.

**Response 200**: { "ready": true, "timestamp": "..." }
**Response 503**: { "ready": false, "timestamp": "..." }

### GET /api/feeds

List all feeds in the catalog.

**Response 200**:

| Field                | Type     | Description                      |
| -------------------- | -------- | -------------------------------- |
| feeds                | Feed[]   | Array of all feeds (590+)        |
| categoryList         | string[] | Sorted list of unique categories |
| feedStats.total      | number   | Total feed count                 |
| feedStats.working    | number   | Feeds with status "working"      |
| feedStats.categories | number   | Number of unique categories      |

**Feed object shape**:

| Field           | Type           | Description                            |
| --------------- | -------------- | -------------------------------------- |
| id              | string         | Unique feed identifier                 |
| name            | string         | Full feed name                         |
| shortName       | string         | Abbreviated name                       |
| agency          | string         | Publishing agency                      |
| description     | string         | Feed description                       |
| rssUrl          | string         | RSS/Atom feed URL                      |
| website         | string         | Publisher website                      |
| department      | string         | Government department                  |
| category        | string         | Primary category                       |
| subCategory     | string         | Sub-category                           |
| contentType     | string         | Content type                           |
| updateFrequency | string         | Expected update frequency              |
| status          | string         | "working", "blocked", or "unverified"  |
| tags            | string[]       | Feed tags                              |
| healthStatus    | string or null | "ok", "warn", "fail", or null          |
| healthCheckedAt | number or null | Last health check timestamp (epoch ms) |
| healthError     | string or null | Last health check error message        |

### GET /api/feeds/:id

Get a single feed by ID.

**Response 200**: Single Feed object (same shape as above).
**Response 404**: { "error": "Feed not found" }

### GET /api/feeds/:id/status

Get feed fetch status — diagnostics for the background scheduler.

**Response 200**:

| Field            | Type           | Description                       |
| ---------------- | -------------- | --------------------------------- |
| feedId           | string         | Feed identifier                   |
| lastSuccessAt    | number or null | Epoch ms of last successful fetch |
| lastErrorAt      | number or null | Epoch ms of last failed fetch     |
| lastErrorMessage | string or null | Last error message                |
| attemptCount     | number         | Total fetch attempts              |
| successCount     | number         | Successful fetches                |
| failureCount     | number         | Failed fetches                    |
| nextFetchAt      | number or null | Epoch ms of next scheduled fetch  |

**Response 404**: { "error": "Feed not found" }

### GET /api/feeds/:id/health

Trigger a feed health check and return results. Performs a live HTTP request to the feed URL.

**Response 200**:

| Field                | Type           | Description                       |
| -------------------- | -------------- | --------------------------------- |
| feedId               | string         | Feed identifier                   |
| status               | string         | "ok", "warn", or "fail"           |
| checks.reachable     | boolean        | Feed URL is reachable             |
| checks.validXml      | boolean        | Response is valid XML             |
| checks.validSchema   | boolean        | XML matches RSS/Atom schema       |
| checks.stableGuids   | boolean        | Entry GUIDs are stable            |
| checks.saneDates     | boolean        | Publication dates are reasonable  |
| checks.usableContent | boolean        | Entries have usable content       |
| checks.fresh         | boolean        | Feed has recent entries           |
| newestItemDate       | string or null | Date of newest entry              |
| responseTimeMs       | number         | Response time in milliseconds     |
| lastValidatedAt      | number         | Validation timestamp (epoch ms)   |
| error                | string         | Error message if status is "fail" |

**Response 404**: { "error": "Feed not found" }

### GET /api/feeds/:id/articles

Get articles for a feed. Returns cached articles if available (15-minute TTL), otherwise fetches fresh.

**Query Parameters**:

| Param  | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| (none) |      |         |             |

**Response 200**:

| Field   | Type           | Description                     |
| ------- | -------------- | ------------------------------- |
| entries | Article[]      | Array of articles               |
| cached  | boolean        | Whether entries came from cache |
| error   | string or null | Error message if any            |

**Article object shape**:

| Field           | Type                  | Description                                   |
| --------------- | --------------------- | --------------------------------------------- |
| id              | string                | Entry identifier (hash of link+title+pubDate) |
| title           | string                | Article title                                 |
| link            | string                | Article URL                                   |
| description     | string                | Article description/summary                   |
| pubDate         | string                | Publication date (ISO 8601)                   |
| author          | string or undefined   | Author if available                           |
| categories      | string[] or undefined | RSS categories                                |
| feedId          | string                | Source feed ID                                |
| feedName        | string                | Source feed name                              |
| fetchedAt       | number                | Fetch timestamp (epoch ms)                    |
| aiSummary       | string or undefined   | AI-generated summary                          |
| aiSummarySource | string or undefined   | "ollama", "openai", or "extractive"           |
| aiTags          | string[] or undefined | AI-generated tags                             |

**Response headers**: ETag and Cache-Control: private, must-revalidate, max-age=60

**Response 404**: { "error": "Feed not found" }
**Response 502**: { "entries": [], "cached": false, "error": "..." }

### GET /api/search

Full-text search over cached articles using FTS5.

**Query Parameters**:

| Param  | Type   | Default | Max | Description                            |
| ------ | ------ | ------- | --- | -------------------------------------- |
| q      | string | ""      |     | Search query (min 2 chars for results) |
| limit  | number | 20      | 100 | Results per page                       |
| offset | number | 0       |     | Pagination offset                      |

**Response 200** (with query):

| Field   | Type           | Description                         |
| ------- | -------------- | ----------------------------------- |
| query   | string         | The search query                    |
| results | SearchResult[] | Search results ordered by FTS5 rank |
| total   | number         | Number of results                   |

**Response 200** (empty query): returns recent articles instead.

**SearchResult shape**:

| Field       | Type                  | Description             |
| ----------- | --------------------- | ----------------------- |
| entryId     | string                | Entry identifier        |
| feedId      | string                | Source feed ID          |
| title       | string                | Article title           |
| link        | string                | Article URL             |
| description | string                | Article description     |
| pubDate     | string                | Publication date        |
| author      | string or null        | Author                  |
| feedName    | string                | Source feed name        |
| rank        | number                | FTS5 relevance rank     |
| aiSummary   | string or undefined   | AI summary if available |
| aiTags      | string[] or undefined | AI tags if available    |

### GET /api/articles/recent

Get most recently cached articles across all feeds.

**Query Parameters**:

| Param  | Type   | Default | Max | Description       |
| ------ | ------ | ------- | --- | ----------------- |
| source | string | ""      |     | Filter by feed ID |
| limit  | number | 50      | 200 | Results per page  |
| offset | number | 0       |     | Pagination offset |

**Response 200**: { "results": SearchResult[] }

### POST /api/articles/by-ids

Fetch cached articles by entry IDs. Used for bookmarks and archived articles.

**Request body**: { "ids": ["entry-id-1", "entry-id-2", ...] }

- Maximum 500 IDs per request (excess is truncated)

**Response 200**: { "results": Article[] } (same shape as articles endpoint without feedName)

### GET /api/recap

Generate a weekly recap of cached articles grouped by category.

**Query Parameters**:

| Param | Type   | Default | Max | Description                 |
| ----- | ------ | ------- | --- | --------------------------- |
| days  | number | 7       | 30  | Number of days to look back |

**Response 200**:

| Field         | Type         | Description                                        |
| ------------- | ------------ | -------------------------------------------------- |
| startDate     | string       | ISO 8601 start date                                |
| endDate       | string       | ISO 8601 end date                                  |
| totalArticles | number       | Total articles in period                           |
| categories    | RecapGroup[] | Articles grouped by category, sorted by count desc |
| topTags       | object[]     | Top 10 tags with counts                            |

### GET /api/stats/cache

Article cache statistics.

**Response 200**:

| Field         | Type   | Description                          |
| ------------- | ------ | ------------------------------------ |
| totalArticles | number | Total cached articles                |
| cachedFeeds   | number | Number of feeds with cached articles |

### GET /api/stats/feeds

Aggregate feed statistics.

**Response 200**:

| Field                | Type   | Description                                             |
| -------------------- | ------ | ------------------------------------------------------- |
| totalFeeds           | number | Total feeds in catalog                                  |
| workingFeeds         | number | Feeds with status "working"                             |
| feedsWithStatus      | number | Feeds with fetch status records                         |
| feedsWithRecentError | number | Feeds where last error is more recent than last success |
| staleFeeds           | number | Feeds not successfully fetched in 24+ hours             |

### GET /api/discover

Discover RSS/Atom feeds from a website URL by parsing link tags.

**Query Parameters**:

| Param | Type   | Required | Description                           |
| ----- | ------ | -------- | ------------------------------------- |
| url   | string | Yes      | HTTP/HTTPS URL to discover feeds from |

**Response 200**:

| Field | Type             | Description               |
| ----- | ---------------- | ------------------------- |
| feeds | DiscoveredFeed[] | Up to 10 discovered feeds |

**DiscoveredFeed shape**:

| Field | Type   | Description                                           |
| ----- | ------ | ----------------------------------------------------- |
| href  | string | Feed URL (resolved relative to input)                 |
| type  | string | MIME type (application/rss+xml, application/atom+xml) |
| title | string | Feed title or URL                                     |

**Response 400**: { "error": "A valid HTTP/HTTPS URL is required" }
**Response 502**: { "feeds": [], "error": "Discovery failed" }
