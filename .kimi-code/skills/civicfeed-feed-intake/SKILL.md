---
name: civicfeed-feed-intake
description: Use when adding, discovering, validating, or modifying RSS/Atom/XML feeds in the CivicFeed app
---

# CivicFeed Feed Intake

## Overview

Standardize how U.S. government RSS/Atom/XML feeds are researched, classified, fetched, normalized, and inserted into CivicFeed's feed catalog.

> **Architecture note:** `backend/src/feeds.ts` is the single source of truth for the static feed catalog. The frontend no longer bundles a static feed file; it fetches the catalog from `/api/feeds`. RSS fetching, parsing, and caching all live in the backend service. Do not add public CORS proxy fallbacks or client-side XML parsing.

## When to Use

Use this skill when you:

- Add one or more new feeds to `backend/src/feeds.ts`
- Update an existing feed URL, title, category, or status in the backend catalog
- Validate that a source URL is parseable by the backend pipeline
- Research or discover candidate government feeds

Do NOT use this skill for:

- UI/component refactoring
- Build tooling or routing changes
- Bugs unrelated to feed data or RSS fetching

## Intake Workflow

1. **Discovery** — Identify the publishing agency, locate the official RSS/Atom page, copy the canonical HTTPS URL, and perform a live HTTP request to confirm it returns content.
2. **Source Format Validation** — Inspect the response and classify as one of: RSS 2.0, Atom 1.0, CAP XML, SharePoint RSS, HTML-embedded RSS, JSON Feed, or Unknown.
3. **Fetch Compatibility Check** — Validate the same path the backend uses:
   - Direct fetch with `User-Agent: CivicFeed-Fetcher/1.0` and `Accept: application/rss+xml, application/atom+xml, application/xml, text/xml, */*` (12s timeout).
   - Do **not** use public CORS proxies; the backend performs all fetches.
   - Confirm `parseRssXml` from `backend/src/rss-parser.ts` returns at least one entry (smoke test).
4. **Metadata Normalization** — Map the source onto the `Feed` interface:
   - `id`: next sequential `feed-NNN`
   - `name`: official or descriptive feed title
   - `shortName`: concise display name (≤50 chars, unique enough)
   - `agency`: publishing agency name or acronym
   - `description`: 1-2 sentence summary of what the feed contains
   - `rssUrl`: canonical HTTPS URL
   - `website`: agency or section homepage
   - `department`: parent department acronym when known, else `""`
   - `category`: must already exist in `categoryList`
   - `subCategory`: specific topic label
   - `contentType`: brief label (e.g., "Press releases", "Alert feed")
   - `updateFrequency`: cadence if known, else `""`
   - `status`: `"working"` if fetch+parse succeeded, `"unverified"` if not yet verified, `"blocked"` if unsupported or unreachable
   - `tags`: lowercase strings
   - `priority`: optional tier from agency mission
5. **Schema Adaptations**
   - **Atom dates**: prefer `<published>`, fallback to `<updated>`; normalized via `normalizeDate` in `backend/src/rss-parser.ts`.
   - **CAP XML** (e.g., NOAA alerts): parser may produce items, but CAP semantics (severity, area, certainty) are not extracted. Mark `status: "working"`, add a `cap` tag, and note CAP-specific semantics in `description`.
   - **SharePoint GUID URLs**: accept `<guid>` as the link when `<link>` is empty.
   - **Relative links**: resolve against `website` origin or the feed's base URL.
6. **Tagging & Titling**
   - Keep `tags` as lowercase strings only.
   - Include the feed's `category` slug (e.g., `"health & science"`).
   - Include the agency acronym.
   - Add 2-4 topical tags that describe the feed's content.
   - Assign `priority` using the tier table below.
7. **Data Insertion**
   - Append the new `Feed` object to the `feeds` array in `backend/src/feeds.ts`.
   - Increment `feedStats.total`.
   - Increment `feedStats.byCategory[feed.category]`.
   - If `status` is `"working"` or `"blocked"`, update `feedStats.byStatus` accordingly.
   - The backend seeds the database from this file on startup; no separate frontend catalog file needs to be updated.

## Supported Source Types

