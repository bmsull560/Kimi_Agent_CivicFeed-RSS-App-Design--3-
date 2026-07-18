import fs from "node:fs";
import path from "node:path";
import {
  applyPlanToSource,
  exceedsMassChangeGuard,
  parseReport,
  planStatusUpdates,
  summarizePlan,
  type CatalogStatus,
} from "./apply-feed-statuses.js";

interface CliOptions {
  reportPath: string;
  dryRun: boolean;
  allowMassBlock: boolean;
}

function parseArgs(): CliOptions {
  const options: CliOptions = {
    reportPath: path.join(process.cwd(), "artifacts", "live-feed-validation.json"),
    dryRun: false,
    allowMassBlock: false,
  };
  for (const arg of process.argv.slice(2)) {
    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--allow-mass-block":
        options.allowMassBlock = true;
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        options.reportPath = path.resolve(arg);
    }
  }
  return options;
}

function readCurrentStatuses(source: string): Map<string, CatalogStatus> {
  const statuses = new Map<string, CatalogStatus>();
  for (const match of source.matchAll(/\{[^{}]*?id:\s*"(feed-\d{3})"[^{}]*?\}/g)) {
    const statusMatch = match[0].match(/status:\s*"(working|blocked|unverified)" as const/);
    if (statusMatch) {
      statuses.set(match[1]!, statusMatch[1] as CatalogStatus);
    }
  }
  return statuses;
}

function main() {
  const options = parseArgs();
  const root = process.cwd();
  const feedsPath = path.join(root, "backend", "src", "feeds.ts");

  if (!fs.existsSync(options.reportPath)) {
    console.error(`Validation report not found: ${options.reportPath}`);
    process.exit(1);
  }

  let observations;
  try {
    observations = parseReport(JSON.parse(fs.readFileSync(options.reportPath, "utf8")));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const source = fs.readFileSync(feedsPath, "utf8");
  const plan = planStatusUpdates(observations, readCurrentStatuses(source));
  const summary = summarizePlan(plan);

  if (summary.toBlocked > 0 && exceedsMassChangeGuard(summary.toBlocked, summary.considered)) {
    if (!options.allowMassBlock) {
      console.error(
        `Refusing to apply: ${summary.toBlocked} feeds would transition to blocked ` +
          `(>= 10 and >= 5% of ${summary.considered} considered). ` +
          `This usually means the report is dominated by WAF challenges or an outage. ` +
          `Re-run with --allow-mass-block if you have verified the report.`
      );
      process.exit(1);
    }
    console.warn(
      `WARNING: applying ${summary.toBlocked} blocked transitions under --allow-mass-block.`
    );
  }

  console.log(
    `Considered ${summary.considered} result(s): ` +
      `${summary.toBlocked} -> blocked, ${summary.toWorking} -> working, ` +
      `${summary.preserved} preserved (challenge/transient), ` +
      `${summary.unchanged} unchanged, ${summary.ignored} ignored (not in catalog).`
  );
  for (const change of plan.changes) {
    console.log(`  ${change.id}: ${change.from} -> ${change.to}`);
  }
  for (const kept of plan.preserved) {
    console.log(`  ${kept.id}: preserved (${kept.reason})`);
  }

  if (options.dryRun) {
    console.log("Dry run: no changes written.");
    return;
  }

  const { source: updated, changed } = applyPlanToSource(source, plan);
  if (changed > 0) {
    fs.writeFileSync(feedsPath, updated);
  }
  console.log(`Applied ${changed} status update(s) to ${path.relative(root, feedsPath)}.`);
}

main();
