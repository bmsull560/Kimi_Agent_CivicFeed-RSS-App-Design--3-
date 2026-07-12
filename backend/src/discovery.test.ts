import { describe, it, expect, vi, afterEach } from "vitest";
import { discoverFeeds } from "./discovery.js";

describe("discoverFeeds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns RSS and Atom links discovered from HTML", async () => {
    const html = `<html>
      <head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
        <link rel="alternate" type="application/atom+xml" href="https://example.com/atom.xml" title="Atom Feed">
        <link rel="stylesheet" href="/style.css">
      </head>
    </html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200 }))
    );

    const feeds = await discoverFeeds("https://example.com/news");
    expect(feeds).toHaveLength(2);
    expect(feeds[0]).toEqual({
      href: "https://example.com/feed.xml",
      type: "application/rss+xml",
      title: "RSS Feed",
    });
    expect(feeds[1]).toEqual({
      href: "https://example.com/atom.xml",
      type: "application/atom+xml",
      title: "Atom Feed",
    });
  });

  it("returns an empty array when no alternate links are present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html></head></body></body></html>", { status: 200 }))
    );
    const feeds = await discoverFeeds("https://example.com/empty");
    expect(feeds).toEqual([]);
  });

  it("returns an empty array when the target returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not found", { status: 404 }))
    );
    const feeds = await discoverFeeds("https://example.com/missing");
    expect(feeds).toEqual([]);
  });

  it("deduplicates discovered URLs", async () => {
    const html = `<html>
      <head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
      </head>
    </html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200 }))
    );

    const feeds = await discoverFeeds("https://example.com/news");
    expect(feeds).toHaveLength(1);
  });
});
