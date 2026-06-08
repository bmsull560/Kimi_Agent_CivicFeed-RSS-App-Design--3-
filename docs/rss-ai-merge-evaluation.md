# Evaluation: Merging rss_ai (Alt Platform) into CivicFeed

**Date:** 2026-06-07
**Scope:** Architectural evaluation of how https://github.com/bmsull560/rss_ai could be migrated/merged into the CivicFeed RSS app for an intelligent, valuable user experience.

---

## 1. Executive Summary

The two projects represent opposite ends of the complexity spectrum:

| Dimension | CivicFeed (Current) | rss_ai / Alt Platform |
|-----------|---------------------|----------------------|
| **Architecture** | Static client-side SPA | 15+ microservices, Docker Compose |
| **Backend** | None (browser fetches RSS directly) | Go, Python, Rust, Deno services |
| **Data Store** | localStorage (15-min cache) | PostgreSQL 16, Meilisearch, ClickHouse |
| **AI/Intelligence** | None | LLM summarization, ONNX tagging, genre classification, clustering |
| **Feed Count** | 78 active U.S. government feeds | General-purpose RSS ingestion platform |
| **Auth** | None | Ory Kratos identity, service tokens |
| **Observability** | None | Rust log pipelines, ClickHouse metrics |
| **Deployment** | Static files (GitHub Pages/S3) | Docker Compose with GPU profiles |

**Verdict:** A *full* merge of rss_ai into CivicFeed would be a forklift replacement, not an incremental upgrade. The right strategy is **selective extraction** — port the AI enrichment *concepts* and *user-facing features* from rss_ai into CivicFeed's simpler architecture, rather than adopting its entire microservices stack.

---

## 2. What rss_ai Brings That CivicFeed Lacks

### 2.1 User-Facing Intelligence
- **AI Summaries:** Ollama-powered article summarization (Map-Reduce pipeline)
- **Smart Tagging:** ONNX Runtime + SentenceTransformer keyword/topic extraction
- **Weekly Recaps:** 7-day genre-clustered digests with evidence links
- **Semantic Search:** Meilisearch-powered full-text search across articles (not just feed metadata)
- **Deduplication:** Near-duplicate detection across feeds
- **Genre Classification:** Automatic categorization into topics with refinement

### 2.2 Operational Capabilities
- **Backend RSS Proxy:** Eliminates CORS issues, enables server-side feed polling
- **Persistent Storage:** PostgreSQL for articles, summaries, tags, and user data
- **Feed Health Monitoring:** 7-gate validation (reachability, XML validity, GUID stability, freshness)
- **Rate Limiting & Circuit Breakers:** Respectful feed fetching
- **User Identity:** Authentication, bookmarks, personalization

### 2.3 Developer/Operational Infrastructure
- **Observability:** Structured logging, metrics, dashboards
- **Database Migrations:** Atlas-managed schema evolution
- **Testing Matrix:** Unit, integration, E2E, golden dataset evaluation

---

## 3. Integration Approaches

### Approach A: The "Smart Proxy" (Recommended)
**Concept:** Add a lightweight backend API to CivicFeed that proxies RSS feeds, caches articles, and provides AI enrichment endpoints. Keep the React SPA frontend with incremental enhancements.

**Architecture:**
```
┌─────────────────┐     ┌─────────────────────────────┐     ┌──────────────┐
│  CivicFeed SPA  │────▶│  New Backend (Node/Go)      │────▶│  PostgreSQL  │
│  (React + Vite) │◄────│  - RSS proxy/cache          │     │  + Meilisearch│
└─────────────────┘     │  - AI enrichment API        │     └──────────────┘
                        │  - Search indexer           │
                        └─────────────────────────────┘
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
                   ┌─────────┐              ┌──────────┐
                   │  Ollama │              │  ONNX/   │
                   │  (LLM)  │              │  Sentence│
                   └─────────┘              │ Transformer
                                            └──────────┘
```

**What to extract from rss_ai:**
- Data models: `articles`, `article_summaries`, `article_tags`, `feeds`
- AI pipeline concepts: summarization, tagging, deduplication
- Search indexing patterns (Meilisearch integration)
- Feed validation logic (adapt from `scripts/validate-feeds.ts`)

