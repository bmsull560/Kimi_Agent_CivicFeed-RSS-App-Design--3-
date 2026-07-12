import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db.js";
import { getCachedArticles, saveArticles, cacheStats } from "./cache.js";
import { insertTestFeed, makeEntry } from "./test-helpers.js";

describe("cache", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM article_cache").run();
    db.prepare("DELETE FROM article_search").run();
  });

  it("returns null when no articles are cached for a feed", () => {
    insertTestFeed({ id: "feed-empty" });
    expect(getCachedArticles("feed-empty")).toBeNull();
  });

  it("saves and retrieves cached articles", () => {
    const feedId = insertTestFeed({ id: "feed-cache" });
    const entries = [
      makeEntry(
        { id: "e1", title: "First", pubDate: new Date(Date.now() - 60_000).toISOString() },
        feedId
      ),
      makeEntry({ id: "e2", title: "Second" }, feedId),
    ];

    saveArticles(feedId, entries);
    const cached = getCachedArticles(feedId);

    expect(cached).toHaveLength(2);
    expect(cached?.[0].entryId).toBe("e2");
    expect(cached?.[1].entryId).toBe("e1");
    expect(cacheStats()).toEqual({ total: 2, feeds: 1 });
  });

  it("does not return stale cached articles", () => {
    const feedId = insertTestFeed({ id: "feed-stale" });
    const staleEntry = makeEntry({ id: "old", title: "Old" }, feedId);
    staleEntry.fetchedAt = Date.now() - 60 * 60 * 1000;

    saveArticles(feedId, [staleEntry]);
    expect(getCachedArticles(feedId)).toBeNull();
  });

  it("replaces existing entries with the same id", () => {
    const feedId = insertTestFeed({ id: "feed-update" });
    saveArticles(feedId, [makeEntry({ id: "e1", title: "Original" }, feedId)]);
    saveArticles(feedId, [makeEntry({ id: "e1", title: "Updated" }, feedId)]);

    const cached = getCachedArticles(feedId);
    expect(cached).toHaveLength(1);
    expect(cached?.[0].title).toBe("Updated");
  });
});
