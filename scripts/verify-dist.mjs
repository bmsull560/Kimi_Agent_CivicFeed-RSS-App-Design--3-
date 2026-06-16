import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");
const failures = [];

function fail(message) {
  failures.push(message);
}

if (!fs.existsSync(indexPath)) {
  fail("dist/index.html does not exist; run npm run build first");
} else {
  const html = fs.readFileSync(indexPath, "utf8");
  if (!html.includes('<div id="root"></div>')) fail("dist/index.html is missing the React root");
  if (!html.includes("type=\"module\"")) fail("dist/index.html is missing a module script");

  const assetRefs = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((match) => match[1]);
  if (assetRefs.length === 0) fail("dist/index.html has no relative asset references");

  for (const ref of assetRefs) {
    const assetPath = path.join(distDir, ref);
    if (!fs.existsSync(assetPath)) fail(`missing dist asset: ${ref}`);
  }
}

if (failures.length > 0) {
  console.error(`Static dist verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Static dist verification passed.");
