import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db.js";
import { generateRecap } from "./recap.js";
import { saveArticles } from "./cache.js";
import { enrichArticle } from "./ai.js";
import { insertTestFeed, makeEntry } from "./test-helpers.js";

describe("recap", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM article_cache").run();
    db.prepare("DELETE FROM article_search").run();
    db.prepare("DELETE FROM article_summaries").run();
    db.prepare("DELETE FROM article_tags").run();
  });

  it("returns an empty recap when no recent articles exist", () => {
    const recap = generateRecap(7);

    expect(recap.totalArticles).toBe(0);
    expect(recap.categories).toEqual([]);
    expect(recap.topTags).toEqual([]);
  });

  it("groups recent cached articles by category and computes top tags", async () => {
    const feedIdA = insertTestFeed({ id: "feed-cat-a", category: "Category A" });
    const feedIdB = insertTestFeed({ id: "feed-cat-b", category: "Category B" });

    const now = Date.now();
    const entries = [
      makeEntry(
        { id: "recap-1", title: "Article One", description: "First article.", fetchedAt: now },
        feedIdA,
        "Feed A"
      ),
      makeEntry(
        { id: "recap-2", title: "Article Two", description: "Second article.", fetchedAt: now },
        feedIdA,
        "Feed A"
      ),
      makeEntry(
        { id: "recap-3", title: "Article Three", description: "Third article.", fetchedAt: now },
        feedIdB,
        "Feed B"
      ),
    ];

    saveArticles(feedIdA, entries.slice(0, 2));
    saveArticles(feedIdB, [entries[2]]);

    // Enrich two articles with overlapping tags so top tags are populated.
    await enrichArticle("recap-1", feedIdA, "Article One", "First article about parks and roads.");
    await enrichArticle(
      "recap-2",
      feedIdA,
      "Article Two",
      "Second article about parks and schools."
    );

    const recap = generateRecap(7);

    expect(recap.totalArticles).toBe(3);
    expect(recap.categories).toHaveLength(2);
    expect(recap.categories[0].category).toBe("Category A");
    expect(recap.categories[0].entries).toHaveLength(2);
    expect(recap.categories[1].entries).toHaveLength(1);
    expect(recap.topTags.some((t) => t.tag === "parks")).toBe(true);
  });

  it("excludes articles older than the requested window", () => {
    const feedId = insertTestFeed({ id: "feed-old" });
    const oldEntry = makeEntry({ id: "old-1", title: "Old Article" }, feedId);
    oldEntry.fetchedAt = Date.now() - 14 * 24 * 60 * 60 * 1000;

    saveArticles(feedId, [oldEntry]);
    const recap = generateRecap(7);

    expect(recap.totalArticles).toBe(0);
  });
});
