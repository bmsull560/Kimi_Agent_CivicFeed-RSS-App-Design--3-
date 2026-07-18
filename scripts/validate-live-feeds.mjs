import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tsx = path.join(root, "backend", "node_modules", ".bin", "tsx");
const cli = path.join(root, "backend", "src", "feed-validator-cli.ts");

const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
