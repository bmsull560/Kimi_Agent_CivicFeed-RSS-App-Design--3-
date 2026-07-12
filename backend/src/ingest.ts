import { enrichArticle } from "./ai.js";
import { saveArticles } from "./cache.js";
import { db, seedFeeds } from "./db.js";
import { feeds, type Feed } from "./feeds.js";
import { fetchFeed, type RssEntry } from "./rss.js";

interface CliOptions {
  limit: number | null;
  feedId: string | null;
  enrich: boolean;
}

interface IngestResult {
  feedId: string;
  feedName: string;
  status: "ok" | "error";
  fetched: number;
  enriched: number;
  error: string | null;
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
    limit: parsedLimit,
    feedId: readOptionValue("--feed"),
    enrich: process.argv.includes("--enrich"),
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

  if (options.limit !== null) {
    selected = selected.slice(0, options.limit);
  }

  return selected;
}

async function enrichEntries(entries: RssEntry[]): Promise<number> {
  let enriched = 0;
  for (const entry of entries) {
    await enrichArticle(entry.id, entry.feedId, entry.title, entry.description);
    enriched++;
  }
  return enriched;
}

async function ingestFeed(feed: Feed, enrich: boolean): Promise<IngestResult> {
  const result = await fetchFeed(feed.rssUrl, feed.id, feed.name);
  if (result.error) {
    return {
      feedId: feed.id,
      feedName: feed.name,
      status: "error",
      fetched: 0,
      enriched: 0,
      error: result.error,
    };
  }

  saveArticles(feed.id, result.entries);
  const enriched = enrich ? await enrichEntries(result.entries) : 0;

  return {
    feedId: feed.id,
    feedName: feed.name,
    status: "ok",
    fetched: result.entries.length,
    enriched,
    error: null,
  };
}

async function main() {
  const options = parseOptions();
  seedFeeds();

  const selected = selectFeeds(options);
  console.log(
    `Ingesting ${selected.length} working feeds${options.enrich ? " with enrichment" : ""}...`
  );

  const results: IngestResult[] = [];
  for (const feed of selected) {
    const result = await ingestFeed(feed, options.enrich);
    results.push(result);

    if (result.status === "ok") {
      console.log(`OK    ${result.feedId} ${result.feedName}: ${result.fetched} articles`);
    } else {
      console.log(`ERROR ${result.feedId} ${result.feedName}: ${result.error}`);
    }
  }

  const ok = results.filter((result) => result.status === "ok").length;
  const failed = results.length - ok;
  const articleCount = (
    db.prepare("SELECT COUNT(*) as c FROM article_cache").get() as { c: number }
  ).c;
  const cachedFeeds = (
    db.prepare("SELECT COUNT(DISTINCT feed_id) as c FROM article_cache").get() as { c: number }
  ).c;

  console.log(`\nIngestion complete: ${ok} ok, ${failed} failed.`);
  console.log(`Cache now contains ${articleCount} articles across ${cachedFeeds} feeds.`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
