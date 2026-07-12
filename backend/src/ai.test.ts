import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db.js";
import { enrichArticle, getCachedEnrichment } from "./ai.js";
import { insertTestFeed } from "./test-helpers.js";

describe("ai enrichment", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM article_cache").run();
    db.prepare("DELETE FROM article_search").run();
    db.prepare("DELETE FROM article_summaries").run();
    db.prepare("DELETE FROM article_tags").run();
  });

  it("falls back to an extractive summary when no AI provider is available", async () => {
    const feedId = insertTestFeed({ id: "feed-ai" });
    const enrichment = await enrichArticle(
      "entry-ai-1",
      feedId,
      "New park opens downtown. The city celebrated the opening of a new public park. Residents attended the ceremony.",
      "A new public park opened in the downtown area today with a ribbon-cutting ceremony."
    );

    expect(enrichment.summary.length).toBeGreaterThan(0);
    expect(enrichment.summarySource).toBe("extractive");
    expect(enrichment.tags.length).toBeGreaterThan(0);
    expect(enrichment.tags).toContain("park");
  });

  it("caches and retrieves enrichment results", async () => {
    const feedId = insertTestFeed({ id: "feed-cache" });
    const entryId = "entry-cache-1";

    await enrichArticle(
      entryId,
      feedId,
      "Federal grant awarded",
      "A federal grant was awarded to the state department."
    );
    const cached = getCachedEnrichment(entryId);

    expect(cached).not.toBeNull();
    expect(cached?.summary.length).toBeGreaterThan(0);
    expect(cached?.tags).toEqual(expect.any(Array));
  });

  it("returns cached enrichment without recomputing", async () => {
    const feedId = insertTestFeed({ id: "feed-cache-hit" });
    const entryId = "entry-cache-hit-1";

    const first = await enrichArticle(
      entryId,
      feedId,
      "Unique title for cache test",
      "Description text."
    );
    const second = getCachedEnrichment(entryId);

    expect(second?.summary).toBe(first.summary);
    expect(second?.tags).toEqual(first.tags);
  });

  it("extracts keywords from article text", async () => {
    const feedId = insertTestFeed({ id: "feed-keywords" });
    const enrichment = await enrichArticle(
      "entry-keywords",
      feedId,
      "Infrastructure bill passes. The infrastructure bill passed the Senate. Roads and bridges will receive funding.",
      "The Senate passed a major infrastructure bill funding roads and bridges across the state."
    );

    expect(enrichment.tags.some((tag) => tag.includes("infrastructure"))).toBe(true);
    expect(enrichment.tags.length).toBeLessThanOrEqual(8);
  });

  it("strips HTML from descriptions before summarizing", async () => {
    const feedId = insertTestFeed({ id: "feed-html" });
    const enrichment = await enrichArticle(
      "entry-html",
      feedId,
      "Clean title",
      "<p>A <strong>clean</strong> description with <a href='#'>HTML</a> tags.</p>"
    );

    expect(enrichment.summary).not.toMatch(/<[^>]+>/);
    expect(enrichment.summary).toContain("clean");
  });
});