**What to leave behind:**
- Multi-language microservices (Go, Python, Rust, Deno) → consolidate into single backend
- Ory Kratos auth → use Clerk or simple JWT for CivicFeed scale
- ClickHouse observability → use Sentry/Logtail or skip for now
- recap-worker pipeline → simplify to on-demand or cron-triggered jobs
- sidecar-proxy → not needed with consolidated backend

**Pros:**
- Preserves CivicFeed's simplicity and fast iteration
- Eliminates CORS proxy brittleness
- Enables real AI features users can see and use
- Single deployable unit (monolithic backend + static frontend)
- Government feed catalog becomes seed data in PostgreSQL

**Cons:**
- Requires writing/shaping a new backend (not copying rss_ai directly)
- Need to host a server (Fly.io, Railway, Render, or VPS)
- AI inference requires GPU or external API (OpenAI/Anthropic) unless self-hosting Ollama

**Effort:** Medium-High (4-8 weeks for a single developer)

---

### Approach B: The "API Client"
**Concept:** Keep CivicFeed as a pure frontend. Deploy a *subset* of rss_ai's stack as a separate backend service. CivicFeed calls its REST APIs.

**Architecture:**
```
┌─────────────────┐     ┌─────────────────────────────┐
│  CivicFeed SPA  │────▶│  rss_ai Backend (Docker)    │
│  (unchanged)    │◄────│  - alt-backend (Go)         │
└─────────────────┘     │  - pre-processor (Go)       │
                        │  - tag-generator (Python)   │
                        │  - news-creator (Python)    │
                        │  - PostgreSQL + Meilisearch │
                        └─────────────────────────────┘
```

**What this means:**
- Fork rss_ai, strip out services not needed (recap-worker, rask-log-*, auth-token-manager)
- Adapt the feed catalog to ingest CivicFeed's 78 government feeds
- CivicFeed frontend replaces direct RSS fetching with calls to `alt-backend` APIs

**Pros:**
- Leverages battle-tested, production-grade code
- Full AI pipeline out of the box
- No rewriting core logic

**Cons:**
- rss_ai is *massively* over-engineered for CivicFeed's scope
- Operating 5+ Docker containers for 78 feeds is operational overkill
- Go/Python/Rust polyglot stack requires expertise in all three
- Frontend would need significant refactoring to use rss_ai's API contracts
- No clear path to incremental adoption — it's all-or-nothing

**Effort:** Very High (3-6 months, requires deep rss_ai expertise)

---

### Approach C: The "Serverless Sprinkle"
**Concept:** Keep CivicFeed as a static SPA. Add AI features via serverless functions and third-party APIs. No persistent backend of your own.

**Architecture:**
```
┌─────────────────┐     ┌─────────────────────────────┐     ┌──────────────┐
│  CivicFeed SPA  │────▶│  Serverless Functions       │────▶│  OpenAI API  │
│  (React + Vite) │◄────│  (Vercel/Netlify/CF Workers)│     │  or Claude   │
└─────────────────┘     │  - /api/summarize           │     └──────────────┘
                        │  - /api/tags                │
                        └─────────────────────────────┘
```

**What to add:**
- Serverless edge functions for AI calls
- Client-side feed fetching stays (with CORS proxies)
- Summaries generated on-demand per article
- Tags extracted via LLM or lightweight NLP library

**Pros:**
- Minimal architecture change
- No database to manage
- Can leverage best-in-class APIs (GPT-4, Claude)

**Cons:**
- CORS proxy problem remains unsolved
- No persistent storage = no search index, no recap history, no user data
- AI costs scale with usage (vs. fixed cost of self-hosted Ollama)
- Limited intelligence (no cross-article deduplication, no clustering)
- Latency: every AI call is a cold-start serverless function + LLM API roundtrip

**Effort:** Low-Medium (1-2 weeks)

---

## 4. Recommended Strategy: Approach A (Smart Proxy) with Phased Rollout

### Phase 1: Backend Foundation (Weeks 1-2)
1. **Create a monolithic backend** (Node.js/Express or Go) with two endpoints:
   - `GET /api/feeds` — returns CivicFeed's catalog from PostgreSQL
   - `GET /api/feeds/:id/articles` — fetches and parses RSS, returns normalized entries
