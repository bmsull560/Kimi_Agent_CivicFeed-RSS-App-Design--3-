import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function loadTsExports(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} } };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename });
  return sandbox.module.exports;
}

// The backend is the single source of truth for the static catalog.
const { feeds, feedStats, categoryList } = loadTsExports("backend/src/feeds.ts");

const appSource = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const rssSource = fs.readFileSync(path.join(root, "src", "lib", "rss.ts"), "utf8");
const hookSource = fs.readFileSync(path.join(root, "src", "hooks", "useRssFeed.ts"), "utf8");

const requiredRoutes = [
  'path="/" element={<Dashboard />}',
  'path="/feeds" element={<FeedDirectory />}',
  'path="/feed/:id" element={<FeedDetail />}',
];

for (const route of requiredRoutes) {
  if (!appSource.includes(route)) fail(`missing required route wiring: ${route}`);
}

if (feeds.length < 505) fail(`expected 505+ feeds in backend catalog, found ${feeds.length}`);
if (feedStats.total !== feeds.length)
  fail(`feedStats.total must equal feeds.length (${feeds.length})`);

const workingCount = feeds.filter((feed) => feed.status === "working").length;
if (workingCount < 505) {
  fail(`expected 505+ feeds marked working/verified, found ${workingCount}`);
}

const categories = new Set(categoryList);
for (const feed of feeds) {
  if (!categories.has(feed.category))
    fail(`${feed.id} category is not filterable via categoryList: ${feed.category}`);
  if (!feed.name || !feed.shortName || !feed.agency || !feed.description)
    fail(`${feed.id} is missing display/search metadata`);
}

// Architectural consolidation invariants.
if (rssSource.includes("allorigins") || rssSource.includes("corsproxy")) {
  fail("frontend RSS fetching must not fall back to public CORS proxies");
}
if (rssSource.includes("parseRssXml")) {
  fail("frontend RSS fetching must not parse XML; parsing lives in the backend");
}
if (!rssSource.includes("/api/feeds/") || !rssSource.includes("/articles")) {
  fail("frontend must fetch articles via the backend /api/feeds/:id/articles endpoint");
}
if (!rssSource.includes("AbortSignal.timeout")) {
  fail("frontend API calls should use timeout handling");
}
if (hookSource.includes("setCachedFeed") || hookSource.includes("allowStale")) {
  fail("useRssFeed must not implement a localStorage cache; rely on backend HTTP caching");
}

// Backend parser must exist as the consolidated parser.
const parserPath = path.join(root, "backend", "src", "rss-parser.ts");
if (!fs.existsSync(parserPath))
  fail("backend/src/rss-parser.ts is missing; parsing must live in the backend");
const parserSource = fs.readFileSync(parserPath, "utf8");
if (!parserSource.includes("export function parseRssXml")) {
  fail("backend rss-parser.ts must export parseRssXml");
}

// Ensure legacy frontend catalog and cache files are gone.
const removedPaths = [
  "src/data/feeds.ts",
  "src/lib/cache.ts",
  "src/hooks/useFeedCache.ts",
  "scripts/verify-backend-catalog-sync.mjs",
];
for (const removed of removedPaths) {
  if (fs.existsSync(path.join(root, removed)))
    fail(`legacy file should have been removed: ${removed}`);
}

if (failures.length > 0) {
  console.error("Acceptance audit incomplete:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Acceptance audit passed.");
