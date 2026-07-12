import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const feedsPath = path.join(root, "backend", "src", "feeds.ts");
const source = fs.readFileSync(feedsPath, "utf8");

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} },
};
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox, { filename: feedsPath });

const { feeds, feedStats, categoryList, getFeedsByCategory, getFeedById, searchFeeds } = sandbox.exports;
const failures = [];

function fail(message) {
  failures.push(message);
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

if (!Array.isArray(feeds)) fail("feeds must be an array");
if (!feedStats || typeof feedStats !== "object") fail("feedStats must be exported");
if (!Array.isArray(categoryList)) fail("categoryList must be an array");

if (failures.length === 0) {
  if (feeds.length < 505) fail(`expected at least 505 feeds, found ${feeds.length}`);
  if (feedStats.total !== feeds.length) {
    fail(`feedStats.total is ${feedStats.total}, but feeds.length is ${feeds.length}`);
  }

  const ids = new Set();
  const categories = new Set(categoryList);
  const byCategory = Object.fromEntries(categoryList.map((category) => [category, 0]));
  const byStatus = { working: 0, blocked: 0, unverified: 0 };
  const validStatuses = new Set(Object.keys(byStatus));
  const validPriorities = new Set([1, 2, 3, 4, 5, 6]);

  feeds.forEach((feed, index) => {
    const label = feed?.id || `feed at index ${index}`;
    const expectedId = `feed-${String(index + 1).padStart(3, "0")}`;

    if (!feed || typeof feed !== "object") {
      fail(`${label} must be an object`);
      return;
    }
    if (feed.id !== expectedId) fail(`${label} should be sequential id ${expectedId}`);
    if (ids.has(feed.id)) fail(`duplicate feed id ${feed.id}`);
    ids.add(feed.id);

    for (const field of ["name", "shortName", "agency", "description", "rssUrl", "website", "category", "subCategory", "contentType"]) {
      if (typeof feed[field] !== "string" || feed[field].trim() === "") {
        fail(`${label} is missing non-empty ${field}`);
      }
    }

    if (!isHttpsUrl(feed.rssUrl)) fail(`${label} rssUrl must be an absolute HTTPS URL`);
    if (!isHttpsUrl(feed.website)) fail(`${label} website must be an absolute HTTPS URL`);
    if (!categories.has(feed.category)) fail(`${label} category "${feed.category}" is not in categoryList`);
    if (!validStatuses.has(feed.status)) fail(`${label} has invalid status ${feed.status}`);
    if (feed.priority !== undefined && !validPriorities.has(feed.priority)) {
      fail(`${label} has invalid priority ${feed.priority}`);
    }
    if (!Array.isArray(feed.tags) || feed.tags.length === 0) {
      fail(`${label} must have at least one tag`);
    } else {
      const tags = new Set();
      for (const tag of feed.tags) {
        if (typeof tag !== "string" || tag.trim() === "") fail(`${label} has an empty tag`);
        if (tag !== tag.toLowerCase()) fail(`${label} tag "${tag}" must be lowercase`);
        if (tags.has(tag)) fail(`${label} has duplicate tag "${tag}"`);
        tags.add(tag);
      }
    }

    if (feed.category in byCategory) byCategory[feed.category] += 1;
    byStatus[feed.status] += 1;
  });

  for (const category of categoryList) {
    if (feedStats.byCategory?.[category] !== byCategory[category]) {
      fail(`feedStats.byCategory["${category}"] is ${feedStats.byCategory?.[category]}, expected ${byCategory[category]}`);
    }
    const filtered = getFeedsByCategory(category);
    if (filtered.length !== byCategory[category]) {
      fail(`getFeedsByCategory("${category}") returned ${filtered.length}, expected ${byCategory[category]}`);
    }
  }

  for (const [status, count] of Object.entries(byStatus)) {
    if (feedStats.byStatus?.[status] !== count) {
      fail(`feedStats.byStatus.${status} is ${feedStats.byStatus?.[status]}, expected ${count}`);
    }
  }

  const firstFeed = feeds[0];
  const lastFeed = feeds.at(-1);
  if (getFeedById(firstFeed.id)?.id !== firstFeed.id) fail("getFeedById failed for first feed");
  if (getFeedById(lastFeed.id)?.id !== lastFeed.id) fail("getFeedById failed for last feed");
  if (!searchFeeds(firstFeed.shortName).some((feed) => feed.id === firstFeed.id)) {
    fail("searchFeeds should find the first feed by agency/name");
  }
  if (searchFeeds("environment").length === 0) fail("searchFeeds should find feeds by category/tag");
}

if (failures.length > 0) {
  console.error(`Feed verification failed with ${failures.length} issue(s):`);
  for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`);
  if (failures.length > 50) console.error(`- ...and ${failures.length - 50} more`);
  process.exit(1);
}

console.log(`Feed verification passed: ${feeds.length} feeds, ${categoryList.length} categories.`);
