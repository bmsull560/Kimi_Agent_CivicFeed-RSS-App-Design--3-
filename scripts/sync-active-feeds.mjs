import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const feedsPath = join(root, "src", "data", "feeds.ts");
const healthPath = join(root, "public", "feed-health.json");
const mirrorHealthPath = join(root, "src", "data", "feed-health.json");

const health = JSON.parse(readFileSync(healthPath, "utf8"));
const activeHealth = health.filter((item) => item.status === "ok");
const okIds = new Set(activeHealth.map((item) => item.feedId));

const lines = readFileSync(feedsPath, "utf8").split(/\r?\n/);
const start = lines.findIndex((line) => line.startsWith("export const feeds: Feed[] = ["));
const statsStart = lines.findIndex((line) => line.startsWith("export const feedStats = {"));
const functionsStart = lines.findIndex((line) => line.startsWith("export const getFeedsByCategory"));

if (start < 0 || statsStart < 0 || functionsStart < 0) {
  throw new Error("Unexpected src/data/feeds.ts structure");
}

const prefix = lines.slice(0, start + 1);
const entryLines = lines.slice(start + 1, statsStart);
const suffix = lines.slice(functionsStart).filter((line, index, arr) => index < arr.length - 1 || line !== "");
const kept = [];
const counts = new Map();

for (const line of entryLines) {
  const idMatch = line.match(/id:"(feed-\d+)"/);
  if (!idMatch || !okIds.has(idMatch[1])) continue;

  const updated = line.replace(
    /status:"(?:working|blocked|unverified)" as const/,
    'status:"working" as const'
  );
  kept.push(updated);

  const categoryMatch = updated.match(/category:"([^"]+)"/);
  if (categoryMatch) {
    counts.set(categoryMatch[1], (counts.get(categoryMatch[1]) || 0) + 1);
  }
}

const statsLines = ["export const feedStats = {", `  total: ${kept.length},`, "  byCategory: {"];
for (const [category, count] of counts.entries()) {
  statsLines.push(`    "${category}": ${count},`);
}
statsLines.push("  }", "};", "", "export const categoryList: string[] = [");
for (const category of counts.keys()) {
  statsLines.push(`  "${category}",`);
}
statsLines.push("];", "");

writeFileSync(
  feedsPath,
  [...prefix, ...kept, "];", "", ...statsLines, ...suffix].join("\n") + "\n",
  "utf8"
);

const healthJson = JSON.stringify(activeHealth, null, 2) + "\n";
writeFileSync(healthPath, healthJson, "utf8");
if (existsSync(mirrorHealthPath)) {
  writeFileSync(mirrorHealthPath, healthJson, "utf8");
}

console.log(`active feeds: ${kept.length}`);
console.log(`active health records: ${activeHealth.length}`);
