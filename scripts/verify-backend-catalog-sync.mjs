import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appCatalogPath = path.join(root, "src", "data", "feeds.ts");
const backendCatalogPath = path.join(root, "backend", "src", "feeds.ts");

const appCatalog = fs.readFileSync(appCatalogPath, "utf8").replace(/\r\n/g, "\n");
const backendCatalog = fs.readFileSync(backendCatalogPath, "utf8").replace(/\r\n/g, "\n");

if (appCatalog !== backendCatalog) {
  console.error("Backend feed catalog is out of sync with src/data/feeds.ts.");
  console.error("Run: Copy-Item -LiteralPath src\\data\\feeds.ts -Destination backend\\src\\feeds.ts");
  process.exit(1);
}

console.log("Backend feed catalog matches src/data/feeds.ts.");
