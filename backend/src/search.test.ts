import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db.js";
import { saveArticles } from "./cache.js";
import { searchArticles, getRecentArticles } from "./search.js";
import { insertTestFeed, makeEntry } from "./test-helpers.js";

describe("search", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM article_cache").run();
    db.prepare("DELETE FROM article_search").run();
  });

  it("returns empty results for an empty query", () => {
    expect(searchArticles("")).toEqual([]);
  });

  it("returns empty results when no articles match", () => {
    const feedId = insertTestFeed();
    saveArticles(feedId, [makeEntry({ id: "e1", title: "Unrelated" }, feedId)]);
    expect(searchArticles("missing")).toEqual([]);
  });

  it("finds articles by title", () => {
    const feedId = insertTestFeed();
    saveArticles(feedId, [
      makeEntry({ id: "e1", title: "Infrastructure Bill Introduced" }, feedId),
      makeEntry({ id: "e2", title: "Weather Update" }, feedId),
    ]);

    const results = searchArticles("infrastructure");
    expect(results).toHaveLength(1);
    expect(results[0].entryId).toBe("e1");
  });

  it("finds articles by description", () => {
    const feedId = insertTestFeed();
    saveArticles(feedId, [
      makeEntry(
        { id: "e1", title: "Update", description: "Funding for bridges and roads." },
        feedId
      ),
    ]);

    const results = searchArticles("bridges");
    expect(results).toHaveLength(1);
    expect(results[0].entryId).toBe("e1");
  });

  it("limits the number of results", () => {
    const feedId = insertTestFeed();
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ id: `e${i}`, title: `Common ${i}` }, feedId)
    );
    saveArticles(feedId, entries);

    expect(searchArticles("Common", 2)).toHaveLength(2);
  });

  it("returns recent articles when query is empty", () => {
    const feedId = insertTestFeed();
    saveArticles(feedId, [makeEntry({ id: "e1", title: "Recent" }, feedId)]);

    const recent = getRecentArticles(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].entryId).toBe("e1");
  });
});
