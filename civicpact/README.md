# CivicPact

Enterprise-grade civic intelligence RSS agent platform. This monorepo implements the 7-layer CivicPact architecture for ingesting, extracting, analyzing, verifying, and alerting on civic and legislative news.

## Current Phase

**Phase 2 — Layer 2 Legislative & News Entity Extraction**

This phase adds the Layer 2 extraction service that transforms raw `RSSFeedItem` outputs from Layer 1 into structured, Pydantic-validated civic entities using a provider-agnostic LLM structured-output client.

Completed phases:

- Phase 1 — Foundation and Layer 1 Ingestion
- Phase 2 — Layer 2 Legislative & News Entity Extraction

## Architecture

```text
Layer 7  Cross-Layer Alert API, Delivery & Tenant Profiles
Layer 6  Civic Impact & Benchmark Service
Layer 5  Truth & Source Verification
Layer 4  Agentic Civic Analyst Engine (LangGraph)
Layer 3  Civic Knowledge Graph & Vector Layer
Layer 2  Legislative & News Entity Extraction  ← implemented in this phase
Layer 1  RSS Ingestion & Web Scraping          ← implemented in Phase 1
```

## Monorepo Layout

```text
civicpact/
├── pyproject.toml              # Poetry workspace + tool config
├── ruff.toml                   # Linting / formatting rules
├── docker-compose.yml          # Local Redis + PostgreSQL
├── shared/
│   └── value_fabric/           # Core shared package
│       └── shared/
│           ├── context.py      # ContextVar tenant isolation
│           ├── errors.py       # Structured exceptions (CF-XXX-XXX)
│           ├── security.py     # URL validation & SSRF protection
│           └── database.py     # Async PostgreSQL session manager
└── services/
    ├── ingestion_l1/           # Layer 1 ingestion service
    │   ├── src/ingestion_l1/
    │   │   ├── models.py       # Pydantic v2 RSSFeedItem schema
    │   │   ├── fetcher.py      # Async HTTP fetch with SSRF protection
    │   │   ├── parser.py       # RSS/Atom parser
    │   │   ├── scraper.py      # Playwright scraper stub
    │   │   ├── tasks.py        # Celery task wrapper
    │   │   └── cli.py          # CLI entry point
    │   └── tests/
    └── extraction_l2/          # Layer 2 extraction service
        ├── src/extraction_l2/
        │   ├── entities.py     # Pydantic v2 civic entity schemas
        │   ├── llm_client.py   # Provider-agnostic LLM client
        │   ├── engine.py       # ExtractionEngine orchestration
        │   └── cli.py          # CLI entry point
        └── tests/
```

## Prerequisites

- Python 3.11+
- Poetry 1.8+
- Docker and Docker Compose (for local Redis/PostgreSQL)

## Setup

### 1. Install dependencies

```bash
cd civicpact
poetry install
```

### 2. Start local infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 and Redis on port 6379.

### 3. Run ingestion from the CLI

```bash
poetry run ingest https://www.trade.gov/rss.xml --feed-id trade-gov
```

### 4. Run entity extraction from the CLI

```bash
poetry run extract https://www.trade.gov/rss.xml --feed-id trade-gov \
  --base-url https://api.openai.com/v1 \
  --api-key "$OPENAI_API_KEY" \
  --model gpt-4o-mini
```

The `extract` command fetches the feed, parses entries, and sends each entry to the configured OpenAI-compatible endpoint for structured civic-entity extraction. All LLM calls are abstracted behind `LLMClient` so the engine itself is provider-agnostic.

## Development Commands

```bash
poetry run pytest              # run tests
poetry run mypy --strict .     # type check
poetry run ruff check .        # lint
poetry run ruff format .       # format
```

## Layer 1 Contracts

### Input

- `feed_url`: Public HTTP/HTTPS URL of an RSS/Atom feed.
- `feed_id`: Logical identifier for the feed stream.
- `tenant_id`: UUID of the tenant owning the request.

### Output

- `RSSFeedItem` Pydantic models containing:
  - `feed_id`
  - `title`
  - `source_url`
  - `publication_date` (UTC)
  - `raw_content`
  - `author` (optional)

## Layer 2 Contracts

### Input

- `RSSFeedItem` from Layer 1:
  - `id`
  - `feed_id`
  - `title`
  - `source_url`
  - `publication_date` (UTC)
  - `raw_content`
  - `author` (optional)

### Output

- `ExtractionResult` Pydantic model containing:
  - `source_entry_id`: the RSS entry that was analyzed
  - `extracted_at`: UTC timestamp of extraction
  - `entities`: discriminated list of civic entities

### Supported entity types

| Entity type         | Model              | Key fields                                                                        |
| ------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `legislative_event` | `LegislativeEvent` | `event_id`, `event_type`, `event_date`, `jurisdiction`, `summary`, `impact_score` |
| `bill`              | `Bill`             | `bill_identifier`, `jurisdiction`, `title`, `status`, `sponsors`                  |
| `official`          | `Official`         | `name`, `title`, `jurisdiction`, `party_affiliation`                              |
| `organization`      | `Organization`     | `name`, `organization_type`                                                       |
| `location`          | `Location`         | `name`, `location_type`                                                           |

### LLM client abstraction

- `LLMClient` is an abstract base class with `complete_structured(prompt, schema)`.
- `OpenAICompatibleClient` works with any OpenAI-compatible `/v1/chat/completions` endpoint.
- `MockLLMClient` returns a fixed response and is used in tests to avoid live API calls.

## Security

- All feed URLs are validated before fetching.
- Private, loopback, link-local, and cloud metadata targets are blocked.
- Request size is capped at 10 MiB.
- Redirects are followed up to a maximum of 5 hops.
- Tenant context is required for database sessions and is isolated via `contextvars`.

## Status

- ✅ Shared Value Fabric package
- ✅ Layer 1 ingestion service (HTTP fetch + RSS/Atom parse)
- ✅ Layer 2 extraction service (Pydantic schemas + LLM client + engine)
- ✅ Celery task wrapper
- ✅ Playwright scraper stub
- ✅ Deterministic unit tests with mocked HTTP and mocked LLM
- ⬜ Layers 3–7
- ⬜ End-to-end integration tests with real feeds
- ⬜ Multi-tenant database enforcement hooks

## License

TBD
