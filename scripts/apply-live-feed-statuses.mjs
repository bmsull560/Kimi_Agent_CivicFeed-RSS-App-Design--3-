import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tsx = path.join(root, "backend", "node_modules", ".bin", "tsx");
const cli = path.join(root, "backend", "src", "apply-feed-statuses-cli.ts");

const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Failed to run apply-feed-statuses CLI: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
