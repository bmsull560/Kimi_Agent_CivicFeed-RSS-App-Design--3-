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

const { feeds, feedStats, categoryList } = loadTsExports("src/data/feeds.ts");
const appSource = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const cacheSource = fs.readFileSync(path.join(root, "src", "hooks", "useRssFeed.ts"), "utf8");
const rssSource = fs.readFileSync(path.join(root, "src", "lib", "rss.ts"), "utf8");

const requiredRoutes = [
  'path="/" element={<Dashboard />}',
  'path="/feeds" element={<FeedDirectory />}',
  'path="/feed/:id" element={<FeedDetail />}',
];

for (const route of requiredRoutes) {
  if (!appSource.includes(route)) fail(`missing required route wiring: ${route}`);
}

if (feeds.length < 505) fail(`expected 505+ feeds, found ${feeds.length}`);
if (feedStats.total !== feeds.length) fail(`feedStats.total must equal feeds.length (${feeds.length})`);

const workingCount = feeds.filter((feed) => feed.status === "working").length;
if (workingCount < 505) {
  fail(`expected 505+ feeds marked working/verified, found ${workingCount}`);
}

const categories = new Set(categoryList);
for (const feed of feeds) {
  if (!categories.has(feed.category)) fail(`${feed.id} category is not filterable via categoryList: ${feed.category}`);
  if (!feed.name || !feed.shortName || !feed.agency || !feed.description) fail(`${feed.id} is missing display/search metadata`);
}

if (!rssSource.includes("fetchWithTimeout")) fail("RSS fetching should use timeout handling");
if (!rssSource.includes("PROXIES")) fail("RSS fetching should keep proxy fallbacks");
if (!rssSource.includes("parseRssXml")) fail("RSS parser export is missing");
if (!cacheSource.includes("allowStale")) fail("RSS hook should render stale cached entries while refreshing");
if (!cacheSource.includes("setCachedFeed")) fail("RSS hook should write successful fetches to cache");

if (failures.length > 0) {
  console.error("Acceptance audit incomplete:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Acceptance audit passed.");
