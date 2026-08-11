# CivicFeed Product Vision

## Purpose

CivicFeed helps people discover, organize, and read trustworthy U.S. government and public-interest updates without monitoring hundreds of agency websites. It turns fragmented public RSS and Atom sources into a searchable, understandable, and personally relevant civic reading experience.

This document is the canonical statement of product purpose, outcomes, scope, and product-level non-goals. Implementation details belong in `ARCHITECTURE.md`; change controls belong in `docs/governance/CHANGE_GATES.md`.

## Intended Users and Outcomes

CivicFeed serves people who need timely, source-grounded civic information: residents, journalists, researchers, public-interest organizations, policy professionals, and government staff.

The product should let a user:

1. Discover trustworthy civic feeds and understand their provenance and health.
2. Configure topics and sources without losing access to the underlying catalog.
3. Browse recent updates and recover gracefully when sources are stale or unavailable.
4. Search, read, bookmark, archive, and revisit entries.
5. Use concise AI-assisted summaries, tags, and recaps without obscuring original sources or making AI a reading dependency.
6. Understand whether information is fresh, cached, degraded, or unavailable.

## Product Principles

- **Source-grounded:** Preserve agency attribution, canonical links, publication dates, and access to original material.
- **Accessibility-first:** Keyboard operation, semantic structure, visible focus, readable contrast, reduced motion, and responsive layouts are baseline behavior.
- **Backend-owned ingestion:** Fetch, parse, validate, cache, schedule, and enrich feeds on the trusted backend.
- **Graceful degradation:** Cached reading and non-AI behavior remain useful when upstream feeds or AI providers fail.
- **User-controlled:** Preferences and reading state remain understandable, reversible, and private.
- **Operationally bounded:** Network work, retries, concurrency, storage, payloads, and AI cost have explicit limits.
- **Evidence-led:** Features ship with tests and operational evidence proportionate to their risk.

## Product Scope

### Core

- Curated U.S. government and public-interest RSS/Atom feed discovery.
- User-added public feeds, enable/disable controls, and OPML import/export.
- Backend feed fetching, parsing, caching, freshness, health, and scheduling.
- Dashboard, directory, reading stream, entry detail, search, bookmarks, archive, and recaps.
- Local browser preferences and reading state.
- Asynchronous, source-grounded article summaries and tags with deterministic fallback.
- Diagnostics and recovery states for feed and backend failures.

### Permitted Evolution

- Better feed deduplication, conditional fetching, adaptive scheduling, stale-cache recovery, and observability.
- Explainable topic personalization and relevance ranking.
- Source-grounded clustering, structured extraction, and recap improvements through the existing enrichment queue.
- Contract validation, accessibility improvements, and operational hardening.
- Additional public syndication formats when security, parsing, and provenance requirements are met.

## Non-Goals Without an Approved Product Decision

- Social network, commenting, user-generated publishing, or engagement ranking.
- Replacing original reporting or official sources with generated content.
- Synchronous AI inference in article request paths.
- Scraping or bypassing upstream access controls when public syndication is unavailable.
- Public CORS proxy dependencies or browser-side RSS/XML ingestion.
- Authentication, cloud synchronization, multi-tenant delivery, or paid notification infrastructure.
- New external AI providers, credential flows, or production data export.
- Native mobile applications or a general-purpose news aggregation platform.
- Destructive catalog consolidation without provenance and replacement validation.

## Success Measures

A change should improve at least one outcome without materially degrading another:

- Feed reachability, parse success, freshness, and recovery rates.
- Time to discover a relevant source or reach a readable entry.
- Search, recap, and bookmark recovery coverage.
- Accessibility conformance across critical journeys.
- Cache availability during upstream failures.
- Enrichment grounding, usefulness, completion latency, and fallback rate.
- Operational visibility into failures, queue depth, latency, and staleness.
- User control over topics, sources, and reading state.

Targets belong in an approved roadmap, issue, or decision record so they can evolve without rewriting the product purpose.

## Product Boundary Decisions

Changes that add a non-goal, alter data ownership, weaken source provenance, introduce credentials/providers, change privacy expectations, or replace a core journey require an accepted decision record using `docs/governance/DECISION_TEMPLATE.md`.
