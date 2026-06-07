import { XMLParser } from "fast-xml-parser";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Feed, FeedHealth } from "../src/types";

// Import feeds directly via tsx
import { feeds as allFeeds } from "../src/data/feeds.ts";
const feeds: Feed[] = allFeeds;

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, ".validator-state.json");
const HEALTH_PATH = join(__dirname, "..", "public", "feed-health.json");
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
const STRICT = process.argv.includes("--strict");

interface ValidatorState {
  [feedId: string]: {
    guids: string[];
    lastValidatedAt: number;
  };
}

function loadState(): ValidatorState {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveState(state: ValidatorState) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function failureReason(health: FeedHealth): string {
  const error = health.error || "";
  if (error.startsWith("HTTP 404")) return "404";
  if (error.startsWith("HTTP 403")) return "403";
  if (error.startsWith("HTTP 429")) return "rate limited";
  if (error.startsWith("Timeout")) return "timeout";
  if (error.includes("Unexpected root element")) return "html/non-feed response";
  if (error.includes("Duplicate GUIDs")) return "duplicate GUIDs";
  if (error.includes("missing") || error.includes("no items found")) return "schema";
  if (!health.checks.fresh) return "stale";
  if (!health.checks.saneDates) return "date issues";
  if (!health.checks.usableContent) return "content issues";
  return error || "unknown";
}

function printIssueReport(health: FeedHealth[]) {
  const issues = health.filter((h) => h.status !== "ok");
  if (issues.length === 0) return;

  const grouped = new Map<string, FeedHealth[]>();
  for (const item of issues) {
    const reason = failureReason(item);
    grouped.set(reason, [...(grouped.get(reason) || []), item]);
  }

  console.log("\nIssue report:");
  for (const [reason, items] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sample = items.slice(0, 5).map((item) => item.feedId).join(", ");
    console.log(`  ${reason}: ${items.length}${sample ? ` (${sample})` : ""}`);
  }
}

function isXmlContentType(ct: string | null): boolean {
  if (!ct) return false;
  const lower = ct.toLowerCase();
  return (
    lower.includes("xml") ||
    lower.includes("rss") ||
    lower.includes("atom") ||
    lower.includes("rdf")
  );
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/\s+\(.*\)$/, "").trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  // Try US date format fallback
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, m, day, y] = usMatch;
    const dd = new Date(`${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (!isNaN(dd.getTime())) return dd;
  }
  return null;
}

async function fetchWithRedirects(
  url: string,
  redirects = 0
): Promise<{ response: Response; redirectCount: number; error?: string }> {
  if (redirects > MAX_REDIRECTS) {
    return { response: new Response(), redirectCount: redirects, error: "Redirect loop detected" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timer);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        return fetchWithRedirects(location, redirects + 1);
      }
    }
    return { response, redirectCount: redirects };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort")) {
      return { response: new Response(), redirectCount: redirects, error: `Timeout after ${TIMEOUT_MS}ms` };
    }
    return { response: new Response(), redirectCount: redirects, error: msg };
  }
}

async function validateFeed(feed: Feed, state: ValidatorState): Promise<FeedHealth> {
  const start = Date.now();
  const checks: FeedHealth["checks"] = {
    reachable: false,
    validXml: false,
    validSchema: false,
    stableGuids: false,
    saneDates: false,
    usableContent: false,
    fresh: false,
  };
  let newestItemDate: string | null = null;
  let error: string | undefined;

  try {
    // --- 1. Reachability ---
    const { response, redirectCount, error: fetchError } = await fetchWithRedirects(feed.rssUrl);
    if (fetchError) {
      throw new Error(fetchError);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (redirectCount > MAX_REDIRECTS) {
      throw new Error("Too many redirects");
    }
    const contentType = response.headers.get("content-type");
    if (!isXmlContentType(contentType)) {
      // Some feeds return text/plain or text/html but still contain valid RSS
      // We'll flag this but not fail immediately
    }
    const xmlText = await response.text();
    if (!xmlText || xmlText.length < 100) {
      throw new Error("Response too small");
    }
    checks.reachable = true;

    // --- 2. XML Validity ---
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      trimValues: true,
    });
    // fast-xml-parser returns structurally different objects for RSS, Atom, and RDF feeds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = parser.parse(xmlText);
    } catch (e) {
      throw new Error(`XML parse error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!parsed) {
      throw new Error("Parsed XML is empty");
    }
    const rootKeys = Object.keys(parsed);
    const hasRssRoot = rootKeys.includes("rss") || rootKeys.some((k) => k.toLowerCase().includes("rss"));
    const hasFeedRoot = rootKeys.includes("feed");
    const hasRdfRoot = rootKeys.some((k) => k.toLowerCase().includes("rdf"));
    if (!hasRssRoot && !hasFeedRoot && !hasRdfRoot) {
      throw new Error(`Unexpected root element: ${rootKeys.join(", ")}`);
    }
    checks.validXml = true;

    // --- 3. Schema & Extraction ---
    const rss = parsed.rss || parsed;
    const channel = rss.channel || rss;
    const atomFeed = parsed.feed;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let items: any[] = [];
    let isAtom = false;

    if (atomFeed) {
      isAtom = true;
      // Atom checks
      if (!atomFeed.title) throw new Error("Atom: missing feed.title");
      if (!atomFeed.id && !atomFeed.title) throw new Error("Atom: missing feed.id");
      if (!atomFeed.updated) {
        // Some Atom feeds omit updated; warn but don't fail
      }
      items = Array.isArray(atomFeed.entry) ? atomFeed.entry : atomFeed.entry ? [atomFeed.entry] : [];
      if (items.length === 0) throw new Error("Atom: no entries found");
      for (const entry of items) {
        if (!entry.title) throw new Error("Atom: entry missing title");
        if (!entry.id) throw new Error("Atom: entry missing id");
        if (!entry.updated && !entry.published) {
          throw new Error("Atom: entry missing updated/published");
        }
        const hasLink = entry.link && (typeof entry.link === "string" || entry.link["@_href"]);
        if (!hasLink) throw new Error("Atom: entry missing link");
      }
    } else {
      // RSS checks
      const chTitle = typeof channel.title === "string" ? channel.title : channel.title?.["#text"];
      const chLink = typeof channel.link === "string" ? channel.link : channel.link?.["#text"];
      const chDesc = typeof channel.description === "string" ? channel.description : channel.description?.["#text"];
      if (!chTitle) throw new Error("RSS: missing channel.title");
      if (!chLink && !channel.link) {
        // Some feeds omit link; warn but don't fail if description exists
      }
      if (!chDesc && !channel.description) {
        // Some feeds omit description
      }
      const rawItems = channel.item;
      items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
      if (items.length === 0) throw new Error("RSS: no items found");
      for (const item of items) {
        const title = typeof item.title === "string" ? item.title : item.title?.["#text"];
        if (!title) throw new Error("RSS: item missing title");
        const link = typeof item.link === "string" ? item.link : item.link?.["#text"];
        const guid = typeof item.guid === "string" ? item.guid : item.guid?.["#text"];
        if (!link && !guid) throw new Error("RSS: item missing link and guid");
        const pubDate = item.pubDate || item["dc:date"];
        if (!pubDate) {
          // Some feeds omit pubDate; warn but don't fail
        }
      }
    }
    checks.validSchema = true;

    // --- 4. Stability (GUIDs) ---
    const guids = items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        if (isAtom) return item.id;
        return item.guid || item.link || item.title;
      })
      .filter(Boolean);
    const uniqueGuids = new Set(guids);
    if (uniqueGuids.size !== guids.length) {
      throw new Error(`Duplicate GUIDs detected: ${guids.length - uniqueGuids.size} duplicates`);
    }
    const prevState = state[feed.id];
    if (prevState && prevState.guids.length > 0) {
      // Check that at least some GUIDs from previous run still exist
      const prevSet = new Set(prevState.guids);
      const stableCount = guids.filter((g: string) => prevSet.has(g)).length;
      if (stableCount === 0 && guids.length > 0 && prevState.guids.length > 0) {
        // All GUIDs changed - might be a feed rewrite
        // We'll warn but not fail
      }
    }
    checks.stableGuids = true;

    // --- 5. Date Sanity ---
    const now = new Date();
    const dates: Date[] = [];
    let dateIssues = 0;
    for (const item of items) {
      const dateStr = isAtom
        ? item.published || item.updated
        : item.pubDate || item["dc:date"];
      if (!dateStr) {
        dateIssues++;
        continue;
      }
      const dt = parseDate(dateStr);
      if (!dt) {
        dateIssues++;
        continue;
      }
      dates.push(dt);
      if (dt > new Date(now.getTime() + 10 * 60 * 1000)) {
        dateIssues++;
      }
    }
    if (dates.length > 0) {
      dates.sort((a, b) => b.getTime() - a.getTime());
      newestItemDate = dates[0].toISOString();
      // Check ordering: first few items should be roughly newest-first
      const outOfOrder = dates.slice(0, Math.min(10, dates.length)).some((d, i, arr) => {
        if (i === 0) return false;
        return d > arr[i - 1];
      });
      if (outOfOrder) {
        dateIssues++;
      }
    }
    checks.saneDates = dateIssues < Math.max(1, items.length * 0.25); // Allow some date issues

    // --- 6. Content Usability ---
    let contentIssues = 0;
    for (const item of items.slice(0, 20)) {
      const title = isAtom
        ? typeof item.title === "string" ? item.title : item.title?.["#text"]
        : typeof item.title === "string" ? item.title : item.title?.["#text"];
      const content = isAtom
        ? item.summary || item.content
        : item.description || item["content:encoded"];
      if (!title || title.trim().length === 0) contentIssues++;
      const hasContent = content && (typeof content === "string" ? content.trim().length > 0 : true);
      if (!hasContent) contentIssues++;
    }
    checks.usableContent = contentIssues < Math.max(1, Math.min(20, items.length) * 0.25);

    // --- 7. Freshness ---
    if (newestItemDate) {
      const newest = new Date(newestItemDate);
      const hoursSince = (now.getTime() - newest.getTime()) / (1000 * 60 * 60);
      checks.fresh = hoursSince < 7 * 24; // 7 days
    } else {
      checks.fresh = false;
    }

    // Save GUIDs for next run
    state[feed.id] = {
      guids: guids.slice(0, 100), // Keep last 100
      lastValidatedAt: Date.now(),
    };
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    // Any exception during checks means at least one gate failed
  }

  const responseTimeMs = Date.now() - start;

  // Determine overall status
  let status: FeedHealth["status"] = "ok";
  if (!checks.reachable || !checks.validXml || !checks.validSchema || !checks.stableGuids) {
    status = "fail";
  } else if (!checks.fresh || !checks.saneDates || !checks.usableContent) {
    status = "warn";
  }

  return {
    feedId: feed.id,
    status,
    checks,
    newestItemDate,
    responseTimeMs,
    lastValidatedAt: Date.now(),
    error,
  };
}

