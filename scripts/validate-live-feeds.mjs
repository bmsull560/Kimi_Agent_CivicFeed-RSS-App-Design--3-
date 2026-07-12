import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const args = new Map();

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, "true");
  }
}

const limit = Number(args.get("limit") ?? 0);
const offset = Number(args.get("offset") ?? 0);
const concurrency = Math.max(1, Number(args.get("concurrency") ?? 8));
const timeoutMs = Math.max(1000, Number(args.get("timeout-ms") ?? 12000));
const outPath = args.get("out") ?? path.join("artifacts", "live-feed-validation.json");
const ids = new Set((args.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean));
const statuses = new Set((args.get("status") ?? "").split(",").map((status) => status.trim()).filter(Boolean));
const discover = args.get("discover") === "true";

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
    module: { exports: {} },
    require,
    setTimeout,
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename });
  return sandbox.module.exports;
}

// All feed metadata now lives in the backend catalog; parsing lives there too.
const { feeds } = loadTsModule("backend/src/feeds.ts");
const { parseRssXml } = loadTsModule("backend/src/rss-parser.ts");

function classifyFormat(xmlText) {
  const text = xmlText.slice(0, 5000).toLowerCase();
  if (text.includes("<rss") && text.includes("<item")) return "RSS";
  if (text.includes("<feed") && text.includes("<entry")) return "Atom";
  if (text.includes("<rdf:rdf") && text.includes("<item")) return "RDF RSS";
  if (text.includes("<alert") && text.includes("<identifier")) return "CAP XML";
  if (text.includes("<item")) return "HTML-embedded RSS";
  return "Unknown";
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractDiscoveredFeedCandidates(htmlText, baseUrl) {
  const candidates = new Set();
  const linkTagMatches = htmlText.matchAll(/<link\b[^>]*>/gi);
  for (const match of linkTagMatches) {
    const tag = match[0];
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const type = tag.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    if (!rel.includes("alternate")) continue;
    if (!/(rss|atom|xml)/.test(type)) continue;
    try {
      candidates.add(new URL(decodeHtmlEntities(href), baseUrl).toString());
    } catch {
      continue;
    }
  }

  const hrefMatches = htmlText.matchAll(/\bhref=["']([^"']*(?:rss|feed|atom)[^"']*)["']/gi);
  for (const match of hrefMatches) {
    try {
      const candidate = new URL(decodeHtmlEntities(match[1]), baseUrl).toString();
      if (candidate.startsWith("https://")) candidates.add(candidate);
    } catch {
      continue;
    }
  }

  return [...candidates].filter((candidate) => candidate !== baseUrl).slice(0, 8);
}

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "User-Agent": "CivicFeed-LiveValidator/1.0",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function validateUrl(url, feed) {
  const startedAt = Date.now();
  const response = await fetchWithTimeout(url, timeoutMs);
  const responseTimeMs = Date.now() - startedAt;
  const text = await response.text();
  const entries = response.ok ? parseRssXml(text, feed.id, feed.shortName) : [];
  return {
    response,
    responseTimeMs,
    text,
    entries,
  };
}

async function tryParseUrl(url, feed, source, startedAt) {
  const parsed = await validateUrl(url, feed);
  if (parsed.entries.length === 0) return { parsed, result: null };
  return {
    parsed,
    result: {
      id: feed.id,
      name: feed.name,
      category: feed.category,
      rssUrl: feed.rssUrl,
      discoveredUrl: source === "discovered" ? url : null,
      previousStatus: feed.status,
      status: "working",
      httpStatus: parsed.response.status,
      finalUrl: parsed.response.url,
      format: classifyFormat(parsed.text),
      entries: parsed.entries.length,
      newestItemDate: parsed.entries
        .map((entry) => Date.parse(entry.pubDate))
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0] ?? null,
      responseTimeMs: Date.now() - startedAt,
      source,
      error: null,
    },
  };
}

async function validateFeed(feed) {
  const startedAt = Date.now();
  try {
    const { parsed: primary, result: primaryResult } = await tryParseUrl(feed.rssUrl, feed, "direct", startedAt);
    if (primaryResult) return primaryResult;

    // Public CORS proxies are intentionally not used in production validation.
    // If the direct feed is unreachable, optionally discover an alternate feed URL.
    if (discover && primary.response.ok && primary.text) {
      const candidates = extractDiscoveredFeedCandidates(primary.text, primary.response.url || feed.rssUrl);
      for (const candidate of candidates) {
        try {
          const { result } = await tryParseUrl(candidate, feed, "discovered", startedAt);
          if (result) return result;
        } catch {
          continue;
        }
      }
    }

    return {
      id: feed.id,
      name: feed.name,
      category: feed.category,
      rssUrl: feed.rssUrl,
      discoveredUrl: null,
      previousStatus: feed.status,
      status: "blocked",
      httpStatus: primary.response.status,
      finalUrl: primary.response.url,
      format: classifyFormat(primary.text),
      entries: 0,
      newestItemDate: null,
      responseTimeMs: Date.now() - startedAt,
      error: "No parseable entries returned",
    };
  } catch (error) {
    return {
      id: feed.id,
      name: feed.name,
      category: feed.category,
      rssUrl: feed.rssUrl,
      discoveredUrl: null,
      previousStatus: feed.status,
      status: "blocked",
      httpStatus: null,
      finalUrl: null,
      format: "Unknown",
      entries: 0,
      newestItemDate: null,
      responseTimeMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

let selected = feeds;
if (ids.size > 0) selected = selected.filter((feed) => ids.has(feed.id));
if (statuses.size > 0) selected = selected.filter((feed) => statuses.has(feed.status));
if (offset > 0) selected = selected.slice(offset);
if (limit > 0) selected = selected.slice(0, limit);

const results = [];
let nextIndex = 0;

async function worker() {
  while (nextIndex < selected.length) {
    const index = nextIndex;
    nextIndex += 1;
    const feed = selected[index];
    const result = await validateFeed(feed);
    results[index] = result;
    const marker = result.status === "working" ? "OK" : "FAIL";
    console.log(`[${marker}] ${result.id} ${result.entries} entries ${result.responseTimeMs}ms ${result.rssUrl}`);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, () => worker()));

const sortedResults = results.filter(Boolean);
const summary = {
  validatedAt: new Date().toISOString(),
  selected: selected.length,
  working: sortedResults.filter((result) => result.status === "working").length,
  blocked: sortedResults.filter((result) => result.status === "blocked").length,
  timeoutMs,
  concurrency,
  discover,
};

const output = { summary, results: sortedResults };
const absoluteOutPath = path.resolve(root, outPath);
fs.mkdirSync(path.dirname(absoluteOutPath), { recursive: true });
fs.writeFileSync(absoluteOutPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(`Live feed validation complete: ${summary.working}/${summary.selected} working.`);
console.log(`Wrote ${path.relative(root, absoluteOutPath)}`);
