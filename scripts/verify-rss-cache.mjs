import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const failures = [];

function fail(message) {
  failures.push(message);
}

function loadTsModule(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const sandbox = {
    AbortController,
    URL,
    clearTimeout,
    console,
    exports: {},
    fetch,
    localStorage: globalThis.localStorage,
    module: { exports: {} },
    require,
    setTimeout,
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename });
  return sandbox.module.exports;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) fail(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const rss = loadTsModule("src/lib/rss.ts");

const rssEntries = rss.parseRssXml(`
  <rss version="2.0">
    <channel>
      <item>
        <title>Safety bulletin</title>
        <link>/news/safety</link>
        <description><![CDATA[<p>Details</p>]]></description>
        <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
        <dc:creator>Agency editor</dc:creator>
        <category>Alerts</category>
        <guid>rss-guid-1</guid>
      </item>
    </channel>
  </rss>
`, "feed-test", "Test Feed", "https://agency.gov/rss.xml");

assertEqual(rssEntries.length, 1, "RSS parser should return one item");
assertEqual(rssEntries[0]?.id, "rss-guid-1", "RSS parser should prefer guid as id");
assertEqual(rssEntries[0]?.link, "https://agency.gov/news/safety", "RSS parser should resolve relative links");
assertEqual(rssEntries[0]?.author, "Agency editor", "RSS parser should read namespaced creator");
assert(rssEntries[0]?.categories?.includes("Alerts"), "RSS parser should preserve categories");

const atomEntries = rss.parseRssXml(`
  <feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <id>tag:agency.gov,2026:1</id>
      <title>Atom update</title>
      <link rel="alternate" href="/atom/update" />
      <updated>2026-06-15T10:30:00Z</updated>
      <summary>Summary text</summary>
      <author><name>Atom author</name></author>
      <category term="policy" />
    </entry>
  </feed>
`, "feed-atom", "Atom Feed", "https://agency.gov/feed");

assertEqual(atomEntries.length, 1, "Atom parser should return one entry");
assertEqual(atomEntries[0]?.link, "https://agency.gov/atom/update", "Atom parser should resolve href links");
assertEqual(atomEntries[0]?.author, "Atom author", "Atom parser should read author name");
assert(atomEntries[0]?.categories?.includes("policy"), "Atom parser should preserve category terms");

const guidEntries = rss.parseRssXml(`
  <rss><channel><item><title>SharePoint item</title><guid>https://agency.gov/pages/item.aspx</guid><pubDate>06/15/2026</pubDate></item></channel></rss>
`, "feed-guid", "Guid Feed", "https://agency.gov/feed.aspx");

assertEqual(guidEntries.length, 1, "RSS parser should parse guid-only items");
assertEqual(guidEntries[0]?.link, "https://agency.gov/pages/item.aspx", "RSS parser should use guid as link when link is missing");

const htmlEntries = rss.parseRssXml(`
  <html><body><item><title>Embedded item</title><link>/embedded</link><description>HTML fallback</description></item></body></html>
`, "feed-html", "HTML Feed", "https://agency.gov/base/feed");

assertEqual(htmlEntries.length, 1, "HTML fallback should parse embedded item tags");
assertEqual(htmlEntries[0]?.link, "https://agency.gov/embedded", "HTML fallback should resolve links");

const malformedEntries = rss.parseRssXml("<html><body>No feed here</body></html>", "feed-empty", "Empty Feed", "https://agency.gov");
assertEqual(malformedEntries.length, 0, "Malformed non-feed content should return no entries");

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => {
    storage.set(key, String(value));
  },
  removeItem: (key) => {
    storage.delete(key);
  },
};

const cache = loadTsModule("src/lib/cache.ts");
cache.invalidateAll();
cache.setCachedFeed("feed-test", rssEntries);

const fresh = cache.getCachedFeed("feed-test");
assertEqual(fresh?.entries.length, 1, "Cache should return freshly stored entries");
assert(cache.isCacheFresh(fresh), "Fresh cache entry should be fresh");

const staleFetchedAt = Date.now() - 60 * 60 * 1000;
localStorage.setItem("civicfeed_v2_cache", JSON.stringify([{
  feedId: "feed-stale",
  entries: rssEntries,
  fetchedAt: staleFetchedAt,
  accessedAt: staleFetchedAt,
}]));

assertEqual(cache.getCachedFeed("feed-stale"), null, "Default cache lookup should hide stale entries");
const stale = cache.getCachedFeed("feed-stale", { allowStale: true });
assertEqual(stale?.entries.length, 1, "Stale cache lookup should return entries when allowStale is true");
assert(!cache.isCacheFresh(stale), "Stale cache entry should not be fresh");

if (failures.length > 0) {
  console.error(`RSS/cache verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RSS/cache verification passed.");