| Format | Identifier | Parser Support | Notes |
|--------|------------|----------------|-------|
| RSS 2.0 | `<channel>` + `<item>` | Full | Primary supported format. |
| Atom 1.0 | `<feed>` + `<entry>` | Full | Dates taken from `<published>` / `<updated>`; link from `rel="alternate"` or first `<link href>`. |
| CAP XML (OASIS) | `<alert>` / NOAA-style feeds | Partial | Items parse as generic entries; CAP fields (severity, area, certainty) are lost. Tag `cap` and note semantics. |
| SharePoint RSS | URL contains `feed.aspx?xsl=1&page=...` | Full | Treat as RSS 2.0; use `<guid>` when `<link>` is missing. |

## Unsupported / Blocked Source Types

| Format | Why Blocked | Action |
|--------|-------------|--------|
| JSON Feed | No parser implemented | Reject |
| Twitter/X, Facebook, Bluesky APIs | Not RSS/Atom; requires API keys and auth | Reject |
| Authenticated / private feeds | App only fetches public URLs | Reject |
| Email-newsletter-only sites | No machine-readable syndication feed | Reject |

## Best Source Mediums / Protocols

- Require HTTPS.
- Prefer official `.gov` domains or agency-controlled subdomains.
- Avoid long redirect chains; use the final canonical URL.
- Avoid URLs with session tokens, one-time signatures, or user-specific query params.
- Prefer stable endpoints (e.g., `/rss/...`, `/feed`, `?format=feed&type=rss`) over generated temp URLs.

## Tagging Rules

- Tags are **lowercase strings** only.
- Must include the feed's `category` slug exactly (e.g., `"environment & energy"`).
- Must include the agency acronym (e.g., `"epa"`, `"ntsb"`).
- Add **2-4 topical tags** describing content (e.g., `"alerts"`, `"recalls"`).
- Do not include duplicates; keep the array sorted loosely by category, agency, then topic.

## Priority Tiers

Assign `priority` based on the publishing agency's mission:

| Tier | Mission | Example Agencies |
|------|---------|------------------|
| 1 | Safety, Health, Emergency | CISA, CDC, FDA, FEMA, NOAA, USGS |
| 2 | Financial, Consumer, Investor | SEC, CFTC, Fed, Treasury, FTC, HHS |
| 3 | Transportation & Travel | State, NTSB, DOT, CBP |
| 4 | Environment, Energy, Nuclear | CSB, NRC, EIA, EPA |
| 5 | Security, Law Enforcement | FBI, DNI |
| 6 | Government Accountability | GAO, SSA OIG |

## Common Mistakes

1. **Inventing a new category** — Fix: use an existing value from `categoryList`; only add new categories when explicitly asked.
2. **Editing `src/data/feeds.ts`** — Fix: the static catalog has moved to `backend/src/feeds.ts`; edit that file instead.
3. **Adding public CORS proxies** — Fix: the backend fetches all feeds directly; do not introduce proxy fallbacks.
4. **Forgetting to update `feedStats`** — Fix: increment `total`, `byCategory[category]`, and `byStatus[status]`.
5. **Using uppercase tags or free-form casing** — Fix: convert every tag to lowercase.
6. **Duplicate `id` values** — Fix: assign the next sequential `feed-NNN` and verify uniqueness.
7. **Leaving `status` as `"unverified"` after a successful fetch+parse** — Fix: set `"working"` when the smoke test returns entries.
8. **Assigning the wrong priority tier** — Fix: match the agency mission to the tier table.
9. **Accepting relative `rssUrl` or unresolved relative item links** — Fix: store absolute HTTPS URLs; resolve relative links against `website` or the feed's base URL.

## Quick Reference

Before saving changes to `backend/src/feeds.ts`, confirm:

- [ ] URL fetched live and returned parseable entries via the backend parser
- [ ] Format classified and recorded
- [ ] Next sequential `feed-NNN` ID assigned and unique
- [ ] `category` already exists in `categoryList`
- [ ] `tags` are lowercase and include category slug + agency acronym + 2-4 topical tags
- [ ] `priority` tier matches agency mission (if assigned)
- [ ] `feedStats.total` incremented
- [ ] `feedStats.byCategory[category]` incremented
- [ ] `feedStats.byStatus[status]` incremented when status is not `unverified`
- [ ] Description notes any CAP/XML-specific semantics when applicable
