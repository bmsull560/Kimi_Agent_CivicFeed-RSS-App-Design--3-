import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = process.argv[2] ?? path.join("artifacts", "live-feed-validation.json");
const absoluteResultPath = path.resolve(root, resultPath);
const feedsPath = path.join(root, "backend", "src", "feeds.ts");

if (!fs.existsSync(absoluteResultPath)) {
  console.error(`Validation result not found: ${path.relative(root, absoluteResultPath)}`);
  process.exit(1);
}

const validation = JSON.parse(fs.readFileSync(absoluteResultPath, "utf8"));
const results = Array.isArray(validation.results) ? validation.results : [];
const statusesById = new Map();
const discoveredUrlsById = new Map();

for (const result of results) {
  if (!result?.id || !["working", "blocked"].includes(result.status)) continue;
  statusesById.set(result.id, result.status);
  if (result.status === "working" && result.discoveredUrl && result.discoveredUrl !== result.rssUrl) {
    discoveredUrlsById.set(result.id, result.discoveredUrl);
  }
}

if (statusesById.size === 0) {
  console.error("No applicable validation statuses found.");
  process.exit(1);
}

let source = fs.readFileSync(feedsPath, "utf8");
let changed = 0;

source = source.replace(/\{id:"(feed-\d{3})"[\s\S]*?\},/g, (feedLiteral, id) => {
  const nextStatus = statusesById.get(id);
  if (!nextStatus) return feedLiteral;
  let updated = feedLiteral.replace(/status:"(?:working|blocked|unverified)" as const/, `status:"${nextStatus}" as const`);
  const discoveredUrl = discoveredUrlsById.get(id);
  if (discoveredUrl) {
    updated = updated.replace(/rssUrl:"[^"]+"/, `rssUrl:"${discoveredUrl.replaceAll('"', "%22")}"`);
  }
  if (updated !== feedLiteral) changed += 1;
  return updated;
});

const statusCounts = { unverified: 0, working: 0, blocked: 0 };
for (const match of source.matchAll(/status:"(working|blocked|unverified)" as const/g)) {
  statusCounts[match[1]] += 1;
}

source = source.replace(
  /byStatus: \{ unverified: \d+, working: \d+, blocked: \d+ \}/,
  `byStatus: { unverified: ${statusCounts.unverified}, working: ${statusCounts.working}, blocked: ${statusCounts.blocked} }`,
);

fs.writeFileSync(feedsPath, source);
console.log(`Applied ${changed} live validation status update(s).`);
console.log(`Applied ${discoveredUrlsById.size} discovered feed URL update(s).`);
console.log(`byStatus: ${JSON.stringify(statusCounts)}`);