2. **Migrate feed catalog** from `src/data/feeds.ts` to PostgreSQL
3. **Replace CORS proxies** with backend RSS fetching
4. **Add caching layer:** Redis or PostgreSQL for fetched articles (TTL: 15-60 min)

### Phase 2: AI Enrichment (Weeks 3-4)
1. **Article summarization:** On fetch, send article content to Ollama (self-hosted) or OpenAI API
2. **Store summaries** in `article_summaries` table
3. **Tag extraction:** Use lightweight NLP (compromise.js, natural.js) or call LLM for topics
4. **Expose in frontend:** Show summary cards, tag pills in EntryCard component

### Phase 3: Search & Discovery (Weeks 5-6)
1. **Index articles in Meilisearch** (lightweight, easy to deploy)
2. **Replace simple text search** with full-text article search
3. **Add cross-feed deduplication** using URL normalization + content hashing
4. **Add "Related Articles"** based on shared tags

### Phase 4: Recap Experience (Weeks 7-8)
1. **Weekly digest job:** Cron job aggregates last 7 days of articles
2. **Genre clustering:** Simple keyword-based or LLM-based categorization
3. **New frontend page:** `/recap` shows weekly digest with genre cards
4. **Email/web delivery:** Option to subscribe to weekly digests

---

## 5. Specific Code Migration Map

| rss_ai Component | CivicFeed Equivalent | Migration Strategy |
|------------------|----------------------|-------------------|
| `alt-frontend` (Next.js) | CivicFeed SPA (React+Vite) | **Do not migrate.** Keep CivicFeed's simpler frontend. Extract UI patterns only. |
| `alt-backend` (Go) | None | **Port concepts, not code.** Rewrite as Node.js/Go monolith. |
| `pre-processor` (Go) | `src/lib/rss.ts` | Replace client-side fetching. Port deduplication logic. |
| `news-creator` (Python + Ollama) | None | **Extract pattern.** Implement as backend service module. |
| `tag-generator` (Python + ONNX) | None | **Simplify.** Use lighter NLP or LLM API instead of ONNX. |
| `search-indexer` (Go) | Simple text search | **Adopt Meilisearch.** Easy drop-in for CivicFeed's scale. |
| `recap-worker` (Rust) | None | **Simplify heavily.** Cron job + simple clustering instead of full pipeline. |
| `auth-hub` (Go) + Kratos | None | **Replace with Clerk.** CivicFeed doesn't need enterprise auth. |
| `recap-db` schema | None | **Adopt selectively.** `articles`, `summaries`, `tags` tables only. |
| `validate-feeds.ts` | `scripts/validate-feeds.ts` | **Enhance current script.** Add rss_ai's 7-gate logic. |

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| rss_ai complexity overwhelms CivicFeed simplicity | High | High | Do **not** merge code directly. Extract patterns and rewrite simply. |
| AI inference costs too high | Medium | Medium | Start with Ollama (self-hosted) or rate-limit API calls. |
| Backend hosting complexity | Medium | Medium | Use managed platforms (Fly.io, Railway, Render). |
| Government feeds block backend IP | Low | High | Rotate IPs or use feed-provided APIs where available. |
| rss_ai maintenance burden | High | Medium | Avoid importing raw rss_ai code; rewrite core logic. |

---

## 7. Conclusion

**Do not attempt a direct code merge.** rss_ai is a 15-service platform designed for general-purpose RSS ingestion at scale. CivicFeed is a focused, lightweight government feed reader. Merging them literally would be like attaching a freight train to a bicycle.

**Instead:** Use rss_ai as a **reference architecture** and **conceptual blueprint**. Extract its most valuable user-facing ideas — AI summaries, smart tagging, weekly recaps, semantic search — and implement them in a backend suited to CivicFeed's scale (a single Node.js or Go service + PostgreSQL + Meilisearch).

**The highest-value, lowest-risk path:**
1. Add a lightweight backend that fetches RSS server-side
2. Integrate one AI feature at a time (summaries → tags → search → recaps)
3. Keep CivicFeed's frontend and iterate based on user feedback
4. Only adopt more rss_ai complexity if CivicFeed outgrows the simple backend

This preserves CivicFeed's core strength — simplicity and focus — while making it genuinely intelligent.
