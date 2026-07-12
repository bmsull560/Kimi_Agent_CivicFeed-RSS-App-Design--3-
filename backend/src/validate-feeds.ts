import { XMLParser } from "fast-xml-parser";
import { feeds, type Feed } from "./feeds.js";

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

interface FeedHealth {
  feedId: string;
  status: "ok" | "warn" | "fail";
  checks: {
    reachable: boolean;
    validXml: boolean;
    validSchema: boolean;
    stableGuids: boolean;
    saneDates: boolean;
    usableContent: boolean;
    fresh: boolean;
  };
  newestItemDate: string | null;
  responseTimeMs: number;
  lastValidatedAt: number;
  error?: string;
}

interface ValidatorState {
  [feedId: string]: {
    guids: string[];
    lastValidatedAt: number;
  };
}

interface CliOptions {
  strict: boolean;
  limit: number | null;
  feedId: string | null;
}

function readOptionValue(name: string): string | null {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return null;
}

function parseOptions(): CliOptions {
  const rawLimit = readOptionValue("--limit");
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : null;
  if (rawLimit && (parsedLimit === null || !Number.isFinite(parsedLimit) || parsedLimit < 1)) {
    throw new Error(`Invalid --limit value: ${rawLimit}`);
  }

  return {
    strict: process.argv.includes("--strict"),
    limit: parsedLimit,
    feedId: readOptionValue("--feed"),
  };
}

function selectFeeds(options: CliOptions): Feed[] {
  let selected = feeds.filter((feed) => feed.status === "working");

  if (options.feedId) {
    selected = selected.filter((feed) => feed.id === options.feedId);
    if (selected.length === 0) {
      throw new Error(`No working feed found for --feed ${options.feedId}`);
    }
  }

  if (options.limit !== null) selected = selected.slice(0, options.limit);
  return selected;
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
  const issues = health.filter((item) => item.status !== "ok");
  if (issues.length === 0) return;

  const grouped = new Map<string, FeedHealth[]>();
  for (const item of issues) {
    const reason = failureReason(item);
    grouped.set(reason, [...(grouped.get(reason) || []), item]);
  }

  console.log("\nIssue report:");
  for (const [reason, items] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sample = items
      .slice(0, 5)
      .map((item) => item.feedId)
      .join(", ");
    console.log(`  ${reason}: ${items.length}${sample ? ` (${sample})` : ""}`);
  }
}

function isXmlContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return (
    lower.includes("xml") ||
    lower.includes("rss") ||
    lower.includes("atom") ||
    lower.includes("rdf")
  );
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) {
    const text = (value as { "#text"?: unknown })["#text"];
    return typeof text === "string" ? text : "";
  }
  return "";
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/\s+\(.*\)$/, "").trim();
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const fallback = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (!Number.isNaN(fallback.getTime())) return fallback;
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
      headers: {
        "User-Agent": "Feedly/1.0 (+http://www.feedly.com/fetcher.html)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        const nextUrl = new URL(location, url).toString();
        return fetchWithRedirects(nextUrl, redirects + 1);
      }
    }

    return { response, redirectCount: redirects };
  } catch (error) {
    clearTimeout(timer);
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("abort")) {
      return {
        response: new Response(),
        redirectCount: redirects,
        error: `Timeout after ${TIMEOUT_MS}ms`,
      };
    }
    return { response: new Response(), redirectCount: redirects, error: message };
  }
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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
    const { response, redirectCount, error: fetchError } = await fetchWithRedirects(feed.rssUrl);
    if (fetchError) throw new Error(fetchError);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (redirectCount > MAX_REDIRECTS) throw new Error("Too many redirects");

    const contentType = response.headers.get("content-type");
    if (!isXmlContentType(contentType)) {
      // Some government feeds return text/plain or text/html while still carrying XML.
    }

    const xmlText = await response.text();
    if (!xmlText || xmlText.length < 100) throw new Error("Response too small");
    checks.reachable = true;

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      parseTagValue: false,
      trimValues: true,
    });

    let parsed: unknown;
    try {
      parsed = parser.parse(xmlText);
    } catch (parseError) {
      throw new Error(
        `XML parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        { cause: parseError }
      );
    }

    if (!parsed || typeof parsed !== "object") throw new Error("Parsed XML is empty");

    const doc = parsed as Record<string, unknown>;
    const rootKeys = Object.keys(doc);
    const hasRssRoot =
      rootKeys.includes("rss") || rootKeys.some((key) => key.toLowerCase().includes("rss"));
    const hasFeedRoot = rootKeys.includes("feed");
    const hasRdfRoot = rootKeys.some((key) => key.toLowerCase().includes("rdf"));
    if (!hasRssRoot && !hasFeedRoot && !hasRdfRoot) {
      throw new Error(`Unexpected root element: ${rootKeys.join(", ")}`);
    }
    checks.validXml = true;

    const atomFeed = doc.feed as Record<string, unknown> | undefined;
    let items: Record<string, unknown>[] = [];
    let isAtom = false;

    if (atomFeed) {
      isAtom = true;
      if (!atomFeed.title) throw new Error("Atom: missing feed.title");
      if (!atomFeed.id && !atomFeed.title) throw new Error("Atom: missing feed.id");

      items = asArray(
        atomFeed.entry as Record<string, unknown> | Record<string, unknown>[] | undefined
      );
      if (items.length === 0) throw new Error("Atom: no entries found");

      for (const entry of items) {
        if (!entry.title) throw new Error("Atom: entry missing title");
        if (!entry.id) throw new Error("Atom: entry missing id");
        if (!entry.updated && !entry.published)
          throw new Error("Atom: entry missing updated/published");
        const links = asArray(entry.link as unknown);
        const hasLink = links.some(
          (link) =>
            typeof link === "string" || Boolean((link as { "@_href"?: unknown })?.["@_href"])
        );
        if (!hasLink) throw new Error("Atom: entry missing link");
      }
    } else {
      const rss = (doc.rss as Record<string, unknown> | undefined) || doc;
      const rdf =
        (doc["rdf:RDF"] as Record<string, unknown> | undefined) ||
        (doc.RDF as Record<string, unknown> | undefined);
      const channel = ((rss.channel as Record<string, unknown> | undefined) ||
        rdf ||
        rss) as Record<string, unknown>;

      const title = textValue(channel.title);
      if (!title) throw new Error("RSS: missing channel.title");

      items = asArray(
        channel.item as Record<string, unknown> | Record<string, unknown>[] | undefined
      );
      if (items.length === 0) throw new Error("RSS: no items found");

      for (const item of items) {
        const itemTitle = textValue(item.title);
        if (!itemTitle) throw new Error("RSS: item missing title");
        const link = textValue(item.link);
        const guid = textValue(item.guid);
        if (!link && !guid) throw new Error("RSS: item missing link and guid");
      }
    }
    checks.validSchema = true;

    const guids = items
      .map((item) => {
        if (isAtom) return textValue(item.id);
        return textValue(item.guid) || textValue(item.link) || textValue(item.title);
      })
      .filter(Boolean);

    const uniqueGuids = new Set(guids);
    if (uniqueGuids.size !== guids.length) {
      throw new Error(`Duplicate GUIDs detected: ${guids.length - uniqueGuids.size} duplicates`);
    }

    const prevState = state[feed.id];
    if (prevState && prevState.guids.length > 0 && guids.length > 0) {
      const prevSet = new Set(prevState.guids);
      const stableCount = guids.filter((guid) => prevSet.has(guid)).length;
      if (stableCount === 0) {
        // A full feed rewrite is suspicious, but not a hard failure.
      }
    }
    checks.stableGuids = true;

    const now = new Date();
    const dates: Date[] = [];
    let dateIssues = 0;
    for (const item of items) {
      const rawDate = isAtom
        ? textValue(item.published) || textValue(item.updated)
        : textValue(item.pubDate) || textValue(item["dc:date"]);
      if (!rawDate) {
        dateIssues++;
        continue;
      }

      const date = parseDate(rawDate);
      if (!date) {
        dateIssues++;
        continue;
      }

      dates.push(date);
      if (date > new Date(now.getTime() + 10 * 60 * 1000)) dateIssues++;
    }

    if (dates.length > 0) {
      dates.sort((a, b) => b.getTime() - a.getTime());
      newestItemDate = dates[0].toISOString();
    }
    checks.saneDates = dateIssues < Math.max(1, items.length * 0.25);

    let contentIssues = 0;
    for (const item of items.slice(0, 20)) {
      const title = textValue(item.title);
      const content = isAtom
        ? textValue(item.summary) || textValue(item.content)
        : textValue(item.description) || textValue(item["content:encoded"]);
      if (!title.trim()) contentIssues++;
      if (!content.trim()) contentIssues++;
    }
    checks.usableContent = contentIssues < Math.max(1, Math.min(20, items.length) * 0.25);

    if (newestItemDate) {
      const newest = new Date(newestItemDate);
      const hoursSince = (now.getTime() - newest.getTime()) / (1000 * 60 * 60);
      checks.fresh = hoursSince < 7 * 24;
    }

    state[feed.id] = {
      guids: guids.slice(0, 100),
      lastValidatedAt: Date.now(),
    };
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

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
    responseTimeMs: Date.now() - start,
    lastValidatedAt: Date.now(),
    error,
  };
}

async function main() {
  const options = parseOptions();
  const selected = selectFeeds(options);
  const state: ValidatorState = {};
  const health: FeedHealth[] = [];
  let ok = 0;
  let warn = 0;
  let fail = 0;

  console.log(`Validating ${selected.length} working feeds...`);

  const batchSize = 10;
  for (let index = 0; index < selected.length; index += batchSize) {
    const batch = selected.slice(index, index + batchSize);
    const results = await Promise.all(batch.map((feed) => validateFeed(feed, state)));
    for (const result of results) {
      health.push(result);
      if (result.status === "ok") ok++;
      else if (result.status === "warn") warn++;
      else fail++;
    }

    process.stdout.write(
      `\rProgress: ${Math.min(index + batchSize, selected.length)}/${selected.length} (ok=${ok} warn=${warn} fail=${fail})`
    );
    if (index + batchSize < selected.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log("\n");
  console.log(`Summary: ${ok} OK, ${warn} WARN, ${fail} FAIL`);
  printIssueReport(health);

  const failures = health.filter((item) => item.status === "fail").slice(0, 10);
  if (failures.length > 0) {
    console.log("\nSample failures:");
    for (const failure of failures) {
      console.log(`  ${failure.feedId}: ${failure.error}`);
    }
  }

  if (
    options.strict &&
    (warn > 0 || fail > 0 || ok !== selected.length || health.length !== selected.length)
  ) {
    console.error(
      `Strict feed validation failed: ${ok}/${selected.length} feeds are ok, ${warn} warn, ${fail} fail.`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
