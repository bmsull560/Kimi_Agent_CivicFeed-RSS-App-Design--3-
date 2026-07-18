# Runbook

Step-by-step operational procedures for common incidents and failures in CivicFeed.

## Health Check Endpoints

| Endpoint             | Purpose                            | Healthy Response                       |
| -------------------- | ---------------------------------- | -------------------------------------- |
| GET /api/health      | Database connectivity + feed count | 200 with status ok and database true   |
| GET /api/ready       | Readiness probe                    | 200 with ready true                    |
| GET /api/stats/feeds | Aggregate feed health              | 200 with feed counts                   |
| GET /api/stats/cache | Article cache stats                | 200 with totalArticles and cachedFeeds |

## Log Format

All backend logs are structured JSON written to stdout/stderr. Controlled by CIVICFEED_LOG_LEVEL:

| Level  | Output                             |
| ------ | ---------------------------------- |
| error  | Errors only                        |
| warn   | Warnings + errors                  |
| info   | Info + warnings + errors (default) |
| silent | No output                          |

Logs include fields like level, message, timestamp, feedId, entryCount, durationMs, and error details. Use docker compose logs backend to view output.

## Docker Healthcheck

The backend service has a Docker healthcheck configured in docker-compose.yml:

- Endpoint: http://localhost:4000/api/health
- Interval: 30 seconds
- Timeout: 5 seconds
- Retries: 3
- Start period: 10 seconds

Check container health with docker compose ps or docker inspect.

---

## Incident 1: Feed Unreachable / Circuit Breaker Open

**Symptoms**: Articles for a specific feed return empty or error. Feed shows errors in /api/stats/feeds.

**Diagnostics**:

1. Check feed fetch status: GET /api/feeds/FEED_ID/status
2. Check feed health: GET /api/feeds/FEED_ID/health
3. Check aggregate stats: GET /api/stats/feeds

**Key fields in status response**:

- lastErrorAt / lastErrorMessage — most recent failure
- failureCount — cumulative failures
- nextFetchAt — when scheduler will retry

**Recovery**:

1. If failureCount is 5 or higher, the circuit breaker is likely open (5-minute cooldown)
2. Wait 5 minutes for circuit breaker to transition to half-open and retry
3. Verify the feed URL is accessible from the backend host
4. If the publisher is blocking the backend IP, no fix is possible server-side
5. If the feed URL has changed, update backend/src/feeds.ts and re-seed

**Prevention**: The scheduler automatically retries with 5-minute backoff on failure and 15-minute interval on success.

---

## Incident 2: SQLite Database Locked

**Symptoms**: Backend returns 500 errors. Logs show SQLITE_BUSY or database lock errors.

**Diagnostics**:

1. Check if multiple backend processes are running (only one writer allowed)
2. Check for WAL files: look for civicfeed.db-shm and civicfeed.db-wal in the data directory
3. Run database integrity check: sqlite3 backend/data/civicfeed.db "PRAGMA integrity_check;"

**Recovery**:

1. Ensure only one backend process is running — SQLite with WAL mode supports concurrent readers but only one writer
2. If a stale lock file exists, stop the backend, remove WAL files, and restart
3. If corruption is detected by integrity_check, restore from volume backup
4. Restart the backend container: docker compose restart backend

**Prevention**: WAL mode is enabled by default. Avoid running multiple backend instances against the same SQLite file.

---

## Incident 3: Scheduler Stuck / Not Refreshing Feeds

**Symptoms**: Articles are stale, /api/stats/feeds shows high staleFeeds count, no "refresh due feeds complete" log entries.

**Diagnostics**:

1. Check scheduler configuration: verify CIVICFEED_REFRESH_INTERVAL_MS is not 0
2. Check stale feed count: GET /api/stats/feeds
3. Look for scheduler errors in logs: docker compose logs backend and search for "scheduled refresh failed"

**Recovery**:

1. If CIVICFEED_REFRESH_INTERVAL_MS is 0, the scheduler is disabled — set it to 60000 and restart
2. If the scheduler tick is throwing errors, check logs for the error message
3. If all feeds have nextFetchAt in the future, the scheduler is working but nothing is due — wait or manually trigger a fetch by requesting /api/feeds/:id/articles for a specific feed
4. Restart the backend: docker compose restart backend

**Prevention**: The scheduler runs with a 5-second initial delay and then every 60 seconds by default. It processes up to 50 due feeds per tick with concurrency 5.

---

## Incident 4: High Memory / Slow Responses

**Symptoms**: Backend responds slowly, container approaches memory limit, OOM kills.

**Diagnostics**:

1. Check article cache size: GET /api/stats/cache
2. Check enrichment queue depth in logs: docker compose logs backend and search for "enrichment batch complete"
3. Check container memory usage: docker stats

**Recovery**:

1. If totalArticles is very high, the cache may need pruning — the cache TTL is 15 minutes and old entries are pruned on save, but if many feeds are cached simultaneously, memory usage spikes
2. If the enrichment queue is deep, the AI enrichment is consuming resources — consider reducing batch size or disabling the scheduler temporarily with CIVICFEED_DISABLE_SCHEDULER=1 (note: this also disables feed refresh)
3. Restart the backend to clear in-memory state: docker compose restart backend
4. For persistent memory issues, consider increasing the container memory limit in docker-compose.yml

**Prevention**: The scheduler processes enrichment in batches of 20 with concurrency 3. Feed refresh is limited to 50 feeds per tick with concurrency 5.

---

## Incident 5: Backend Won't Start (Migration Error)

**Symptoms**: Backend container exits immediately or fails health check. Logs show migration-related errors.

**Diagnostics**:

1. Check backend logs: docker compose logs backend
2. Search for migration errors: docker compose logs backend and look for "migration"

**Common errors**:

### Schema Drift

Error message: "Database schema is ahead of application code: migration N is applied but not known."

**Cause**: An older code version is running against a database that was migrated by a newer version.

**Fix**: Upgrade the backend image to match or exceed the migration version in the database.

### Migration Failure

Error message: "Error in migration N: <SQL error>"

**Cause**: A migration's up function failed (e.g., ALTER TABLE on a table with an existing column).

**Fix**:

1. Back up the database file
2. Inspect the failed migration in backend/src/migrations.ts
3. If safe, manually apply the SQL or fix the database state
4. Remove the failed migration record from the migrations table
5. Restart the backend — the migration will re-attempt

### Corrupted Database

1. Stop the backend: docker compose stop backend
2. Back up the corrupted file
3. Remove the database files (civicfeed.db and associated WAL files)
4. Restart: docker compose up backend — migrations and seed will run fresh
5. Note: all cached articles and enrichment data will be lost; feed catalog is restored from feeds.ts

---

## Graceful Shutdown

The backend handles SIGTERM and SIGINT signals:

1. Stops the scheduler (clears timers)
2. Closes the HTTP server (waits for in-flight requests)
3. Exits with code 0

Docker sends SIGTERM on docker compose stop. The default grace period is 10 seconds. If the backend doesn't exit cleanly, Docker sends SIGKILL after the timeout.

To increase the shutdown grace period, add stop_grace_period to the backend service in docker-compose.yml.
