import { db } from "./db.js";
import type { RssEntry } from "./rss.js";

let feedCounter = 0;

export function insertTestFeed(overrides: Partial<{
  id: string;
  name: string;
  shortName: string;
  agency: string;
  rssUrl: string;
  website: string;
  category: string;
  status: string;
  tags: string[];
}> = {}) {
  feedCounter++;
  const id = overrides.id ?? `test-feed-${feedCounter}`;
  const insert = db.prepare(`
    INSERT INTO feeds
    (id, name, short_name, agency, description, rss_url, website, department, category, sub_category, content_type, update_frequency, status, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    id,
    overrides.name ?? `Test Feed ${feedCounter}`,
    overrides.shortName ?? `Test ${feedCounter}`,
    overrides.agency ?? "Test Agency",
    "",
    overrides.rssUrl ?? `https://example.com/feed-${feedCounter}.xml`,
    overrides.website ?? "https://example.com",
    "",
    overrides.category ?? "General",
    "",
    "",
    "",
    overrides.status ?? "working",
    JSON.stringify(overrides.tags ?? [])
  );
  return id;
}

export function makeEntry(overrides: Partial<RssEntry> = {}, feedId = "test-feed-1", feedName = "Test Feed"): RssEntry {
  const now = Date.now();
  return {
    id: `entry-${now}`,
    title: "Test Entry",
    link: "https://example.com/test-entry",
    description: "A test entry.",
    pubDate: new Date(now).toISOString(),
    feedId,
    feedName,
    fetchedAt: now,
    ...overrides,
  };
}