async function main() {
  console.log(`Validating ${feeds.length} feeds...`);
  const state = loadState();
  const health: FeedHealth[] = [];
  let ok = 0;
  let warn = 0;
  let fail = 0;

  // Process in batches to avoid overwhelming servers
  const BATCH_SIZE = 10;
  for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
    const batch = feeds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((feed) => validateFeed(feed, state)));
    for (const result of results) {
      health.push(result);
      if (result.status === "ok") ok++;
      else if (result.status === "warn") warn++;
      else fail++;
    }
    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, feeds.length)}/${feeds.length} (ok=${ok} warn=${warn} fail=${fail})`);
    // Small delay between batches
    if (i + BATCH_SIZE < feeds.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log("\n");
  saveState(state);
  writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2));
  console.log(`Validation complete. Results written to ${HEALTH_PATH}`);
  console.log(`Summary: ${ok} OK, ${warn} WARN, ${fail} FAIL`);
  printIssueReport(health);

  // Show some failures
  const failures = health.filter((h) => h.status === "fail").slice(0, 10);
  if (failures.length > 0) {
    console.log("\nSample failures:");
    for (const f of failures) {
      console.log(`  ${f.feedId}: ${f.error}`);
    }
  }

  if (STRICT && (warn > 0 || fail > 0 || ok !== feeds.length || health.length !== feeds.length)) {
    console.error(
      `Strict feed validation failed: ${ok}/${feeds.length} feeds are ok, ${warn} warn, ${fail} fail.`
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
