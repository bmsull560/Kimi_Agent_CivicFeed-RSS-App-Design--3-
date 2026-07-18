import fs from "node:fs";
import path from "node:path";
import { feeds } from "./feeds.js";
import { validateFeeds, DEFAULT_USER_AGENT, type ValidationReport } from "./feed-validator.js";
import { REQUEST_TIMEOUT_MS } from "./url-security.js";

interface CliOptions {
  out: string;
  limit: number | null;
  offset: number;
  concurrency: number;
  timeoutMs: number;
  ids: Set<string>;
  statuses: Set<string>;
  maxRetries: number;
  perHostConcurrency: number;
  previousReport: ValidationReport | undefined;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    out: path.join(process.cwd(), "artifacts", "live-feed-validation.json"),
    limit: null,
    offset: 0,
    concurrency: 8,
    timeoutMs: REQUEST_TIMEOUT_MS,
    ids: new Set(),
    statuses: new Set(),
    maxRetries: 2,
    perHostConcurrency: 2,
    previousReport: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--out":
        options.out = args[++i] ?? options.out;
        break;
      case "--limit":
        options.limit = Number.parseInt(args[++i] ?? "0", 10) || null;
        break;
      case "--offset":
        options.offset = Number.parseInt(args[++i] ?? "0", 10) || 0;
        break;
      case "--concurrency":
        options.concurrency = Number.parseInt(args[++i] ?? "8", 10) || 8;
        break;
      case "--timeout-ms":
        options.timeoutMs =
          Number.parseInt(args[++i] ?? String(REQUEST_TIMEOUT_MS), 10) || REQUEST_TIMEOUT_MS;
        break;
      case "--max-retries":
        options.maxRetries = Number.parseInt(args[++i] ?? "2", 10) || 2;
        break;
      case "--per-host-concurrency":
        options.perHostConcurrency = Number.parseInt(args[++i] ?? "2", 10) || 2;
        break;
      case "--ids":
        for (const id of (args[++i] ?? "").split(",")) {
          if (id.trim()) options.ids.add(id.trim());
        }
        break;
      case "--status":
        for (const status of (args[++i] ?? "").split(",")) {
          if (status.trim()) options.statuses.add(status.trim());
        }
        break;
      case "--previous-report": {
        const reportPath = args[++i];
        if (reportPath) {
          options.previousReport = JSON.parse(
            fs.readFileSync(reportPath, "utf8")
          ) as ValidationReport;
        }
        break;
      }
      case "--discover":
        // Inventory-wide discovery is intentionally not supported.
        break;
      default:
        if (arg?.startsWith("--")) {
          console.warn(`Unknown option: ${arg}`);
        }
    }
  }

  return options;
}

function selectFeeds(options: CliOptions): typeof feeds {
  let selected = [...feeds];
  if (options.ids.size > 0) {
    selected = selected.filter((feed) => options.ids.has(feed.id));
  }
  if (options.statuses.size > 0) {
    selected = selected.filter((feed) => options.statuses.has(feed.status));
  }
  if (options.offset > 0) {
    selected = selected.slice(options.offset);
  }
  if (options.limit !== null && options.limit > 0) {
    selected = selected.slice(0, options.limit);
  }
  return selected;
}

async function main() {
  const options = parseArgs();
  const selected = selectFeeds(options);

  console.log(`Validating ${selected.length} feeds...`);

  const { report } = await validateFeeds(selected, {
    userAgent: DEFAULT_USER_AGENT,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
    perHostConcurrency: options.perHostConcurrency,
    globalConcurrency: options.concurrency,
    previousReport: options.previousReport,
  });

  const absoluteOutPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(absoluteOutPath), { recursive: true });
  fs.writeFileSync(absoluteOutPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Validation complete: ${report.working}/${report.selected} working.`);
  console.log(`Transport: ${JSON.stringify(report.transport)}`);
  console.log(`Parse: ${JSON.stringify(report.parse)}`);
  console.log(`Freshness: ${JSON.stringify(report.freshness)}`);
  console.log(`Operational: ${JSON.stringify(report.operational)}`);
  console.log(`Wrote ${path.relative(process.cwd(), absoluteOutPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
