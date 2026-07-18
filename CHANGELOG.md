# Changelog

All notable changes to CivicFeed are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Repository governance documentation: AGENTS.md, CONTRIBUTING.md, SECURITY.md, CODEOWNERS
- ARCHITECTURE.md documenting system structure, service boundaries, and reliability patterns
- TESTING.md documenting test layers, gates, fixtures, and commands
- STATUS.md documenting current implementation state and next actions
- RUNBOOK.md with operational procedures for 5 common incident scenarios
- API.md documenting all 14 REST API endpoints
- DATA_MODEL.md documenting SQLite schema, migrations, and entity relationships
- DEVELOPMENT.md with detailed local environment setup and day-to-day workflow
- DEPLOYMENT.md documenting Docker Compose deployment, configuration, and rollback
- LICENSE file (MIT)
- ROADMAP.md with 4-sprint remediation plan derived from REPO_AUDIT.md
- Prettier formatting configuration and format:check gate
- Backend ESLint configuration and enforcement
- CI workflow with frontend and backend jobs running all quality gates
- Structured JSON logger with configurable levels (error, warn, info, silent)
- Feed fetch status tracking (feed_fetch_status table) with attempt/success/failure counts
- Feed health validation with 7 checks (reachability, XML, schema, GUIDs, dates, content, freshness)
- Feed discovery via website link tag parsing (/api/discover endpoint)
- Weekly recap generation with category grouping and top tag aggregation (/api/recap endpoint)
- AI enrichment queue for asynchronous article summarization and tagging
- Circuit breaker pattern on RSS feed fetches (5-failure threshold, 5-minute cooldown)
- Retry with exponential backoff and full jitter on RSS fetches (3 attempts max)
- SSRF guard on all outbound HTTP requests (private IP blocking, port restrictions, redirect validation)
- Docker Compose deployment with nginx frontend and Node backend
- Docker healthcheck on backend service (30s interval, 3 retries)
- Graceful shutdown via SIGTERM/SIGINT signal handling
- 71 backend unit tests using Vitest with in-memory SQLite
- Playwright E2E test suite with 4 browser projects (chromium, firefox, webkit, mobile)
- Automated accessibility scans using axe-core
- Mock RSS server for deterministic E2E test setup
- OPML import/export for feed subscriptions
- 590+ verified government and public-interest RSS feeds across 18 categories
- SQLite FTS5 full-text search with trigger-based index sync
- Article cache with 15-minute TTL and automatic pruning
- Background scheduler for feed refresh, enrichment processing, and health validation

### Changed

- Consolidated RSS fetching, XML parsing, and caching exclusively into the backend
- Frontend now consumes backend API only — removed client-side RSS fetching and XML parsing
- Feed catalog is single source of truth in backend/src/feeds.ts (was previously duplicated in frontend)

### Removed

- Public CORS proxy fallbacks (allorigins.win, corsproxy.io, codetabs.com)
- Frontend XML parsing dependencies
- Stale verify:rss-cache CI step (removed during CI fix)
