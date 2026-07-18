# Deployment

Deployment environments, configuration, health checks, and rollback procedures for CivicFeed.

## Deployment Method

The primary deployment method is Docker Compose, which runs the full stack: nginx frontend (static SPA) and Node.js backend (Express API + SQLite).

## Docker Compose Configuration

Defined in docker-compose.yml. Two services and one volume:

### backend service

| Property       | Value                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Image          | civicfeed-backend (built from backend/Dockerfile)                        |
| Port           | 4000 (exposed internally, not published)                                 |
| Environment    | NODE_ENV=production, PORT=4000, CIVICFEED_DB_PATH=/app/data/civicfeed.db |
| Volume         | civicfeed-data mounted at /app/data                                      |
| Restart policy | unless-stopped                                                           |
| Healthcheck    | GET /api/health every 30s, 5s timeout, 3 retries, 10s start period       |

### frontend service

| Property       | Value                                           |
| -------------- | ----------------------------------------------- |
| Image          | civicfeed-frontend (built from root Dockerfile) |
| Port           | 8080:80 (published)                             |
| Depends on     | backend (condition: service_healthy)            |
| Restart policy | unless-stopped                                  |

### Volume

civicfeed-data: Persistent named volume for the SQLite database, mounted at /app/data in the backend container.

## Dockerfiles

### Frontend Dockerfile (root)

Multi-stage build:

1. **Build stage**: node:20-bookworm-slim, npm ci, npm run build (Vite production build to dist/)
2. **Runtime stage**: nginx:1.27-alpine, copies dist/ to nginx html directory, uses nginx.conf

### Backend Dockerfile (backend/)

Multi-stage build:

1. **Build stage**: node:20-bookworm-slim, installs native toolchain (python3, make, g++) for better-sqlite3, npm ci, npm run build, npm prune --omit=dev
2. **Runtime stage**: node:20-bookworm-slim, copies node_modules and dist, creates /app/data directory, runs as unprivileged node user

### Entrypoint

docker-entrypoint.sh runs before the server starts:

1. Runs node dist/db.js --seed to sync the feed catalog into SQLite
2. Executes the main command (node dist/server.js)

Migrations apply automatically on server startup via db.ts.

## nginx Configuration

Defined in nginx.conf. Serves the SPA and proxies API calls:

- **Static assets** (/assets/): 1-year cache with immutable Cache-Control header
- **API proxy** (/api/): Proxies to http://backend:4000 with standard forwarding headers (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto)
- **SPA fallback** (/): try_files with index.html fallback for client-side routing

## First-Run Behavior

1. Docker Compose builds both images
2. Backend container starts, entrypoint runs database seed
3. Migrations apply automatically (5 migrations)
4. Feed catalog (590+ feeds) is synced from feeds.ts into SQLite
5. Backend health check passes after 10-second start period
6. Frontend container starts once backend is healthy
7. Application is accessible at http://localhost:8080

## Deploying

```bash
# Build and start
docker compose up --build -d

# View logs
docker compose logs -f

# Check status
docker compose ps

# Stop
docker compose down

# Stop and remove volumes (WARNING: deletes all data)
docker compose down -v
```

## Environment Configuration

Environment variables can be set in docker-compose.yml under the backend service environment section, or via an .env file at the project root.

| Variable                      | Default (Docker)       | Description                               |
| ----------------------------- | ---------------------- | ----------------------------------------- |
| NODE_ENV                      | production             | Node environment                          |
| PORT                          | 4000                   | Backend API port                          |
| CIVICFEED_DB_PATH             | /app/data/civicfeed.db | SQLite database path                      |
| CIVICFEED_LOG_LEVEL           | info                   | Log verbosity (error, warn, info, silent) |
| CIVICFEED_REFRESH_INTERVAL_MS | 60000                  | Scheduler interval in ms (0 to disable)   |
| CIVICFEED_DISABLE_SCHEDULER   | (unset)                | Set to "1" to disable scheduler           |
| OLLAMA_URL                    | http://localhost:11434 | Ollama API URL                            |
| OPENAI_API_KEY                | ""                     | OpenAI API key                            |
| OPENAI_MODEL                  | gpt-4o-mini            | OpenAI model                              |

## Health Checks

| Check              | Method               | Expected                |
| ------------------ | -------------------- | ----------------------- |
| Docker healthcheck | GET /api/health      | 200 with status "ok"    |
| Readiness          | GET /api/ready       | 200 with ready true     |
| Feed stats         | GET /api/stats/feeds | 200 with feed counts    |
| Cache stats        | GET /api/stats/cache | 200 with article counts |

## Data Persistence

The SQLite database persists in the civicfeed-data Docker volume. To back up:

```bash
# Back up the database
docker compose exec backend cp /app/data/civicfeed.db /app/data/civicfeed.db.bak

# Copy backup to host
docker compose cp backend:/app/data/civicfeed.db.bak ./civicfeed.db.bak
```

To restore:

```bash
# Copy backup into container
docker compose cp ./civicfeed.db.bak backend:/app/data/civicfeed.db.bak

# Stop backend, replace database, restart
docker compose stop backend
docker compose exec backend sh -c "cp /app/data/civicfeed.db.bak /app/data/civicfeed.db"
docker compose start backend
```

## Rollback Procedure

1. Stop the current deployment: docker compose down
2. If rolling back to a previous image version, update image tags or rebuild from the previous git commit
3. Restore the database volume from backup if schema changes are involved
4. Start the previous version: docker compose up -d
5. Verify health: curl http://localhost:8080/api/health
6. Monitor logs: docker compose logs -f backend

## Scaling Notes

- **Single instance only**: SQLite supports concurrent readers but only one writer. Horizontal scaling of the backend is not supported without switching to a different database engine.
- **No load balancer**: The frontend nginx serves static files and proxies to a single backend instance.
- **No CDN**: Static assets are served directly by nginx with 1-year cache headers for hashed filenames.

## Netlify Deployment (Frontend Only)

A netlify.toml file exists for static frontend-only deployment. This deploys the Vite SPA without the backend, meaning API features (search, feed fetching, caching, AI enrichment) will not work. Only the static UI shell and client-side state (localStorage) will function.

## CI/CD

The GitHub Actions workflow (.github/workflows/ci.yml) runs all quality gates on every push and PR to main/master. See TESTING.md for the full CI pipeline details. There is no automated deployment pipeline — deployment is manual via docker compose.
